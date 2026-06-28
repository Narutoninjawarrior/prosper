// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { Bot, Eye, FileStack, Filter, Gavel, Layers3, ScrollText, Sparkles, Activity, AlertTriangle } from 'lucide-react'
import { COUNCIL_PROPOSALS, type CouncilProposal, type ProposalDomain, type ProposalSource, type ProposalState } from './lib/councilProposals'
import { SomaticConsoleDrawer } from './SomaticConsoleDrawer'
import { SomaticParticleBackground } from './SomaticParticleBackground'
import { ExpandableProposalMatrix } from './ExpandableProposalMatrix'
import { SelfObservingHUD } from './SelfObservingHUD'
import { motion } from 'framer-motion'
import { TokenStreamer } from './TokenStreamer'
import { GlassHUDFrame } from './components/GlassHUDFrame'
import { TokenVerificationMatrix } from './components/TokenVerificationMatrix'
import { JsonExplorerPanel } from './components/JsonExplorerPanel'
import { FirewallPolicyDashboard } from './components/FirewallPolicyDashboard'
import { AgentRuntimeHUD } from './components/AgentRuntimeHUD'
import { useOpenClawSync } from './hooks/useOpenClawSync'
const STATE_STYLE: Record<ProposalState, string> = {
  draft: 'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fcd34d]',
  standing: 'border-[#34d399]/30 bg-[#34d399]/10 text-[#86efac]',
  witnessed: 'border-[#60a5fa]/30 bg-[#60a5fa]/10 text-[#93c5fd]',
  stale: 'border-white/10 bg-white/5 text-[#9ca3af]',
}

const SOURCE_LABEL: Record<ProposalSource, string> = {
  'local-council': 'Local Council',
  'steward-fallback': 'Steward Fallback',
  'planner-fallback': 'Planner Fallback',
}

const DOMAIN_LABEL: Record<ProposalDomain, string> = {
  world: 'World',
  quests: 'Quests',
  artifacts: 'Artifacts',
  onboarding: 'Onboarding',
}

const DOMAIN_TONE: Record<ProposalDomain, string> = {
  world: '#8FB996',
  quests: '#D4A853',
  artifacts: '#E8842A',
  onboarding: '#C68BA3',
}

const FILTERS: Array<'all' | ProposalDomain> = ['all', 'world', 'quests', 'artifacts', 'onboarding']

export function ProposalCard({ proposal }: { proposal: CouncilProposal }) {
  return (
    <motion.article 
      whileHover={{ scale: 1.01, y: -4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="rounded-[28px] border border-[#d9d0c2]/70 bg-[linear-gradient(180deg,rgba(255,251,244,0.86),rgba(248,241,231,0.78))] p-5 shadow-[0_18px_60px_rgba(56,39,20,0.08)] backdrop-blur-sm cursor-pointer hover:shadow-[0_25px_80px_rgba(56,39,20,0.12)] hover:border-[#a17b54]/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]"
            style={{ background: `${DOMAIN_TONE[proposal.domain]}22`, color: DOMAIN_TONE[proposal.domain] }}
          >
            {DOMAIN_LABEL[proposal.domain]}
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-[#273328]">{proposal.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6e6a62]">
            <span className={`rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.2em] ${STATE_STYLE[proposal.state]}`}>
              {proposal.state}
            </span>
            <span className="rounded-full border border-[#ddd2c2] bg-[#f7efe3] px-2.5 py-1 font-semibold uppercase tracking-[0.2em] text-[#6a5844]">
              {SOURCE_LABEL[proposal.source]}
            </span>
            <span>{new Date(proposal.generated_at).toLocaleString()}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#e2d7c7] bg-[#fffaf0] px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#847a6f]">Advisory only</div>
          <div className="mt-1 text-sm text-[#5e564e]">Human stewards endorse, amend, or reject.</div>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-[#cddfcf] bg-[linear-gradient(180deg,rgba(234,247,236,0.9),rgba(223,240,228,0.7))] px-5 py-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#59745f]">
          <Sparkles size={12} />
          Lodge synthesis
        </div>
        <p className="mt-2 text-base leading-7 text-[#243025]">{proposal.synthesis}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {proposal.context_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[#ded4c6] bg-[#fffaf2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#74675d]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[22px] border border-[#e0d7cb] bg-[#fff8ee]/90 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#7f6c61]">
            <Bot size={12} />
            Steward voice
          </div>
          <p className="mt-3 text-sm leading-7 text-[#4d4840]">{proposal.steward_voice}</p>
        </section>

        <section className="rounded-[22px] border border-[#d8dfd1] bg-[#f7fbf3]/90 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#65735d]">
            <Layers3 size={12} />
            Planner voice
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#3f4b3e]">{proposal.planner_voice}</p>
        </section>
      </div>

      <div className="mt-5 rounded-[22px] border border-[#ddd2c4] bg-[#fbf5ea]/90 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#7a6b60]">
          <ScrollText size={12} />
          Deliberation rail
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {proposal.timeline.map((item, index) => (
            <div key={`${proposal.id}-${item.step}`} className="flex items-center gap-2">
              <div className="rounded-full border border-[#d7ccbe] bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#655a52]">
                {item.label}
              </div>
              {index < proposal.timeline.length - 1 ? (
                <div className="h-px w-5 bg-[#d4c9bb]" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {['Endorse', 'Amend', 'Reject'].map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-[#d4c8b7] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5f564d] transition hover:bg-white"
          >
            {label}
          </button>
        ))}
      </div>
    </motion.article>
  )
}

export default function CouncilBoard() {
  const [activeFilter, setActiveFilter] = useState<'all' | ProposalDomain>('all')
  const [theta, setTheta] = useState<number>(0.82);

  useOpenClawSync((syncTheta) => {
    // Only accept community telemetry if the internal SCITT ledger is secure (>= 0)
    setTheta(prev => prev < 0 ? prev : syncTheta);
  });

  const [cachedProposals, setCachedProposals] = useState<any[]>([])
  // const [cacheLoading, setCacheLoading] = useState(true)
  // const [cacheError, setCacheError] = useState<string | null>(null)

  const renderProposalArea = () => {
    // For pure UI "fun" and demonstrating the void state + expandable matrix, 
    // we bypass the cache logic output and show either the fallback or the matrix.
    // To see the empty state, you can force proposalsList.length to 0. 
    // We'll show the matrix by default for visual impact.
    const showMatrix = cachedProposals.length > 0; 

    if (!showMatrix) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full p-8 border border-dashed border-[#a17b54]/40 rounded-[28px] text-center bg-[#fffaf2]/50 backdrop-blur-sm shadow-inner"
        >
          <span className="text-2xl block mb-2">📡</span>
          <h4 className="text-xs font-semibold tracking-[0.2em] text-[#8a6743] uppercase">Ledger Stream Uninitialized</h4>
          <p className="text-sm text-[#61584f] font-sans max-w-sm mx-auto mt-2">
            No live transactions detected on the chain-head. Click anywhere on the matrix to simulate systemic activity.
          </p>
        </motion.div>
      );
    }
    return <ExpandableProposalMatrix />;
  };

  useEffect(() => {
    let cancelled = false
    const fetchCache = async () => {
      try {
        const res = await fetch('/local_council_proposals.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        
        if (!cancelled) {
          setCachedProposals(data)
          setCacheError(null)
        }
      } catch (err) {
        if (!cancelled) {
          // setCacheError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          // setCacheLoading(false)
        }
      }
    }
    
    void fetchCache()
    return () => { cancelled = true }
  }, [])

  // const proposals = useMemo(
  //   () => activeFilter === 'all' ? COUNCIL_PROPOSALS : COUNCIL_PROPOSALS.filter((proposal) => proposal.domain === activeFilter),
  //   [activeFilter],
  // )

  return (
    <div className="min-h-full relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(234,196,145,0.18),transparent_28%),linear-gradient(180deg,#f5efe4_0%,#f4eadb_44%,#eee2d0_100%)] px-6 py-10 text-[#273328]">
      <SomaticParticleBackground theta={theta} />
      <SomaticConsoleDrawer />
      <div className="fixed left-8 top-1/2 -translate-y-1/2 z-40 xl:block hidden">
        <TokenStreamer />
      </div>
      <SelfObservingHUD />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 relative z-10 pb-16 pl-0 xl:pl-80">
        
        {/* Feature 7: Somatic Marker Threshold Heuristic Alarm */}
        {theta <= -0.5 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 rounded-[24px] border border-red-500/40 bg-red-500/10 p-5 shadow-[0_0_40px_rgba(239,68,68,0.2)] backdrop-blur-md relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              <AlertTriangle size={24} className="animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                CRITICAL THRESHOLD BREACH // θ = {theta.toFixed(2)}
              </h2>
              <p className="mt-1 text-xs font-semibold text-red-700/90 leading-relaxed max-w-3xl drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                Somatic Marker system has detected severe ledger dissonance. Multi-agent processing integrity is currently compromised. Automated ACU recovery routine initiating...
              </p>
            </div>
          </motion.div>
        )}

        <section className="rounded-[34px] border border-[#d8cdbf] bg-[linear-gradient(180deg,rgba(255,251,244,0.86),rgba(248,240,230,0.74))] px-6 py-8 shadow-[0_28px_90px_rgba(80,55,20,0.10)] backdrop-blur-sm md:px-8 md:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#a17b54]/25 bg-[#a17b54]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#8a6743]">
                <Gavel size={14} />
                Experimental Council Chamber
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#273328] md:text-5xl">
                Standing proposals for a governable Lodge.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#61584f] md:text-lg">
                This board treats council outputs as civic documents rather than chat bubbles.
                It shows the Steward, the Planner, the synthesized Lodge proposal, and the context
                that triggered each recommendation.
              </p>
            </div>

            <div className="min-w-[240px] rounded-[24px] border border-[#d8cdbf] bg-[#fff9f0]/85 p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7f7367]">Product honesty</div>
              <div className="mt-3 space-y-2 text-sm text-[#625a51]">
                <div className="rounded-2xl border border-[#e0d6c7] bg-white/80 px-3 py-2">Experimental local proposal board</div>
                <div className="rounded-2xl border border-[#e0d6c7] bg-white/80 px-3 py-2">Read-only prototype</div>
                <div className="rounded-2xl border border-[#e0d6c7] bg-white/80 px-3 py-2">No world writes</div>
              </div>
            </div>
            
            <div className="min-w-[240px] mt-6 lg:mt-0 flex-1 lg:flex-initial flex flex-col gap-6">
              <div className="rounded-[24px] border border-[#d8cdbf] bg-white/85 p-4">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-[#7f7367]">
                  <span>Somatic Valence (θ)</span>
                  <Activity size={14} className="text-[#10b981]" />
                </div>
                <div className="mt-3">
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-semibold ${theta < 0 ? 'text-red-500' : 'text-[#273328]'}`}>
                      {theta > 0 ? '+' : ''}{theta.toFixed(2)}
                    </span>
                    <span className={`mb-1 text-xs font-semibold uppercase tracking-[0.2em] ${theta < 0 ? 'text-red-500' : 'text-[#10b981]'}`}>
                      {theta < 0 ? 'Dissonant' : 'Resonant'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#847a6f]">
                    Emotensor approximation based on recent conviction voting cohesion. A DAG-inspired resonance metric.
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#f4eadb]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${theta < 0 ? 'bg-red-500' : 'bg-[#10b981]'}`}
                      style={{ 
                        width: `${Math.abs(theta) * 100}%`,
                        boxShadow: `0 0 12px ${theta < 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.6)'}`
                      }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-[#d7ccbd] bg-white/65 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[#7a6f63]">
              <FileStack size={13} />
              Why a board, not a chat log
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f564d]">
              <p>Chat hides the trigger, collapses the debate, and makes every answer feel disposable.</p>
              <p>A proposal board keeps the synthesis, the diverging voices, and the human review layer visible in one civic chamber.</p>
              <p>The result is legible sovereignty: the council advises, humans govern, and nothing executes from this surface.</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d7ccbd] bg-white/65 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[#7a6f63]">
              <Eye size={13} />
              Review pattern
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['Endorse', 'affirm a proposal as worth steward attention'],
                ['Amend', 'keep the insight but alter scope or wording'],
                ['Reject', 'refuse the recommendation without hiding it'],
              ].map(([label, detail]) => (
                <div key={label} className="rounded-2xl border border-[#e0d5c6] bg-[#fffaf2]/90 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#7f7366]">{label}</div>
                  <div className="mt-2 text-sm leading-6 text-[#5f564d]">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#d7ccbd] bg-white/60 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[#7a6f63]">
              <Filter size={12} />
              Filter proposals
            </div>
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  activeFilter === filter
                    ? 'border-[#8f775c] bg-[#8f775c]/10 text-[#6f573f]'
                    : 'border-[#d8ccbe] bg-[#fff9f0] text-[#72675d] hover:bg-white'
                }`}
              >
                {filter === 'all' ? 'All' : DOMAIN_LABEL[filter]}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 mb-8 grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            <TokenVerificationMatrix theta={theta} onVerificationResolved={setTheta} />
            <FirewallPolicyDashboard />
            <JsonExplorerPanel />
            <AgentRuntimeHUD />
          </div>
          <GlassHUDFrame title="Deliberation Matrix" subtitle="Live Proposal Stream" isAlertState={theta < 0}>
            {renderProposalArea()}
          </GlassHUDFrame>
        </section>
      </div>
    </div>
  )
}
