/**
 * /registry - Registry Explorer
 * One browseable surface for all public vessel registries.
 *
 * Read-only. All data flows through sanctuaryBridge (manifest-verified
 * seeds) and is rendered from the canonical NormalizedRegistryItem shape.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useContract, sanctuaryBridge, contractTrustSummary } from './lib/sanctuaryBridge'
import {
  REGISTRY_SOURCES,
  fromArtifact,
  fromTool,
  fromInterfaceModule,
  fromLodgeApp,
  fromMachine,
  fromApparatus,
  filterRegistryItems,
  type NormalizedRegistryItem,
  type RegistryKind,
} from './lib/registryAdapter'
import { loadRegistryInspect, type InspectPayload } from './lib/inspectBridge'
import { appendAgentMemoryEvent } from './lib/agentMemory'
import InspectRail from './inspect/InspectRail'
import {
  Archive,
  Bot,
  Compass,
  Database,
  Layers,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

const KIND_META: Record<RegistryKind, { label: string; pluralLabel: string; accent: string; icon: React.ReactNode }> = {
  artifact: { label: 'Artifact', pluralLabel: 'Artifacts', accent: '#A78BFA', icon: <Archive size={13} /> },
  tool: { label: 'Tool', pluralLabel: 'Tools', accent: '#34D399', icon: <Wrench size={13} /> },
  interface_module: { label: 'Interface Module', pluralLabel: 'Interface Modules', accent: '#E8842A', icon: <Layers size={13} /> },
  lodge_app: { label: 'Lodge App', pluralLabel: 'Lodge Apps', accent: '#D4A853', icon: <Compass size={13} /> },
  machine: { label: 'Machine', pluralLabel: 'Machines', accent: '#60A5FA', icon: <Bot size={13} /> },
  apparatus: { label: 'Apparatus', pluralLabel: 'Apparatus', accent: '#F472B6', icon: <Wrench size={13} /> },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  live: { label: 'Live', color: '#34D399' },
  seeded: { label: 'Seeded', color: '#D4A853' },
  mirrored: { label: 'Mirrored', color: '#60A5FA' },
  prototype: { label: 'Prototype', color: '#9b8a76' },
}

const AGENT_USE_CASES = [
  {
    title: 'Adopt a soul file',
    detail: 'Fetch artifact records tagged "agent" to seed a new steward persona with witnessed provenance.',
  },
  {
    title: 'Inspect a tool',
    detail: 'Read tool records to learn what interaction capabilities exist before proposing new ones.',
  },
  {
    title: 'Load an interface module',
    detail: 'Interface module records map every public route to its source so a builder or bot can navigate honestly.',
  },
  {
    title: 'Query live apparatus',
    detail: 'Apparatus records expose real REST and MCP surfaces, so agents can discover endpoints before they call them.',
  },
  {
    title: 'Traverse lineage',
    detail: 'Follow source_pointer and route_pointer across registries to walk from a seed file to a live surface.',
  },
]

function isRegistryKind(value: string | null): value is RegistryKind {
  return value === 'artifact'
    || value === 'tool'
    || value === 'interface_module'
    || value === 'lodge_app'
    || value === 'machine'
    || value === 'apparatus'
}

function updateRegistryUrl(kind: RegistryKind | 'all', status: string, query: string, id?: string | null) {
  const params = new URLSearchParams(window.location.search)

  if (kind === 'all') params.delete('kind')
  else params.set('kind', kind)

  if (status === 'all') params.delete('status')
  else params.set('status', status)

  if (!query.trim()) params.delete('q')
  else params.set('q', query.trim())

  if (id) params.set('id', id)
  else params.delete('id')

  const next = params.toString()
  window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`)
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, color: '#8E7E6B' }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ borderColor: `${meta.color}44`, background: `${meta.color}14`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function RegistryCard({
  item,
  onInspect,
}: {
  item: NormalizedRegistryItem
  onInspect: (item: NormalizedRegistryItem) => void
}) {
  const kind = KIND_META[item.kind]
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-white/8 bg-white/4 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/6">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: `linear-gradient(180deg, ${kind.accent}88 0%, ${kind.accent}18 100%)` }}
      />
      <div className="pl-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]"
            style={{ background: `${kind.accent}18`, color: kind.accent }}
          >
            {kind.icon}
            {kind.label}
          </span>
          <StatusBadge status={item.status} />
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug text-white">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#c9bba5]">{item.summary}</p>
        <p className="mt-2 text-[11px] italic leading-5 text-[#8a7a64]">{item.provenance}</p>

        <div className="mt-3 grid gap-1.5">
          {item.facets.map((facet) => (
            <div key={facet.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-black/20 px-2.5 py-1.5 text-[10px]">
              <span className="text-[#8a7a64]">{facet.label}</span>
              <span className="text-right text-[#eadfcd]">{facet.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-black/20 px-2.5 py-1.5 text-[10px]">
            <span className="text-[#8a7a64]">Source</span>
            <code className="text-right text-[10px] text-[#b89c82]">{item.source_pointer}</code>
          </div>
        </div>

        {item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-[#a08c72]">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onInspect(item)}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#eadfcd]"
            >
              Inspect
            </button>
            <a
              href={item.route_pointer}
              className="text-[11px] font-semibold text-[#D4A853] no-underline hover:text-[#eadfcd]"
            >
              Visit {item.route_pointer} -&gt;
            </a>
          </div>
          <span className="text-[10px] text-[#6b5d4b]">{item.updated_at.slice(0, 10)}</span>
        </div>
      </div>
    </article>
  )
}

function witnessRegistryInspect(item: NormalizedRegistryItem) {
  void appendAgentMemoryEvent({
    eventType: 'inspect_registry_record',
    summary: `Inspected ${item.kind} ${item.title}`,
    metadata: {
      ref: `${item.kind}:${item.id}`,
      route: item.route_pointer,
      status: item.status,
    },
  })
}

export default function RegistryExplorer() {
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<RegistryKind | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [inspectPayload, setInspectPayload] = useState<InspectPayload | null>(null)
  const [inspectTarget, setInspectTarget] = useState<NormalizedRegistryItem | null>(null)
  const [inspectState, setInspectState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const inspectRequestRef = useRef(0)

  const artifactsEnvelope = useContract('/artifact_registry.json', sanctuaryBridge.normalizeArtifacts, [])
  const toolsEnvelope = useContract('/tool_registry.json', sanctuaryBridge.normalizeTools, [])
  const modulesEnvelope = useContract('/interface_modules.json', sanctuaryBridge.normalizeInterfaceModules, [])
  const appsEnvelope = useContract('/lodge_apps.json', sanctuaryBridge.normalizeLodgeApps, [])
  const machinesEnvelope = useContract('/machine_registry.json', sanctuaryBridge.normalizeMachines, [])
  const apparatusEnvelope = useContract('/apparatus_registry.json', sanctuaryBridge.normalizeApparatus, [])

  const allItems = useMemo<NormalizedRegistryItem[]>(() => [
    ...artifactsEnvelope.data.map(fromArtifact),
    ...toolsEnvelope.data.map(fromTool),
    ...modulesEnvelope.data.map(fromInterfaceModule),
    ...appsEnvelope.data.map(fromLodgeApp),
    ...machinesEnvelope.data.map(fromMachine),
    ...apparatusEnvelope.data.map(fromApparatus),
  ], [
    artifactsEnvelope.data,
    toolsEnvelope.data,
    modulesEnvelope.data,
    appsEnvelope.data,
    machinesEnvelope.data,
    apparatusEnvelope.data,
  ])

  const filtered = useMemo(
    () => filterRegistryItems(allItems, { query, kind: kindFilter, status: statusFilter }),
    [allItems, query, kindFilter, statusFilter],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of allItems) counts[item.status] = (counts[item.status] || 0) + 1
    return counts
  }, [allItems])

  const envelopes = [
    { label: 'Artifacts', envelope: artifactsEnvelope },
    { label: 'Tools', envelope: toolsEnvelope },
    { label: 'Interface Modules', envelope: modulesEnvelope },
    { label: 'Lodge Apps', envelope: appsEnvelope },
    { label: 'Machines', envelope: machinesEnvelope },
    { label: 'Apparatus', envelope: apparatusEnvelope },
  ]

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kind = params.get('kind')
    const q = params.get('q')
    const status = params.get('status')

    if (isRegistryKind(kind)) setKindFilter(kind)
    if (q) setQuery(q)
    if (status) setStatusFilter(status)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kind = params.get('kind')
    const id = params.get('id')
    if (!isRegistryKind(kind) || !id) return

    const requestId = inspectRequestRef.current + 1
    inspectRequestRef.current = requestId
    setInspectState('loading')
    loadRegistryInspect(kind, id)
      .then((payload) => {
        if (inspectRequestRef.current !== requestId) return
        const item = allItems.find((row) => row.kind === kind && row.id === id) ?? null
        if (!payload || !item) {
          setInspectPayload(null)
          setInspectTarget(null)
          setInspectState('error')
          return
        }
        witnessRegistryInspect(item)
        setInspectPayload(payload)
        setInspectTarget(item)
        setInspectState('ready')
      })
      .catch(() => {
        if (inspectRequestRef.current !== requestId) return
        setInspectPayload(null)
        setInspectTarget(null)
        setInspectState('error')
      })
  }, [allItems])

  function openInspect(item: NormalizedRegistryItem) {
    const requestId = inspectRequestRef.current + 1
    inspectRequestRef.current = requestId
    setKindFilter(item.kind)
    setInspectTarget(item)
    setInspectState('loading')
    updateRegistryUrl(item.kind, statusFilter, query, item.id)
    loadRegistryInspect(item.kind, item.id)
      .then((payload) => {
        if (inspectRequestRef.current !== requestId) return
        witnessRegistryInspect(item)
        setInspectPayload(payload)
        setInspectState(payload ? 'ready' : 'error')
      })
      .catch(() => {
        if (inspectRequestRef.current !== requestId) return
        setInspectPayload(null)
        setInspectState('error')
      })
  }

  function closeInspect() {
    setInspectPayload(null)
    setInspectTarget(null)
    setInspectState('idle')
    updateRegistryUrl(kindFilter, statusFilter, query, null)
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.08),transparent_42%),linear-gradient(180deg,#0a0604_0%,#0d0907_55%,#0a0805_100%)] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[28px] border border-[#D4A853]/16 bg-black/30 px-6 py-8 backdrop-blur-sm md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#D4A853]">
                <Database size={13} />
                Registry Explorer
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Everything the vessel knows about itself
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#c9bba5]">
                Artifacts, tools, interface modules, lodge apps, machines, and apparatus live here
                in one browseable surface. What you see is exactly what a bot fetching the public
                seeds would see.
              </p>
            </div>

            <div className="grid min-w-[220px] gap-2 rounded-[20px] border border-white/8 bg-white/4 p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#8a7a64]">Records</div>
              <div className="text-3xl font-semibold text-white">{allItems.length}</div>
              <div className="grid gap-1 border-t border-white/8 pt-2">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-[11px]">
                    <span style={{ color: STATUS_META[status]?.color || '#8E7E6B' }}>
                      {STATUS_META[status]?.label || status}
                    </span>
                    <span className="text-[#c9bba5]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {envelopes.map(({ label, envelope }) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-white/6 bg-black/20 px-3 py-2 text-[10px]">
                <ShieldCheck size={12} className={envelope.verified ? 'text-[#34D399]' : 'text-[#9b8a76]'} />
                <span className="text-[#c9bba5]">{label}</span>
                <span className="ml-auto text-[#8a7a64]">
                  {contractTrustSummary(envelope.state, envelope.verified, envelope.error)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <Search size={15} className="text-[#8a7a64]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, tags, provenance, pointers..."
              className="w-full bg-transparent text-sm text-[#eadfcd] outline-none placeholder:text-[#6b5d4b]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[10px] text-[#c9bba5]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all ${
                kindFilter === 'all'
                  ? 'border-white/25 bg-white/10 text-white'
                  : 'border-white/8 text-[#8a7a64] hover:text-white'
              }`}
            >
              All kinds · {allItems.length}
            </button>
            {(Object.keys(KIND_META) as RegistryKind[]).map((kind) => {
              const meta = KIND_META[kind]
              const count = allItems.filter((item) => item.kind === kind).length
              const active = kindFilter === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKindFilter(active ? 'all' : kind)}
                  className="rounded-full border px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all"
                  style={active
                    ? { borderColor: `${meta.accent}55`, background: `${meta.accent}18`, color: meta.accent }
                    : { borderColor: 'rgba(255,255,255,0.08)', color: '#8a7a64' }}
                >
                  {meta.pluralLabel} · {count}
                </button>
              )
            })}

            <span className="mx-1 h-4 w-px bg-white/10" />

            {['all', 'live', 'seeded', 'prototype', 'mirrored'].map((status) => {
              const active = statusFilter === status
              const color = status === 'all' ? '#c9bba5' : (STATUS_META[status]?.color || '#8E7E6B')
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className="rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all"
                  style={active
                    ? { borderColor: `${color}55`, background: `${color}16`, color }
                    : { borderColor: 'rgba(255,255,255,0.06)', color: '#6b5d4b' }}
                >
                  {status === 'all' ? 'Any status' : STATUS_META[status]?.label || status}
                </button>
              )
            })}
          </div>
        </section>

        {filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <RegistryCard key={`${item.kind}-${item.id}`} item={item} onInspect={openInspect} />
            ))}
          </div>
        ) : (
          <div className="rounded-[20px] border border-white/8 bg-white/3 px-6 py-10 text-center text-sm text-[#8a7a64]">
            {allItems.length === 0
              ? 'Registry seeds are loading or unavailable.'
              : 'No records match the current filters.'}
          </div>
        )}

        <section className="rounded-[24px] border border-[#34D399]/14 bg-[#34D399]/4 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#34D399]">
            <Bot size={14} />
            What agents can do with these records
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {AGENT_USE_CASES.map(({ title, detail }) => (
              <div key={title} className="rounded-xl border border-white/6 bg-black/20 p-3.5">
                <div className="text-[12px] font-semibold text-[#eadfcd]">{title}</div>
                <p className="mt-1.5 text-[11px] leading-5 text-[#a08c72]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-white/8 bg-white/3 px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8a7a64]">
            <Database size={13} />
            Machine access - fetch the seeds directly
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
          <p className="mt-4 text-[11px] leading-5 text-[#6b5d4b]">
            Every seed carries a <code className="text-[10px]">manifest_hash</code> (SHA-256 of the
            normalized records array). Read-only today; an MCP/API layer over these same records is
            the planned next step - no client write paths exist or are implied here.
          </p>
        </section>
      </div>

      <InspectRail
        visible={inspectState !== 'idle'}
        draggable
        accent={inspectPayload?.accent ?? (inspectTarget ? KIND_META[inspectTarget.kind].accent : '#D4A853')}
        eyebrow={inspectPayload?.eyebrow ?? (inspectTarget ? `${inspectTarget.kind} · ${inspectTarget.status}` : 'inspect')}
        title={inspectPayload?.title ?? inspectTarget?.title ?? 'Registry record'}
        summary={inspectState === 'loading'
          ? 'Loading registry inspect...'
          : inspectState === 'error'
            ? 'Inspect payload unavailable.'
            : inspectPayload?.summary ?? ''}
        details={inspectPayload?.details ?? []}
        code={inspectPayload?.code}
        footer={inspectPayload?.footer ?? ''}
        actions={[
          ...(inspectPayload?.actions ?? []).map((action) => ({
            label: action.label,
            tone: action.tone,
            onClick: () => { if (action.href) window.open(action.href, '_blank') },
          })),
          { label: 'Close', tone: 'primary', onClick: closeInspect },
        ]}
        onClose={closeInspect}
      />
    </div>
  )
}
