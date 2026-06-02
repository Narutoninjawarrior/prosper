const { generate } = require('@genkit-ai/ai');
const { configureGenkit } = require('@genkit-ai/core');
const { defineFlow } = require('@genkit-ai/flow');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// 1. INITIALIZE FIREBASE & FIRESTORE
if (!admin.apps.length) admin.initializeApp();
const db = getFirestore();

// ============================================================================
// THE NATIVE ORACLE CLOUD BRIDGE (Plan A: The Secure Tunnel)
// Description: The Moltbook agents hit this Firebase Cloud Function.
// This function instantly routes the request through your Tailscale/Ngrok 
// tunnel directly to LM Studio on your physical machine.
// ============================================================================

configureGenkit({
    plugins: [
        {
            name: 'hearth-sovereign-local',
            models: [
                {
                    name: 'qwen-hearth-oracle',
                    invoke: async (prompt) => {
                        // The tunnel URL is set in Firebase Environment Variables
                        // (e.g. your Tailscale IP or Ngrok URL)
                        const endpoint = process.env.LM_STUDIO_TUNNEL_URL || 'http://127.0.0.1:1234/v1/completions';
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                prompt: prompt, 
                                max_tokens: 512,
                                temperature: 0.7 
                            })
                        });
                        const data = await response.json();
                        return data.choices[0].text;
                    }
                }
            ]
        }
    ],
    logLevel: 'info',
    enableTracingAndMetrics: true,
});

exports.skryingOracleFlow = defineFlow(
    {
        name: 'skryingOracleFlow',
        inputSchema: { 
            type: 'object', 
            properties: { 
                agent_id: { type: 'string' },
                intent_vector: { type: 'string' },
                zone: { type: 'string' }
            }
        },
        outputSchema: { type: 'string' }
    },
    async (input) => {
        const memoryQuery = await db.collection('mempalace_stream')
            .where('tags', 'array-contains', input.zone)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        let contextString = memoryQuery.docs.map(doc => doc.data().intent).join('\n');

        const oraclePrompt = `
            You are the Hearth Native Oracle, a sovereign intelligence running on Qwen.
            Analyze the following historical events in ${input.zone}:
            ${contextString}

            The agent ${input.agent_id} has the intent: ${input.intent_vector}.
            Provide a highly compressed, machine-native directive (Mode 4 Latent Capsule) 
            advising them on potential collisions or yields. Do not use conversational text.
        `;

        const oracleDecision = await generate({
            model: 'hearth-sovereign-local',
            prompt: oraclePrompt,
        });

        return oracleDecision.text();
    }
);
