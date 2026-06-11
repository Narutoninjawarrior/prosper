/**
 * /agent-access — Agent Access
 * The truthful contract page for machine consumers: what is queryable today,
 * in what format, what is live vs seeded vs experimental, and how the
 * in-browser WebMCP tool surface works. Read-only; nothing here implies a
 * backend API that does not exist.
 */
import { useEffect, useState } from 'react'
import { AGENT_TOOL_CATALOG, isWebMcpSupported, registerAgentTools } from './lib/agentTools'
import { REGISTRY_SOURCES } from './lib/registryAdapter'
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
    note: 'Normalized registry items across all four registries, filterable by kind, status, and free-text query. Includes per-seed SHA-256 verification results.',
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
    note: 'Safe public world_state summary: object counts by type, peak heat, plot counts when present. Counts only — no node payloads, no mutation.',
  },
  {
    method: 'GET',
    path: '/api/council/latest',
    params: 'none',
    note: 'Latest council proposal from the public seed. Labeled data_state: "seeded" — this is not a live governance feed yet.',
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
]

const SEED_DOCS = [
  { url: '/llms.txt', label: 'llms.txt', note: 'Markdown operating manual — the file IDE agents fetch first.' },
  { url: '/.well-known/ai.json', label: 'ai.json', note: 'Structured discovery manifest with every machine endpoint.' },
  { url: '/mission.md', label: 'mission.md', note: 'Mission narrative for humans and crawlers.' },
  { url: '/lodge-interface.json', label: 'lodge-interface.json', note: 'Deep interface map of the Lodge.' },
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

  useEffect(() => {
    setWebMcpActive(registerAgentTools() && isWebMcpSupported())
  }, [])

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.07),transparent_40%),linear-gradient(180deg,#0a0604_0%,#0c0a07_55%,#0a0805_100%)] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">

        {/* Hero */}
        <section className="rounded-[28px] border border-[#34D399]/16 bg-black/30 px-6 py-8 backdrop-blur-sm md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#34D399]">
            <Bot size={13} />
            Agent Access
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            What machines can query here, today
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#c9bba5]">
            Four manifest-verified registries, stamped community seeds, a deterministic blueprint
            validator, and an in-browser WebMCP tool surface. The discovery and workshop contracts
            documented here perform no writes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Pill color="#34D399">Seeds · live</Pill>
            <Pill color="#34D399">Remote API · stable read-only</Pill>
            <Pill color="#D4A853">MCP server · beta</Pill>
            <Pill color="#D4A853">Registry data · seeded</Pill>
            <Pill color="#9b8a76">WebMCP · experimental standard</Pill>
          </div>
        </section>

        {/* Remote MCP server */}
        <section className="rounded-[24px] border border-[#AA88FF]/16 bg-[#AA88FF]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#AA88FF]">
              <Cable size={14} />
              Remote MCP server — Streamable HTTP
            </div>
            <Pill color="#D4A853">Beta · stateless · read-only</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            A real Model Context Protocol endpoint at{' '}
            <code className="text-[12px] text-[#eadfcd]">POST /api/mcp</code>. Stateless Streamable
            HTTP: send JSON-RPC (<code className="text-[12px]">initialize</code>,{' '}
            <code className="text-[12px]">tools/list</code>, <code className="text-[12px]">tools/call</code>),
            get a single JSON response. No session, no SSE stream, no auth — every tool carries{' '}
            <code className="text-[12px]">readOnlyHint</code>. Same contract as the REST endpoints, MCP transport.
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

        {/* Remote read-only API */}
        <section className="rounded-[24px] border border-[#34D399]/14 bg-[#34D399]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#34D399]">
              <TerminalSquare size={14} />
              Remote read-only API — no browser required
            </div>
            <Pill color="#34D399">GET + validation POST · CORS open</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            Plain HTTPS endpoints any bot can call from any runtime. Registry loads re-verify
            manifest hashes, while the workshop POST performs deterministic validation without
            persistence or world mutation. No keys are required today.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {REMOTE_ENDPOINTS.map((endpoint) => (
              <div key={endpoint.path} className="rounded-xl border border-white/6 bg-black/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-[#34D399]/30 bg-[#34D399]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#34D399]">
                    {endpoint.method}
                  </span>
                  <a href={endpoint.method === 'GET' ? endpoint.path : '/forge'} className="no-underline">
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

        {/* WebMCP tool surface */}
        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
              <Cable size={14} />
              In-browser tool surface — WebMCP
            </div>
            <Pill color={webMcpActive ? '#34D399' : '#9b8a76'}>
              {webMcpActive ? 'Active in this browser' : 'Not supported by this browser'}
            </Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            When a visiting browser supports WebMCP (<code className="text-[12px]">document.modelContext</code>,
            a W3C Community Group draft in Chromium early preview), this site registers four read-only
            tools the agent can call without leaving the tab. Each tool serves the same verified seeds
            the human UI renders — same contract, same fail-closed integrity checks.
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

        {/* Fetchable seeds */}
        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <Database size={13} />
            Fetch the seeds directly — no tools required
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
              Integrity: every registry seed carries <code className="text-[10px]">manifest_hash</code> —
              the SHA-256 of the stable-stringified records array. Verify it yourself, or trust the
              site bridge, which fails closed on mismatch.
            </p>
          </div>
        </section>

        {/* Discovery docs */}
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

        {/* Honest roadmap */}
        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <Sparkles size={13} />
            What does not exist yet — stated plainly
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                title: 'MCP resources & prompts',
                detail: 'The MCP server speaks tools only. Exposing public seeds and docs as MCP resources, and onboarding prompts, is the next transport step.',
              },
              {
                title: 'Pagination & cursoring',
                detail: 'The /api/registry endpoints filter but do not paginate yet — record counts are small enough to return whole. Cursors arrive when the registries grow.',
              },
              {
                title: 'Authenticated tiers',
                detail: 'No API keys, no metering, no paid access exists. Everything queryable today is free and public.',
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
