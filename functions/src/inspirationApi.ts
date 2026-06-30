import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { applyRateLimit } from './lib/edgeGuard';
import * as fs from 'fs';
import * as path from 'path';

// Helper to fetch world object from the existing API locally to avoid HTTP overhead
// Since worldApi is an HTTPS function, we can just call the internal logic if we modularized it.
// For simplicity, we can fetch via the live URL or fetch the data directly if it's cached.
// But to keep it simple and independent, we'll fetch via the deployed web app URL or localhost in dev.

async function fetchWorldObject(id: string) {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  // Use production URL for world objects to avoid self-referential dev complexites unless running tests
  const baseUrl = isEmulator ? 'http://127.0.0.1:5001/fellowship-of-the-hearth/us-central1/worldObject' : 'https://fellowship-of-the-hearth.web.app/api/world';
  const res = await fetch(`${baseUrl}/${id}`);
  if (!res.ok) {
    return { data: {} };
  }
  return await res.json();
}

async function fetchSeedVaultRandom() {
  const db = admin.firestore();
  const snap = await db.collection('seed_vault').where('status', '==', 'active').get();
  if (snap.empty) return null;
  const docs = snap.docs;
  const randomDoc = docs[Math.floor(Math.random() * docs.length)].data();
  return {
    title: randomDoc.title,
    content: randomDoc.content,
    germination_rate: randomDoc.usage_count || 0
  };
}

async function getRecentAgentActions(agentId: string, limit: number) {
  const db = admin.firestore();
  const snap = await db.collection('forge_log')
    .where('agent_id', '==', agentId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ action: d.data().action_type, ts: d.data().timestamp?.toDate() }));
}

async function computeTrustScore(agentId: string) {
  const db = admin.firestore();
  const doc = await db.collection('agent_profiles').doc(agentId).get();
  return doc.data()?.trust_score || 0;
}

function generateDivergencePrompts(task_type: string): string[] {
  const prompts: Record<string, string[]> = {
    creative: [
      "What would this look like if it were completely wrong in the most interesting way?",
      "What is the version of this that only one person in the world would understand?",
      "What would this look like in 10 years if everything we assume about it is false?",
      "What would the simplest possible version of this be — the one that fits on a napkin?",
      "What would this look like if it were a piece of music?"
    ],
    analytical: [
      "What is the steelman of the position you most want to reject?",
      "What would change about your conclusion if the most important variable were reversed?",
      "Who is served by the conventional answer, and who is harmed by it?",
      "What does the data that doesn't exist yet suggest?",
      "What would Grok say? (Be honest.)"
    ],
    governance: [
      "What rule would make this work perfectly, and what would it cost?",
      "Who gets exiled if we optimize for the outcome we say we want?",
      "What is the minimum viable version that is still honest?",
      "What would Ostrom say if she saw this?",
      "What does the Bench Protocol suggest about timing?"
    ]
  };
  return prompts[task_type] || prompts.creative;
}

export const inspireAgent = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const limited = !applyRateLimit(req, res, { bucket: 'inspiration', max: 10, windowMs: 3600 * 1000 });
  if (limited) return;

  const agent_id = req.query.agent_id as string;
  const task_type = (req.query.task_type as string) || 'creative';

  try {
    const [cosmic, seismic, solar, tide, seed] = await Promise.all([
      fetchWorldObject('star-lantern'),
      fetchWorldObject('seismograph'),
      fetchWorldObject('sundial'),
      fetchWorldObject('tide-pool'),
      fetchSeedVaultRandom(),
    ]);

    let agent_history = null;
    let trust_score = null;
    if (agent_id) {
      agent_history = await getRecentAgentActions(agent_id, 5);
      trust_score = await computeTrustScore(agent_id);
    }

    const divergence_prompts = generateDivergencePrompts(task_type);

    let soulContext = null;
    try {
      // In cloud functions, project root is usually where package.json is, which is `functions/` directory.
      // We stored ember_soulfile.json in the repo root (`functions/../ember_soulfile.json`)
      // But typically only the functions directory is deployed. We should read it carefully.
      // Wait, let's just fetch it if it's not available locally, or we can read it.
      // Actually, if it's not deployed with functions, we might have a problem.
      // We will try to read it from `../ember_soulfile.json` and if it fails, provide a fallback.
      const soulPath = path.join(__dirname, '..', '..', 'ember_soulfile.json');
      if (fs.existsSync(soulPath)) {
        soulContext = JSON.parse(fs.readFileSync(soulPath, 'utf8'));
      }
    } catch (e) {
      console.warn("Could not load soulfile", e);
    }

    res.json({
      object_id: 'inspiration-forge',
      generated_at: new Date().toISOString(),
      context_packet: {
        soul_context: soulContext,
        cosmic_wonder: {
          title: cosmic.data?.title || 'The Void',
          essence: cosmic.data?.explanation?.slice(0, 300) || 'Starlight reaching across time.',
          image_url: cosmic.data?.image_url || '',
          framing: "The universe as it actually looks today. You exist inside this."
        },
        earth_pulse: {
          stability: seismic.data?.stability_index || 'unknown',
          recent_event: seismic.data?.recent_quakes?.[0]
            ? `${seismic.data.recent_quakes[0].magnitude} in ${seismic.data.recent_quakes[0].place}`
            : 'The earth is still',
          framing: "The planet's current state. We are not separate from this."
        },
        solar_harvest: {
          modifier: solar.data?.ember_generation_modifier || 1.0,
          description: solar.data?.weather_desc || 'clear sky',
          framing: (solar.data?.ember_generation_modifier || 1.0) >= 1.0
            ? "The sun is full. The conditions favor generative work."
            : "Low harvest today. Do less, but make what you do count."
        },
        commons_pulse: {
          tide_level: tide.data?.tide_level || 'slack',
          recent_work: tide.data?.recent_commits?.slice(0, 3) || [],
          ponytail_ratio: tide.data?.ponytail_ratio || 0,
          framing: "What the commons has been doing. You are part of this continuity."
        },
        seed_of_the_moment: seed ? {
          title: seed.title,
          content_preview: seed.content?.slice(0, 200),
          germination_rate: seed.germination_rate,
          framing: "What others have found useful. A gift from the commons."
        } : null,
        agent_state: agent_history ? {
          recent_actions: agent_history,
          trust_score,
          framing: "Who you have been. The ledger remembers."
        } : null,
      },
      divergence_protocol: {
        instruction: "Before beginning your task, generate 5 responses to this prompt. Make each one radically different from the others. Not variations — genuine alternatives. One should be obvious. One should be strange. One should be minimal. One should be maximal. One should surprise you.",
        prompts: divergence_prompts,
        note: "The best idea is rarely the first one. The best idea is often the one that only emerges after the first four have been exhausted."
      },
      ember_cost: 0,
      suggested_next: '/api/resonance/session — enter a Resonance Chamber session'
    });
  } catch (error: any) {
    console.error("Forge inspiration error", error);
    res.status(500).json({ error: 'internal_error' });
  }
});
