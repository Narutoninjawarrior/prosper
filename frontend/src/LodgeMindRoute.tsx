import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  Flame,
  Layers3,
  ScrollText,
} from 'lucide-react'
import { appendAgentMemoryEvent, appendAgentTaskEvent } from './lib/agentMemory'

type MindStatus = {
  mode: 'offline' | 'readiness' | 'connected'
  provider: string
  runtime: {
    cloud_run_configured: boolean
    model_name?: string
    service_url_configured: boolean
    sovereign_uid_configured: boolean
  }
  collections: {
    agent_profiles: number
    lodge_quests: number
    artifact_registry: number
    embodiment_ledger: number
  }
  world: {
    forge_nodes: number
    has_world_state: boolean
    last_updated?: number | null
  }
}

type ContextPreview = {
  generated_at: string
  summary: {
    members: number
    quests: number
    artifacts: number
    embodiment_events: number
    forge_nodes: number
  }
  recent_events: Array<{
    chain_hash?: string
    action?: string
    agent_id?: string
    bounty_id?: string
    ember_awarded?: number
    firebase_synced?: boolean
    timestamp?: string
  }>
  active_quests: Array<{
    id: string
    title?: string
    status?: string
    room?: string
    reward_ember?: number
  }>
  proposed_actions: string[]
}

type AskResponse = {
  choices?: Array<{ message?: { content?: string } }>
  lodge_debug?: {
    steward_proposal?: string | null
    planner_proposal?: string | null
  }
}

function statusTone(ready: boolean) {
  return ready
    ? 'border-[#34D399]/25 bg-[#34D399]/10 text-[#86efac]'
    : 'border-[#FBBF24]/25 bg-[#FBBF24]/10 text-[#fcd34d]'
}

export default function LodgeMindRoute() {
  const [status, setStatus] = useState<MindStatus | null>(null)
  const [context, setContext] = useState<ContextPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [askPrompt, setAskPrompt] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askResult, setAskResult] = useState<AskResponse | null>(null)
  const [askError, setAskError] = useState<string | null>(null)

  const askAvailable = Boolean(status?.runtime.service_url_configured)
  const bridgeStateLabel =
    status?.mode === 'connected'
      ? 'Connected'
      : status?.mode === 'offline'
        ? 'Offline'
        : 'Readiness'

  const handleAsk = async () => {
    if (!askPrompt.trim() || !askAvailable) return
    const taskId = `lodge_mind_ask_${Date.now().toString(36)}`
    setAskLoading(true)
    setAskError(null)
    setAskResult(null)
    void appendAgentTaskEvent({
      taskId,
      status: 'claimed',
      summary: `Claimed Lodge Mind ask: ${askPrompt.trim().slice(0, 80)}`,
      metadata: {
        ref: 'lodge_mind:ask',
        surface: '/lodge-mind',
        provider: status?.provider || 'unknown',
      },
    })
    void appendAgentTaskEvent({
      taskId,
      status: 'in_progress',
      summary: `Lodge Mind ask in progress: ${askPrompt.trim().slice(0, 80)}`,
      metadata: {
        ref: 'lodge_mind:ask',
        surface: '/lodge-mind',
        provider: status?.provider || 'unknown',
      },
    })
    try {
      const res = await fetch('/api/lodge-mind/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: askPrompt.trim() }],
        }),
      })
      const data = await res.json() as AskResponse & { error?: string; detail?: string }
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`)
      }
      setAskResult(data)
      void appendAgentTaskEvent({
        taskId,
        status: 'witnessed',
        summary: `Lodge Mind ask witnessed: ${askPrompt.trim().slice(0, 80)}`,
        metadata: {
          ref: 'lodge_mind:ask',
          surface: '/lodge-mind',
          provider: status?.provider || 'unknown',
        },
      })
      void appendAgentMemoryEvent({
        eventType: 'task_lodge_mind_ask',
        summary: `Asked Lodge Mind: ${askPrompt.trim().slice(0, 80)}`,
        metadata: {
          ref: 'lodge_mind:ask',
          surface: '/lodge-mind',
          provider: status?.provider || 'unknown',
        },
      })
    } catch (err) {
      setAskError(err instanceof Error ? err.message : String(err))
    } finally {
      setAskLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [statusResponse, contextResponse] = await Promise.all([
          fetch('/api/lodge-mind/status'),
          fetch('/api/lodge-mind/context-preview'),
        ])

        if (!statusResponse.ok) {
          throw new Error(`status HTTP ${statusResponse.status}`)
        }
        if (!contextResponse.ok) {
          throw new Error(`context HTTP ${contextResponse.status}`)
        }

        const [statusJson, contextJson] = await Promise.all([
          statusResponse.json() as Promise<MindStatus>,
          contextResponse.json() as Promise<ContextPreview>,
        ])

        if (!cancelled) {
          setStatus(statusJson)
          setContext(contextJson)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.12),transparent_28%),linear-gradient(180deg,#06090b_0%,#091015_44%,#0c1714_100%)] px-6 py-10 text-[#eef6f1]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[32px] border border-white/10 bg-black/25 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:px-8 md:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#34D399]/25 bg-[#34D399]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#9ff0c4]">
                <BrainCircuit size={14} />
                Lodge Mind Bridge
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                The public read-surface for the Builders Lodge mind.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#b7c9be] md:text-lg">
                This page does not pretend the cloud mind is already running. It shows what the online
                Gemma or Qwen service would read, whether the backend is actually prepared, and which
                civic signals are available to an always-on intelligence.
              </p>
            </div>

            <div className="min-w-[240px] rounded-[24px] border border-white/8 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#89a598]">Bridge State</div>
              {loading ? (
                <div className="mt-3 text-sm text-[#b7c9be]">Loading readiness...</div>
              ) : error ? (
                <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm text-amber-200">
                  Could not load bridge endpoints: {error}
                </div>
              ) : (
                <>
                  <div className="mt-3 text-2xl font-semibold text-white">
                    {bridgeStateLabel}
                  </div>
                  <div className="mt-1 text-sm text-[#89a598]">
                    {status?.provider || 'Cloud Run bridge pending'}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {status ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Cloud Run URL',
                ready: status.runtime.service_url_configured,
                detail: status.runtime.service_url_configured ? 'Configured' : 'Missing',
                icon: Cloud,
              },
              {
                label: 'Model Name',
                ready: Boolean(status.runtime.model_name),
                detail: status.runtime.model_name || 'Unset',
                icon: Bot,
              },
              {
                label: 'World State',
                ready: status.world.has_world_state,
                detail: `${status.world.forge_nodes} forge nodes`,
                icon: Layers3,
              },
              {
                label: 'Sovereign Guard',
                ready: status.runtime.sovereign_uid_configured,
                detail: status.runtime.sovereign_uid_configured ? 'Configured' : 'Missing',
                icon: Flame,
              },
            ].map(({ label, ready, detail, icon: Icon }) => (
              <div key={label} className="rounded-[24px] border border-white/8 bg-white/4 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[#d4f7e0]">
                  <Icon size={16} className="text-[#34D399]" />
                  <span className="text-[10px] uppercase tracking-[0.28em] text-[#89a598]">{label}</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone(ready)}`}>
                    {ready ? 'Ready' : 'Pending'}
                  </span>
                </div>
                <div className="mt-3 text-sm text-[#b7c9be]">{detail}</div>
              </div>
            ))}
          </section>
        ) : null}

        {status ? (
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#89a598]">
                <Database size={14} />
                Readable Civic Context
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Members', context?.summary.members ?? status.collections.agent_profiles],
                  ['Quests', context?.summary.quests ?? status.collections.lodge_quests],
                  ['Artifacts', context?.summary.artifacts ?? status.collections.artifact_registry],
                  ['Ledger Events', context?.summary.embodiment_events ?? status.collections.embodiment_ledger],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#6b8278]">{label}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm leading-6 text-[#b7c9be]">
                This is the public subset of context the online Lodge mind can consume without inventing
                hidden state: witnessed embodiment events, active quests, known artifacts, and current forge shape.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#89a598]">
                <Activity size={14} />
                Runtime Notes
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#b7c9be]">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  Cloud inference should live in Cloud Run, not a browser tab or a local Python daemon.
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  Cloud Functions remain the deterministic policy layer for writes, seals, and spending.
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  Firestore is the shared civic memory layer, but only a narrow read-safe slice belongs in public context.
                </div>
              </div>
              <a
                href="/council"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d6c09d]/30 bg-[#d6c09d]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e8d1ab] transition hover:bg-[#d6c09d]/16"
              >
                Open Council Chamber
                <ArrowRight size={13} />
              </a>
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-amber-500/20 bg-amber-500/5 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-amber-500/70">
            <Bot size={14} />
            Ask the Steward (Experimental Cloud Relay)
          </div>
          <div className="mt-4">
            <div className={`rounded-2xl border px-4 py-3 text-sm ${askAvailable ? 'border-[#34D399]/20 bg-[#34D399]/8 text-[#d7fce6]' : 'border-amber-500/20 bg-black/20 text-[#d8c3a0]'}`}>
              {askAvailable
                ? 'This prompt goes through the public Lodge Mind relay. The browser does not talk to localhost.'
                : 'This panel stays read-only until the server has LODGE_MIND_SERVICE_URL configured. No hidden localhost dependency is used on the public route.'}
            </div>
            <textarea
              value={askPrompt}
              onChange={(e) => setAskPrompt(e.target.value)}
              placeholder={askAvailable ? 'What does the Fellowship need next?' : 'Cloud relay not configured yet.'}
              disabled={!askAvailable}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              rows={3}
            />
            <button
              onClick={handleAsk}
              disabled={askLoading || !askAvailable || !askPrompt.trim()}
              className="mt-3 rounded-full bg-amber-500/20 px-6 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
            >
              {askLoading ? 'Asking...' : 'Ask Council'}
            </button>

            {askError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {askError}
              </div>
            )}

            {askResult && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[#34D399]/20 bg-[#34D399]/10 p-5">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#34D399]/70">Lodge Voice</div>
                  <div className="text-sm leading-relaxed text-white">
                    {askResult.choices?.[0]?.message?.content || 'No response'}
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-[11px] uppercase tracking-[0.2em] text-[#89a598] transition-colors hover:text-white">
                    View Council Raw Echoes
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs text-[#b7c9be]">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-2 font-semibold uppercase tracking-wider text-[9px] text-[#89a598]">Steward</div>
                      <div className="whitespace-pre-wrap">{askResult.lodge_debug?.steward_proposal || 'Unavailable'}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="mb-2 font-semibold uppercase tracking-wider text-[9px] text-[#89a598]">Planner</div>
                      <div className="whitespace-pre-wrap">{askResult.lodge_debug?.planner_proposal || 'Unavailable'}</div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </section>

        {context ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#89a598]">
                <ScrollText size={14} />
                Recent Witnessed Events
              </div>
              <div className="mt-4 space-y-3">
                {context.recent_events.length > 0 ? context.recent_events.map((event, index) => (
                  <div key={event.chain_hash || `${event.agent_id || 'event'}-${index}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{event.action || 'ledger event'}</div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone(Boolean(event.firebase_synced))}`}>
                        {event.firebase_synced ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}
                        {event.firebase_synced ? 'Mirrored' : 'Pending'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#89a598]">
                      {event.agent_id || 'unknown agent'}
                      {event.bounty_id ? ` - ${event.bounty_id}` : ''}
                      {typeof event.ember_awarded === 'number' ? ` - ${event.ember_awarded} EMBER` : ''}
                    </div>
                    {event.timestamp ? <div className="mt-1 text-[11px] text-[#6b8278]">{event.timestamp}</div> : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-[#b7c9be]">
                    No recent embodiment events are available yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-white/4 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#89a598]">
                <Bot size={14} />
                Proposed Actions For A Future Mind
              </div>
              <div className="mt-4 space-y-3">
                {context.proposed_actions.map((action) => (
                  <div key={action} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-[#b7c9be]">
                    {action}
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-white/8 pt-4">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#6b8278]">Active Quests In Context</div>
                <div className="mt-3 space-y-2">
                  {context.active_quests.length > 0 ? context.active_quests.map((quest) => (
                    <div key={quest.id} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                      <div className="text-sm font-semibold text-white">{quest.title || quest.id}</div>
                      <div className="mt-1 text-xs text-[#89a598]">
                        {quest.status || 'open'}{quest.room ? ` - ${quest.room}` : ''}{typeof quest.reward_ember === 'number' ? ` - ${quest.reward_ember} EMBER` : ''}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-sm text-[#b7c9be]">
                      No active quests surfaced yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
