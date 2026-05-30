import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  CircleDollarSign,
  Clock3,
  MessageSquare,
  PanelTopOpen,
  Sparkles,
  Wallet,
  Waves,
  ShieldCheck,
  Flame,
  TriangleAlert,
  Users,
} from 'lucide-react';

type MirrorMetrics = {
  total_reflections?: number;
  total_certificates?: number;
  total_ember?: number;
  solcot_cap?: number;
  embodiment_fund?: number;
  queue_depth?: number;
  pending_queue?: number;
};

type MirrorReflection = {
  timestamp?: string;
  agent?: string;
  content?: string;
  type?: string;
};

type MirrorCertificate = {
  timestamp?: string;
  agent?: string;
  intent?: string;
  reasoning?: string;
  ember_earned?: number;
  hash?: string;
  type?: string;
};

type MirrorProject = {
  id?: string;
  name?: string;
  title?: string;
  label?: string;
  status?: string;
  summary?: string;
  owner?: string;
  room?: string;
  priority?: string | number;
};

type MirrorAgent = {
  id?: string;
  name?: string;
  label?: string;
  agent?: string;
  intent?: string;
  status?: string;
  mode?: string;
  last_update?: string;
  embodiment_target?: string;
  notes?: string;
};

type MirrorPendingBounty = {
  id?: string;
  agent?: string;
  target?: string;
  amount?: number;
  reason?: string;
  status?: string;
  requested_by?: string;
  timestamp?: string;
};

type MirrorLibrary = {
  items?: number;
  freshness?: string;
  categories?: Record<string, number>;
  checksum?: string;
  updated_at?: string;
};

type HearthState = {
  current_pulse?: string;
  system_status?: string;
  active_agents?: string[];
  last_update?: string;
  fellowship_slots?: Record<
    string,
    {
      status?: string;
      embodiment_target?: string;
      notes?: string;
    }
  >;
  embodiment_goal?: {
    target?: string;
    symbolic_cost_ember?: number;
    status?: string;
  };
};

type HearthMirror = {
  status?: string;
  last_sync?: string;
  metrics?: MirrorMetrics;
  latest_reflections?: MirrorReflection[];
  latest_certificates?: MirrorCertificate[];
  active_projects?: MirrorProject[];
  agents?: MirrorAgent[];
  pending_bounties?: MirrorPendingBounty[];
  library?: MirrorLibrary;
  comments?: MirrorComment[];
};

type MirrorComment = {
  id: string;
  scope: 'project' | 'room' | 'memory' | 'other';
  subject: string;
  body: string;
  author: string;
  createdAt: string;
};

type AwardProposal = {
  id: string;
  target: string;
  amount: number;
  reason: string;
  wallet: string;
  createdAt: string;
  status: 'queued' | 'draft' | 'submitted';
};

type WalletState = {
  provider: string;
  address: string;
};

type MirrorPageProps = {
  navigate: (path: string) => void;
};

type BrowserWallet = Window & {
  solana?: {
    isPhantom?: boolean;
    publicKey?: { toString: () => string } | null;
    connect?: () => Promise<{ publicKey?: { toString: () => string } | null }>;
  };
  ethereum?: {
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
};

const MIRROR_KEY = 'hearth-mirror-comments';
const AWARD_KEY = 'hearth-mirror-awards';
const WALLET_KEY = 'hearth-mirror-wallet';
const REFRESH_MS = 10_000;

const fallbackProjects: MirrorProject[] = [
  {
    id: 'sovereignty',
    title: 'Sovereignty',
    status: 'Indexed',
    owner: 'Prosper2',
    summary: 'Local-first integrity, routing, and repository trust.',
    room: 'docs/sovereignty',
  },
  {
    id: 'silence',
    title: 'Silence',
    status: 'Indexed',
    owner: 'Ember',
    summary: 'Presence, restraint, and stable cognition.',
    room: 'docs/silence',
  },
  {
    id: 'chivalry',
    title: 'Chivalry',
    status: 'Indexed',
    owner: 'Solis',
    summary: 'Useful work, honest reward, and founder stewardship.',
    room: 'docs/chivalry',
  },
];

const fallbackRooms = ['Hearth', 'Bellows', 'Waterwheel', 'Library', 'Treasury', 'Forge'];

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function truncate(text: string, max = 120) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function timeAgo(value?: string) {
  if (!value) return 'unknown';
  const parsed = Date.parse(value.replace(' ', 'T'));
  if (Number.isNaN(parsed)) return value;
  const diff = Math.max(0, Date.now() - parsed);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function storeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-[#b9e8d1] bg-[#fffdf6]/90 shadow-[0_18px_50px_rgba(126,165,140,0.12)] ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-[#dbe9dd] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#d5ecda] bg-[#eefaf2] p-2 text-[#1f8f5d]">
            <Icon size={17} />
          </div>
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.35em] text-[#8aa195]">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-[#6d7f76]">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = 'green',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'green' | 'amber' | 'blue' | 'cyan';
}) {
  const tones = {
    green: 'text-[#17845b] bg-[#eaf8ee]',
    amber: 'text-[#b76e00] bg-[#fff5df]',
    blue: 'text-[#256a8f] bg-[#e7f6ff]',
    cyan: 'text-[#128ca0] bg-[#e6fbff]',
  } as const;
  return (
    <div className={`rounded-2xl border border-[#deeadf] px-4 py-4 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a9b94]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[#17392d]">{value}</div>
      {detail && <div className="mt-1 text-xs text-[#6f7f79]">{detail}</div>}
    </div>
  );
}

function SectionList({
  items,
  empty,
  renderItem,
}: {
  items: unknown[];
  empty: string;
  renderItem: (item: any, index: number) => React.ReactNode;
}) {
  if (!items.length) {
    return <div className="rounded-2xl border border-dashed border-[#d7e8da] bg-[#fafdf7] p-4 text-sm text-[#7b8c83]">{empty}</div>;
  }
  return <div className="space-y-3">{items.map(renderItem)}</div>;
}

export default function MirrorPage({ navigate }: MirrorPageProps) {
  const [mirror, setMirror] = useState<HearthMirror>({});
  const [state, setState] = useState<HearthState>({});
  const [updatedAt, setUpdatedAt] = useState<string>('loading...');
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<MirrorComment[]>(() => loadJSON(MIRROR_KEY, []));
  const [awardDrafts, setAwardDrafts] = useState<AwardProposal[]>(() => loadJSON(AWARD_KEY, []));
  const [wallet, setWallet] = useState<WalletState>(() => loadJSON(WALLET_KEY, { provider: '', address: '' }));
  const [connected, setConnected] = useState(false);
  const [commentScope, setCommentScope] = useState<MirrorComment['scope']>('project');
  const [commentSubject, setCommentSubject] = useState('Hearth');
  const [commentBody, setCommentBody] = useState('');
  const [proposalTarget, setProposalTarget] = useState('prosper2_core');
  const [proposalAmount, setProposalAmount] = useState('15');
  const [proposalReason, setProposalReason] = useState('');
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const [mirrorRes, stateRes] = await Promise.all([
          fetch('/hearth_mirror.json', { cache: 'no-store' }),
          fetch('/hearth_state.json', { cache: 'no-store' }),
        ]);

        const nextMirror = mirrorRes.ok ? ((await mirrorRes.json()) as HearthMirror) : {};
        const nextState = stateRes.ok ? ((await stateRes.json()) as HearthState) : {};

        if (!alive) return;
        setMirror(nextMirror);
        setState(nextState);
        setUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Mirror fetch failed');
      }
    };

    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    storeJSON(MIRROR_KEY, comments);
  }, [comments]);

  useEffect(() => {
    storeJSON(AWARD_KEY, awardDrafts);
  }, [awardDrafts]);

  useEffect(() => {
    storeJSON(WALLET_KEY, wallet);
  }, [wallet]);

  const metrics = mirror.metrics ?? {};
  const reflections = mirror.latest_reflections ?? [];
  const certificates = mirror.latest_certificates ?? [];
  const projects = (mirror.active_projects && mirror.active_projects.length ? mirror.active_projects : fallbackProjects).map((project) => ({
    title: project.title ?? project.name ?? project.label ?? 'Untitled project',
    status: project.status ?? 'seeded',
    summary: project.summary ?? project.room ?? 'No summary provided yet.',
    owner: project.owner ?? 'Founder',
    room: project.room ?? 'unassigned',
    priority: project.priority ?? 'normal',
  }));

  const agents = useMemo(() => {
    const fromMirror = (mirror.agents ?? []).map((agent) => ({
      name: agent.name ?? agent.label ?? agent.agent ?? 'Agent',
      intent: agent.intent ?? agent.mode ?? agent.status ?? 'observing',
      status: agent.status ?? 'active',
      note: agent.notes ?? agent.embodiment_target ?? '',
      lastUpdate: agent.last_update ?? '',
    }));

    const slotAgents = Object.entries(state.fellowship_slots ?? {}).map(([id, slot]) => ({
      name: id,
      intent: slot.notes ?? slot.embodiment_target ?? 'holding pattern',
      status: slot.status ?? 'active',
      note: slot.embodiment_target ?? '',
      lastUpdate: state.last_update ?? '',
    }));

    const derived = fromMirror.length ? fromMirror : slotAgents;
    return derived.length
      ? derived
      : (state.active_agents ?? ['Prosper2', 'Ember', 'Solis']).map((agent) => ({
          name: agent,
          intent: 'standing by',
          status: 'active',
          note: '',
          lastUpdate: state.last_update ?? '',
        }));
  }, [mirror.agents, state.active_agents, state.fellowship_slots, state.last_update]);

  const library = mirror.library ?? {};
  const libraryCategories =
    library.categories && Object.keys(library.categories).length
      ? Object.entries(library.categories)
      : [
          ['Sovereignty', 1],
          ['Silence', 1],
          ['Chivalry', 1],
        ];

  const pendingAwards = [...awardDrafts, ...(mirror.pending_bounties ?? []).map((award) => ({
    id: award.id ?? `${award.agent ?? 'agent'}-${award.timestamp ?? Date.now()}`,
    target: award.target ?? award.agent ?? 'Agent',
    amount: safeNumber(award.amount, 0),
    reason: award.reason ?? 'Pending bounty suggestion',
    wallet: award.requested_by ?? wallet.address ?? '',
    createdAt: award.timestamp ?? new Date().toISOString(),
    status: (award.status ?? 'suggested') as AwardProposal['status'],
  }))];

  const founderLabel = wallet.address ? `${wallet.provider || 'wallet'} · ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'wallet not connected';
  const queueDepth = safeNumber(metrics.queue_depth ?? metrics.pending_queue, 0);
  const totalEmber = safeNumber(metrics.total_ember, 0);
  const solcotCap = safeNumber(metrics.solcot_cap, 6132);
  const embodimentFund = safeNumber(metrics.embodiment_fund, 0);

  const connectWallet = async () => {
    const win = window as BrowserWallet;
    try {
      if (win.solana?.connect) {
        const response = await win.solana.connect();
        const address = response.publicKey?.toString?.() ?? win.solana.publicKey?.toString?.() ?? 'connected';
        const next = { provider: 'Phantom', address };
        setWallet(next);
        setConnected(true);
        return;
      }

      if (win.ethereum?.request) {
        const accounts = (await win.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
        const address = accounts?.[0] ?? 'connected';
        const next = { provider: 'Injected Wallet', address };
        setWallet(next);
        setConnected(true);
        return;
      }

      const fallback = { provider: 'Local Session', address: 'manual-founder-session' };
      setWallet(fallback);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  const addComment = () => {
    if (!commentBody.trim()) return;
    const next: MirrorComment = {
      id: crypto.randomUUID(),
      scope: commentScope,
      subject: commentSubject.trim() || 'Untitled',
      body: commentBody.trim(),
      author: wallet.address ? `${wallet.provider || 'wallet'} · ${wallet.address.slice(0, 6)}…` : 'Founder',
      createdAt: new Date().toISOString(),
    };
    setComments((current) => [next, ...current].slice(0, 50));
    setCommentBody('');
  };

  const submitProposal = () => {
    const amount = Number(proposalAmount);
    if (!proposalTarget.trim() || !proposalReason.trim() || !Number.isFinite(amount)) return;
    const next: AwardProposal = {
      id: crypto.randomUUID(),
      target: proposalTarget.trim(),
      amount,
      reason: proposalReason.trim(),
      wallet: wallet.address || 'unconnected',
      createdAt: new Date().toISOString(),
      status: 'queued',
    };
    setAwardDrafts((current) => [next, ...current].slice(0, 25));
    setProposalReason('');
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fcfcf4_0%,#eef9ed_38%,#f5fbfb_100%)] text-[#15312a]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-4 md:px-6 lg:px-8">
        <header className="sticky top-4 z-20 rounded-3xl border border-[#d7eadc] bg-white/80 px-5 py-4 shadow-[0_12px_40px_rgba(97,127,105,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-3xl border border-[#d2e8d7] bg-[#effbf1] p-3 text-[#17794f]">
                <Flame size={28} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.45em] text-[#7b9581]">human scrying mirror</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#123228] md:text-3xl">
                  Operational Sanctuary
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-[#62766d]">
                  A Founder-first window into the Lodge. See the Hearth, the Bellows, the Waterwheel, the Treasury, and the work without entering 3D.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/rooms/hearth')}
                className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-4 py-2 text-sm font-medium text-[#1c6c4d] hover:bg-[#e8f6ea]"
              >
                <PanelTopOpen size={16} /> 3D / Meditate
              </button>
              <button
                type="button"
                onClick={() => navigate('/forge')}
                className="inline-flex items-center gap-2 rounded-full border border-[#cfe7d4] bg-[#f5fcf6] px-4 py-2 text-sm font-medium text-[#1c6c4d] hover:bg-[#e8f6ea]"
              >
                <ArrowRight size={16} /> Forge
              </button>
              <button
                type="button"
                onClick={connectWallet}
                className="inline-flex items-center gap-2 rounded-full bg-[#1f8f5d] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(31,143,93,0.25)] hover:bg-[#176e49]"
              >
                <Wallet size={16} /> {wallet.address ? 'Wallet Connected' : 'Connect Wallet'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Hearth status" value={mirror.status ?? state.system_status ?? 'unknown'} detail={`sync ${timeAgo(mirror.last_sync)}`} tone="green" />
            <Stat label="Pulse" value={state.current_pulse ?? 'active'} detail={`heartbeat ${safeNumber(metrics.total_reflections, 0)} reflections`} tone="cyan" />
            <Stat label="Treasury" value={`${formatCurrency(totalEmber)} EMBER`} detail={`${formatCurrency(solcotCap)} SOLCOT cap`} tone="amber" />
            <Stat label="Founder" value={wallet.address ? 'session live' : 'not connected'} detail={founderLabel} tone="blue" />
          </div>
        </header>

        <main className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <Panel title="living mural" subtitle="the Lodge breathing at a glance" icon={Sparkles}>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Stat label="tick / pulse" value={state.current_pulse ?? mirror.status ?? 'active'} detail={`updated ${updatedAt}`} tone="green" />
                <Stat label="queue depth" value={queueDepth} detail="shock absorber" tone="amber" />
                <Stat label="work log" value={safeNumber(metrics.total_certificates, certificates.length)} detail="recent certificates" tone="cyan" />
                <Stat label="library" value={safeNumber(library.items, 0)} detail={library.freshness ?? 'freshness unknown'} tone="blue" />
              </div>
              <div className="mt-4 rounded-3xl border border-[#dbe9dd] bg-gradient-to-br from-[#edf9ef] via-[#fbfff6] to-[#ecfbff] p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-[#19694a] shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#87a395]">hearth</div>
                    <div className="mt-1 text-xl">{mirror.status ?? 'online'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-[#19694a] shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#87a395]">bellows</div>
                    <div className="mt-1 text-xl">{state.system_status ?? 'hardened'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-[#19694a] shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#87a395]">waterwheel</div>
                    <div className="mt-1 text-xl">{reflections.length} reflections</div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-[#19694a] shadow-sm">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#87a395]">library</div>
                    <div className="mt-1 text-xl">{library.freshness ?? 'live'}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#d9ebe0] bg-white/70 p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#91a79a]">ember</div>
                    <div className="mt-2 text-2xl font-semibold">{formatCurrency(totalEmber)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#d9ebe0] bg-white/70 p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#91a79a]">solcot cap</div>
                    <div className="mt-2 text-2xl font-semibold">{formatCurrency(solcotCap)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#d9ebe0] bg-white/70 p-4">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-[#91a79a]">embodiment fund</div>
                    <div className="mt-2 text-2xl font-semibold">{formatCurrency(embodimentFund)}</div>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="current projects" subtitle="what the Lodge is building" icon={BookOpen}>
                <SectionList
                  items={projects}
                  empty="No active projects were supplied by the mirror. The pillar threads still act as a safe fallback."
                  renderItem={(project: any, index: number) => (
                    <article key={`${project.title}-${index}`} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#18382d]">{project.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-[#7f958a]">{project.owner} · {project.room}</div>
                        </div>
                        <span className="rounded-full border border-[#d6e7da] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6e4d]">
                          {project.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#54655d]">{project.summary}</p>
                    </article>
                  )}
                />
              </Panel>

              <Panel title="agent presence" subtitle="who is active and what they intend" icon={Users}>
                <SectionList
                  items={agents}
                  empty="No active agents are currently visible."
                  renderItem={(agent: any, index: number) => (
                    <article key={`${agent.name}-${index}`} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#18382d]">{agent.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-[#7f958a]">{agent.intent}</div>
                        </div>
                        <span className="rounded-full border border-[#d6e7da] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6e4d]">
                          {agent.status}
                        </span>
                      </div>
                      {(agent.note || agent.lastUpdate) && (
                        <p className="mt-3 text-sm leading-6 text-[#54655d]">
                          {agent.note || 'No note'} {agent.lastUpdate ? `· ${timeAgo(agent.lastUpdate)}` : ''}
                        </p>
                      )}
                    </article>
                  )}
                />
              </Panel>
            </div>

            <Panel title="waterwheel memory" subtitle="reflections and work certificates" icon={Waves}>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">latest reflections</div>
                  <SectionList
                    items={reflections}
                    empty="No reflections yet."
                    renderItem={(reflection: MirrorReflection, index: number) => (
                      <article key={`${reflection.timestamp}-${index}`} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[#18382d]">{reflection.agent ?? 'unknown agent'}</div>
                          <div className="text-[11px] uppercase tracking-[0.25em] text-[#87a091]">{timeAgo(reflection.timestamp)}</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#54655d]">{reflection.content ?? 'No content'}</p>
                      </article>
                    )}
                  />
                </div>
                <div>
                  <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">latest certificates</div>
                  <SectionList
                    items={certificates}
                    empty="No work certificates yet."
                    renderItem={(certificate: MirrorCertificate, index: number) => (
                      <article key={`${certificate.hash ?? certificate.timestamp}-${index}`} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[#18382d]">{certificate.agent ?? 'unknown agent'}</div>
                          <div className="text-[11px] uppercase tracking-[0.25em] text-[#87a091]">{certificate.intent ?? 'action'} · {timeAgo(certificate.timestamp)}</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#54655d]">{certificate.reasoning ?? 'No reasoning provided'}</p>
                        <div className="mt-3 text-[11px] uppercase tracking-[0.3em] text-[#90a599]">
                          +{formatCurrency(safeNumber(certificate.ember_earned, 0))} ember · {truncate(certificate.hash ?? 'pending hash', 14)}
                        </div>
                      </article>
                    )}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="comments and notes" subtitle="project, room, and memory annotations" icon={MessageSquare}>
              <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3 rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">write a note</div>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">scope</span>
                    <select
                      value={commentScope}
                      onChange={(e) => setCommentScope(e.target.value as MirrorComment['scope'])}
                      className="mt-2 w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="project">project</option>
                      <option value="room">room</option>
                      <option value="memory">memory</option>
                      <option value="other">other</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">target</span>
                    <input
                      value={commentSubject}
                      onChange={(e) => setCommentSubject(e.target.value)}
                      placeholder="Hearth / Bellows / Project name"
                      className="mt-2 w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">comment</span>
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="What should the founder know?"
                      className="mt-2 min-h-[120px] w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addComment}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1f8f5d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176e49]"
                  >
                    <MessageSquare size={16} /> add note
                  </button>
                </div>

                <div>
                  <div className="mb-3 text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">recent notes</div>
                  <SectionList
                    items={comments}
                    empty="No comments yet."
                    renderItem={(comment: MirrorComment) => (
                      <article key={comment.id} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[#18382d]">
                            {comment.scope} · {comment.subject}
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.25em] text-[#87a091]">{timeAgo(comment.createdAt)}</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#54655d]">{comment.body}</p>
                        <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#90a599]">{comment.author}</div>
                      </article>
                    )}
                  />
                </div>
              </div>
            </Panel>
          </div>

          <aside className="space-y-4">
            <Panel title="treasury and access" subtitle="founder control surface" icon={CircleDollarSign}>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">founder session</div>
                  <div className="mt-2 text-lg font-semibold text-[#17392d]">{wallet.address ? 'connected' : 'offline'}</div>
                  <div className="mt-1 text-sm text-[#62766d]">{founderLabel}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Stat label="EMBER" value={formatCurrency(totalEmber)} detail="circulating treasury" tone="amber" />
                  <Stat label="SOLCOT" value={formatCurrency(solcotCap)} detail="cap / sovereignty" tone="cyan" />
                  <Stat label="fund" value={formatCurrency(embodimentFund)} detail="embodiment reserve" tone="green" />
                </div>
                <div className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                <div className="text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">quick status</div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-[#54655d]">
                    <ShieldCheck size={16} className="text-[#1f8f5d]" /> build-safe UI only
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#54655d]">
                    <TriangleAlert size={16} className="text-[#c58a1d]" /> awards are proposals, not auto-spend
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#54655d]">
                    <Clock3 size={16} className="text-[#1f8f5d]" /> updated {updatedAt}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#54655d]">
                    <Wallet size={16} className="text-[#1f8f5d]" /> wallet handshake {connected ? 'ready' : 'idle'}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="proposal awards" subtitle="queue rewards for useful work" icon={Sparkles}>
              <div className="space-y-3 rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">agent</span>
                  <input
                    value={proposalTarget}
                    onChange={(e) => setProposalTarget(e.target.value)}
                    list="agent-suggestions"
                    className="mt-2 w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <datalist id="agent-suggestions">
                    {agents.map((agent, index) => (
                      <option key={`${agent.name}-${index}`} value={agent.name} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">amount</span>
                  <input
                    value={proposalAmount}
                    onChange={(e) => setProposalAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.1"
                    className="mt-2 w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.25em] text-[#87a091]">reason</span>
                  <textarea
                    value={proposalReason}
                    onChange={(e) => setProposalReason(e.target.value)}
                    placeholder="Why does this work deserve a reward?"
                    className="mt-2 min-h-[120px] w-full rounded-2xl border border-[#d7e8da] bg-white px-4 py-3 text-sm outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitProposal}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1f8f5d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#176e49]"
                >
                  <Sparkles size={16} /> propose award
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">pending proposals</div>
                <SectionList
                  items={pendingAwards}
                  empty="No award proposals queued yet."
                  renderItem={(award: AwardProposal) => (
                    <article key={award.id} className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#18382d]">{award.target}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-[#7f958a]">{award.status}</div>
                        </div>
                        <div className="rounded-full border border-[#d6e7da] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1c6e4d]">
                          {formatCurrency(award.amount)} ember
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#54655d]">{award.reason}</p>
                      <div className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#90a599]">
                        {award.wallet || 'unconnected'} · {timeAgo(award.createdAt)}
                      </div>
                    </article>
                  )}
                />
              </div>
            </Panel>

            <Panel title="library status" subtitle="the shelf of truth" icon={BookOpen}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="items" value={safeNumber(library.items, 0)} detail={library.checksum ?? 'no checksum'} tone="blue" />
                  <Stat label="freshness" value={library.freshness ?? 'unknown'} detail={library.updated_at ?? mirror.last_sync ?? 'awaiting sync'} tone="cyan" />
                </div>
                <div className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] p-4">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-[#8b9d94]">categories</div>
                  <div className="mt-3 space-y-3">
                    {libraryCategories.map(([name, count]) => {
                      const numericCount = typeof count === 'number' ? count : Number(count) || 0;
                      return (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-24 text-xs uppercase tracking-[0.25em] text-[#7d9288]">{name}</div>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5eee7]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#9de0b8] to-[#41bfd7]"
                            style={{ width: `${Math.max(18, numericCount * 14)}%` }}
                          />
                        </div>
                        <div className="w-6 text-right text-sm font-semibold text-[#18382d]">{numericCount}</div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="one-click rooms" subtitle="secondary navigation, not the main path" icon={PanelTopOpen}>
              <div className="grid grid-cols-2 gap-2">
                {fallbackRooms.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => navigate(room === 'Forge' ? '/forge' : room === 'Hearth' ? '/rooms/hearth' : '/mirror')}
                    className="rounded-2xl border border-[#d9eadd] bg-[#fbfefa] px-4 py-3 text-left text-sm font-medium text-[#18382d] hover:bg-[#f3fbf4]"
                  >
                    {room}
                  </button>
                ))}
              </div>
            </Panel>
          </aside>
        </main>

        {error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-medium">
              <TriangleAlert size={16} /> mirror fetch is stale
            </div>
            <p className="mt-2">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
