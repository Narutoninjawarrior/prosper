import { useEffect, useState } from 'react';
import { BookOpen, Sparkles, ShieldCheck, Compass, Feather, TriangleAlert, PencilLine, CheckCircle2 } from 'lucide-react';
import { FALLBACK_GRACE, type GraceProjectData } from './lib/grace';
import HandoffCard from './HandoffCard';
import { useSanctuary } from './SanctuaryContext';

type GraceProjectProps = {
  acknowledged: boolean;
  onAcknowledge: () => void;
};

export default function GraceProject({ acknowledged, onAcknowledge }: GraceProjectProps) {
  const {
    grace,
    gasWick,
    integrityStatus,
    mirrorFingerprint,
    seedHash,
    manifestHash,
    handoff,
    semanticAlert,
    saveGraceNotes,
    lastValidSeedHash,
    staledAt,
  } = useSanctuary();

  const data: GraceProjectData = grace ?? FALLBACK_GRACE;
  const [notesDraft, setNotesDraft] = useState(data.handoff_note ?? data.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotesDraft(data.handoff_note ?? data.notes ?? '');
  }, [data.handoff_note, data.notes]);

  const principles = data.principles ?? FALLBACK_GRACE.principles ?? [];
  const currentFocus = data.current_focus ?? FALLBACK_GRACE.current_focus ?? [];
  const activeAgents = data.active_agents ?? FALLBACK_GRACE.active_agents ?? [];
  const pendingApprovals = data.pending_approvals ?? FALLBACK_GRACE.pending_approvals ?? [];
  const whatNotToTouch = data.what_not_to_touch ?? FALLBACK_GRACE.what_not_to_touch ?? [];
  const creativeEndeavors = data.creative_endeavors ?? FALLBACK_GRACE.creative_endeavors ?? [];
  const doNotChase = data.do_not_chase ?? FALLBACK_GRACE.do_not_chase ?? [];
  const walletStatus = data.wallet_status ?? FALLBACK_GRACE.wallet_status ?? 'Read-only / disconnected';
  const repoPointer = data.repo_pointer ?? FALLBACK_GRACE.repo_pointer ?? 'D:\\Hearth\\prosper2';
  const isVerified = integrityStatus === 'verified';
  const decreeIssuedAt = data.decree_issued_at ?? FALLBACK_GRACE.decree_issued_at ?? '';
  const decreeAgeMs = decreeIssuedAt ? Date.now() - Date.parse(decreeIssuedAt) : Number.POSITIVE_INFINITY;
  const ownerFresh = Number.isFinite(decreeAgeMs) && decreeAgeMs < 60 * 60 * 1000;
  const owner = ownerFresh ? data.owner ?? FALLBACK_GRACE.owner ?? 'Pending' : 'Pending';
  const approvalStatus = ownerFresh
    ? data.approval_status ?? FALLBACK_GRACE.approval_status ?? 'Awaiting Sovereign Seal'
    : 'Awaiting Sovereign Seal';
  const decreeId = ownerFresh ? data.decree_id ?? FALLBACK_GRACE.decree_id ?? 'DECREE-001' : 'DECREE-001';
  const integrityLabel =
    integrityStatus === 'verified'
      ? 'verified by forge'
      : integrityStatus === 'amber'
        ? 'nonce warning'
        : integrityStatus === 'red'
          ? 'fail closed'
          : 'lore drift';

  const saveGrace = async () => {
    setSaving(true);
    try {
      await saveGraceNotes(notesDraft.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 text-[#15312a]">
      <section className="rounded-[2rem] border border-[#d7eadc] bg-white/80 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.12)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 text-[#1f8f5d]">
              <Sparkles size={22} />
              <span className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">grace project</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#123228] md:text-4xl">{data.title}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#62766d]">{data.tagline}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <div className="rounded-2xl border border-[#d9eadd] bg-[#f8fdf8] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">status</div>
              <div
                className={`mt-2 text-lg font-semibold ${
                  integrityStatus === 'verified'
                    ? 'text-[#17392d]'
                    : integrityStatus === 'amber'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {integrityLabel}
              </div>
            </div>
            <div className="rounded-2xl border border-[#d9eadd] bg-[#f8fdf8] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">wick</div>
              <div className="mt-2 text-lg font-semibold text-[#17392d]">{gasWick}%</div>
            </div>
            <div className="rounded-2xl border border-[#d9eadd] bg-[#f8fdf8] p-4 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">integrity</div>
              <div className="mt-2 break-all text-xs text-[#62766d]">
                seed: {seedHash || 'hash pending'}
                <span className="mx-2 text-[#9db7aa]">/</span>
                anchor: {manifestHash || 'no anchor yet'}
              </div>
              {(integrityStatus !== 'verified' && lastValidSeedHash) || staledAt ? (
                <div className="mt-2 text-[11px] leading-6 text-[#7f6650]">
                  last known hash: {lastValidSeedHash || 'pending'}
                  {staledAt ? <span className="mx-2 text-[#c3a77b]">|</span> : null}
                  {staledAt ? `stale since ${new Date(staledAt).toLocaleTimeString()}` : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[#d9eadd] bg-[#f8fdf8] p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">mirror fingerprint</div>
                  <div className="mt-2 text-lg font-semibold text-[#17392d]">{mirrorFingerprint.slice(0, 16) || 'pending'}</div>
                </div>
                <div className="w-40 overflow-hidden rounded-full border border-[#d9eadd] bg-white/80">
                  <div
                    className={`h-2 rounded-full ${
                      integrityStatus === 'verified'
                        ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                        : integrityStatus === 'amber'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                          : 'bg-gradient-to-r from-red-400 to-red-700'
                    }`}
                    style={{ width: `${gasWick}%` }}
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-[#62766d]">Proof-of-liveness pulse refreshed every 10 seconds.</div>
              {integrityStatus === 'verified' ? (
                <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-[11px] uppercase tracking-[0.35em] text-cyan-800">
                  Grace leads with clarity.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#d7eadc] bg-[#0f241e] p-6 text-[#ecf8ef] shadow-[0_12px_40px_rgba(97,127,105,0.12)]">
        <div className="flex items-center gap-3 text-[#95f0bf]">
          <ShieldCheck size={18} />
          <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#9dc9b5]">sovereign command center</h2>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#94baa5]">handoff strip</div>
              <div className="mt-2 text-lg font-semibold text-white">
                Owner: {owner} <span className="mx-2 text-[#5e8570]">|</span> Approval: {approvalStatus}
              </div>
              <div className="mt-1 text-xs leading-6 text-[#a8c5b4]">Decree {decreeId} | {walletStatus}</div>
            </div>
            <div className="max-w-[28rem] text-right">
              <div className="text-[9px] uppercase tracking-[0.35em] text-[#94baa5]">what not to touch</div>
              <div className="mt-2 text-xs leading-6 text-[#d7eadc]">{whatNotToTouch.join(' | ')}</div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-[#fffaf0] p-3 text-sm leading-7 text-[#3f5248]">
            <HandoffCard
              text={handoff.text || 'No handoff note recorded yet.'}
              renderHash={handoff.renderHash}
              quarantined={handoff.quarantined}
              semanticAlert={
                handoff.quarantined
                  ? { triggered: true, matches: ['quarantined'], banner: 'NON-PLAINTEXT DETECTED - VERIFY BEFORE SEALING' }
                  : semanticAlert.triggered
                    ? semanticAlert
                    : undefined
              }
            />
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">wallet status</div>
                <div className="mt-2 text-lg font-semibold text-white">{walletStatus}</div>
                <div className="mt-2 text-xs leading-6 text-[#a8c5b4]">Read-only observability. No signing or minting is exposed here.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">repo pointer</div>
                <div className="mt-2 break-all text-base font-semibold text-white">{repoPointer}</div>
                <div className="mt-2 text-xs leading-6 text-[#a8c5b4]">Canonical local source path for the current grace build.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">current mission</div>
              <div className="mt-2 text-base leading-7 text-[#effaf2]">{data.mission}</div>
              <div className="mt-4 text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">blocker</div>
              <div className="mt-2 text-sm leading-7 text-[#d7eadc]">{data.blocker}</div>
              <div className="mt-4 text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">next action</div>
              <div className="mt-2 text-sm leading-7 text-[#d7eadc]">{data.next_action}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">active agents</div>
              <div className="mt-3 space-y-2">
                {activeAgents.map((agent, index) => (
                  <div key={`${agent}-${index}`} className="rounded-xl border border-white/10 bg-[#fffaf0] px-3 py-2 text-sm text-[#3f5248]">
                    {agent}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#94baa5]">pending approvals</div>
              <div className="mt-3 space-y-2">
                {pendingApprovals.map((approval, index) => (
                  <div key={`${approval}-${index}`} className="rounded-xl border border-white/10 bg-[#fffaf0] px-3 py-2 text-sm text-[#3f5248]">
                    {approval}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <article className="rounded-[2rem] border border-[#d7eadc] bg-white/80 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3 text-[#1f8f5d]">
              <ShieldCheck size={18} />
              <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">principles</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {principles.map((principle, index) => (
                <div key={`${principle}-${index}`} className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 text-sm leading-6 text-[#3f5248]">
                  {principle}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-[#d7eadc] bg-gradient-to-br from-[#f7fff4] via-[#fbfff8] to-[#effbff] p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3 text-[#1f8f5d]">
              <Compass size={18} />
              <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">current focus</h2>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[#54655d]">{data.mission}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {currentFocus.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-[#dce9dd] bg-white/80 p-4 text-sm text-[#3f5248]">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-[2rem] border border-[#d7eadc] bg-white/80 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3 text-[#1f8f5d]">
              <Feather size={18} />
              <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">creative endeavors</h2>
            </div>
            <div className="mt-4 space-y-3">
              {creativeEndeavors.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-[#dce9dd] bg-[#fbfef8] p-4 text-sm leading-6 text-[#3f5248]">
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-[#d7eadc] bg-white/80 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3 text-[#b76e00]">
              <TriangleAlert size={18} />
              <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">what not to chase</h2>
            </div>
            <div className="mt-4 space-y-3">
              {doNotChase.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-[#f1e0bc] bg-[#fff8ea] p-4 text-sm leading-6 text-[#7a612e]">
                  {item}
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="rounded-[2rem] border border-[#d7eadc] bg-[#123228] p-6 text-white shadow-[0_12px_40px_rgba(97,127,105,0.12)]">
        <div className="flex items-center gap-3 text-[#95f0bf]">
          <BookOpen size={18} />
          <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#9dc9b5]">grace note</h2>
        </div>
        <p className="mt-4 max-w-4xl text-xl leading-8 text-[#ecf8ef]">{data.quote}</p>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-[#bfd6c8]">{data.next_action}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-[2rem] border border-[#d7eadc] bg-white/80 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
          <div className="flex items-center gap-3 text-[#1f8f5d]">
            <PencilLine size={18} />
            <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">grace notes</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-[#62766d]">
            Read-only for agents. Editable by the Sovereign. This note becomes the handoff brief that future builders read before touching the Forge.
          </p>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Write the living handoff here..."
            className="mt-4 min-h-[160px] w-full rounded-3xl border border-[#d7e8da] bg-[#fbfef8] px-4 py-3 text-sm leading-7 text-[#15312a] outline-none"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveGrace}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#1f8f5d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176e49]"
            >
              <Sparkles size={16} /> {saving ? 'saving grace seed...' : 'save grace seed'}
            </button>
            <button
              type="button"
              onClick={onAcknowledge}
              className="inline-flex items-center gap-2 rounded-full border border-[#d7eadc] bg-white px-4 py-2 text-sm font-semibold text-[#1f8f5d] hover:bg-[#f3fbf4]"
            >
              <CheckCircle2 size={16} /> acknowledge grace principles
            </button>
          </div>
        </article>

        <article
          className={`rounded-[2rem] border p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)] ${
            isVerified ? 'border-[#b7ead0] bg-[#f4fff7]' : integrityStatus === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className={isVerified ? 'text-[#1f8f5d]' : integrityStatus === 'amber' ? 'text-amber-700' : 'text-red-700'} />
            <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">integrity seal</h2>
          </div>
          <div className="mt-4 text-2xl font-semibold text-[#123228]">
            {integrityStatus === 'verified' ? 'Verified by Forge' : integrityStatus === 'amber' ? 'Nonce Warning' : 'Fail Closed'}
          </div>
          <p className="mt-3 text-sm leading-7 text-[#62766d]">
            {integrityStatus === 'verified'
              ? 'The current seed matches the stored anchor. The Mirror can trust the Grace Project for now.'
              : integrityStatus === 'amber'
                ? 'The pulse nonce is stale or missing. The Mirror is asking for a manual freshness check before any seal.'
                : 'The seed failed a hard integrity check. The Mirror has failed closed and the Seal remains shut.'}
          </p>
          {(integrityStatus !== 'verified' && lastValidSeedHash) || staledAt ? (
            <div className="mt-4 rounded-2xl border border-[#edd9b3] bg-[#fff9ef] p-4 text-sm leading-7 text-[#705b2e]">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#a07e3c]">forensic continuity</div>
              <div className="mt-2 break-all font-mono text-xs">last known hash: {lastValidSeedHash || 'pending'}</div>
              {staledAt ? <div className="mt-1 text-[11px] uppercase tracking-[0.3em]">stale since {new Date(staledAt).toLocaleTimeString()}</div> : null}
            </div>
          ) : null}
          {!acknowledged && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
              The front door remains guarded until the Grace Principles are acknowledged.
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
