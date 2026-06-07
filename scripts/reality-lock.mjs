/**
 * reality-lock.mjs — post-deploy smoke test for the live Hearthlands vessel.
 *
 * Read-only: fetches public URLs, asserts bundle truth strings and route health.
 * Does not mutate Firestore, wallet, economy, or any server state.
 *
 * Usage:
 *   npm run reality-lock
 *   node scripts/reality-lock.mjs --base-url https://fellowship-of-the-hearth.web.app
 *   node scripts/reality-lock.mjs --dist   # pre-deploy: check frontend/dist locally
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const DEFAULT_BASE = 'https://fellowship-of-the-hearth.web.app';

const BUNDLE_STRINGS = [
  'Preview only',
  'Multiplayer chat not configured',
];

/** Regression: missing GLB must not be requested from /models/ */
const BUNDLE_MUST_NOT_CONTAIN = ['water-tower.glb'];

const LIVE_ROUTES = [
  '/world',
  '/biosphere',
  '/welcome?ref=test&agent=reality-lock',
];

const API_PATH = '/api/embodiment/ledger/latest';

/** Per-request timeout — avoids hanging forever in IDE sandboxes */
const FETCH_TIMEOUT_MS = Number(process.env.REALITY_LOCK_TIMEOUT_MS || 25_000);
const BUNDLE_TIMEOUT_MS = Number(process.env.REALITY_LOCK_BUNDLE_TIMEOUT_MS || 120_000);

const results = [];

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE, dist: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base-url' && argv[i + 1]) {
      args.baseUrl = argv[i + 1].replace(/\/$/, '');
      i += 1;
    } else if (argv[i] === '--dist') {
      args.dist = true;
    }
  }
  return args;
}

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[reality-lock] ${tag}: ${name}${suffix}`);
}

async function fetchNoCache(url, { method = 'GET', timeoutMs = FETCH_TIMEOUT_MS, label = url } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  console.log(`[reality-lock] fetch ${method} ${label} (timeout ${timeoutMs}ms)`);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    const text = method === 'HEAD' ? '' : await res.text();
    return { res, text, url: res.url };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractMainBundle(html) {
  const match = html.match(/\/assets\/index-[^"'\s]+\.js/);
  return match ? match[0] : null;
}

async function checkDistBundle() {
  const indexPath = join(REPO_ROOT, 'frontend', 'dist', 'index.html');
  let html;
  try {
    html = await readFile(indexPath, 'utf8');
  } catch (err) {
    record('dist.index.html', false, `missing — run npm run build in frontend/ (${err.message})`);
    return;
  }
  record('dist.index.html', true);

  const bundlePath = extractMainBundle(html);
  if (!bundlePath) {
    record('dist.bundle.extract', false, 'no assets/index-*.js in dist/index.html');
    return;
  }
  record('dist.bundle.extract', true, bundlePath);

  const jsPath = join(REPO_ROOT, 'frontend', 'dist', bundlePath.replace(/^\//, ''));
  let js;
  try {
    js = await readFile(jsPath, 'utf8');
  } catch (err) {
    record('dist.bundle.read', false, err.message);
    return;
  }
  record('dist.bundle.read', true, `${(js.length / 1024 / 1024).toFixed(2)} MB`);

  for (const needle of BUNDLE_STRINGS) {
    record(`dist.bundle.contains:${needle}`, js.includes(needle));
  }
  for (const forbidden of BUNDLE_MUST_NOT_CONTAIN) {
    record(`dist.bundle.forbidden:${forbidden}`, !js.includes(forbidden));
  }
}

async function checkLive(baseUrl) {
  const indexUrl = `${baseUrl}/?reality-lock=${Date.now()}`;
  let indexHtml;
  try {
    const { res, text } = await fetchNoCache(indexUrl, { label: 'index.html' });
    record('live.index.html.status', res.status === 200, `HTTP ${res.status}`);
    if (res.status !== 200) return;
    indexHtml = text;
  } catch (err) {
    record('live.index.html.fetch', false, err.message);
    return;
  }

  const bundlePath = extractMainBundle(indexHtml);
  if (!bundlePath) {
    record('live.bundle.extract', false, 'no assets/index-*.js in live index.html');
    return;
  }
  record('live.bundle.extract', true, bundlePath);

  const bundleUrl = `${baseUrl}${bundlePath}`;
  let js;
  try {
    const { res, text } = await fetchNoCache(`${bundleUrl}?reality-lock=${Date.now()}`, {
      timeoutMs: BUNDLE_TIMEOUT_MS,
      label: bundlePath,
    });
    record('live.bundle.status', res.status === 200, `HTTP ${res.status} ${bundlePath}`);
    if (res.status !== 200) return;
    js = text;
    record('live.bundle.size', true, `${(js.length / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    record('live.bundle.fetch', false, err.message);
    return;
  }

  for (const needle of BUNDLE_STRINGS) {
    record(`live.bundle.contains:${needle}`, js.includes(needle));
  }
  for (const forbidden of BUNDLE_MUST_NOT_CONTAIN) {
    record(`live.bundle.forbidden:${forbidden}`, !js.includes(forbidden));
  }

  for (const route of LIVE_ROUTES) {
    const url = `${baseUrl}${route}${route.includes('?') ? '&' : '?'}reality-lock=${Date.now()}`;
    try {
      const { res } = await fetchNoCache(url, { method: 'HEAD', label: route });
      const ok = res.status === 200;
      record(`live.route:${route}`, ok, `HTTP ${res.status}`);
      if (ok && route.startsWith('/biosphere')) {
        record('live.route:/biosphere.head', true, 'SPA route reachable');
      }
    } catch (err) {
      record(`live.route:${route}`, false, err.message);
    }
  }

  const apiUrl = `${baseUrl}${API_PATH}`;
  try {
    const { res, text } = await fetchNoCache(apiUrl, { label: API_PATH });
    record('live.api.status', res.status === 200, `HTTP ${res.status} ${API_PATH}`);
    if (res.status === 200) {
      let parsed;
      try {
        parsed = JSON.parse(text);
        record('live.api.json', true);
        record(
          'live.api.shape',
          parsed !== null && typeof parsed === 'object',
          parsed === null ? 'null body' : typeof parsed,
        );
      } catch {
        record('live.api.json', false, 'response is not valid JSON');
      }
    }
  } catch (err) {
    record('live.api.fetch', false, err.message);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[reality-lock] Hearthlands vessel smoke — ${new Date().toISOString()}`);

  if (args.dist) {
    console.log('[reality-lock] mode: local dist/');
    await checkDistBundle();
  } else {
    console.log(`[reality-lock] mode: live ${args.baseUrl}`);
    await checkLive(args.baseUrl);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');
  if (failed.length === 0) {
    console.log(`[reality-lock] SUMMARY: PASS (${results.length} checks)`);
    process.exitCode = 0;
    return;
  }

  console.log(`[reality-lock] SUMMARY: FAIL (${failed.length}/${results.length} checks)`);
  console.log('[reality-lock] Failed checks:');
  for (const f of failed) {
    console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  }
  process.exitCode = 1;
}

await main();
