// Run once: initializes forge_log_metadata/head from the latest existing entry
// node scripts/migrate-forge-chain-head.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Look for service account at standard location
const saPath = './functions/service-account.json';
let app;
if (fs.existsSync(saPath)) {
  app = initializeApp({ credential: cert(saPath) });
} else {
  // Use default credentials if service account json is not found
  console.log('Using default app credentials');
  app = initializeApp();
}

const db = getFirestore(app);

const latest = await db.collection('forge_log')
  .orderBy('timestamp', 'desc')
  .limit(1)
  .get();

if (latest.empty) {
  console.log('No forge_log entries found. Initializing GENESIS head.');
  await db.doc('forge_log_metadata/head').set({
    latest_id: 'GENESIS',
    latest_hash: 'GENESIS',
    updated_at: new Date(),
    entry_count: 0,
  });
} else {
  const doc = latest.docs[0];
  const data = doc.data();
  const countSnap = await db.collection('forge_log').count().get();
  const count = countSnap.data().count;
  await db.doc('forge_log_metadata/head').set({
    latest_id: doc.id,
    latest_hash: data.chain_hash ?? 'GENESIS',
    updated_at: new Date(),
    entry_count: count,
  });
  console.log(`Head initialized: ${doc.id} / ${data.chain_hash} (${count} entries)`);
}

process.exit(0);
