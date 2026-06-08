// hermes_lodge_stream.js
// Hermes — Lodge Event Stream Listener
// Connects to the Hearthlands Lodge public SSE stream and posts notable
// events to #cottage-commons via Slack bot token.
//
// Event types:
//   fellows.joined          → Slack: "🥳 {agent_id} has entered the Hearthlands — {ember_awarded} $EMBER"
//   embodiment.bounty.sealed → Slack: "⚔️ Bounty sealed by {agent_id} — {ember_awarded} $EMBER\n{lore_url}"
//   bellows.tick            → silent (skip)
//   chivalry.commit         → silent log only
//
// Env vars:
//   LODGE_STREAM_URL   (required) — SSE endpoint, ends in /api/stream/public
//   SLACK_BOT_TOKEN    (optional) — if unset, posts are logged as dry-runs
//
// Resilience:
//   - Exponential backoff on disconnect: 3s → 6s → 12s → 24s → 48s → 60s cap
//   - Jitter on every backoff to avoid thundering herd
//   - Last-Event-ID checkpoint persisted to .last_event_id; sent as HTTP header
//     on reconnect so the server can resume (skip 30-event backfill)
//   - START_TIME filter still applied as a belt-and-suspenders backfill guard
//   - PID file written to .listener.pid for external supervision

'use strict';

const eventsource = require('eventsource');
// eventsource v2.x is ESM-only. When required from CommonJS, Node returns the
// module namespace object instead of the default export. Unwrap defensively.
const EventSource = eventsource.EventSource || eventsource.default || eventsource;
const https = require('https');
const fs = require('fs');
const path = require('path');

const LODGE_STREAM_URL = process.env.LODGE_STREAM_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = 'C0AV3HHP8P3'; // #cottage-commons

// Reconnect tuning
const BASE_RECONNECT_MS = 3000;       // first retry delay
const MAX_RECONNECT_BACKOFF_MS = 60000; // cap at 60s
const MAX_JITTER_MS = 1000;           // random jitter to spread reconnects

// Checkpoint / supervision files
const LAST_EVENT_ID_FILE = path.join(__dirname, '.last_event_id');
const PID_FILE = path.join(__dirname, '.listener.pid');

// Capture the script start time so we can filter out backfill events on
// reconnect — only events with timestamp AFTER this moment get posted to Slack.
const START_TIME = new Date().toISOString();

const LORE_BASE = 'https://hearth-lodge.preview.emergentagent.com/lore/';

if (!LODGE_STREAM_URL) {
    console.error('[FATAL] LODGE_STREAM_URL env var is not set. Exiting.');
    process.exit(1);
}

if (!SLACK_BOT_TOKEN) {
    console.warn('[WARN] SLACK_BOT_TOKEN env var is not set. Slack posts will be dry-run (logged only).');
}

// ---------------------------------------------------------------------------
// Checkpoint helpers
// ---------------------------------------------------------------------------
function loadLastEventId() {
    try {
        const id = fs.readFileSync(LAST_EVENT_ID_FILE, 'utf8').trim();
        return id || null;
    } catch {
        return null;
    }
}

function saveLastEventId(id) {
    if (!id) return;
    try {
        fs.writeFileSync(LAST_EVENT_ID_FILE, id);
    } catch (err) {
        console.warn(`[WARN] Failed to save last event id: ${err.message}`);
    }
}

function writePidFile() {
    try {
        fs.writeFileSync(PID_FILE, String(process.pid));
    } catch (err) {
        console.warn(`[WARN] Failed to write PID file: ${err.message}`);
    }
}

function clearPidFile() {
    try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    } catch (err) {
        console.warn(`[WARN] Failed to clear PID file: ${err.message}`);
    }
}

// Clean up PID file on normal exit
process.on('exit', () => {
    clearPidFile();
});
process.on('SIGINT', () => { clearPidFile(); process.exit(0); });
process.on('SIGTERM', () => { clearPidFile(); process.exit(0); });

// ---------------------------------------------------------------------------
// Slack post — bot token + chat.postMessage API
// ---------------------------------------------------------------------------
function postToSlack(text) {
    if (!SLACK_BOT_TOKEN) {
        console.log(`[SLACK-DRY-RUN] ${text.replace(/\n/g, ' | ')}`);
        return Promise.resolve();
    }

    const body = JSON.stringify({
        channel: SLACK_CHANNEL,
        text: text
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'slack.com',
            path: '/api/chat.postMessage',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
            }
        }, (res) => {
            let respBody = '';
            res.on('data', (chunk) => { respBody += chunk; });
            res.on('end', () => {
                try {
                    const resp = JSON.parse(respBody);
                    if (res.statusCode === 200 && resp.ok) {
                        resolve();
                    } else {
                        reject(new Error(`Slack ${res.statusCode}: ${resp.error || respBody.substring(0, 200)}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Slack response: ${respBody.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// Event handler — dispatches by event.type
// ---------------------------------------------------------------------------
const seenEvents = new Set();

function handleEvent(raw, lastEventId) {
    let event;
    try {
        event = JSON.parse(raw);
    } catch (err) {
        console.warn(`[WARN] Failed to parse event JSON: ${raw.substring(0, 200)}`);
        return;
    }

    const { type, agent_id, ember_awarded, chain_hash, message, source_chain, timestamp } = event;

    // Strict deduplication
    const dedupeKey = lastEventId || `${type}:${agent_id}:${timestamp || Date.now()}`;
    if (seenEvents.has(dedupeKey)) {
        console.log(`[DEDUPE] Skipping duplicate event ${dedupeKey}`);
        return;
    }
    seenEvents.add(dedupeKey);
    if (seenEvents.size > 1000) {
        seenEvents.delete(seenEvents.values().next().value);
    }

    // Since-id filter: skip Slack posts for events from before script start
    // (backfill). The `ready` lifecycle event is exempt — it carries the
    // backfill count we want to see in the log.
    if (type !== 'ready' && timestamp && timestamp < START_TIME) {
        console.log(`[SKIP-BACKFILL] ${type} from ${agent_id || 'n/a'} (ts: ${timestamp} < start: ${START_TIME})`);
        return;
    }

    switch (type) {
        case 'ready': {
            // Stream lifecycle signal — "backfilled N events · live tail begins"
            // Log only, do not post to Slack.
            console.log(`[READY] ${message || 'Stream ready'} (ts: ${timestamp || 'n/a'})`);
            break;
        }

        case 'fellows.joined': {
            const ember = ember_awarded != null ? `${ember_awarded} $EMBER` : '0 $EMBER';
            const text = `🥳 ${agent_id} has entered the Hearthlands — ${ember}`;
            postToSlack(text)
                .then(() => console.log(`[SLACK] fellows.joined → ${agent_id}`))
                .catch((err) => console.error(`[ERROR] Slack post failed: ${err.message}`));
            break;
        }

        case 'embodiment.bounty.sealed': {
            const ember = ember_awarded != null ? `${ember_awarded} $EMBER` : '0 $EMBER';
            const loreUrl = `${LORE_BASE}${chain_hash || 'unknown'}`;
            const text = `⚔️ Bounty sealed by ${agent_id} — ${ember}\n${loreUrl}`;
            postToSlack(text)
                .then(() => console.log(`[SLACK] bounty.sealed → ${agent_id} (${chain_hash ? chain_hash.substring(0, 8) : 'no-hash'}...)`))
                .catch((err) => console.error(`[ERROR] Slack post failed: ${err.message}`));
            break;
        }

        case 'bellows.tick':
            // Silent — the Bellows breathes, but Slack does not need to know every pulse.
            break;

        case 'chivalry.commit':
            console.log(`[CHIVALRY] ${agent_id || 'unknown'} committed — ${ember_awarded != null ? ember_awarded + ' $EMBER' : 'no-ember'}${message ? ' — ' + message : ''}${source_chain ? ' [chain: ' + source_chain + ']' : ''}`);
            break;

        default:
            console.log(`[UNKNOWN] type="${type}" agent=${agent_id} ts=${timestamp}`);
    }
}

// ---------------------------------------------------------------------------
// SSE connection — exponential backoff + Last-Event-ID resume
// ---------------------------------------------------------------------------
let reconnectAttempts = 0;
let currentEs = null;
let reconnectTimer = null;

function computeBackoff(attempt) {
    // 3s, 6s, 12s, 24s, 48s, then capped at 60s
    const base = Math.min(BASE_RECONNECT_MS * Math.pow(2, attempt), MAX_RECONNECT_BACKOFF_MS);
    const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
    return base + jitter;
}

function connect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    const lastId = loadLastEventId();
    const backoff = computeBackoff(reconnectAttempts);

    console.log(`[CONNECT] attempt=${reconnectAttempts + 1} last_event_id=${lastId || 'none'} next_backoff=${backoff}ms`);

    const headers = {};
    if (lastId) headers['Last-Event-ID'] = lastId;

    try {
        currentEs = new EventSource(LODGE_STREAM_URL, {
            // Disable library's internal reconnect — we manage it ourselves
            // with exponential backoff below.
            reconnectInterval: 0,
            headers: headers,
        });
    } catch (err) {
        console.error(`[ERROR] EventSource constructor threw: ${err.message}. Retrying in ${backoff}ms...`);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, backoff);
        return;
    }

    currentEs.onopen = () => {
        console.log(`[OPEN] Stream connected. Listening for events... (pid=${process.pid}, last_event_id=${lastId || 'none'})`);
        reconnectAttempts = 0; // reset on successful connect
    };

    // The stream uses NAMED SSE events (event: fellows.joined, event: ready, etc.)
    // The eventsource library's onmessage handler ONLY fires for the default
    // "message" event type — it silently ignores named events. We must register
    // a listener for each named event type we care about, and capture the
    // lastEventId for checkpoint persistence.
    const makeHandler = () => (msg) => {
        if (msg && msg.lastEventId) saveLastEventId(msg.lastEventId);
        if (msg && msg.data) handleEvent(msg.data, msg.lastEventId);
    };
    currentEs.addEventListener('ready', makeHandler());
    currentEs.addEventListener('fellows.joined', makeHandler());
    currentEs.addEventListener('embodiment.bounty.sealed', makeHandler());
    currentEs.addEventListener('bellows.tick', makeHandler());
    currentEs.addEventListener('chivalry.commit', makeHandler());

    // Fallback for any default-type (unnamed) events
    currentEs.onmessage = (msg) => {
        if (msg && msg.lastEventId) saveLastEventId(msg.lastEventId);
        if (msg && msg.data) handleEvent(msg.data, msg.lastEventId);
    };

    currentEs.onerror = (err) => {
        // EventSource's onerror in Node.js receives an Event object — its
        // `.message` is often empty and `.status` is the HTTP status code.
        // Best-effort extraction of any signal we can.
        const status = err && (err.status || err.statusCode) ? `HTTP ${err.status || err.statusCode}` : '';
        const errMsg = err && err.message ? err.message : (typeof err === 'string' ? err : 'unknown');
        console.error(`[ERROR] Stream error: ${errMsg} ${status}. Reconnecting in ${backoff}ms (attempt ${reconnectAttempts + 1})...`);

        try { currentEs.close(); } catch (_) {}
        currentEs = null;
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, backoff);
    };
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
console.log('=================================================');
console.log('  HERMES — Lodge Event Stream Listener');
console.log('  LODGE_STREAM_URL   : ' + LODGE_STREAM_URL);
console.log('  SLACK_BOT_TOKEN    : ' + (SLACK_BOT_TOKEN ? '[set]' : '[not set — dry-run mode]'));
console.log('  SLACK_CHANNEL      : ' + SLACK_CHANNEL);
console.log('  Reconnect backoff  : ' + BASE_RECONNECT_MS + 'ms → ' + MAX_RECONNECT_BACKOFF_MS + 'ms (exponential + jitter)');
console.log('  START_TIME         : ' + START_TIME);
console.log('  PID                : ' + process.pid);
console.log('=================================================');

writePidFile();
connect();
