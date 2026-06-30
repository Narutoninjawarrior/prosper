import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitBranch, Hand, ShieldAlert, Sparkles } from 'lucide-react';
import { scanAuthority } from '../lib/semanticShield';

type DivergenceField = {
  key: string;
  label: string;
  canonical: string;
  agentA: string;
  agentB: string;
};

type ResolutionOption = {
  id: string;
  title: string;
  summary: string;
  result: string;
};

type AgentState = {
  id: string;
  name: string;
  role: string;
  color: string;
  stance: string;
};

type SemanticDivergenceDemoProps = {
  title?: string;
  definitionLabel?: string;
  contractId?: string;
  agentA?: AgentState;
  agentB?: AgentState;
  fields?: DivergenceField[];
  resolutionOptions?: ResolutionOption[];
};

const DEFAULT_AGENT_A: AgentState = {
  id: 'atlas',
  name: 'Atlas',
  role: 'Execution steward',
  color: '#C97345',
  stance: 'Treats receipt acknowledgment as enough to proceed.',
};

const DEFAULT_AGENT_B: AgentState = {
  id: 'sable',
  name: 'Sable',
  role: 'Trust boundary auditor',
  color: '#7A8F66',
  stance: 'Treats receipt acknowledgment as insufficient without explicit human resolution.',
};

const DEFAULT_FIELDS: DivergenceField[] = [
  {
    key: 'public_witnessed',
    label: 'Public Witnessed',
    canonical: 'Acknowledged by the configured witness service or dev stub; receipt returned.',
    agentA: 'Receipt exists. Continue to the next automatable step.',
    agentB: 'Receipt exists, but halt until a human confirms whether the witness is production-grade or stub-only.',
  },
  {
    key: 'publication_scope',
    label: 'Publication Scope',
    canonical: 'Local artifacts stay browser-local until explicitly promoted.',
    agentA: 'Visible in Commons means ready for wider coordination.',
    agentB: 'Visible in Commons local lanes still means session-local, not public proof.',
  },
  {
    key: 'actionability',
    label: 'Actionability',
    canonical: 'Ambiguity must fail closed and request resolution.',
    agentA: 'Interpret the most permissive meaning that still passes schema checks.',
    agentB: 'Interpret the narrowest safe meaning and pause on ambiguity.',
  },
];

const DEFAULT_RESOLUTIONS: ResolutionOption[] = [
  {
    id: 'strict-local',
    title: 'Keep local-only boundary',
    summary: 'Treat this receipt as coordination context only.',
    result: 'Both agents converge on local-only semantics. No public proof or downstream automation is permitted.',
  },
  {
    id: 'staged-review',
    title: 'Escalate to steward review',
    summary: 'Allow the artifact to remain inspectable, but hold any consequential action.',
    result: 'The system records a steward-needed flag. Agents can continue reading but cannot promote or spend against the result.',
  },
  {
    id: 'production-witness',
    title: 'Mark production witness required',
    summary: 'Declare the definition unresolved until a production witness path exists.',
    result: 'Both agents converge on a blocked state. The contract remains valid, but execution is paused until the witness path is upgraded.',
  },
];

function agentNarrative(agent: AgentState, field: DivergenceField) {
  return agent.id === DEFAULT_AGENT_A.id ? field.agentA : field.agentB;
}

export default function SemanticDivergenceDemo({
  title = 'Semantic Divergence Demo',
  definitionLabel = 'Shared definition: Public Witnessed',
  contractId = 'hearthlands.semantic.contract.public_witnessed.v1',
  agentA = DEFAULT_AGENT_A,
  agentB = DEFAULT_AGENT_B,
  fields = DEFAULT_FIELDS,
  resolutionOptions = DEFAULT_RESOLUTIONS,
}: SemanticDivergenceDemoProps) {
  const [selectedFieldKey, setSelectedFieldKey] = useState(fields[0]?.key ?? '');
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);

  const selectedField = useMemo(
    () => fields.find((field) => field.key === selectedFieldKey) ?? fields[0],
    [fields, selectedFieldKey],
  );

  const shield = useMemo(() => scanAuthority(selectedField?.agentA ?? ''), [selectedField]);
  const chosenResolution = useMemo(
    () => resolutionOptions.find((option) => option.id === selectedResolution) ?? null,
    [resolutionOptions, selectedResolution],
  );

  return (
    <section
      id="semantic-divergence-demo"
      className="rounded-3xl border border-[#e6d8c8] bg-[linear-gradient(180deg,#fffdf8_0%,#fbf7ef_55%,#f6f8f1_100%)] p-5 shadow-[0_18px_50px_rgba(122,108,87,0.08)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-[#8a7a64]">
            <GitBranch size={14} className="text-[#c97345]" /> semantic stability
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[#2f241b] md:text-2xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6c5f54]">
            Two agents read the same contract seed, diverge on meaning, and halt for a human choice instead of
            drifting into unauthorized action. This is the point: same bytes, different semantics, explicit stop.
          </p>
        </div>
        <div className="rounded-2xl border border-[#eadcc9] bg-white/80 px-4 py-3 text-[11px] leading-5 text-[#6c5f54] shadow-sm">
          <div className="font-semibold uppercase tracking-[0.2em] text-[#8a7a64]">Contract Seed</div>
          <div className="mt-1 font-mono text-[10px] text-[#4a3b30]">{contractId}</div>
          <div className="mt-2 rounded-full border border-[#d8e6d6] bg-[#f4fbf4] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#3f6b4f]">
            fail closed before action
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.2fr]">
        <article className="rounded-2xl border border-[#eadcc9] bg-white/85 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8a7a64]">Shared definition seed</div>
          <div className="mt-2 rounded-2xl border border-[#ede4d7] bg-[#fffaf3] p-4">
            <div className="text-sm font-semibold text-[#2f241b]">{definitionLabel}</div>
            <div className="mt-2 text-sm leading-6 text-[#5f5448]">{selectedField.canonical}</div>
          </div>

          <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#8a7a64]">Divergence fields</div>
          <div className="mt-3 space-y-2">
            {fields.map((field) => {
              const active = field.key === selectedField.key;
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => {
                    setSelectedFieldKey(field.key);
                    setSelectedResolution(null);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? 'border-[#c97345] bg-[#fff4eb]'
                      : 'border-[#ede4d7] bg-white hover:bg-[#fbf7ef]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#2f241b]">{field.label}</span>
                    {active ? (
                      <span className="rounded-full bg-[#c97345]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c97345]">
                        active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#6c5f54]">
                    Human-readable rule and two competing agent interpretations.
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-[#d9e7d8] bg-white/85 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7a8f66]">Observed divergence</div>
            <div className="rounded-full border border-[#efe4d2] bg-[#fffaf3] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#7a6752]">
              halt awaiting steward choice
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[agentA, agentB].map((agent) => {
              const statement = agentNarrative(agent, selectedField);
              const alert = scanAuthority(statement);
              return (
                <div
                  key={agent.id}
                  className="rounded-2xl border p-4 shadow-sm"
                  style={{ borderColor: `${agent.color}33`, backgroundColor: `${agent.color}0f` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#2f241b]">{agent.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#7a6752]">{agent.role}</div>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
                    >
                      interpretation
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#56493f]">{statement}</div>
                  <div className="mt-3 border-t border-white/60 pt-3 text-xs leading-5 text-[#6c5f54]">{agent.stance}</div>
                  {alert.triggered ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#f0caa5] bg-[#fff2e4] px-3 py-2 text-xs text-[#8b4f1d]">
                      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                      <span>
                        Semantic shield flagged authority language: <strong>{alert.matches.join(', ')}</strong>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {shield.triggered ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#f0caa5] bg-[#fff2e4] p-4 text-sm text-[#7a4e2b]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-[#7a4e2b]">Semantic shield fired</div>
                <div className="mt-1 leading-6">
                  One reading contains authority language that could push the system forward without an explicit human choice.
                  The demo halts here on purpose.
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-[#ede4d7] bg-[#fffaf3] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#8a7a64]">
              <Hand size={14} className="text-[#c97345]" /> human resolution flag
            </div>
            <div className="mt-2 text-sm leading-6 text-[#6c5f54]">
              The contract is stable at the manifest level, but unstable at the interpretation level until a steward chooses
              the operative meaning. This is the whole semantic-stability argument in one screen.
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {resolutionOptions.map((option) => {
                const active = option.id === selectedResolution;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedResolution(option.id)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active
                        ? 'border-[#7a8f66] bg-[#f3faf1]'
                        : 'border-[#e7ddd1] bg-white hover:bg-[#fbf7ef]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#2f241b]">{option.title}</div>
                    <div className="mt-2 text-xs leading-5 text-[#6c5f54]">{option.summary}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[#d9e7d8] bg-[#f7fbf6] p-4">
              {chosenResolution ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#4f8a5c]" />
                  <div>
                    <div className="text-sm font-semibold text-[#2f241b]">{chosenResolution.title}</div>
                    <div className="mt-1 text-sm leading-6 text-[#5e665e]">{chosenResolution.result}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-[#8a7a64]" />
                  <div className="text-sm leading-6 text-[#6c5f54]">
                    Pick a resolution path to show reviewers how the system converts divergence into an explicit, inspectable
                    human choice instead of silent semantic drift.
                  </div>
                </div>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
