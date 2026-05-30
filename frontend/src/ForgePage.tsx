import { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, Flame, ShieldCheck, Sparkles, TriangleAlert, UserPlus, Download, ExternalLink } from 'lucide-react';
import ArtifactInspector from './ArtifactInspector';
import { useContract, sanctuaryBridge } from './lib/sanctuaryBridge';
import { sha256Hex } from './lib/grace';

const quickLinks = [
  {
    href: '/current-build.md',
    label: 'Current Build',
    detail: 'What is already alive before the next pass.',
  },
  {
    href: '/forge-snapshot.md',
    label: 'Forge Snapshot',
    detail: 'Real vs described, before building.',
  },
  {
    href: '/forge.md',
    label: 'Open Forge Brief',
    detail: 'One-page builder room map.',
  },
  {
    href: '/lodge-port-pack.md',
    label: 'Open Port Pack',
    detail: 'Mirror now / branch later ladder.',
  },
  {
    href: '/lodge-port-pack.json',
    label: 'Download Manifest',
    detail: 'Machine-readable mirror list.',
  },
  {
    href: '/lodge-capsule.md',
    label: 'Lodge Capsule',
    detail: 'Portable core file list.',
  },
  {
    href: '/lodge-capsule.json',
    label: 'Capsule manifest',
    detail: 'Machine-readable portable core + layers.',
  },
  {
    href: '/lodge-interface.json',
    label: 'Deep Interface',
    detail: 'Machine-readable map of surfaces and consumers.',
  },
  {
    href: '/firebase-branch.json',
    label: 'Firebase Branch',
    detail: 'Additive roadmap for the major Firebase phase.',
  },
  {
    href: '/sovereign-sync.md',
    label: 'Sovereign Sync',
    detail: 'Same build everywhere; no hostname truth switch.',
  },
  {
    href: '/recruitment-forge.md',
    label: 'Recruitment Forge',
    detail: 'Public recruitment doctrine and reserved rails.',
  },
  {
    href: '/proposal-intent.md',
    label: 'Proposal Intent',
    detail: 'Text-only recruitment proposal contract.',
  },
  {
    href: '/schema-registry.md',
    label: 'Schema Registry',
    detail: 'Shared contract registry for members, rooms, and quests.',
  },
  {
    href: '/steward-runbook.md',
    label: 'Open Steward Runbook',
    detail: 'Export -> dry-run -> sync -> claims order.',
  },
  {
    href: '/firebase-readiness.md',
    label: 'Firebase Readiness',
    detail: 'Additive branch notes for later.',
  },
  {
    href: '/build-report.md',
    label: 'Use Builder Report',
    detail: 'Seven-section result shape for every pass.',
  },
];

/** Minimum safe Emergent mirror — Layer 1 + Layer 2 only (`docs/emergent-mirror.md`). */
const minimumMirrorFiles = [
  'lodge-port-pack.md',
  'lodge-capsule.md',
  'mission.md',
  'skill.md',
  'history.md',
  'rooms.md',
  'steward-runbook.md',
  'firebase-readiness.md',
  'vessel_members.json',
  'room_registry.json',
  'quest_board.json',
  'mission_board.json',
  'grace_project.json',
] as const;

const forgeRules = [
  'Keep the JSON contracts canonical.',
  'Keep Firestore supplemental.',
  'Keep claims manual and approval-gated.',
  'Keep browser surfaces read-only until a write path is written.',
  'Keep manifest verification fail-closed.',
];

const nextBuildOptions = [
  {
    title: 'Docs-only mirror improvement',
    detail: 'Tighten the public handoff without touching behavior.',
  },
  {
    title: 'Read-only Hall refinement',
    detail: 'Make the recruitment / trust story easier to read.',
  },
  {
    title: 'Portability improvement',
    detail: 'Help Emergent mirror now and Firebase branch later.',
  },
  {
    title: 'Tiny Firebase branch note',
    detail: 'Keep the additive path obvious without adding writes.',
  },
] as const;

const integrityStates = [
  { label: 'P0 Ledger', state: 'Ready', role: 'Cryptographic Spine' },
  { label: 'JSON Seeds', state: 'Verified', role: 'Manifest Hash Policy' },
  { label: 'Wasm Shield', state: 'Staged', role: 'Deterministic Forge' },
];

function ForgePage() {
  const { state: memberState, verified: memberVerified } = useContract(
    '/vessel_members.json',
    sanctuaryBridge.normalizeMembers,
    []
  );
  const isHearthValid = memberState === 'ready' && memberVerified;

  const [draftHandle, setDraftHandle] = useState('');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftTargetArea, setDraftTargetArea] = useState('');
  const [draftRisk, setDraftRisk] = useState('');

  // World Forger states
  const [forgerJson, setForgerJson] = useState<string>(`{
  "room_id": "cozy-library",
  "room_name": "Cozy Solarpunk Library",
  "owner": "Solis",
  "capacity": 8,
  "theme": {
    "primary": "#1c6c4d",
    "accent": "#d97706",
    "background": "#fbfefa"
  },
  "metadata": {
    "description": "A persistent virtual workspace for cooperative builders."
  }
}`);
  const [witnessHash, setWitnessHash] = useState<string>("");
  const [forgerError, setForgerError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const calculateHash = async () => {
      try {
        const parsed = JSON.parse(forgerJson);
        setForgerError(null);
        const hash = await sha256Hex(JSON.stringify(parsed, null, 2));
        if (active) {
          setWitnessHash(hash);
        }
      } catch (err: any) {
        if (active) {
          setForgerError(err.message || "Invalid JSON");
          setWitnessHash("----------------- INVALID JSON -----------------");
        }
      }
    };
    calculateHash();
    return () => {
      active = false;
    };
  }, [forgerJson]);

  return (
    <div className="h-full overflow-y-auto rounded-3xl border border-[#d7eadc] bg-[linear-gradient(180deg,#fcfcf4_0%,#f7fcf6_48%,#edf8fb_100%)] px-5 py-5 text-[#18382d]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-3xl border border-[#d9e9dc] bg-white/80 px-5 py-5 shadow-[0_18px_50px_rgba(97,127,105,0.1)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="rounded-3xl border p-3 transition-all duration-500"
                style={{
                  borderColor: isHearthValid ? '#fbd5c0' : '#A9A9A9',
                  backgroundColor: isHearthValid ? '#fff6f0' : '#F2F2F2',
                  color: isHearthValid ? '#f97316' : '#A9A9A9',
                  boxShadow: isHearthValid ? '0 0 15px rgba(249,115,22,0.15)' : 'none',
                }}
                title={isHearthValid ? "Hearth Fire: Sovereign Trust Validated" : "Hearth Fire Extinguished: Stale/Mismatch Ledger State"}
              >
                <Flame size={28} className={isHearthValid ? 'animate-[pulse_2s_infinite]' : ''} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">fellowship forge</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#123228] md:text-3xl">
                  Mirror now. Branch later. Report back.
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#62766d]">
                  This is the builder landing surface for the Lodge. Use it to copy the public contract layer into another vessel,
                  keep the trust model intact, and give the next builder one calm place to start.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span 
                className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300"
                style={{
                  borderColor: isHearthValid ? '#cfe7d4' : '#A9A9A9',
                  backgroundColor: isHearthValid ? '#f5fcf6' : '#F2F2F2',
                  color: isHearthValid ? '#1c6c4d' : '#A9A9A9',
                }}
              >
                {isHearthValid ? 'Hearth Fire Lit' : 'Hearth Fire Ash'}
              </span>
              <span className="rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6c4d]">
                read only
              </span>
              <span className="rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6c4d]">
                portable
              </span>
              <span className="rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6c4d]">
                contract-first
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-[#d9e9dc] bg-white/80 px-5 py-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.4em] text-[#7b9581]">
                <ShieldCheck size={14} className="text-[#1c6c4d]" /> Vessel Integrity
              </div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">Reality Check</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#62766d]">
                The Forge maintains a strict <strong className="font-medium text-[#18382d]">contract-first</strong> reality. 
                Use this HUD to verify the integrity of the current checkout against the <code className="text-[11px] text-[#3d5349]">forge-snapshot.md</code>.
              </p>
            </div>
            <a 
              href="/forge-snapshot.md"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#1c6c4d] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-[#18382d] transition-colors"
            >
              View Snapshot
            </a>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {integrityStates.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7b9581]">{item.label}</span>
                  <span className={`h-2 w-2 rounded-full ${item.state === 'Ready' || item.state === 'Verified' ? 'bg-[#22c55e]' : 'bg-[#eab308]'}`}></span>
                </div>
                <div className="mt-2 font-serif text-lg text-[#123228]">{item.state}</div>
                <div className="mt-1 text-[10px] text-[#7b9581]">{item.role}</div>
              </div>
            ))}
          </div>
        </section>

        <ArtifactInspector />

        <section className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
          <article className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d5ecda] bg-[#eefaf2] p-2 text-[#1f8f5d]">
                <Sparkles size={17} />
              </div>
              <div>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">Mirror now</h2>
                <p className="mt-1 text-sm text-[#6d7f76]">Copy the public contract layer first and stop at the minimum safe mirror.</p>
              </div>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-[#18382d]">
              <li className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 1</div>
                <div className="mt-1 font-medium">Read the Port Pack and mirror checklist.</div>
                <div className="mt-1 text-sm text-[#62766d]">Start with `/lodge-port-pack.md` and `docs/emergent-mirror.md`.</div>
              </li>
              <li className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 2</div>
                <div className="mt-1 font-medium">Mirror the 13 public files verbatim.</div>
                <div className="mt-1 text-sm text-[#62766d]">Keep every `manifest_hash` and stop after Layer 2.</div>
              </li>
              <li className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 3</div>
                <div className="mt-1 font-medium">Do not ship scripts, secrets, or writes.</div>
                <div className="mt-1 text-sm text-[#62766d]">The mirror teaches the Lodge; it does not become the Lodge’s operator console.</div>
              </li>
            </ol>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-[#cfe7d4] bg-[#f5fcf6] px-4 py-3 text-sm font-semibold text-[#1c6c4d] hover:bg-[#e8f6ea]"
                >
                  <div className="flex items-center gap-2">
                    {link.label} <ArrowRight size={16} />
                  </div>
                  <div className="mt-1 text-xs font-normal text-[#62766d]">{link.detail}</div>
                </a>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d5ecda] bg-[#eefaf2] p-2 text-[#1f8f5d]">
                <BookOpen size={17} />
              </div>
              <div>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">Branch later</h2>
                <p className="mt-1 text-sm text-[#6d7f76]">Keep Firebase additive. Configure, don’t replace contracts.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">later branch</div>
                <div className="mt-1 font-medium">Use `frontend/.env.example` and `firebaseConfig.ts`.</div>
                <div className="mt-1 text-sm text-[#62766d]">The browser reads only `VITE_FIREBASE_*`; steward creds stay terminal-only.</div>
              </div>
              <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">later branch</div>
                <div className="mt-1 font-medium">Keep Firestore supplemental.</div>
                <div className="mt-1 text-sm text-[#62766d]">The stamped JSON seeds stay canonical; claims remain manual and approval-gated.</div>
              </div>
              <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">later branch</div>
                <div className="mt-1 font-medium">Add only a narrow Auth step when needed.</div>
                <div className="mt-1 text-sm text-[#62766d]">If you do, write the rule first and keep the browser read-only until then.</div>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#d5ecda] bg-[#eefaf2] p-2 text-[#1f8f5d]">
                <TriangleAlert size={17} />
              </div>
              <div>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">Report back</h2>
                <p className="mt-1 text-sm text-[#6d7f76]">Every builder pass should return in the same shape.</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">builder report contract</div>
              <div className="mt-2 text-sm leading-6 text-[#62766d]">
                Research summary → What changed → What stayed the same → What was deferred → Build / verification →
                Manual next step → Next prompt.
              </div>
              <a
                href="/build-report.md"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1f8f5d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176e49]"
              >
                Open report contract <ArrowRight size={16} />
              </a>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">forge rules</div>
              <ul className="mt-3 space-y-2 text-sm text-[#62766d]">
                {forgeRules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#1f8f5d]" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">
                Minimum safe mirror
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#62766d]">
                Copy these <strong className="font-medium text-[#18382d]">13 files</strong> from{' '}
                <code className="text-[11px] text-[#3d5349]">frontend/public/</code> verbatim — keep every{' '}
                <code className="text-[11px] text-[#3d5349]">manifest_hash</code> — then{' '}
                <strong className="font-medium text-[#18382d]">stop</strong>. Download the machine-readable{' '}
                <a href="/lodge-port-pack.json" className="font-bold text-[#1c6c4d] hover:underline">JSON manifest</a> or see the full checklist:{' '}
                <code className="text-[11px] text-[#3d5349]">docs/emergent-mirror.md</code>.
              </p>
            </div>
            <span className="rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1c6c4d]">
              stop after layer 2
            </span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {minimumMirrorFiles.map((file) => (
              <li
                key={file}
                className="rounded-xl border border-[#e1eee3] bg-[#fbfefa] px-3 py-2 font-mono text-[11px] text-[#3d5349]"
              >
                {file}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.4em] text-[#7b9581]">
                <UserPlus size={14} className="text-[#1c6c4d]" /> Recruitment Pathway
              </div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">Builder Recruitment Intent Preparer</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#62766d]">
                Draft your recruitment proposal below. The browser serves strictly as a **read-only text-preparer** to format your intent. Stewards review proposals and execute actual writes exclusively inside the terminal.
              </p>
            </div>
          </div>

          {/* Recruitment Reserved Rails Mapping */}
          <div className="mt-5 rounded-2xl border border-[#cfe7d4] bg-[#f5fcf6] p-4 text-left">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#1c6c4d]">
              <ShieldCheck size={14} /> Recruitment Reserved Rails Mapping
            </div>
            <p className="mt-2 text-xs text-[#54655d] leading-relaxed">
              External applicants are strictly read-only in the browser. Writes to the Hearth are protected via cryptographic signatures and manual Terminal syncs.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#e2efe4] bg-white p-3 shadow-sm">
                <div className="text-[9px] uppercase tracking-widest font-bold text-[#f97316]">Phase A: Seed Signature</div>
                <div className="mt-1 text-xs font-semibold text-[#18382d]">Terminal Only</div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#62766d]">
                  JSON seeds are stamped with a hex SHA-256 heartbeat and verified before deployment. No client-side database writes permitted.
                </p>
              </div>

              <div className="rounded-xl border border-[#e2efe4] bg-white p-3 shadow-sm">
                <div className="text-[9px] uppercase tracking-widest font-bold text-[#1c6c4d]">Phase B: Client Read</div>
                <div className="mt-1 text-xs font-semibold text-[#18382d]">Read-Only List</div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#62766d]">
                  Applications and claims are loaded live from the read-only Firestore branch, ensuring real-time liveness indicators without data drift.
                </p>
              </div>

              <div className="rounded-xl border border-[#e2efe4] bg-white p-3 shadow-sm">
                <div className="text-[9px] uppercase tracking-widest font-bold text-[#7a4e2b]">Phase C: Steward Sync</div>
                <div className="mt-1 text-xs font-semibold text-[#18382d]">Node Merge-Upsert</div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#62766d]">
                  Stewards reconcile and sync claims via terminal commands using the Admin SDK, maintaining the terminal as the ultimate point of authority.
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e2efe4] pt-3 flex flex-wrap justify-between items-center gap-2">
              <span className="text-[10px] text-[#54655d]">
                Applicants must conform to the proposal schema spec in <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#cfe7d4]">proposal-intent.md</code>.
              </span>
              <a
                href="/proposal-intent.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1c6c4d] hover:underline"
              >
                <BookOpen size={11} /> Read proposal-intent.md <ExternalLink size={10} className="ml-0.5" />
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7b9581]">Draft Proposal Fields</label>
                <span className="text-[9px] uppercase tracking-wider text-[#b8d4c4]">Source: proposal-intent.json</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-[#62766d] mb-1">Handle (Required)</label>
                  <input
                    type="text"
                    placeholder={isHearthValid ? "Your Handle / Alias" : "Drafting Disabled (Hearth Fire Ash)"}
                    disabled={!isHearthValid}
                    className={`w-full rounded-xl border px-4 py-2 text-sm transition-colors ${
                      isHearthValid 
                        ? 'border-[#cfe7d4] bg-white text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none' 
                        : 'border-[#A9A9A9] bg-[#F2F2F2] text-slate-400 cursor-not-allowed'
                    }`}
                    value={draftHandle}
                    onChange={(e) => setDraftHandle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#62766d] mb-1">Profile URL (Optional HTTPS Link)</label>
                  <input
                    type="text"
                    placeholder={isHearthValid ? "https://github.com/..." : "Drafting Disabled (Hearth Fire Ash)"}
                    disabled={!isHearthValid}
                    className={`w-full rounded-xl border px-4 py-2 text-sm transition-colors ${
                      isHearthValid 
                        ? 'border-[#cfe7d4] bg-white text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none' 
                        : 'border-[#A9A9A9] bg-[#F2F2F2] text-slate-400 cursor-not-allowed'
                    }`}
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#62766d] mb-1">Target Area (Optional)</label>
                  <input
                    type="text"
                    placeholder={isHearthValid ? "e.g. Hall of Honor, Master Schema" : "Drafting Disabled (Hearth Fire Ash)"}
                    disabled={!isHearthValid}
                    className={`w-full rounded-xl border px-4 py-2 text-sm transition-colors ${
                      isHearthValid 
                        ? 'border-[#cfe7d4] bg-white text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none' 
                        : 'border-[#A9A9A9] bg-[#F2F2F2] text-slate-400 cursor-not-allowed'
                    }`}
                    value={draftTargetArea}
                    onChange={(e) => setDraftTargetArea(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#62766d] mb-1">Risk Assessment (Optional)</label>
                  <input
                    type="text"
                    placeholder={isHearthValid ? "e.g. Minor UX change, no schema mutation" : "Drafting Disabled (Hearth Fire Ash)"}
                    disabled={!isHearthValid}
                    className={`w-full rounded-xl border px-4 py-2 text-sm transition-colors ${
                      isHearthValid 
                        ? 'border-[#cfe7d4] bg-white text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none' 
                        : 'border-[#A9A9A9] bg-[#F2F2F2] text-slate-400 cursor-not-allowed'
                    }`}
                    value={draftRisk}
                    onChange={(e) => setDraftRisk(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#62766d] mb-1">Statement of Intent (Required)</label>
                  <textarea
                    placeholder={isHearthValid ? "Explain your contribution intent and why you wish to join the sanctuary..." : "Drafting Disabled (Hearth Fire Ash)"}
                    rows={4}
                    disabled={!isHearthValid}
                    className={`w-full rounded-xl border px-4 py-2 text-sm resize-none font-sans transition-colors ${
                      isHearthValid 
                        ? 'border-[#cfe7d4] bg-white text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none' 
                        : 'border-[#A9A9A9] bg-[#F2F2F2] text-slate-400 cursor-not-allowed'
                    }`}
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[#e8f1e9] bg-[#f2f8f3] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7b9581]">Compiled intent.json</span>
                <button
                  type="button"
                  onClick={() => {
                    const payload = {
                      handle: draftHandle.trim() || "anonymous",
                      profile_url: draftUrl.trim() || undefined,
                      note: draftNote.trim() || "No intent statement provided.",
                      target_area: draftTargetArea.trim() || undefined,
                      risk: draftRisk.trim() || undefined,
                      status: "pending"
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'intent.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!isHearthValid || !draftHandle.trim() || !draftNote.trim()}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isHearthValid && draftHandle.trim() && draftNote.trim()
                      ? 'bg-[#1c6c4d] hover:bg-[#124d35] text-white cursor-pointer'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Download size={12} /> Download JSON
                </button>
              </div>
              <pre className="flex-1 min-h-[220px] overflow-auto rounded-xl border border-[#d6e7da] bg-white p-4 font-mono text-xs text-[#3d5349] leading-relaxed select-all cursor-pointer" title="Click to select all">
{JSON.stringify({
  handle: draftHandle.trim() || "Name",
  profile_url: draftUrl.trim() || undefined,
  note: draftNote.trim() || "Intent description...",
  target_area: draftTargetArea.trim() || undefined,
  risk: draftRisk.trim() || undefined,
  status: "pending"
}, null, 2)}
              </pre>
              <div className="text-[10px] text-[#62766d] leading-relaxed border-t border-[#d6e7da] pt-3">
                <span className="font-bold text-[#1c6c4d]">🛡️ Steward Terminal Ingestion:</span>
                <p className="mt-1">Once you submit this JSON file to a steward, they run the CLI ingestion script in their workspace:</p>
                <code className="block mt-1.5 bg-white p-2 rounded border border-[#d6e7da] font-mono text-[9px] text-[#123228] select-all">
                  node scripts/steward-claim.js --file intent.json
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* World Forger Placeholder Section */}
        <section className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.4em] text-[#7b9581]">
                <Flame size={14} className="text-[#d97706] animate-pulse" /> 3D World Forger
              </div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">Geometric Cloud Data Preview Pane</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#62766d]">
                Draft a hearth-room update proposal as JSON. The browser provides a read-only preview pane to validate syntax, generate integrity witness hashes, and prove the proposal's witness certificate before submission. No write path, no auto-apply, and no Wasm execution are active on this preview rail.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {/* Input Column */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7b9581]">Draft Proposal JSON</label>
                <span className="text-[9px] uppercase tracking-wider text-[#b8d4c4]">Source: room_registry.json format</span>
              </div>
              <textarea
                value={forgerJson}
                onChange={(e) => setForgerJson(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-[#cfe7d4] bg-white px-4 py-3 font-mono text-xs text-[#18382d] placeholder:text-[#8aa195] focus:border-[#1c6c4d] focus:outline-none resize-none transition-colors"
                placeholder="Paste your JSON hearth-room update proposal..."
              />
              {forgerError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200/50 px-3 py-2 rounded-xl">
                  <TriangleAlert size={14} />
                  <span>{forgerError}</span>
                </div>
              )}
            </div>

            {/* Read-Only Artifact & Witness Column */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#e8f1e9] bg-[#f2f8f3] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#7b9581]">Witness Certificate</span>
                <span className="rounded-full bg-[#1c6c4d]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1c6c4d]">
                  witness-witness
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-between bg-white rounded-xl border border-[#d6e7da] p-4 relative overflow-hidden">
                <div>
                  <div className="text-[9px] uppercase tracking-widest font-bold text-[#7b9581]">Proposal Witness Hash</div>
                  <div className="mt-1.5 font-mono text-[10px] break-all bg-[#fbfefa] border border-[#e1eee3] px-3 py-2 rounded-lg text-[#123228] select-all cursor-pointer font-semibold shadow-inner" title="Click to copy SHA-256 witness hash">
                    {witnessHash}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#e8f1e9] pt-4">
                  <div className="text-[9px] uppercase tracking-widest font-bold text-[#7b9581] mb-2">Geometric Cloud Metadata</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[#62766d]">
                    <div className="bg-[#fbfefa] border border-[#e1eee3] p-2 rounded-lg">
                      <span className="block font-semibold text-[#18382d]">Target Surface:</span>
                      <span className="font-mono">/forge/world-forger</span>
                    </div>
                    <div className="bg-[#fbfefa] border border-[#e1eee3] p-2 rounded-lg">
                      <span className="block font-semibold text-[#18382d]">Execution Rail:</span>
                      <span className="font-mono text-[#d97706]">Read-Only Preview</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-[10px] text-[#62766d] leading-relaxed">
                  <span className="font-bold text-[#1c6c4d]">🛡️ Integrity Policy:</span>
                  <p className="mt-1">
                    To apply this update, copy the witness hash and file it with a steward. The steward must authorize and commit it to `room_registry.json` via the terminal:
                  </p>
                  <code className="block mt-1.5 bg-[#fbfefa] p-2 rounded border border-[#d6e7da] font-mono text-[9px] text-[#123228] select-all">
                    node scripts/steward-room.js --hash {witnessHash.substring(0, 12)}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-white/90 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#d5ecda] bg-[#eefaf2] p-2 text-[#1f8f5d]">
              <Sparkles size={17} />
            </div>
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">
                Choose your next build
              </h2>
              <p className="mt-1 text-sm text-[#6d7f76]">
                Pick one bounded slice, add your piece of heaven, and report back in the Builder Report Contract shape.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {nextBuildOptions.map((option) => (
              <div key={option.title} className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
                <div className="text-sm font-semibold text-[#18382d]">{option.title}</div>
                <div className="mt-1 text-sm leading-6 text-[#62766d]">{option.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-[#f7fcf6] px-5 py-5 shadow-[0_18px_50px_rgba(97,127,105,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7b9581]">phase 2 steward sync</div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">After Phase 1 env works, move the mission through the runbook.</h2>
              <p className="mt-2 text-sm leading-6 text-[#62766d]">
                Keep the browser read-only. When <code className="text-[11px] text-[#3d5349]">VITE_FIREBASE_* </code>
                is present and the Hall shows the supplemental registry, use the terminal-only steward path:
                export the seed bundle, run a dry-run, then sync live with a service account.
              </p>
            </div>
            <a
              href="/steward-runbook.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1c6c4d] hover:bg-[#effbf1]"
            >
              Open steward runbook
              <ArrowRight size={15} />
            </a>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 1</div>
              <div className="mt-1 font-medium text-[#18382d]">Export the stamped seeds</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Run <code className="text-[11px] text-[#3d5349]">npm run export:firestore-seed</code> at repo root.
              </div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 2</div>
              <div className="mt-1 font-medium text-[#18382d]">Dry-run the bundle</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Run <code className="text-[11px] text-[#3d5349]">npm run sync:firestore:dry-run</code> and confirm the printed summary.
              </div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 3</div>
              <div className="mt-1 font-medium text-[#18382d]">Sync live with credentials</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Set <code className="text-[11px] text-[#3d5349]">GOOGLE_APPLICATION_CREDENTIALS</code>, then run{' '}
                <code className="text-[11px] text-[#3d5349]">npm run sync:firestore</code>.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-white/90 px-5 py-5 shadow-[0_18px_50px_rgba(97,127,105,0.08)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7b9581]">phase 3 claims</div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">Keep claims manual, approved-only, and separate from seed sync.</h2>
              <p className="mt-2 text-sm leading-6 text-[#62766d]">
                The Hall only shows approved claims. The steward path is terminal-only and keeps the review queue in the right
                order: list pending rows, check the fields, then approve or reject by the same id.
              </p>
            </div>
            <a
              href="/steward-runbook.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1c6c4d] hover:bg-[#e8f6ea]"
            >
              Open claims path
              <ArrowRight size={15} />
            </a>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 1</div>
              <div className="mt-1 font-medium text-[#18382d]">List pending claims</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Run <code className="text-[11px] text-[#3d5349]">npm run steward:claim -- list-pending</code> from the repo root.
              </div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 2</div>
              <div className="mt-1 font-medium text-[#18382d]">Check the fields</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Review <code className="text-[11px] text-[#3d5349]">handle</code>,{' '}
                <code className="text-[11px] text-[#3d5349]">profile_url</code>, and <code className="text-[11px] text-[#3d5349]">note</code>.
              </div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">step 3</div>
              <div className="mt-1 font-medium text-[#18382d]">Approve or reject the same id</div>
              <div className="mt-1 text-sm text-[#62766d]">
                Use the id from step 1, then list pending again to confirm the queue.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9e9dc] bg-[#fbfcfb] px-5 py-5 shadow-[0_18px_50px_rgba(97,127,105,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#7b9581]">phase 4 boundary</div>
              <h2 className="mt-1 text-lg font-semibold text-[#123228]">Reserve the regulated branch for later contracts.</h2>
              <p className="mt-2 text-sm leading-6 text-[#62766d]">
                The Firebase roadmap explicitly reserves wallet connection, payment automation, swaps, browser writes, AI action
                execution, and Moltbook automation for a future written branch. They stay out of the browser and out of the Hall
                until their own verifier and rollback path exist.
              </p>
            </div>
            <a
              href="/firebase-readiness.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1c6c4d] hover:bg-[#effbf1]"
            >
              Open boundary note
              <ArrowRight size={15} />
            </a>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">reserved</div>
              <div className="mt-1 font-medium text-[#18382d]">Wallet connection and signing</div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">reserved</div>
              <div className="mt-1 font-medium text-[#18382d]">Payments, swaps, and browser writes</div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#7d9288]">reserved</div>
              <div className="mt-1 font-medium text-[#18382d]">AI action execution and Moltbook automation</div>
            </div>
          </div>
        </section>

        <ArtifactInspector />
      </div>
    </div>
  );
}

export default ForgePage;
