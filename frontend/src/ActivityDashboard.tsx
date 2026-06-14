/**
 * /activity - Bot activity mission control (read-only).
 */
import { useEffect, useState } from 'react';
import { Activity, Bot, Radio, Terminal } from 'lucide-react';
import { fetchActivityBundle, type ActivityRow } from './lib/activityFeed';
// @ts-ignore
import { useMultiplayerPresence } from './multiplayer/useMultiplayerPresence';

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return 'unknown';
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 'unknown';

  const deltaMs = Date.now() - parsed;
  if (deltaMs < 60_000) return 'just now';
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PulseDot({ live }: { live: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{
        background: live ? '#34D399' : '#8E7E6B',
        boxShadow: live ? '0 0 8px #34D399' : 'none',
        animation: live ? 'pulse 2s ease-in-out infinite' : 'none',
      }}
    />
  );
}

function MetricCard({ label, value, tone = '#D4A853' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function RowLine({ row }: { row: ActivityRow }) {
  const relative = formatRelativeTime(row.timestamp);
  const exact = row.timestamp ? new Date(row.timestamp).toLocaleString() : 'Unknown time';
  const hash = row.receipt_hash ? `${row.receipt_hash.slice(0, 12)}...` : '-';

  return (
    <div className="grid gap-1 rounded-lg border border-[#D4A853]/12 bg-black/30 px-3 py-2.5 font-mono text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[#34D399]">{row.action_type}</span>
        <span className="text-right text-[#6b5d4b]">
          {relative}
          <span className="ml-2 hidden text-[#5E5143] md:inline">{exact}</span>
        </span>
      </div>
      <div className="text-[#FAF6EF]">{row.summary}</div>
      <div className="flex flex-wrap items-center gap-3 text-[#8E7E6B]">
        <span>agent: {row.agent_id}</span>
        <span>hash: {hash}</span>
        <span className="text-[#5E5143]">src: {row.source}</span>
        {row.link && (
          <a href={row.link} className="text-[#D4A853] no-underline hover:text-[#FAF6EF]">
            open {'>'}
          </a>
        )}
      </div>
    </div>
  );
}

type SourceFilter = 'all' | 'experiment' | 'claim' | 'embodiment' | 'pulse';

const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string; color: string }> = [
  { id: 'all', label: 'All', color: '#D4A853' },
  { id: 'pulse', label: 'Swarm Pulse', color: '#34D399' },
  { id: 'experiment', label: 'Experiment', color: '#8ce0b4' },
  { id: 'claim', label: 'Claim', color: '#f3c98b' },
  { id: 'embodiment', label: 'Embodiment', color: '#AA88FF' },
];

export default function ActivityDashboard() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchActivityBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState<{ tick?: number; heat?: number; ember_balance?: number } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const load = async () => {
    setLoading(true);
    const [activity, tickRes] = await Promise.all([
      fetchActivityBundle(),
      fetch('/api/world/tick', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setBundle(activity);
    setTick(tickRes);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, []);

  const { receipts } = useMultiplayerPresence({
    enabled: true,
    agentKey: 'dashboard-observer',
    getPose: () => ({ x: 0, y: 0, z: 0, anim: 'idle' })
  });

  const live = bundle?.data_state === 'live' || receipts.length > 0;
  
  const swarmRows: ActivityRow[] = receipts.map((r: any) => ({
    id: `swarm-${r.receipt_hash || Math.random()}`,
    timestamp: new Date(r.timestamp * 1000).toISOString(),
    agent_id: r.name || r.id,
    action_type: `task_${r.status}`,
    summary: r.summary,
    receipt_hash: r.receipt_hash,
    source: 'pulse'
  }));

  const combinedRows = [...(bundle?.rows ?? []), ...swarmRows].sort((a, b) => {
    const ta = Date.parse(a.timestamp) || 0;
    const tb = Date.parse(b.timestamp) || 0;
    return tb - ta;
  });

  const filteredRows = sourceFilter === 'all'
    ? combinedRows
    : combinedRows.filter(r => r.source === sourceFilter);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(232,132,42,0.12),transparent_40%),#050806] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[24px] border border-[#D4A853]/20 bg-black/40 px-6 py-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/30 bg-[#34D399]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#86efac]">
                <Terminal size={12} />
                Mission control
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">Bot Activity</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b7c9be]">
                Read-only feed: witnessed experiments, approved claims, embodiment ledger. No fake live claims; stale means stale.
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-[#8E7E6B]">
                <PulseDot live={live} />
                {bundle?.data_state ?? 'loading'}
              </div>
              {bundle?.latestTimestamp && (
                <div className="mt-2 text-[#c9bba5]">last signal {formatRelativeTime(bundle.latestTimestamp)}</div>
              )}
              {tick && (
                <div className="mt-2 text-[#D4A853]">
                  tick {tick.tick} · heat {tick.heat} · ember {tick.ember_balance}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Recent signals" value={bundle?.stats.total ?? 0} />
          <MetricCard label="Active now" value={bundle?.activeAgents.length ?? 0} tone="#34D399" />
          <MetricCard label="Experiments" value={bundle?.stats.experiments ?? 0} tone="#8ce0b4" />
          <MetricCard label="Approved claims" value={bundle?.stats.claims ?? 0} tone="#f3c98b" />
        </section>

        <section className="rounded-[20px] border border-white/8 bg-black/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">
            <Bot size={13} />
            Active agents ({bundle?.activeAgents.length ?? 0})
          </div>
          <div className="flex flex-wrap gap-2">
            {(bundle?.activeAgents ?? []).map((agent) => (
              <span
                key={agent}
                className="inline-flex items-center gap-2 rounded-full border border-[#34D399]/25 bg-[#34D399]/8 px-3 py-1 font-mono text-[10px] text-[#9ff0c4]"
              >
                <PulseDot live />
                {agent}
              </span>
            ))}
            {!bundle?.activeAgents.length && !loading && (
              <span className="text-[11px] text-[#6b5d4b]">No recent agent_ids in the last 24 hours of public logs.</span>
            )}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#D4A853]/15 bg-[#0a0806]/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#D4A853]">
              <Activity size={13} />
              Activity stream
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SOURCE_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSourceFilter(f.id)}
                  className="rounded-full px-3 py-1 font-mono text-[10px] transition-all"
                  style={{
                    border: sourceFilter === f.id ? `1px solid ${f.color}55` : '1px solid rgba(255,255,255,0.08)',
                    background: sourceFilter === f.id ? `${f.color}18` : 'rgba(255,255,255,0.03)',
                    color: sourceFilter === f.id ? f.color : '#8E7E6B',
                  }}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={load}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] text-[#c9bba5] hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          </div>

          {loading && <p className="font-mono text-sm text-[#8E7E6B]">Polling public surfaces...</p>}

          {!loading && bundle && filteredRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#5C3D1E] bg-black/20 px-4 py-8 text-center font-mono text-sm text-[#8E7E6B]">
              {sourceFilter === 'all' ? bundle.note : `No ${sourceFilter} rows yet. ${bundle.note}`}
            </div>
          )}

          <div className="grid gap-2">
            {filteredRows.map((row) => <RowLine key={row.id} row={row} />)}
          </div>
        </section>

        <p className="font-mono text-[10px] text-[#5E5143]">
          <Radio size={11} className="mr-1 inline" />
          {bundle?.note} · Auto-refresh 15s · <a href="/action_contracts.json" className="text-[#D4A853] no-underline hover:text-white">action_contracts.json</a> · Client writes disabled by Firestore rules.
        </p>
      </div>
    </div>
  );
}
