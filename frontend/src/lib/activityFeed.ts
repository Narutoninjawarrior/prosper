/**
 * activityFeed.ts - merge public read-only activity sources for /activity.
 */
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { ensureFirebaseConfigured, getFirestoreDb } from '../firebaseConfig';
import { fetchApprovedClaims } from './lodgeFirestore';

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ActivityRow = {
  id: string;
  timestamp: string;
  agent_id: string;
  action_type: string;
  summary: string;
  receipt_hash?: string;
  link?: string;
  source: 'experiment' | 'claim' | 'embodiment' | 'pulse';
};

export type ActivityBundle = {
  rows: ActivityRow[];
  activeAgents: string[];
  data_state: 'live' | 'stale' | 'seeded' | 'unavailable';
  note: string;
  latestTimestamp?: string;
  stats: {
    total: number;
    experiments: number;
    claims: number;
    embodiment: number;
  };
};

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortRows(rows: ActivityRow[]): ActivityRow[] {
  return [...rows].sort((a, b) => {
    const ta = parseTimestamp(a.timestamp) ?? 0;
    const tb = parseTimestamp(b.timestamp) ?? 0;
    return tb - ta;
  });
}

export async function fetchExperimentLogRows(max = 40): Promise<ActivityRow[]> {
  try {
    const res = await fetch(`/api/experiment/log?limit=${max}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return [];
    const data = (await res.json()) as { records?: Array<Record<string, unknown>> };
    return (data.records ?? []).map((row, index) => ({
      id: `exp-${String(row.experiment_id ?? index)}`,
      timestamp: String(row.logged_at ?? ''),
      agent_id: String(row.agent_id ?? 'unknown'),
      action_type: 'experiment_witness',
      summary: `${row.kind ?? 'experiment'} - ${row.experiment_id ?? 'unknown'} via ${row.apparatus_id ?? 'apparatus'}`,
      receipt_hash: typeof row.receipt_hash === 'string' ? row.receipt_hash : undefined,
      link: '/registry?kind=apparatus&id=creativity_forge',
      source: 'experiment',
    }));
  } catch (error) {
    console.error('[activityFeed] experiment log failed', error);
    return [];
  }
}

export async function fetchEmbodimentRows(max = 20): Promise<ActivityRow[]> {
  const ready = await ensureFirebaseConfigured();
  if (!ready) return [];
  const db = getFirestoreDb();
  if (!db) return [];

  try {
    const q = query(collection(db, 'embodiment_ledger'), orderBy('timestamp', 'desc'), limit(max));
    const snap = await getDocs(q);
    const rows: ActivityRow[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      rows.push({
        id: `emb-${docSnap.id}`,
        timestamp: String(d.timestamp ?? ''),
        agent_id: String(d.agent_id ?? 'embodiment'),
        action_type: String(d.action ?? 'embodiment_event'),
        summary: String(d.bounty_id ?? d.action ?? 'Embodiment ledger event'),
        receipt_hash: typeof d.chain_hash === 'string' ? d.chain_hash : undefined,
        link: '/hall',
        source: 'embodiment',
      });
    });
    return rows;
  } catch (error) {
    console.error('[activityFeed] embodiment ledger failed', error);
    return [];
  }
}

export async function fetchActivityBundle(): Promise<ActivityBundle> {
  const [experiments, claimsResult, embodiment] = await Promise.all([
    fetchExperimentLogRows(50),
    fetchApprovedClaims(20),
    fetchEmbodimentRows(20),
  ]);

  const claimRows: ActivityRow[] = claimsResult.ok
    ? claimsResult.rows.map((row) => ({
        id: `claim-${row.id}`,
        timestamp: row.reviewed_at ?? row.created_at ?? '',
        agent_id: row.handle,
        action_type: 'approved_claim',
        summary: row.note ?? `Steward approved claim for ${row.handle}`,
        link: '/hall',
        source: 'claim',
      }))
    : [];

  const rows = sortRows([...experiments, ...claimRows, ...embodiment]);
  const now = Date.now();
  const recentRows = rows.filter((row) => {
    const parsed = parseTimestamp(row.timestamp);
    return parsed !== null && now - parsed <= RECENT_WINDOW_MS;
  });
  const activeAgents = [...new Set(recentRows.map((row) => row.agent_id).filter(Boolean))].slice(0, 12);
  const latestTimestamp = rows.find((row) => parseTimestamp(row.timestamp) !== null)?.timestamp;

  let data_state: ActivityBundle['data_state'] = 'unavailable';
  if (rows.length > 0 && recentRows.length > 0) data_state = 'live';
  else if (rows.length > 0 && latestTimestamp) data_state = 'stale';
  else if (rows.length > 0) data_state = 'seeded';

  let note = 'No public activity yet. Bots witness experiments via POST /api/experiment/log after verifying receipts.';
  if (data_state === 'live') {
    note = 'Read-only merge of experiment_log API, approved lodge_claims, and embodiment_ledger.';
  } else if (data_state === 'stale') {
    note = 'Public activity exists, but no verified signal has appeared in the last 24 hours.';
  } else if (data_state === 'seeded') {
    note = 'Public rows exist, but they do not currently expose trustworthy timestamps.';
  }

  return {
    rows,
    activeAgents,
    data_state,
    note,
    latestTimestamp,
    stats: {
      total: rows.length,
      experiments: experiments.length,
      claims: claimRows.length,
      embodiment: embodiment.length,
    },
  };
}
