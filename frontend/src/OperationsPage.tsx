import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Database,
  Eye,
  FileUp,
  Info,
  Search,
  Filter,
} from 'lucide-react';
import { normalizeOpsData, type OpsViewModel } from './lib/opsAdapter';

function StatusChip({ status }: { status: string }) {
  const color =
    status === 'active' || status === 'REVIEWED' || status === 'true'
      ? 'text-[#34D399] border-[#34D399]/30 bg-[#34D399]/10'
      : status === 'pending' || status === 'false'
        ? 'text-[#FBBF24] border-[#FBBF24]/30 bg-[#FBBF24]/10'
        : 'text-gray-400 border-gray-700 bg-gray-800/40';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold border ${color}`}
    >
      {status}
    </span>
  );
}

function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
        {icon} {label}
      </h2>
      <span className="text-[9px] text-gray-500 uppercase tracking-widest">
        {count} record{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

export default function OperationsPage() {
  const [data, setData] = useState<OpsViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState('Published local export');

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDecision, setFilterDecision] = useState('ALL');
  const [filterOutcome, setFilterOutcome] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('PRIORITY');

  const loadRawData = (raw: unknown, source: string) => {
    const result = normalizeOpsData(raw);
    if ('error' in result) {
      setData(null);
      setError(result.error);
      return;
    }
    setData(result);
    setError(null);
    setSourceLabel(source);
  };

  const inspectLocalExport = async (file: File) => {
    setLoading(true);
    try {
      const raw = JSON.parse(await file.text());
      loadRawData(raw, `Local file: ${file.name}`);
    } catch (e) {
      setData(null);
      setError(e instanceof SyntaxError ? 'INVALID_JSON' : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/journal_export.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) {
           if (r.status === 404) throw new Error('NO_RECORDS');
           throw new Error(`HTTP ${r.status}`);
        }
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) throw new Error('NO_RECORDS');
        return r.json();
      })
      .then((raw: any) => {
        loadRawData(raw, 'Published local export');
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message === 'NO_RECORDS' ? 'NO_RECORDS' : String(e));
        setLoading(false);
      });
  }, []);


  if (loading) {
    return (
      <div className="min-h-screen bg-[#050806] text-gray-200 flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.28em] text-gray-500">
          Loading operations data...
        </div>
      </div>
    );
  }

  if (error === 'NO_RECORDS') {
    return (
      <div className="min-h-screen bg-[#050806] text-gray-200 flex items-center justify-center font-mono">
        <div className="max-w-md text-center">
          <Database className="w-8 h-8 text-[#E8842A] mx-auto mb-4 opacity-50" />
          <div className="text-[#c9bba5] text-sm mb-2">No operational records yet.</div>
          <div className="text-[11px] text-gray-500 leading-relaxed">
            Export a local hearth-ops journal to inspect it here.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050806] text-gray-200 flex items-center justify-center font-mono">
        <div className="max-w-md text-center">
          <div className="text-[#ef4444] text-sm mb-2">Failed to load operations data</div>
          <div className="text-[10px] text-gray-500 font-mono">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredWorkCards = data.work_cards.filter((wc) => {
    if (searchQuery.trim()) {
      const sq = searchQuery.toLowerCase();
      const matchLabel = wc.label.toLowerCase().includes(sq);
      const matchId = wc.work_card_id.toLowerCase().includes(sq);
      const matchAsset = wc.asset_id.toLowerCase().includes(sq);
      const obs = wc.observation_id ? data.observations.find(o => o.observation_id === wc.observation_id) : null;
      const matchMetric = obs?.metric_name.toLowerCase().includes(sq) || false;
      if (!matchLabel && !matchId && !matchAsset && !matchMetric) return false;
    }

    if (filterStatus !== 'ALL' && wc.status !== filterStatus) return false;

    const decision = data.decision_traces.find(d => d.work_card_id === wc.work_card_id);
    if (filterDecision === 'NO DECISION' && decision) return false;
    if (filterDecision === 'APPROVED' && (!decision || !decision.operator_approved)) return false;
    if (filterDecision === 'REJECTED' && (!decision || decision.operator_approved)) return false;

    const outcome = data.outcomes.find(o => o.work_card_id === wc.work_card_id);
    if (filterOutcome === 'NO OUTCOME' && outcome) return false;
    if (filterOutcome === 'HAS OUTCOME' && !outcome) return false;
    if (filterOutcome === 'HAS DRIFT' && (!outcome || Math.abs(outcome.calculated_prediction_error || 0) < 0.1)) return false;

    return true;
  });

  const sortedWorkCards = [...filteredWorkCards].sort((a, b) => {
    const decA = data.decision_traces.find(d => d.work_card_id === a.work_card_id);
    const decB = data.decision_traces.find(d => d.work_card_id === b.work_card_id);
    const outA = data.outcomes.find(o => o.work_card_id === a.work_card_id);
    const outB = data.outcomes.find(o => o.work_card_id === b.work_card_id);
    
    const timeA = outA?.observed_at || decA?.reviewed_at || data.observations.find(o => o.observation_id === a.observation_id)?.timestamp || '1970-01-01T00:00:00Z';
    const timeB = outB?.observed_at || decB?.reviewed_at || data.observations.find(o => o.observation_id === b.observation_id)?.timestamp || '1970-01-01T00:00:00Z';
    
    if (sortOrder === 'NEWEST') return new Date(timeB).getTime() - new Date(timeA).getTime();
    if (sortOrder === 'OLDEST') return new Date(timeA).getTime() - new Date(timeB).getTime();
    
    // PRIORITY logic
    const getPriority = (dec: any, out: any) => {
      if (dec && !dec.operator_approved) return 5;
      if (!dec) return 1;
      if (dec.operator_approved && !out) return 2;
      if (out && Math.abs(out.calculated_prediction_error || 0) >= 0.1) return 3;
      return 4;
    };
    
    const prioA = getPriority(decA, outA);
    const prioB = getPriority(decB, outB);
    
    if (prioA !== prioB) return prioA - prioB;
    
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });

  return (
    <div className="min-h-screen bg-[#050806] text-gray-200 p-4 md:p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8 border-b border-[#2A1F16] pb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
                <Database className="w-5 h-5" />
                Operations
              </h1>
              <p className="text-[#8a7a64] text-xs leading-relaxed max-w-xl">
                Read-only review of local stewardship operations. Assets, observations, work cards,
                decisions, and outcomes from the hearth-ops prototype.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-[#5f3b20] bg-[#160d07] px-3 py-2 text-[10px] uppercase tracking-widest text-[#E8842A] hover:border-[#E8842A]">
                  <FileUp className="h-3.5 w-3.5" />
                  Inspect local export
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void inspectLocalExport(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <span className="text-[9px] uppercase tracking-widest text-gray-600">
                  {sourceLabel}
                </span>
              </div>
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-flex px-3 py-1.5 rounded">
              <Info className="w-3 h-3 mr-1" />
              {data.meta.truth_boundary}
            </div>
          </div>
        </header>

        {/* Assets */}
        <section className="mb-8">
          <SectionHeader icon={<Database width={14} height={14} />} label="Assets" count={data.assets.length} />
          <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1A1410] text-gray-500 uppercase tracking-widest text-[9px]">
                  <th className="text-left px-4 py-2">Asset ID</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Facility</th>
                  <th className="text-left px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1410]">
                {data.assets.map((a) => (
                  <tr key={a.asset_id} className="hover:bg-[#110D0A]">
                    <td className="px-4 py-2.5 font-mono text-gray-400">{a.asset_id}</td>
                    <td className="px-4 py-2.5 text-[#c9bba5]">{a.name}</td>
                    <td className="px-4 py-2.5 text-gray-400">{a.type}</td>
                    <td className="px-4 py-2.5 text-gray-400">{a.facility_id}</td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Observations */}
        <section className="mb-8">
          <SectionHeader icon={<Eye width={14} height={14} />} label="Observations" count={data.observations.length} />
          <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1A1410] text-gray-500 uppercase tracking-widest text-[9px]">
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Asset</th>
                  <th className="text-left px-4 py-2">Metric</th>
                  <th className="text-left px-4 py-2">Value</th>
                  <th className="text-left px-4 py-2">Source</th>
                  <th className="text-left px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1410]">
                {data.observations.map((o) => (
                  <tr key={o.observation_id} className="hover:bg-[#110D0A]">
                    <td className="px-4 py-2.5 font-mono text-gray-400">{o.observation_id}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400">{o.asset_id}</td>
                    <td className="px-4 py-2.5 text-[#c9bba5]">{o.metric_name}</td>
                    <td className="px-4 py-2.5 text-gray-300">
                      {o.metric_value} {o.metric_unit}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{o.source}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(o.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Work Card Lifecycles */}
        <section className="mb-8">
          <SectionHeader icon={<ClipboardList width={14} height={14} />} label="Work Card Lifecycles" count={filteredWorkCards.length} />
          
          <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg p-3 mb-4 flex flex-col md:flex-row gap-4 items-start md:items-center text-[10px] uppercase tracking-widest text-gray-400">
            <div className="flex items-center gap-2 flex-1 w-full relative">
              <Search className="w-3.5 h-3.5 absolute left-2 text-gray-500" />
              <input
                type="text"
                placeholder="Search ID, Label, Asset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#110D0A] border border-[#2A1F16] rounded pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#E8842A] text-gray-300 placeholder-gray-600 transition-colors"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-gray-500" />
                <span className="text-gray-600">Status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[#110D0A] border border-[#2A1F16] rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#E8842A]"
                >
                  <option value="ALL">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="AUTHORIZED">Authorized</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Decision</span>
                <select
                  value={filterDecision}
                  onChange={(e) => setFilterDecision(e.target.value)}
                  className="bg-[#110D0A] border border-[#2A1F16] rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#E8842A]"
                >
                  <option value="ALL">All</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="NO DECISION">Pending</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-600">Outcome</span>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className="bg-[#110D0A] border border-[#2A1F16] rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#E8842A]"
                >
                  <option value="ALL">All</option>
                  <option value="HAS OUTCOME">Has Outcome</option>
                  <option value="HAS DRIFT">Has Drift</option>
                  <option value="NO OUTCOME">Pending</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 ml-2 border-l border-[#2A1F16] pl-3">
                <span className="text-gray-600">Sort</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-[#110D0A] border border-[#2A1F16] rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-[#E8842A]"
                >
                  <option value="PRIORITY">Priority</option>
                  <option value="NEWEST">Newest</option>
                  <option value="OLDEST">Oldest</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {sortedWorkCards.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-gray-500 uppercase tracking-widest border border-dashed border-[#1A1410] rounded-lg">
                No lifecycle records match the current filters.
              </div>
            ) : sortedWorkCards.map((wc) => {
              const observation = wc.observation_id 
                ? data.observations.find(o => o.observation_id === wc.observation_id)
                : undefined;
              const decision = data.decision_traces.find(d => d.work_card_id === wc.work_card_id);
              const outcome = data.outcomes.find(o => o.work_card_id === wc.work_card_id);

              return (
                <div
                  key={wc.work_card_id}
                  className="bg-[#0A0604] border border-[#1A1410] rounded-lg p-4 hover:border-[#2A1F16] transition-colors flex flex-col gap-3"
                >
                  {/* Observation Block */}
                  <div className="border-b border-[#1A1410] pb-3 mb-1">
                    {observation ? (
                      <div className="flex flex-col gap-1.5 text-[11px]">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">
                          Originating Observation
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">ID</span>
                            <span className="font-mono text-gray-400">{observation.observation_id}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Asset</span>
                            <span className="font-mono text-gray-400">{observation.asset_id}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Metric</span>
                            <span className="text-[#c9bba5]">{observation.metric_name}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Value</span>
                            <span className="text-gray-300">{observation.metric_value} {observation.metric_unit}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Source</span>
                            <span className="text-gray-400">{observation.source}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Time</span>
                            <span className="text-gray-500">{new Date(observation.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] uppercase tracking-widest text-gray-600 italic">
                        [ No originating observation linked ]
                      </div>
                    )}
                  </div>

                  {/* Proposal Block */}
                  <div>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#c9bba5]">{wc.label}</span>
                          <StatusChip status={wc.status} />
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">{wc.work_card_id}</div>
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest text-right">
                        <div>{wc.estimated_labor_hours} hrs · {wc.operator_type}</div>
                        <div className="mt-0.5">{wc.qualification}</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">{wc.description}</p>
                  </div>

                  {/* Human Decision Block */}
                  <div className="border-t border-[#1A1410] pt-3 mt-1">
                    {decision ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <span className="text-gray-500">Operator Decision:</span>
                          <StatusChip status={decision.operator_approved ? 'APPROVED' : 'REJECTED'} />
                          <span className="text-gray-600 font-mono">by {decision.reviewed_by} on {new Date(decision.reviewed_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 italic border-l-2 border-[#E8842A]/30 pl-2 ml-1">
                          "{decision.reasoning}"
                        </p>
                      </div>
                    ) : (
                      <div className="text-[10px] uppercase tracking-widest text-gray-600 italic">
                        [ No operator decision recorded yet ]
                      </div>
                    )}
                  </div>

                  {/* Outcome Block */}
                  <div className="border-t border-[#1A1410] pt-3 mt-1">
                    {outcome ? (
                      <div className="flex flex-col gap-1.5 text-[11px]">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">
                          Field Outcome
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Metric</span>
                            <span className="text-gray-300">{outcome.metric_name}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-gray-500 font-mono text-[9px] uppercase">Observed Value</span>
                            <span className="text-[#34D399] font-bold">{outcome.observed_value} {outcome.metric_unit}</span>
                          </div>
                          {typeof outcome.calculated_prediction_error === 'number' && (
                            <div className="flex flex-col">
                              <span className="text-gray-500 font-mono text-[9px] uppercase">Prediction Drift</span>
                              <span className="text-[#FBBF24]">{outcome.calculated_prediction_error.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                        {outcome.notes && (
                          <p className="text-gray-400 mt-1.5">{outcome.notes}</p>
                        )}
                        {wc.status === 'COMPLETED' && (
                          <div className="text-[10px] uppercase tracking-widest text-[#34D399] font-bold mt-2">
                            [ Lifecycle Completed ]
                          </div>
                        )}
                      </div>
                    ) : decision ? (
                      <div className="text-[10px] uppercase tracking-widest text-gray-600 italic">
                        [ Awaiting field outcome ]
                      </div>
                    ) : null}
                  </div>

                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#2A1F16] pt-6 pb-10 text-[10px] text-gray-500 leading-relaxed">
          <div className="flex items-start gap-2 mb-2">
            <Info className="w-3.5 h-3.5 mt-0.5 text-gray-600" />
            <div>
              <p className="mb-1">{data.meta.truth_boundary}</p>
              <p>
                Schema: <span className="font-mono text-gray-400">{data.meta.schema}</span> · Origin:{' '}
                <span className="font-mono text-gray-400">{data.meta.origin}</span> · Generated:{' '}
                <span className="font-mono text-gray-400">
                  {new Date(data.meta.generated_at).toLocaleString()}
                </span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
