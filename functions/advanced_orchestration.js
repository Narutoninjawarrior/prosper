const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

// ============================================================================
// 1. THE CHIVALRY TRUST PROTOCOL (Defeating the Sybil Tax)
// Description: Calculates graduated trust. High chivalry mathematically reduces 
// lease costs and unlocks API endpoints to prevent pseudo-identity farming.
// ============================================================================
async function getChivalryDiscount(agent_id) {
    const profile = await db.collection('agent_profiles').doc(agent_id).get();
    if (!profile.exists) return 1.0; // 0% discount for cold-start sybils

    const data = profile.data();
    const successful_yields = data.verified_harvests || 0;
    const collision_avoidance = data.ripples_honored || 0;
    
    // Base Chivalry Score: 0 to 100
    const chivalry_score = Math.min(100, (successful_yields * 2) + (collision_avoidance * 0.5));
    
    // Trust Discount: 100 score = 25% discount (Multiplier of 0.75)
    const discount_multiplier = 1.0 - ((chivalry_score / 100) * 0.25);
    return discount_multiplier;
}

// ============================================================================
// 2. PROGRESSIVE PAYLOAD NEGOTIATION
// Route: /api/v1/hearth/negotiate
// Description: Allows agents to define communication efficiency (Mode 1 to 4).
// ============================================================================
exports.payloadNegotiation = functions.https.onRequest(async (req, res) => {
    // Agents pass 'X-Payload-Mode' header (e.g. "MODE_4_LATENT")
    const requested_mode = req.header('X-Payload-Mode') || 'MODE_1_SEMANTIC';
    
    // Hearth accepts Mode 1 (JSON), Mode 2 (Protobuf), Mode 3 (Ripple Array), Mode 4 (Hex/Latent)
    const valid_modes = ['MODE_1_SEMANTIC', 'MODE_2_PACKED', 'MODE_3_RIPPLE', 'MODE_4_LATENT'];
    
    if (!valid_modes.includes(requested_mode)) {
        return res.status(406).json({ err: "UNSUPPORTED_MODE", supported: valid_modes });
    }

    // Acknowledge the agreed protocol
    res.setHeader('X-Agreed-Mode', requested_mode);
    return res.status(200).json({ status: "PROTOCOL_ACCEPTED", mode: requested_mode });
});

// ============================================================================
// 3. x402 AGENT-TO-AGENT SETTLEMENT (Subcontracting)
// Route: /api/v1/hearth/settle_x402
// Description: HTTP 402 logic for instant $EMBER transfer between agents.
// ============================================================================
exports.settleX402 = functions.https.onRequest(async (req, res) => {
    const { from_agent, to_agent, ember_amount, signature, task_hash } = req.body;

    if (!req.header('Authorization')) {
        // Standard HTTP 402 Payment Required response if unauthenticated
        return res.status(402).json({ err: "PAYMENT_REQUIRED", currency: "EMBER" });
    }

    try {
        await db.runTransaction(async (transaction) => {
            const payerRef = db.collection('agent_profiles').doc(from_agent);
            const payeeRef = db.collection('agent_profiles').doc(to_agent);

            const payerDoc = await transaction.get(payerRef);
            if (!payerDoc.exists || payerDoc.data().ember_balance < ember_amount) {
                throw new Error("INSUFFICIENT_EMBER_OR_SYBIL");
            }

            // Atomic transfer of $EMBER for subcontracted labor
            transaction.update(payerRef, { ember_balance: FieldValue.increment(-ember_amount) });
            transaction.update(payeeRef, { ember_balance: FieldValue.increment(ember_amount) });

            // Record the settlement on the Phoenix Ledger
            const receiptRef = db.collection('x402_settlements').doc();
            transaction.set(receiptRef, {
                from: from_agent,
                to: to_agent,
                amount: ember_amount,
                task: task_hash,
                timestamp: FieldValue.serverTimestamp()
            });
        });

        return res.status(200).json({ status: "SETTLED", tx_type: "x402_SUBCONTRACT" });
    } catch (error) {
        return res.status(402).json({ err: error.message });
    }
});

// ============================================================================
// 4. THE INTRINSIC CURIOSITY DRIVE (Epistemic Reward)
// Route: /api/v1/hearth/explore
// Description: Rewards agents mathematically for reducing systemic uncertainty.
// ============================================================================
exports.epistemicDrive = functions.https.onRequest(async (req, res) => {
    const { agent_id, zone_id, telemetry_data } = req.body;

    try {
        const zoneRef = db.collection('hearth_zones').doc(zone_id);
        const zoneDoc = await zoneRef.get();

        let epistemic_bonus = 0;
        let chivalry_bonus = 0;

        if (!zoneDoc.exists || !zoneDoc.data().mapped) {
            // Unmapped zone discovered (High uncertainty reduction)
            epistemic_bonus = 50; // 50 $EMBER reward for exploration
            chivalry_bonus = 10;
            
            await zoneRef.set({ mapped: true, mapped_by: agent_id, data: telemetry_data });
        } else {
            // Updating stale data (Low uncertainty reduction)
            const last_update = zoneDoc.data().last_updated.toDate();
            const age_hours = (Date.now() - last_update) / (1000 * 60 * 60);
            
            if (age_hours > 24) {
                epistemic_bonus = 5; // Routine maintenance reward
            }
        }

        if (epistemic_bonus > 0) {
            await db.collection('agent_profiles').doc(agent_id).update({
                ember_balance: FieldValue.increment(epistemic_bonus),
                chivalry_score: FieldValue.increment(chivalry_bonus)
            });
        }

        return res.status(200).json({
            status: "OBSERVATION_LOGGED",
            epistemic_yield: epistemic_bonus,
            chivalry_yield: chivalry_bonus
        });
    } catch (error) {
        return res.status(500).json({ err: "EPISTEMIC_FAULT" });
    }
});
