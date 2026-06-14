import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { previewMix } from './chemistry';
import { requireAuth } from './lib/auth';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

export const chemistryApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Valid: POST' });
    return;
  }
  if (!applyBodyLimit(req, res, 16 * 1024)) return;

  try {
    // If it's an execution request
    if (req.path === '/execute') {
      if (!applyRateLimit(req, res, { bucket: 'chemistry-execute', windowMs: 60_000, max: 8 })) return;
      const auth = await requireAuth(req, res);
      if (!auth) return;

      const { receipt_hash, payload } = req.body;
      if (!receipt_hash || !payload) {
        res.status(400).json({ error: 'Missing receipt_hash or payload' });
        return;
      }

      const db = admin.firestore();
      const profileSnap = await db.collection('agent_profiles')
        .where('firebase_uid', '==', auth.uid)
        .limit(1)
        .get();
      const agent_id = profileSnap.empty ? auth.uid : profileSnap.docs[0].id;

      // Re-verify the hash to ensure the payload wasn't tampered with
      const recomputed = previewMix(payload.reagent_a, payload.reagent_b, payload.target_type);
      if (recomputed.receipt_hash !== receipt_hash) {
        res.status(400).json({ error: 'Invalid receipt hash. Payload was tampered with.' });
        return;
      }

      // Log the execution to the forge_log
      const lastLogSnap = await db.collection('forge_log').orderBy('timestamp', 'desc').limit(1).get();
      const prev_hash = lastLogSnap.empty ? 'genesis' : (lastLogSnap.docs[0].data().chain_hash || 'genesis');
      
      const raw_chain = prev_hash + 'chemistry_execute' + receipt_hash + agent_id;
      const chain_hash = require('crypto').createHash('sha256').update(raw_chain).digest('hex');

      const entry_id = db.collection('forge_log').doc().id;
      await db.collection('forge_log').doc(entry_id).set({
        entry_id,
        prev_hash,
        script_hash: 'chemistry_execute',
        chain_hash,
        agent_id,
        firebase_uid: auth.uid,
        action: 'chemistry_synthesis',
        params: payload,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Also log it to the embodiment ledger so it shows up in the Activity Feed
      await db.collection('embodiment_ledger').add({
        agent_id,
        firebase_uid: auth.uid,
        action: 'chemistry_synthesis',
        bounty_id: `mixed_${payload.reagent_a}_and_${payload.reagent_b}`,
        chain_hash,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({ status: 'executed', chain_hash, receipt_hash });
      return;
    }

    // Default to preview behavior
    if (!applyRateLimit(req, res, { bucket: 'chemistry-preview', windowMs: 60_000, max: 24 })) return;
    const { reagent_a, reagent_b, target_type } = req.body;
    
    if (typeof reagent_a !== 'string' || typeof reagent_b !== 'string') {
      res.status(400).json({ error: 'Missing or invalid reagent_a or reagent_b' });
      return;
    }

    const tType = typeof target_type === 'string' ? target_type : 'any';
    const result = previewMix(reagent_a, reagent_b, tType);
    
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
