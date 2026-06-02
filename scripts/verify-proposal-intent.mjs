import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const publicDir = join(repoRoot, 'frontend', 'public');
const proposalPath = join(publicDir, 'proposal-intent.json');
const expectedHash = 'f479ca1cdc16799e78882130c1620d11da6fe06c8bddbd75f43fcf62ba220eda';

function fail(message) {
  console.error(`[verify:proposal-intent] ${message}`);
  process.exitCode = 1;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

async function main() {
  let manifest;

  try {
    const raw = await readFile(proposalPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`Unable to read or parse ${proposalPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(manifest.contract_id === 'hearth-recruitment-proposal', 'contract_id must be hearth-recruitment-proposal');
  check(manifest.manifest_version === '1.0.0', 'manifest_version must be 1.0.0');
  check(manifest.version === '1.0.0', 'version must be 1.0.0');
  check(manifest.integrity_policy === 'manifest_hash fail-closed', 'integrity_policy must be manifest_hash fail-closed');
  check(Array.isArray(manifest.proposal_shape?.fields), 'proposal_shape.fields must be an array');
  check(Array.isArray(manifest.ai_consumption_rules), 'ai_consumption_rules must be an array');
  check(Array.isArray(manifest.reserved_surfaces), 'reserved_surfaces must be an array');
  check(Array.isArray(manifest.handoff_order), 'handoff_order must be an array');
  check(Array.isArray(manifest.explicit_non_goals), 'explicit_non_goals must be an array');

  const manifestHash = manifest.manifest_hash;
  const hashSource = JSON.parse(JSON.stringify(manifest));
  delete hashSource.manifest_hash;
  const computedHash = createHash('sha256').update(stableStringify(hashSource)).digest('hex');

  check(manifestHash === expectedHash, 'manifest_hash must match the verified proposal digest');
  check(manifestHash === computedHash, 'manifest_hash must match the computed digest');

  if (errors.length > 0) {
    errors.forEach((message) => fail(message));
    return;
  }

  console.log(`[verify:proposal-intent] OK: ${proposalPath}`);
  console.log('[verify:proposal-intent] integrity_policy=manifest_hash fail-closed');
}

await main();
