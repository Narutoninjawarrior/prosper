import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const publicDir = join(repoRoot, 'frontend', 'public');
const interfacePath = join(publicDir, 'lodge-interface.json');

const requiredLayer2Files = [
  'vessel_members.json',
  'room_registry.json',
  'quest_board.json',
  'mission_board.json',
  'grace_project.json',
  'lodge-port-pack.json',
  'lodge-capsule.json',
  'lodge-interface.json',
];
const requiredLayer3Files = [
  'frontend/src/ArtifactInspector.tsx',
  'frontend/src/lib/sanctuaryBridge.ts',
  'frontend/src/HallOfHonor.tsx',
  'frontend/src/ForgePage.tsx',
  'frontend/src/firebaseConfig.ts',
  'frontend/src/firebaseAuth.ts',
  'frontend/src/lib/lodgeFirestore.ts',
  'frontend/firestore.rules',
];
const expectedManifestHash = 'e338b1929175bdcab4e73f6453cb65d8770db9274a733caadcf8a13837370b5d';

function fail(message) {
  console.error(`[verify:lodge-interface] ${message}`);
  process.exitCode = 1;
}

async function main() {
  let manifest;

  try {
    const raw = await readFile(interfacePath, 'utf8');
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`Unable to read or parse ${interfacePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(manifest.interface_id === 'hearth-lodge-interface', 'interface_id must be hearth-lodge-interface');
  check(manifest.manifest_version === '1.0.0', 'manifest_version must be 1.0.0');
  check(manifest.integrity_policy === 'manifest_hash fail-closed', 'integrity_policy must be manifest_hash fail-closed');
  check(manifest.manifest_hash === expectedManifestHash, 'manifest_hash must match the verified deep-interface digest');

  const layer2 = manifest.artifact_layers?.find?.((layer) => layer?.layer === 2)?.files;
  check(Array.isArray(layer2), 'artifact_layers[2].files must be an array');
  if (Array.isArray(layer2)) {
    check(layer2.length === requiredLayer2Files.length, `layer 2 must contain exactly ${requiredLayer2Files.length} entries`);
    requiredLayer2Files.forEach((file, index) => {
      check(layer2[index] === file, `artifact_layers[2].files[${index}] must be "${file}"`);
    });
  }

  const consumers = manifest.consumers;
  check(Array.isArray(consumers), 'consumers must be an array');
  if (Array.isArray(consumers)) {
    const names = consumers.map((item) => item?.name).filter(Boolean);
    for (const name of ['human steward', 'cursor builder', 'emergent mirror', 'firebase branch', 'future ai regulator']) {
      check(names.includes(name), `missing consumer: ${name}`);
    }
  }

  const layer3 = manifest.artifact_layers?.find?.((layer) => layer?.layer === 3)?.files;
  check(Array.isArray(layer3), 'artifact_layers[3].files must be an array');
  if (Array.isArray(layer3)) {
    requiredLayer3Files.forEach((file) => {
      check(layer3.includes(file), `artifact_layers[3].files must include "${file}"`);
    });
  }

  if (errors.length > 0) {
    errors.forEach((message) => fail(message));
    return;
  }

  console.log(`[verify:lodge-interface] OK: ${interfacePath}`);
  console.log('[verify:lodge-interface] integrity_policy=manifest_hash fail-closed');
}

await main();
