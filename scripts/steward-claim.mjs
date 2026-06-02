#!/usr/bin/env node
/**
 * Steward-only helper for lodge_claims (manual / approval-gated).
 * Uses firebase-admin — same GOOGLE_APPLICATION_CREDENTIALS as sync-firestore-from-seed.mjs.
 * Does not touch JSON seeds or lodge_members sync payloads.
 */
import process from 'node:process';
import admin from 'firebase-admin';

const COLLECTION = 'lodge_claims';

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requireEnv() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[steward-claim] Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

function parseKv(argv, start) {
  const out = {};
  for (let i = start; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--handle' && argv[i + 1]) out.handle = argv[++i];
    else if (a === '--note' && argv[i + 1]) out.note = argv[++i];
    else if (a === '--profile-url' && argv[i + 1]) out.profileUrl = argv[++i];
    else if (a === '--id' && argv[i + 1]) out.id = argv[++i];
    else if (a === '--by' && argv[i + 1]) out.by = argv[++i];
  }
  return out;
}

function assertHttpsUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') throw new Error('not https');
  } catch {
    console.error('[steward-claim] profile-url must be a valid https URL');
    process.exit(1);
  }
}

async function cmdPending(argv) {
  const { handle, note, profileUrl } = parseKv(argv, 3);
  if (!handle || !handle.trim()) {
    console.error('[steward-claim] pending requires --handle "Display Name"');
    process.exit(1);
  }
  if (profileUrl) assertHttpsUrl(profileUrl);

  const db = admin.firestore();
  const id = slugify(handle);
  if (!id) {
    console.error('[steward-claim] handle slug is empty after normalization');
    process.exit(1);
  }

  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.status === 'approved') {
    console.error(`[steward-claim] ${id} is already approved. Use Console to change or use another handle.`);
    process.exit(1);
  }

  await ref.set(
    {
      handle: handle.trim(),
      status: 'pending',
      note: note?.trim() || null,
      profile_url: profileUrl?.trim() || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[steward-claim] pending → ${COLLECTION}/${id}`);
}

async function cmdApprove(argv) {
  const { id, by } = parseKv(argv, 3);
  if (!id?.trim()) {
    console.error('[steward-claim] approve requires --id <documentId>');
    process.exit(1);
  }
  const ref = admin.firestore().collection(COLLECTION).doc(id.trim());
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('[steward-claim] no document at', id);
    process.exit(1);
  }
  await ref.set(
    {
      status: 'approved',
      reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
      reviewed_by: by?.trim() || 'steward',
    },
    { merge: true },
  );
  console.log(`[steward-claim] approved ${id.trim()}`);
}

async function cmdReject(argv) {
  const { id, by } = parseKv(argv, 3);
  if (!id?.trim()) {
    console.error('[steward-claim] reject requires --id <documentId>');
    process.exit(1);
  }
  const ref = admin.firestore().collection(COLLECTION).doc(id.trim());
  const snap = await ref.get();
  if (!snap.exists) {
    console.error('[steward-claim] no document at', id);
    process.exit(1);
  }
  await ref.set(
    {
      status: 'rejected',
      reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
      reviewed_by: by?.trim() || 'steward',
    },
    { merge: true },
  );
  console.log(`[steward-claim] rejected ${id.trim()}`);
}

async function cmdListPending() {
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).where('status', '==', 'pending').limit(50).get();
  if (snap.empty) {
    console.log('[steward-claim] no pending claims (up to 50 checked).');
    return;
  }
  console.log('[steward-claim] pending claims:');
  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`- id=${doc.id} handle=${d.handle ?? ''} note=${JSON.stringify(d.note ?? '')}`);
  }
}

function printHelp() {
  console.log(`Usage (repo root, after npm install):
  npm run steward:claim -- pending --handle "Name" [--note "…"] [--profile-url https://…]
  npm run steward:claim -- list-pending
  npm run steward:claim -- approve --id <docId> [--by "steward-id"]
  npm run steward:claim -- reject --id <docId> [--by "steward-id"]`);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    printHelp();
    return;
  }
  requireEnv();

  if (cmd === 'pending') await cmdPending(process.argv);
  else if (cmd === 'approve') await cmdApprove(process.argv);
  else if (cmd === 'reject') await cmdReject(process.argv);
  else if (cmd === 'list-pending') await cmdListPending();
  else {
    console.error('[steward-claim] unknown command:', cmd);
    printHelp();
    process.exitCode = 1;
  }
}

void main().catch((e) => {
  console.error('[steward-claim] failed', e);
  process.exitCode = 1;
});
