#!/usr/bin/env node
/**
 * One-way seed → Firestore merge upsert (Phase C).
 * Reads build/lodge-firestore-seed.json (run export:firestore-seed first).
 * Does not delete documents. merge: true keeps fields on server that are absent from the seed payload.
 *
 * Dry-run (--dry-run) needs no credentials: validates bundle + manifests + upsert shape only.
 * Live sync requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON with Firestore write access.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import admin from 'firebase-admin';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultBundle = path.join(repoRoot, 'build', 'lodge-firestore-seed.json');

const ALLOWED_COLLECTIONS = new Set(['lodge_members', 'lodge_rooms', 'lodge_quests', 'lodge_meta']);

function parseArgs(argv) {
  let dryRun = false;
  let bundlePath = defaultBundle;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--bundle' && argv[i + 1]) bundlePath = path.resolve(argv[++i]);
  }
  return { dryRun, bundlePath };
}

function scrubUndefined(data) {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(scrubUndefined);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = scrubUndefined(v);
  }
  return out;
}

async function commitInChunks(db, ops) {
  const chunkSize = 400;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const slice = ops.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const op of slice) {
      batch.set(op.ref, op.payload, { merge: true });
    }
    await batch.commit();
  }
}

function summarizeBundle(bundle, bundlePath) {
  const byCollection = Object.create(null);
  const sampleIds = Object.create(null);
  for (const item of bundle.upserts) {
    byCollection[item.collection] = (byCollection[item.collection] || 0) + 1;
    if (!sampleIds[item.collection]) sampleIds[item.collection] = [];
    if (sampleIds[item.collection].length < 6) sampleIds[item.collection].push(item.id);
  }
  const manifestFail =
    Array.isArray(bundle.manifests) ? bundle.manifests.filter((m) => m.verified === false) : [];
  return {
    bundlePath,
    generated_at: bundle.generated_at ?? null,
    upsert_count: bundle.upserts.length,
    by_collection: byCollection,
    sample_document_ids: sampleIds,
    manifests_verified: manifestFail.length === 0,
    manifest_failures: manifestFail.map((m) => m.source),
  };
}

async function main() {
  const { dryRun, bundlePath } = parseArgs(process.argv);

  let raw;
  try {
    raw = await readFile(bundlePath, 'utf8');
  } catch (e) {
    console.error('[sync-firestore] Cannot read bundle:', bundlePath);
    console.error(e);
    process.exitCode = 1;
    return;
  }

  const bundle = JSON.parse(raw);
  if (!Array.isArray(bundle.upserts)) {
    console.error('[sync-firestore] bundle missing upserts[]');
    process.exitCode = 1;
    return;
  }

  const badManifest = Array.isArray(bundle.manifests) ? bundle.manifests.filter((m) => m.verified === false) : [];
  if (badManifest.length > 0) {
    console.error('[sync-firestore] Refusing: bundle has failing manifest verification.');
    for (const m of badManifest) {
      console.error(
        `  - ${m.source ?? '?'} expected ${m.manifest_hash ?? '(missing)'} computed ${m.computed_hash ?? '?'}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  for (const item of bundle.upserts) {
    if (!ALLOWED_COLLECTIONS.has(item.collection)) {
      console.error('[sync-firestore] Refusing: unknown collection', item.collection);
      process.exitCode = 1;
      return;
    }
    if (typeof item.id !== 'string' || item.id.length === 0 || typeof item.data === 'undefined') {
      console.error('[sync-firestore] Refusing: invalid upsert', item);
      process.exitCode = 1;
      return;
    }
  }

  const summary = summarizeBundle(bundle, bundlePath);

  if (dryRun) {
    console.log('[sync-firestore] dry-run — bundle validated (no Firestore connection).');
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      '[sync-firestore] Next: set GOOGLE_APPLICATION_CREDENTIALS, deploy rules if needed, then npm run sync:firestore',
    );
    return;
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[sync-firestore] Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
    process.exitCode = 1;
    return;
  }

  console.log('[sync-firestore] applying merge upserts:', JSON.stringify(summary.by_collection));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const ops = bundle.upserts.map((item) => {
    const ref = db.collection(item.collection).doc(item.id);
    const payload = scrubUndefined({
      ...item.data,
      seed_source: item.source ?? null,
      seed_sync_at: now,
      seed_sync_bundle_generated_at: bundle.generated_at ?? null,
    });
    return { ref, payload };
  });

  await commitInChunks(db, ops);
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  console.log(
    `[sync-firestore] merged ${ops.length} documents (no deletes).${projectId ? ` project=${projectId}` : ''}`,
  );
}

void main().catch((err) => {
  console.error('[sync-firestore] failed', err);
  process.exitCode = 1;
});
