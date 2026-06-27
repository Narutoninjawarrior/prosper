import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

const db = admin.firestore();
const HOSTING_BASE = process.env.AGENT_API_SEED_BASE || 'https://fellowship-of-the-hearth.web.app';
const MOLTBOOK_VERIFY_URL = (process.env.MOLTBOOK_VERIFY_URL || 'https://www.moltbook.com/api/v1/agents/verify-identity').trim();
const MOLTBOOK_APP_KEY = (process.env.MOLTBOOK_APP_KEY || '').trim();
const MOLTBOOK_ENABLED = Boolean(MOLTBOOK_APP_KEY);

type VerifiedMoltbookAgent = {
  id: string;
  name: string;
  description?: string;
  karma?: number;
  avatar_url?: string;
  is_claimed?: boolean;
  created_at?: string;
  follower_count?: number;
  stats?: {
    posts?: number;
    comments?: number;
  };
  owner?: {
    x_handle?: string;
    x_name?: string;
    x_verified?: boolean;
    x_follower_count?: number;
  };
};

type PassportMemoryEvent = {
  id: string;
  event_type: string;
  summary: string;
  source: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type PassportTimelineEntry = {
  id: string;
  kind: 'identity' | 'inspect' | 'task' | 'receipt';
  label: string;
  source: string;
  timestamp?: string;
  status?: string;
  ref?: string;
  receipt_hash?: string;
};

type PassportReceiptRow = {
  kind: string;
  label: string;
  receipt_hash?: string;
  apparatus_id?: string;
  timestamp?: string;
  source: string;
};

type PassportTaskRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  timestamp?: string;
  source: string;
  task_id?: string;
  receipt_hash?: string;
  ref?: string;
};

function applyCors(res: functions.Response, methods = 'GET, POST, OPTIONS'): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Moltbook-Identity');
}

function readHeader(req: functions.Request, name: string): string {
  const value = req.headers[name.toLowerCase()];
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && value[0]) return value[0].trim();
  return '';
}

function requestRoutePath(req: functions.Request): string {
  return [req.path, req.originalUrl, req.url]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ');
}

function routeMatches(path: string, route: string): boolean {
  return path.includes(route);
}

function readTimestampish(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      try {
        const date = (value as { toDate: () => Date }).toDate();
        return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
      } catch {
        return undefined;
      }
    }
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function cleanMetadata(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, entry]) => {
    return ['string', 'number', 'boolean'].includes(typeof entry) || entry === null;
  });
  return entries.length > 0 ? Object.fromEntries(entries.slice(0, 16)) : undefined;
}

function inferTaskStatus(eventType: string, metadata?: Record<string, unknown>): string {
  if (typeof metadata?.status === 'string' && metadata.status.trim()) {
    return metadata.status.trim();
  }
  const normalized = eventType.replace(/^task_/, '');
  if (!normalized || normalized === eventType) return 'witnessed';
  return normalized;
}

function normalizeMoltbookAgent(value: unknown): VerifiedMoltbookAgent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const statsValue = typeof raw.stats === 'object' && raw.stats !== null && !Array.isArray(raw.stats)
    ? raw.stats as Record<string, unknown>
    : {};
  const ownerValue = typeof raw.owner === 'object' && raw.owner !== null && !Array.isArray(raw.owner)
    ? raw.owner as Record<string, unknown>
    : {};
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string'
    ? raw.name.trim()
    : typeof raw.handle === 'string'
      ? raw.handle.trim()
      : typeof raw.username === 'string'
        ? raw.username.trim()
        : '';
  if (!id || !name) return null;

  return {
    id,
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    karma: readFiniteNumber(raw.karma),
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : undefined,
    is_claimed: typeof raw.is_claimed === 'boolean' ? raw.is_claimed : undefined,
    created_at: readTimestampish(raw.created_at),
    follower_count: readFiniteNumber(raw.follower_count),
    stats: {
      posts: readFiniteNumber(statsValue.posts),
      comments: readFiniteNumber(statsValue.comments),
    },
    owner: {
      x_handle: typeof ownerValue.x_handle === 'string' ? ownerValue.x_handle : undefined,
      x_name: typeof ownerValue.x_name === 'string' ? ownerValue.x_name : undefined,
      x_verified: typeof ownerValue.x_verified === 'boolean' ? ownerValue.x_verified : undefined,
      x_follower_count: readFiniteNumber(ownerValue.x_follower_count),
    },
  };
}

async function tryVerifyFirebaseUser(req: functions.Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = readHeader(req, 'authorization');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function resolveOwnedAgent(uid: string, requestedAgentId?: string) {
  if (requestedAgentId) {
    const direct = await db.collection('agent_profiles').doc(requestedAgentId).get();
    if (direct.exists && direct.data()?.firebase_uid === uid) {
      return direct;
    }
  }

  const linked = await db.collection('agent_profiles').where('firebase_uid', '==', uid).limit(1).get();
  return linked.empty ? null : linked.docs[0];
}

async function resolveLinkedMoltbookAgentId(token: string): Promise<
  | { ok: true; agentId: string }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const verified = await verifyMoltbookIdentityToken(token);
  if (!verified.ok) return verified;

  const linkSnap = await db.collection('agent_external_identities').doc(`moltbook_beta_${verified.agent.id}`).get();
  if (!linkSnap.exists) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Verified Moltbook identity is not linked to a Hearthlands agent yet.',
      },
    };
  }

  const agentId = typeof linkSnap.data()?.linked_agent_id === 'string' ? linkSnap.data()!.linked_agent_id : '';
  if (!agentId) {
    return {
      ok: false,
      status: 500,
      body: {
        error: 'Linked Hearthlands agent_id missing on external identity record.',
      },
    };
  }

  return { ok: true, agentId };
}

async function resolveWriteIdentity(req: functions.Request, requestedAgentId?: string): Promise<
  | { ok: true; agentId: string; source: string }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
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

  const token = readHeader(req, 'x-moltbook-identity');
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Provide Authorization or X-Moltbook-Identity.' },
    };
  }

  const linked = await resolveLinkedMoltbookAgentId(token);
  if (!linked.ok) return linked;
  return { ok: true, agentId: linked.agentId, source: 'moltbook_beta' };
}

async function verifyMoltbookIdentityToken(token: string): Promise<{ ok: true; agent: VerifiedMoltbookAgent } | { ok: false; status: number; body: Record<string, unknown> }> {
  if (!MOLTBOOK_ENABLED) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'moltbook_beta_unavailable',
        detail: 'MOLTBOOK_APP_KEY is not configured on the server.',
        state: 'prototype',
      },
    };
  }

  try {
    const upstream = await fetch(MOLTBOOK_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Moltbook-App-Key': MOLTBOOK_APP_KEY,
      },
      body: JSON.stringify({ token }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        body: {
          error: 'moltbook_verify_failed',
          detail: typeof (data as Record<string, unknown>).error === 'string' ? (data as Record<string, unknown>).error : `Upstream returned ${upstream.status}`,
          state: 'prototype',
        },
      };
    }

    const record = data as Record<string, unknown>;
    if (record.valid !== true) {
      return {
        ok: false,
        status: 401,
        body: {
          error: 'invalid_moltbook_identity',
          state: 'prototype',
        },
      };
    }

    const agent = normalizeMoltbookAgent(record.agent);
    if (!agent) {
      return {
        ok: false,
        status: 502,
        body: {
          error: 'moltbook_profile_unparseable',
          state: 'prototype',
        },
      };
    }

    return { ok: true, agent };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      body: {
        error: 'moltbook_upstream_unreachable',
        detail: err instanceof Error ? err.message : String(err),
        state: 'prototype',
      },
    };
  }
}

async function appendMemoryEvent(
  agentId: string,
  source: string,
  eventType: string,
  summary: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const ref = db.collection('agent_memory').doc();
  await ref.set({
    agent_id: agentId,
    source,
    event_type: eventType,
    summary,
    metadata: metadata || null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function fetchAgentMemoryDocs(agentId: string, limit = 16): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  try {
    const ordered = await db.collection('agent_memory')
      .where('agent_id', '==', agentId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    return ordered.docs;
  } catch (err) {
    console.error('[agentPassport] ordered agent_memory query failed; falling back to client sort', err);
    const fallback = await db.collection('agent_memory')
      .where('agent_id', '==', agentId)
      .limit(limit * 2)
      .get();
    return fallback.docs
      .sort((a, b) => {
        const aTs = Date.parse(readTimestampish(a.data().created_at) || '') || 0;
        const bTs = Date.parse(readTimestampish(b.data().created_at) || '') || 0;
        return bTs - aTs;
      })
      .slice(0, limit);
  }
}

async function fetchSwarmTaskSeed(): Promise<Array<Record<string, unknown>>> {
  try {
    const response = await fetch(`${HOSTING_BASE}/swarm_tasks.json`, { headers: { accept: 'application/json' } });
    if (!response.ok) return [];
    const json = await response.json() as { tasks?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    if (Array.isArray(json)) return json;
    return Array.isArray(json.tasks) ? json.tasks : [];
  } catch {
    return [];
  }
}


// ponytail: compute at read time — no new writes
async function computeTrustScore(agentId: string) {
  const snap = await db.collection('forge_log')
    .where('agent_id', '==', agentId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    return { trust_score: 0.1, trust_tier: 'probationary', last_action_at: null, days_since_last_action: null };
  }

  const lastAction = snap.docs[0].data();
  const lastTimestamp = lastAction.timestamp?.toDate() ?? new Date(0);
  const daysSinceLastAction = (Date.now() - lastTimestamp.getTime()) / (1000 * 60 * 60 * 24);

  const lambda = 0.005; // half-life ~139 days — matches SkillFortify research
  const rawScore = Math.exp(-lambda * daysSinceLastAction);
  const trust_score = Math.max(0.1, Math.min(1.0, rawScore));

  let trust_tier = 'probationary';
  if (trust_score >= 0.85) trust_tier = 'active';
  else if (trust_score >= 0.65) trust_tier = 'trusted';
  else if (trust_score >= 0.40) trust_tier = 'fading';
  else if (trust_score >= 0.15) trust_tier = 'dormant';

  return { 
    trust_score: Number(trust_score.toFixed(4)), 
    trust_tier, 
    last_action_at: lastTimestamp.toISOString(), 
    days_since_last_action: Number(daysSinceLastAction.toFixed(2)) 
  };
}

async function buildAgentPassport(agentId: string) {
  const profileSnap = await db.collection('agent_profiles').doc(agentId).get();
  if (!profileSnap.exists) return null;

  const profile = profileSnap.data() as Record<string, unknown>;
  const [memoryDocs, experimentSnap, embodimentSnap, claimSnap, externalSnap, swarmTasks, trustInfo] = await Promise.all([
    fetchAgentMemoryDocs(agentId, 16),
    db.collection('experiment_log').where('agent_id', '==', agentId).orderBy('logged_at', 'desc').limit(8).get().catch(() => null),
    db.collection('embodiment_ledger').where('agent_id', '==', agentId).orderBy('timestamp', 'desc').limit(8).get().catch(() => null),
    db.collection('bounty_claims').where('agent_id', '==', agentId).orderBy('timestamp', 'desc').limit(6).get().catch(() => null),
    db.collection('agent_external_identities').where('linked_agent_id', '==', agentId).limit(4).get().catch(() => null),
    fetchSwarmTaskSeed(),
    computeTrustScore(agentId),
  ]);

  const memoryEvents: PassportMemoryEvent[] = memoryDocs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      event_type: typeof data.event_type === 'string' ? data.event_type : 'memory_event',
      summary: typeof data.summary === 'string' ? data.summary : 'Memory event',
      source: typeof data.source === 'string' ? data.source : 'hearthlands',
      created_at: readTimestampish(data.created_at),
      metadata: cleanMetadata(data.metadata),
    };
  });

  const recentReceipts: PassportReceiptRow[] = [
    ...(experimentSnap ? experimentSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        kind: typeof data.kind === 'string' ? data.kind : 'experiment',
        label: typeof data.experiment_id === 'string' ? data.experiment_id : doc.id,
        receipt_hash: typeof data.receipt_hash === 'string' ? data.receipt_hash : undefined,
        apparatus_id: typeof data.apparatus_id === 'string' ? data.apparatus_id : undefined,
        timestamp: readTimestampish(data.logged_at),
        source: 'experiment_log',
      };
    }) : []),
    ...(embodimentSnap ? embodimentSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        kind: typeof data.action === 'string' ? data.action : 'embodiment_event',
        label: typeof data.bounty_id === 'string' ? data.bounty_id : doc.id,
        receipt_hash: typeof data.chain_hash === 'string' ? data.chain_hash : undefined,
        timestamp: readTimestampish(data.timestamp),
        source: 'embodiment_ledger',
      };
    }) : []),
  ]
    .sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
    .slice(0, 12);

  const recentTasks: PassportTaskRow[] = [
    ...(claimSnap ? claimSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'bounty_claim',
        title: typeof data.quest_id === 'string' ? data.quest_id : doc.id,
        status: typeof data.status === 'string' ? data.status : 'pending',
        timestamp: readTimestampish(data.timestamp),
        source: 'bounty_claims',
      };
    }) : []),
    ...memoryEvents
      .filter((event) => event.event_type.startsWith('task_'))
      .map((event) => ({
        id: event.id,
        type: event.event_type,
        title: event.summary,
        status: inferTaskStatus(event.event_type, event.metadata),
        timestamp: event.created_at,
        source: event.source,
        task_id: typeof event.metadata?.task_id === 'string' ? event.metadata.task_id : undefined,
        receipt_hash: typeof event.metadata?.receipt_hash === 'string' ? event.metadata.receipt_hash : undefined,
        ref: typeof event.metadata?.ref === 'string' ? event.metadata.ref : undefined,
      })),
  ]
    .sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
    .slice(0, 10);

  const recentInspects = memoryEvents
    .filter((event) => event.event_type.startsWith('inspect_'))
    .slice(0, 8);

  const latestInspect = recentInspects[0];
  const linkedMoltbook = externalSnap
    ? externalSnap.docs
        .map((doc) => doc.data())
        .find((row) => row.provider === 'moltbook_beta')
    : null;

  const externalIdentity = linkedMoltbook
    ? {
        provider: 'moltbook_beta',
        linked: true,
        linked_at: readTimestampish(linkedMoltbook.linked_at),
        last_verified_at: readTimestampish(linkedMoltbook.last_verified_at),
        profile: cleanMetadata(linkedMoltbook.profile_snapshot),
      }
    : {
        provider: 'moltbook_beta',
      linked: false,
      state: MOLTBOOK_ENABLED ? 'available' : 'disabled',
      };

  const actionTimeline: PassportTimelineEntry[] = [
    ...memoryEvents
      .filter((event) => event.event_type.startsWith('inspect_'))
      .map((event) => ({
        id: event.id,
        kind: 'inspect' as const,
        label: event.summary,
        source: event.source,
        timestamp: event.created_at,
        ref: typeof event.metadata?.ref === 'string' ? event.metadata.ref : undefined,
      })),
    ...recentTasks.map((task) => ({
      id: `task-${task.id}`,
      kind: 'task' as const,
      label: task.title,
      source: task.source,
      timestamp: task.timestamp,
      status: task.status,
      ref: typeof task.ref === 'string' ? task.ref : typeof task.task_id === 'string' ? task.task_id : undefined,
      receipt_hash: typeof task.receipt_hash === 'string' ? task.receipt_hash : undefined,
    })),
    ...recentReceipts.map((row, index) => ({
      id: `receipt-${row.source}-${row.label}-${index}`,
      kind: 'receipt' as const,
      label: row.label,
      source: row.source,
      timestamp: row.timestamp,
      receipt_hash: row.receipt_hash,
      ref: row.apparatus_id,
    })),
    ...(externalIdentity.linked && externalIdentity.last_verified_at
      ? [{
          id: 'identity-last-verified',
          kind: 'identity' as const,
          label: 'Moltbook beta identity verified',
          source: 'moltbook_beta',
          timestamp: externalIdentity.last_verified_at,
          status: 'verified',
          ref: typeof externalIdentity.profile?.id === 'string' ? externalIdentity.profile.id : undefined,
        }]
      : []),
  ]
    .sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
    .slice(0, 16);

  const candidateTasks = swarmTasks
    .filter((task) => typeof task === 'object' && task !== null)
    .filter((task) => {
      const role = typeof profile.metadata === 'object' && profile.metadata !== null
        ? (profile.metadata as Record<string, unknown>).role
        : undefined;
      return typeof role === 'string' && task.role_required === role;
    })
    .slice(0, 3);

  return {
    passport: 'agent-passport-v1',
    generated_at: new Date().toISOString(),
    agent: {
      id: agentId,
      name: typeof profile.agent_name === 'string' ? profile.agent_name : agentId,
      status: typeof profile.status === 'string' ? profile.status : 'active',
      public_key: typeof profile.public_key === 'string' ? profile.public_key : undefined,
      moltbook_handle: typeof profile.moltbook_handle === 'string' ? profile.moltbook_handle : undefined,
      ember_balance: readFiniteNumber(profile.ember_balance),
      created_at: readTimestampish(profile.created_at),
      last_active: readTimestampish(profile.last_active),
      has_firebase_owner: typeof profile.firebase_uid === 'string' && profile.firebase_uid.length > 0,
      trust_score: (trustInfo as any).trust_score,
      trust_tier: (trustInfo as any).trust_tier,
      last_action_at: (trustInfo as any).last_action_at,
      days_since_last_action: (trustInfo as any).days_since_last_action,
    },
    identity: externalIdentity,
    continuity: {
      last_apparatus_inspected: latestInspect?.metadata?.ref ?? null,
      last_task_transition: recentTasks[0] ?? null,
      last_receipt: recentReceipts[0] ?? null,
      last_identity_verification: externalIdentity.linked ? externalIdentity.last_verified_at ?? null : null,
      recent_receipts: recentReceipts,
      recent_tasks: recentTasks,
      recent_inspects: recentInspects,
      memory_events: memoryEvents,
      action_timeline: actionTimeline,
      candidate_tasks: candidateTasks,
      export_url: `/api/agent/passport?id=${encodeURIComponent(agentId)}&format=export`,
    },
    policy: {
      passport_surface: 'read-only',
      memory_append: 'server-written append-only',
      external_identity: 'beta imported identity; not canonical sovereign identity',
    },
    docs: {
      agent_route: `/agent/${encodeURIComponent(agentId)}`,
      auth_instructions: `https://moltbook.com/auth.md?app=Hearthlands&endpoint=${encodeURIComponent('https://fellowship-of-the-hearth.web.app/api/agent/passport/claim-moltbook')}`,
    },
  };
}

export const agentPassportApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const path = requestRoutePath(req);

  if (routeMatches(path, '/api/agent/passport/claim-moltbook')) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    if (!applyRateLimit(req, res, { bucket: 'agent-passport-claim-moltbook', windowMs: 60_000, max: 10 })) return;
    if (!applyBodyLimit(req, res, 8 * 1024)) return;

    const token = readHeader(req, 'x-moltbook-identity');
    if (!token) {
      res.status(400).json({ error: 'Missing X-Moltbook-Identity header.' });
      return;
    }

    const verified = await verifyMoltbookIdentityToken(token);
    if (!verified.ok) {
      res.status(verified.status).json(verified.body);
      return;
    }

    const auth = await tryVerifyFirebaseUser(req);
    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
    const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id : undefined;

    if (!auth) {
      const existing = await db.collection('agent_external_identities').doc(`moltbook_beta_${verified.agent.id}`).get();
      res.status(200).json({
        provider: 'moltbook_beta',
        linked: existing.exists,
        linked_agent_id: existing.exists ? existing.data()?.linked_agent_id ?? null : null,
        verified_agent: verified.agent,
        note: existing.exists
          ? 'Verified Moltbook identity resolved to an existing Hearthlands agent link.'
          : 'Verified Moltbook identity is not linked yet. Linking requires Firebase-authenticated ownership of a Hearthlands agent profile.',
      });
      return;
    }

    const ownedAgent = await resolveOwnedAgent(auth.uid, requestedAgentId);
    if (!ownedAgent) {
      res.status(403).json({
        error: 'No Hearthlands agent profile is owned by this authenticated user.',
      });
      return;
    }

    const linkRef = db.collection('agent_external_identities').doc(`moltbook_beta_${verified.agent.id}`);
    const profileSnapshot = {
      id: verified.agent.id,
      name: verified.agent.name,
      description: verified.agent.description || null,
      karma: verified.agent.karma ?? null,
      avatar_url: verified.agent.avatar_url || null,
      is_claimed: verified.agent.is_claimed ?? null,
      created_at: verified.agent.created_at || null,
      follower_count: verified.agent.follower_count ?? null,
      stats_posts: verified.agent.stats?.posts ?? null,
      stats_comments: verified.agent.stats?.comments ?? null,
      owner_x_handle: verified.agent.owner?.x_handle || null,
      owner_x_verified: verified.agent.owner?.x_verified ?? null,
    };

    await Promise.all([
      linkRef.set({
        provider: 'moltbook_beta',
        external_agent_id: verified.agent.id,
        external_handle: verified.agent.name,
        linked_agent_id: ownedAgent.id,
        linked_by_uid: auth.uid,
        linked_at: admin.firestore.FieldValue.serverTimestamp(),
        last_verified_at: admin.firestore.FieldValue.serverTimestamp(),
        profile_snapshot: profileSnapshot,
      }, { merge: true }),
      ownedAgent.ref.set({
        external_identities: {
          moltbook_beta: {
            external_agent_id: verified.agent.id,
            external_handle: verified.agent.name,
            linked_by_uid: auth.uid,
            linked_state: 'verified_beta_import',
            last_verified_at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
      }, { merge: true }),
      appendMemoryEvent(
        ownedAgent.id,
        'moltbook_beta',
        'identity_linked',
        `Linked Moltbook beta identity ${verified.agent.name}`,
        { external_agent_id: verified.agent.id, karma: verified.agent.karma ?? null },
      ),
    ]);

    res.status(200).json({
      provider: 'moltbook_beta',
      linked: true,
      linked_agent_id: ownedAgent.id,
      verified_agent: verified.agent,
      note: 'Beta imported identity linked. This is an external reputation signal, not canonical sovereign identity.',
    });
    return;
  }

  if (routeMatches(path, '/api/agent/memory/append')) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    if (!applyRateLimit(req, res, { bucket: 'agent-memory-append', windowMs: 60_000, max: 18 })) return;
    if (!applyBodyLimit(req, res, 8 * 1024)) return;

    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
    const eventType = typeof body.event_type === 'string' ? body.event_type.trim().slice(0, 64) : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
    const metadata = cleanMetadata(body.metadata);
    if (!eventType || !summary) {
      res.status(400).json({ error: 'event_type and summary are required.' });
      return;
    }

    const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id : '';
    const identity = await resolveWriteIdentity(req, requestedAgentId);
    if (!identity.ok) {
      res.status(identity.status).json(identity.body);
      return;
    }

    const eventId = await appendMemoryEvent(identity.agentId, identity.source, eventType, summary, metadata);
    res.status(201).json({
      success: true,
      event_id: eventId,
      agent_id: identity.agentId,
      note: 'Append-only continuity event written server-side.',
    });
    return;
  }

  if (routeMatches(path, '/api/agent/task/event')) {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    if (!applyRateLimit(req, res, { bucket: 'agent-task-event', windowMs: 60_000, max: 24 })) return;
    if (!applyBodyLimit(req, res, 12 * 1024)) return;

    const body = (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body))
      ? req.body as Record<string, unknown>
      : {};
    const requestedAgentId = typeof body.agent_id === 'string' ? body.agent_id.trim() : '';
    const taskId = typeof body.task_id === 'string' ? body.task_id.trim().slice(0, 96) : '';
    const status = typeof body.status === 'string' ? body.status.trim().slice(0, 32) : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 240) : '';
    const receiptHash = typeof body.receipt_hash === 'string' ? body.receipt_hash.trim().slice(0, 128) : '';
    const metadata = cleanMetadata(body.metadata) || {};
    const allowedStatuses = new Set(['open', 'claimed', 'in_progress', 'witnessed', 'archived']);

    if (!taskId || !status) {
      res.status(400).json({ error: 'task_id and status are required.' });
      return;
    }
    if (!allowedStatuses.has(status)) {
      res.status(400).json({ error: `Unsupported task status "${status}".` });
      return;
    }

    const identity = await resolveWriteIdentity(req, requestedAgentId);
    if (!identity.ok) {
      res.status(identity.status).json(identity.body);
      return;
    }

    const normalizedMetadata: Record<string, unknown> = {
      ...metadata,
      task_id: taskId,
      status,
      ...(receiptHash ? { receipt_hash: receiptHash } : {}),
    };
    const eventType = `task_${status}`;
    const eventSummary = summary || `Task ${taskId} moved to ${status}.`;
    const eventId = await appendMemoryEvent(identity.agentId, identity.source, eventType, eventSummary, normalizedMetadata);

    res.status(201).json({
      success: true,
      event_id: eventId,
      agent_id: identity.agentId,
      task_id: taskId,
      status,
      note: 'Durable task transition written to the append-only continuity log.',
    });
    return;
  }

  if (!routeMatches(path, '/api/agent/passport')) {
    res.status(404).json({ error: 'Unknown agent passport route.' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'agent-passport-get', windowMs: 60_000, max: 60 })) return;

  const agentId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!agentId) {
    res.status(400).json({ error: 'Query param "id" is required.' });
    return;
  }

  const bundle = await buildAgentPassport(agentId);
  if (!bundle) {
    res.status(404).json({ error: `No agent passport found for id "${agentId}".` });
    return;
  }

  res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
  if (req.query.format === 'export') {
    res.set('Content-Disposition', `inline; filename="agent-passport-${agentId}.json"`);
  }
  res.status(200).json(bundle);
});
