/**
 * inspectApi.ts — GET /api/inspect/record?ref=kind:id
 * Mirrors frontend inspectBridge contract truth surfaces.
 */
import * as functions from 'firebase-functions';
import { loadSeeds, type RegistryKind } from './agentApi';
import { fetchCreativitySuggest } from './creativityApi';
import { fetchWorldTick } from './tickApi';
import { applyRateLimit } from './lib/edgeGuard';

const KINDS = new Set<RegistryKind>([
  'artifact', 'tool', 'interface_module', 'lodge_app', 'machine', 'apparatus',
]);

const KIND_ACCENT: Record<RegistryKind, string> = {
  artifact: '#A78BFA',
  tool: '#34D399',
  interface_module: '#E8842A',
  lodge_app: '#D4A853',
  machine: '#60A5FA',
  apparatus: '#F472B6',
};

function applyCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

function parseRef(raw: string): { kind: RegistryKind; id: string } | null {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(':');
  if (colon <= 0) return null;
  const kind = trimmed.slice(0, colon) as RegistryKind;
  const id = trimmed.slice(colon + 1);
  if (!KINDS.has(kind) || !id) return null;
  return { kind, id };
}

export async function buildInspectRecord(kind: RegistryKind, id: string) {
  const seeds = await loadSeeds();
  const items = seeds.flatMap((seed) => seed.items);
  const item = items.find((row) => row.kind === kind && row.id === id);
  if (!item) return null;

  const details = [
    ...item.facets.slice(0, 8),
    { label: 'route', value: item.route_pointer },
    { label: 'source', value: item.source_pointer },
  ];

  const actions: Array<{ label: string; tone?: string; href?: string }> = [
    { label: 'Visit surface', tone: 'primary', href: item.route_pointer },
    { label: 'Open seed', tone: 'warm', href: item.seed_source },
  ];

  let code: string | undefined;
  let summary = item.summary;

  if (kind === 'apparatus') {
    const endpoints = item.source_pointer;
    if (endpoints.includes('/api/creativity/suggest')) {
      const suggest = await fetchCreativitySuggest(3);
      code = JSON.stringify(suggest, null, 2);
      summary = `${suggest.experiments.length} experiments · excluded ${suggest.excluded_experiment_ids}`;
      actions.unshift({ label: 'Creativity suggest', tone: 'warm', href: '/api/creativity/suggest?limit=5' });
    } else if (endpoints.includes('/api/world/tick')) {
      const tick = await fetchWorldTick();
      code = JSON.stringify(tick, null, 2);
    }
  }

  return {
    inspect: 'inspect-record-v1',
    ref: `${kind}:${id}`,
    accent: KIND_ACCENT[kind],
    eyebrow: `${kind} · ${item.status}`,
    title: item.title,
    summary,
    details,
    code,
    footer: item.provenance,
    actions,
    record: item,
  };
}

export const inspectRecordApi = functions.https.onRequest(async (req, res) => {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET /api/inspect/record?ref=kind:id' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'inspect-record', windowMs: 60_000, max: 60 })) {
    return;
  }

  const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
  const parsed = parseRef(ref);
  if (!parsed) {
    res.status(400).json({ error: 'ref must be kind:id e.g. apparatus:creativity_forge' });
    return;
  }

  try {
    const payload = await buildInspectRecord(parsed.kind, parsed.id);
    if (!payload) {
      res.status(404).json({ error: `No record for ref=${ref}` });
      return;
    }
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200).json(payload);
  } catch (err) {
    console.error('[inspectRecordApi]', err);
    res.status(500).json({ error: 'Inspect record failed' });
  }
});
