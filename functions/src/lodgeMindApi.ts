/**
 * lodgeMindApi.ts — public readiness surfaces for /lodge-mind UI.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

async function countCollection(name: string): Promise<number> {
  const snap = await admin.firestore().collection(name).count().get();
  return snap.data().count;
}

export async function fetchLodgeMindStatus() {
  const db = admin.firestore();
  const worldSnap = await db.doc('three_forge/world_state').get();
  const world = worldSnap.exists ? worldSnap.data() : null;
  const nodes = world && Array.isArray(world.nodes) ? world.nodes : [];

  const cloudRunConfigured = Boolean(process.env.LODGE_MIND_SERVICE_URL);
  const modelName = process.env.LODGE_MIND_MODEL || 'gemma-4-e4b';
  const sovereignUid = Boolean(process.env.SOVEREIGN_UID);

  let mode: 'offline' | 'readiness' | 'connected' = 'readiness';
  if (!cloudRunConfigured) mode = 'offline';
  else if (sovereignUid) mode = 'connected';

  return {
    mode,
    provider: 'cloud-run-gemma',
    runtime: {
      cloud_run_configured: cloudRunConfigured,
      model_name: modelName,
      service_url_configured: cloudRunConfigured,
      sovereign_uid_configured: sovereignUid,
    },
    collections: {
      agent_profiles: await countCollection('agent_profiles'),
      lodge_quests: await countCollection('lodge_quests'),
      artifact_registry: await countCollection('artifact_registry'),
      embodiment_ledger: await countCollection('embodiment_ledger'),
    },
    world: {
      forge_nodes: nodes.length,
      has_world_state: worldSnap.exists,
      last_updated: (world && typeof world.heartbeat_at === 'string')
        ? world.heartbeat_at
        : worldSnap.updateTime?.toMillis() ?? null,
    },
    note: 'Readiness snapshot — inference still local-first unless Cloud Run URL is configured.',
  };
}

export async function fetchLodgeMindContextPreview() {
  const db = admin.firestore();
  const [members, quests, artifacts, embodiment, worldSnap, ledgerSnap] = await Promise.all([
    countCollection('agent_profiles'),
    countCollection('lodge_quests'),
    countCollection('artifact_registry'),
    countCollection('embodiment_ledger'),
    db.doc('three_forge/world_state').get(),
    db.collection('embodiment_ledger').orderBy('timestamp', 'desc').limit(5).get(),
  ]);

  const nodes = worldSnap.exists && Array.isArray(worldSnap.data()?.nodes) ? worldSnap.data()!.nodes : [];

  const recentEvents = ledgerSnap.docs.map((doc) => doc.data());
  const questSnap = await db.collection('lodge_quests').limit(5).get();
  const activeQuests = questSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return {
    generated_at: new Date().toISOString(),
    summary: {
      members,
      quests,
      artifacts,
      embodiment_events: embodiment,
      forge_nodes: nodes.length,
    },
    recent_events: recentEvents,
    active_quests: activeQuests,
    proposed_actions: [
      'Sync manifest-verified seeds to Firestore',
      'Poll /api/creativity/suggest for bot discovery loops',
      'Witness experiments via /api/experiment/log',
    ],
    policy: 'Context preview only — no LLM inference on this endpoint.',
  };
}

export const lodgeMindStatus = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.status(200).json(await fetchLodgeMindStatus());
  } catch (err) {
    console.error('[lodgeMindStatus]', err);
    res.status(500).json({ error: 'Status failed' });
  }
});

export const lodgeMindContextPreview = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  try {
    res.set('Cache-Control', 'no-store');
    res.status(200).json(await fetchLodgeMindContextPreview());
  } catch (err) {
    console.error('[lodgeMindContextPreview]', err);
    res.status(500).json({ error: 'Context preview failed' });
  }
});
