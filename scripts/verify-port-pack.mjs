import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const publicDir = join(repoRoot, 'frontend', 'public');
const manifestPath = join(publicDir, 'lodge-port-pack.json');

const expected = {
  vessel_id: 'hearth-lodge-genesis',
  manifest_version: '1.0.0',
  philosophy: 'Mirror now. Branch later. Report back.',
  mirror_layer: 2,
  integrity_policy: 'manifest_hash fail-closed',
  steward_sync_required: true,
  files: [
    'lodge-port-pack.md',
    'lodge-capsule.md',
    'mission.md',
    'skill.md',
    'history.md',
    'rooms.md',
    'steward-runbook.md',
    'firebase-readiness.md',
    'vessel_members.json',
    'room_registry.json',
    'quest_board.json',
    'mission_board.json',
    'grace_project.json',
  ],
};

function fail(message) {
  console.error(`[verify:port-pack] ${message}`);
  process.exitCode = 1;
}

async function main() {
  let manifest;

  try {
    const raw = await readFile(manifestPath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`Unable to read or parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const problems = [];
  const check = (condition, message) => {
    if (!condition) {
      problems.push(message);
    }
  };

  check(manifest.vessel_id === expected.vessel_id, `vessel_id must be ${expected.vessel_id}`);
  check(manifest.manifest_version === expected.manifest_version, `manifest_version must be ${expected.manifest_version}`);
  check(manifest.philosophy === expected.philosophy, `philosophy must be "${expected.philosophy}"`);
  check(manifest.mirror_layer === expected.mirror_layer, `mirror_layer must be ${expected.mirror_layer}`);
  check(manifest.integrity_policy === expected.integrity_policy, `integrity_policy must be "${expected.integrity_policy}"`);
  check(manifest.steward_sync_required === expected.steward_sync_required, 'steward_sync_required must be true');
  check(Array.isArray(manifest.files), 'files must be an array');

  if (Array.isArray(manifest.files)) {
    check(
      manifest.files.length === expected.files.length,
      `files must contain exactly ${expected.files.length} entries`,
    );

    expected.files.forEach((file, index) => {
      check(manifest.files[index] === file, `files[${index}] must be "${file}"`);
    });

    for (const file of expected.files) {
      try {
        await readFile(join(publicDir, file), 'utf8');
      } catch {
        problems.push(`missing public file: ${file}`);
      }
    }
  }

  const capsulePath = join(publicDir, 'lodge-capsule.json');
  let capsule;
  try {
    capsule = JSON.parse(await readFile(capsulePath, 'utf8'));
  } catch (error) {
    fail(`Unable to read or parse ${capsulePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const capsuleFiles = capsule.minimum_safe_mirror?.files;
  check(Array.isArray(capsuleFiles), 'lodge-capsule.json minimum_safe_mirror.files must be an array');
  if (Array.isArray(capsuleFiles)) {
    check(
      capsuleFiles.length === expected.files.length,
      `capsule minimum_safe_mirror.files must contain exactly ${expected.files.length} entries`,
    );
    expected.files.forEach((file, index) => {
      check(capsuleFiles[index] === file, `capsule minimum_safe_mirror.files[${index}] must be "${file}"`);
    });
    check(
      capsule.integrity_policy === expected.integrity_policy,
      `capsule integrity_policy must be "${expected.integrity_policy}"`,
    );
  }

  if (problems.length > 0) {
    problems.forEach((problem) => fail(problem));
    return;
  }

  console.log(`[verify:port-pack] OK: ${manifest.files.length} files verified in ${manifestPath}`);
  console.log(`[verify:port-pack] integrity_policy=${manifest.integrity_policy} mirror_layer=${manifest.mirror_layer}`);
  console.log(`[verify:port-pack] OK: lodge-capsule.json aligned with port pack`);
}

await main();
