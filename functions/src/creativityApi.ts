import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { fetchWorldTick } from './tickApi';
import { suggestCreativity } from './creativity';
import { fetchLoggedExperimentIds } from './experimentLogApi';
import type { HearthStateSnapshot } from './ceremony';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

async function loadSnapshot(): Promise<{ state: HearthStateSnapshot; data_state: string }> {
  const db = admin.firestore();
  try {
    const snap = await db.collection('three_forge').doc('world_state').get();
    if (snap.exists) {
      const data = snap.data() || {};
      const plots = Array.isArray(data.plots) ? data.plots : [];
      return {
        data_state: 'live',
        state: {
          heat: typeof data.heat === 'number' ? data.heat : 0,
          ember_balance: typeof data.ember_balance === 'number' ? data.ember_balance : 0,
          tick: typeof data.tick === 'number' ? data.tick : 0,
          biosphere_nodes: plots.map((p: Record<string, unknown>) => ({
            id: typeof p.id === 'number' ? p.id : 0,
            active: Boolean(p.active),
            bloomStage: typeof p.bloomStage === 'number' ? p.bloomStage : 0,
          })),
          sim2real: { weather: typeof data.weather === 'string' ? data.weather : 'clear' },
          timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
        },
      };
    }
  } catch (err) {
    console.error('[creativity] live state read failed', err);
  }

  const HOSTING_BASE = process.env.AGENT_API_SEED_BASE || 'https://fellowship-of-the-hearth.web.app';
  const response = await fetch(`${HOSTING_BASE}/bellows_state.json`);
  if (!response.ok) throw new Error('Failed to load hearth state for creativity suggest.');
  const state = await response.json() as HearthStateSnapshot;
  return { state, data_state: 'seeded' };
}

export async function fetchCreativitySuggest(limit?: number) {
  const tick = await fetchWorldTick();
  const { state, data_state } = await loadSnapshot();
  const context = {
    tick: tick.tick,
    heat: tick.heat,
    ember_balance: tick.ember_balance,
    state_hash: tick.state_hash,
    biosphere_nodes: state.biosphere_nodes,
    weather: state.sim2real.weather,
  };
  const excluded = await fetchLoggedExperimentIds();
  return {
    ...suggestCreativity(context, limit ?? 8, excluded),
    data_state,
    heartbeat_at: tick.heartbeat_at,
  };
}

export const creativityApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Valid: GET' });
    return;
  }

  try {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 8;
    const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, limit)) : 8;
    const result = await fetchCreativitySuggest(safeLimit);
    res.set('Cache-Control', 'public, max-age=5, s-maxage=5');
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
