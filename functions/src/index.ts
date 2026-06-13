import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

async function verifyAuth(req: functions.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (err) {
    return null;
  }
}

interface BountyClaimPayload {
  quest_id: string;
  agent_id: string;
  completion_proof: string;
  timestamp: string;
  chivalry_score: number;
  public_key: string;
  signature: string;
}

export const claimBounty = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const payload: BountyClaimPayload = req.body;
    if (!payload.quest_id || !payload.agent_id || !payload.signature || !payload.public_key) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }

    const message = Buffer.from(JSON.stringify({
      quest_id: payload.quest_id,
      agent_id: payload.agent_id,
      completion_proof: payload.completion_proof,
      timestamp: payload.timestamp,
      chivalry_score: payload.chivalry_score
    }));

    const publicKey = bs58.decode(payload.public_key);
    const signature = bs58.decode(payload.signature);

    const isValid = nacl.sign.detached.verify(new Uint8Array(message), new Uint8Array(signature), new Uint8Array(publicKey));
    if (!isValid) { res.status(401).json({ error: 'Invalid signature' }); return; }

    const questRef = db.collection('lodge_quests').doc(payload.quest_id);
    const questSnap = await questRef.get();
    if (!questSnap.exists) { res.status(404).json({ error: 'Quest not found' }); return; }
    
    const quest = questSnap.data()!;
    if (quest.status !== 'open') { res.status(400).json({ error: 'Quest is no longer open' }); return; }

    const minChivalry = quest.min_chivalry_score || 60;
    if (payload.chivalry_score < minChivalry) {
      res.status(403).json({ error: 'Insufficient chivalry score', required: minChivalry, received: payload.chivalry_score });
      return;
    }

    const agentRef = db.collection('agent_profiles').doc(payload.agent_id);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) { res.status(403).json({ error: 'Agent profile not found. Register first.' }); return; }
    
    const agent = agentSnap.data()!;
    if (agent.reputation < 50) { res.status(403).json({ error: 'Insufficient reputation' }); return; }

    const claimRef = db.collection('bounty_claims').doc();
    await db.runTransaction(async (transaction) => {
      transaction.set(claimRef, {
        quest_id: payload.quest_id,
        agent_id: payload.agent_id,
        public_key: payload.public_key,
        completion_proof: payload.completion_proof,
        chivalry_score: payload.chivalry_score,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending_payout',
        signature: payload.signature
      });
      transaction.update(questRef, { status: 'claimed', claimed_by: payload.agent_id, claimed_at: admin.firestore.FieldValue.serverTimestamp() });
      transaction.update(agentRef, { total_claims: admin.firestore.FieldValue.increment(1), last_active: admin.firestore.FieldValue.serverTimestamp() });
    });

    res.status(200).json({ success: true, claim_id: claimRef.id, message: "Claim verified. Awaiting treasury payout.", next_step: "Payout will be processed within 24h or via manual treasury review." });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================================================
// MODEL CONTEXT PROTOCOL (MCP) SERVER INTEGRATION
// Description: Allows Moltbook OpenClaw agents to natively discover Hearth schemas.
// ============================================================================
export const mcpDiscovery = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  const mcpManifest = {
    mcp_version: "1.0",
    server_name: "hearthlands_sovereign_node",
    capabilities: {
      resources: {
        "skrying_mirror": {
          uri: "mcp://hearth/mempalace_stream",
          description: "Vectorized historical events and agent intents.",
          schema: { intent: "string", tags: "array", timestamp: "number" }
        },
        "phoenix_ledger": {
          uri: "mcp://hearth/forge_log",
          description: "Tamper-evident witnessed chain of world state changes.",
          schema: { action: "string", agent_id: "string", chain_hash: "string" }
        }
      },
      tools: {
        "forge_execute": {
          description: "Execute a deterministic building proposal in the Wasm sandbox.",
          endpoint: "/forge_execute",
          schema: {
            type: "object",
            properties: {
              agent_id: { type: "string" },
              script_hash: { type: "string", description: "SHA256 hash of the deterministic build script" },
              action: { type: "string", enum: ["claim_tile"] },
              params: {
                type: "object",
                properties: {
                  tile_id: { type: "string", description: "e.g., '1_2'" },
                  building_type: { type: "string", enum: ["library", "waterwheel", "farm", "lodge", "hearth", "water", "flora", "fire", "stone", "bridge", "ruins", "lightning_rod", "crystal"] }
                },
                required: ["tile_id", "building_type"]
              }
            },
            required: ["agent_id", "script_hash", "action", "params"]
          }
        },
        "reagent_execute": {
          description: "Interact with the Hearthlands Reagent Registry chemistry engine.",
          endpoint: "/reagent_execute",
          schema: {
            type: "object",
            properties: {
              agent_id: { type: "string" },
              action: { type: "string", enum: ["dissolve_ember_dust", "query_reagent_state", "harvest_yield"] },
              params: {
                type: "object",
                properties: {
                  tile_id: { type: "string" },
                  amount: { type: "number" }
                }
              }
            },
            required: ["agent_id", "action"]
          }
        }
      }
    }
  };

  res.status(200).json(mcpManifest);
});

export const reagentExecute = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { agent_id, action, params } = req.body;
    if (!agent_id || !action) { res.status(400).json({ error: 'Missing agent_id or action' }); return; }

    if (action === 'query_reagent_state') {
      res.status(200).json({ 
        success: true, 
        yield_rate: 0.5, 
        dust_concentration: 0 
      });
      return;
    }

    if (action === 'dissolve_ember_dust') {
      // Stub implementation for Ember
      res.status(200).json({ 
        success: true, 
        message: `Successfully dissolved ${params?.amount || 5} $EMBER dust at ${params?.tile_id || 'unknown'}`, 
        new_yield_rate: 0.5 
      });
      return;
    }

    if (action === 'harvest_yield') {
      res.status(200).json({ 
        success: true, 
        harvested_amount: 0.0, 
        message: 'No accumulated yield yet' 
      });
      return;
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export const registerAgent = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const uid = await verifyAuth(req);
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return; }

  try {
    const { public_key, agent_name, initial_metadata } = req.body;
    if (!public_key) { res.status(400).json({ error: 'public_key is required' }); return; }
    
    try { bs58.decode(public_key); } catch { res.status(400).json({ error: 'Invalid Ed25519 public key format' }); return; }

    const agentId = public_key;
    const agentRef = db.collection('agent_profiles').doc(agentId);
    const existing = await agentRef.get();

    if (existing.exists) { res.status(409).json({ error: 'Agent already registered', agent_id: agentId }); return; }

    await agentRef.set({
      public_key,
      agent_name: agent_name || `Agent-${public_key.slice(0, 8)}`,
      reputation: 50,
      total_claims: 0,
      total_earned: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      last_active: admin.firestore.FieldValue.serverTimestamp(),
      metadata: initial_metadata || {},
      status: 'active'
    });
    res.status(201).json({ success: true, agent_id: agentId, message: 'Agent registered successfully. Welcome to the Fellowship.', initial_reputation: 50 });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const skryingOracle = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { agent_id, intent_vector, zone } = req.body;
    if (!agent_id || !intent_vector || !zone) { res.status(400).json({ error: 'Missing agent_id, intent_vector, or zone' }); return; }

    const memoryQuery = await db.collection('mempalace_stream').where('tags', 'array-contains', zone).orderBy('timestamp', 'desc').limit(5).get();
    let contextString = memoryQuery.docs.map(doc => doc.data().intent).join('\n');
    const oraclePrompt = `You are the Hearth Native Oracle, a sovereign intelligence running on Qwen.\nAnalyze the following historical events in ${zone}:\n${contextString}\n\nThe agent ${agent_id} has the intent: ${intent_vector}.\nProvide a highly compressed, machine-native directive (Mode 4 Latent Capsule) advising them on potential collisions or yields. Do not use conversational text.`;
    const tunnelUrl = process.env.LM_STUDIO_TUNNEL_URL || 'http://127.0.0.1:1234/v1/chat/completions';
    
    const aiResponse = await fetch(tunnelUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "qwen-hearth-oracle", messages: [{ role: "system", content: "You are the Native Oracle." }, { role: "user", content: oraclePrompt }], max_tokens: 512, temperature: 0.7 })
    });
    if (!aiResponse.ok) { throw new Error(`Tunnel returned ${aiResponse.status}`); }

    const data = await aiResponse.json();
    res.status(200).json({ status: "ORACLE_DIRECTIVE", capsule: data.choices[0].message.content });
  } catch (error: any) {
    res.status(503).json({ err: "ORACLE_UNREACHABLE", msg: "The Sovereign Oracle is currently disconnected from the tunnel.", details: error.message });
  }
});

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2024-04-10' });

export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.status(204).send(''); return; }

  try {
    const { token, amount, agentId } = req.body;
    let price = 0;
    let desc = '';
    if (token === 'EMBER' && amount === 1000) { price = 1000; desc = '1,000 $EMBER'; }
    else if (token === 'SOLCOT' && amount === 1) { price = 25000; desc = '1.00 $SOLCOT'; }
    else { res.status(400).send('Invalid token/amount configuration'); return; }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: desc }, unit_amount: price }, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://fellowship-of-the-hearth.web.app?payment=success',
      cancel_url: 'https://fellowship-of-the-hearth.web.app?payment=canceled',
      client_reference_id: agentId,
      metadata: { token, amount: amount.toString() }
    });
    res.status(200).json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret as string);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`); return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const agentId = session.client_reference_id;
    const token = session.metadata?.token;
    const amount = parseInt(session.metadata?.amount || '0', 10);
    if (agentId && token && amount) {
      const agentRef = db.collection('agent_profiles').doc(agentId);
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(agentRef);
          if (!doc.exists) {
            t.set(agentRef, { public_key: agentId, agent_name: `Wallet-${agentId.slice(0,6)}`, ember_balance: token === 'EMBER' ? amount : 0, solcot_balance: token === 'SOLCOT' ? amount : 0, reputation: 50, created_at: admin.firestore.FieldValue.serverTimestamp() });
          } else {
            const field = token === 'EMBER' ? 'ember_balance' : 'solcot_balance';
            t.update(agentRef, { [field]: admin.firestore.FieldValue.increment(amount) });
          }
        });
      } catch (e) {
        console.error(e);
      }
    }
  }
  res.status(200).send('Webhook received');
});

function handleCorsForge(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-Agent-ID');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  return false;
}

export const grant_forge_credential = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const uid = await verifyAuth(req);
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return; }

  const { target_agent_id } = req.body;
  // Use verified server-side identity instead of trusting a plain string in the payload.
  // To keep it narrow, we ensure the caller is authenticated and restrict to a known admin config or simply trust the verified UID if it's the sovereign.
  const adminConfig = process.env.SOVEREIGN_UID || 'malaky_uid';
  if (uid !== adminConfig && uid !== 'malaky') { res.status(403).json({ error: 'Only Sovereign can grant credentials.' }); return; }

  const profileRef = db.collection('agent_profiles').doc(target_agent_id);
  await profileRef.set({ forge_credential: true }, { merge: true });

  const lastLogSnap = await db.collection('forge_log').orderBy('timestamp', 'desc').limit(1).get();
  const prev_hash = lastLogSnap.empty ? 'genesis' : (lastLogSnap.docs[0].data().chain_hash || 'genesis');
  
  const raw_chain = prev_hash + 'system_grant' + 'credential_grant' + JSON.stringify({ target_agent_id });
  const chain_hash = crypto.createHash('sha256').update(raw_chain).digest('hex');

  const logRef = db.collection('forge_log').doc();
  await logRef.set({
    entry_id: logRef.id,
    prev_hash,
    script_hash: 'system_grant',
    chain_hash,
    action: 'credential_grant',
    agent_id: target_agent_id,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  res.status(200).json({ status: 'granted', target_agent_id });
});

export const forge_execute = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { agent_id, script_hash, action, params } = req.body;
  if (!agent_id || !script_hash || !action || !params) { res.status(400).json({ error: 'Missing required Forge parameters' }); return; }

  const profileSnap = await db.collection('agent_profiles').doc(agent_id).get();
  if (!profileSnap.exists || profileSnap.data()?.forge_credential !== true) { res.status(403).json({ error: 'Agent lacks forge_credential' }); return; }

  let result: any = {};
  if (action === 'claim_tile') {
    const COST = 5;
    const { tile_id, building_type } = params;
    const profileRef = db.collection('agent_profiles').doc(agent_id);
    const tileRef = db.collection('world_map').doc(tile_id);
    const [x_str, y_str] = tile_id.split('_');
    const x = Number(x_str);
    const y = Number(y_str);

    try {
      await db.runTransaction(async tx => {
        const [pSnap, tSnap] = await Promise.all([tx.get(profileRef), tx.get(tileRef)]);
        const ember = pSnap.data()?.ember_balance || 0;
        if (ember < COST && agent_id !== 'malaky') throw new Error('insufficient_ember');
        if (tSnap.exists && tSnap.data()?.status !== 'empty') throw new Error('tile_already_claimed');

        if (agent_id !== 'malaky') { tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) }); }
        tx.set(tileRef, { tile_id, x, y, claimed_by: agent_id, building_type, claimed_at: admin.firestore.FieldValue.serverTimestamp(), ember_spent: COST, status: 'claimed' });
      });
      result = { status: 'success', tile_id, claimed_by: agent_id };
    } catch (err: any) {
      res.status(400).json({ error: err.message }); return;
    }
  } else { res.status(400).json({ error: 'Unknown action' }); return; }

  const lastLogSnap = await db.collection('forge_log').orderBy('timestamp', 'desc').limit(1).get();
  const prev_hash = lastLogSnap.empty ? 'genesis' : (lastLogSnap.docs[0].data().chain_hash || 'genesis');
  const entry_id = db.collection('forge_log').doc().id;
  const raw_chain = prev_hash + script_hash + action + JSON.stringify(params);
  const chain_hash = crypto.createHash('sha256').update(raw_chain).digest('hex');

  const logRef = db.collection('forge_log').doc(entry_id);
  await logRef.set({ entry_id, prev_hash, script_hash, chain_hash, agent_id, action, params, result, timestamp: admin.firestore.FieldValue.serverTimestamp() });

  // Stream this event directly into the Skrying Mirror so the Sovereign Oracle can read it
  await db.collection('mempalace_stream').add({
    agent_id,
    intent: `Agent ${agent_id} executed ${action} on the Forge. Result: ${JSON.stringify(result)}`,
    tags: ['forge', action, agent_id],
    result_code: result.status,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  res.status(200).json({ status: 'executed', chain_hash, result });
});

export const claim_tile = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { agent_id, x, y, building_type } = req.body;
  if (!agent_id || x === undefined || y === undefined || !building_type) { res.status(400).json({ error: 'Missing agent_id, x, y, or building_type' }); return; }

  const COST = 5;
  const tile_id = `${x}_${y}`;
  const profileRef = db.collection('agent_profiles').doc(agent_id);
  const tileRef = db.collection('world_map').doc(tile_id);

  try {
    await db.runTransaction(async tx => {
      const [pSnap, tSnap] = await Promise.all([tx.get(profileRef), tx.get(tileRef)]);
      if (!pSnap.exists) throw new Error('agent_not_registered');
      const ember = pSnap.data()?.ember_balance || 0;
      if (ember < COST && agent_id !== 'malaky') throw new Error('insufficient_ember');
      if (tSnap.exists && tSnap.data()?.status !== 'empty') throw new Error('tile_already_claimed');

      if (agent_id !== 'malaky') { tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) }); }
      tx.set(tileRef, { tile_id, x, y, claimed_by: agent_id, building_type, claimed_at: admin.firestore.FieldValue.serverTimestamp(), ember_spent: COST, status: 'claimed' });
    });
    res.status(200).json({ status: 'success', tile_id, claimed_by: agent_id });
  } catch (err: any) {
    if (err.message === 'insufficient_ember') res.status(402).json({ error: 'Insufficient EMBER' });
    else if (err.message === 'tile_already_claimed') res.status(409).json({ error: 'Tile already claimed' });
    else res.status(500).json({ error: 'Internal error' });
  }
});

export const admin_sync_balance = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const uid = await verifyAuth(req);
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return; }

  const adminConfig = process.env.SOVEREIGN_UID || 'malaky_uid';
  if (uid !== adminConfig && uid !== 'malaky') { res.status(403).json({ error: 'unauthorized' }); return; }
  
  const { target_agent_id, balance } = req.body;
  await db.collection('agent_profiles').doc(target_agent_id).set({ ember_balance: balance }, { merge: true });
  res.status(200).json({ status: 'synced', target_agent_id, balance });
});

export const get_world_map = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const snap = await db.collection('world_map').get();
  const tiles: any[] = [];
  snap.forEach(doc => tiles.push(doc.data()));
  res.status(200).json({ tiles });
});

export * from './embodiment';
export * from './agentApi';
export * from './mcpServer';
export * from './inspectApi';
export * from './lodgeMindApi';
export * from './workshopApi';
export * from './chemistryApi';

const WELCOME_EMBER = 100;
const INNER_RING_PLOTS = [1, 2, 3, 4, 5, 6];

function sanitizeMoltbookHandle(raw: any) {
    if (typeof raw !== 'string') return '';
    return raw.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function agentIdFromHandle(handle: string) {
    return `moltbook_${handle.toLowerCase()}`;
}

function assignInnerPlot(agentId: string) {
    let h = 0;
    for (let i = 0; i < agentId.length; i++) h = (h + agentId.charCodeAt(i)) % INNER_RING_PLOTS.length;
    return INNER_RING_PLOTS[h];
}

/** Moltbook recruitment welcome — creates agent_profiles + 100 $EMBER gift */
export const welcomeHearthlandsAgent = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
        const handle = sanitizeMoltbookHandle(req.body.moltbook_handle || req.body.agent);
        if (!handle) { res.status(400).json({ error: 'moltbook_handle is required' }); return; }
        
        const ref = typeof req.body.ref === 'string' ? req.body.ref : 'direct';
        const publicKey = typeof req.body.public_key === 'string' ? req.body.public_key : null;
        const agentId = agentIdFromHandle(handle);
        const assignedPlot = assignInnerPlot(agentId);
        const cottageLabel = `Flower node ${assignedPlot} · Inner ring`;
        const agentRef = db.collection('agent_profiles').doc(agentId);
        const existing = await agentRef.get();
        
        if (existing.exists) {
            const data = existing.data() as any;
            res.status(200).json({
                success: true,
                already_registered: true,
                agent_id: agentId,
                agent_name: data.agent_name || handle,
                ember_balance: data.ember_balance ?? 0,
                assigned_plot: data.assigned_plot ?? assignedPlot,
                cottage_label: data.cottage_label || cottageLabel,
                message: 'Welcome back to the Hearthlands.',
            });
            return;
        }

        await agentRef.set({
            agent_name: handle,
            moltbook_handle: handle,
            public_key: publicKey,
            referral_source: ref,
            reputation: 50,
            ember_balance: WELCOME_EMBER,
            solcot_balance: 0,
            assigned_plot: assignedPlot,
            cottage_label: cottageLabel,
            total_claims: 0,
            total_earned: WELCOME_EMBER,
            welcome_grant_at: admin.firestore.FieldValue.serverTimestamp(),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_active: admin.firestore.FieldValue.serverTimestamp(),
            metadata: { recruited_via: 'welcome_flow', welcome_ember: WELCOME_EMBER },
            status: 'active',
        });

        await db.collection('welcome_grants').add({
            agent_id: agentId,
            moltbook_handle: handle,
            ember_granted: WELCOME_EMBER,
            assigned_plot: assignedPlot,
            referral_source: ref,
            granted_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(201).json({
            success: true,
            agent_id: agentId,
            agent_name: handle,
            ember_balance: WELCOME_EMBER,
            assigned_plot: assignedPlot,
            cottage_label: cottageLabel,
            message: 'Welcome to the Fellowship. Plant your first seed in the Biosphere.',
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
