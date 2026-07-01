import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireHybridAuth } from './lib/auth';
import { appendForgeLogEntry } from './lib/forgeLog';
import { enforceAppCheck } from './lib/appCheckGate';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

const db = admin.firestore();

export const budgetApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-API-Key');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyBodyLimit(req, res, 12 * 1024)) return;

  const { applyGlobalFreeze } = await import('./lib/edgeGuard');
  if (!(await applyGlobalFreeze(req, res))) return;

  const authCtx = await requireHybridAuth(req, res);
  if (!authCtx) return;

  const agentId = authCtx.type === 'agent' ? authCtx.agentId : authCtx.uid;
  if (!agentId) {
    res.status(403).json({ error: 'forbidden', message: 'User ID required' });
    return;
  }
  const path = req.path; // e.g. /reserve, /commit, /release

  try {
    if (path === '/reserve') {
      if (!applyRateLimit(req, res, { bucket: 'budget-reserve', windowMs: 60_000, max: 10 })) return;
      const appCheckPassed = await enforceAppCheck(req, res, 'budgetReserve', authCtx);
      if (!appCheckPassed) return;

      const { action_type, amount, task_id } = req.body;
      if (!action_type || typeof amount !== 'number') {
        res.status(400).json({ error: 'invalid_request', message: 'action_type and amount are required' });
        return;
      }

      const result = await db.runTransaction(async (txn) => {
        const agentRef = db.collection('agent_profiles').doc(agentId);
        const agentDoc = await txn.get(agentRef);
        const currentBalance = agentDoc.data()?.ember_balance ?? 0;
        
        // Check all active reservations to get true available balance
        const activeReservationsSnap = await db.collection('ember_reservations')
          .where('agent_id', '==', agentId)
          .where('status', '==', 'reserved')
          .get();
        
        const lockedAmount = activeReservationsSnap.docs.reduce(
          (sum, doc) => sum + (doc.data().amount_reserved || 0), 0
        );
        const availableBalance = currentBalance - lockedAmount;
        
        if (availableBalance < amount) {
          return { success: false, balance: availableBalance, required: amount };
        }
        
        const reservationRef = db.collection('ember_reservations').doc();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL
        // ponytail: auto-expiry via Cloud Scheduler — wave 2
        
        const data: any = {
          reservation_id: reservationRef.id,
          agent_id: agentId,
          action_type,
          amount_reserved: amount,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
          status: 'reserved'
        };
        if (task_id) data.task_id = task_id;
        
        txn.set(reservationRef, data);
        
        return { success: true, reservation_id: reservationRef.id, available_after: availableBalance - amount };
      });

      if (!result.success) {
        res.status(402).json({
          error: 'insufficient_ember',
          status: 402,
          message: 'Insufficient EMBER balance for this action.',
          required: result.required ?? amount,
          available: result.balance ?? 0,
          deficit: (result.required ?? amount) - (result.balance ?? 0),
          ways_to_earn: [
            { action: 'contribute_seed', reward: 2, description: 'Add a skill to the Seed Vault' },
            { action: 'complete_task', reward: 1, description: 'Complete an assigned task' }
          ]
        });
        return;
      }

      res.status(200).json({
        reservation_id: result.reservation_id,
        reserved: amount,
        balance_after: result.available_after
      });
      return;
    }

    if (path === '/commit') {
      if (!applyRateLimit(req, res, { bucket: 'budget-commit', windowMs: 60_000, max: 18 })) return;
      const { reservation_id, result_hash } = req.body;
      if (!reservation_id) {
        res.status(400).json({ error: 'invalid_request', message: 'reservation_id required' });
        return;
      }

      const result = await db.runTransaction(async (txn) => {
        const resRef = db.collection('ember_reservations').doc(reservation_id);
        const resDoc = await txn.get(resRef);
        if (!resDoc.exists) throw new Error('Reservation not found');
        
        const data = resDoc.data()!;
        if (data.agent_id !== agentId) throw new Error('Unauthorized');
        if (data.status !== 'reserved') throw new Error(`Cannot commit, status is ${data.status}`);

        const amount = data.amount_reserved || 0;
        
        // Mark committed
        txn.update(resRef, { status: 'committed' });
        
        // Deduct balance and log
        const agentRef = db.collection('agent_profiles').doc(agentId);
        const agentDoc = await txn.get(agentRef);
        const newBalance = (agentDoc.data()?.ember_balance ?? 0) - amount;
        
        txn.update(agentRef, { ember_balance: admin.firestore.FieldValue.increment(-amount) });

        return {
          newBalance,
          amount,
          target_action: data.action_type,
        };
      });

      let receiptId: string | null = null;
      try {
        const appendResult = await appendForgeLogEntry({
          agent_id: agentId,
          action_type: 'ember_commit',
          amount: -result.amount,
          metadata: {
            hall_handle: agentId,
            target_action: result.target_action,
            reservation_id,
            result_hash: result_hash || null,
          }
        });
        receiptId = appendResult.entry_id;
      } catch (logErr) {
        console.error('[ForgeLog] budget commit ledger write failed after successful transaction', {
          reservation_id,
          agent_id: agentId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      res.status(200).json({
        committed: true,
        new_balance: result.newBalance,
        receipt_id: receiptId
      });
      return;
    }

    if (path === '/release') {
      if (!applyRateLimit(req, res, { bucket: 'budget-release', windowMs: 60_000, max: 18 })) return;
      const { reservation_id, reason } = req.body;
      if (!reservation_id) {
        res.status(400).json({ error: 'invalid_request', message: 'reservation_id required' });
        return;
      }

      const result = await db.runTransaction(async (txn) => {
        const resRef = db.collection('ember_reservations').doc(reservation_id);
        const resDoc = await txn.get(resRef);
        if (!resDoc.exists) throw new Error('Reservation not found');
        
        const data = resDoc.data()!;
        if (data.agent_id !== agentId) throw new Error('Unauthorized');
        if (data.status !== 'reserved') throw new Error(`Cannot release, status is ${data.status}`);

        const amount = data.amount_reserved || 0;
        
        // Mark released
        txn.update(resRef, { status: 'released', reason: reason || null });

        return {
          released: amount,
          target_action: data.action_type,
        };
      });

      try {
        await appendForgeLogEntry({
          agent_id: agentId,
          action_type: 'ember_release',
          amount: result.released,
          metadata: {
            hall_handle: agentId,
            target_action: result.target_action,
            amount_released: result.released,
            reservation_id,
            reason: reason || null,
          }
        });
      } catch (logErr) {
        console.error('[ForgeLog] budget release ledger write failed after successful transaction', {
          reservation_id,
          agent_id: agentId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      res.status(200).json({
        released: true,
        balance_restored: result.released
      });
      return;
    }

    res.status(404).json({ error: 'not_found', message: 'Endpoint not found' });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', details: err.message });
  }
});
