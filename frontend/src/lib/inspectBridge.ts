/**
 * inspectBridge — one loader for click-to-inspect across registry seeds and live APIs.
 */
import { loadContract, sanctuaryBridge } from './sanctuaryBridge';
import {
  fromArtifact,
  fromTool,
  fromInterfaceModule,
  fromLodgeApp,
  fromMachine,
  fromApparatus,
  type NormalizedRegistryItem,
  type RegistryKind,
} from './registryAdapter';

export type InspectAction = {
  label: string;
  tone?: 'primary' | 'warm' | 'ghost';
  href?: string;
  disabled?: boolean;
};

export type InspectPayload = {
  accent: string;
  eyebrow: string;
  title: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  code?: string;
  footer?: string;
  actions: InspectAction[];
};

const KIND_ACCENT: Record<RegistryKind, string> = {
  artifact: '#A78BFA',
  tool: '#34D399',
  interface_module: '#E8842A',
  lodge_app: '#D4A853',
  machine: '#60A5FA',
  apparatus: '#F472B6',
};

export function registryItemToInspect(item: NormalizedRegistryItem): InspectPayload {
  return {
    accent: KIND_ACCENT[item.kind],
    eyebrow: `${item.kind} · ${item.status}`,
    title: item.title,
    summary: item.summary,
    details: [
      ...item.facets.slice(0, 6),
      { label: 'route', value: item.route_pointer },
      { label: 'source', value: item.source_pointer },
    ],
    footer: item.provenance,
    actions: [
      { label: 'Visit surface', tone: 'primary', href: item.route_pointer },
      { label: 'Open seed', tone: 'warm', href: item.seed_source },
    ],
  };
}

async function loadAllItems(): Promise<NormalizedRegistryItem[]> {
  const [artifacts, tools, modules, apps, machines, apparatus] = await Promise.all([
    loadContract('/artifact_registry.json', sanctuaryBridge.normalizeArtifacts),
    loadContract('/tool_registry.json', sanctuaryBridge.normalizeTools),
    loadContract('/interface_modules.json', sanctuaryBridge.normalizeInterfaceModules),
    loadContract('/lodge_apps.json', sanctuaryBridge.normalizeLodgeApps),
    loadContract('/machine_registry.json', sanctuaryBridge.normalizeMachines),
    loadContract('/apparatus_registry.json', sanctuaryBridge.normalizeApparatus),
  ]);
  return [
    ...(artifacts.data ?? []).map(fromArtifact),
    ...(tools.data ?? []).map(fromTool),
    ...(modules.data ?? []).map(fromInterfaceModule),
    ...(apps.data ?? []).map(fromLodgeApp),
    ...(machines.data ?? []).map(fromMachine),
    ...(apparatus.data ?? []).map(fromApparatus),
  ];
}

export async function loadRegistryInspect(kind: RegistryKind, id: string): Promise<InspectPayload | null> {
  const items = await loadAllItems();
  const item = items.find((row) => row.kind === kind && row.id === id);
  return item ? registryItemToInspect(item) : null;
}

export async function loadApparatusInspect(apparatusId: string): Promise<InspectPayload | null> {
  const items = await loadAllItems();
  const item = items.find((row) => row.kind === 'apparatus' && row.id === apparatusId);
  if (!item) return null;
  const base = registryItemToInspect(item);
  const liveEndpoint = item.facets.find((f) => f.label.toLowerCase().includes('rest') || f.label === 'REST')
    ?? item.facets.find((f) => f.value.startsWith('/api') || f.value.startsWith('GET') || f.value.startsWith('POST'));

  if (liveEndpoint?.value.includes('/api/creativity/suggest')) {
    try {
      const res = await fetch('/api/creativity/suggest?limit=3');
      const data = await res.json();
      base.code = JSON.stringify(data, null, 2);
      base.summary = `${data.experiments?.length ?? 0} ranked experiments · excluded ${data.excluded_experiment_ids ?? 0}`;
      base.actions.unshift({ label: 'Refresh suggest', tone: 'warm', href: '/api/creativity/suggest?limit=5' });
    } catch {
      base.footer = 'Live API unreachable — showing seed metadata only.';
    }
  } else if (liveEndpoint?.value.includes('/api/world/tick')) {
    try {
      const res = await fetch('/api/world/tick');
      base.code = JSON.stringify(await res.json(), null, 2);
    } catch {
      /* seed only */
    }
  }

  return base;
}

export async function fetchLiveApi(path: string): Promise<string> {
  const res = await fetch(path);
  const text = await res.text();
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export type ForgeNodeInspect = {
  id: string;
  object_type?: string;
  placed_by?: string;
  x: number;
  y: number;
  z: number;
  heat_level?: number;
  color?: string;
};

export function forgeNodeToInspect(node: ForgeNodeInspect): InspectPayload {
  const type = node.object_type ?? 'forge_object';
  return {
    accent: node.color ?? '#E8842A',
    eyebrow: 'world object · live',
    title: type.replace(/_/g, ' '),
    summary: 'Placed object from three_forge/world_state. Inspect metadata; writes still go through the Forge steward path.',
    details: [
      { label: 'id', value: node.id },
      { label: 'position', value: `${node.x.toFixed(1)}, ${node.y.toFixed(1)}, ${node.z.toFixed(1)}` },
      { label: 'placed_by', value: String(node.placed_by ?? 'unknown') },
      { label: 'heat', value: String(node.heat_level ?? 0) },
    ],
    actions: [
      { label: 'Open 3D Forge', tone: 'primary', href: '/3dforge' },
      { label: 'Registry', tone: 'warm', href: '/registry?kind=artifact' },
    ],
  };
}
