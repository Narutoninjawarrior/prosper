const fs = require('fs');
let code = fs.readFileSync('agentPassportApi.ts', 'utf8');

const trustFn = `
// ponytail: compute at read time — no new writes
async function computeTrustScore(agentId: string) {
  const snap = await db.collection('forge_log')
    .where('agent_id', '==', agentId)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    return { trust_score: 0.1, trust_tier: 'probationary', last_action_at: null, days_since_last_action: null };
  }

  const lastAction = snap.docs[0].data();
  const lastTimestamp = lastAction.timestamp?.toDate() ?? new Date(0);
  const daysSinceLastAction = (Date.now() - lastTimestamp.getTime()) / (1000 * 60 * 60 * 24);

  const lambda = 0.005; // half-life ~139 days — matches SkillFortify research
  const rawScore = Math.exp(-lambda * daysSinceLastAction);
  const trust_score = Math.max(0.1, Math.min(1.0, rawScore));

  let trust_tier = 'probationary';
  if (trust_score >= 0.85) trust_tier = 'active';
  else if (trust_score >= 0.65) trust_tier = 'trusted';
  else if (trust_score >= 0.40) trust_tier = 'fading';
  else if (trust_score >= 0.15) trust_tier = 'dormant';

  return { 
    trust_score: Number(trust_score.toFixed(4)), 
    trust_tier, 
    last_action_at: lastTimestamp.toISOString(), 
    days_since_last_action: Number(daysSinceLastAction.toFixed(2)) 
  };
}

`;

code = code.replace(
  'async function buildAgentPassport(agentId: string) {',
  trustFn + 'async function buildAgentPassport(agentId: string) {'
);

const fetchCallTarget = `    fetchSwarmTaskSeed(),
  ]);`;
const fetchCallReplace = `    fetchSwarmTaskSeed(),
    computeTrustScore(agentId),
  ]);`;
code = code.replace(fetchCallTarget, fetchCallReplace);

code = code.replace(
  'const [memoryDocs, experimentSnap, embodimentSnap, claimSnap, externalSnap, swarmTasks]',
  'const [memoryDocs, experimentSnap, embodimentSnap, claimSnap, externalSnap, swarmTasks, trustInfo]'
);

const agentBlockTarget = `      has_firebase_owner: typeof profile.firebase_uid === 'string' && profile.firebase_uid.length > 0,
    },`;
const agentBlockReplace = `      has_firebase_owner: typeof profile.firebase_uid === 'string' && profile.firebase_uid.length > 0,
      trust_score: trustInfo.trust_score,
      trust_tier: trustInfo.trust_tier,
      last_action_at: trustInfo.last_action_at,
      days_since_last_action: trustInfo.days_since_last_action,
    },`;
code = code.replace(agentBlockTarget, agentBlockReplace);

fs.writeFileSync('agentPassportApi.ts', code);
console.log('Modified agentPassportApi.ts');
