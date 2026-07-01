import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';
import { requireHybridAuth } from './lib/auth';
import {
  buildLogReceipt,
  buildLogSignPayload,
  validateExperimentLogInput,
} from './experimentLog';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export async function fetchLoggedExperimentIds(limit = 500): Promise<Set<string>> {
  const db = admin.firestore();
  const snap = await db.collection('experiment_log')
    .orderBy('logged_at', 'desc')
    .limit(limit)
    .get();
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    const experimentId = doc.data().experiment_id;
    if (typeof experimentId === 'string') ids.add(experimentId);
  }
  return ids;
}

export async function fetchExperimentLogList(limit = 50) {
  const db = admin.firestore();
  const snap = await db.collection('experiment_log')
    .orderBy('logged_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({
    experiment_id: doc.data().experiment_id,
    receipt_hash: doc.data().receipt_hash,
    kind: doc.data().kind,
    apparatus_id: doc.data().apparatus_id,
    agent_id: doc.data().agent_id,
    logged_at: doc.data().logged_at,
  }));
}

export const experimentLogApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const path = `${req.path || ''} ${req.originalUrl || ''}`;

  if (req.method === 'GET' && path.includes('/api/experiment/log')) {
    if (!applyRateLimit(req, res, { bucket: 'experiment-log-get', windowMs: 60_000, max: 45 })) return;
    try {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
      const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 50;
      const records = await fetchExperimentLogList(safeLimit);
      res.set('Cache-Control', 'public, max-age=10');
      res.status(200).json({
        policy: 'read-only',
        count: records.length,
        records,
        note: 'Global discovery log. experiment_id exclusions apply to creativity/suggest.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
    return;
  }

  if (req.method !== 'POST' || !path.includes('/api/experiment/log')) {
    res.status(405).json({ error: 'Method not allowed. Use GET or POST on /api/experiment/log' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'experiment-log-post', windowMs: 60_000, max: 20 })) return;
  if (!applyBodyLimit(req, res, 16 * 1024)) return;

  const { applyGlobalFreeze } = await import('./lib/edgeGuard');
  if (!(await applyGlobalFreeze(req, res))) return;

  const authContext = await requireHybridAuth(req, res);
  if (!authContext) return;

  if (authContext.type === 'agent') {
    const bodyAgentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id.trim() : '';
    if (!bodyAgentId || bodyAgentId !== authContext.agentId) {
      res.status(403).json({ error: 'forbidden: agent token does not match body agent_id' });
      return;
    }
  }

  try {
    const result = await submitExperimentLog(req.body);
    if (!result.ok) {
      res.status(result.status).json(result.body);
      return;
    }
    res.status(201).json(result.receipt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

type LogFailure = { ok: false; status: number; body: Record<string, unknown> };
type LogSuccess = { ok: true; receipt: ReturnType<typeof buildLogReceipt> };

export async function submitExperimentLog(body: unknown): Promise<LogFailure | LogSuccess> {
  const parsed = validateExperimentLogInput(body);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { error: parsed.error } };
  }
  const input = parsed.value;
  const signPayload = buildLogSignPayload(input);
  const message = Buffer.from(signPayload);
  const publicKey = bs58.decode(input.public_key);
  const signature = bs58.decode(input.signature);
  const isValid = nacl.sign.detached.verify(
    new Uint8Array(message),
    new Uint8Array(signature),
    new Uint8Array(publicKey),
  );
  if (!isValid) {
    return { ok: false, status: 401, body: { error: 'Invalid signature' } };
  }

  const db = admin.firestore();
  const agentSnap = await db.collection('agent_profiles').doc(input.agent_id).get();
  if (!agentSnap.exists) {
    return { ok: false, status: 403, body: { error: 'Agent profile not found. Register via welcome flow first.' } };
  }

  const experimentRef = db.collection('experiment_log').doc(input.experiment_id);
  const existing = await experimentRef.get();
  if (existing.exists) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'experiment_id already logged globally',
        experiment_id: input.experiment_id,
        prior_receipt_hash: existing.data()?.receipt_hash,
      },
    };
  }

  const receipt = buildLogReceipt(input);
  await experimentRef.set({
    receipt_hash: input.receipt_hash,
    experiment_id: input.experiment_id,
    kind: input.kind,
    apparatus_id: input.apparatus_id,
    agent_id: input.agent_id,
    public_key: input.public_key,
    log_hash: receipt.log_hash,
    signature: input.signature,
    logged_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, receipt };
}
