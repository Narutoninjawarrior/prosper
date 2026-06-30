import { Actor } from 'apify';

await Actor.init();
const input = await Actor.getInput<{ api_key: string, agent_id: string, action_type: string, input_hash: string, output_hash: string, metadata?: any }>();

if (!input || !input.api_key || !input.agent_id) {
    throw new Error('Missing required input fields.');
}

const res = await fetch('https://fellowship-of-the-hearth.web.app/api/witness/record', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${input.api_key}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        agent_id: input.agent_id,
        action_type: input.action_type,
        input_hash: input.input_hash,
        output_hash: input.output_hash,
        metadata: input.metadata
    })
});

const result = await res.json();
await Actor.charge({ eventName: 'witness-record', count: 1 });
await Actor.pushData(result);
await Actor.exit();
