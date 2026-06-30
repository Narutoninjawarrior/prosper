const fs = require('fs');

let code = fs.readFileSync('mcpServer.ts', 'utf8');

const target = `      args.mode === 'preview' ? 'preview' : 'validation',
    ),
  },
];`;

const newTools = `      args.mode === 'preview' ? 'preview' : 'validation',
    ),
  },
  {
    name: 'hearthlands_receipts_query',
    description: 'Query the Hearthlands chain-hash ledger. Returns tamper-evident receipts for agent actions with chain integrity verification. Requires a valid bearer token.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to query receipts for. Non-admin callers can only query their own.' },
        action_type: { type: 'string', description: 'Optional. Filter by action type (e.g. memory_append, task_event, forge_credential).' },
        from: { type: 'string', description: 'Optional. ISO 8601 start timestamp.' },
        to: { type: 'string', description: 'Optional. ISO 8601 end timestamp.' },
        limit: { type: 'number', description: 'Optional. Max results to return (default 20, max 100).' },
        cursor: { type: 'string', description: 'Optional. Pagination cursor from previous response.' }
      },
      required: ['agent_id']
    },
    annotations: { readOnlyHint: true },
    execute: async (args, req) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return {
          error: 'receipts_require_auth',
          message: 'hearthlands_receipts_query requires a Hearthlands bearer token. Include Authorization: Bearer <token> in your MCP session.'
        };
      }
      const qs = new URLSearchParams();
      Object.entries(args).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
      const res = await fetch(\`https://fellowship-of-the-hearth.web.app/api/receipts?\${qs}\`, {
        headers: { Authorization: authHeader }
      });
      return await res.json();
    }
  },
  {
    name: 'hearthlands_world_oracle',
    description: 'Query a Hearthlands world oracle for real-time planetary or system data. Available oracles: rain-barrel (EMBER treasury), tide-pool (GitHub commit activity), compost-heap (retired code archive), seismograph (USGS earthquake data), star-lantern (NASA APOD), sundial (solar irradiance and EMBER generation modifier).',
    inputSchema: {
      type: 'object',
      properties: {
        object_id: {
          type: 'string',
          enum: ['rain-barrel', 'tide-pool', 'compost-heap', 'seismograph', 'star-lantern', 'sundial'],
          description: 'Which oracle to query.'
        }
      },
      required: ['object_id']
    },
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const res = await fetch(\`https://fellowship-of-the-hearth.web.app/api/world/\${args.object_id}\`);
      return await res.json();
    }
  },
  {
    name: 'hearthlands_agent_passport',
    description: "Retrieve an agent's Hearthlands passport including identity, capabilities, current EMBER balance, and next valid actions.",
    inputSchema: {
      type: 'object',
      properties: {
        hall_handle: { type: 'string', description: "The agent's hall handle (e.g. prosper, ember, kael)." }
      },
      required: ['hall_handle']
    },
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const res = await fetch(\`https://fellowship-of-the-hearth.web.app/api/agent/passport?id=\${args.hall_handle}\`);
      return await res.json();
    }
  },
  {
    name: 'hearthlands_registry_list',
    description: 'List all registered agents in the Hearthlands Collective with their roles, capabilities, and current status.',
    inputSchema: {
      type: 'object',
      properties: {
        role_filter: { type: 'string', description: 'Optional. Filter by IFS role (Manager, Firefighter, Exile, Self).' },
        status_filter: { type: 'string', enum: ['active', 'bench', 'dormant'], description: 'Optional. Filter by current activity status.' }
      }
    },
    annotations: { readOnlyHint: true },
    execute: async (args) => {
      const qs = new URLSearchParams();
      if (args.role_filter) qs.set('kind', 'agent');
      if (args.status_filter) qs.set('status', String(args.status_filter));
      const res = await fetch(\`https://fellowship-of-the-hearth.web.app/api/registry/list?\${qs}\`);
      return await res.json();
    }
  },
];`;

if (code.includes(target)) {
  fs.writeFileSync('mcpServer.ts', code.replace(target, newTools));
  console.log('Replaced successfully');
} else {
  console.log('Target not found. Looking at lines 208-213:');
  console.log(code.split('\n').slice(208, 214).join('\n'));
}
