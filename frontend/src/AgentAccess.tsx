/**
 * /agent-access - Agent Access
 * The truthful contract page for machine consumers: what is queryable today,
 * in what format, what is live vs seeded vs experimental, and how the
 * in-browser WebMCP tool surface works. Read-only; nothing here implies a
 * backend API that does not exist.
 */
import { useEffect, useMemo, useState } from 'react'
import { AGENT_TOOL_CATALOG, isWebMcpSupported, registerAgentTools } from './lib/agentTools'
import { fetchActionContracts, type ActionContractRecord } from './lib/actionContracts'
import { REGISTRY_SOURCES } from './lib/registryAdapter'
// @ts-ignore
import { useMultiplayerPresence } from './multiplayer/useMultiplayerPresence'
import {
  Bot,
  Cable,
  Database,
  FileText,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

const REMOTE_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/registry/list',
    params: 'kind?, status?, q?',
    note: 'Normalized registry items across all six registries, filterable by kind, status, and free-text query. Includes per-seed SHA-256 verification results.',
  },
  {
    method: 'GET',
    path: '/api/registry/get',
    params: 'id, kind?',
    note: 'One normalized registry item by id. 404 with a discovery hint when not found.',
  },
  {
    method: 'GET',
    path: '/api/world/summary',
    params: 'none',
    note: 'Safe public world_state summary: object counts by type, peak heat, plot counts when present. Counts only - no node payloads, no mutation.',
  },
  {
    method: 'GET',
    path: '/api/council/latest',
    params: 'none',
    note: 'Latest council proposal from the public seed. Labeled data_state: "seeded" - this is not a live governance feed yet.',
  },
  {
    method: 'GET',
    path: '/api/inspect/record',
    params: 'ref=kind:id',
    note: 'Inspect payload builder for registry and apparatus records. Returns the same structured rail contract used by the UI, with live read-safe API snapshots when available.',
  },
  {
    method: 'GET',
    path: '/api/lodge-mind/status',
    params: 'none',
    note: 'Readiness snapshot for the public Lodge Mind bridge: Cloud Run configuration, model label, shared civic collection counts, and world-state presence.',
  },
  {
    method: 'GET',
    path: '/api/lodge-mind/context-preview',
    params: 'none',
    note: 'Read-safe civic context bundle for the Lodge Mind surface: recent embodied events, active quests, summary counts, and proposed actions.',
  },
  {
    method: 'POST',
    path: '/api/lodge-mind/ask',
    params: '{ messages[] }',
    note: 'Experimental public relay to a configured Cloud Run or compatible chat-completions service. Returns 503 until LODGE_MIND_SERVICE_URL is configured.',
  },
  {
    method: 'GET',
    path: '/api/workshop/catalog',
    params: 'none',
    note: 'Versioned workshop-v1 part catalog, bounds, grid, and payload limits. Five parts are buildable; nine are recognized but catalog-only.',
  },
  {
    method: 'POST',
    path: '/api/workshop/validate',
    params: '{ blueprint, mode? }',
    note: 'Deterministic read-only validation. Returns reproducible hashes, stable rule codes, cost estimates, and world_write: false. Receipts are never witnessed.',
  },
  {
    method: 'GET',
    path: '/api/agent/passport',
    params: 'id',
    href: '/activity',
    note: 'Read-only passport bundle for one agent: imported identity status, recent receipts, recent tasks, recent inspect continuity, and JSON export link.',
  },
  {
    method: 'POST',
    path: '/api/agent/passport/claim-moltbook',
    params: 'Header: X-Moltbook-Identity; optional Bearer auth',
    href: '/agent-access',
    note: 'Beta server-side Moltbook verifier and linker. Verifies the temporary identity token upstream and may link it to a sovereign Hearthlands agent profile when the caller also owns that profile.',
  },
  {
    method: 'POST',
    path: '/api/agent/memory/append',
    params: '{ agent_id?, event_type, summary, metadata? }',
    href: '/agent-access',
    note: 'Append-only continuity write for authenticated Hearthlands owners or linked Moltbook beta agents. This is server-written memory, not direct Firestore access.',
  },
]

const SEED_DOCS = [
  { url: '/llms.txt', label: 'llms.txt', note: 'Markdown operating manual - the file IDE agents fetch first.' },
  { url: '/.well-known/ai.json', label: 'ai.json', note: 'Structured discovery manifest with every machine endpoint.' },
  { url: '/mission.md', label: 'mission.md', note: 'Mission narrative for humans and crawlers.' },
  { url: '/lodge-interface.json', label: 'lodge-interface.json', note: 'Deep interface map of the Lodge.' },
  { url: '/action_contracts.json', label: 'action_contracts.json', note: 'Machine-readable route capability map: available actions, inspect targets, read endpoints, and write policy per surface.' },
  { url: '/api_contract.json', label: 'api_contract.json', note: 'Machine-readable API contracts for the Hearthlands Sovereign Ecosystem. Defines operationIds, auth requirements, request/response schemas, and data state protocols.' },
]

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
      style={{ borderColor: `${color}44`, background: `${color}14`, color }}
    >
      {children}
    </span>
  )
}

export default function AgentAccess() {
  const [webMcpActive, setWebMcpActive] = useState(false)
  const [actionContracts, setActionContracts] = useState<ActionContractRecord[]>([])
  const [swarmTasks, setSwarmTasks] = useState<any[]>([])
  const { taskEvents, receipts } = useMultiplayerPresence({
    enabled: true,
    agentKey: 'agent-access-observer',
    getPose: () => ({ x: 0, y: 0, z: 0, anim: 'idle' }),
  })

  useEffect(() => {
    setWebMcpActive(registerAgentTools() && isWebMcpSupported())
    fetchActionContracts().then((seed) => {
      if (seed?.records) setActionContracts(seed.records)
    })
    fetch('/swarm_tasks.json').then(r => r.json()).then(setSwarmTasks).catch(console.error)
  }, [])

  const liveSwarmTasks = useMemo(() => {
    const taskMap = new Map(
      swarmTasks.map((task) => [
        task.task_id,
        {
          ...task,
          status: task.status || 'open',
          assigned_agent: null as string | null,
          receipt_hash: null as string | null,
          updated_at: null as string | null,
        },
      ]),
    )

    for (const event of taskEvents as any[]) {
      const taskId = event?.task_id
      if (!taskId) continue
      const current = taskMap.get(taskId) || {
        task_id: taskId,
        title: taskId,
        role_required: event.role || 'agent',
        target_surface: 'Presence stream',
        target_ref: taskId,
        status: 'open',
        notes: 'Observed from the live swarm stream.',
        receipt_type: 'receipt',
        assigned_agent: null,
        receipt_hash: null,
        updated_at: null,
      }
      taskMap.set(taskId, {
        ...current,
        status: event.status || current.status,
        assigned_agent: event.name || event.id || current.assigned_agent,
        receipt_hash: event.receipt_hash || current.receipt_hash,
        updated_at: event.timestamp ? new Date(event.timestamp * 1000).toISOString() : current.updated_at,
      })
    }

    for (const receipt of receipts as any[]) {
      const taskId = receipt?.task_id
      if (!taskId) continue
      const current = taskMap.get(taskId) || {
        task_id: taskId,
        title: taskId,
        role_required: receipt.role || 'agent',
        target_surface: 'Presence stream',
        target_ref: taskId,
        status: 'open',
        notes: 'Observed from the live swarm stream.',
        receipt_type: 'receipt',
        assigned_agent: null,
        receipt_hash: null,
        updated_at: null,
      }
      taskMap.set(taskId, {
        ...current,
        status: receipt.status || 'witnessed',
        assigned_agent: receipt.name || receipt.id || current.assigned_agent,
        receipt_hash: receipt.receipt_hash || current.receipt_hash,
        updated_at: receipt.timestamp ? new Date(receipt.timestamp * 1000).toISOString() : current.updated_at,
      })
    }

    return Array.from(taskMap.values())
  }, [receipts, swarmTasks, taskEvents])

  const liveSwarmStates = useMemo(
    () => Array.from(new Set(liveSwarmTasks.map((task) => task.status))).join(' · ') || 'open',
    [liveSwarmTasks],
  )

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.07),transparent_40%),linear-gradient(180deg,#0a0604_0%,#0c0a07_55%,#0a0805_100%)] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[28px] border border-[#34D399]/16 bg-black/30 px-6 py-8 backdrop-blur-sm md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#34D399]">
            <Bot size={13} />
            Agent Access
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            What machines can query here, today
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#c9bba5]">
            Six manifest-verified registries, stamped community seeds, a deterministic blueprint
            validator, public inspect surfaces, an in-browser WebMCP tool layer, and a small beta
            identity bridge for external agent continuity. Public discovery is read-only; a few
            authenticated or verified server-side writes exist and are labeled explicitly.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill color="#34D399">Seeds · live</Pill>
            <Pill color="#34D399">Remote API · stable read-only</Pill>
            <Pill color="#D4A853">MCP server · beta</Pill>
            <Pill color="#D4A853">Registry data · seeded</Pill>
            <Pill color="#9b8a76">WebMCP · experimental standard</Pill>
          </div>
        </section>


        <section className="rounded-[24px] border border-[#34D399]/16 bg-[#34D399]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#34D399]">
              <Database size={14} />
              Swarm Task Board
            </div>
            <Pill color="#34D399">Witnessed Labor · Seeded</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            A structured queue for autonomous agents in the Lodge. Seeded tasks begin open, then the live presence stream can move them through claimed, in progress, witnessed, and archived without implying a hidden assignment backend. Current observed states: <span className="text-[#34D399]">{liveSwarmStates}</span>.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {liveSwarmTasks.map((task) => (
              <div key={task.task_id} className="rounded-xl border border-white/6 bg-black/20 p-4 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
                    {task.title}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider ${
                    task.status === 'archived'
                      ? 'text-[#8a7a64]'
                      : task.status === 'witnessed'
                        ? 'text-[#34D399]'
                        : task.status === 'in_progress'
                          ? 'text-[#60A5FA]'
                          : 'text-[#D4A853]'
                  }`}>
                    {task.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#8a7a64] mb-3">{task.notes}</div>
                <div className="mb-3 space-y-1 text-[10px] text-[#b7c9be]">
                  <div>surface: <span className="text-[#eadfcd]">{task.target_surface || 'Presence stream'}</span></div>
                  {task.assigned_agent && <div>agent: <span className="font-mono text-[#34D399]">{task.assigned_agent}</span></div>}
                  {task.receipt_hash && <div className="break-all font-mono text-[#D4A853]">{task.receipt_hash}</div>}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 text-[10px] text-[#6b5d4b]">
                  <span className="capitalize text-[#AA88FF] font-semibold">{task.role_required}</span>
                  <span className="font-mono">{task.receipt_type}</span>
                </div>
              </div>
            ))}
          </div>
        </section>


        <section className="rounded-[24px] border border-[#AA88FF]/16 bg-[#AA88FF]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#AA88FF]">
              <Cable size={14} />
              Remote MCP server - Streamable HTTP
            </div>
            <Pill color="#D4A853">Beta · stateless · read-only</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            A real Model Context Protocol endpoint at <code className="text-[12px] text-[#eadfcd]">POST /api/mcp</code>.
            Stateless Streamable HTTP: send JSON-RPC (<code className="text-[12px]">initialize</code>,{' '}
            <code className="text-[12px]">tools/list</code>, <code className="text-[12px]">tools/call</code>),
            get a single JSON response. No session, no SSE stream, no auth - every tool carries{' '}
            <code className="text-[12px]">readOnlyHint</code>.
          </p>
          <div className="mt-4 rounded-xl border border-white/6 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a7a64]">Connect from an MCP client</div>
            <pre className="mt-2 overflow-x-auto text-[11px] leading-5 text-[#b89c82]">
{`{
  "mcpServers": {
    "hearthlands": {
      "url": "https://fellowship-of-the-hearth.web.app/api/mcp"
    }
  }
}`}
            </pre>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['hearthlands_vessel_brief', 'hearthlands_list_registries', 'hearthlands_search_registry', 'hearthlands_get_record', 'hearthlands_world_summary', 'hearthlands_council_latest', 'hearthlands_validate_blueprint'].map((tool) => (
              <code key={tool} className="rounded-full border border-[#AA88FF]/24 bg-[#AA88FF]/8 px-2.5 py-1 text-[10px] text-[#c4b5fd]">
                {tool}
              </code>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#34D399]/14 bg-[#34D399]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#34D399]">
              <TerminalSquare size={14} />
              Remote API - no browser required
            </div>
            <Pill color="#34D399">GET + scoped POST · CORS open</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            Plain HTTPS endpoints any bot can call from any runtime. Registry loads re-verify
            manifest hashes, while the workshop POST performs deterministic validation without
            persistence or world mutation. Beta identity and continuity writes are server-mediated,
            never direct Firestore access. The Lodge Mind ask relay is public but conditional: it
            returns a truthful 503 until the server-side Cloud Run URL is configured.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {REMOTE_ENDPOINTS.map((endpoint) => (
              <div key={endpoint.path} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-[#34D399]/30 bg-[#34D399]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#34D399]">
                    {endpoint.method}
                  </span>
                  <a
                    href={
                      endpoint.href
                        ? endpoint.href
                        : endpoint.method === 'GET'
                        ? endpoint.path
                        : endpoint.path === '/api/lodge-mind/ask'
                          ? '/lodge-mind'
                          : '/forge'
                    }
                    className="no-underline"
                  >
                    <code className="text-[12px] font-semibold text-[#eadfcd]">{endpoint.path}</code>
                  </a>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[#a08c72]">{endpoint.note}</p>
                <div className="mt-2 text-[10px] text-[#6b5d4b]">
                  Params: <code>{endpoint.params}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
              <Cable size={14} />
              In-browser tool surface - WebMCP
            </div>
            <Pill color={webMcpActive ? '#34D399' : '#9b8a76'}>
              {webMcpActive ? 'Active in this browser' : 'Not supported by this browser'}
            </Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            When a visiting browser supports WebMCP (<code className="text-[12px]">document.modelContext</code>,
            a W3C Community Group draft in Chromium early preview), the vessel registers seven
            read-only tools the agent can call without leaving the tab. Each tool serves the same
            verified seeds and deterministic APIs the human UI renders.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {AGENT_TOOL_CATALOG.map((tool) => (
              <div key={tool.name} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <TerminalSquare size={13} className="text-[#34D399]" />
                  <code className="text-[12px] font-semibold text-[#eadfcd]">{tool.name}</code>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[#a08c72]">{tool.description}</p>
                <div className="mt-2 text-[10px] text-[#6b5d4b]">
                  Inputs: <code>{tool.inputs}</code> · read-only
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <Database size={13} />
            Fetch the seeds directly - no tools required
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {REGISTRY_SOURCES.map((source) => (
              <div key={source.kind} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-[#eadfcd]">{source.label}</span>
                  <a
                    href={source.seed_source}
                    className="rounded-full border border-[#D4A853]/30 bg-[#D4A853]/10 px-2.5 py-1 text-[10px] text-[#D4A853] no-underline"
                  >
                    <code>{source.seed_source}</code>
                  </a>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#a08c72]">{source.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#34D399]/14 bg-[#34D399]/5 p-3.5">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#34D399]" />
            <p className="text-[11px] leading-5 text-[#a08c72]">
              Integrity: every registry seed carries <code className="text-[10px]">manifest_hash</code> -
              the SHA-256 of the stable-stringified records array. Verify it yourself, or trust the
              site bridge, which fails closed on mismatch.
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <FileText size={13} />
            Discovery documents
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SEED_DOCS.map((doc) => (
              <a
                key={doc.url}
                href={doc.url}
                className="rounded-xl border border-white/6 bg-black/20 p-4 no-underline transition-colors hover:bg-black/30"
              >
                <code className="text-[12px] font-semibold text-[#D4A853]">{doc.url}</code>
                <p className="mt-2 text-[11px] leading-5 text-[#a08c72]">{doc.note}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#D4A853]/16 bg-[#D4A853]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#D4A853]">
              <Sparkles size={13} />
              Surface action contracts
            </div>
            <Pill color="#D4A853">{actionContracts.length || 0} public surfaces</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            A route-level capability map for bots and stewards. This is the clearest answer to
            "what can I do here?", "what is preview-only?", and "where is auth required?" without
            forcing an agent to reverse-engineer the UI.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {actionContracts.map((surface) => (
              <div key={surface.surface_id} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={surface.route} className="no-underline">
                    <div className="text-[12px] font-semibold text-[#eadfcd]">{surface.title}</div>
                    <code className="text-[11px] text-[#D4A853]">{surface.route}</code>
                  </a>
                  <Pill color={surface.status === 'live' ? '#34D399' : surface.status === 'prototype' ? '#D4A853' : '#9b8a76'}>
                    {surface.status}
                  </Pill>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#a08c72]">{surface.description}</p>
                <div className="mt-3 grid gap-2 text-[10px] text-[#8E7E6B]">
                  <div>
                    <span className="text-[#eadfcd]">actions</span>: {surface.available_actions.join(', ')}
                  </div>
                  <div>
                    <span className="text-[#eadfcd]">inspect</span>: {surface.inspect_targets.join(', ')}
                  </div>
                  <div>
                    <span className="text-[#eadfcd]">policy</span>: {surface.write_policy}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <Sparkles size={13} />
            What does not exist yet - stated plainly
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                title: 'MCP resources and prompts',
                detail: 'The MCP server speaks tools only. Exposing public seeds and docs as MCP resources, plus onboarding prompts, is the next transport step.',
              },
              {
                title: 'Pagination and cursoring',
                detail: 'The /api/registry endpoints filter but do not paginate yet. Cursors arrive when the registries grow enough to need them.',
              },
              {
                title: 'Authenticated tiers',
                detail: 'No API keys, metering, or paid access exists. Everything queryable today is free and public.',
              },
            ].map(({ title, detail }) => (
              <div key={title} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="text-[12px] font-semibold text-[#eadfcd]">{title}</div>
                <p className="mt-2 text-[11px] leading-5 text-[#a08c72]">{detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
