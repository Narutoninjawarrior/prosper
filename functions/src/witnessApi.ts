import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { applyRateLimit, applyBodyLimit } from './lib/edgeGuard';
import { enforceAppCheck } from './lib/appCheckGate';
import { appendForgeLogEntry } from './lib/forgeLog';

export const witnessRecord = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'witness-record', windowMs: 60 * 60 * 1000, max: 1200 })) return;
  if (!applyBodyLimit(req, res, 16 * 1024)) return;

  const appCheckPassed = await enforceAppCheck(req, res, 'witnessRecord');
  if (!appCheckPassed) return;

  const apiKeyHeader = req.headers['x-api-key'] as string;
  const authHeader = req.headers.authorization;
  const rawKey = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1].trim() : null);

  if (!rawKey) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing API key in X-API-Key or Authorization header' });
    return;
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const db = admin.firestore();
  
  try {
    const keySnap = await db.collection('witness_api_keys').where('key', '==', keyHash).get();
    if (keySnap.empty) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid API key' });
      return;
    }

    const keyDoc = keySnap.docs[0];
    const keyData = keyDoc.data();

    if (keyData.tier === 'free') {
      const keyBucket = `witness-free-${keyHash}`;
      const keyLimited = await applyRateLimit(req, res, { bucket: keyBucket, windowMs: 60 * 60 * 1000, max: 10 });
      if (!keyLimited) return;
    }

    // Process request
    const { agent_id, action_type, input_hash, output_hash, metadata } = req.body;
    if (!agent_id || !action_type || !input_hash || !output_hash) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: agent_id, action_type, input_hash, output_hash' });
      return;
    }

    let appendResult;
    try {
      appendResult = await db.runTransaction(async (t) => {
        const freshKeySnap = await t.get(keyDoc.ref);
        if (!freshKeySnap.exists) {
          const err = new Error('API key no longer exists');
          (err as any).statusCode = 401;
          (err as any).errorCode = 'unauthorized';
          throw err;
        }

        const freshKeyData = freshKeySnap.data() as any;
        const currentMonthCount = typeof freshKeyData.current_month_count === 'number'
          ? freshKeyData.current_month_count
          : 0;
        const monthlyLimit = typeof freshKeyData.monthly_limit === 'number'
          ? freshKeyData.monthly_limit
          : 0;

        if (currentMonthCount >= monthlyLimit) {
          const err = new Error(`Monthly limit of ${monthlyLimit} exceeded.`);
          (err as any).statusCode = 429;
          (err as any).errorCode = 'quota_exceeded';
          throw err;
        }
        
        t.update(keyDoc.ref, {
          current_month_count: admin.firestore.FieldValue.increment(1)
        });

        // We can't nest transactions (appendForgeLogEntry does runTransaction).
        // So we just return success, and do appendForgeLogEntry after.
        return true;
      });
    } catch (err: any) {
      throw err; // Quota exceeded or unauthorized
    }

    // Append to forge log using the new helper
    const payloadForHash = JSON.stringify({
      agent_id,
      action_type,
      input_hash,
      output_hash,
    });
    
    appendResult = await appendForgeLogEntry({
      agent_id,
      action_type,
      payload_hash: crypto.createHash('sha256').update(payloadForHash).digest('hex'),
      metadata: {
        input_hash,
        output_hash,
        source: 'external_witness',
        org_name: keyData.org_name,
        ...metadata
      }
    });

    const receipt = {
      receipt_id: appendResult.entry_id,
      chain_hash: appendResult.chain_hash,
      timestamp: new Date().toISOString(), // Approximation
      scitt_envelope: {
        issuer: 'fellowship-of-the-hearth.web.app',
        subject: agent_id,
        payload_hash: appendResult.chain_hash,
        registration_time: new Date().toISOString(),
        transparency_log: 'hearthlands-forge-log-v1',
        receipt_type: 'urn:hearthlands:forge-log-receipt:v1'
      }
    };

    res.status(200).json(receipt);
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
    const errorCode = typeof error?.errorCode === 'string' ? error.errorCode : 'internal_error';
    res.status(statusCode).json({ error: errorCode, details: error.message });
  }
});

export const witnessVerify = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'witness-verify', windowMs: 60 * 60 * 1000, max: 600 })) return;

  const receiptId = req.path.split('/').pop();
  if (!receiptId) {
    res.status(400).json({ error: 'missing_receipt_id' });
    return;
  }

  const db = admin.firestore();
  try {
    const doc = await db.collection('forge_log').doc(receiptId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'not_found', message: 'Receipt not found' });
      return;
    }

    const data = doc.data()!;

    // Check chain intactness by grabbing the next chronological doc.
    const headSnap = await db.doc('forge_log_metadata/head').get();
    const head = headSnap.data();
    
    let chainIntact = false;
    if (head?.latest_hash === data.chain_hash) {
      chainIntact = true;
    } else {
      const nextSnap = await db.collection('forge_log')
        .where('prev_hash', '==', data.chain_hash)
        .limit(1)
        .get();
      chainIntact = !nextSnap.empty;
    }

    res.status(200).json({
      valid: true,
      chain_intact: chainIntact,
      receipt: {
        receipt_id: doc.id,
        agent_id: data.agent_id,
        action_type: data.action_type,
        timestamp: data.timestamp?.toDate().toISOString(),
        chain_hash: data.chain_hash,
        prev_hash: data.prev_hash
      },
      scitt_envelope: {
        issuer: 'fellowship-of-the-hearth.web.app',
        subject: data.agent_id,
        payload_hash: data.chain_hash,
        registration_time: data.timestamp?.toDate().toISOString(),
        transparency_log: 'hearthlands-forge-log-v1',
        receipt_type: 'urn:hearthlands:forge-log-receipt:v1'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});

export const witnessGenerateKey = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'witness-gen-key', windowMs: 60 * 60 * 1000, max: 5 })) return;
  if (!applyBodyLimit(req, res, 4 * 1024)) return;

  const { org_name, email } = req.body;
  if (!org_name || !email) {
    res.status(400).json({ error: 'missing_fields', message: 'org_name and email required' });
    return;
  }

  const rawKey = 'hth_wit_' + crypto.randomBytes(24).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  const db = admin.firestore();
  
  try {
    await db.collection('witness_api_keys').add({
      key: keyHash,
      org_name,
      email,
      tier: 'free',
      monthly_limit: 100,
      current_month_count: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({
      success: true,
      org_name,
      tier: 'free',
      api_key: rawKey,
      note: 'Save this API key. It will not be shown again.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'internal_error', details: error.message });
  }
});
