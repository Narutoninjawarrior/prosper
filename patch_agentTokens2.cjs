const fs = require('fs');
const path = require('path');
const agentTokensApiFile = path.join(__dirname, 'functions', 'src', 'agentTokensApi.ts');
let code = fs.readFileSync(agentTokensApiFile, 'utf8');

const oldResolve = /export async function resolveAgentServiceToken[\s\S]*?return null;\r?\n\}/;

const newResolve = `export async function resolveAgentServiceToken(authHeader: string): Promise<{ ok: true; agentId: string; scopes: string[] } | null> {
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
});`;

code = code.replace(oldResolve, newResolve);
fs.writeFileSync(agentTokensApiFile, code);
console.log('Fixed agentTokensApi.ts with agent profile checks and list route.');
