import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { cookHearthMeal, HearthStateSnapshot } from './ceremony';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'no-store');
}



export async function fetchHearthCeremony(humParam?: number) {
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

  let finalHum = humParam;
  if (finalHum !== undefined && (isNaN(finalHum) || finalHum < 0 || finalHum > 1)) {
     finalHum = undefined;
  }
  const meal = cookHearthMeal(state, finalHum);

  return {
    data_state,
    ...meal
  };
}

export const ceremonyApi = functions.https.onRequest(async (req, res) => {
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
    const humParam = typeof req.query.hum === 'string' ? parseFloat(req.query.hum) : undefined;
    const result = await fetchHearthCeremony(humParam);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
