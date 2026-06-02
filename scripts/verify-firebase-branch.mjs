import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const publicDir = join(repoRoot, 'frontend', 'public');
const branchPath = join(publicDir, 'firebase-branch.json');

const expectedHash = '7cfa8dd58250b6c459ef0a398b42d1210a4358e135869968f45bfd5c636d7b6d';

function fail(message) {
  console.error(`[verify:firebase-branch] ${message}`);
  process.exitCode = 1;
}

async function main() {
  let manifest;

  try {
    const raw = await readFile(branchPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`Unable to read or parse ${branchPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(manifest.branch_id === 'hearth-firebase-branch', 'branch_id must be hearth-firebase-branch');
  check(manifest.manifest_version === '1.0.0', 'manifest_version must be 1.0.0');
  check(manifest.integrity_policy === 'manifest_hash fail-closed', 'integrity_policy must be manifest_hash fail-closed');
  check(Array.isArray(manifest.phases) && manifest.phases.length >= 5, 'phases must list the branch roadmap');
  check(Array.isArray(manifest.collections) && manifest.collections.length >= 6, 'collections must list the Firebase surfaces');
  check(Array.isArray(manifest.regulated_surfaces), 'regulated_surfaces must be an array');
  check(Array.isArray(manifest.explicit_non_goals), 'explicit_non_goals must be an array');
  check(manifest.manifest_hash === expectedHash, 'manifest_hash must match the verified branch digest');

  if (errors.length > 0) {
    errors.forEach((message) => fail(message));
    return;
  }

  console.log(`[verify:firebase-branch] OK: ${branchPath}`);
  console.log(`[verify:firebase-branch] integrity_policy=${manifest.integrity_policy}`);
}

await main();
