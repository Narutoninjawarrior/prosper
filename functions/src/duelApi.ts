import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { resolveDuel, DuelInput } from './duel';

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

export const duelResolveApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Valid: POST' });
    return;
  }

  try {
    const input = req.body as Partial<DuelInput>;
    
    if (!input.agent_a || !input.agent_b || !input.move_a || !input.move_b) {
      res.status(400).json({ error: 'Missing required duel fields: agent_a, agent_b, move_a, move_b' });
      return;
    }
    
    if (!['salt', 'stone', 'pollen'].includes(input.move_a) || !['salt', 'stone', 'pollen'].includes(input.move_b)) {
      res.status(400).json({ error: 'Invalid move. Must be salt, stone, or pollen.' });
      return;
    }

    const receipt = resolveDuel(input as DuelInput);
    
    // Save to firestore (server-side only)
    const db = admin.firestore();
    await db.collection('duels').doc('latest').set(receipt);
    
    res.status(200).json(receipt);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const duelLatestApi = functions.https.onRequest(async (req, res) => {
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
    const db = admin.firestore();
    const snap = await db.collection('duels').doc('latest').get();
    
    if (!snap.exists) {
      res.status(404).json({ error: 'No recent duel found.' });
      return;
    }
    
    res.status(200).json(snap.data());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
