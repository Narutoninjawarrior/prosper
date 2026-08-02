import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, ClipboardList, ScrollText } from 'lucide-react';
import { fetchActivityBundle, type ActivityRow } from './lib/activityFeed';
import { fetchLiveMembersPreview } from './lib/lodgeFirestore';
import { sanctuaryBridge, useContract, type ArtifactContract, type MemberContract } from './lib/sanctuaryBridge';

const primarySurfaces = [
  {
    title: 'Projects',
    href: '/projects',
    body: 'Keep accepted project truth in one packet: sources, decisions, open actions, runs, and the next publishable update.',
    accent: '#34D399',
  },
  {
    title: 'Review',
    href: '/review',
    body: 'Judge incoming proposal bundles and external feedback before anything becomes accepted packet truth.',
    accent: '#A78BFA',
  },
  {
    title: 'Published Updates',
    href: '/projects',
    body: 'Publish a clean outward slice of judged work so the next engineer, teammate, or reviewer can pick it up fast.',
    accent: '#F59E0B',
  },
  {
    title: 'Shared Rooms',
    href: '/projects',
    body: 'Work inside a shared packet room where coding agents can propose changes and humans keep final authority.',
    accent: '#38BDF8',
  },
];

const useCases = [
  {
    title: 'Solo developer with 3-5 agents',
    body: 'Run multiple coding agents without losing the plot. Keep one packet where proposals, decisions, open work, and publish state stay under control.',
  },
  {
    title: 'Freelancer shipping for clients',
    body: 'Turn agent output into judged project truth, then publish a clean update another engineer, client, or reviewer can understand quickly.',
  },
  {
    title: 'Small engineering team',
    body: 'Keep the review trail visible when humans and coding agents both move the project. One packet, one judgment loop, one outward update.',
  },
];

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return 'No recent activity';
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 'Timestamp unavailable';

  const deltaMs = Date.now() - parsed;
  if (deltaMs < 60_000) return 'Just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#89a598]">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[#b7c9be]">{detail}</div>
    </div>
  );
}

function ActivityMiniRow({ row }: { row: ActivityRow }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">{row.action_type}</div>
        <div className="text-xs text-[#8E7E6B]">{formatRelativeTime(row.timestamp)}</div>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#b7c9be]">{row.summary}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#8E7E6B]">
        <span>agent: {row.agent_id}</span>
        <span>source: {row.source}</span>
        {row.link && (
          <a href={row.link} className="text-[#D4A853] no-underline hover:text-white">
            open {'>'}
          </a>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const membersContract = useContract<MemberContract[]>(
    '/vessel_members.json',
    sanctuaryBridge.normalizeMembers,
    [],
  );
  const artifactsContract = useContract<ArtifactContract[]>(
    '/artifact_registry.json',
    sanctuaryBridge.normalizeArtifacts,
    [],
  );

  const [activity, setActivity] = useState<Awaited<ReturnType<typeof fetchActivityBundle>> | null>(null);
  const [liveMemberCount, setLiveMemberCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const [activityBundle, liveMembers] = await Promise.all([
        fetchActivityBundle(),
        fetchLiveMembersPreview(120),
      ]);

      if (cancelled) return;
      setActivity(activityBundle);
      setLiveMemberCount(liveMembers.ok ? liveMembers.rows.length : null);
    };

    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const memberCount = liveMemberCount ?? membersContract.data.length;
  const memberSource = liveMemberCount !== null ? 'live registry' : 'seeded registry';
  const evidenceCount = useMemo(() => artifactsContract.data.length, [artifactsContract.data]);
  const recentRows = activity?.rows.slice(0, 3) ?? [];
  const lastSignalLabel = formatRelativeTime(activity?.latestTimestamp);
  const activityStateLabel = activity?.data_state ?? 'loading';

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_32%),linear-gradient(180deg,#050806_0%,#08100b_42%,#0d1510_100%)] px-6 py-10 text-[#eef6f1]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[32px] border border-white/10 bg-black/25 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:px-8 md:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#8ce0b4]">
                <ClipboardList size={14} />
                Prosper
              </div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Supervise multiple coding agents without losing project truth.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#b7c9be] md:text-lg">
                Prosper gives a solo developer one packet room for incoming proposals, accepted truth, open actions,
                and the next publishable update, so agents can move fast without turning the project into a blur.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/projects"
                  className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-3 text-sm font-semibold text-[#041109] transition hover:bg-[#25cf8a]"
                >
                  Open Projects
                  <ArrowRight size={16} />
                </a>
                <a
                  href="/review"
                  className="inline-flex items-center gap-2 rounded-full border border-[#A78BFA]/35 bg-[#A78BFA]/10 px-5 py-3 text-sm font-semibold text-[#ddd6fe] transition hover:bg-[#A78BFA]/16"
                >
                  Open Review
                  <ScrollText size={16} />
                </a>
                <a
                  href="/projects"
                  className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/35 bg-[#34D399]/10 px-5 py-3 text-sm font-semibold text-[#9ff0c4] transition hover:bg-[#34D399]/16"
                >
                  Open Shared Rooms
                  <Bot size={16} />
                </a>
              </div>
            </div>

            <div className="grid min-w-[300px] gap-3 rounded-[28px] border border-white/8 bg-white/5 p-4 shadow-inner">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#89a598]">Core Loop</div>
              {[
                'Connect an agent with the room brief and proposal path.',
                'Judge incoming work before it becomes accepted truth.',
                'Create downstream open actions from accepted judgment.',
                'Publish a reviewed update another engineer or agent can pick up fast.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-[#d4f7e0]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Packet room" value="Live" detail="Sources, decisions, open actions, runs, and publish state all live in /projects." />
          <StatCard label="Review queue" value={lastSignalLabel} detail={activity?.note ?? `State: ${activityStateLabel}`} />
          <StatCard label="Accepted sources" value={evidenceCount} detail="Attached material can be reviewed and carried into accepted packet truth." />
          <StatCard label="Shared rooms" value={memberCount} detail={`Current signal from ${memberSource}.`} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {primarySurfaces.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/7"
            >
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]"
                style={{ background: `${card.accent}22`, color: card.accent }}
              >
                Workspace
              </div>
              <div className="text-xl font-semibold text-white">{card.title}</div>
              <p className="mt-2 text-sm leading-6 text-[#b7c9be]">{card.body}</p>
            </a>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-2 text-[#d4f7e0]">
              <ScrollText size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#89a598]">Built For</div>
          <h2 className="text-2xl font-semibold text-white">Keep the thread from first proposal to accepted truth to shipped update</h2>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {useCases.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <div className="font-semibold text-white">{item.title}</div>
                <p className="mt-3 text-sm leading-6 text-[#b7c9be]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-2 text-[#d4f7e0]">
                <ScrollText size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.32em] text-[#89a598]">Recent activity</div>
                <h2 className="text-2xl font-semibold text-white">Current signals from the workspace</h2>
              </div>
            </div>
            <a href="/review" className="text-sm font-semibold text-[#D4A853] no-underline hover:text-white">
              Open review
            </a>
          </div>

          {recentRows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {recentRows.map((row) => (
                <ActivityMiniRow key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#5C3D1E] bg-black/20 px-5 py-8 text-sm text-[#b7c9be]">
              No recent workspace activity is visible yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
