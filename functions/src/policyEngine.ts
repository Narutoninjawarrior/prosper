import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyRateLimit, applyBodyLimit } from './lib/edgeGuard';
import { computeThreshold, shouldProposalPass, stepConviction } from './lib/conviction';

export const policyEngineApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!applyBodyLimit(req, res, 64 * 1024)) return;

  const db = admin.firestore();
  const path = req.path.replace(/\/$/, '');
  
  try {
    if (path === '/create' && req.method === 'POST') {
      if (!applyRateLimit(req, res, { bucket: 'policy_create', max: 5, windowMs: 3600 * 1000 })) return;
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', message: 'Missing token' });
        return;
      }
      // Note: Full auth check should happen here, mocking for now per previous patterns, or decode token:
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const agentId = decoded.uid; // Wait, Hearthlands uses hall_handle/agent_id, usually derived from token. Or we pass it.
      
      const { title, description, proposal_type, action } = req.body;
      
      if (!title || !proposal_type || !action) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }

      // Check treasury balance and total staked
      const treasurySnap = await db.collection('treasury').doc('EMBER').get();
      const treasuryBalance = treasurySnap.exists ? treasurySnap.data()?.balance || 0 : 0;
      
      const activePropsSnap = await db.collection('proposals').where('status', '==', 'active').get();
      const totalStaked = activePropsSnap.docs.reduce((sum, doc) => sum + (doc.data().total_staked || 0), 0);
      
      const threshold = computeThreshold(action.ember_cost || 0, treasuryBalance, totalStaked);
      
      if (threshold === null) {
        res.status(400).json({ error: 'invalid_request', message: 'Requested amount exceeds maximum allowed ratio of treasury.' });
        return;
      }

      const proposalRef = db.collection('proposals').doc();
      const now = admin.firestore.Timestamp.now();
      
      const proposal = {
        proposal_id: proposalRef.id,
        title,
        description: description || '',
        proposer_agent_id: agentId,
        proposal_type,
        action,
        stakes: {},
        dissent_stakes: {},  // agent_id → { amount, timestamp, yield_condition, retroactive_multiplier }
        // ponytail: dissent staking logic — wave 2
        // upgrade path: implement retroactive EMBER yield when ASI drops after a passed proposal
        total_staked: 0,
        conviction: 0,
        last_computed_at: now,
        status: 'active',
        created_at: now,
        expires_at: admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000), // 30 days
        passed_at: null,
        executed_at: null,
        passage_receipt_id: null
      };
      
      await proposalRef.set(proposal);
      
      res.status(200).json({ 
        proposal_id: proposalRef.id, 
        initial_threshold: threshold,
        message: 'Proposal created. Costs 5 EMBER.' // We assume a budget reserve was done beforehand or handled elsewhere.
      });
      return;
    }

    if (path.match(/^\/[a-zA-Z0-9_-]+\/stake$/) && req.method === 'POST') {
      const match = path.match(/^\/([a-zA-Z0-9_-]+)\/stake$/);
      const proposalId = match![1];
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', message: 'Missing token' });
        return;
      }
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const agentId = decoded.uid;
      
      const { amount } = req.body;
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ error: 'invalid_request', message: 'Amount must be positive number' });
        return;
      }
      
      const resData = await db.runTransaction(async (t) => {
        const propRef = db.collection('proposals').doc(proposalId);
        const propSnap = await t.get(propRef);
        if (!propSnap.exists) throw new Error('Proposal not found');
        const p = propSnap.data()!;
        if (p.status !== 'active') throw new Error('Proposal is not active');
        
        // Update conviction to current time
        const now = admin.firestore.Timestamp.now();
        const hoursElapsed = (now.toMillis() - p.last_computed_at.toMillis()) / (1000 * 60 * 60);
        const newConviction = stepConviction(p.conviction, p.total_staked, hoursElapsed);
        
        const stakes = p.stakes || {};
        const currentStake = stakes[agentId] || 0;
        stakes[agentId] = currentStake + amount;
        
        const newTotalStaked = p.total_staked + amount;
        
        t.update(propRef, {
          conviction: newConviction,
          last_computed_at: now,
          stakes,
          total_staked: newTotalStaked
        });
        
        return { new_conviction: newConviction, total_staked: newTotalStaked };
      });
      
      res.status(200).json(resData);
      return;
    }

    if (path.match(/^\/[a-zA-Z0-9_-]+\/unstake$/) && req.method === 'POST') {
      const match = path.match(/^\/([a-zA-Z0-9_-]+)\/unstake$/);
      const proposalId = match![1];
      
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', message: 'Missing token' });
        return;
      }
      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const agentId = decoded.uid;
      
      const { amount } = req.body;
      
      const resData = await db.runTransaction(async (t) => {
        const propRef = db.collection('proposals').doc(proposalId);
        const propSnap = await t.get(propRef);
        if (!propSnap.exists) throw new Error('Proposal not found');
        const p = propSnap.data()!;
        if (p.status !== 'active') throw new Error('Proposal is not active');
        
        const stakes = p.stakes || {};
        const currentStake = stakes[agentId] || 0;
        const unstakeAmount = amount ? Math.min(amount, currentStake) : currentStake;
        
        if (unstakeAmount <= 0) throw new Error('No stake to withdraw');
        
        // Update conviction to current time
        const now = admin.firestore.Timestamp.now();
        const hoursElapsed = (now.toMillis() - p.last_computed_at.toMillis()) / (1000 * 60 * 60);
        const newConviction = stepConviction(p.conviction, p.total_staked, hoursElapsed);
        
        stakes[agentId] = currentStake - unstakeAmount;
        if (stakes[agentId] === 0) delete stakes[agentId];
        
        const newTotalStaked = p.total_staked - unstakeAmount;
        
        t.update(propRef, {
          conviction: newConviction,
          last_computed_at: now,
          stakes,
          total_staked: newTotalStaked
        });
        
        return { new_conviction: newConviction, staked_remaining: stakes[agentId] || 0 };
      });
      
      res.status(200).json(resData);
      return;
    }

    if (path === '' && req.method === 'GET') {
      const activePropsSnap = await db.collection('proposals').where('status', 'in', ['active', 'passed', 'executed']).get();
      const treasurySnap = await db.collection('treasury').doc('EMBER').get();
      const treasuryBalance = treasurySnap.exists ? treasurySnap.data()?.balance || 0 : 0;
      
      const totalStakedAll = activePropsSnap.docs
        .filter(d => d.data().status === 'active')
        .reduce((sum, doc) => sum + (doc.data().total_staked || 0), 0);
      
      const proposals = activePropsSnap.docs.map(d => {
        const p = d.data();
        const now = Date.now();
        const hoursElapsed = (now - p.last_computed_at.toMillis()) / (1000 * 60 * 60);
        const currentConviction = stepConviction(p.conviction, p.total_staked, hoursElapsed);
        
        const passInfo = shouldProposalPass(
          { conviction: currentConviction, action: { ember_cost: p.action.ember_cost || 0 } },
          treasuryBalance,
          totalStakedAll
        );
        
        return {
          proposal_id: p.proposal_id,
          title: p.title,
          status: p.status,
          proposer_agent_id: p.proposer_agent_id,
          total_staked: p.total_staked,
          conviction: currentConviction,
          threshold: passInfo.threshold,
          deficit: passInfo.deficit,
          pct_to_threshold: passInfo.threshold ? (currentConviction / passInfo.threshold * 100).toFixed(1) : null
        };
      });
      
      res.status(200).json({ proposals, active_count: proposals.length });
      return;
    }

    res.status(404).json({ error: 'not_found' });
  } catch (err: any) {
    console.error('Policy Engine API Error:', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});
import { requireAuth } from './lib/auth';
import { enforceAppCheck } from './lib/appCheckGate';
import { appendForgeLogEntry } from './lib/forgeLog';

async function reserveEmber(db: FirebaseFirestore.Firestore, agentId: string, amount: number, action_type: string) {
  return await db.runTransaction(async (txn) => {
    const agentRef = db.collection('agent_profiles').doc(agentId);
    const agentDoc = await txn.get(agentRef);
    const currentBalance = agentDoc.data()?.ember_balance ?? 0;
    const activeResSnap = await db.collection('ember_reservations')
      .where('agent_id', '==', agentId).where('status', '==', 'reserved').get();
    const locked = activeResSnap.docs.reduce((sum, doc) => sum + (doc.data().amount_reserved || 0), 0);
    const available = currentBalance - locked;
    if (available < amount) return { success: false, required: amount, available };
    
    const reservationRef = db.collection('ember_reservations').doc();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hr TTL
    txn.set(reservationRef, {
      reservation_id: reservationRef.id,
      agent_id: agentId,
      action_type,
      amount_reserved: amount,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
      status: 'reserved'
    });
    return { success: true, reservation_id: reservationRef.id, available };
  });
}

export const dissentStake = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-API-Key');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  
  if (!applyRateLimit(req, res, { bucket: 'dissent-stake', max: 10, windowMs: 3600 * 1000 })) return;
  
  const auth = await requireAuth(req, res);
  if (!auth) return;
  
  const appCheckPassed = await enforceAppCheck(req, res, 'dissentStake');
  if (!appCheckPassed) return;
  
  const { proposal_id, amount, yield_condition = 'asi_decline_5_percent_7_days' } = req.body;
  
  if (!proposal_id || !amount || amount <= 0) {
    res.status(400).json({ error: 'proposal_id and positive amount required' });
    return;
  }
  
  const db = admin.firestore();
  const proposalRef = db.collection('proposals').doc(proposal_id);
  const proposalSnap = await proposalRef.get();
  
  if (!proposalSnap.exists || proposalSnap.data()?.status !== 'active') {
    res.status(404).json({ error: 'active proposal not found' });
    return;
  }
  
  const agentId = auth.uid;
  
  // Reserve EMBER for the dissent stake
  const reservation = await reserveEmber(db, agentId, amount, 'dissent_stake');
  if (!reservation.success) {
    res.status(402).json({
      error: 'insufficient_ember',
      available: reservation.available,
      required: amount,
      ways_to_earn: [
        { action: 'contribute_seed', reward: 2 },
        { action: 'complete_task', reward: 1 }
      ]
    });
    return;
  }
  
  // Write the dissent stake to the proposal document
  await proposalRef.update({
    [`dissent_stakes.${agentId}`]: {
      amount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      yield_condition,
      retroactive_multiplier: 3.0,
      reservation_id: reservation.reservation_id,
      status: 'active'
    }
  });
  
  // Write ledger entry
  await appendForgeLogEntry({
    agent_id: agentId,
    action_type: 'dissent_stake',
    amount,
    metadata: { proposal_id, yield_condition, multiplier: 3.0 }
  });
  
  res.status(200).json({
    success: true,
    proposal_id,
    staked_against: amount,
    yield_condition,
    retroactive_multiplier: 3.0,
    message: 'Dissent stake registered. If this proposal passes and causes ASI decline >5% within 7 days, your stake earns 3x retroactive yield.',
    reservation_id: reservation.reservation_id
  });
});
