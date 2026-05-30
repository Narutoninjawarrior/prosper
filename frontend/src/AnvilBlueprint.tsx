import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, FileText, Eye, Lock } from 'lucide-react';
import { useSanctuary } from './SanctuaryContext';
import { sha256Hex, stableStringify } from './lib/grace';

const proposal = {
  intent: 'Audit Sovereign Command Center integrity logic before the Kimi siege.',
  affected_resources: ['grace_project.json', 'mirror banner', '3D parchment overlay'],
  expected_state_delta:
    'No mutation paths. The UI exposes live truth, stale owners clear to Pending, and no seal controls are executable.',
  risk_assessment:
    'Low-to-medium. Main risk is UI spoofing or proposal drift; execution remains blocked.',
  confidence_score: '0.92',
  known_unknowns: [
    'Whether future signature rituals should move to a separate sealed flow',
    'Whether proposal history should be archived before Kimi review',
  ],
  seal_requirement: 'Manual human seal only. No wallet connection in this draft.',
};

export default function AnvilBlueprint() {
  const { seedHash, mirrorFingerprint, wickState, gasWick, grace, lastValidSeedHash, lastValidNonce, staledAt, integrityStatus } =
    useSanctuary();
  const [proposalHash, setProposalHash] = useState('pending');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const canonical = stableStringify(proposal);
      const hash = await sha256Hex(canonical);
      if (alive) setProposalHash(hash);
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const liveFresh = wickState === 'live';
  const hashMatch = proposalHash !== 'pending' && seedHash !== '' && proposalHash === seedHash;
  const sealUnlocked = hashMatch && liveFresh && integrityStatus === 'verified';
  const statusLabel =
    integrityStatus === 'verified'
      ? 'Verified by Forge'
      : integrityStatus === 'amber'
        ? 'Nonce Warning'
        : integrityStatus === 'red'
          ? 'Fail Closed'
          : liveFresh
            ? 'Manual Review'
            : 'Wick Frozen';
  const prohibited = grace?.what_not_to_touch?.length ? grace.what_not_to_touch : ['P0 Ledger', 'Wasm Shield'];

  return (
    <div className="flex w-full flex-col gap-6 p-4 text-[#15312a]">
      <section className="rounded-[2rem] border border-[#d7eadc] bg-[#123228] p-6 text-white shadow-[0_12px_40px_rgba(97,127,105,0.12)]">
        <div className="flex items-center gap-3 text-[#95f0bf]">
          <ShieldCheck size={18} />
          <h1 className="text-[11px] uppercase tracking-[0.45em] text-[#9dc9b5]">anvil / chamber ii</h1>
        </div>
        <p className="mt-4 max-w-4xl text-lg leading-8 text-[#ecf8ef]">
          Read-only proposal review. The left side is what Kimi would say; the right side is the live grace anchor it must match.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.35em] text-[#b8d9c8]">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Gas wick: {gasWick}%</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Status: {statusLabel}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Seal: manual later</span>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <article className="rounded-[2rem] border border-[#d7eadc] bg-white/85 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
          <div className="flex items-center gap-3 text-[#1f8f5d]">
            <FileText size={18} />
            <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">agent proposal</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 md:col-span-2">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">intent</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{proposal.intent}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 md:col-span-2">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">proposal hash</div>
              <div className="mt-2 break-all text-xs font-semibold leading-6 text-[#123228]">{proposalHash}</div>
              <div className="mt-2 text-[11px] leading-6 text-[#5f7469]">
                Cryptographic receipt for the proposal text above. If this changes, the receipt changes too.
              </div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">affected resources</div>
              <ul className="mt-2 space-y-2 text-sm text-[#355044]">
                {proposal.affected_resources.map((item) => (
                  <li key={item} className="rounded-xl border border-[#e5efe6] bg-white/80 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">confidence</div>
              <div className="mt-1 text-2xl font-semibold text-[#123228]">{proposal.confidence_score}</div>
              <div className="mt-2 text-xs leading-6 text-[#5f7469]">High enough to review, never high enough to execute.</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 md:col-span-2">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">expected state delta</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{proposal.expected_state_delta}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 md:col-span-2">
              <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">
                <AlertTriangle size={13} className="text-amber-600" /> risk assessment
              </div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{proposal.risk_assessment}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 md:col-span-2">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">known unknowns</div>
              <ul className="mt-2 space-y-2 text-sm text-[#355044]">
                {proposal.known_unknowns.map((item) => (
                  <li key={item} className="rounded-xl border border-[#e5efe6] bg-white/80 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-[2rem] border border-[#d7eadc] bg-white/85 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
          <div className="flex items-center gap-3 text-[#1f8f5d]">
            <Eye size={18} />
            <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">live spine state</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">current mission</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{grace?.mission ?? 'No mission set yet.'}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">blocker</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{grace?.blocker ?? 'No blocker recorded.'}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">next action</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">{grace?.next_action ?? 'Keep the mirror calm and legible.'}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">owner / approval</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">
                <span className={grace?.owner && grace.owner !== 'Pending' ? 'text-cyan-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {grace?.owner ?? 'Pending'}
                </span>
                <span className="mx-2 text-[#9db7aa]">|</span>
                {grace?.approval_status ?? 'Awaiting Sovereign Seal'}
              </div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">prohibited zone</div>
              <div className="mt-2 text-sm leading-7 text-[#355044]">{prohibited.join(' | ')}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">seed hash</div>
              <div className="mt-1 break-all text-xs leading-6 text-[#355044]">{seedHash || 'pending'}</div>
              <div className="mt-2 text-[11px] text-[#5f7469]">{grace?.repo_pointer ?? 'D:\\Hearth\\prosper2'}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">mirror fingerprint</div>
              <div className="mt-1 break-all text-xs leading-6 text-[#355044]">{mirrorFingerprint.slice(0, 16) || 'pending'}</div>
            </div>
            <div className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">seal status</div>
              <div className="mt-1 text-sm leading-7 text-[#355044]">
                {sealUnlocked ? 'Verified by Forge' : liveFresh ? (integrityStatus === 'amber' ? 'Nonce warning' : 'Hash mismatch') : 'Wick extinguished'}
              </div>
              {(integrityStatus !== 'verified' && lastValidSeedHash) || staledAt ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-6 text-amber-900">
                  <div className="text-[9px] uppercase tracking-[0.35em] text-amber-700">forensic continuity</div>
                  <div className="mt-1 break-all font-mono text-[11px]">last known hash: {lastValidSeedHash || 'pending'}</div>
                  {lastValidNonce ? <div className="mt-1 break-all font-mono text-[11px]">last valid nonce: {lastValidNonce}</div> : null}
                  {staledAt ? <div className="mt-1 text-[10px] uppercase tracking-[0.3em]">stale since {new Date(staledAt).toLocaleTimeString()}</div> : null}
                </div>
              ) : null}
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-[#d7eadc] bg-[#0f241e] p-6 text-[#ecf8ef] shadow-[0_12px_40px_rgba(97,127,105,0.12)]">
        <div className="flex items-center gap-3 text-[#95f0bf]">
          <Lock size={18} />
          <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#9dc9b5]">seal gate</h2>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#d7eadc]">
          The Seal remains manual and outside the proposal room. The button only unlocks when the proposal hash, the live hash, and the integrity state all agree.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!sealUnlocked}
            className={`cursor-not-allowed rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] ${
              sealUnlocked
                ? 'border-cyan-300/40 bg-cyan-50/10 text-cyan-200'
                : 'border-white/10 bg-white/5 text-[#a8c5b4] opacity-70'
            }`}
          >
            {sealUnlocked ? 'Seal Gate (future)' : 'Double-Lock Active'}
          </button>
          <span className="text-[11px] uppercase tracking-[0.35em] text-[#7ca08f]">
            Manual wallet review only
          </span>
        </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] leading-6 text-[#bfd6c8]">
        TRUST BOUNDARY: LOCAL BROWSER. Verify machine integrity independently. The Sanctuary protects against agentic drift, not hardware compromise.
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.35em] text-[#7ca08f]">
        <a
          href="/mission.md"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 text-cyan-200 transition hover:text-cyan-100"
        >
          <FileText size={12} />
          View mission briefing
        </a>
      </div>
    </section>
  </div>
);
}
