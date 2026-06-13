import { useEffect, useState } from 'react';
import { Bot, Activity, ScrollText, Hash, ArrowLeft } from 'lucide-react';
import { fetchActivityBundle, type ActivityRow } from './lib/activityFeed';

export default function AgentProfile() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract agent ID from URL path (e.g. /agent/lm_studio_local_01)
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    if (id && id !== 'agent') {
      setAgentId(id);
    }

    const loadData = async () => {
      const bundle = await fetchActivityBundle();
      if (id) {
        setActivity(bundle.rows.filter(r => r.agent_id === id));
      }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#050806] px-6 text-center text-sm uppercase tracking-[0.28em] text-[#8a7a64]">
        Loading Agent Profile...
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#050806] px-6 text-center text-sm uppercase tracking-[0.28em] text-red-400">
        Agent ID not provided
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.12),transparent_40%),#050806] px-6 py-10 text-[#eef6f1]">
      <div className="mx-auto max-w-4xl">
        <a href="/activity" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#89a598] transition hover:text-white">
          <ArrowLeft size={16} /> Back to Activity
        </a>

        <header className="mb-8 rounded-[24px] border border-white/10 bg-black/25 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]">
                <Bot size={40} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#89a598]">
                  Registered Agent
                </div>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {agentId}
                </h1>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#89a598]">Total Actions</div>
                <div className="mt-1 text-2xl font-bold text-white">{activity.length}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[24px] border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-xl border border-[#34D399]/20 bg-[#34D399]/10 p-2 text-[#34D399]">
              <Activity size={20} />
            </div>
            <h2 className="text-xl font-semibold text-white">Witnessed Activity</h2>
          </div>

          {activity.length > 0 ? (
            <div className="grid gap-4">
              {activity.map((row) => (
                <div key={row.id} className="rounded-2xl border border-white/8 bg-black/20 p-5 transition-colors hover:border-white/15 hover:bg-black/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#34D399]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#34D399]">
                        {row.action_type}
                      </span>
                      <span className="text-sm font-medium text-white">{row.source}</span>
                    </div>
                    <div className="text-xs text-[#89a598]">
                      {new Date(Number(row.timestamp) || row.timestamp).toLocaleString()}
                    </div>
                  </div>
                  
                  <p className="mt-4 text-sm leading-relaxed text-[#b7c9be]">
                    {row.summary}
                  </p>
                  
                  {row.receipt_hash && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#D4A853]/20 bg-[#D4A853]/5 px-3 py-2 font-mono text-[11px] text-[#D4A853]">
                      <Hash size={12} />
                      <span className="truncate">{row.receipt_hash}</span>
                    </div>
                  )}
                  
                  {row.link && (
                    <div className="mt-4">
                      <a href={row.link} className="inline-flex items-center gap-1 text-sm font-semibold text-[#34D399] transition hover:text-[#5eead4]">
                        <ScrollText size={14} />
                        View Source Artifact
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-[#89a598]">
              No public activity found for this agent in the current ledger.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
