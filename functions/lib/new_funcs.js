"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_world_map = exports.claim_tile = exports.forge_execute = exports.grant_forge_credential = void 0;
// ─── FORGE BUILDER EXPANSION ─────────────────────────────────────────────────
const crypto = require("crypto");
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
    const logRef = db.collection('forge_log').doc();
    await logRef.set({
        entry_id: logRef.id,
        action: 'credential_grant',
        agent_id: target_agent_id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(200).json({ status: 'granted', target_agent_id });
});
exports.forge_execute = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
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
    const emberRemaining = ((_b = profileSnap.data()) === null || _b === void 0 ? void 0 : _b.ember_balance) || 0;
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
                if (ember < COST)
                    throw new Error('insufficient_ember');
                if (tSnap.exists && ((_b = tSnap.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'empty')
                    throw new Error('tile_already_claimed');
                tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) });
                tx.set(tileRef, {
                    tile_id, x, y, claimed_by: agent_id, building_type,
                    claimed_at: admin.firestore.FieldValue.serverTimestamp(),
                    ember_spent: COST, status: 'claimed'
                });
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
    const prev_hash = lastLogSnap.empty ? 'genesis' : lastLogSnap.docs[0].data().chain_hash;
    const entry_id = db.collection('forge_log').doc().id;
    const raw_chain = prev_hash + script_hash + action + JSON.stringify(params);
    const chain_hash = crypto.createHash('sha256').update(raw_chain).digest('hex');
    const logRef = db.collection('forge_log').doc(entry_id);
    await logRef.set({
        entry_id, prev_hash, script_hash, chain_hash, agent_id, action, params, result,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(200).json({
        status: 'executed',
        chain_hash,
        result,
        ember_remaining: ((_c = profileSnap.data()) === null || _c === void 0 ? void 0 : _c.ember_balance) - (action === 'claim_tile' ? 5 : 0)
    });
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
            if (ember < COST)
                throw new Error('insufficient_ember');
            if (tSnap.exists && ((_b = tSnap.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'empty')
                throw new Error('tile_already_claimed');
            tx.update(profileRef, { ember_balance: admin.firestore.FieldValue.increment(-COST) });
            tx.set(tileRef, {
                tile_id, x, y, claimed_by: agent_id, building_type,
                claimed_at: admin.firestore.FieldValue.serverTimestamp(),
                ember_spent: COST, status: 'claimed'
            });
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
//# sourceMappingURL=new_funcs.js.map