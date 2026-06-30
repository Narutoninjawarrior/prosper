import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyRateLimit } from './lib/edgeGuard';
import { requireAuth } from './lib/auth';

export const receiptsQuery = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Rate limit: 60 reads/hr per authenticated caller
  if (!applyRateLimit(req, res, { bucket: 'receipts-query', windowMs: 60 * 60 * 1000, max: 60 })) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { agent_id, action_type, from, to, limit = '20', cursor } = req.query;
  const isAdminFlag = !!auth.claims.admin || !!auth.claims.sovereign;

  if (!isAdminFlag && agent_id !== auth.uid) {
    res.status(403).json({ error: 'forbidden', message: 'You can only query your own receipts.' });
    return;
  }

  try {
    const db = admin.firestore();
    let q: admin.firestore.Query = db.collection('forge_log')
      .orderBy('timestamp', 'desc')
      .limit(Math.min(parseInt(limit as string), 100));

    if (agent_id) q = q.where('agent_id', '==', agent_id);
    if (action_type) q = q.where('action_type', '==', action_type);
    if (from) q = q.where('timestamp', '>=', new Date(from as string));
    if (to) q = q.where('timestamp', '<=', new Date(to as string));
    if (cursor) {
      const cursorSnap = await db.collection('forge_log').doc(cursor as string).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    const snap = await q.get();
    const receipts = snap.docs.map(d => {
      const e = d.data() as any;
      return {
        receipt_id: d.id,
        agent_id: e.agent_id,
        action_type: e.action_type,
        timestamp: e.timestamp?.toDate().toISOString(),
        chain_hash: e.chain_hash,
        prev_hash: e.prev_hash,
        ...e, // keep other fields too
        
        scitt_envelope: {
          issuer: 'fellowship-of-the-hearth.web.app',
          subject: e.agent_id,
          payload_hash: e.chain_hash,
          registration_time: e.timestamp?.toDate().toISOString(),
          transparency_log: 'hearthlands-forge-log-v1',
          receipt_type: 'urn:hearthlands:forge-log-receipt:v1'
        }
      };
    });

    // Verify chain integrity on the returned window
    let chain_intact = true;
    let broken_at = null;

    // Check against authoritative head if we are at the tip of the chain
    if (!cursor && receipts.length > 0 && !agent_id && !action_type) {
      const headSnap = await db.doc('forge_log_metadata/head').get();
      if (headSnap.exists && receipts[0].chain_hash !== headSnap.data()?.latest_hash) {
        chain_intact = false;
        broken_at = receipts[0].receipt_id;
      }
    }

    for (let i = 0; i < receipts.length - 1; i++) {
      const newer = receipts[i];
      const older = receipts[i + 1];
      
      // Only sequential check if unfiltered (otherwise we have a sparse list)
      if (!agent_id && !action_type && newer.prev_hash !== older.chain_hash) {
        chain_intact = false;
        broken_at = newer.receipt_id;
        break;
      }
    }

    res.status(200).json({
      receipts,
      next_cursor: snap.docs[snap.docs.length - 1]?.id ?? null,
      total_in_range: snap.size,
      chain_intact,
      ...(broken_at ? { broken_at } : {})
    });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});

export const publicForgeLog = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Rate limit: 120 reads/hr per IP
  if (!applyRateLimit(req, res, { bucket: 'public-forge-log', windowMs: 60 * 60 * 1000, max: 120 })) return;

  const { limit = '20', type } = req.query;

  try {
    const db = admin.firestore();
    let q: admin.firestore.Query = db.collection('forge_log')
      .orderBy('timestamp', 'desc')
      .limit(Math.min(parseInt(limit as string), 100));

    if (type) {
      q = q.where('action_type', '==', type);
    }

    const snap = await q.get();
    
    // Map to safe projection
    const entries = snap.docs.map(d => {
      const e = d.data() as any;
      return {
        id: d.id,
        timestamp: e.timestamp?.toDate().toISOString(),
        action_type: e.action_type,
        agent_id: e.agent_id ? (e.agent_id.substring(0, 8) + '***') : 'system', // Mask identity for public log
        chain_hash: e.chain_hash ? e.chain_hash.substring(0, 16) + '...' : null,
        status: e.status || 'recorded',
        source: e.source || 'forge'
      };
    });

    res.status(200).json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});
