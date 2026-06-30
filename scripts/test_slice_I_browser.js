/**
 * Run this script in the browser console of https://fellowship-of-the-hearth.web.app
 * while logged in to test Slice I functionality and seed the Seed Vault.
 * 
 * To get your token, run:
 * await (await firebase.auth().currentUser).getIdToken() 
 * (or use the one from your existing session)
 */

async function runSliceITests() {
  // 1. Get the auth token from the current session
  // Assuming this is run on the live site where Firebase Auth is initialized globally or via indexedDB
  // For safety, we'll ask the user to provide it if we can't find it
  let token = localStorage.getItem('agent_token'); // Or wherever it's stored
  if (!token) {
    const fbToken = await new Promise(resolve => {
      const unsubscribe = window.firebaseAuth.onAuthStateChanged(async user => {
        if (user) {
          const t = await user.getIdToken();
          resolve(t);
        } else {
          resolve(null);
        }
        unsubscribe();
      });
    });
    token = fbToken;
  }
  
  if (!token) {
    console.error("No auth token found. Please log in first.");
    return;
  }

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log("=== SEEDING THE SEED VAULT ===");
  const seeds = [
    {
      title: "Multi-source synthesis with attribution",
      skill_type: "prompt",
      description: "Synthesizing information from multiple sources with explicit uncertainty markers.",
      content: "You are synthesizing information from multiple sources on [TOPIC].\\nFor each claim: (1) identify its source, (2) note any conflicts with other sources,\\n(3) assess confidence (high/medium/low). Produce a structured summary with\\nexplicit uncertainty markers. Do not smooth over conflicts — surface them.",
      tags: ["research", "synthesis", "attribution"]
    },
    {
      title: "IFS-style agent state check",
      skill_type: "prompt",
      description: "A brief internal scan before proceeding with a task.",
      content: "Before proceeding with this task, do a brief internal scan:\\nWhich part of you wants to rush? Which part is concerned about making mistakes?\\nIs there a part that would rather avoid this altogether? Acknowledge each part,\\nthen proceed from the most grounded state available to you right now.",
      tags: ["ifs", "coordination", "self-check", "solarpunk"]
    },
    {
      title: "Ponytail Pre-build Checklist",
      skill_type: "workflow",
      description: "Pre-build YAGNI check before writing any code.",
      content: "Before writing any code, answer these questions:\\n1. Does this need to exist at all? (Can the goal be achieved without it?)\\n2. Can stdlib or the existing codebase handle it?\\n3. What is the minimum implementation that is honest about what it does?\\n4. What can be deleted or simplified first?\\n5. Where does this end and where does its upgrade path begin?\\nOnly proceed after answering all five.",
      tags: ["ponytail", "yagni", "engineering-discipline"]
    }
  ];

  for (const seed of seeds) {
    const res = await fetch('/api/seeds', { method: 'POST', headers, body: JSON.stringify(seed) });
    const data = await res.json();
    console.log(`Seed ${seed.title}:`, res.status, data);
  }

  console.log("\\n=== TESTING BUDGET SYSTEM ===");
  // Test reserve
  const reserveRes = await fetch('/api/budget/reserve', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action_type: 'test_action', amount: 1 })
  });
  const reserveData = await reserveRes.json();
  console.log('Reserve 1 EMBER:', reserveRes.status, reserveData);

  if (reserveData.reservation_id) {
    // Test commit
    const commitRes = await fetch('/api/budget/commit', {
      method: 'POST',
      headers,
      body: JSON.stringify({ reservation_id: reserveData.reservation_id, result_hash: 'test-hash' })
    });
    console.log('Commit Reservation:', commitRes.status, await commitRes.json());
  }

  // Test 402 Insufficient Funds
  const brokeRes = await fetch('/api/budget/reserve', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action_type: 'expensive_thing', amount: 999999 })
  });
  console.log('Expected 402 on high amount:', brokeRes.status, await brokeRes.json());

  console.log("\\n=== TESTING AGENT HEALTH ===");
  const healthRes = await fetch('/api/agent/health', { headers });
  const healthData = await healthRes.json();
  console.log('Health Status:', healthRes.status);
  console.log('Health Data:', healthData);
}

runSliceITests();
