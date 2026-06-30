import { Actor } from 'apify';

await Actor.init();
const input = await Actor.getInput<{ task_type?: string }>();

const res = await fetch('https://fellowship-of-the-hearth.web.app/api/forge/inspire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: input?.task_type || 'creative' })
});

const result = await res.json();
await Actor.charge({ eventName: 'inspire-packet', count: 1 });
await Actor.pushData(result);
await Actor.exit();
