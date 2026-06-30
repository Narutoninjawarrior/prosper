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
}

export default function ProofLogPage() {
  const [entries, setEntries] = useState<ProofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

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
        <header className="mb-8 border-b border-[#2A1F16] pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Public Proof Log
              </h1>
              <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest">
                Structured Event History (Read-Only)
              </p>
            </div>
            <div className="text-right">
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setFilterType('')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded border ${filterType === '' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] text-gray-500 hover:text-gray-300'}`}
                >
                  All Events
                </button>
                <button
                  onClick={() => setFilterType('budget_reserve')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded border ${filterType === 'budget_reserve' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] text-gray-500 hover:text-gray-300'}`}
                >
                  Budget
                </button>
                <button
                  onClick={() => setFilterType('chemistry_synthesis')}
                  className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded border ${filterType === 'chemistry_synthesis' ? 'bg-[#1A1410] border-[#E8842A] text-[#E8842A]' : 'border-[#2A1F16] text-gray-500 hover:text-gray-300'}`}
                >
                  Chemistry
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden shadow-xl mb-8">
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
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 md:px-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-black/20 transition-colors gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#c9bba5] text-sm uppercase tracking-wider">{entry.action_type}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 border rounded ${
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
                          {entry.chain_hash}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 uppercase tracking-widest italic">
                        Unchained Event
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Truth Legend */}
        <div className="bg-black/40 border border-[#2A1F16] rounded-lg p-5">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 flex items-center gap-2 border-b border-[#2A1F16] pb-2">
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
