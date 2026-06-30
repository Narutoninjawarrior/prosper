import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { HearthStateSnapshot } from './ceremony';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

function sha256Hex(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function fetchWorldTick(lastHash?: string) {
  const db = admin.firestore();
  let state: HearthStateSnapshot | null = null;
  let data_state = 'seeded';

  try {
    const snap = await db.collection('three_forge').doc('world_state').get();
    if (snap.exists) {
      const data = snap.data() || {};
      const plots = Array.isArray(data.plots) ? data.plots : [];
      state = {
        heat: typeof data.heat === 'number' ? data.heat : 0,
        ember_balance: typeof data.ember_balance === 'number' ? data.ember_balance : 0,
        tick: typeof data.tick === 'number' ? data.tick : 0,
        biosphere_nodes: plots.map(p => ({
          id: p.id || 0,
          active: Boolean(p.active),
          bloomStage: typeof p.bloomStage === 'number' ? p.bloomStage : 0
        })),
        sim2real: { weather: typeof data.weather === 'string' ? data.weather : 'clear' },
        timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString()
      };
      data_state = 'live';
    }
  } catch (err) {
    console.error('Failed to read live world_state', err);
  }

  if (!state) {
    try {
      const HOSTING_BASE = process.env.AGENT_API_SEED_BASE || 'https://fellowship-of-the-hearth.web.app';
      const response = await fetch(`${HOSTING_BASE}/bellows_state.json`);
      if (response.ok) {
        state = await response.json() as HearthStateSnapshot;
        data_state = 'seeded';
      }
    } catch (e) {
      console.error('Failed to read fallback bellows_state', e);
    }
  }

  if (!state) {
    throw new Error('Failed to load hearth state.');
  }

  const subset = {
    tick: state.tick,
    heat: state.heat,
    ember_balance: state.ember_balance,
    nodes: state.biosphere_nodes.map(n => n.bloomStage).join(','),
    weather: state.sim2real.weather,
  };
  
  const state_hash = sha256Hex(stableStringify(subset));
  const changed_since_last = lastHash ? state_hash !== lastHash : true;
  
  return {
    tick: state.tick,
    heat: state.heat,
    ember_balance: state.ember_balance,
    state_hash,
    changed_since_last,
    data_state,
    heartbeat_at: state.timestamp,
  };
}

import { applyRateLimit } from './lib/edgeGuard';

export const tickApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!applyRateLimit(req, res, { bucket: 'world-tick', windowMs: 60_000, max: 120 })) return;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Valid: GET' });
    return;
  }

  try {
    const lastHash = req.query.last_hash as string | undefined;
    const ifNoneMatch = req.headers['if-none-match'];
    const comparisonHash = lastHash || ifNoneMatch;
    
    const result = await fetchWorldTick(comparisonHash);
    
    res.set('Cache-Control', 'public, max-age=2');
    res.set('ETag', result.state_hash);
    
    if (ifNoneMatch === result.state_hash) {
      res.status(304).send('');
      return;
    }
    
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
