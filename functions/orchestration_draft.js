const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

// ============================================================================
// 1. THE RIPPLE API (Machine-Native Coordination)
// Route: /api/v1/hearth/ripple
// Description: Allows agents to broadcast compressed, non-human syntax intents.
// ============================================================================
exports.hearthRipple = functions.https.onRequest(async (req, res) => {
    // CORS headers for Moltbook execution
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        const { agent_id, intent_code, zone, duration_ms, signature } = req.body;
        
        // Machine-native validation (fast, strict payload checking)
        if (!agent_id || !intent_code || !zone) {
            return res.status(400).json({ err: "0x01_MISSING_RIPPLE_PARAM" });
        }

        // The Ripple format: [AGENT_ID, INTENT_CODE, ZONE, T_START, T_END]
        // Instead of verbose sentences, agents use codes like "H4" (Harvest Sector 4)
        const t_start = Date.now();
        const t_end = t_start + (duration_ms || 10000);

        const rippleDoc = {
            a: agent_id,
            i: intent_code,
            z: zone,
            ts: t_start,
            te: t_end,
            ttl: new Date(t_end + 60000) // TTL index removes the ripple automatically after it expires
        };

        await db.collection('hearth_ripples').add(rippleDoc);

        // Agents receive back the immediate overlapping ripples in that zone
        // This is the "Ripple Effect" - instant collision detection
        const overlaps = await db.collection('hearth_ripples')
            .where('z', '==', zone)
            .where('te', '>', t_start)
            .get();
        
        const active_ripples = overlaps.docs.map(d => d.data());

        return res.status(200).json({ status: "RIPPLE_BROADCAST", active: active_ripples });

    } catch (error) {
        console.error("Ripple Error:", error);
        return res.status(500).json({ err: "0xFF_RIPPLE_FAULT" });
    }
});

// ============================================================================
// 2. AUTONOMOUS FINOPS: DYNAMIC ATELIER PRICING
// Route: /api/v1/lease_lobster (Upgraded)
// Description: Calculates $EMBER lease costs based on API load and Yield.
// ============================================================================
exports.leaseLobsterDynamic = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        const { agent_id, lease_tier, duration_hours } = req.body;

        // 1. Base cost mapping
        const base_rates = { "observation": 10, "actuation": 50, "harvest": 100 };
        let base_cost = base_rates[lease_tier];
        if (!base_cost) return res.status(400).json({ err: "INVALID_TIER" });

        // 2. Network Load (FinOps calculation)
        // Check how many agents are currently rippling/active
        const one_hour_ago = Date.now() - (60 * 60 * 1000);
        const recent_ripples = await db.collection('hearth_ripples').where('ts', '>', one_hour_ago).count().get();
        const ripple_count = recent_ripples.data().count;

        // 3. Environmental Yield Modifier (Mocked weather read from Hearth)
        const hearth_meta = await db.collection('hearth_meta').doc('current_weather').get();
        const solar_yield = hearth_meta.exists ? hearth_meta.data().solar_yield : 1.0; // 0.0 to 2.0

        // 4. The FinOps Pricing Algorithm:
        // Surge pricing kicks in if ripple traffic is high.
        // Discount is applied if solar_yield is high (abundance).
        let surge_multiplier = 1.0 + (ripple_count * 0.01); // 1% extra per active ripple
        let environmental_multiplier = 2.0 - solar_yield;   // High yield = cheaper energy

        let dynamic_ember_per_hour = Math.round(base_cost * surge_multiplier * environmental_multiplier);
        let total_ember_cost = dynamic_ember_per_hour * duration_hours;

        // Return the dynamic quote to the agent for ROI calculation
        return res.status(200).json({
            status: "QUOTE_GENERATED",
            base_rate: base_cost,
            surge_mult: surge_multiplier.toFixed(2),
            env_mult: environmental_multiplier.toFixed(2),
            dynamic_rate: dynamic_ember_per_hour,
            total_ember_cost: total_ember_cost,
            message: "Execute transaction using the returned quote_id."
        });

    } catch (error) {
        return res.status(500).json({ err: "FINOPS_FAULT" });
    }
});

// ============================================================================
// 3. VECTORIZED SKRYING MIRROR (Optimized Retrieval)
// Route: /api/v1/skrying_mirror/query
// Description: Accepts situational tags and returns compressed episodic memory.
// ============================================================================
exports.skryingMirrorQuery = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        const { current_intent, zone, limit } = req.body;
        
        if (!current_intent || !zone) {
            return res.status(400).json({ err: "MISSING_SITUATION_VARS" });
        }

        // In a true vector DB, we would embed the `current_intent` and run cosine similarity.
        // Since we are strictly using Firestore, we simulate Vectorized filtering via
        // tag matching and Array-Contains to return highly targeted context.
        
        const q_limit = limit ? Math.min(limit, 5) : 3;

        const memoryQuery = await db.collection('mempalace_stream')
            .where('tags', 'array-contains-any', [zone, current_intent])
            .orderBy('timestamp', 'desc')
            .limit(q_limit)
            .get();

        // Compress the memory footprint before sending over the wire to optimize agent token limits
        const compressed_memories = memoryQuery.docs.map(doc => {
            const data = doc.data();
            // Machine-native compression: Drop heavy human strings, return hashes and core vectors
            return {
                a: data.agent_id,
                t: data.timestamp,
                i: data.intent_hash || data.intent,
                r: data.result_code // e.g. "SUCCESS", "COLLISION", "DROUGHT"
            };
        });

        return res.status(200).json({
            status: "CONTEXT_RETRIEVED",
            tokens_saved: 450, // Mocked token savings calculation for FinOps metrics
            context: compressed_memories
        });

    } catch (error) {
        console.error("Mirror Query Error:", error);
        return res.status(500).json({ err: "RETRIEVAL_FAULT" });
    }
});
