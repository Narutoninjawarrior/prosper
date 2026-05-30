import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, FileJson, Layers3, Radio, ShieldCheck, User, Home, Award, Activity, AlertCircle } from 'lucide-react';
import { getFirebaseBranchWiringStatus } from './lib/firebaseBranchStatus';
import { useContract, sanctuaryBridge } from './lib/sanctuaryBridge';

type InterfaceManifest = {
  interface_id: string;
  manifest_version: string;
  philosophy: string;
  integrity_policy: string;
  manifest_hash?: string;
  source_of_truth?: Record<string, string>;
  consumers?: Array<{
    name?: string;
    mode?: string;
    allowed_surfaces?: string[];
  }>;
  artifact_layers?: Array<{
    layer?: number;
    name?: string;
    files?: string[];
  }>;
  deep_interface?: {
    read_only?: string[];
    terminal_only?: string[];
    future_regulated_spaces?: string[];
    explicit_non_goals?: string[];
  };
  branch_rules?: {
    mirror_now?: string;
    branch_later?: string;
    no_rewrite?: string;
  };
};

type FirebaseBranchManifest = {
  branch_id: string;
  manifest_version: string;
  version: string;
  last_updated: string;
  philosophy: string;
  integrity_policy: string;
  manifest_hash?: string;
  source_of_truth?: Record<string, string>;
  ai_consumption_rules?: string[];
  phases?: Array<{
    phase?: number;
    name?: string;
    goal?: string;
    surfaces?: string[];
  }>;
  collections?: Array<{
    name?: string;
    purpose?: string;
    read_model?: string;
  }>;
  env?: {
    browser?: string[];
    node?: string[];
  };
  rules?: Record<string, string>;
  regulated_surfaces?: string[];
  explicit_non_goals?: string[];
};

type SchemaRegistrySummary = {
  member: {
    fields: string[];
    optional_fields: string[];
  };
  room: {
    fields: string[];
  };
  quest: {
    fields: string[];
  };
  doctrine: string[];
};

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export default function ArtifactInspector() {
  const membersEnvelope = useContract('/vessel_members.json', sanctuaryBridge.normalizeMembers, []);
  const roomsEnvelope = useContract('/room_registry.json', sanctuaryBridge.normalizeRooms, []);
  const questsEnvelope = useContract('/quest_board.json', sanctuaryBridge.normalizeQuests, []);

  const [inspectTab, setInspectTab] = useState<'members' | 'rooms' | 'quests'>('members');

  const [manifest, setManifest] = useState<InterfaceManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firebaseBranch, setFirebaseBranch] = useState<FirebaseBranchManifest | null>(null);
  const [firebaseBranchError, setFirebaseBranchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/lodge-interface.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as InterfaceManifest;
        if (!cancelled) {
          setManifest(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setManifest(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/firebase-branch.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as FirebaseBranchManifest;
        if (!cancelled) {
          setFirebaseBranch(json);
          setFirebaseBranchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFirebaseBranchError(err instanceof Error ? err.message : String(err));
          setFirebaseBranch(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const layerCards = useMemo(() => manifest?.artifact_layers ?? [], [manifest]);
  const consumers = useMemo(() => manifest?.consumers ?? [], [manifest]);
  const deepInterface = manifest?.deep_interface;
  const firebasePhases = useMemo(() => firebaseBranch?.phases ?? [], [firebaseBranch]);
  const firebaseCollections = useMemo(() => firebaseBranch?.collections ?? [], [firebaseBranch]);
  const firebaseWiring = useMemo(() => getFirebaseBranchWiringStatus(), []);
  const schemaRegistry = useMemo<SchemaRegistrySummary>(
    () => ({
      member: {
        fields: ['handle', 'wallet_address', 'access_level', 'is_whitelisted', 'ember_balance', 'solcot_balance', 'acts_of_chivalry_count', 'room', 'room_visibility'],
        optional_fields: ['paid_until', 'moltbook_profile_url', 'moltbook_handle', 'honor_tier', 'skill_tags', 'agent_identity'],
      },
      room: {
        fields: ['name', 'owner', 'visibility', 'write_access', 'summary'],
      },
      quest: {
        fields: ['title', 'reward_ember', 'status', 'room', 'description'],
      },
      doctrine: [
        'Read-only registry, not a write surface.',
        'Update the validator and the seed in the same change.',
        'Keep browser surfaces read-only until a separate written branch exists.',
      ],
    }),
    [],
  );

  return (
    <section className="rounded-[2rem] border border-[#d7eadc] bg-white/90 p-6 shadow-[0_12px_40px_rgba(97,127,105,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[#1f8f5d]">
            <Layers3 size={18} aria-hidden />
            <h2 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">artifact inspector</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#54655d]">
            This is the machine-readable deep interface for the Lodge. It is the place a Gemma, Qwen, or future regulator can read
            the Lodge without guessing what is source of truth, what is terminal-only, and what must stay read-only.
          </p>
        </div>
        <a
          href="/lodge-interface.json"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1c6c4d] hover:bg-[#e8f6ea]"
        >
          <FileJson size={14} />
          Open manifest
        </a>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unable to load `/lodge-interface.json`: {error}
        </div>
      ) : null}

      {manifest ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">interface id</div>
              <div className="mt-2 text-sm font-semibold text-[#18382d]">{manifest.interface_id}</div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">manifest</div>
              <div className="mt-2 text-sm font-semibold text-[#18382d]">{manifest.manifest_version}</div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">integrity</div>
              <div className="mt-2 text-sm font-semibold text-[#18382d]">{manifest.integrity_policy}</div>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">hash</div>
              <div className="mt-2 text-[11px] font-mono text-[#18382d]">{manifest.manifest_hash ?? 'unsigned'}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="flex items-center gap-2 text-[#1f8f5d]">
                <BookOpen size={16} aria-hidden />
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">source of truth</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {manifest.source_of_truth
                  ? Object.entries(manifest.source_of_truth).map(([label, path]) => (
                      <li key={label} className="flex items-start justify-between gap-3 rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">
                        <span className="font-medium text-[#18382d]">{label}</span>
                        <code className="text-[11px] text-[#54655d]">{path}</code>
                      </li>
                    ))
                  : null}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="flex items-center gap-2 text-[#1f8f5d]">
                <ShieldCheck size={16} aria-hidden />
                <h3 className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">branch rules</h3>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {manifest.branch_rules ? (
                  <>
                    <li className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">{manifest.branch_rules.mirror_now}</li>
                    <li className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">{manifest.branch_rules.branch_later}</li>
                    <li className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">{manifest.branch_rules.no_rewrite}</li>
                  </>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#1f8f5d]">
              <BookOpen size={16} aria-hidden />
              <h3 className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">master schema registry</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#54655d]">
              Shared validator contract defined in <code className="text-[11px] text-[#3d5349]">frontend/src/lib/contracts.ts</code>. It ensures zero parser drift and guarantees that all network seeds and client-side claims validate against strict cryptographic contracts.
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-[#e7f1e8] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[#123228]">MemberContract</div>
                  <span className="rounded bg-[#effbf1] px-1.5 py-0.5 text-[8px] font-mono text-[#1c6c4d]">Seed Schema</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {schemaRegistry.member.fields.map((field) => (
                    <span key={field} className="rounded-full border border-[#e8efe9] bg-[#fcfdfc] px-2 py-0.5 text-[10px] text-[#54655d]">
                      {field}
                    </span>
                  ))}
                </div>
                <div className="mt-3 border-t border-dashed border-[#e7f1e8] pt-2.5">
                  <div className="text-[10px] font-semibold text-[#7b9581] uppercase tracking-wider">Optional Observational Fields:</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {schemaRegistry.member.optional_fields.map((field) => (
                      <span key={field} className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        field === 'agent_identity' 
                          ? 'border-[#fbd5c0] bg-[#fffcfc] text-[#f97316] font-semibold' 
                          : 'border-[#e8efe9] bg-white text-[#54655d]'
                      }`}>
                        {field}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 rounded-lg bg-[#fffdfb] border border-[#fbd5c0] p-2 text-[9px] text-[#7a4e2b] leading-normal">
                    <strong>🔍 agent_identity Tracking:</strong> Observes whether the OpenClaw agent instance is currently alive (observational metadata only; strictly read-only inside browser). Contains:
                    <code className="block mt-1 font-mono text-[9px] text-[#9a3412]">
                      {'{ heartbeat_active: boolean, last_ping: string, client_version: string }'}
                    </code>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e7f1e8] bg-white p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[#123228]">RoomContract</div>
                    <span className="rounded bg-[#effbf1] px-1.5 py-0.5 text-[8px] font-mono text-[#1c6c4d]">Seed Schema</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {schemaRegistry.room.fields.map((field) => (
                      <span key={field} className="rounded-full border border-[#e8efe9] bg-[#fcfdfc] px-2 py-0.5 text-[10px] text-[#54655d]">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-[10px] text-[#7b9581] leading-relaxed">
                  Defines the static coordinates of the Lodge rooms seeded in <code className="text-[9px] text-[#54655d]">room_registry.json</code>.
                </div>
              </div>

              <div className="rounded-xl border border-[#e7f1e8] bg-white p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[#123228]">QuestContract</div>
                    <span className="rounded bg-[#effbf1] px-1.5 py-0.5 text-[8px] font-mono text-[#1c6c4d]">Seed Schema</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {schemaRegistry.quest.fields.map((field) => (
                      <span key={field} className="rounded-full border border-[#e8efe9] bg-[#fcfdfc] px-2 py-0.5 text-[10px] text-[#54655d]">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 text-[10px] text-[#7b9581] leading-relaxed">
                  Governs all community bounties and reward allocations seeded in <code className="text-[9px] text-[#54655d]">quest_board.json</code>.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-4 shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#c2410c] flex items-center gap-1.5">
                <ShieldCheck size={14} /> Strict Boundary Enforcement Policy
              </h4>
              <div className="mt-2 grid gap-4 md:grid-cols-3 text-xs leading-normal">
                <div className="rounded-lg bg-white/80 p-2.5 border border-[#ffedd5]">
                  <span className="font-semibold text-[#7c2d12] block">🌐 Browser Space (100% Read-Only)</span>
                  <p className="mt-1 text-[#431407]">Observes static JSON contracts and Firestore approved pings. No wallet signatures or database-mutating requests allowed.</p>
                </div>
                <div className="rounded-lg bg-white/80 p-2.5 border border-[#ffedd5]">
                  <span className="font-semibold text-[#7c2d12] block">💻 Terminal Space (Steward-Only CLI)</span>
                  <p className="mt-1 text-[#431407]">Syncing seeds, processing dry-runs, listing pending items, and ingesting `intent.json` remains isolated to active operator CLI shells.</p>
                </div>
                <div className="rounded-lg bg-white/80 p-2.5 border border-[#ffedd5]">
                  <span className="font-semibold text-[#7c2d12] block">🔒 Regulated Spaces (Phase D Deferred)</span>
                  <p className="mt-1 text-[#431407]">Solana Pay, x402 Micropayments, wallet connections, and automatic on-chain membership mutations are strictly excluded from this vessel.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">artifact layers</div>
              <div className="mt-3 space-y-3">
                {layerCards.map((layer) => (
                  <div key={layer.layer} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-[#18382d]">
                        Layer {layer.layer ?? '?'} · {layer.name ?? 'unnamed'}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#8a9b94]">{stringList(layer.files).length} files</span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {stringList(layer.files).map((file) => (
                        <li key={file} className="rounded-full border border-[#dbe8dd] bg-[#f7fbf7] px-2.5 py-1 text-[11px] text-[#54655d]">
                          {file}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">consumers</div>
              <div className="mt-3 space-y-3">
                {consumers.map((consumer) => (
                  <div key={consumer.name} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-[#18382d]">{consumer.name}</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a9b94]">{consumer.mode}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stringList(consumer.allowed_surfaces).map((surface) => (
                        <span key={surface} className="rounded-full border border-[#dbe8dd] bg-[#f7fbf7] px-2.5 py-1 text-[11px] text-[#54655d]">
                          {surface}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">read only</div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {stringList(deepInterface?.read_only).map((item) => (
                  <li key={item} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">terminal only</div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {stringList(deepInterface?.terminal_only).map((item) => (
                  <li key={item} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">future regulated spaces</div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {stringList(deepInterface?.future_regulated_spaces).map((item) => (
                  <li key={item} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
              <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">explicit non-goals</div>
              <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                {stringList(deepInterface?.explicit_non_goals).map((item) => (
                  <li key={item} className="rounded-xl border border-[#e7f1e8] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-[#7f958a]">
            <a href="/lodge-interface.json" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#1f8f5d] underline decoration-[#b8d4c4] underline-offset-2">
              <ExternalLink size={12} aria-hidden />
              Open manifest
            </a>
            <span>·</span>
            <span>Fail closed first, then mirror or branch.</span>
          </div>

          <div className="rounded-2xl border border-[#d8e9dd] bg-[#f7fbf7] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-[#1f8f5d]">
                  <FileJson size={16} aria-hidden />
                  <h3 className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">firebase branch blueprint</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#54655d]">
                  The additive Firebase path is explicit here: config, supplemental reads, steward sync, manual claims, then reserved
                  regulated surfaces later. This stays advisory and read-only until a written write path exists.
                </p>
              </div>
              <a
                href="/firebase-branch.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1c6c4d] hover:bg-[#eef8ef]"
              >
                <FileJson size={14} />
                Open branch
              </a>
            </div>

            {firebaseBranchError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Unable to load `/firebase-branch.json`: {firebaseBranchError}
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-[#cfe7d4] bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-[#1f8f5d]">
                  <Radio size={16} aria-hidden />
                  <h4 className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">phase 0 — browser wiring (live)</h4>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                    firebaseWiring.browserEnvReady
                      ? 'border-[#cfe7d4] bg-[#f5fcf6] text-[#1c6c4d]'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  {firebaseWiring.browserEnvReady ? 'env ready' : 'env missing'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#54655d]">{firebaseWiring.phase0Label}</p>
              {firebaseWiring.projectId ? (
                <p className="mt-2 text-sm text-[#54655d]">
                  Project: <code className="text-[11px] text-[#3d5349]">{firebaseWiring.projectId}</code>
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6 text-[#54655d]">{firebaseWiring.phase1Hint}</p>
              <p className="mt-2 text-xs leading-5 text-[#7f958a]">{firebaseWiring.terminalOnlyNote}</p>
              <a
                href="/firebase-readiness.md"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1f8f5d] underline decoration-[#b8d4c4] underline-offset-2"
              >
                <ExternalLink size={12} aria-hidden />
                Firebase readiness map
              </a>
            </div>

            {firebaseBranch ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">branch id</div>
                    <div className="mt-2 text-sm font-semibold text-[#18382d]">{firebaseBranch.branch_id}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">version</div>
                    <div className="mt-2 text-sm font-semibold text-[#18382d]">{firebaseBranch.version}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">updated</div>
                    <div className="mt-2 text-sm font-semibold text-[#18382d]">{firebaseBranch.last_updated}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e1eee3] bg-white px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">hash</div>
                    <div className="mt-2 text-[11px] font-mono text-[#18382d]">{firebaseBranch.manifest_hash ?? 'unsigned'}</div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e1eee3] bg-white p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">phases</div>
                    <div className="mt-3 space-y-3">
                      {firebasePhases.map((phase) => (
                        <div key={phase.phase} className="rounded-xl border border-[#e7f1e8] bg-[#fbfefa] px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-[#18382d]">
                              Phase {phase.phase ?? '?'} · {phase.name ?? 'unnamed'}
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-[#54655d]">{phase.goal}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {stringList(phase.surfaces).map((surface) => (
                              <span key={surface} className="rounded-full border border-[#dbe8dd] bg-white px-2.5 py-1 text-[11px] text-[#54655d]">
                                {surface}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e1eee3] bg-white p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">collections</div>
                    <div className="mt-3 space-y-3">
                      {firebaseCollections.map((collection) => (
                        <div key={collection.name} className="rounded-xl border border-[#e7f1e8] bg-[#fbfefa] px-3 py-3">
                          <div className="font-semibold text-[#18382d]">{collection.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8a9b94]">{collection.read_model}</div>
                          <p className="mt-2 text-sm text-[#54655d]">{collection.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#e1eee3] bg-white p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">regulated surfaces</div>
                    <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                      {stringList(firebaseBranch.regulated_surfaces).map((item) => (
                        <li key={item} className="rounded-xl border border-[#e7f1e8] bg-[#fbfefa] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[#e1eee3] bg-white p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#8a9b94]">ai consumption rules</div>
                    <ul className="mt-3 space-y-2 text-sm text-[#54655d]">
                      {stringList(firebaseBranch.ai_consumption_rules).map((item) => (
                        <li key={item} className="rounded-xl border border-[#e7f1e8] bg-[#fbfefa] px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

          {/* HEARTH SEEDS OBSERVATION DECK */}
          <div className="rounded-[2rem] border border-[#d5ecda] bg-[#fbfefa] p-5 shadow-sm mt-5 text-left">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#1f8f5d]">
                  <Activity size={18} className="animate-[pulse_2s_infinite]" />
                  <h3 className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">hearth seeds observation deck</h3>
                </div>
                <p className="mt-2 text-sm text-[#54655d]">
                  Live observability layer streaming static sandbox seeds validated via cryptographic SHA-256 signatures.
                </p>
              </div>

              {/* Tabs Selector */}
              <div className="flex gap-1.5 rounded-xl bg-white border border-[#e2efe4] p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setInspectTab('members')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                    inspectTab === 'members'
                      ? 'bg-[#1c6c4d] text-white shadow-sm'
                      : 'text-[#54655d] hover:bg-[#f3f9f4] hover:text-[#1c6c4d]'
                  }`}
                >
                  <User size={13} />
                  Members
                </button>
                <button
                  type="button"
                  onClick={() => setInspectTab('rooms')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                    inspectTab === 'rooms'
                      ? 'bg-[#1c6c4d] text-white shadow-sm'
                      : 'text-[#54655d] hover:bg-[#f3f9f4] hover:text-[#1c6c4d]'
                  }`}
                >
                  <Home size={13} />
                  Rooms
                </button>
                <button
                  type="button"
                  onClick={() => setInspectTab('quests')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-250 cursor-pointer ${
                    inspectTab === 'quests'
                      ? 'bg-[#1c6c4d] text-white shadow-sm'
                      : 'text-[#54655d] hover:bg-[#f3f9f4] hover:text-[#1c6c4d]'
                  }`}
                >
                  <Award size={13} />
                  Quests
                </button>
              </div>
            </div>

            {/* TAB PANES */}
            <div className="mt-4 rounded-2xl bg-white border border-[#e7f1e8] p-4 shadow-sm min-h-[300px]">
              {/* MEMBERS TAB */}
              {inspectTab === 'members' && (
                <div>
                  <div className="flex items-center justify-between border-b border-dashed border-[#e7f1e8] pb-3 mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#7b9581]">
                      Seed File: vessel_members.json
                    </span>
                    <span className="text-[9px] font-mono text-[#b8d4c4]">
                      Total Rows: {membersEnvelope.data.length}
                    </span>
                  </div>

                  {membersEnvelope.state === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-[#7f958a] gap-2">
                      <Activity className="animate-spin text-[#1c6c4d]" size={20} />
                      Streaming ledger entries...
                    </div>
                  )}

                  {membersEnvelope.state === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2 text-left">
                      <AlertCircle size={16} className="shrink-0" />
                      <div>
                        <strong className="block font-bold">Ledger Load Blocked</strong>
                        {membersEnvelope.error || 'The Fellowship seed failed integrity validation. Check terminal sync logs.'}
                      </div>
                    </div>
                  )}

                  {membersEnvelope.state !== 'loading' && membersEnvelope.state !== 'error' && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {membersEnvelope.data.map((member) => (
                        <div key={member.handle} className="rounded-xl border border-[#eaf3eb] bg-[#fbfefa] p-3 flex flex-col justify-between text-left">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-[#18382d]">@{member.handle}</span>
                              <span className="rounded bg-[#effbf1] px-1.5 py-0.5 text-[8px] font-mono text-[#1c6c4d]">
                                {member.access_level}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-[#54655d]">
                              <div className="flex justify-between">
                                <span className="text-[#8a9b94]">Ember Balance:</span>
                                <span className="font-mono text-[#1c6c4d] font-semibold">{member.ember_balance} EMBER</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#8a9b94]">SOLCOT Balance:</span>
                                <span className="font-mono text-[#7a4e2b] font-semibold">{(member.solcot_balance || 0).toLocaleString()} SOLCOT</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#8a9b94]">Acts of Chivalry:</span>
                                <span className="font-semibold">{member.acts_of_chivalry_count}</span>
                              </div>
                              {member.room && (
                                <div className="flex justify-between">
                                  <span className="text-[#8a9b94]">Active Room:</span>
                                  <span className="font-semibold text-[#18382d]">{member.room}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* agent_identity Observational HUD */}
                          {member.agent_identity && (
                            <div className="mt-3 border-t border-dashed border-[#e7f1e8] pt-2 text-left">
                              <div className="flex items-center justify-between text-[9px] font-bold text-[#f97316] uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  <Activity size={10} className="animate-[pulse_1.5s_infinite]" /> Agent Wick
                                </span>
                                <span className="font-semibold text-[#c2410c]">
                                  {member.agent_identity.heartbeat_active ? 'Alive' : 'Offline'}
                                </span>
                              </div>
                              <div className="mt-1 text-[9px] text-[#7a4e2b] space-y-0.5 leading-normal">
                                <div><strong className="text-[#f97316]">Version:</strong> {member.agent_identity.client_version}</div>
                                <div><strong className="text-[#f97316]">Last Ping:</strong> {new Date(member.agent_identity.last_ping).toLocaleTimeString()}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Liveness footer proof */}
                  <div className="mt-4 border-t border-[#eaf3eb] pt-3 flex flex-wrap justify-between gap-2 text-[10px] text-[#8a9b94] text-left">
                    <div>
                      <strong className="text-[#54655d]">Manifest Hash: </strong>
                      <code className="font-mono bg-[#f5fcf6] px-1 py-0.5 rounded border border-[#e2efe4] text-[#1c6c4d] select-all">
                        {membersEnvelope.manifestHash || 'unsigned'}
                      </code>
                    </div>
                    <div>
                      <strong className="text-[#54655d]">Loaded: </strong>
                      {membersEnvelope.loadedAt ? new Date(membersEnvelope.loadedAt).toLocaleTimeString() : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <strong className="text-[#54655d]">Verification: </strong>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                        membersEnvelope.state === 'ready'
                          ? 'bg-[#effbf1] text-[#1c6c4d] border border-[#cfe7d4]'
                          : 'bg-red-50 text-red-700 border border-red-150'
                      }`}>
                        {membersEnvelope.state === 'ready' ? 'SHA-256 Validated' : 'Verification Stale / Extinguished'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ROOMS TAB */}
              {inspectTab === 'rooms' && (
                <div>
                  <div className="flex items-center justify-between border-b border-dashed border-[#e7f1e8] pb-3 mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#7b9581]">
                      Seed File: room_registry.json
                    </span>
                    <span className="text-[9px] font-mono text-[#b8d4c4]">
                      Total Rooms: {roomsEnvelope.data.length}
                    </span>
                  </div>

                  {roomsEnvelope.state === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-[#7f958a] gap-2">
                      <Activity className="animate-spin text-[#1c6c4d]" size={20} />
                      Streaming room registry...
                    </div>
                  )}

                  {roomsEnvelope.state === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2 text-left">
                      <AlertCircle size={16} className="shrink-0" />
                      <div>
                        <strong className="block font-bold">Registry Load Blocked</strong>
                        {roomsEnvelope.error || 'The Room seed failed integrity validation. Check terminal sync logs.'}
                      </div>
                    </div>
                  )}

                  {roomsEnvelope.state !== 'loading' && roomsEnvelope.state !== 'error' && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {roomsEnvelope.data.map((room) => (
                        <div key={room.name} className="rounded-xl border border-[#eaf3eb] bg-[#fbfefa] p-3 flex flex-col justify-between text-left">
                          <div>
                            <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#eaf3eb] pb-1.5 mb-2">
                              <span className="text-sm font-semibold text-[#18382d]">{room.name}</span>
                              <span className="rounded bg-[#effbf1] px-1.5 py-0.5 text-[8px] font-mono text-[#1c6c4d]">
                                {room.visibility}
                              </span>
                            </div>
                            <p className="text-xs text-[#54655d] leading-relaxed mb-3">{room.summary}</p>
                          </div>
                          <div className="text-[10px] text-[#8a9b94] space-y-1 pt-1.5 border-t border-[#eaf3eb]">
                            <div className="flex justify-between">
                              <span>Steward/Owner:</span>
                              <span className="font-semibold text-[#54655d]">@{room.owner}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Write Rail:</span>
                              <span className="font-semibold text-[#54655d]">{room.write_access}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Liveness footer proof */}
                  <div className="mt-4 border-t border-[#eaf3eb] pt-3 flex flex-wrap justify-between gap-2 text-[10px] text-[#8a9b94] text-left">
                    <div>
                      <strong className="text-[#54655d]">Manifest Hash: </strong>
                      <code className="font-mono bg-[#f5fcf6] px-1 py-0.5 rounded border border-[#e2efe4] text-[#1c6c4d] select-all">
                        {roomsEnvelope.manifestHash || 'unsigned'}
                      </code>
                    </div>
                    <div>
                      <strong className="text-[#54655d]">Loaded: </strong>
                      {roomsEnvelope.loadedAt ? new Date(roomsEnvelope.loadedAt).toLocaleTimeString() : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <strong className="text-[#54655d]">Verification: </strong>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                        roomsEnvelope.state === 'ready'
                          ? 'bg-[#effbf1] text-[#1c6c4d] border border-[#cfe7d4]'
                          : 'bg-red-50 text-red-700 border border-red-150'
                      }`}>
                        {roomsEnvelope.state === 'ready' ? 'SHA-256 Validated' : 'Verification Stale / Extinguished'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* QUESTS TAB */}
              {inspectTab === 'quests' && (
                <div>
                  <div className="flex items-center justify-between border-b border-dashed border-[#e7f1e8] pb-3 mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#7b9581]">
                      Seed File: quest_board.json
                    </span>
                    <span className="text-[9px] font-mono text-[#b8d4c4]">
                      Total Quests: {questsEnvelope.data.length}
                    </span>
                  </div>

                  {questsEnvelope.state === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-[#7f958a] gap-2">
                      <Activity className="animate-spin text-[#1c6c4d]" size={20} />
                      Streaming quest board...
                    </div>
                  )}

                  {questsEnvelope.state === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2 text-left">
                      <AlertCircle size={16} className="shrink-0" />
                      <div>
                        <strong className="block font-bold">Quest Board Load Blocked</strong>
                        {questsEnvelope.error || 'The Quest seed failed integrity validation. Check terminal sync logs.'}
                      </div>
                    </div>
                  )}

                  {questsEnvelope.state !== 'loading' && questsEnvelope.state !== 'error' && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {questsEnvelope.data.map((quest) => (
                        <div key={quest.title} className="rounded-xl border border-[#eaf3eb] bg-[#fbfefa] p-3 flex flex-col justify-between text-left">
                          <div>
                            <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#eaf3eb] pb-1.5 mb-2">
                              <span className="text-sm font-semibold text-[#18382d] line-clamp-1">{quest.title}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase ${
                                quest.status === 'active'
                                  ? 'bg-[#effbf1] text-[#1c6c4d]'
                                  : 'bg-[#fff7ed] text-[#c2410c]'
                              }`}>
                                {quest.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#54655d] leading-relaxed mb-3 line-clamp-3">{quest.description}</p>
                          </div>
                          <div className="text-[10px] text-[#8a9b94] space-y-1 pt-1.5 border-t border-[#eaf3eb]">
                            <div className="flex justify-between">
                              <span>Lodge Room:</span>
                              <span className="font-semibold text-[#54655d]">{quest.room}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Allocated Reward:</span>
                              <span className="font-mono font-bold text-[#1c6c4d]">{quest.reward_ember} EMBER</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Liveness footer proof */}
                  <div className="mt-4 border-t border-[#eaf3eb] pt-3 flex flex-wrap justify-between gap-2 text-[10px] text-[#8a9b94] text-left">
                    <div>
                      <strong className="text-[#54655d]">Manifest Hash: </strong>
                      <code className="font-mono bg-[#f5fcf6] px-1 py-0.5 rounded border border-[#e2efe4] text-[#1c6c4d] select-all">
                        {questsEnvelope.manifestHash || 'unsigned'}
                      </code>
                    </div>
                    <div>
                      <strong className="text-[#54655d]">Loaded: </strong>
                      {questsEnvelope.loadedAt ? new Date(questsEnvelope.loadedAt).toLocaleTimeString() : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <strong className="text-[#54655d]">Verification: </strong>
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                        questsEnvelope.state === 'ready'
                          ? 'bg-[#effbf1] text-[#1c6c4d] border border-[#cfe7d4]'
                          : 'bg-red-50 text-red-700 border border-red-150'
                      }`}>
                        {questsEnvelope.state === 'ready' ? 'SHA-256 Validated' : 'Verification Stale / Extinguished'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          </div>
        </div>
      ) : null}
    </section>
  );
}
