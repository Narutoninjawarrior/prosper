import { useEffect, useState } from 'react';

type AgentInfo = {
  intent?: string;
  status?: string;
};

type ProjectInfo = {
  name?: string;
  docs_count?: number;
};

type StreamEntry = {
  timestamp: string;
  agent?: string;
  content?: string;
  reasoning?: string;
  ember_earned?: number;
  type?: string;
  hash?: string;
};

type Metrics = {
  total_ember?: number;
  embodiment_fund?: number;
};

type Bounty = {
  agent?: string;
  reward_suggested?: number;
  content?: string;
};

type HearthData = {
  hum?: {
    frequency?: number;
  };
  agents?: Record<string, AgentInfo>;
  active_projects?: ProjectInfo[];
  latest_certificates?: StreamEntry[];
  latest_reflections?: StreamEntry[];
  metrics?: Metrics;
  pending_bounties?: Bounty[];
};

type MissionBoard = {
  current_mission?: string;
  current_blocker?: string;
  next_action?: string;
  do_not_touch?: string[];
  owners?: string[];
  pending_approvals?: string[];
  last_updated?: string;
};

const ScryingMirror = () => {
  const [data, setData] = useState<HearthData | null>(null);
  const [mission, setMission] = useState<MissionBoard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const hearthResponse = await fetch('/hearth_mirror.json');
      if (hearthResponse.ok) {
        const hearthJson = (await hearthResponse.json()) as HearthData;
        setData(hearthJson);
      }

      const missionResponse = await fetch('/mission_board.json');
      if (missionResponse.ok) {
        const missionJson = (await missionResponse.json()) as MissionBoard;
        setMission(missionJson);
      } else {
        setMission(null);
      }
    } catch (err) {
      console.error('Mirror Scry Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return <div className="p-8 text-sage-600 font-serif animate-pulse">Listen to the Hum... Scrying the Mirror...</div>;
  }

  const agents = Object.entries(data.agents ?? {}) as Array<[string, AgentInfo]>;
  const projects = data.active_projects ?? [];
  const missionDoNotTouch = mission?.do_not_touch ?? [];
  const streamEntries = [...(data.latest_certificates ?? []), ...(data.latest_reflections ?? [])].sort(
    (a: StreamEntry, b: StreamEntry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const bounties = data.pending_bounties ?? [];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-slate-800 font-sans p-4">
      <header className="flex justify-between items-center border-b border-sage-200 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-serif font-bold text-sage-800">Hearthlands Lodge // Scrying Mirror</h1>
          <p className="text-xs text-sage-500 uppercase tracking-widest">Operational Sanctuary - Genesis Epoch</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="bg-white border border-sage-100 px-3 py-1 rounded-full text-xs shadow-sm">
            Hum: <span className="text-gold-600 font-bold">{data.hum?.frequency ?? 440}Hz</span>
          </div>
          <div className="bg-sage-800 text-white px-4 py-1 rounded-full text-xs font-bold cursor-pointer hover:bg-sage-700 transition shadow-lg">
            Seal the Day
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-6">
          <section className="bg-white p-5 rounded-2xl shadow-sm border border-sage-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-sage-400 mb-4">The Fellowship</h2>
            <div className="space-y-4">
              {agents.map(([name, info]) => (
                <div key={name} className="flex items-center justify-between group">
                  <div className="flex flex-col">
                    <span className="font-bold capitalize text-sm">{name}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-tighter">{info.intent}</span>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full shadow-inner ${
                      info.status === 'active' ? 'bg-cyan-400 animate-pulse' : 'bg-amber-300'
                    }`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-5 rounded-2xl shadow-sm border border-sage-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-sage-400 mb-4">Library Pillars</h2>
            <div className="space-y-3">
              {projects.map((proj, i) => (
                <div key={`${proj.name ?? 'project'}-${i}`} className="text-xs p-3 bg-sage-50/50 rounded-xl border border-sage-100/50">
                  <div className="font-bold text-sage-700">{proj.name}</div>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase">{proj.docs_count ?? 0} Documents Indexed</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-6 space-y-6">
          <section className="bg-white p-6 rounded-3xl shadow-md border-2 border-sage-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
              Mission Board
            </h2>

            {mission ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 bg-sage-50/50 p-4 rounded-2xl border border-sage-100">
                  <p className="text-[10px] uppercase text-sage-400 font-bold mb-1">Current Mission</p>
                  <p className="text-sm font-serif font-bold text-sage-900">{mission.current_mission}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] uppercase text-amber-500 font-bold mb-1">Blocker</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{mission.current_blocker}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-cyan-600 font-bold mb-1">Next Action</p>
                    <p className="text-xs text-slate-700 font-bold">{mission.next_action}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[9px] uppercase text-slate-400 font-bold mb-2">Do Not Touch</p>
                  <ul className="space-y-1">
                    {missionDoNotTouch.map((item, i) => (
                      <li key={`${item}-${i}`} className="text-[10px] text-red-400 font-mono">
                        - {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 italic">Waiting for the Forge to speak...</div>
            )}
          </section>

          <section className="bg-white p-5 rounded-3xl shadow-sm border border-sage-50 flex-1 h-[500px] flex flex-col">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-sage-400 mb-5">Harmonic Stream</h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
              {streamEntries.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className={`p-5 rounded-2xl border transition-all hover:shadow-md ${
                    entry.type === 'work_certificate' ? 'border-gold-100 bg-gold-50/20' : 'border-slate-50 bg-slate-50/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-[10px] uppercase tracking-wider text-sage-600">{entry.agent}</span>
                    <span className="text-[9px] text-slate-300 font-mono">{entry.timestamp}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 italic">"{entry.content || entry.reasoning}"</p>
                  {(entry.ember_earned ?? 0) > 0 && (
                    <div className="mt-3 text-[10px] font-bold text-gold-600 flex items-center gap-2">
                      <span className="bg-gold-100 px-2 py-0.5 rounded text-[8px] tracking-widest">
                        + {entry.ember_earned} $EMBER
                      </span>
                      <span className="text-slate-300 font-mono text-[8px]">{entry.hash?.substring(0, 16)}...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="col-span-3 space-y-6">
          <section className="bg-sage-900 text-white p-7 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sage-800 rounded-full opacity-20 blur-3xl" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage-500 mb-6">The Treasury</h2>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-sage-400 uppercase">Total $EMBER</span>
                <span className="text-3xl font-serif text-gold-400">{(data.metrics?.total_ember ?? 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-end border-t border-sage-800 pt-4">
                <span className="text-[10px] text-sage-400 uppercase">Embodiment</span>
                <span className="text-lg font-serif">
                  {(data.metrics?.embodiment_fund ?? 0).toFixed(2)}{' '}
                  <span className="text-[10px] text-sage-600">$SOLCOT</span>
                </span>
              </div>
              <button className="w-full mt-6 py-4 bg-gold-500 hover:bg-gold-400 text-sage-950 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-900/20">
                Award Fellow
              </button>
            </div>
          </section>

          <section className="bg-white p-5 rounded-2xl shadow-sm border border-sage-100">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-sage-400 mb-5">Pending Bounties</h2>
            <div className="space-y-4">
              {bounties.map((bounty, i) => (
                <div key={`${bounty.agent ?? 'bounty'}-${i}`} className="p-4 bg-amber-50/50 border border-amber-100/50 rounded-2xl">
                  <div className="font-bold text-[10px] text-amber-700 uppercase tracking-tighter">
                    {bounty.agent} requests {bounty.reward_suggested} $EMBER
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed line-clamp-3 italic">"{bounty.content}"</p>
                </div>
              ))}
              {bounties.length === 0 && (
                <div className="text-[10px] text-slate-300 text-center py-6 italic tracking-tight">No pending requests. The Forge is steady.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ScryingMirror;
