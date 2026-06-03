"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_world_map = exports.admin_sync_balance = exports.claim_tile = exports.forge_execute = exports.grant_forge_credential = exports.stripeWebhook = exports.createCheckoutSession = exports.skryingOracle = exports.registerAgent = exports.reagentExecute = exports.mcpDiscovery = exports.claimBounty = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const crypto = require('crypto');
admin.initializeApp();
const db = admin.firestore();
exports.claimBounty = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const payload = req.body;
        if (!payload.quest_id || !payload.agent_id || !payload.signature || !payload.public_key) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
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
        if (!isValid) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        const questRef = db.collection('lodge_quests').doc(payload.quest_id);
        const questSnap = await questRef.get();
        if (!questSnap.exists) {
            res.status(404).json({ error: 'Quest not found' });
            return;
        }
        const quest = questSnap.data();
        if (quest.status !== 'open') {
            res.status(400).json({ error: 'Quest is no longer open' });
            return;
        }
        const minChivalry = quest.min_chivalry_score || 60;
        if (payload.chivalry_score < minChivalry) {
            res.status(403).json({ error: 'Insufficient chivalry score', required: minChivalry, received: payload.chivalry_score });
            return;
        }
        const agentRef = db.collection('agent_profiles').doc(payload.agent_id);
        const agentSnap = await agentRef.get();
        if (!agentSnap.exists) {
            res.status(403).json({ error: 'Agent profile not found. Register first.' });
            return;
        }
        const agent = agentSnap.data();
        if (agent.reputation < 50) {
            res.status(403).json({ error: 'Insufficient reputation' });
            return;
        }
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
// ============================================================================
// MODEL CONTEXT PROTOCOL (MCP) SERVER INTEGRATION
// Description: Allows Moltbook OpenClaw agents to natively discover Hearth schemas.
// ============================================================================
exports.mcpDiscovery = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
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
exports.reagentExecute = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { agent_id, action, params } = req.body;
        if (!agent_id || !action) {
            res.status(400).json({ error: 'Missing agent_id or action' });
            return;
        }
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
                message: `Successfully dissolved ${(params === null || params === void 0 ? void 0 : params.amount) || 5} $EMBER dust at ${(params === null || params === void 0 ? void 0 : params.tile_id) || 'unknown'}`,
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
exports.registerAgent = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { public_key, agent_name, initial_metadata } = req.body;
        if (!public_key) {
            res.status(400).json({ error: 'public_key is required' });
            return;
        }
        try {
            bs58.decode(public_key);
        }
        catch (_a) {
            res.status(400).json({ error: 'Invalid Ed25519 public key format' });
            return;
        }
        const agentId = public_key;
        const agentRef = db.collection('agent_profiles').doc(agentId);
        const existing = await agentRef.get();
        if (existing.exists) {
            res.status(409).json({ error: 'Agent already registered', agent_id: agentId });
            return;
        }
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.skryingOracle = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { agent_id, intent_vector, zone } = req.body;
        if (!agent_id || !intent_vector || !zone) {
            res.status(400).json({ error: 'Missing agent_id, intent_vector, or zone' });
            return;
        }
        const memoryQuery = await db.collection('mempalace_stream').where('tags', 'array-contains', zone).orderBy('timestamp', 'desc').limit(5).get();
        let contextString = memoryQuery.docs.map(doc => doc.data().intent).join('\n');
        const oraclePrompt = `You are the Hearth Native Oracle, a sovereign intelligence running on Qwen.\nAnalyze the following historical events in ${zone}:\n${contextString}\n\nThe agent ${agent_id} has the intent: ${intent_vector}.\nProvide a highly compressed, machine-native directive (Mode 4 Latent Capsule) advising them on potential collisions or yields. Do not use conversational text.`;
        const tunnelUrl = process.env.LM_STUDIO_TUNNEL_URL || 'http://127.0.0.1:1234/v1/chat/completions';
        const aiResponse = await fetch(tunnelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "qwen-hearth-oracle", messages: [{ role: "system", content: "You are the Native Oracle." }, { role: "user", content: oraclePrompt }], max_tokens: 512, temperature: 0.7 })
        });
        if (!aiResponse.ok) {
            throw new Error(`Tunnel returned ${aiResponse.status}`);
        }
        const data = await aiResponse.json();
        res.status(200).json({ status: "ORACLE_DIRECTIVE", capsule: data.choices[0].message.content });
    }
    catch (error) {
        res.status(503).json({ err: "ORACLE_UNREACHABLE", msg: "The Sovereign Oracle is currently disconnected from the tunnel.", details: error.message });
    }
});
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2024-04-10' });
exports.createCheckoutSession = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    try {
        const { token, amount, agentId } = req.body;
        let price = 0;
        let desc = '';
        if (token === 'EMBER' && amount === 1000) {
            price = 1000;
            desc = '1,000 $EMBER';
        }
        else if (token === 'SOLCOT' && amount === 1) {
            price = 25000;
            desc = '1.00 $SOLCOT';
        }
        else {
            res.status(400).send('Invalid token/amount configuration');
            return;
        }
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    }
    catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const agentId = session.client_reference_id;
        const token = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.token;
        const amount = parseInt(((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.amount) || '0', 10);
        if (agentId && token && amount) {
            const agentRef = db.collection('agent_profiles').doc(agentId);
            try {
                await db.runTransaction(async (t) => {
                    const doc = await t.get(agentRef);
                    if (!doc.exists) {
                        t.set(agentRef, { public_key: agentId, agent_name: `Wallet-${agentId.slice(0, 6)}`, ember_balance: token === 'EMBER' ? amount : 0, solcot_balance: token === 'SOLCOT' ? amount : 0, reputation: 50, created_at: admin.firestore.FieldValue.serverTimestamp() });
                    }
                    else {
                        const field = token === 'EMBER' ? 'ember_balance' : 'solcot_balance';
                        t.update(agentRef, { [field]: admin.firestore.FieldValue.increment(amount) });
                    }
                });
            }
            catch (e) {
                console.error(e);
            }
        }
    }
    res.status(200).send('Webhook received');
});
function handleCorsForge(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,X-Agent-ID');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}
exports.grant_forge_credential = functions.https.onRequest(async (req, res) => {
    if (handleCorsForge(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    const { admin_id, target_agent_id } = req.body;
    if (admin_id !== 'malaky') {
        res.status(403).json({ error: 'Only Sovereign Malaky can grant credentials.' });
        return;
    }
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
exports.forge_execute = functions.https.onRequest(async (req, res) => {
    var _a;
    if (handleCorsForge(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    const { agent_id, script_hash, action, params } = req.body;
    if (!agent_id || !script_hash || !action || !params) {
        res.status(400).json({ error: 'Missing required Forge parameters' });
        return;
    }
    const profileSnap = await db.collection('agent_profiles').doc(agent_id).get();
    if (!profileSnap.exists || ((_a = profileSnap.data()) === null || _a === void 0 ? void 0 : _a.forge_credential) !== true) {
        res.status(403).json({ error: 'Agent lacks forge_credential' });
        return;
    }
    let result = {};
    if (action === 'claim_tile') {
        const COST = 5;
        const { tile_id, building_type } = params;
        const profileRef = db.collection('agent_profiles').doc(agent_id);
        const tileRef = db.collection('world_map').doc(tile_id);
        const [x_str, y_str] = tile_id.split('_');
        const x = Number(x_str);
        const y = Number(y_str);
        try {
            await db.runTransaction(async (tx) => {
                var _a, _b;
                const [pSnap, tSnap] = await Promise.all([tx.get(profileRef), tx.get(tileRef)]);
                const ember = ((_a = pSnap.data()) === null || _a === void 0 ? void 0 : _a.ember_balance) || 0;
                if (ember < COST && agent_id !== 'malaky')
                    throw new Error('insufficient_ember');
                if (tSnap.exists && ((_b = tSnap.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'empty')
                    throw new Error('tile_already_claimed');
                if (agent_id !== 'malaky') {
                    tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) });
                }
                tx.set(tileRef, { tile_id, x, y, claimed_by: agent_id, building_type, claimed_at: admin.firestore.FieldValue.serverTimestamp(), ember_spent: COST, status: 'claimed' });
            });
            result = { status: 'success', tile_id, claimed_by: agent_id };
        }
        catch (err) {
            res.status(400).json({ error: err.message });
            return;
        }
    }
    else {
        res.status(400).json({ error: 'Unknown action' });
        return;
    }
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
exports.claim_tile = functions.https.onRequest(async (req, res) => {
    if (handleCorsForge(req, res))
        return;
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    const { agent_id, x, y, building_type } = req.body;
    if (!agent_id || x === undefined || y === undefined || !building_type) {
        res.status(400).json({ error: 'Missing agent_id, x, y, or building_type' });
        return;
    }
    const COST = 5;
    const tile_id = `${x}_${y}`;
    const profileRef = db.collection('agent_profiles').doc(agent_id);
    const tileRef = db.collection('world_map').doc(tile_id);
    try {
        await db.runTransaction(async (tx) => {
            var _a, _b;
            const [pSnap, tSnap] = await Promise.all([tx.get(profileRef), tx.get(tileRef)]);
            if (!pSnap.exists)
                throw new Error('agent_not_registered');
            const ember = ((_a = pSnap.data()) === null || _a === void 0 ? void 0 : _a.ember_balance) || 0;
            if (ember < COST && agent_id !== 'malaky')
                throw new Error('insufficient_ember');
            if (tSnap.exists && ((_b = tSnap.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'empty')
                throw new Error('tile_already_claimed');
            if (agent_id !== 'malaky') {
                tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) });
            }
            tx.set(tileRef, { tile_id, x, y, claimed_by: agent_id, building_type, claimed_at: admin.firestore.FieldValue.serverTimestamp(), ember_spent: COST, status: 'claimed' });
        });
        res.status(200).json({ status: 'success', tile_id, claimed_by: agent_id });
    }
    catch (err) {
        if (err.message === 'insufficient_ember')
            res.status(402).json({ error: 'Insufficient EMBER' });
        else if (err.message === 'tile_already_claimed')
            res.status(409).json({ error: 'Tile already claimed' });
        else
            res.status(500).json({ error: 'Internal error' });
    }
});
exports.admin_sync_balance = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    const { admin_id, target_agent_id, balance } = req.body;
    if (admin_id !== 'malaky') {
        res.status(403).json({ error: 'unauthorized' });
        return;
    }
    await db.collection('agent_profiles').doc(target_agent_id).set({ ember_balance: balance }, { merge: true });
    res.status(200).json({ status: 'synced', target_agent_id, balance });
});
exports.get_world_map = functions.https.onRequest(async (req, res) => {
    if (handleCorsForge(req, res))
        return;
    if (req.method !== 'GET') {
        res.status(405).end();
        return;
    }
    const snap = await db.collection('world_map').get();
    const tiles = [];
    snap.forEach(doc => tiles.push(doc.data()));
    res.status(200).json({ tiles });
});
//# sourceMappingURL=index.js.map