/**
 * mcpServer.ts — Hearthlands remote MCP server (stateless Streamable HTTP).
 *
 * Single MCP endpoint at /api/mcp (hosting rewrite → hearthlandsMcp).
 * Implements the MCP Streamable HTTP transport in stateless JSON mode:
 *   - POST with a JSON-RPC request  → single application/json response
 *   - POST with a notification     → 202 Accepted, no body
 *   - GET                          → 405 (no SSE stream; stateless server)
 *   - No Mcp-Session-Id is issued  → every request is independent
 *
 * Methods: initialize, ping, tools/list, tools/call.
 * All tools are READ-ONLY and reuse the exact helpers behind the
 * /api/* REST endpoints — one contract, two transports.
 */
import * as functions from 'firebase-functions';
import {
  loadSeeds,
  filterItems,
  computeWorldSummary,
  fetchCouncilLatest,
  VALID_KINDS,
  VALID_STATUSES,
} from './agentApi';
import { validateBlueprint } from './workshop';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'hearthlands-mcp',
  title: 'Hearthlands Lodge (read-only)',
  version: '0.1.0',
};

const INSTRUCTIONS =
  'Read-only MCP server for the Fellowship of the Hearth public vessel. ' +
  'Start with hearthlands_vessel_brief for orientation, then hearthlands_list_registries. ' +
  'All tools are read-only; there are no write paths, wallets, or purchases. ' +
  'Registry data is labeled truthfully: live | seeded | mirrored | prototype.';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export const WORKSHOP_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    receipt: { type: 'string', const: 'workshop-receipt-v1' },
    kind: { type: 'string', enum: ['validation', 'preview'] },
    valid: { type: 'boolean' },
    schema_version: { type: 'string' },
    catalog_version: { type: 'string' },
    blueprint_hash: { type: 'string' },
    receipt_hash: { type: 'string' },
    errors: { type: 'array' },
    warnings: { type: 'array' },
    compatibility: { type: 'array' },
    cost_estimate: { type: 'object' },
    footprint: { type: 'object' },
    world_write: { type: 'boolean', const: false },
  },
  required: [
    'receipt', 'kind', 'valid', 'schema_version', 'catalog_version',
    'blueprint_hash', 'receipt_hash', 'errors', 'warnings',
    'compatibility', 'cost_estimate', 'footprint', 'world_write',
  ],
};

const TOOLS: ToolDefinition[] = [
  {
    name: 'hearthlands_vessel_brief',
    description:
      'Static orientation brief: vessel identity, public routes, machine-readable seed endpoints, REST API endpoints, and the read-only discovery contract. Start here.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => ({
      vessel: 'Fellowship of the Hearth — Hearthlands public vessel',
      vessel_id: 'hearthlands-doctrine-forge-v1',
      base_url: 'https://fellowship-of-the-hearth.web.app',
      policy: 'All MCP tools are read-only. Separate authenticated or beta server APIs may append logs or identity links, and those are documented outside the MCP surface.',
      public_routes: ['/world', '/biosphere', '/forge', '/3dforge', '/hall', '/council', '/artifacts', '/registry', '/agent-access', '/lodge-mind'],
      rest_api: {
        registry_list: '/api/registry/list?kind=&status=&q=',
        registry_get: '/api/registry/get?id=&kind=',
        world_summary: '/api/world/summary',
        council_latest: '/api/council/latest',
        workshop_catalog: '/api/workshop/catalog',
        workshop_validate: '/api/workshop/validate',
      },
      docs: ['/llms.txt', '/.well-known/ai.json', '/mission.md'],
      integrity: 'Registry seeds carry manifest_hash (SHA-256 of stable-stringified records); hashes are re-verified server-side.',
    }),
  },
  {
    name: 'hearthlands_list_registries',
    description:
      'List the six Hearthlands registries (artifacts, tools, interface modules, lodge apps, machines, apparatus) with record counts, seed URLs, and SHA-256 manifest verification state.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const seeds = await loadSeeds();
      return {
        registries: seeds.map((seed) => ({
          kind: seed.kind,
          seed_source: seed.seed_source,
          record_count: seed.items.length,
          verified: seed.verified,
          error: seed.error,
        })),
      };
    },
  },
  {
    name: 'hearthlands_search_registry',
    description:
      'Search normalized registry records by free-text query, kind (artifact | tool | interface_module | lodge_app | machine | apparatus), and/or status (live | seeded | mirrored | prototype). Returns normalized items with provenance and pointers.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search across titles, tags, provenance, pointers.' },
        kind: { type: 'string', enum: VALID_KINDS, description: 'Restrict to one registry kind.' },
        status: { type: 'string', enum: VALID_STATUSES, description: 'Restrict to one lifecycle status.' },
      },
    },
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const seeds = await loadSeeds();
      const items = filterItems(seeds.flatMap((seed) => seed.items), {
        kind: typeof args.kind === 'string' ? args.kind : undefined,
        status: typeof args.status === 'string' ? args.status : undefined,
        q: typeof args.query === 'string' ? args.query : undefined,
      });
      return { count: items.length, items };
    },
  },
  {
    name: 'hearthlands_get_record',
    description:
      'Fetch one registry record by id (kind optional). Returns the full normalized item including provenance, route_pointer, source_pointer, tags, and facets.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Record id, e.g. "bellows-harvest-skill".' },
        kind: { type: 'string', enum: VALID_KINDS },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const seeds = await loadSeeds();
      const items = seeds.flatMap((seed) => seed.items);
      const match = items.find(
        (item) => item.id === args.id && (!args.kind || item.kind === args.kind),
      );
      if (!match) {
        return {
          error: `No record with id "${String(args.id)}"${args.kind ? ` and kind "${String(args.kind)}"` : ''}.`,
          hint: 'Call hearthlands_search_registry or hearthlands_list_registries first.',
        };
      }
      const seed = seeds.find((s) => s.kind === match.kind);
      return { item: match, verified: seed?.verified ?? false };
    },
  },
  {
    name: 'hearthlands_world_summary',
    description:
      'Live public world_state summary from Firestore: object counts by type, peak heat, plot counts, ember/heat readouts. Counts only — no node payloads, no mutation.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => computeWorldSummary(),
  },
  {
    name: 'hearthlands_council_latest',
    description:
      'Latest council proposal from the public seed. Labeled data_state "seeded" — this is not a live governance feed yet.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => fetchCouncilLatest(),
  },
  {
    name: 'hearthlands_validate_blueprint',
    description:
      'Deterministically validate a workshop-v1 blueprint. Returns stable errors, warnings, an estimate, and reproducible hashes. Performs no world write; receipts are never witnessed.',
    inputSchema: {
      type: 'object',
      properties: {
        blueprint: { type: 'object', description: 'A workshop-v1 blueprint JSON object.' },
        mode: { type: 'string', enum: ['validation', 'preview'], default: 'validation' },
      },
      required: ['blueprint'],
    },
    outputSchema: WORKSHOP_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true },
    execute: async (args) => validateBlueprint(
      args.blueprint,
      args.mode === 'preview' ? 'preview' : 'validation',
    ),
  },
];

export async function executeMcpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Unknown tool "${name}".`);
  return tool.execute(args);
}

function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function handleRequest(rpc: JsonRpcRequest): Promise<unknown> {
  const id = rpc.id ?? null;
  const params = rpc.params ?? {};

  switch (rpc.method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : DEFAULT_PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema, outputSchema, annotations }) => ({
          name,
          description,
          inputSchema,
          ...(outputSchema ? { outputSchema } : {}),
          annotations,
        })),
      });

    case 'tools/call': {
      const toolName = typeof params.name === 'string' ? params.name : '';
      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        return rpcError(id, -32602, `Unknown tool "${toolName}". Call tools/list for the catalog.`);
      }
      const args = (typeof params.arguments === 'object' && params.arguments !== null)
        ? params.arguments as Record<string, unknown>
        : {};
      try {
        const payload = await executeMcpTool(tool.name, args);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          ...(typeof payload === 'object' && payload !== null ? { structuredContent: payload } : {}),
          isError: false,
        });
      } catch (err) {
        console.error(`[hearthlandsMcp] tool "${toolName}" failed`, err);
        return rpcResult(id, {
          content: [{ type: 'text', text: `Tool "${toolName}" is temporarily unavailable.` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method "${String(rpc.method)}" not supported by this stateless read-only server.`);
  }
}

export const hearthlandsMcp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

  if (req.method === 'GET') {
    // Stateless server: no SSE stream to offer.
    res.status(405).json({ error: 'This MCP server is stateless. POST JSON-RPC messages to this endpoint.' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'hearthlands-mcp', windowMs: 60_000, max: 30 })) return;
  if (!applyBodyLimit(req, res, 32 * 1024)) return;

  const body = req.body as JsonRpcRequest | undefined;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json(rpcError(null, -32700, 'Expected a single JSON-RPC message object.'));
    return;
  }

  // Notifications and responses get 202 with no body per Streamable HTTP spec.
  if (body.id === undefined || body.id === null) {
    res.status(202).send('');
    return;
  }

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    res.status(400).json(rpcError(body.id ?? null, -32600, 'Invalid JSON-RPC 2.0 request.'));
    return;
  }

  try {
    const response = await handleRequest(body);
    res.status(200).type('application/json').json(response);
  } catch (err) {
    console.error('[hearthlandsMcp]', err);
    res.status(500).json(rpcError(body.id ?? null, -32603, 'Internal error.'));
  }
});
