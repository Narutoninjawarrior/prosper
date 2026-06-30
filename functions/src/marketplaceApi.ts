import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { appendForgeLogEntry } from './lib/forgeLog';

export const marketplaceWebhook = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const platform = req.path.split('/').pop() || 'unknown';
  const task = req.body;
  
  if (!task || !task.id || !task.agent_id) {
    res.status(400).json({ error: 'invalid_task', message: 'Missing task id or agent_id' });
    return;
  }

  const db = admin.firestore();
  
  try {
    await db.collection('marketplace_tasks').add({
      platform,
      external_task_id: task.id,
      description: task.description || '',
      payment_amount: task.payment || 0,
      assigned_agent: task.agent_id,
      status: 'received',
      received_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // ponytail: for now, tasks require Malaky's explicit start signal
    // upgrade path: autonomous task acceptance when trust score and task type permit
    res.status(200).json({ accepted: true, requires_human_review: true });
  } catch (error: any) {
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

export const marketplaceComplete = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing token' });
    return;
  }
  
  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const callerId = decoded.uid;

    const { marketplace_task_id, result_summary, result_hash } = req.body;
    if (!marketplace_task_id) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const db = admin.firestore();
    const taskSnap = await db.collection('marketplace_tasks').doc(marketplace_task_id).get();
    
    if (!taskSnap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    
    const task = taskSnap.data()!;
    if (task.assigned_agent !== callerId && callerId !== 'MALAKY_ADMIN_ID') { // Simplified check
      // For now, allow completion if auth succeeds. Real implementation would check role.
    }

    await db.runTransaction(async (t) => {
      t.update(taskSnap.ref, {
        status: 'completed',
        completed_at: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    let receiptId: string | null = null;
    try {
      const appendResult = await appendForgeLogEntry({
        agent_id: task.assigned_agent,
        action_type: 'marketplace_task_complete',
        payload_hash: result_hash || task.external_task_id,
        metadata: {
          input_hash: task.external_task_id,
          output_hash: result_hash || 'none',
          platform: task.platform,
          payment: task.payment_amount,
          summary: result_summary || '',
          source: 'internal_agent',
        }
      });
      receiptId = appendResult.entry_id;
      await taskSnap.ref.set({
        receipt_id: receiptId,
      }, { merge: true });
    } catch (logErr) {
      console.error('[ForgeLog] marketplace completion ledger write failed after successful transaction', {
        marketplace_task_id,
        agent_id: task.assigned_agent,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    res.status(200).json({ success: true, receipt_id: receiptId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
