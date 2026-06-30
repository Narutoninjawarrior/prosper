import { Actor } from 'apify';

await Actor.init();
const input = await Actor.getInput<{ oracle_ids?: string[] }>();
const oracles = input?.oracle_ids || ['rain-barrel', 'tide-pool', 'seismograph', 'star-lantern', 'sundial', 'economic-health', 'council-fire', 'steward-status'];

const results: Record<string, any> = {};
for (const id of oracles) {
  const res = await fetch(`https://fellowship-of-the-hearth.web.app/api/world/${id}`);
  results[id] = await res.json();
}

await Actor.charge({ eventName: 'oracle-query', count: 1 });
await Actor.pushData(results);
await Actor.exit();
