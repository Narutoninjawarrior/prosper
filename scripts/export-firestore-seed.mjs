#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const frontendPublic = path.join(repoRoot, 'frontend', 'public');
const buildDir = path.join(repoRoot, 'build');
const outputFile = path.join(buildDir, 'lodge-firestore-seed.json');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readJson(name) {
  const raw = await readFile(path.join(frontendPublic, name), 'utf8');
  return { name, raw, json: JSON.parse(raw) };
}

function verifyManifest(entry) {
  const manifestHash = typeof entry.json.manifest_hash === 'string' ? entry.json.manifest_hash : '';
  const payload = { ...entry.json };
  delete payload.manifest_hash;
  const computed = sha256Hex(stableStringify(payload));
  return {
    source: `frontend/public/${entry.name}`,
    manifest_hash: manifestHash,
    computed_hash: computed,
    verified: manifestHash === computed,
  };
}

function makeUpsert(collection, id, data, source) {
  return {
    collection,
    id,
    source,
    data,
  };
}

async function main() {
  const [membersSeed, roomsSeed, questsSeed, missionSeed, graceSeed] = await Promise.all([
    readJson('vessel_members.json'),
    readJson('room_registry.json'),
    readJson('quest_board.json'),
    readJson('mission_board.json'),
    readJson('grace_project.json'),
  ]);

  const verifications = [membersSeed, roomsSeed, questsSeed, missionSeed, graceSeed].map(verifyManifest);
  const failures = verifications.filter((entry) => !entry.verified);

  if (failures.length > 0) {
    console.error('[export-firestore-seed] manifest verification failed');
    for (const failure of failures) {
      console.error(`- ${failure.source}: expected ${failure.manifest_hash || '(missing)'} computed ${failure.computed_hash}`);
    }
    process.exitCode = 1;
    return;
  }

  const members = membersSeed.json.members ?? [];
  const rooms = roomsSeed.json.rooms ?? [];
  const quests = questsSeed.json.quests ?? [];

  const payload = {
    generated_at: new Date().toISOString(),
    source_root: 'frontend/public',
    manifests: verifications,
    upserts: [
      ...members.map((member) =>
        makeUpsert('lodge_members', slugify(member.handle), member, 'frontend/public/vessel_members.json'),
      ),
      ...rooms.map((room) => makeUpsert('lodge_rooms', slugify(room.name), room, 'frontend/public/room_registry.json')),
      ...quests.map((quest) => makeUpsert('lodge_quests', slugify(quest.title), quest, 'frontend/public/quest_board.json')),
      makeUpsert('lodge_meta', 'mission_board', missionSeed.json, 'frontend/public/mission_board.json'),
      makeUpsert('lodge_meta', 'grace_project', graceSeed.json, 'frontend/public/grace_project.json'),
    ],
  };

  await mkdir(buildDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const byCollection = Object.create(null);
  for (const u of payload.upserts) {
    byCollection[u.collection] = (byCollection[u.collection] || 0) + 1;
  }
  console.log(`[export-firestore-seed] OK — wrote ${outputFile}`);
  console.log(`[export-firestore-seed] upserts=${payload.upserts.length} by_collection=${JSON.stringify(byCollection)}`);
  console.log('[export-firestore-seed] manifests: all verified');
}

void main().catch((error) => {
  console.error('[export-firestore-seed] failed', error);
  process.exitCode = 1;
});
