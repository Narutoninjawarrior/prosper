/**
 * hermes-supervisor.mjs - small ops wrapper for the Hermes SSE listener.
 *
 * start  - only starts Hermes when the upstream stream endpoint returns HTTP 200
 * status - reports whether the listener pid is alive and prints a compact log summary
 * stop   - terminates the listener pid from .listener.pid if it exists
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, openSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LISTENER = join(__dirname, 'hermes_lodge_stream.js');
const LOG_FILE = join(__dirname, 'hermes_lodge_stream.log');
const PID_FILE = join(__dirname, '.listener.pid');
const SUPERVISOR_PID_FILE = join(__dirname, '.listener.supervisor.pid');

const STREAM_URL = process.env.LODGE_STREAM_URL || 'https://hearth-lodge.preview.emergentagent.com/api/stream/public';
const PROBE_TIMEOUT_MS = Number(process.env.HERMES_PROBE_TIMEOUT_MS || 8000);

function readPid(path) {
  try {
    const raw = readFileSync(path, 'utf8').trim();
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function processAlive(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function readLogSummary() {
  if (!existsSync(LOG_FILE)) {
    return {
      opens: 0,
      errors: 0,
      slack: 0,
      dryRuns: 0,
      lastLine: '(no log file)',
    };
  }
  const text = readFileSync(LOG_FILE, 'utf8');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return {
    opens: countMatches(text, /^\[OPEN\]/gm),
    errors: countMatches(text, /^\[ERROR\]/gm),
    slack: countMatches(text, /^\[SLACK\]/gm),
    dryRuns: countMatches(text, /SLACK-DRY-RUN/g),
    lastLine: lines.length ? lines[lines.length - 1] : '(empty log)',
  };
}

async function probeStream() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(STREAM_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    return { ok: res.status === 200, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: err?.name === 'AbortError' ? 'timeout' : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function status() {
  const listenerPid = readPid(PID_FILE);
  const supervisorPid = readPid(SUPERVISOR_PID_FILE);
  const summary = readLogSummary();
  console.log(`[hermes-supervisor] listener pid: ${listenerPid || 'none'} (${processAlive(listenerPid) ? 'alive' : 'dead'})`);
  console.log(`[hermes-supervisor] supervisor pid: ${supervisorPid || 'none'} (${processAlive(supervisorPid) ? 'alive' : 'dead'})`);
  console.log(`[hermes-supervisor] stream url: ${STREAM_URL}`);
  console.log(`[hermes-supervisor] opens=${summary.opens} errors=${summary.errors} slack=${summary.slack} dryRuns=${summary.dryRuns}`);
  console.log(`[hermes-supervisor] last log line: ${summary.lastLine}`);
}

async function start() {
  const existingPid = readPid(PID_FILE);
  if (processAlive(existingPid)) {
    console.log(`[hermes-supervisor] Hermes already running on pid ${existingPid}`);
    await status();
    return;
  }

  const probe = await probeStream();
  if (!probe.ok) {
    console.error(`[hermes-supervisor] Refusing to start Hermes: upstream stream probe failed (${probe.status})`);
    process.exitCode = 1;
    return;
  }

  await mkdir(__dirname, { recursive: true });
  writeFileSync(SUPERVISOR_PID_FILE, String(process.pid));

  const outFd = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [LISTENER], {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      LODGE_STREAM_URL: STREAM_URL,
    },
  });

  child.unref();

  console.log(`[hermes-supervisor] Started Hermes child pid ${child.pid}`);
}

async function stop() {
  const pid = readPid(PID_FILE);
  if (!processAlive(pid)) {
    console.log('[hermes-supervisor] No live Hermes listener to stop');
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[hermes-supervisor] Sent SIGTERM to Hermes pid ${pid}`);
  } catch (err) {
    console.error(`[hermes-supervisor] Failed to stop pid ${pid}: ${err.message}`);
    process.exitCode = 1;
  }

  try {
    await rm(SUPERVISOR_PID_FILE, { force: true });
  } catch {
    // no-op
  }
}

const cmd = (process.argv[2] || 'status').toLowerCase();

if (cmd === 'start') {
  await start();
} else if (cmd === 'stop') {
  await stop();
} else if (cmd === 'status') {
  await status();
} else {
  console.error(`[hermes-supervisor] Unknown command: ${cmd}`);
  console.error('Usage: node scripts/hermes-supervisor.mjs [start|stop|status]');
  process.exitCode = 1;
}
