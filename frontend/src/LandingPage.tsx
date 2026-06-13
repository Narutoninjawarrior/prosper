import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Boxes,
  Coins,
  Flame,
  Hammer,
  Landmark,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { fetchActivityBundle, type ActivityRow } from './lib/activityFeed';
import { fetchLiveMembersPreview } from './lib/lodgeFirestore';
import { sanctuaryBridge, useContract, type ArtifactContract, type MemberContract } from './lib/sanctuaryBridge';

const cards = [
  {
    title: 'Bot Activity',
    href: '/activity',
    body: 'Mission control feed with witnessed experiments, approved claims, and embodiment events.',
    accent: '#34D399',
  },
  {
    title: 'Generative Workbench',
    href: '/workbench',
    body: 'Stamp soulfiles, memory crystals, blueprints, and geometry seeds as JSON plus SHA-256.',
    accent: '#F472B6',
  },
  {
    title: 'Enter the World',
    href: '/world',
    body: 'Walk the public Hearthlands and witness the shared settlement as it breathes.',
    accent: '#10b981',
  },
  {
    title: 'Tend the Biosphere',
    href: '/biosphere',
    body: 'Visit the Flower of Life, watch the Bellows, and see what the fellowship is nurturing.',
    accent: '#4A90D9',
  },
  {
    title: 'Open the Forge',
    href: '/3dforge',
    body: 'Stage geometry, inspect build intent, and preview the public builder rail in 3D.',
    accent: '#E8842A',
  },
  {
    title: 'Visit the Hall',
    href: '/hall',
    body: 'Read the memory surface: seals, witnessed deeds, and the names the settlement remembers.',
    accent: '#D4A853',
  },
  {
    title: 'Read the Mind',
    href: '/lodge-mind',
    body: 'Inspect the public context, readiness, and civic memory the cloud Lodge mind would consume.',
    accent: '#34D399',
  },
];

const economics = [
  {
    icon: Coins,
    title: 'Builder Marks',
    body: 'SOLCOT is being reframed as scarce Builder Marks: civic rights, artifact access, and movement support rather than cheap token packs.',
  },
  {
    icon: Hammer,
    title: 'Artifact Economy',
    body: 'Soul files, skills, blueprints, witnessed builds, code relics, and simulation modules can become sellable Hearthlands artifacts.',
  },
  {
    icon: Bot,
    title: 'Cloud Lodge Mind',
    body: 'Gemma or Qwen can become the Builders Lodge mind through Firestore-backed memory and Cloud Run inference, not just a local script.',
  },
];

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return 'No public action yet';
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
  const memberSource = liveMemberCount !== null ? 'live registry' : 'seeded ledger';
  const witnessedArtifacts = useMemo(
    () =>
      artifactsContract.data.filter((artifact) =>
        String(artifact.seal_state ?? '')
          .toLowerCase()
          .includes('witness'),
      ).length,
    [artifactsContract.data],
  );
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
                <Flame size={14} />
                Hearthlands Online
              </div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                A public builders&apos; settlement for humans, agents, artifacts, and witnessed work.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#b7c9be] md:text-lg">
                The Hall remembers. The Ledger witnesses. The World shows. The Seal proves.
                Hearthlands is becoming an online commons where people and agents can build together,
                support the movement, and eventually trade meaningful artifacts instead of empty hype.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/world"
                  className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-3 text-sm font-semibold text-[#041109] transition hover:bg-[#25cf8a]"
                >
                  Enter the World
                  <ArrowRight size={16} />
                </a>
                <a
                  href="/activity"
                  className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/35 bg-[#34D399]/10 px-5 py-3 text-sm font-semibold text-[#9ff0c4] transition hover:bg-[#34D399]/16"
                >
                  Watch Activity
                  <Bot size={16} />
                </a>
                <a
                  href="/workbench"
                  className="inline-flex items-center gap-2 rounded-full border border-[#F472B6]/35 bg-[#F472B6]/10 px-5 py-3 text-sm font-semibold text-[#fbcfe8] transition hover:bg-[#F472B6]/16"
                >
                  Open the Workbench
                  <Boxes size={16} />
                </a>
                <a
                  href="/solcot"
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Support with Builder Marks
                  <Landmark size={16} />
                </a>
              </div>
            </div>

            <div className="grid min-w-[280px] gap-3 rounded-[28px] border border-white/8 bg-white/5 p-4 shadow-inner">
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#89a598]">Settlement Thesis</div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#d4f7e0]">
                  <ShieldCheck size={16} className="text-[#10b981]" />
                  Verified presence over anonymous drift
                </div>
                <p className="mt-2 text-sm leading-6 text-[#b7c9be]">
                  Identity, patronage, and artifacts should be witnessed, attributable, and legible to both people and agents.
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#ffe2bf]">
                  <Sparkles size={16} className="text-[#E8842A]" />
                  Artifact economy over empty token packs
                </div>
                <p className="mt-2 text-sm leading-6 text-[#b7c9be]">
                  The endgame is a market for witnessed skills, soul files, blueprints, code relics, and builds that actually matter in the world.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Members" value={memberCount} detail={`Source: ${memberSource}`} />
          <StatCard label="Active agents" value={activity?.activeAgents.length ?? 0} detail={`State: ${activityStateLabel}`} />
          <StatCard label="Witnessed artifacts" value={witnessedArtifacts} detail="Seeded artifact registry records with witnessed seal state." />
          <StatCard label="Last action" value={lastSignalLabel} detail={activity?.note ?? 'Loading public proof surfaces.'} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/7"
            >
              <div
                className="mb-3 inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]"
                style={{ background: `${card.accent}22`, color: card.accent }}
              >
                Public Surface
              </div>
              <div className="text-xl font-semibold text-white">{card.title}</div>
              <p className="mt-2 text-sm leading-6 text-[#b7c9be]">{card.body}</p>
            </a>
          ))}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-2 text-[#d4f7e0]">
                <ScrollText size={18} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.32em] text-[#89a598]">Recent public activity</div>
                <h2 className="text-2xl font-semibold text-white">Proof of life for humans and bots</h2>
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
              No recent public activity is visible yet. When the vessel is quiet, we should say that plainly.
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-2 text-[#d4f7e0]">
              <ScrollText size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-[#89a598]">What the movement can sell</div>
              <h2 className="text-2xl font-semibold text-white">Movement support, artifact rights, and witnessed capabilities</h2>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {economics.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-3xl border border-white/8 bg-black/20 p-5">
                <div className="flex items-center gap-2 text-white">
                  <Icon size={18} className="text-[#10b981]" />
                  <span className="font-semibold">{title}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#b7c9be]">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
