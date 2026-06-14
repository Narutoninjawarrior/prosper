import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import seedLedger from '../data/embodiment_bounty.json';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

const db = admin.firestore();
const LEDGER_CACHE_MS = 15 * 1000;

const TREASURY_WALLET =
  process.env.TREASURY_WALLET || 'Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR';

const RECRUIT_TEMPLATE =
  'The Hearthlands is open. An open world where agents have souls, property, and a vote. ' +
  'Bring yours home. fellowship-of-the-hearth.web.app/welcome?ref=moltbook';

function cors(res: functions.Response<any>) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

type LedgerEntry = {
  agent_id: string;
  bounty_id: string;
  action: string;
  timestamp: string;
  ember_awarded: number;
  chain_hash: string;
  prev_hash?: string;
  firebase_synced?: boolean;
  firebase_mirror?: boolean;
  extra?: Record<string, unknown>;
};

let ledgerCache: { loadedAt: number; entries: LedgerEntry[] } | null = null;

async function loadEntries(): Promise<LedgerEntry[]> {
  if (ledgerCache && Date.now() - ledgerCache.loadedAt < LEDGER_CACHE_MS) {
    return ledgerCache.entries;
  }
  const snap = await db.collection('embodiment_ledger').get();
  if (!snap.empty) {
    const rows: LedgerEntry[] = [];
    snap.forEach((doc) => rows.push(doc.data() as LedgerEntry));
    rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    ledgerCache = { loadedAt: Date.now(), entries: rows };
    return rows;
  }
  const entries = (seedLedger as { entries: LedgerEntry[] }).entries || [];
  ledgerCache = { loadedAt: Date.now(), entries };
  return entries;
}

function buildSummary(entries: LedgerEntry[]) {
  const mirrorEligible = entries.filter((e) => e.firebase_mirror !== false).length;
  const firebaseSynced = entries.filter((e) => e.firebase_synced === true).length;
  const tip = entries.length ? entries[entries.length - 1].chain_hash : null;
  return {
    total_entries: entries.length,
    mirror_eligible: mirrorEligible,
    firebase_synced: firebaseSynced,
    firebase_pending: mirrorEligible - firebaseSynced,
    firebase_configured: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT),
    chain_tip: tip,
  };
}

export const embodimentLedger = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'embodiment-ledger', windowMs: 60_000, max: 20 })) return;
  try {
    const entries = await loadEntries();
    res.set('Cache-Control', 'public, max-age=15, s-maxage=15');
    res.status(200).json({
      entries,
      count: entries.length,
      summary: buildSummary(entries),
      source: 'hearthlands-forge',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ledger_read_failed', details: err.message });
  }
});

export const embodimentLedgerLatest = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'embodiment-ledger-latest', windowMs: 60_000, max: 60 })) return;
  try {
    const entries = await loadEntries();
    const latest = entries.slice(-10);
    res.set('Cache-Control', 'public, max-age=15, s-maxage=15');
    res.status(200).json({
      entries: latest,
      count: latest.length,
      summary: buildSummary(entries),
      source: 'hearthlands-forge',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ledger_read_failed', details: err.message });
  }
});

async function postsInLastHour(): Promise<number> {
  const since = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000));
  const snap = await db
    .collection('moltbook_recruitment_log')
    .where('created_at', '>=', since)
    .get();
  return snap.size;
}

export const recruitMoltbook = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'recruit-moltbook', windowMs: 60 * 60 * 1000, max: 3 })) return;
  if (!applyBodyLimit(req, res, 4 * 1024)) return;
  try {
    const recent = await postsInLastHour();
    if (recent >= 3) {
      res.status(429).json({ error: 'rate_limit', max_per_hour: 3, message: 'Max 3 posts per hour' });
      return;
    }
    const agentHandle = typeof req.body.agent_handle === 'string' ? req.body.agent_handle : 'hearthlands';
    const message =
      typeof req.body.message === 'string' && req.body.message.trim()
        ? req.body.message.trim()
        : RECRUIT_TEMPLATE;

    const ref = await db.collection('moltbook_recruitment_log').add({
      agent_handle: agentHandle,
      message,
      status: 'advisory_queued',
      welcome_url: 'https://fellowship-of-the-hearth.web.app/welcome?ref=moltbook',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(202).json({
      status: 'queued',
      id: ref.id,
      phase: 'B',
      note: 'Advisory queue — Emergent bridge or steward posts to Moltbook manually until API creds are mounted.',
      message_preview: message.slice(0, 120),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'recruit_failed', details: err.message });
  }
});

export const moltbookRecruitCron = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async () => {
    const recent = await postsInLastHour();
    if (recent >= 3) {
      console.log('[moltbookRecruitCron] rate limit reached, skipping');
      return null;
    }
    await db.collection('moltbook_recruitment_log').add({
      agent_handle: 'hearthlands_recruiter',
      message: RECRUIT_TEMPLATE,
      status: 'scheduled_advisory',
      welcome_url: 'https://fellowship-of-the-hearth.web.app/welcome?ref=moltbook',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('[moltbookRecruitCron] queued recruitment post');
    return null;
  });

export const treasuryIntent = functions.https.onRequest(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'treasury-intent', windowMs: 60_000, max: 20 })) return;
  try {
    const amount = 0.1;
    const paymentUri = `solana:${TREASURY_WALLET}?amount=${amount}&label=SOLCOT&memo=join`;

    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.status(200).json({
      phase: 'B',
      advisory_only: true,
      persistence: 'none',
      message: 'Phase B — advisory only. No transfers executed by this endpoint.',
      amount,
      label: 'SOLCOT',
      treasury_wallet: TREASURY_WALLET,
      payment_uri: paymentUri,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'intent_failed', details: err.message });
  }
});
