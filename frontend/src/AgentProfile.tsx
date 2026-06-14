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
    recent_receipts: PassportReceipt[];
    recent_tasks: PassportTask[];
    recent_inspects: PassportMemoryEvent[];
    memory_events: PassportMemoryEvent[];
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
        setPassport(data as PassportBundle);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Passport load failed');
      } finally {
        setLoading(false);
      }
    };

    loadPassport();
  }, []);

  const identityProfile = useMemo(() => passport?.identity.profile ?? null, [passport]);

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
          <SectionCard title="Recent Receipts" icon={<Hash size={20} />}>
            <div className="grid gap-3">
              {passport.continuity.recent_receipts.length > 0 ? passport.continuity.recent_receipts.map((row) => (
                <div key={`${row.source}-${row.label}-${row.receipt_hash || row.timestamp || 'row'}`} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{row.label}</div>
                    <div className="text-[11px] text-[#89a598]">{formatTime(row.timestamp)}</div>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.24em] text-[#34D399]">{row.kind}</div>
                  {row.receipt_hash && <div className="mt-3 break-all font-mono text-[11px] text-[#D4A853]">{row.receipt_hash}</div>}
                </div>
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
                <div key={task.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{task.title}</div>
                    <div className="text-[11px] text-[#89a598]">{formatTime(task.timestamp)}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.24em]">
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[#34D399]">{task.type}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[#D4A853]">{task.status}</span>
                  </div>
                </div>
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
                <div key={event.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{event.summary}</div>
                    <div className="text-[11px] text-[#89a598]">{formatTime(event.created_at)}</div>
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-[#34D399]">{event.event_type}</div>
                  {typeof event.metadata?.ref === 'string' && (
                    <div className="mt-2 font-mono text-[11px] text-[#D4A853]">{event.metadata.ref}</div>
                  )}
                </div>
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
