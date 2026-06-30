import { useMemo } from 'react'
import { BrainCircuit, ShieldAlert, ShieldCheck, Activity } from 'lucide-react'
import { ActiveInferenceAgentCore } from '../lib/ActiveInferenceAgentCore'

export function ActiveInferenceAdvisoryCard({ theta }: { theta: number }) {
  const assessment = useMemo(() => {
    const core = new ActiveInferenceAgentCore(0.82)
    return {
      beliefs: core.getCurrentBeliefMatrix(),
      result: core.evaluateSensoryInput(theta),
    }
  }, [theta])

  const tone =
    assessment.result.confidenceBand === 'strain'
      ? {
          border: 'border-red-500/20',
          bg: 'bg-red-500/8',
          text: 'text-red-200',
          accent: 'text-red-400',
          bar: 'bg-red-500',
          Icon: ShieldAlert,
        }
      : assessment.result.confidenceBand === 'watch'
        ? {
            border: 'border-[#FBBF24]/20',
            bg: 'bg-[#FBBF24]/8',
            text: 'text-[#f5dfb0]',
            accent: 'text-[#FBBF24]',
            bar: 'bg-[#FBBF24]',
            Icon: Activity,
          }
        : {
            border: 'border-[#34D399]/20',
            bg: 'bg-[#34D399]/8',
            text: 'text-[#ccebd8]',
            accent: 'text-[#34D399]',
            bar: 'bg-[#34D399]',
            Icon: ShieldCheck,
          }

  const StatusIcon = tone.Icon

  return (
    <section className={`rounded-[20px] border ${tone.border} ${tone.bg} p-4 font-mono`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">
          <BrainCircuit size={13} />
          Predictive Balance Advisory
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] ${tone.border} ${tone.accent}`}>
          local model only
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className={`mt-0.5 rounded-full border p-2 ${tone.border} ${tone.accent}`}>
          <StatusIcon size={14} />
        </div>
        <div className="min-w-0">
          <div className={`text-[11px] uppercase tracking-[0.18em] ${tone.accent}`}>
            {assessment.result.actionRecommendation}
          </div>
          <p className={`mt-2 text-[11px] leading-5 ${tone.text}`}>
            {assessment.result.advisorySummary}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Observed theta</div>
          <div className="mt-1 text-[#FAF6EF]">{theta.toFixed(3)}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Expected theta</div>
          <div className="mt-1 text-[#FAF6EF]">{assessment.beliefs.expectedTheta.toFixed(3)}</div>
        </div>
        <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Prediction error</div>
          <div className="mt-1 text-[#FAF6EF]">{assessment.result ? Math.abs(theta - assessment.beliefs.expectedTheta).toFixed(3) : '0.000'}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">
          <span>Convergence glow</span>
          <span>{Math.round(assessment.result.convergenceGlow * 100)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
            style={{ width: `${Math.max(8, Math.round(assessment.result.convergenceGlow * 100))}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-[10px] leading-5 text-[#9b8a76]">
        This panel is a local advisory heuristic derived from the current Council theta. It does not train a model,
        execute writes, or control any downstream system.
      </p>
    </section>
  )
}
