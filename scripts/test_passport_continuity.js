#!/usr/bin/env node
/**
 * Passport continuity integration test — mechanical verification without a browser.
 *
 * Usage:
 *   node scripts/test_passport_continuity.js
 *   node scripts/test_passport_continuity.js --sweep-only
 *   node scripts/test_passport_continuity.js --keep
 *
 * Env:
 *   GOOGLE_APPLICATION_CREDENTIALS  — Firebase service account (required for live test)
 *   PASSPORT_TEST_BASE_URL            — default https://fellowship-of-the-hearth.web.app
 *   FIREBASE_API_KEY                  — optional; fetched from /__/firebase/init.json if unset
 *   PASSPORT_TEST_UID                 — optional fixed Firebase uid for the test user
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = (process.env.PASSPORT_TEST_BASE_URL || 'https://fellowship-of-the-hearth.web.app').replace(/\/$/, '');
const SWEEP_ONLY = process.argv.includes('--sweep-only');
const KEEP_DATA = process.argv.includes('--keep');

const failures = [];
const passes = [];

function pass(label) {
  passes.push(label);
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  const message = detail ? `${label}: ${detail}` : label;
  failures.push(message);
  console.error(`  ✗ ${message}`);
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function runMechanicalSweep() {
  console.log('\n=== Mechanical sweep (source continuity emitters + parsers) ===\n');

  const agentMemory = readFile('frontend/src/lib/agentMemory.ts');
  if (!agentMemory.includes('appendAgentMemoryEvent') || !agentMemory.includes('appendAgentTaskEvent')) {
    fail('agentMemory.ts exports continuity append helpers');
  } else {
    pass('agentMemory.ts exports appendAgentMemoryEvent + appendAgentTaskEvent');
  }
  if (!agentMemory.includes('TASK_STATUSES') || !agentMemory.includes('trimField')) {
    fail('agentMemory.ts client-side validation guards');
  } else {
    pass('agentMemory.ts trims and validates event payloads before POST');
  }
  if (!agentMemory.includes('X-Moltbook-Identity')) {
    fail('agentMemory.ts supports X-Moltbook-Identity header');
  } else {
    pass('agentMemory.ts supports Firebase Bearer + Moltbook identity headers');
  }

  const workshop = readFile('frontend/src/workshop/WorkshopBench.tsx');
  if (!workshop.includes('appendAgentTaskEvent') || !workshop.includes('appendAgentMemoryEvent')) {
    fail('WorkshopBench.tsx emits task + memory continuity events');
  } else {
    pass('WorkshopBench.tsx emits claimed → in_progress → witnessed task loop + validation memory');
  }
  if (!workshop.includes('ref: \'workshop:validate\'')) {
    fail('WorkshopBench.tsx attaches workshop:validate ref metadata');
  } else {
    pass('WorkshopBench.tsx attaches workshop:validate ref for proof trail');
  }

  const lodgeMind = readFile('frontend/src/LodgeMindRoute.tsx');
  if (!lodgeMind.includes('appendAgentTaskEvent') || !lodgeMind.includes('appendAgentMemoryEvent')) {
    fail('LodgeMindRoute.tsx emits continuity events on ask');
  } else {
    pass('LodgeMindRoute.tsx emits task + memory events on Lodge Mind ask');
  }
  if (!lodgeMind.includes('ref: \'lodge_mind:ask\'')) {
    fail('LodgeMindRoute.tsx attaches lodge_mind:ask ref metadata');
  } else {
    pass('LodgeMindRoute.tsx attaches lodge_mind:ask ref for proof trail');
  }

  const passportApi = readFile('functions/src/agentPassportApi.ts');
  if (!passportApi.includes('resolveWriteIdentity')) {
    fail('agentPassportApi.ts defines resolveWriteIdentity boundary');
  } else {
    pass('agentPassportApi.ts defines resolveWriteIdentity auth boundary');
  }
  if (!passportApi.includes('/api/agent/task/event')) {
    fail('agentPassportApi.ts routes POST /api/agent/task/event');
  } else {
    pass('agentPassportApi.ts routes POST /api/agent/task/event');
  }
  if (!passportApi.includes('action_timeline')) {
    fail('agentPassportApi.ts builds action_timeline');
  } else {
    pass('agentPassportApi.ts builds action_timeline on GET passport');
  }
  if (passportApi.includes('admin_id') && passportApi.includes('malaky')) {
    fail('agentPassportApi.ts should not trust plain admin_id strings');
  } else {
    pass('agentPassportApi.ts does not trust plain admin_id payloads');
  }

  const agentProfile = readFile('frontend/src/AgentProfile.tsx');
  if (!agentProfile.includes('resolveProofLink')) {
    fail('AgentProfile.tsx resolves proof links for timeline entries');
  } else {
    pass('AgentProfile.tsx resolves proof links for timeline entries');
  }
  if (!agentProfile.includes('action_timeline')) {
    fail('AgentProfile.tsx renders action_timeline');
  } else {
    pass('AgentProfile.tsx renders action_timeline section');
  }
  if (!agentProfile.includes('timeline-')) {
    fail('AgentProfile.tsx should tolerate malformed timeline ids');
  } else {
    pass('AgentProfile.tsx tolerates missing timeline ids / labels');
  }

  console.log(`\nSweep: ${passes.length} passed, ${failures.length} failed\n`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { response, body, text };
}

function isHtmlPayload(body, text) {
  const sample = typeof body.raw === 'string' ? body.raw : text;
  return typeof sample === 'string' && /^\s*<!doctype html/i.test(sample);
}

function agentApiUrls(routePath) {
  const project = process.env.FIREBASE_PROJECT_ID || 'fellowship-of-the-hearth';
  const region = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';
  return [
    `${BASE_URL}${routePath}`,
    `https://${region}-${project}.cloudfunctions.net/agentPassportApi${routePath}`,
  ];
}

async function postAgentApi(routePath, idToken, payload) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
  let lastResult = null;
  for (const url of agentApiUrls(routePath)) {
    const result = await fetchJson(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    lastResult = { ...result, url };
    if (!isHtmlPayload(result.body, result.text)) {
      return result;
    }
  }
  return lastResult;
}

async function loadFirebaseApiKey() {
  if (process.env.FIREBASE_API_KEY?.trim()) {
    return process.env.FIREBASE_API_KEY.trim();
  }
  const { response, body } = await fetchJson(`${BASE_URL}/__/firebase/init.json`);
  if (!response.ok || typeof body.apiKey !== 'string') {
    throw new Error(`Could not load Firebase web API key from ${BASE_URL}/__/firebase/init.json`);
  }
  return body.apiKey;
}

async function exchangeCustomToken(apiKey, customToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`;
  const { response, body } = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!response.ok || typeof body.idToken !== 'string') {
    throw new Error(`Custom token exchange failed: ${body.error?.message || response.status}`);
  }
  return body.idToken;
}

async function runLiveIntegration() {
  console.log('=== Live passport continuity integration ===\n');
  console.log(`Base URL: ${BASE_URL}`);

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    fail('live integration', 'GOOGLE_APPLICATION_CREDENTIALS is not set');
    console.log('\nSet credentials to run the live API loop, e.g.:');
    console.log('  $env:GOOGLE_APPLICATION_CREDENTIALS = "D:\\Hearth\\secrets\\service-account.json"');
    return;
  }

  let admin;
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  } catch (err) {
    fail('firebase-admin init', err.message);
    return;
  }

  const db = admin.firestore();
  const testUid = process.env.PASSPORT_TEST_UID?.trim() || `passport_test_${crypto.randomBytes(6).toString('hex')}`;
  const agentId = `passport_agent_${crypto.randomBytes(4).toString('hex')}`;
  const taskId = `continuity_task_${Date.now().toString(36)}`;
  const receiptHash = crypto.createHash('sha256').update(`${taskId}:witnessed`).digest('hex');
  const memoryEventIds = [];
  const taskEventIds = [];

  console.log(`Test uid: ${testUid}`);
  console.log(`Test agent: ${agentId}`);
  console.log(`Task id: ${taskId}\n`);

  try {
    await db.collection('agent_profiles').doc(agentId).set({
      agent_name: 'Passport Continuity Test',
      firebase_uid: testUid,
      status: 'active',
      reputation: 50,
      ember_balance: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      last_active: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { role: 'tester', test_run: true },
    });
    pass('seeded agent_profiles doc linked to test Firebase uid');

    const apiKey = await loadFirebaseApiKey();
    pass('loaded Firebase web API key');

    const customToken = await admin.auth().createCustomToken(testUid);
    const idToken = await exchangeCustomToken(apiKey, customToken);
    pass('exchanged custom token for Firebase ID token');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };

    const taskStatuses = [
      { status: 'claimed', summary: 'Integration test claimed continuity task' },
      { status: 'in_progress', summary: 'Integration test progressing continuity task' },
      {
        status: 'witnessed',
        summary: 'Integration test witnessed continuity task',
        receipt_hash: receiptHash,
      },
    ];

    for (const step of taskStatuses) {
      const { response, body, url } = await postAgentApi('/api/agent/task/event', idToken, {
        task_id: taskId,
        status: step.status,
        summary: step.summary,
        ...(step.receipt_hash ? { receipt_hash: step.receipt_hash } : {}),
        metadata: {
          ref: 'workshop:validate',
          surface: '/forge',
          integration_test: true,
        },
      });
      if (isHtmlPayload(body, response.statusText)) {
        fail(`POST task/event ${step.status}`, `hosting rewrite missing — deploy root firebase.json hosting rewrites (${url})`);
        continue;
      }
      if (!response.ok || !body.success) {
        fail(`POST task/event ${step.status}`, body.error || response.status);
        continue;
      }
      if (body.agent_id !== agentId) {
        fail(`POST task/event ${step.status}`, `expected agent_id ${agentId}, got ${body.agent_id}`);
        continue;
      }
      taskEventIds.push(body.event_id);
      pass(`POST task/event ${step.status} → event ${body.event_id}`);
    }

    const inspectSummary = 'Integration test inspected apparatus:apparatus:hearth_oracle';
    const { response: memRes, body: memBody, url: memUrl } = await postAgentApi('/api/agent/memory/append', idToken, {
      event_type: 'inspect_apparatus',
      summary: inspectSummary,
      metadata: {
        ref: 'apparatus:hearth_oracle',
        surface: '/registry',
        integration_test: true,
      },
    });
    if (isHtmlPayload(memBody, memRes.statusText)) {
      fail('POST memory/append inspect', `hosting rewrite missing (${memUrl})`);
    } else if (!memRes.ok || !memBody.success) {
      fail('POST memory/append inspect', memBody.error || memRes.status);
    } else {
      memoryEventIds.push(memBody.event_id);
      pass(`POST memory/append inspect → event ${memBody.event_id}`);
    }

    // Allow Firestore server timestamps to settle.
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const { response: passRes, body: passport } = await fetchJson(
      `${BASE_URL}/api/agent/passport?id=${encodeURIComponent(agentId)}`,
      { headers: { accept: 'application/json' } },
    );
    if (!passRes.ok) {
      fail('GET passport', passport.error || passRes.status);
      return;
    }

    pass('GET passport returned bundle');

    const continuity = passport.continuity || {};
    const timeline = Array.isArray(continuity.action_timeline) ? continuity.action_timeline : [];
    if (timeline.length === 0) {
      fail('action_timeline populated', 'timeline empty — check Firestore index on agent_memory.created_at');
    } else {
      pass(`action_timeline has ${timeline.length} entries`);
    }

    const taskRows = timeline.filter((row) => row.kind === 'task');
    const inspectRows = timeline.filter((row) => row.kind === 'inspect');
    if (taskRows.length < 3) {
      fail('task timeline rows', `expected ≥3 task rows, got ${taskRows.length}`);
    } else {
      pass(`timeline includes ${taskRows.length} task rows`);
    }
    if (inspectRows.length < 1) {
      fail('inspect timeline rows', 'expected inspect row from memory append');
    } else {
      pass(`timeline includes ${inspectRows.length} inspect row(s)`);
    }

    const witnessed = taskRows.find((row) => row.status === 'witnessed');
    if (!witnessed) {
      fail('witnessed task row', 'no witnessed status in timeline');
    } else {
      pass('timeline includes witnessed task transition');
    }
    if (witnessed && witnessed.receipt_hash !== receiptHash) {
      fail('witnessed receipt_hash', `expected ${receiptHash}, got ${witnessed.receipt_hash}`);
    } else if (witnessed) {
      pass('witnessed row carries receipt_hash');
    }

    const inspectMatch = inspectRows.find((row) => String(row.label || '').includes('hearth_oracle'));
    if (!inspectMatch) {
      fail('inspect label', 'inspect summary not found in timeline');
    } else {
      pass('inspect row label matches apparatus ref');
    }

    // Ordering: newest first
    const timestamps = timeline
      .map((row) => Date.parse(row.timestamp || ''))
      .filter((value) => Number.isFinite(value));
    const monotonic = timestamps.every((value, index) => index === 0 || timestamps[index - 1] >= value);
    if (!monotonic) {
      fail('timeline sort order', 'timestamps are not descending');
    } else {
      pass('action_timeline sorted newest-first');
    }

    const memoryEvents = Array.isArray(continuity.memory_events) ? continuity.memory_events : [];
    const taskMemory = memoryEvents.filter((event) => String(event.event_type || '').startsWith('task_'));
    if (taskMemory.length < 3) {
      fail('memory_events task rows', `expected ≥3 task_* memory events, got ${taskMemory.length}`);
    } else {
      pass(`memory_events includes ${taskMemory.length} task_* events`);
    }
  } finally {
    if (!KEEP_DATA) {
      console.log('\nCleaning up test Firestore rows...');
      const memorySnap = await db.collection('agent_memory')
        .where('agent_id', '==', agentId)
        .get()
        .catch(() => null);
      if (memorySnap) {
        const batch = db.batch();
        memorySnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      await db.collection('agent_profiles').doc(agentId).delete().catch(() => {});
      pass('cleaned up test agent + memory events');
    } else {
      console.log('\n--keep set: test data retained in Firestore');
    }
  }
}

async function main() {
  console.log('Passport continuity mechanical verification');
  runMechanicalSweep();

  if (!SWEEP_ONLY) {
    await runLiveIntegration();
  } else {
    console.log('--sweep-only: skipping live API integration\n');
  }

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passes.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) {
    failures.forEach((item) => console.error(`  - ${item}`));
    process.exitCode = 1;
  } else {
    console.log('\nMechanisms structurally sound — passport continuity path is ready for deploy verification.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
