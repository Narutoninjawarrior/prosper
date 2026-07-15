import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, Boxes, ClipboardList, ScrollText } from 'lucide-react';
import { fetchActivityBundle, type ActivityRow } from './lib/activityFeed';
import { fetchLiveMembersPreview } from './lib/lodgeFirestore';
import { sanctuaryBridge, useContract, type ArtifactContract, type MemberContract } from './lib/sanctuaryBridge';

const primarySurfaces = [
  {
    title: 'Projects',
    href: '/projects',
    body: 'Use the daily project desk to capture inputs, review evidence, record decisions, and draft a clean handoff in one place.',
    accent: '#34D399',
  },
  {
    title: 'Review',
    href: '/review',
    body: 'See the current product surface, review package, and bounded system notes without wandering through side routes.',
    accent: '#A78BFA',
  },
  {
    title: 'Activity',
    href: '/activity',
    body: 'Inspect recent project updates, signals, and system activity in one feed.',
    accent: '#F59E0B',
  },
  {
    title: 'Workbench',
    href: '/workbench',
    body: 'Generate or inspect supporting records and structured outputs that feed project work.',
    accent: '#F472B6',
  },
  {
    title: 'Operations',
    href: '/operations',
    body: 'Inspect exported operational records and local review data when a project needs deeper verification.',
    accent: '#38BDF8',
  },
];

const useCases = [
  {
    title: 'Indie builder',
    body: 'Collect notes, links, and snippets fast, then convert them into evidence and a weekly handoff without losing context.',
  },
  {
    title: 'Small project team',
    body: 'Keep a project record that shows what changed, what was reviewed, what was decided, and what happens next.',
  },
  {
    title: 'Human + agent workflow',
    body: 'Give agents a stable project packet instead of scattered notes, then keep the review and decision trail visible to people.',
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
                Project continuity and handoff workspace for humans and agents.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#b7c9be] md:text-lg">
                Collect project inputs, review evidence, record decisions, carry commitments forward,
                and compile a clean handoff without losing the project thread.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/projects"
                  className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-3 text-sm font-semibold text-[#041109] transition hover:bg-[#25cf8a]"
                >
                  Open Project Desk
                  <ArrowRight size={16} />
                </a>
                <a
                  href="/review"
                  className="inline-flex items-center gap-2 rounded-full border border-[#A78BFA]/35 bg-[#A78BFA]/10 px-5 py-3 text-sm font-semibold text-[#ddd6fe] transition hover:bg-[#A78BFA]/16"
                >
                  Review Product Surface
                  <ScrollText size={16} />
                </a>
                <a
                  href="/activity"
                  className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/35 bg-[#34D399]/10 px-5 py-3 text-sm font-semibold text-[#9ff0c4] transition hover:bg-[#34D399]/16"
                >
                  View Activity
                  <Bot size={16} />
                </a>
                <a
                  href="/workbench"
                  className="inline-flex items-center gap-2 rounded-full border border-[#F472B6]/35 bg-[#F472B6]/10 px-5 py-3 text-sm font-semibold text-[#fbcfe8] transition hover:bg-[#F472B6]/16"
                >
                  Open Workbench
                  <Boxes size={16} />
                </a>
              </div>
            </div>

            <div className="grid min-w-[300px] gap-3 rounded-[28px] border border-white/8 bg-white/5 p-4 shadow-inner">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#89a598]">Core Loop</div>
              {[
                'Capture project inputs before they are lost.',
                'Review evidence and attach operator judgment.',
                'Record decisions and carry forward commitments.',
                'Draft a project handoff that another person or agent can actually use.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-[#d4f7e0]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Projects surface" value="Live" detail="Capture, review, decisions, commitments, and handoff are all available in /projects." />
          <StatCard label="Recent activity" value={lastSignalLabel} detail={activity?.note ?? `State: ${activityStateLabel}`} />
          <StatCard label="Evidence items" value={evidenceCount} detail="Structured items can be reviewed and carried into project handoff outputs." />
          <StatCard label="Members" value={memberCount} detail={`Source: ${memberSource}`} />
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
                Product Surface
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
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#89a598]">What this is for</div>
              <h2 className="text-2xl font-semibold text-white">A practical memory layer between capture and execution</h2>
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
            <a href="/activity" className="text-sm font-semibold text-[#D4A853] no-underline hover:text-white">
              Open full feed
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
