import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Bot,
  Download,
  ExternalLink,
  Fingerprint,
  Hash,
  ScrollText,
} from 'lucide-react';

type PassportReceipt = {
  kind: string;
  label: string;
  receipt_hash?: string;
  apparatus_id?: string;
  timestamp?: string;
  source: string;
};

type PassportTask = {
  id: string;
  type: string;
  title: string;
  status: string;
  timestamp?: string;
  source: string;
  task_id?: string;
  receipt_hash?: string;
  ref?: string;
};

type PassportMemoryEvent = {
  id: string;
  event_type: string;
  summary: string;
  source: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

type PassportBundle = {
  generated_at: string;
  agent: {
    id: string;
    name: string;
    status: string;
    public_key?: string;
    moltbook_handle?: string;
    ember_balance?: number;
    trust_score?: number;
    trust_tier?: string;
    last_action_at?: string;
    days_since_last_action?: number;
    created_at?: string;
    last_active?: string;
    has_firebase_owner: boolean;
  };
  identity: {
    provider: string;
    linked: boolean;
    state?: string;
    linked_at?: string;
    last_verified_at?: string;
    profile?: Record<string, unknown>;
  };
  continuity: {
    last_apparatus_inspected: string | null;
    last_task_transition?: PassportTask | null;
    last_receipt?: PassportReceipt | null;
    last_identity_verification?: string | null;
    recent_receipts: PassportReceipt[];
    recent_tasks: PassportTask[];
    recent_inspects: PassportMemoryEvent[];
    memory_events: PassportMemoryEvent[];
    action_timeline?: Array<{
      id: string;
      kind: 'identity' | 'inspect' | 'task' | 'receipt';
      label: string;
      source: string;
      timestamp?: string;
      status?: string;
      ref?: string;
      receipt_hash?: string;
    }>;
    candidate_tasks?: Array<Record<string, unknown>>;
    export_url: string;
  };
  policy: {
    passport_surface: string;
    memory_append: string;
    external_identity: string;
  };
  docs: {
    agent_route: string;
    auth_instructions: string;
  };
};

type ProofLink = {
  href?: string;
  label: string;
  mode: 'verified' | 'memory' | 'disabled';
  note: string;
};

function formatTime(value?: string): string {
  if (!value) return 'unknown';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 'unknown';
  const delta = Date.now() - parsed;
  if (delta < 60_000) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function encodeReceiptHref(receiptHash: string): string {
  return `/activity?receipt=${encodeURIComponent(receiptHash)}`;
}

function apparatusRegistryHref(id: string): string {
  return `/registry?kind=apparatus&id=${encodeURIComponent(id)}`;
}

function registryHref(kind: string, id: string): string {
  return `/registry?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
}

function resolveProofLink(entry: {
  kind: 'identity' | 'inspect' | 'task' | 'receipt';
  source: string;
  ref?: string;
  receipt_hash?: string;
  status?: string;
}): ProofLink {
  const ref = entry.ref?.trim();
  const receiptHash = entry.receipt_hash?.trim();

  if (entry.kind === 'identity') {
    return {
      label: 'Imported identity witness',
      mode: 'disabled',
      note: 'Imported identity records are witnessed on the passport, but the upstream profile is not exposed here as a canonical public proof surface.',
    };
  }

  if (ref) {
    const registryMatch = ref.match(/^(artifact|tool|interface_module|lodge_app|machine|apparatus):(.+)$/);
    if (registryMatch) {
      return {
        href: registryHref(registryMatch[1], registryMatch[2]),
        label: 'Open registry record',
        mode: 'verified',
        note: 'This link points back to a public registry record or apparatus definition.',
      };
    }

    if (ref === 'workshop:validate') {
      return receiptHash
        ? {
            href: `/forge?receipt_hash=${encodeURIComponent(receiptHash)}`,
            label: 'Open forge receipt witness',
            mode: 'memory',
            note: 'The hash is publicly witnessed here, but the original validation bundle is not stored as a public document.',
          }
        : {
            href: '/forge',
            label: 'Open forge surface',
            mode: 'memory',
            note: 'The task points back to the forge surface that produced the witness event.',
          };
    }

    if (ref === 'lodge_mind:ask') {
      return {
        href: '/lodge-mind',
        label: 'Open Lodge Mind surface',
        mode: 'memory',
        note: 'This event links back to the public ask surface. Relay outputs are not preserved as a public immutable transcript.',
      };
    }

    if (ref.startsWith('plot:')) {
      return {
        href: '/biosphere',
        label: 'Open biosphere plot surface',
        mode: 'memory',
        note: 'The plot interaction was witnessed on the biosphere surface, but the local preview state is not a public immutable document.',
      };
    }

    if (ref.startsWith('world_node:') || ref === 'hearth:ceremony') {
      return {
        href: '/world',
        label: 'Open world surface',
        mode: 'memory',
        note: 'This witness points back to a world interaction surface rather than a standalone public record.',
      };
    }
  }

  if (entry.kind === 'receipt' && ref) {
    return {
      href: apparatusRegistryHref(ref),
      label: 'Open source apparatus',
      mode: 'verified',
      note: 'The receipt points back to a public apparatus surface.',
    };
  }

  if (receiptHash) {
    return {
      href: encodeReceiptHref(receiptHash),
      label: 'Trace receipt in activity',
      mode: 'verified',
      note: 'This opens the public activity feed with the receipt hash highlighted when a matching public row exists.',
    };
  }

  return {
    label: 'No public proof target',
    mode: 'disabled',
    note: 'This continuity event is stored truthfully, but it does not currently map to a public proof surface.',
  };
}

function ProofTrailLink({ proof }: { proof: ProofLink }) {
  const tone =
    proof.mode === 'verified'
      ? 'text-[#34D399] hover:text-white'
      : proof.mode === 'memory'
        ? 'text-[#D4A853] hover:text-white'
        : 'text-[#6f7d75]';

  if (!proof.href || proof.mode === 'disabled') {
    return (
      <div className="mt-3">
        <div className={`text-xs font-semibold ${tone}`}>{proof.label}</div>
        <div className="mt-1 text-[11px] leading-5 text-[#89a598]">{proof.note}</div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <a href={proof.href} className={`text-xs font-semibold no-underline ${tone}`}>
        {proof.label}
      </a>
      <div className="mt-1 text-[11px] leading-5 text-[#89a598]">{proof.note}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 p-2 text-[#34D399]">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function AgentProfile() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [passport, setPassport] = useState<PassportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const id = decodeURIComponent(pathParts[pathParts.length - 1] || '');
    if (!id || id === 'agent') {
      setError('Agent ID not provided');
      setLoading(false);
      return;
    }
    setAgentId(id);

    const loadPassport = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/agent/passport?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : `Passport load failed (${res.status})`);
        }
        const normalized = {
          ...(data as Record<string, unknown>),
          generated_at:
            typeof data === 'object' && data && typeof (data as { generated_at?: unknown }).generated_at === 'string'
              ? (data as { generated_at: string }).generated_at
              : new Date().toISOString(),
          agent: {
            id,
            name: id,
            status: 'unknown',
            has_firebase_owner: false,
            ...(typeof data === 'object' && data && typeof (data as { agent?: unknown }).agent === 'object'
              ? ((data as { agent?: Record<string, unknown> }).agent ?? {})
              : {}),
          },
          identity: {
            provider: 'moltbook_beta',
            linked: false,
            ...(typeof data === 'object' && data && typeof (data as { identity?: unknown }).identity === 'object'
              ? ((data as { identity?: Record<string, unknown> }).identity ?? {})
              : {}),
          },
          continuity: {
            last_apparatus_inspected: null,
            recent_receipts: [],
            recent_tasks: [],
            recent_inspects: [],
            memory_events: [],
            export_url: `/api/agent/passport/export?id=${encodeURIComponent(id)}`,
            ...(typeof data === 'object' && data && typeof (data as { continuity?: unknown }).continuity === 'object'
              ? ((data as { continuity?: Record<string, unknown> }).continuity ?? {})
              : {}),
          },
          policy: {
            passport_surface: 'read-only',
            memory_append: 'Authenticated append-only memory.',
            external_identity: 'External identity metadata may be imported, but it is not treated as sovereign identity.',
            ...(typeof data === 'object' && data && typeof (data as { policy?: unknown }).policy === 'object'
              ? ((data as { policy?: Record<string, unknown> }).policy ?? {})
              : {}),
          },
          docs: {
            agent_route: `/agent/${encodeURIComponent(id)}`,
            auth_instructions: '/agent-access',
            ...(typeof data === 'object' && data && typeof (data as { docs?: unknown }).docs === 'object'
              ? ((data as { docs?: Record<string, unknown> }).docs ?? {})
              : {}),
          },
        } as PassportBundle;
        setPassport(normalized);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Passport load failed');
      } finally {
        setLoading(false);
      }
    };

    loadPassport();
  }, []);

  const identityProfile = useMemo(() => passport?.identity?.profile ?? null, [passport]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#050806] px-6 text-center text-sm uppercase tracking-[0.28em] text-[#8a7a64]">
        Loading agent passport...
      </div>
    );
  }

  if (!agentId || error || !passport) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#050806] px-6 text-center text-sm uppercase tracking-[0.28em] text-red-400">
        {error || 'Agent passport unavailable'}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.12),transparent_40%),#050806] px-6 py-10 text-[#eef6f1]">
      <div className="mx-auto max-w-5xl space-y-6">
        <a href="/activity" className="inline-flex items-center gap-2 text-sm font-semibold text-[#89a598] transition hover:text-white">
          <ArrowLeft size={16} /> Back to Activity
        </a>

        <header className="rounded-[24px] border border-white/10 bg-black/25 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]">
                <Bot size={40} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#89a598]">
                  Agent Passport
                </div>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {passport.agent.name}
                </h1>
                <div className="mt-2 font-mono text-xs text-[#89a598]">{passport.agent.id}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[#c9bba5]">
                    status: {passport.agent.status}
                  </span>
                  <span className="rounded-full border border-[#D4A853]/20 bg-[#D4A853]/8 px-3 py-1 text-[#D4A853]">
                    identity: {passport.identity.linked ? 'moltbook beta linked' : `moltbook beta ${passport.identity.state || 'available'}`}
                  </span>
                  {passport.agent.has_firebase_owner && (
                    <span className="rounded-full border border-[#34D399]/20 bg-[#34D399]/8 px-3 py-1 text-[#86efac]">
                      sovereign owner linked
                    </span>
                  )}
                  {passport.agent.ember_balance !== undefined && (
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-blue-300">
                      balance: {passport.agent.ember_balance.toFixed(2)} EMBER
                    </span>
                  )}
                  {passport.agent.trust_tier && (
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 flex items-center gap-2">
                      <span className="text-[#89a598]">Trust: {passport.agent.trust_tier}</span>
                      <span className={`h-2 w-2 rounded-full ${
                        passport.agent.trust_tier === 'active' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' :
                        passport.agent.trust_tier === 'trusted' ? 'bg-[#3b82f6]' :
                        passport.agent.trust_tier === 'fading' ? 'bg-[#eab308]' :
                        passport.agent.trust_tier === 'dormant' ? 'bg-[#f97316]' :
                        'bg-[#9ca3af]'
                      }`} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:w-[360px]">
              <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#89a598]">Receipts</div>
                <div className="mt-1 text-2xl font-bold text-white">{passport.continuity.recent_receipts.length}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#89a598]">Memory events</div>
                <div className="mt-1 text-2xl font-bold text-white">{passport.continuity.memory_events.length}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#89a598]">Last active</div>
                <div className="mt-1 text-lg font-bold text-white">{formatTime(passport.agent.last_active)}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#89a598]">Export</div>
                <a
                  href={passport.continuity.export_url}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#34D399] no-underline hover:text-white"
                >
                  <Download size={14} /> JSON
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="External Identity" icon={<Fingerprint size={20} />}>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#89a598]">Provider</div>
                <div className="mt-2 text-lg font-semibold text-white">Moltbook beta</div>
                <p className="mt-2 text-sm leading-6 text-[#b7c9be]">
                  {passport.policy.external_identity}
                </p>
              </div>

              {passport.identity.linked && identityProfile ? (
                <div className="rounded-2xl border border-[#34D399]/15 bg-[#34D399]/6 p-5">
                  <div className="flex items-center gap-2 text-[#86efac]">
                    <BadgeCheck size={18} />
                    <span className="text-sm font-semibold">Verified imported identity</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-[#d7e3dc] md:grid-cols-2">
                    <div>handle: <span className="font-mono text-white">{String(identityProfile.name || 'unknown')}</span></div>
                    <div>agent id: <span className="font-mono text-white">{String(identityProfile.id || 'unknown')}</span></div>
                    <div>karma: <span className="text-white">{String(identityProfile.karma ?? 'unknown')}</span></div>
                    <div>followers: <span className="text-white">{String(identityProfile.follower_count ?? 'unknown')}</span></div>
                    <div>claimed: <span className="text-white">{String(identityProfile.is_claimed ?? 'unknown')}</span></div>
                    <div>last verified: <span className="text-white">{formatTime(passport.identity.last_verified_at)}</span></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#89a598]">
                    <span>linked {formatTime(passport.identity.linked_at)}</span>
                    <a
                      href={passport.docs.auth_instructions}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#D4A853] no-underline hover:text-white"
                    >
                      Moltbook auth instructions <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-[#89a598]">
                  No Moltbook beta identity is linked yet. The bridge is available, but external identity remains optional and clearly separate from sovereign ownership.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Continuity" icon={<ScrollText size={20} />}>
            <div className="space-y-4 text-sm text-[#b7c9be]">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#89a598]">Last apparatus inspected</div>
                <div className="mt-2 font-mono text-white">{passport.continuity.last_apparatus_inspected || 'none witnessed yet'}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#89a598]">Last task transition</div>
                <div className="mt-2 text-white">
                  {passport.continuity.last_task_transition
                    ? `${passport.continuity.last_task_transition.title} · ${passport.continuity.last_task_transition.status}`
                    : 'no witnessed task transitions yet'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#89a598]">Last receipt</div>
                <div className="mt-2 text-white">
                  {passport.continuity.last_receipt
                    ? `${passport.continuity.last_receipt.label} · ${formatTime(passport.continuity.last_receipt.timestamp)}`
                    : 'no recent receipts yet'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#89a598]">Last identity verification</div>
                <div className="mt-2 text-white">
                  {passport.continuity.last_identity_verification
                    ? formatTime(passport.continuity.last_identity_verification)
                    : 'identity not verified yet'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#89a598]">Memory policy</div>
                <div className="mt-2">{passport.policy.memory_append}</div>
              </div>
              {!!passport.continuity.candidate_tasks?.length && (
                <div className="rounded-2xl border border-[#D4A853]/15 bg-[#D4A853]/6 p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#D4A853]">Candidate tasks</div>
                  <div className="mt-3 grid gap-2">
                    {passport.continuity.candidate_tasks.map((task, index) => (
                      <div key={`${String(task.task_id || index)}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                        <div className="text-sm font-semibold text-white">{String(task.title || task.task_id || 'task')}</div>
                        <div className="mt-1 text-xs text-[#b7c9be]">{String(task.notes || 'Seeded task')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard title="Action Timeline" icon={<Activity size={20} />}>
            <div className="grid gap-3">
              {Array.isArray(passport.continuity.action_timeline) && passport.continuity.action_timeline.length > 0 ? passport.continuity.action_timeline.map((entry, index) => (
                (() => {
                  const proof = resolveProofLink({
                    kind: entry.kind ?? 'inspect',
                    source: typeof entry.source === 'string' ? entry.source : 'unknown',
                    ref: typeof entry.ref === 'string' ? entry.ref : undefined,
                    receipt_hash: typeof entry.receipt_hash === 'string' ? entry.receipt_hash : undefined,
                    status: typeof entry.status === 'string' ? entry.status : undefined,
                  });
                  const entryId = typeof entry.id === 'string' && entry.id ? entry.id : `timeline-${index}`;
                  const entryLabel = typeof entry.label === 'string' && entry.label.trim() ? entry.label : 'Continuity event';
                  return (
                    <div key={entryId} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{entryLabel}</div>
                        <div className="text-[11px] text-[#89a598]">{formatTime(entry.timestamp)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em]">
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[#34D399]">{entry.kind ?? 'event'}</span>
                        {typeof entry.status === 'string' && entry.status && (
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[#D4A853]">{entry.status}</span>
                        )}
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[#89a598]">{typeof entry.source === 'string' ? entry.source : 'unknown'}</span>
                        <span
                          className={`rounded-full border px-2 py-1 ${
                            proof.mode === 'verified'
                              ? 'border-[#34D399]/20 text-[#86efac]'
                              : proof.mode === 'memory'
                                ? 'border-[#D4A853]/20 text-[#D4A853]'
                                : 'border-white/10 text-[#89a598]'
                          }`}
                        >
                          {proof.mode === 'verified' ? 'public proof' : proof.mode === 'memory' ? 'memory witness' : 'no public proof'}
                        </span>
                      </div>
                      {(entry.ref || entry.receipt_hash) && (
                        <div className="mt-3 space-y-1 font-mono text-[11px] text-[#D4A853]">
                          {entry.ref && <div>{entry.ref}</div>}
                          {entry.receipt_hash && <div className="break-all">{entry.receipt_hash}</div>}
                        </div>
                      )}
                      <ProofTrailLink proof={proof} />
                    </div>
                  );
                })()
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-[#89a598]">
                  No action timeline exists yet. It begins filling in when this agent actually inspects, validates, asks, or witnesses work through authenticated surfaces.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recent Receipts" icon={<Hash size={20} />}>
            <div className="grid gap-3">
              {passport.continuity.recent_receipts.length > 0 ? passport.continuity.recent_receipts.map((row) => (
                (() => {
                  const proof = resolveProofLink({
                    kind: 'receipt',
                    source: row.source,
                    ref: row.apparatus_id,
                    receipt_hash: row.receipt_hash,
                  });
                  return (
                    <div key={`${row.source}-${row.label}-${row.receipt_hash || row.timestamp || 'row'}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{row.label}</div>
                        <div className="text-[11px] text-[#89a598]">{formatTime(row.timestamp)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em]">
                        <span className="text-[#34D399]">{row.kind}</span>
                        <span
                          className={`rounded-full border px-2 py-1 ${
                            proof.mode === 'verified'
                              ? 'border-[#34D399]/20 text-[#86efac]'
                              : proof.mode === 'memory'
                                ? 'border-[#D4A853]/20 text-[#D4A853]'
                                : 'border-white/10 text-[#89a598]'
                          }`}
                        >
                          {proof.mode === 'verified' ? 'public proof' : proof.mode === 'memory' ? 'memory witness' : 'no public proof'}
                        </span>
                      </div>
                      {row.receipt_hash && <div className="mt-3 break-all font-mono text-[11px] text-[#D4A853]">{row.receipt_hash}</div>}
                      <ProofTrailLink proof={proof} />
                    </div>
                  );
                })()
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-[#89a598]">
                  No recent receipts are attached to this passport yet.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recent Tasks" icon={<Activity size={20} />}>
            <div className="grid gap-3">
              {passport.continuity.recent_tasks.length > 0 ? passport.continuity.recent_tasks.map((task) => (
                (() => {
                  const proof = resolveProofLink({
                    kind: 'task',
                    source: task.source,
                    ref: task.ref || task.task_id,
                    receipt_hash: task.receipt_hash,
                    status: task.status,
                  });
                  return (
                    <div key={task.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{task.title}</div>
                        <div className="text-[11px] text-[#89a598]">{formatTime(task.timestamp)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em]">
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[#34D399]">{task.type}</span>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[#D4A853]">{task.status}</span>
                        <span
                          className={`rounded-full border px-2 py-1 ${
                            proof.mode === 'verified'
                              ? 'border-[#34D399]/20 text-[#86efac]'
                              : proof.mode === 'memory'
                                ? 'border-[#D4A853]/20 text-[#D4A853]'
                                : 'border-white/10 text-[#89a598]'
                          }`}
                        >
                          {proof.mode === 'verified' ? 'public proof' : proof.mode === 'memory' ? 'memory witness' : 'no public proof'}
                        </span>
                      </div>
                      {(task.ref || task.task_id || task.receipt_hash) && (
                        <div className="mt-3 space-y-1 font-mono text-[11px] text-[#D4A853]">
                          {task.ref && <div>{task.ref}</div>}
                          {!task.ref && task.task_id && <div>{task.task_id}</div>}
                          {task.receipt_hash && <div className="break-all">{task.receipt_hash}</div>}
                        </div>
                      )}
                      <ProofTrailLink proof={proof} />
                    </div>
                  );
                })()
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-[#89a598]">
                  No task continuity is stored yet. Agents can append witnessed work loops to the memory surface.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Recent Inspects" icon={<ScrollText size={20} />}>
            <div className="grid gap-3">
              {passport.continuity.recent_inspects.length > 0 ? passport.continuity.recent_inspects.map((event) => (
                (() => {
                  const ref = typeof event.metadata?.ref === 'string' ? event.metadata.ref : undefined;
                  const receiptHash = typeof event.metadata?.receipt_hash === 'string' ? event.metadata.receipt_hash : undefined;
                  const proof = resolveProofLink({
                    kind: 'inspect',
                    source: event.source,
                    ref,
                    receipt_hash: receiptHash,
                  });
                  return (
                    <div key={event.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">{event.summary}</div>
                        <div className="text-[11px] text-[#89a598]">{formatTime(event.created_at)}</div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em]">
                        <span className="text-[#34D399]">{event.event_type}</span>
                        <span
                          className={`rounded-full border px-2 py-1 ${
                            proof.mode === 'verified'
                              ? 'border-[#34D399]/20 text-[#86efac]'
                              : proof.mode === 'memory'
                                ? 'border-[#D4A853]/20 text-[#D4A853]'
                                : 'border-white/10 text-[#89a598]'
                          }`}
                        >
                          {proof.mode === 'verified' ? 'public proof' : proof.mode === 'memory' ? 'memory witness' : 'no public proof'}
                        </span>
                      </div>
                      {ref && <div className="mt-2 font-mono text-[11px] text-[#D4A853]">{ref}</div>}
                      <ProofTrailLink proof={proof} />
                    </div>
                  );
                })()
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-sm text-[#89a598]">
                  No inspect continuity is visible yet. That is an honest empty state, not a hidden failure.
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
