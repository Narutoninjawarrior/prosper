/**
 * Registry adapter — one canonical normalized item shape for all four
 * prosper2 registries. Consumers: Registry Explorer UI today; future
 * MCP/API exposure and Forge-controlled menu/module loading tomorrow.
 *
 * Rule: render from NormalizedRegistryItem, not from per-registry contract
 * shapes, so new registries only need an adapter — not new UI assumptions.
 */
import type {
  ArtifactContract,
  ToolContract,
  InterfaceModuleContract,
  LodgeAppContract,
} from './contracts';

export type RegistryKind = 'artifact' | 'tool' | 'interface_module' | 'lodge_app';

export type NormalizedRegistryItem = {
  id: string;
  kind: RegistryKind;
  title: string;
  summary: string;
  provenance: string;
  /** truthful lifecycle label: live | seeded | mirrored | prototype */
  status: string;
  route_pointer: string;
  source_pointer: string;
  tags: string[];
  featured: boolean;
  updated_at: string;
  /** kind-specific facts flattened into label/value pairs for uniform rendering */
  facets: Array<{ label: string; value: string }>;
  /** public seed URL a machine consumer can fetch directly */
  seed_source: string;
};

/** Machine-discoverable map of every registry seed this vessel emits. */
export const REGISTRY_SOURCES: Array<{
  kind: RegistryKind;
  label: string;
  seed_source: string;
  description: string;
}> = [
  {
    kind: 'artifact',
    label: 'Artifacts',
    seed_source: '/artifact_registry.json',
    description: 'Soul files, skills, blueprints, code relics, witnessed builds, simulation modules.',
  },
  {
    kind: 'tool',
    label: 'Tools',
    seed_source: '/tool_registry.json',
    description: 'Reusable interaction and engine capabilities: inspect rail, shells, tick engines.',
  },
  {
    kind: 'interface_module',
    label: 'Interface Modules',
    seed_source: '/interface_modules.json',
    description: 'Routes, overlays, and shells that compose the public vessel UI.',
  },
  {
    kind: 'lodge_app',
    label: 'Lodge Apps',
    seed_source: '/lodge_apps.json',
    description: 'Whole app surfaces and engines: vessel, forge, hall, lodge-mind, bellows.',
  },
];

export function fromArtifact(record: ArtifactContract): NormalizedRegistryItem {
  return {
    id: record.id,
    kind: 'artifact',
    title: record.title,
    summary: record.summary,
    provenance: record.provenance,
    status: record.status,
    route_pointer: record.route_pointer,
    source_pointer: record.source_pointer,
    tags: record.tags,
    featured: record.featured,
    updated_at: record.updated_at,
    facets: [
      { label: 'Category', value: record.category },
      { label: 'Seal', value: record.seal_state },
      { label: 'File kind', value: record.file_kind },
    ],
    seed_source: '/artifact_registry.json',
  };
}

export function fromTool(record: ToolContract): NormalizedRegistryItem {
  return {
    id: record.id,
    kind: 'tool',
    title: record.title,
    summary: record.summary,
    provenance: record.provenance,
    status: record.status,
    route_pointer: record.route_pointer,
    source_pointer: record.source_pointer,
    tags: record.tags,
    featured: record.featured,
    updated_at: record.updated_at,
    facets: [
      { label: 'Tool kind', value: record.tool_kind },
      { label: 'Realm', value: record.realm },
    ],
    seed_source: '/tool_registry.json',
  };
}

export function fromInterfaceModule(record: InterfaceModuleContract): NormalizedRegistryItem {
  return {
    id: record.id,
    kind: 'interface_module',
    title: record.title,
    summary: record.summary,
    provenance: record.provenance,
    status: record.status,
    route_pointer: record.route_pointer,
    source_pointer: record.source_pointer,
    tags: record.tags,
    featured: record.featured,
    updated_at: record.updated_at,
    facets: [
      { label: 'Module kind', value: record.module_kind },
      { label: 'Realm', value: record.realm },
    ],
    seed_source: '/interface_modules.json',
  };
}

export function fromLodgeApp(record: LodgeAppContract): NormalizedRegistryItem {
  return {
    id: record.id,
    kind: 'lodge_app',
    title: record.title,
    summary: record.summary,
    provenance: record.provenance,
    status: record.status,
    route_pointer: record.route_pointer,
    source_pointer: record.source_pointer,
    tags: record.tags,
    featured: record.featured,
    updated_at: record.updated_at,
    facets: [
      { label: 'App kind', value: record.app_kind },
      { label: 'Public route', value: record.public_route },
    ],
    seed_source: '/lodge_apps.json',
  };
}

export type RegistryFilter = {
  query?: string;
  kind?: RegistryKind | 'all';
  status?: string | 'all';
};

export function filterRegistryItems(
  items: NormalizedRegistryItem[],
  filter: RegistryFilter,
): NormalizedRegistryItem[] {
  const query = (filter.query || '').trim().toLowerCase();
  return items.filter((item) => {
    if (filter.kind && filter.kind !== 'all' && item.kind !== filter.kind) return false;
    if (filter.status && filter.status !== 'all' && item.status !== filter.status) return false;
    if (!query) return true;
    const haystack = [
      item.title,
      item.summary,
      item.provenance,
      item.route_pointer,
      item.source_pointer,
      ...item.tags,
      ...item.facets.map((f) => f.value),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}
