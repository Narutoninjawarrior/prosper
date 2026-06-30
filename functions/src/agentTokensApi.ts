import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { requireAdmin } from './lib/auth';

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export const issueAgentToken = functions.https.onRequest(async (req, res) => {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const agentId = typeof req.body.agent_id === 'string' ? req.body.agent_id.trim() : '';
  const label = typeof req.body.label === 'string' ? req.body.label.trim() : 'agent-token';
  const scopes = req.body.scopes;

  if (!agentId || agentId.length < 3) {
    res.status(400).json({ error: 'agent_id is required and must be valid' });
    return;
  }
  
  if (!Array.isArray(scopes) || scopes.length === 0) {
    res.status(400).json({ error: 'array of scopes is required and cannot be empty' });
    return;
  }

  const validScopes = new Set(['memory:append', 'task:event']);
  for (const s of scopes) {
    if (!validScopes.has(s)) {
      res.status(400).json({ error: `Unknown scope: ${s}. Only memory:append and task:event are allowed.` });
      return;
    }
  }

  // Generate token
  const secret = crypto.randomBytes(32).toString('hex');
  const token = `hla_${secret}`;
  const tokenHash = sha256Hex(token);

  await admin.firestore().collection('agent_service_tokens').doc(tokenHash).set({
    token_hash: tokenHash,
    agent_id: agentId,
    label,
    scopes,
    created_by: ctx.uid,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    revoked_at: null,
    last_used_at: null
  });

  res.status(200).json({ token, message: "Token issued. Store securely, it will not be shown again." });
});

export const revokeAgentToken = functions.https.onRequest(async (req, res) => {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const tokenHash = req.body.token_hash;
  if (!tokenHash) {
    res.status(400).json({ error: 'token_hash required' });
    return;
  }

  await admin.firestore().collection('agent_service_tokens').doc(tokenHash).update({
    revoked_at: admin.firestore.FieldValue.serverTimestamp()
  });

  res.status(200).json({ status: 'revoked' });
});

export async function resolveAgentServiceToken(authHeader: string): Promise<{ ok: true; agentId: string; scopes: string[] } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer hla_')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const tokenHash = sha256Hex(token);
  const doc = await admin.firestore().collection('agent_service_tokens').doc(tokenHash).get();
  if (doc.exists) {
    const data = doc.data();
    if (data && !data.revoked_at && !data.invalidated_at) {
      if (!data.agent_id) return null;

      const agentProfileSnap = await admin.firestore().collection('agent_profiles').doc(data.agent_id).get();
      if (!agentProfileSnap.exists) {
        doc.ref.update({ invalidated_at: admin.firestore.FieldValue.serverTimestamp(), invalid_reason: 'agent_profile_missing' }).catch(e => console.error(e));
        return null;
      }
      
      const agentProfile = agentProfileSnap.data();
      const status = typeof agentProfile?.status === 'string' ? agentProfile.status.toLowerCase() : '';
      if (['banned', 'disabled', 'revoked', 'inactive'].includes(status)) {
        doc.ref.update({ invalidated_at: admin.firestore.FieldValue.serverTimestamp(), invalid_reason: 'agent_status_invalid' }).catch(e => console.error(e));
        return null;
      }

      doc.ref.update({ last_used_at: admin.firestore.FieldValue.serverTimestamp() }).catch(e => console.error(e));
      return { ok: true, agentId: data.agent_id, scopes: data.scopes || [] };
    }
  }
  return null;
}

export const listAgentTokens = functions.https.onRequest(async (req, res) => {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }

  const snapshot = await admin.firestore().collection('agent_service_tokens').orderBy('created_at', 'desc').limit(100).get();
  const tokens = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      agent_id: data.agent_id,
      label: data.label,
      scopes: data.scopes,
      created_at: data.created_at,
      revoked_at: data.revoked_at,
      invalidated_at: data.invalidated_at,
      invalid_reason: data.invalid_reason,
      last_used_at: data.last_used_at,
      status: data.revoked_at ? 'revoked' : data.invalidated_at ? 'invalidated' : 'active'
    };
  });

  res.status(200).json({ tokens });
});
