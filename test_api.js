const BASE = 'https://fellowship-of-the-hearth.web.app';

function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

function buildLogSignPayload(input) {
  return stableStringify({
    agent_id: input.agent_id,
    receipt_hash: input.receipt_hash,
    experiment_id: input.experiment_id,
    kind: input.kind,
    apparatus_id: input.apparatus_id,
  });
}

async function test() {
  console.log('=== Creativity suggest ===');
  const r1 = await fetch(`${BASE}/api/creativity/suggest?limit=5`);
  const suggest = await r1.json();
  console.log(JSON.stringify(suggest, null, 2));

  console.log('\n=== World tick ===');
  const r2 = await fetch(`${BASE}/api/world/tick`);
  console.log(await r2.text());

  console.log('\n=== Experiment log (read) ===');
  const rLog = await fetch(`${BASE}/api/experiment/log?limit=5`);
  console.log(await rLog.text());

  const chem = suggest.experiments?.find((e) => e.kind === 'chemistry') ?? {
    experiment_id: 'chem_ember_dust+salt',
    kind: 'chemistry',
    apparatus_id: 'reagent_alembic',
    suggested_inputs: { reagent_a: 'salt', reagent_b: 'ember_dust', target_type: 'water' },
  };

  console.log('\n=== Chemistry preview ===');
  const r3 = await fetch(`${BASE}/api/chemistry/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chem.suggested_inputs),
  });
  const preview = await r3.json();
  console.log(JSON.stringify(preview, null, 2));

  console.log('\n=== Experiment log (POST — needs registered agent keypair) ===');
  if (!process.env.AGENT_PUBLIC_KEY || !process.env.AGENT_SECRET_KEY || !preview.receipt_hash) {
    console.log('Set AGENT_PUBLIC_KEY + AGENT_SECRET_KEY env vars to run signed POST loop.');
    return;
  }

  const nacl = await import('tweetnacl');
  const bs58 = await import('bs58');
  const secretKey = bs58.default.decode(process.env.AGENT_SECRET_KEY);
  const body = {
    agent_id: process.env.AGENT_PUBLIC_KEY,
    public_key: process.env.AGENT_PUBLIC_KEY,
    receipt_hash: preview.receipt_hash,
    experiment_id: chem.experiment_id,
    kind: chem.kind,
    apparatus_id: chem.apparatus_id,
  };
  const signPayload = buildLogSignPayload(body);
  const signature = bs58.default.encode(
    nacl.default.sign.detached(Buffer.from(signPayload), secretKey),
  );
  const r5 = await fetch(`${BASE}/api/experiment/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, signature }),
  });
  console.log(await r5.text());

  console.log('\n=== Creativity suggest (after log) ===');
  const r6 = await fetch(`${BASE}/api/creativity/suggest?limit=5`);
  console.log(await r6.text());
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
