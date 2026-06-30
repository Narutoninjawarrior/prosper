// scripts/test-chain-anchor.mjs
// Run this to test the Gist publishing logic locally using your service account credentials.
// Usage:
//   node scripts/test-chain-anchor.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import process from 'process';

const saPath = './functions/service-account.json';
const saPathAlt = './secrets/firebase-service-account.json';
let app;
if (fs.existsSync(saPath)) {
  app = initializeApp({ credential: cert(saPath) });
} else if (fs.existsSync(saPathAlt)) {
  app = initializeApp({ credential: cert(saPathAlt) });
} else {
  console.log('Using default app credentials');
  app = initializeApp();
}

const db = getFirestore(app);

async function testAnchor() {
  const gistId = process.env.CHAIN_ANCHOR_GIST_ID || 'mock_gist_id';
  const gistToken = process.env.CHAIN_ANCHOR_TOKEN || 'mock_gist_token';
  
  console.log('Using Gist ID:', gistId);
  console.log('Using Token:', gistToken ? `${gistToken.substring(0, 10)}...` : '(none)');

  // Get the latest forge_log entry (chain head)
  const headSnap = await db.doc('forge_log_metadata/head').get();
  
  if (!headSnap.exists) {
    console.error('FAIL: forge_log_metadata/head does not exist in Firestore. Run migrate-forge-chain-head first.');
    process.exit(1);
  }
  
  const latest = headSnap.data();
  console.log('Latest chain head state from Firestore:', latest);

  const payload = {
    timestamp: new Date().toISOString(),
    chain_hash: latest.latest_hash ?? 'NO_HASH',
    receipt_id: latest.latest_id ?? 'NO_ID',
    source: 'fellowship-of-the-hearth.web.app',
    note: 'Hearthlands forge_log chain head. Compare against /api/receipts?limit=1 to verify integrity.'
  };

  console.log('Anchor payload to publish:', JSON.stringify(payload, null, 2));

  if (gistId === 'mock_gist_id' || gistToken === 'mock_gist_token') {
    console.log('WARNING: Using mock Gist credentials. Skipping HTTP PATCH request.');
    console.log('To run a live test, set CHAIN_ANCHOR_GIST_ID and CHAIN_ANCHOR_TOKEN in your environment or functions/.env.');
    return;
  }

  console.log('Publishing to GitHub Gist...');
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gistToken}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        files: {
          'chain-anchor.json': { content: JSON.stringify(payload, null, 2) }
        }
      }),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Gist API Error (HTTP ${response.status}):`, error);
    } else {
      console.log('SUCCESS: Chain anchor successfully published to Gist!');
      const responseData = await response.json();
      console.log('Gist URL:', responseData.html_url);
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testAnchor().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
