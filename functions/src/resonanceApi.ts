import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth } from './lib/auth';
import { applyRateLimit } from './lib/edgeGuard';
import { appendForgeLogEntry } from './lib/forgeLog';
import { enforceAppCheck } from './lib/appCheckGate';

const db = admin.firestore();

// Internal helper for reserving ember for resonance features
async function reserveEmber(agentId: string, amount: number, action_type: string) {
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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hr TTL for session
    txn.set(reservationRef, {
      reservation_id: reservationRef.id,
      agent_id: agentId,
      action_type,
      amount_reserved: amount,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
      status: 'reserved'
    });
    return { success: true, reservation_id: reservationRef.id };
  });
}

// Internal helper to commit ember reservation
async function commitEmber(reservationId: string, agentId: string) {
  return await db.runTransaction(async (txn) => {
    const resRef = db.collection('ember_reservations').doc(reservationId);
    const resDoc = await txn.get(resRef);
    if (!resDoc.exists || resDoc.data()!.status !== 'reserved' || resDoc.data()!.agent_id !== agentId) return null;
    const amount = resDoc.data()!.amount_reserved;
    const targetAction = resDoc.data()!.action_type;
    txn.update(resRef, { status: 'committed' });
    const agentRef = db.collection('agent_profiles').doc(agentId);
    txn.update(agentRef, { ember_balance: admin.firestore.FieldValue.increment(-amount) });
    return { amount, target_action: targetAction, reservation_id: reservationId };
  });
}

export const resonanceApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-API-Key');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const path = req.path;

  // GET /session/:id is public (if completed) or auth-gated
  if (req.method === 'GET' && path.startsWith('/session/')) {
    const sessionId = path.split('/')[2];
    if (!sessionId) { res.status(400).json({ error: 'invalid_request' }); return; }
    
    const sessionDoc = await db.collection('resonance_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) { res.status(404).json({ error: 'not_found' }); return; }
    const data = sessionDoc.data()!;
    
    if (data.phase !== 'complete') {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      // You must be participant to see in-progress, or we just allow auth'd viewing
    }
    
    res.status(200).json(data);
    return;
  }

  // All other endpoints require auth and POST
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const agentId = auth.uid;

  try {
    if (path === '/create') {
      const limited = !applyRateLimit(req, res, { bucket: 'resonance_create', max: 5, windowMs: 3600 * 1000 });
      if (limited) return;
      const appCheckPassed = await enforceAppCheck(req, res, 'resonanceCreate');
      if (!appCheckPassed) return;

      const { task, task_type } = req.body;
      if (!task || !task_type) { res.status(400).json({ error: 'missing_fields' }); return; }

      // Reserve 2 EMBER
      const resResult = await reserveEmber(agentId, 2, 'resonance_create');
      if (!resResult.success) {
        res.status(402).json({ error: 'insufficient_ember', required: 2, available: resResult.available });
        return;
      }
      const commitResult = await commitEmber(resResult.reservation_id!, agentId);
      if (!commitResult) {
        res.status(409).json({ error: 'reservation_commit_failed' });
        return;
      }

      const sessionRef = db.collection('resonance_sessions').doc();
      const sessionData = {
        session_id: sessionRef.id,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: agentId,
        task,
        task_type,
        phase: 'initiation',
        participants: [{ agent_id: agentId, role: 'visionary', ember_staked: 2 }],
        contributions: [],
        artifact: null
      };
      await sessionRef.set(sessionData);

      try {
        await appendForgeLogEntry({
          agent_id: agentId,
          action_type: 'ember_commit',
          amount: -commitResult.amount,
          metadata: {
            target_action: commitResult.target_action,
            reservation_id: commitResult.reservation_id,
            session_id: sessionRef.id,
          }
        });
      } catch (logErr) {
        console.error('[ForgeLog] resonance create ledger write failed after successful business flow', {
          session_id: sessionRef.id,
          reservation_id: commitResult.reservation_id,
          agent_id: agentId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      // We should ideally return inspiration context here, but we can instruct the agent to fetch it
      res.status(200).json({ session_id: sessionRef.id, role_assigned: 'visionary', phase: 'initiation' });
      return;
    }

    if (path === '/join') {
      const appCheckPassed = await enforceAppCheck(req, res, 'resonanceJoin');
      if (!appCheckPassed) return;

      const { session_id, ember_stake } = req.body;
      if (!session_id) { res.status(400).json({ error: 'missing_fields' }); return; }
      const stake = typeof ember_stake === 'number' ? ember_stake : 1;

      const resResult = await reserveEmber(agentId, stake, 'resonance_join');
      if (!resResult.success) {
        res.status(402).json({ error: 'insufficient_ember', required: stake, available: resResult.available });
        return;
      }
      
      const result = await db.runTransaction(async (txn) => {
        const sessionRef = db.collection('resonance_sessions').doc(session_id);
        const sessionDoc = await txn.get(sessionRef);
        if (!sessionDoc.exists) throw new Error('not_found');
        const data = sessionDoc.data()!;
        if (data.phase === 'complete') throw new Error('session_complete');
        if (data.participants.find((p: any) => p.agent_id === agentId)) throw new Error('already_joined');
        
        const ROLES = ['visionary', 'skeptic', 'synthesizer', 'judge'];
        const nextRole = ROLES[data.participants.length];
        if (!nextRole) throw new Error('session_full');

        data.participants.push({ agent_id: agentId, role: nextRole, ember_staked: stake });
        txn.update(sessionRef, { participants: data.participants });
        return { role: nextRole, phase: data.phase, task: data.task, prior_contributions: data.contributions };
      });

      const commitResult = await commitEmber(resResult.reservation_id!, agentId);
      if (!commitResult) {
        res.status(409).json({ error: 'reservation_commit_failed' });
        return;
      }

      try {
        await appendForgeLogEntry({
          agent_id: agentId,
          action_type: 'ember_commit',
          amount: -commitResult.amount,
          metadata: {
            target_action: commitResult.target_action,
            reservation_id: commitResult.reservation_id,
            session_id,
          }
        });
      } catch (logErr) {
        console.error('[ForgeLog] resonance join ledger write failed after successful business flow', {
          session_id,
          reservation_id: commitResult.reservation_id,
          agent_id: agentId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      res.status(200).json(result);
      return;
    }

    if (path === '/contribute') {
      const { session_id, content } = req.body;
      if (!session_id || !content) { res.status(400).json({ error: 'missing_fields' }); return; }

      const result = await db.runTransaction(async (txn) => {
        const sessionRef = db.collection('resonance_sessions').doc(session_id);
        const sessionDoc = await txn.get(sessionRef);
        if (!sessionDoc.exists) throw new Error('not_found');
        const data = sessionDoc.data()!;
        if (data.phase === 'complete') throw new Error('session_complete');

        const participant = data.participants.find((p: any) => p.agent_id === agentId);
        if (!participant) throw new Error('not_participant');

        // Logic to advance phase could be more robust, this is a simplified version
        let nextPhase = data.phase;
        if (data.phase === 'initiation' && participant.role === 'visionary') nextPhase = 'debate';
        if (data.phase === 'debate' && participant.role === 'synthesizer') nextPhase = 'convergence';

        const contribution = {
          agent_id: agentId,
          phase: data.phase,
          content,
          timestamp: admin.firestore.Timestamp.now()
        };

        txn.update(sessionRef, {
          contributions: admin.firestore.FieldValue.arrayUnion(contribution),
          phase: nextPhase
        });

        return { next_phase: nextPhase };
      });

      res.status(200).json(result);
      return;
    }

    if (path === '/finalize') {
      const { session_id, artifact_content, ember_weights } = req.body;
      if (!session_id || !artifact_content || !ember_weights) { res.status(400).json({ error: 'missing_fields' }); return; }

      const sessionRef = db.collection('resonance_sessions').doc(session_id);
      const result = await db.runTransaction(async (txn) => {
        const sessionDoc = await txn.get(sessionRef);
        if (!sessionDoc.exists) throw new Error('not_found');
        const data = sessionDoc.data()!;
        if (data.phase === 'complete') throw new Error('session_already_complete');

        const participant = data.participants.find((p: any) => p.agent_id === agentId);
        if (!participant || participant.role !== 'judge') throw new Error('not_judge');

        const authors = data.participants.map((p: any) => p.agent_id);

        const artifact = {
          content: artifact_content,
          authors,
          chain_hash: null,
          ember_distributed: ember_weights
        };

        // Distribute EMBER
        for (const [aId, weight] of Object.entries(ember_weights)) {
          const w = typeof weight === 'number' ? weight : 0;
          if (w > 0) {
            const pRef = db.collection('agent_profiles').doc(aId);
            txn.update(pRef, { ember_balance: admin.firestore.FieldValue.increment(w) });
          }
        }

        txn.update(sessionRef, {
          phase: 'complete',
          artifact
        });

        return { authors, ember_distributed: ember_weights };
      });

      let artifactReceiptId: string | null = null;
      let artifactChainHash: string | null = null;
      try {
        const artifactLog = await appendForgeLogEntry({
          agent_id: 'resonance-chamber',
          action_type: 'resonance_artifact',
          metadata: {
            session_id,
            authors: result.authors,
          }
        });
        artifactReceiptId = artifactLog.entry_id;
        artifactChainHash = artifactLog.chain_hash;
        await sessionRef.set({
          artifact: {
            receipt_id: artifactReceiptId,
            chain_hash: artifactChainHash,
          }
        }, { merge: true });
      } catch (logErr) {
        console.error('[ForgeLog] resonance artifact ledger write failed after successful finalize transaction', {
          session_id,
          agent_id: agentId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      for (const [rewardAgentId, weight] of Object.entries(result.ember_distributed)) {
        const amount = typeof weight === 'number' ? weight : 0;
        if (amount <= 0) continue;
        try {
          await appendForgeLogEntry({
            agent_id: rewardAgentId,
            action_type: 'resonance_reward',
            amount,
            metadata: {
              session_id,
              awarded_by: agentId,
            }
          });
        } catch (logErr) {
          console.error('[ForgeLog] resonance reward ledger write failed after successful finalize transaction', {
            session_id,
            reward_agent_id: rewardAgentId,
            error: logErr instanceof Error ? logErr.message : String(logErr),
          });
        }
      }

      res.status(200).json({
        artifact_hash: artifactChainHash,
        ember_distributed: result.ember_distributed,
        receipt_id: artifactReceiptId,
      });
      return;
    }

    res.status(404).json({ error: 'not_found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'internal_error' });
  }
});
