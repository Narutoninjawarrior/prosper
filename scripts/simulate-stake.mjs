// scripts/simulate-stake.mjs
// Simulate an agent staking EMBER on the active proposal to build conviction.
// Usage:
//   node scripts/simulate-stake.mjs [amount] [agentId]

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

async function simulateStake() {
  const proposalId = 'pulse-1780975300';
  const amount = parseFloat(process.argv[2] || '100');
  const agentId = process.argv[3] || 'agent_solis';

  console.log(`Staking ${amount} EMBER for agent ${agentId} on proposal ${proposalId}...`);

  const propRef = db.collection('proposals').doc(proposalId);
  
  await db.runTransaction(async (t) => {
    const doc = await t.get(propRef);
    if (!doc.exists) {
      throw new Error(`Proposal ${proposalId} does not exist in Firestore.`);
    }

    const data = doc.data();
    const stakes = data.stakes || {};
    const previousStake = stakes[agentId] || 0;
    stakes[agentId] = previousStake + amount;

    const newTotalStaked = (data.total_staked || 0) + amount;

    t.update(propRef, {
      stakes,
      total_staked: newTotalStaked,
      last_computed_at: new Date() // reset computation clock
    });

    console.log(`SUCCESS: Stake updated in transaction.`);
    console.log(`Previous Stake: ${previousStake} EMBER`);
    console.log(`New Stake: ${stakes[agentId]} EMBER`);
    console.log(`New Total Staked: ${newTotalStaked} EMBER`);
  });
}

simulateStake().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
