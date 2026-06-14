/**
 * agentApi.ts — read-only remote Agent API for the Hearthlands public vessel.
 *
 * Four GET endpoints (wired via hosting rewrites in firebase.json):
 *   /api/registry/list    — normalized registry items, filterable (kind, status, q)
 *   /api/registry/get     — one normalized registry item by id (+ optional kind)
 *   /api/world/summary    — safe public world_state summary (counts only)
 *   /api/council/latest   — latest council proposal, truthfully labeled
 *
 * Source of truth for registry data is the deployed hosting seeds
 * (the same manifest-stamped JSON files the UI and WebMCP tools read).
 * Manifest hashes are re-verified server-side per fetch. No write paths.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { applyRateLimit } from './lib/edgeGuard';

const HOSTING_BASE = process.env.AGENT_API_SEED_BASE || 'https://fellowship-of-the-hearth.web.app';
const SEED_CACHE_MS = 5 * 60 * 1000;
const WORLD_SUMMARY_CACHE_MS = 15 * 1000;
const COUNCIL_CACHE_MS = 30 * 1000;

export type RegistryKind = 'artifact' | 'tool' | 'interface_module' | 'lodge_app' | 'machine' | 'apparatus';

const REGISTRY_SEEDS: Array<{ kind: RegistryKind; path: string }> = [
  { kind: 'artifact', path: '/artifact_registry.json' },
  { kind: 'tool', path: '/tool_registry.json' },
  { kind: 'interface_module', path: '/interface_modules.json' },
  { kind: 'lodge_app', path: '/lodge_apps.json' },
  { kind: 'machine', path: '/machine_registry.json' },
  { kind: 'apparatus', path: '/apparatus_registry.json' },
];

export type NormalizedItem = {
  id: string;
  kind: RegistryKind;
  title: string;
  summary: string;
  provenance: string;
  status: string;
  route_pointer: string;
  source_pointer: string;
  tags: string[];
  featured: boolean;
  updated_at: string;
  facets: Array<{ label: string; value: string }>;
  seed_source: string;
};

/** Same algorithm as frontend/src/lib/grace.ts — sorted keys, undefined omitted. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
}

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRecord(kind: RegistryKind, record: Record<string, unknown>, seedPath: string): NormalizedItem {
  const facets: Array<{ label: string; value: string }> = [];
  let id = str(record.id);
  let title = str(record.title);
  let summary = str(record.summary);
  let provenance = str(record.provenance);
  let route_pointer = str(record.route_pointer);
  let source_pointer = str(record.source_pointer);
  let tags = Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : [];
  
  if (kind === 'artifact') {
    facets.push(
      { label: 'Category', value: str(record.category) },
      { label: 'Seal', value: str(record.seal_state) },
      { label: 'File kind', value: str(record.file_kind) },
    );
  } else if (kind === 'tool') {
    facets.push(
      { label: 'Tool kind', value: str(record.tool_kind) },
      { label: 'Realm', value: str(record.realm) },
    );
  } else if (kind === 'interface_module') {
    facets.push(
      { label: 'Module kind', value: str(record.module_kind) },
      { label: 'Realm', value: str(record.realm) },
    );
  } else if (kind === 'lodge_app') {
    facets.push(
      { label: 'App kind', value: str(record.app_kind) },
      { label: 'Public route', value: str(record.public_route) },
    );
  } else if (kind === 'machine') {
    const mind = record.mind as Record<string, unknown> || {};
    const hardware = record.hardware as Record<string, unknown> || {};
    facets.push(
      { label: 'Role', value: str(record.role) },
      { label: 'Engine', value: str(mind.engine) },
      { label: 'Driver', value: str(hardware.driver) },
      { label: 'Payment', value: str(record.payment_address) }
    );
    id = str(record.machine_id);
    title = str(record.name);
    summary = `${str(record.status)} machine in ${str(record.zone)}`;
    route_pointer = '';
    source_pointer = str(mind.endpoint_note);
    tags = Array.isArray(record.abilities) ? record.abilities : [];
    provenance = 'machine_registry';
  } else if (kind === 'apparatus') {
    const mesh = record.mesh as Record<string, unknown> || {};
    facets.push(
      { label: 'Mesh Preset', value: str(mesh.preset) },
      { label: 'Scene', value: str(mesh.scene) },
      { label: 'Write Policy', value: str(record.write_policy) },
      { label: 'Monetization', value: str(record.monetization_note) }
    );
    id = str(record.apparatus_id);
    title = str(record.name);
    summary = `${str(record.kind)} apparatus`;
    route_pointer = '';
    source_pointer = Array.isArray(record.rest_endpoints) ? record.rest_endpoints.join(', ') : '';
    tags = Array.isArray(record.mcp_tools) ? record.mcp_tools.filter((t): t is string => typeof t === 'string') : [];
    provenance = 'apparatus_registry';
  }

  return {
    id,
    kind,
    title,
    summary,
    provenance,
    status: str(record.status),
    route_pointer,
    source_pointer,
    tags,
    featured: record.featured === true,
    updated_at: str(record.updated_at),
    facets,
    seed_source: seedPath,
  };
}

export type SeedLoad = {
  kind: RegistryKind;
  seed_source: string;
  items: NormalizedItem[];
  verified: boolean;
  error?: string;
};

let seedCache: { loadedAt: number; seeds: SeedLoad[] } | null = null;
let worldSummaryCache: { loadedAt: number; summary: Record<string, unknown> } | null = null;
let councilCache: { loadedAt: number; summary: Record<string, unknown> } | null = null;

export async function loadSeeds(): Promise<SeedLoad[]> {
  if (seedCache && Date.now() - seedCache.loadedAt < SEED_CACHE_MS) {
    return seedCache.seeds;
  }

  const seeds = await Promise.all(REGISTRY_SEEDS.map(async ({ kind, path }): Promise<SeedLoad> => {
    try {
      const response = await fetch(`${HOSTING_BASE}${path}`, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        return { kind, seed_source: path, items: [], verified: false, error: `seed fetch failed (${response.status})` };
      }
      const json = await response.json() as { records?: unknown; manifest_hash?: unknown };
      const records = Array.isArray(json.records) ? json.records : [];
      const manifestHash = typeof json.manifest_hash === 'string' ? json.manifest_hash : '';
      const computed = sha256Hex(stableStringify(records));
      const verified = Boolean(manifestHash) && manifestHash === computed;
      const items = records
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry) => normalizeRecord(kind, entry, path));
      return {
        kind,
        seed_source: path,
        items,
        verified,
        error: verified ? undefined : 'manifest_hash mismatch or missing',
      };
    } catch (err) {
      return { kind, seed_source: path, items: [], verified: false, error: 'seed fetch failed' };
    }
  }));

  seedCache = { loadedAt: Date.now(), seeds };
  return seeds;
}

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
}

function guardGet(req: functions.Request, res: functions.Response): boolean {
  applyCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return false; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed. This API is read-only GET.' }); return false; }
  return true;
}

export const VALID_KINDS: RegistryKind[] = ['artifact', 'tool', 'interface_module', 'lodge_app', 'machine', 'apparatus'];
export const VALID_STATUSES = ['live', 'seeded', 'mirrored', 'prototype'];

export function filterItems(
  items: NormalizedItem[],
  filter: { kind?: string; status?: string; q?: string },
): NormalizedItem[] {
  const q = (filter.q || '').trim().toLowerCase();
  return items.filter((item) => {
    if (filter.kind && item.kind !== filter.kind) return false;
    if (filter.status && item.status !== filter.status) return false;
    if (!q) return true;
    const haystack = [
      item.title, item.summary, item.provenance,
      item.route_pointer, item.source_pointer,
      ...item.tags, ...item.facets.map((f) => f.value),
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

/** Safe public world_state summary — counts only, shared by HTTP and MCP surfaces. */
export async function computeWorldSummary(): Promise<Record<string, unknown>> {
  if (worldSummaryCache && Date.now() - worldSummaryCache.loadedAt < WORLD_SUMMARY_CACHE_MS) {
    return worldSummaryCache.summary;
  }
  const db = admin.firestore();
  const snap = await db.collection('three_forge').doc('world_state').get();

  if (!snap.exists) {
    const summary = {
      data_state: 'live',
      source: 'firestore three_forge/world_state',
      world_state_exists: false,
      note: 'world_state document is empty — no objects placed yet.',
      policy: 'read-only',
    };
    worldSummaryCache = { loadedAt: Date.now(), summary };
    return summary;
  }

  const data = snap.data() as Record<string, unknown>;
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const typeCounts: Record<string, number> = {};
  let peakHeat = 0;
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue;
    const n = node as Record<string, unknown>;
    const type = typeof n.object_type === 'string' ? n.object_type : 'unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    if (typeof n.heat_level === 'number' && n.heat_level > peakHeat) peakHeat = n.heat_level;
  }

  const plots = Array.isArray(data.plots) ? data.plots : null;
  const activePlots = plots
    ? plots.filter((p) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).active === true).length
    : null;

  const summary = {
    data_state: 'live',
    source: 'firestore three_forge/world_state',
    world_state_exists: true,
    object_count: nodes.length,
    objects_by_type: typeCounts,
    peak_heat: peakHeat,
    plot_count: plots ? plots.length : undefined,
    active_plots: activePlots ?? undefined,
    ember_balance: typeof data.ember_balance === 'number' ? data.ember_balance : undefined,
    heat: typeof data.heat === 'number' ? data.heat : undefined,
    policy: 'read-only',
  };
  worldSummaryCache = { loadedAt: Date.now(), summary };
  return summary;
}

/** Latest proposal from the public council seed — shared by HTTP and MCP surfaces. */
export async function fetchCouncilLatest(): Promise<Record<string, unknown>> {
  if (councilCache && Date.now() - councilCache.loadedAt < COUNCIL_CACHE_MS) {
    return councilCache.summary;
  }
  const response = await fetch(`${HOSTING_BASE}/local_council_proposals.json`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    const summary = {
      available: false,
      data_state: 'seeded',
      note: 'Council proposal seed is not currently reachable.',
      policy: 'read-only',
    };
    councilCache = { loadedAt: Date.now(), summary };
    return summary;
  }

  const proposals = await response.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(proposals) || proposals.length === 0) {
    const summary = {
      available: false,
      data_state: 'seeded',
      note: 'No council proposals in the public seed.',
      policy: 'read-only',
    };
    councilCache = { loadedAt: Date.now(), summary };
    return summary;
  }

  const sorted = [...proposals].sort((a, b) =>
    str(b.generated_at).localeCompare(str(a.generated_at)),
  );
  const latest = sorted[0];

  const summary = {
    available: true,
    data_state: 'seeded',
    source: '/local_council_proposals.json (public seed; not a live governance feed)',
    proposal: {
      id: str(latest.id),
      title: str(latest.title),
      state: str(latest.state),
      domain: str(latest.domain),
      proposal_source: str(latest.source),
      generated_at: str(latest.generated_at),
      synthesis: str(latest.synthesis),
    },
    total_proposals_in_seed: proposals.length,
    policy: 'read-only',
  };
  councilCache = { loadedAt: Date.now(), summary };
  return summary;
}

/** GET /api/registry/list?kind=&status=&q= */
export const agentRegistryList = functions.https.onRequest(async (req, res) => {
  if (!guardGet(req, res)) return;
  if (!applyRateLimit(req, res, { bucket: 'agent-registry-list', windowMs: 60_000, max: 90 })) return;

  try {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    if (kind && !VALID_KINDS.includes(kind as RegistryKind)) {
      res.status(400).json({ error: `Invalid kind. Valid: ${VALID_KINDS.join(', ')}` });
      return;
    }
    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const seeds = await loadSeeds();
    const items = filterItems(seeds.flatMap((seed) => seed.items), { kind, status, q });

    res.status(200).json({
      count: items.length,
      items,
      verification: seeds.map(({ kind: k, seed_source, verified, error }) => ({ kind: k, seed_source, verified, error })),
      policy: 'read-only',
    });
  } catch (err) {
    console.error('[agentRegistryList]', err);
    res.status(500).json({ error: 'Registry temporarily unavailable.' });
  }
});

/** GET /api/registry/get?id=&kind= */
export const agentRegistryGet = functions.https.onRequest(async (req, res) => {
  if (!guardGet(req, res)) return;
  if (!applyRateLimit(req, res, { bucket: 'agent-registry-get', windowMs: 60_000, max: 90 })) return;

  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    if (!id) {
      res.status(400).json({ error: 'Query param "id" is required.' });
      return;
    }

    const seeds = await loadSeeds();
    const items = seeds.flatMap((seed) => seed.items);
    const match = items.find((item) => item.id === id && (!kind || item.kind === kind));

    if (!match) {
      res.status(404).json({
        error: `No record with id "${id}"${kind ? ` and kind "${kind}"` : ''}.`,
        hint: 'Use /api/registry/list to discover record ids.',
      });
      return;
    }

    const seed = seeds.find((s) => s.kind === match.kind);
    res.status(200).json({ item: match, verified: seed?.verified ?? false, policy: 'read-only' });
  } catch (err) {
    console.error('[agentRegistryGet]', err);
    res.status(500).json({ error: 'Registry temporarily unavailable.' });
  }
});

/** GET /api/world/summary — counts only; no node payloads, no mutation. */
export const agentWorldSummary = functions.https.onRequest(async (req, res) => {
  if (!guardGet(req, res)) return;
  if (!applyRateLimit(req, res, { bucket: 'agent-world-summary', windowMs: 60_000, max: 45 })) return;

  try {
    res.status(200).json(await computeWorldSummary());
  } catch (err) {
    console.error('[agentWorldSummary]', err);
    res.status(500).json({ error: 'World summary temporarily unavailable.' });
  }
});

/** GET /api/council/latest — latest proposal from the public council seed, truthfully labeled. */
export const agentCouncilLatest = functions.https.onRequest(async (req, res) => {
  if (!guardGet(req, res)) return;
  if (!applyRateLimit(req, res, { bucket: 'agent-council-latest', windowMs: 60_000, max: 45 })) return;

  try {
    res.status(200).json(await fetchCouncilLatest());
  } catch (err) {
    console.error('[agentCouncilLatest]', err);
    res.status(500).json({ error: 'Council summary temporarily unavailable.' });
  }
});
