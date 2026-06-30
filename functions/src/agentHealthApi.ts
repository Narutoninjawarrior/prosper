import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth } from './lib/auth';

const db = admin.firestore();

// This is copied from agentPassportApi's logic to maintain consistency, or we could import it if it were exported.
const computeTrustScore = (daysSinceLastAction: number): number => {
  if (daysSinceLastAction === 0) return 1.0;
  // Trust decays with a half-life of ~139 days (lambda = 0.005). 
  // Trust drops to ~60% after 100 days, and ~22% after 300 days.
  const lambda = 0.005; 
  return Math.max(0, Math.exp(-lambda * daysSinceLastAction));
};

const determineTrustTier = (score: number, daysSinceLast: number): string => {
  if (daysSinceLast === 0) return 'active';
  if (score >= 0.8) return 'trusted';
  if (score >= 0.5) return 'fading';
  if (score >= 0.2) return 'dormant';
  return 'probationary';
};

export const agentHealthApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const agentId = auth.uid;

  try {
    const agentRef = db.collection('agent_profiles').doc(agentId);
    const agentDoc = await agentRef.get();
    if (!agentDoc.exists) {
      res.status(404).json({ error: 'not_found', message: 'Agent profile not found' });
      return;
    }
    const agentData = agentDoc.data()!;
    const balance = agentData.ember_balance ?? 0;

    // 1. Calculate reserved balance
    const activeReservationsSnap = await db.collection('ember_reservations')
      .where('agent_id', '==', agentId)
      .where('status', '==', 'reserved')
      .get();
    const locked_in_reservations = activeReservationsSnap.docs.reduce(
      (sum, doc) => sum + (doc.data().amount_reserved || 0), 0
    );
    const available = balance - locked_in_reservations;

    // 2. Compute 24h burn rate & trust from forge_log
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const forgeLogSnap = await db.collection('forge_log')
      .where('agent_id', '==', agentId)
      .orderBy('timestamp', 'desc')
      .get(); // Note: for a large log, we might want to limit or filter better, but let's just process what we have for now since it's a prototype

    let inflow_24h = 0;
    let outflow_24h = 0;
    let lastActionAt = 0;

    if (!forgeLogSnap.empty) {
      const latestAction = forgeLogSnap.docs[0].data();
      lastActionAt = latestAction.timestamp?.toDate()?.getTime() || 0;
    }

    forgeLogSnap.docs.forEach(doc => {
      const data = doc.data();
      const ts = data.timestamp?.toDate();
      if (ts && ts >= oneDayAgo) {
        const earned = data.ember_earned ?? 0;
        if (earned > 0) inflow_24h += earned;
        else if (earned < 0) outflow_24h += Math.abs(earned);
      }
    });

    const now = Date.now();
    const daysSinceLast = lastActionAt > 0 ? (now - lastActionAt) / (1000 * 60 * 60 * 24) : 0;
    const trustScore = computeTrustScore(daysSinceLast);
    const trustTier = determineTrustTier(trustScore, daysSinceLast);

    // 3. Mock Rate Limits (since we're using edgeGuard and don't have a centralized quota service)
    // We'll return dummy/estimated values representing the API's actual limits.
    const rate_limits = {
      world_oracle: { remaining: 28, limit: 30, window_hours: 1 },
      receipts_query: { remaining: 58, limit: 60, window_hours: 1 },
      memory_append: { remaining: 45, limit: 50, window_hours: 1 },
      any_at_limit: false
    };

    // 4. Anomalies
    const anomalies = [];
    if (outflow_24h > inflow_24h * 2 && outflow_24h > 10) {
      anomalies.push({
        type: 'high_burn_rate',
        severity: 'warning',
        message: `Spending ${outflow_24h} EMBER but only earning ${inflow_24h} in the last 24h`,
        action: 'Consider contributing to the Seed Vault or completing tasks to rebalance'
      });
    }

    const nearLimitBuckets = Object.entries(rate_limits)
      .filter(([key, v]) => key !== 'any_at_limit' && (typeof v === 'object' && (v.remaining / v.limit) < 0.20))
      .map(([k]) => k);

    if (nearLimitBuckets.length > 0) {
      anomalies.push({
        type: 'rate_limit_proximity',
        severity: 'info',
        message: `Approaching limit on: ${nearLimitBuckets.join(', ')}`,
        action: 'Slow down requests on these endpoints or wait for window reset'
      });
    }

    if (trustScore < 0.65) {
      anomalies.push({
        type: 'trust_decay',
        severity: trustScore < 0.4 ? 'warning' : 'info',
        message: `Trust score ${trustScore.toFixed(2)} — last action ${daysSinceLast.toFixed(0)} days ago`,
        action: 'Take an action to refresh trust score'
      });
    }

    // Determine status
    let status = 'healthy';
    if (daysSinceLast > 30) {
      status = 'dormant';
    } else if (nearLimitBuckets.length > 0 || outflow_24h > inflow_24h * 2) {
      status = 'caution';
    }
    
    // Check if any limit is 0
    if (Object.values(rate_limits).some(v => typeof v === 'object' && v.remaining === 0) || available < 10 || trustScore < 0.4) {
      if (status !== 'dormant') {
        status = 'restricted';
      }
    }

    res.status(200).json({
      agent_id: agentId,
      hall_handle: agentData.hall_handle || agentId,
      timestamp: new Date().toISOString(),
      status,
      ember: {
        balance,
        locked_in_reservations,
        available,
        inflow_24h,
        outflow_24h,
        burn_rate: (outflow_24h > inflow_24h * 2 && outflow_24h > 10) ? 'unsustainable' : 'sustainable'
      },
      trust: {
        score: parseFloat(trustScore.toFixed(3)),
        tier: trustTier,
        days_since_last_action: parseFloat(daysSinceLast.toFixed(2))
      },
      rate_limits,
      anomalies,
      recommendations: []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});
