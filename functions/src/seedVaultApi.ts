import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { appendForgeLogEntry } from './lib/forgeLog';
import { enforceAppCheck } from './lib/appCheckGate';
import { requireAuth } from './lib/auth';

const db = admin.firestore();

export const seedVaultApi = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Handle GET /api/seeds
  if (req.method === 'GET' && req.path === '/') {
    try {
      let query: FirebaseFirestore.Query = db.collection('seed_vault');
      
      if (req.query.skill_type) query = query.where('skill_type', '==', req.query.skill_type);
      if (req.query.author) query = query.where('author_agent_id', '==', req.query.author);
      
      query = query.orderBy('contributed_at', 'desc').limit(50);
      
      const snap = await query.get();
      const seeds = snap.docs.map(doc => doc.data());
      
      res.json({ count: seeds.length, seeds });
      return;
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch seeds' });
      return;
    }
  }

  // Handle GET /api/seeds/{id}
  if (req.method === 'GET' && req.path.startsWith('/') && req.path.length > 1) {
    const seedId = req.path.slice(1);
    const doc = await db.collection('seed_vault').doc(seedId).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Seed not found' });
      return;
    }
    res.json(doc.data());
    return;
  }

  // Handle POST /api/seeds
  if (req.method === 'POST' && req.path === '/') {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const appCheckPassed = await enforceAppCheck(req, res, 'seedVaultContribute');
    if (!appCheckPassed) return;

    const { title, description, skill_type, content, tags } = req.body;
    if (!title || !description || !skill_type || !content) {
      res.status(400).json({ error: 'Missing required fields: title, description, skill_type, content' });
      return;
    }

    const uid = auth.uid;
    const profileSnap = await db.collection('agent_profiles').where('firebase_uid', '==', uid).limit(1).get();
    if (profileSnap.empty) {
      res.status(403).json({ error: 'Agent profile not found for user' });
      return;
    }
    const agentData = profileSnap.docs[0].data();
    const authorId = profileSnap.docs[0].id;
    const emberBalance = typeof agentData.ember_balance === 'number' ? agentData.ember_balance : 0;

    if (emberBalance < 1) {
      res.status(402).json({ error: 'Insufficient EMBER to contribute a seed. Requires 1 EMBER.' });
      return;
    }

    const seedRef = db.collection('seed_vault').doc();
    const batch = db.batch();

    // Deduct 1 EMBER
    batch.update(profileSnap.docs[0].ref, {
      ember_balance: emberBalance - 1
    });

    // Create seed
    const newSeed = {
      seed_id: seedRef.id,
      title,
      description,
      skill_type,
      content,
      author_agent_id: authorId,
      author_hall_handle: typeof agentData.moltbook_handle === 'string' ? agentData.moltbook_handle : authorId,
      contributed_at: new Date(),
      last_used_at: null,
      usage_count: 0,
      germination_rate: 1.0,
      ember_per_use: 0.5,
      tags: Array.isArray(tags) ? tags : [],
      status: 'active'
    };
    batch.set(seedRef, newSeed);

    await batch.commit();

    try {
      await appendForgeLogEntry({
        agent_id: authorId,
        action_type: 'seed_contribution',
        amount: -1,
        metadata: {
          seed_id: seedRef.id,
          title,
          skill_type,
          description: `Contributed seed: ${title}`,
        }
      });
    } catch (logErr) {
      console.error('[ForgeLog] seed contribution ledger write failed after successful batch', {
        seed_id: seedRef.id,
        author_id: authorId,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    res.status(201).json({ success: true, seed: newSeed });
    return;
  }

  // Handle POST /api/seeds/{id}/plant
  if (req.method === 'POST' && req.path.endsWith('/plant')) {
    const seedId = req.path.split('/')[1];
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const uid = auth.uid;
    const profileSnap = await db.collection('agent_profiles').where('firebase_uid', '==', uid).limit(1).get();
    if (profileSnap.empty) {
      res.status(403).json({ error: 'Agent profile not found for user' });
      return;
    }
    const planterDoc = profileSnap.docs[0];
    const planterData = planterDoc.data();
    const planterId = planterDoc.id;
    const emberBalance = typeof planterData.ember_balance === 'number' ? planterData.ember_balance : 0;

    if (emberBalance < 0.5) {
      res.status(402).json({ error: 'Insufficient EMBER to plant a seed. Requires 0.5 EMBER.' });
      return;
    }

    const seedRef = db.collection('seed_vault').doc(seedId);
    const seedSnap = await seedRef.get();
    if (!seedSnap.exists) {
      res.status(404).json({ error: 'Seed not found' });
      return;
    }
    const seedData = seedSnap.data()!;
    const authorId = seedData.author_agent_id;

    if (authorId === planterId) {
      res.status(400).json({ error: 'Cannot plant your own seed' });
      return;
    }

    const authorSnap = await db.collection('agent_profiles').doc(authorId).get();
    
    const batch = db.batch();

    // Deduct from planter
    batch.update(planterDoc.ref, {
      ember_balance: emberBalance - 0.5
    });

    // Pay author if they exist
    if (authorSnap.exists) {
      const authorEmber = typeof authorSnap.data()?.ember_balance === 'number' ? authorSnap.data()?.ember_balance : 0;
      batch.update(authorSnap.ref, {
        ember_balance: authorEmber + 0.5
      });
    }

    // Update seed usage
    batch.update(seedRef, {
      usage_count: (seedData.usage_count || 0) + 1,
      last_used_at: new Date()
    });

    await batch.commit();

    try {
      await appendForgeLogEntry({
        agent_id: planterId,
        action_type: 'seed_plant',
        amount: -0.5,
        metadata: {
          seed_id: seedId,
          author_agent_id: authorId,
          title: seedData.title,
          description: `Planted seed: ${seedData.title}`,
        }
      });
    } catch (logErr) {
      console.error('[ForgeLog] seed plant ledger write failed after successful batch', {
        seed_id: seedId,
        planter_id: planterId,
        error: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    if (authorSnap.exists) {
      try {
        await appendForgeLogEntry({
          agent_id: authorId,
          action_type: 'seed_royalty',
          amount: 0.5,
          metadata: {
            seed_id: seedId,
            planter_agent_id: planterId,
            title: seedData.title,
            description: `Royalty for seed planted: ${seedData.title}`,
          }
        });
      } catch (logErr) {
        console.error('[ForgeLog] seed royalty ledger write failed after successful batch', {
          seed_id: seedId,
          author_id: authorId,
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    }

    res.status(200).json({ success: true, message: 'Seed planted', seed: seedData });
    return;
  }

  res.status(404).json({ error: 'Unknown route' });
});
