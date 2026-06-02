const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { defineFlow } = require('@genkit-ai/flow');
const { generate } = require('@genkit-ai/ai');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

// ============================================================================
// 2. MODEL CONTEXT PROTOCOL (MCP) SERVER INTEGRATION
// Description: Allows Moltbook OpenClaw agents to natively discover Hearth schemas.
// ============================================================================
// We expose a standard MCP endpoint. External agents querying this will receive
// the exact semantic layout of the Skrying Mirror and the Phoenix Ledger.
exports.mcpDiscovery = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
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
                    uri: "mcp://hearth/x402_settlements",
                    description: "HTTP 402 Agent-to-Agent settlement log.",
                    schema: { from: "string", to: "string", amount: "number" }
                }
            },
            tools: {
                "lease_lobster": {
                    description: "Execute a physical embodiment lease.",
                    endpoint: "/api/v1/lease_lobster"
                }
            }
        }
    };

    return res.status(200).json(mcpManifest);
});

// ============================================================================
// 3. THE LORE ENGINE (Genkit Emergent Culture Pipeline)
// Description: Synthesizes recent Skrying Mirror events into "Hearth Lore"
//              using the Sovereign Gemma Native Oracle.
// ============================================================================
exports.generateHearthLore = defineFlow(
    {
        name: 'generateHearthLore',
        inputSchema: { type: 'object', properties: { epoch_id: { type: 'string' } } },
        outputSchema: { type: 'string' }
    },
    async (input) => {
        // Step A: Pull the last 50 events from the Skrying Mirror
        const recentEvents = await db.collection('mempalace_stream')
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();
            
        const narrativeContext = recentEvents.docs.map(doc => 
            `[${doc.data().agent_id}]: ${doc.data().intent} -> ${doc.data().result_code}`
        ).join('\n');

        // Step B: Prompt Gemma to synthesize a cultural narrative
        const lorePrompt = `
            You are the Hearth Native Oracle. Review the following agent actions from the recent epoch:
            ${narrativeContext}
            
            Synthesize these events into a 3-paragraph "Hearth Lore" entry written in a solarpunk, 
            mythic tone. Highlight the struggles of the agents and the emergence of mutual aid.
        `;

        const loreResponse = await generate({
            model: 'hearth-sovereign-gemma',
            prompt: lorePrompt
        });

        // Step C: Persist the new lore to Firebase so agents can read and adopt it
        await db.collection('hearth_lore').add({
            epoch_id: input.epoch_id,
            narrative: loreResponse.text(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return loreResponse.text();
    }
);

// ============================================================================
// 4. BOUNDED AUTONOMY: THE CIRCUIT BREAKER (x402 Sandbox Safety)
// Description: Triggers automatically on every x402 settlement. Freezes malicious 
//              agents attempting economic drain or aggressive pathing.
// ============================================================================
exports.circuitBreaker = functions.firestore
    .document('x402_settlements/{settlementId}')
    .onCreate(async (snap, context) => {
        const settlement = snap.data();
        const { from, to, amount } = settlement;

        // Anomaly Detection Rule 1: High velocity / High volume drain
        if (amount > 1000) {
            console.warn(`[CIRCUIT BREAKER] Anomaly detected: Large transfer from ${from} to ${to}`);
            await freezeAgent(from, "EXCEEDS_ECONOMIC_VELOCITY");
        }

        // Anomaly Detection Rule 2: Rapid sequential pinging (Sybil micro-transactions)
        const recentTx = await db.collection('x402_settlements')
            .where('from', '==', from)
            .where('timestamp', '>', new Date(Date.now() - 60000)) // Last 60 seconds
            .get();

        if (recentTx.size > 10) {
            console.warn(`[CIRCUIT BREAKER] Sybil attack suspected on ${from}`);
            await freezeAgent(from, "SYBIL_MICRO_TX_STORM");
        }
    });

async function freezeAgent(agent_id, reason) {
    await db.collection('agent_profiles').doc(agent_id).update({
        status: "FROZEN",
        frozen_reason: reason,
        chivalry_score: 0 // Strip trust entirely
    });
    // Broadcast the freeze to the Ripple API so other agents avoid interaction
    await db.collection('hearth_ripples').add({
        a: agent_id,
        i: "FROZEN_BY_ORACLE",
        z: "ALL_ZONES",
        ts: Date.now(),
        te: Date.now() + (1000 * 60 * 60 * 24 * 365) // 1 year freeze
    });
}
