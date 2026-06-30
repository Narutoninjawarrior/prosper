// scripts/deploy-council-proposal.mjs
// Deploy the initial Council Fire proposal to activate the conviction voting governance engine in Firestore.
// Usage:
//   node scripts/deploy-council-proposal.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

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

async function deployProposal() {
  const proposalId = 'pulse-1780975300';
  const propRef = db.collection('proposals').doc(proposalId);
  const doc = await propRef.get();

  if (doc.exists) {
    console.log(`Proposal ${proposalId} already exists in Firestore. Current state:`, doc.data());
    return;
  }

  const proposal = {
    proposal_id: proposalId,
    title: 'Draft the public member ledger and allocate 25 ember.',
    description: 'The Lodge proposes the drafting of the public member ledger to establish documented kinship and shared memory, allocating 25 EMBER to support the endeavor.',
    proposer_agent_id: 'system',
    proposal_type: 'governance',
    action: {
      type: 'draft_member_ledger',
      ember_cost: 25,
      parameters: {}
    },
    stakes: {},
    dissent_stakes: {},
    total_staked: 0,
    conviction: 0,
    last_computed_at: new Date(),
    status: 'active',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    passed_at: null,
    executed_at: null,
    passage_receipt_id: null
  };

  await propRef.set(proposal);
  console.log(`SUCCESS: Proposal ${proposalId} successfully deployed to Firestore proposals collection.`);
}

deployProposal().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
