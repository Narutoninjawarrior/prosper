#!/usr/bin/env node
/**
 * Browser-adjacent live surface sweep for passport continuity.
 * Complements scripts/test_passport_continuity.js with public-route checks.
 *
 * Usage: node scripts/browser_passport_sweep.mjs [agentId]
 */

const BASE = (process.env.PASSPORT_TEST_BASE_URL || 'https://fellowship-of-the-hearth.web.app').replace(/\/$/, '');
const agentId = process.argv[2] || process.env.PASSPORT_DEMO_AGENT || '';

const checks = [];

function ok(label) {
  checks.push({ label, pass: true });
  console.log(`  ✓ ${label}`);
}

function bad(label, detail) {
  checks.push({ label, pass: false, detail });
  console.error(`  ✗ ${label}: ${detail}`);
}

async function fetchText(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json };
}

async function main() {
  console.log(`Browser passport sweep — ${BASE}`);
  console.log(`Demo agent: ${agentId || '(none specified)'}\n`);

  const routes = [
    '/activity',
    '/hall',
    `/agent/${encodeURIComponent(agentId || 'demo-agent')}`,
    '/forge',
    '/lodge-mind',
    '/agent-access',
  ];

  for (const route of routes) {
    const { res, text } = await fetchText(`${BASE}${route}`, { headers: { accept: 'text/html' } });
    if (!res.ok) bad(`GET ${route}`, res.status);
    else if (/^\s*<!doctype html/i.test(text)) ok(`GET ${route} returns SPA shell`);
    else bad(`GET ${route}`, 'unexpected content type');
  }

  const task = await fetchText(`${BASE}/api/agent/task/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (task.json?.error === 'task_id and status are required.') ok('POST /api/agent/task/event routes to API (not SPA)');
  else bad('POST /api/agent/task/event', task.text.slice(0, 80));

  const memory = await fetchText(`${BASE}/api/agent/memory/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (memory.json?.error === 'event_type and summary are required.') ok('POST /api/agent/memory/append routes to API');
  else bad('POST /api/agent/memory/append', memory.text.slice(0, 80));

  const passportContract = await fetchText(`${BASE}/api/agent/passport`);
  if (passportContract.res.status === 400 && passportContract.json?.error === 'Query param "id" is required.') {
    ok('GET /api/agent/passport routes to API');
  } else {
    bad('GET /api/agent/passport', passportContract.json?.error || passportContract.res.status);
  }

  if (agentId) {
    const passport = await fetchText(`${BASE}/api/agent/passport?id=${encodeURIComponent(agentId)}`);
    if (!passport.res.ok) bad('GET passport', passport.json?.error || passport.res.status);
    else {
      ok('GET passport returns bundle');
      const timeline = passport.json?.continuity?.action_timeline;
      if (Array.isArray(timeline)) ok(`action_timeline surfaced ${timeline.length} entries`);
      else bad('action_timeline', 'missing from passport bundle');
    }

    const exportUrl = `${BASE}/api/agent/passport?id=${encodeURIComponent(agentId)}&format=export`;
    const exported = await fetchText(exportUrl);
    if (exported.res.ok && exported.json?.passport === 'agent-passport-v1') ok('GET passport format=export');
    else bad('GET passport export', exported.json?.error || exported.res.status);
  } else {
    ok('Skipping seeded passport bundle check (no PASSPORT_DEMO_AGENT provided)');
  }

  const retired = await fetchText(
    'https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/forge_execute',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
  if (retired.res.status === 401 && retired.json?.error === 'unauthorized') {
    ok('forge_execute is auth-gated');
  } else bad('forge_execute gate', retired.json?.error || retired.res.status);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
