/**
 * agentTools.ts — WebMCP tool registration for the Hearthlands public vessel.
 *
 * WebMCP (W3C Web ML Community Group draft, Chromium early preview) lets a
 * page register tools that an in-browser AI agent can call directly via
 * `document.modelContext.registerTool(...)`. No backend, no HTTP transport —
 * the page itself is the tool surface.
 *
 * Every tool here is READ-ONLY (`annotations.readOnlyHint = true`) and serves
 * the same manifest-verified registry seeds the human UI renders. If the
 * browser does not support WebMCP, registration is a silent no-op.
 */
import { loadContract, sanctuaryBridge } from './sanctuaryBridge';
import {
  REGISTRY_SOURCES,
  fromArtifact,
  fromTool,
  fromInterfaceModule,
  fromLodgeApp,
  filterRegistryItems,
  type NormalizedRegistryItem,
  type RegistryKind,
} from './registryAdapter';

type WebMcpToolResult = { content: Array<{ type: 'text'; text: string }> };

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<WebMcpToolResult>;
};

type ModelContext = {
  registerTool: (tool: WebMcpTool) => void;
};

/** Feature-detect both current (`document`) and legacy (`navigator`) hosts. */
export function getModelContext(): ModelContext | null {
  const doc = document as unknown as { modelContext?: ModelContext };
  if (doc.modelContext && typeof doc.modelContext.registerTool === 'function') {
    return doc.modelContext;
  }
  const nav = navigator as unknown as { modelContext?: ModelContext };
  if (nav.modelContext && typeof nav.modelContext.registerTool === 'function') {
    return nav.modelContext;
  }
  return null;
}

export function isWebMcpSupported(): boolean {
  return getModelContext() !== null;
}

async function loadAllNormalizedItems(): Promise<{
  items: NormalizedRegistryItem[];
  verification: Array<{ registry: string; verified: boolean; state: string }>;
}> {
  const [artifacts, tools, modules, apps] = await Promise.all([
    loadContract('/artifact_registry.json', sanctuaryBridge.normalizeArtifacts),
    loadContract('/tool_registry.json', sanctuaryBridge.normalizeTools),
    loadContract('/interface_modules.json', sanctuaryBridge.normalizeInterfaceModules),
    loadContract('/lodge_apps.json', sanctuaryBridge.normalizeLodgeApps),
  ]);

  const items: NormalizedRegistryItem[] = [
    ...(artifacts.data ?? []).map(fromArtifact),
    ...(tools.data ?? []).map(fromTool),
    ...(modules.data ?? []).map(fromInterfaceModule),
    ...(apps.data ?? []).map(fromLodgeApp),
  ];

  const verification = [
    { registry: 'artifact_registry', verified: artifacts.verified, state: artifacts.state },
    { registry: 'tool_registry', verified: tools.verified, state: tools.state },
    { registry: 'interface_modules', verified: modules.verified, state: modules.state },
    { registry: 'lodge_apps', verified: apps.verified, state: apps.state },
  ];

  return { items, verification };
}

function textResult(payload: unknown): WebMcpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

/**
 * Public catalog of the tools this vessel registers, used by both the WebMCP
 * registration below and the human-readable /agent-access surface.
 */
export const AGENT_TOOL_CATALOG = [
  {
    name: 'hearthlands_list_registries',
    description:
      'List the four Hearthlands registries (artifacts, tools, interface modules, lodge apps) with record counts, seed URLs, and SHA-256 manifest verification state.',
    inputs: 'none',
  },
  {
    name: 'hearthlands_search_registry',
    description:
      'Search normalized registry records by free-text query, kind (artifact | tool | interface_module | lodge_app), and/or status (live | seeded | mirrored | prototype). Returns normalized items with provenance and pointers.',
    inputs: 'query?, kind?, status?',
  },
  {
    name: 'hearthlands_get_record',
    description:
      'Fetch one registry record by kind and id. Returns the full normalized item including provenance, route_pointer, source_pointer, tags, and facets.',
    inputs: 'kind, id',
  },
  {
    name: 'hearthlands_vessel_brief',
    description:
      'Static orientation brief: vessel identity, public routes, machine-readable seed endpoints, and read-only policy. Start here.',
    inputs: 'none',
  },
] as const;

const VESSEL_BRIEF = {
  vessel: 'Fellowship of the Hearth — Hearthlands public vessel',
  vessel_id: 'hearthlands-doctrine-forge-v1',
  base_url: 'https://fellowship-of-the-hearth.web.app',
  policy:
    'All tools and seeds are read-only. No write paths, no wallet actions, no purchases. Registry mutation happens via steward-reviewed commits only.',
  public_routes: [
    '/world', '/biosphere', '/forge', '/3dforge', '/hall',
    '/council', '/artifacts', '/registry', '/agent-access',
  ],
  machine_seeds: REGISTRY_SOURCES.map((s) => ({
    kind: s.kind,
    url: s.seed_source,
    description: s.description,
  })),
  integrity:
    'Each registry seed carries manifest_hash = SHA-256 of the stable-stringified records array. Unverified seeds fail closed in the UI bridge.',
  docs: ['/llms.txt', '/.well-known/ai.json', '/mission.md', '/skill.md'],
};

let registered = false;

/**
 * Register all Hearthlands WebMCP tools. Safe to call from any route;
 * no-ops when WebMCP is unsupported or tools are already registered.
 */
export function registerAgentTools(): boolean {
  if (registered) return true;
  const mc = getModelContext();
  if (!mc) return false;

  try {
    mc.registerTool({
      name: 'hearthlands_list_registries',
      description: AGENT_TOOL_CATALOG[0].description,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const { items, verification } = await loadAllNormalizedItems();
        const counts: Record<string, number> = {};
        for (const item of items) counts[item.kind] = (counts[item.kind] || 0) + 1;
        return textResult({
          registries: REGISTRY_SOURCES.map((s) => ({
            ...s,
            record_count: counts[s.kind] || 0,
          })),
          verification,
        });
      },
    });

    mc.registerTool({
      name: 'hearthlands_search_registry',
      description: AGENT_TOOL_CATALOG[1].description,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text search across titles, tags, provenance, pointers.' },
          kind: {
            type: 'string',
            enum: ['artifact', 'tool', 'interface_module', 'lodge_app'],
            description: 'Restrict to one registry kind.',
          },
          status: {
            type: 'string',
            enum: ['live', 'seeded', 'mirrored', 'prototype'],
            description: 'Restrict to one lifecycle status.',
          },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const { items } = await loadAllNormalizedItems();
        const matched = filterRegistryItems(items, {
          query: typeof input.query === 'string' ? input.query : '',
          kind: (input.kind as RegistryKind) || 'all',
          status: typeof input.status === 'string' ? input.status : 'all',
        });
        return textResult({ count: matched.length, items: matched });
      },
    });

    mc.registerTool({
      name: 'hearthlands_get_record',
      description: AGENT_TOOL_CATALOG[2].description,
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['artifact', 'tool', 'interface_module', 'lodge_app'] },
          id: { type: 'string', description: 'Record id, e.g. "bellows-harvest-skill".' },
        },
        required: ['kind', 'id'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const { items } = await loadAllNormalizedItems();
        const match = items.find((item) => item.kind === input.kind && item.id === input.id);
        if (!match) {
          return textResult({
            error: `No record with kind="${String(input.kind)}" id="${String(input.id)}".`,
            hint: 'Call hearthlands_search_registry or hearthlands_list_registries first.',
          });
        }
        return textResult(match);
      },
    });

    mc.registerTool({
      name: 'hearthlands_vessel_brief',
      description: AGENT_TOOL_CATALOG[3].description,
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => textResult(VESSEL_BRIEF),
    });

    registered = true;
    return true;
  } catch (error) {
    console.error('[agentTools] WebMCP registration failed', error);
    return false;
  }
}
