const fs = require('fs');
const path = require('path');
const agentPassportApiFile = path.join(__dirname, 'functions', 'src', 'agentPassportApi.ts');
let code = fs.readFileSync(agentPassportApiFile, 'utf8');

// 1. Add import for resolveAgentServiceToken
if (!code.includes('resolveAgentServiceToken')) {
  code = code.replace(/import \* as admin from 'firebase-admin';/, "import * as admin from 'firebase-admin';\nimport { resolveAgentServiceToken } from './agentTokensApi';");
}

// 2. Update resolveWriteIdentity
const oldResolveWriteIdentity = /async function resolveWriteIdentity\(req: functions\.Request, requestedAgentId\?: string\): Promise<\r?\n  \| \{ ok: true; agentId: string; source: string \}\r?\n  \| \{ ok: false; status: number; body: Record<string, unknown> \}\r?\n> \{([\s\S]*?)return \{ ok: true, agentId: linked\.agentId, source: 'moltbook_beta' \};\r?\n\}/;

const newResolveWriteIdentity = `async function resolveWriteIdentity(req: functions.Request, requestedAgentId?: string): Promise<
  | { ok: true; agentId: string; source: string; scopes?: string[] }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const authHeader = readHeader(req, 'authorization');

  // 1. Firebase human auth
  if (authHeader && !authHeader.startsWith('Bearer hla_')) {
    const auth = await tryVerifyFirebaseUser(req);
    if (auth) {
      const ownedAgent = await resolveOwnedAgent(auth.uid, requestedAgentId || undefined);
      if (!ownedAgent) {
        return {
          ok: false,
          status: 403,
          body: { error: 'Authenticated user does not own a matching Hearthlands agent profile.' },
        };
      }
      return { ok: true, agentId: ownedAgent.id, source: 'hearthlands_auth' };
    }
  }

  // 2. Moltbook Identity
  const token = readHeader(req, 'x-moltbook-identity');
  if (token) {
    const linked = await resolveLinkedMoltbookAgentId(token);
    if (!linked.ok) return linked;
    return { ok: true, agentId: linked.agentId, source: 'moltbook_beta' };
  }

  // 3. Agent Service Token
  if (authHeader && authHeader.startsWith('Bearer hla_')) {
    const serviceToken = await resolveAgentServiceToken(authHeader);
    if (serviceToken) {
      return { ok: true, agentId: serviceToken.agentId, source: 'agent_service_token', scopes: serviceToken.scopes };
    } else {
      return { ok: false, status: 401, body: { error: 'Invalid or revoked agent service token.' } };
    }
  }

  return {
    ok: false,
    status: 401,
    body: { error: 'Provide Authorization or X-Moltbook-Identity.' },
  };
}`;

code = code.replace(oldResolveWriteIdentity, newResolveWriteIdentity);

// 3. Update memory/append
const oldMemoryAppend = /const identity = await resolveWriteIdentity\(req, requestedAgentId\);\r?\n    if \(!identity\.ok\) \{\r?\n      res\.status\(identity\.status\)\.json\(identity\.body\);\r?\n      return;\r?\n    \}/;
const newMemoryAppend = `const identity = await resolveWriteIdentity(req, requestedAgentId);
    if (!identity.ok) {
      res.status(identity.status).json(identity.body);
      return;
    }
    if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('memory:append'))) {
      res.status(403).json({ error: 'forbidden: requires memory:append scope' });
      return;
    }`;
code = code.replace(oldMemoryAppend, newMemoryAppend);

// 4. Update task/event
const oldTaskEvent = /const identity = await resolveWriteIdentity\(req, requestedAgentId\);\r?\n      if \(!identity\.ok\) \{\r?\n        res\.status\(identity\.status\)\.json\(identity\.body\);\r?\n        return;\r?\n      \}/;
const newTaskEvent = `const identity = await resolveWriteIdentity(req, requestedAgentId);
      if (!identity.ok) {
        res.status(identity.status).json(identity.body);
        return;
      }
      if (identity.source === 'agent_service_token' && (!identity.scopes || !identity.scopes.includes('task:event'))) {
        res.status(403).json({ error: 'forbidden: requires task:event scope' });
        return;
      }`;
code = code.replace(oldTaskEvent, newTaskEvent);

fs.writeFileSync(agentPassportApiFile, code);
console.log('Fixed agentPassportApi.ts');
