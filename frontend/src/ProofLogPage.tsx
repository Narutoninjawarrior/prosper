import { useState, useEffect } from 'react';
import { Clock, ShieldCheck, Activity, Link as LinkIcon, Info } from 'lucide-react';

interface ProofEntry {
  id: string;
  timestamp: string;
  action_type: string;
  agent_id: string;
  chain_hash: string | null;
  status: string;
  source: string;
  payload?: Record<string, any>;
}

export default function ProofLogPage() {
  const [entries, setEntries] = useState<ProofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('event'));

  const toggleEvent = (id: string) => {
    setExpandedEventId(prev => {
      const next = prev === id ? null : id;
      const url = new URL(window.location.href);
      if (next) {
        url.searchParams.set('event', next);
      } else {
        url.searchParams.delete('event');
      }
      window.history.replaceState({}, '', url.toString());
      return next;
    });
  };

  useEffect(() => {
    const fetchLog = async () => {
      setLoading(true);
      try {
        const url = new URL('https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/publicForgeLog');
        url.searchParams.append('limit', '50');
        if (filterType) {
          url.searchParams.append('type', filterType);
        }
        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries || []);
        }
      } catch (err) {
        console.error('Failed to load proof log', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLog();
  }, [filterType]);

  return (
    <div className="min-h-screen bg-[#050806] text-gray-200 font-mono p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <header className="mb-10 border-b border-[#2A1F16] pb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5" />
              Public Proof Log
            </h1>
            <p className="text-[#8a7a64] text-sm leading-relaxed max-w-xl mb-4">
              Read-only projection of the internal forge log.
            </p>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-flex px-3 py-1.5 rounded">
              Event history. Not a witness service. Public read-only.
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="flex gap-2 justify-end mb-2">
              <button
                onClick={() => setFilterType('')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded border transition-colors ${filterType === '' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] bg-black/40 text-gray-500 hover:border-[#1A1410] hover:text-gray-300'}`}
              >
                All Events
              </button>
              <button
                onClick={() => setFilterType('budget_reserve')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded border transition-colors ${filterType === 'budget_reserve' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] bg-black/40 text-gray-500 hover:border-[#1A1410] hover:text-gray-300'}`}
              >
                Budget
              </button>
              <button
                onClick={() => setFilterType('chemistry_synthesis')}
                className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded border transition-colors ${filterType === 'chemistry_synthesis' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] bg-black/40 text-gray-500 hover:border-[#1A1410] hover:text-gray-300'}`}
              >
                Chemistry
              </button>
            </div>
          </div>
        </header>

        <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden shadow-lg mb-10">
          {loading ? (
            <div className="p-12 text-center text-gray-500 text-sm uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
              <Activity className="w-6 h-6 text-[#E8842A]" />
              Syncing log...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm uppercase tracking-widest">
              No recorded events found in this window.
            </div>
          ) : (
            <div className="divide-y divide-[#1A1410]">
              {entries.map((entry) => {
                const isExpanded = expandedEventId === entry.id;
                return (
                  <div key={entry.id} className="flex flex-col border-b border-[#1A1410] last:border-0">
                    <div 
                      className={`p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-[#110D0A] transition-colors gap-4 cursor-pointer ${isExpanded ? 'bg-[#110D0A]' : ''}`}
                      onClick={() => toggleEvent(entry.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-[#c9bba5] text-sm uppercase tracking-wider">{entry.action_type}</span>
                          <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 border rounded ${
                            entry.status === 'recorded' ? 'text-[#34D399] border-[#34D399]/30 bg-[#34D399]/10' :
                            'text-gray-400 border-gray-600 bg-gray-800'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleString()}</span>
                          <span className="text-[#8a7a64] border-l border-[#2A1F16] pl-3">Source: {entry.source}</span>
                          <span className="text-[#8a7a64] border-l border-[#2A1F16] pl-3">Actor: <span className="text-gray-400">{entry.agent_id}</span></span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {entry.chain_hash ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" /> Receipt Hash
                            </span>
                            <span className="font-mono text-xs text-[#E8842A] bg-black/40 px-2 py-1 rounded border border-[#2A1F16]">
                              {entry.chain_hash.substring(0, 12)}...
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-600 uppercase tracking-widest italic">
                            Unchained Event
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detail Panel */}
                    {isExpanded && (
                      <div className="px-6 py-5 bg-[#050806] border-t border-[#1A1410] text-[11px] grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 font-mono shadow-inner">
                        <div>
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Actor</span>
                          <span className="text-[#c9bba5]">{entry.agent_id}</span>
                        </div>
                        <div>
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Action</span>
                          <span className="text-[#34D399]">{entry.action_type}</span>
                        </div>
                        <div>
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Timestamp</span>
                          <span className="text-gray-400">{new Date(entry.timestamp).toISOString()}</span>
                        </div>
                        <div>
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Source</span>
                          <span className="text-gray-400">{entry.source}</span>
                        </div>
                        <div>
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Status</span>
                          <span className="text-[#c9bba5]">{entry.status}</span>
                        </div>
                        {entry.payload?.artifact_id && (
                          <div>
                            <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Artifact ID</span>
                            <span className="text-gray-400">{entry.payload.artifact_id}</span>
                          </div>
                        )}
                        {entry.payload?.budget_impact && (
                          <div>
                            <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Budget Impact</span>
                            <span className="text-[#D4A853]">{entry.payload.budget_impact}</span>
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <span className="block text-gray-600 uppercase tracking-widest mb-1 text-[9px]">Proof Hash</span>
                          {entry.chain_hash ? (
                            <span className="text-[#E8842A] break-all">{entry.chain_hash}</span>
                          ) : (
                            <span className="text-gray-500 italic">No receipt generated</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Truth Legend */}
        <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg p-5 shadow-lg">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 flex items-center gap-2 border-b border-[#2A1F16] pb-3">
            <Info className="w-4 h-4" /> Log Boundaries
          </h2>
          <ul className="text-[11px] text-gray-400 leading-relaxed space-y-2 list-disc list-inside">
            <li>This is a read-only projection of the internal <span className="text-[#c9bba5]">forge_log</span>.</li>
            <li>Events reflect real, authenticated system writes (e.g., budget reservations, chemistry execution).</li>
            <li>Local browser-only work (like facility drafting) is <strong>not</strong> written to the log until explicitly committed.</li>
            <li>"Off-chain" means the event is tracked by our verifiable receipt system, but does not settle on an external blockchain or token network.</li>
            <li>Freeze-aware actions may pause under operator control, which will prevent new events from appending.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
