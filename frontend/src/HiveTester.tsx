/**
 * HiveTester — local-only dev tool for the Builders Lodge Hive prototype.
 * Mounted at /os/hive only. Not linked from any public surface.
 *
 * Talks to http://localhost:8000/v1/chat/completions.
 * No execution authority. No world writes. No wallet logic.
 */
import { useState, useRef } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Loader2,
  Send,
  ShieldOff,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react'

const HIVE_URL = 'http://localhost:8000'

type CouncilMode = 'multi-backend' | 'single-url-multi-model' | 'single-backend-fallback' | string

interface LodgeDebug {
  request_id?: string
  council_mode?: CouncilMode
  firebase_context_available?: boolean
  steward_model?: string
  planner_model?: string
  aggregator_model?: string
  steward_ok?: boolean
  planner_ok?: boolean
  aggregator_ok?: boolean
  steward_proposal?: string | null
  planner_proposal?: string | null
  steward_error?: string | null
  planner_error?: string | null
  aggregator_error?: string | null
}

interface HiveResponse {
  id?: string
  model?: string
  created?: number
  choices?: Array<{ message?: { content?: string } }>
  lodge_debug?: LodgeDebug
}

type RequestState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; response: HiveResponse }
  | { phase: 'error'; message: string; detail?: string }

const COUNCIL_MODE_STYLE: Record<string, { label: string; cls: string }> = {
  'multi-backend':           { label: 'Multi-Backend', cls: 'border-[#34D399]/40 bg-[#34D399]/10 text-[#6ee7b7]' },
  'single-url-multi-model':  { label: 'Single URL / Multi-Model', cls: 'border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#fcd34d]' },
  'single-backend-fallback': { label: 'Single-Backend Fallback', cls: 'border-[#f87171]/40 bg-[#f87171]/10 text-[#fca5a5]' },
}

function CouncilBadge({ mode }: { mode?: string }) {
  if (!mode) return null
  const s = COUNCIL_MODE_STYLE[mode] ?? { label: mode, cls: 'border-white/20 bg-white/5 text-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${s.cls}`}>
      <Activity size={10} />
      {s.label}
    </span>
  )
}

function ProposerRow({
  label,
  model,
  ok,
  proposal,
  error,
  color,
}: {
  label: string
  model?: string
  ok?: boolean
  proposal?: string | null
  error?: string | null
  color: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/8 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color }}>
            {label}
          </span>
          {model && <code className="text-[10px] text-[#6b8278]">{model}</code>}
        </div>
        <div className="flex items-center gap-2">
          {ok === true  && <CheckCircle2 size={13} className="text-[#34D399]" />}
          {ok === false && <AlertTriangle size={13} className="text-[#f87171]" />}
          {open ? <ChevronDown size={14} className="text-[#6b8278]" /> : <ChevronRight size={14} className="text-[#6b8278]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-white/6 px-4 pb-4 pt-3">
          {ok && proposal ? (
            <p className="text-sm leading-7 text-[#b7c9be]">{proposal}</p>
          ) : (
            <p className="text-xs text-[#f87171]">{error ?? 'No output'}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function HiveTester() {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<RequestState>({ phase: 'idle' })
  const [healthResult, setHealthResult] = useState<Record<string, unknown> | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function submitPrompt() {
    if (!prompt.trim() || state.phase === 'loading') return
    setState({ phase: 'loading' })
    try {
      const res = await fetch(`${HIVE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt.trim() }],
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        setState({ phase: 'error', message: `HTTP ${res.status}`, detail: text })
        return
      }
      const data: HiveResponse = await res.json()
      setState({ phase: 'done', response: data })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setState({
        phase: 'error',
        message: 'Could not reach hive endpoint',
        detail: `${HIVE_URL} — ${msg}. Is hive_local.py running?`,
      })
    }
  }

  async function pingHealth() {
    setHealthLoading(true)
    setHealthResult(null)
    try {
      const res = await fetch(`${HIVE_URL}/health`)
      const data = await res.json()
      setHealthResult(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setHealthResult({ error: msg })
    } finally {
      setHealthLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submitPrompt()
    }
  }

  const finalContent =
    state.phase === 'done'
      ? state.response.choices?.[0]?.message?.content ?? '(no content)'
      : null

  const debug = state.phase === 'done' ? state.response.lodge_debug : null

  return (
    <div className="min-h-screen bg-[#060709] px-6 py-8 font-sans text-[#eef6f1]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">

        {/* Warning banner — always visible */}
        <div className="flex items-start gap-3 rounded-2xl border border-[#f87171]/30 bg-[#f87171]/8 px-4 py-3">
          <ShieldOff size={18} className="mt-0.5 shrink-0 text-[#f87171]" />
          <div>
            <div className="text-sm font-semibold text-[#fca5a5]">
              Local Prototype Only · No Execution Authority · No World Writes
            </div>
            <div className="mt-0.5 text-[11px] leading-5 text-[#6b8278]">
              This tester talks to <code className="text-[10px]">localhost:8000</code>.
              The Hive may only propose — all writes are Cloud Function–gated and Sovereign-vetoed.
              Do not expose this route publicly.
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#E8842A]/30 bg-[#E8842A]/10 p-2 text-[#E8842A]">
              <Flame size={20} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.38em] text-[#6b8278]">Builders Lodge</div>
              <h1 className="text-xl font-semibold text-white">Hive Council Tester</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={pingHealth}
            disabled={healthLoading}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#89a598] transition hover:bg-white/8 disabled:opacity-50"
          >
            {healthLoading
              ? <Loader2 size={13} className="animate-spin" />
              : healthResult
                ? ('error' in healthResult ? <WifiOff size={13} className="text-[#f87171]" /> : <Wifi size={13} className="text-[#34D399]" />)
                : <Wifi size={13} />}
            /health
          </button>
        </div>

        {/* Health result */}
        {healthResult && (
          <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#6b8278]">
              <Terminal size={11} />
              Health response
            </div>
            <pre className="overflow-x-auto text-[11px] leading-5 text-[#89a598]">
              {JSON.stringify(healthResult, null, 2)}
            </pre>
          </div>
        )}

        {/* Prompt input */}
        <div className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-black/25 p-5">
          <label className="text-[10px] uppercase tracking-[0.35em] text-[#6b8278]">
            Council prompt
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKey}
            placeholder="What should the Lodge work on next?"
            rows={4}
            className="w-full resize-none rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[#eef6f1] placeholder:text-[#4d6358] focus:border-white/16 focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#4d6358]">⌘ + Enter to submit</span>
            <button
              type="button"
              onClick={submitPrompt}
              disabled={!prompt.trim() || state.phase === 'loading'}
              className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-2.5 text-sm font-semibold text-[#041109] transition hover:bg-[#25cf8a] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state.phase === 'loading'
                ? <><Loader2 size={15} className="animate-spin" /> Deliberating…</>
                : <><Send size={15} /> Submit to Council</>}
            </button>
          </div>
        </div>

        {/* Error state */}
        {state.phase === 'error' && (
          <div className="rounded-2xl border border-[#f87171]/30 bg-[#f87171]/8 px-5 py-4">
            <div className="flex items-center gap-2 font-semibold text-[#fca5a5]">
              <WifiOff size={16} />
              {state.message}
            </div>
            {state.detail && (
              <p className="mt-2 text-[11px] leading-5 text-[#6b8278]">{state.detail}</p>
            )}
          </div>
        )}

        {/* Response */}
        {state.phase === 'done' && (
          <div className="flex flex-col gap-4">

            {/* Lodge response */}
            <div className="rounded-[24px] border border-[#10b981]/20 bg-black/30 px-6 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="text-[10px] uppercase tracking-[0.35em] text-[#6b8278]">Lodge Voice</div>
                <CouncilBadge mode={debug?.council_mode} />
                {debug?.firebase_context_available === false && (
                  <span className="rounded-full border border-[#FBBF24]/30 bg-[#FBBF24]/8 px-2.5 py-1 text-[10px] text-[#fcd34d]">
                    Firebase context unavailable
                  </span>
                )}
              </div>
              <p className="text-base leading-8 text-[#d4f7e0]">{finalContent}</p>
              {state.response.id && (
                <div className="mt-4 font-mono text-[10px] text-[#3d5349]">{state.response.id}</div>
              )}
            </div>

            {/* Proposer echoes */}
            {debug && (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#4d6358]">Proposer echoes</div>
                <ProposerRow
                  label="Steward"
                  model={debug.steward_model}
                  ok={debug.steward_ok}
                  proposal={debug.steward_proposal}
                  error={debug.steward_error}
                  color="#A78BFA"
                />
                <ProposerRow
                  label="Planner"
                  model={debug.planner_model}
                  ok={debug.planner_ok}
                  proposal={debug.planner_proposal}
                  error={debug.planner_error}
                  color="#60A5FA"
                />
                {debug.aggregator_error && (
                  <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/8 px-4 py-3 text-[11px] text-[#fca5a5]">
                    Aggregator error: {debug.aggregator_error}
                  </div>
                )}
              </div>
            )}

            {/* Raw debug */}
            {debug && (
              <details className="rounded-xl border border-white/6 bg-black/20">
                <summary className="cursor-pointer px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-[#4d6358] hover:text-[#6b8278]">
                  Raw lodge_debug
                </summary>
                <pre className="overflow-x-auto px-4 pb-4 pt-2 text-[10px] leading-5 text-[#4d6358]">
                  {JSON.stringify(debug, null, 2)}
                </pre>
              </details>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
