import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Database,
  Eye,
  FileCheck,
  FileUp,
  Info,
  Target,
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

        {/* Work Cards */}
        <section className="mb-8">
          <SectionHeader icon={<ClipboardList width={14} height={14} />} label="Work Cards" count={data.work_cards.length} />
          <div className="space-y-3">
            {data.work_cards.map((wc) => (
              <div
                key={wc.work_card_id}
                className="bg-[#0A0604] border border-[#1A1410] rounded-lg p-4 hover:border-[#2A1F16] transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-[#c9bba5]">{wc.label}</span>
                      <StatusChip status={wc.status} />
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">{wc.work_card_id}</div>
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">
                    {wc.estimated_labor_hours} hrs · {wc.operator_type} · {wc.qualification}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">{wc.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px]">
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Tools</span>
                    <div className="text-gray-300 mt-0.5">
                      {wc.tools.length > 0 ? wc.tools.join(', ') : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Materials</span>
                    <div className="text-gray-300 mt-0.5">
                      {wc.materials.length > 0 ? wc.materials.join(', ') : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 uppercase tracking-wider">Safety Limits</span>
                    <div className="text-gray-300 mt-0.5">
                      {wc.safety_limits.length > 0 ? wc.safety_limits.join(', ') : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Decision Traces */}
        <section className="mb-8">
          <SectionHeader icon={<FileCheck width={14} height={14} />} label="Decision Traces" count={data.decision_traces.length} />
          <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1A1410] text-gray-500 uppercase tracking-widest text-[9px]">
                  <th className="text-left px-4 py-2">Decision</th>
                  <th className="text-left px-4 py-2">Work Card</th>
                  <th className="text-left px-4 py-2">Approved</th>
                  <th className="text-left px-4 py-2">Reasoning</th>
                  <th className="text-left px-4 py-2">Reviewer</th>
                  <th className="text-left px-4 py-2">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1410]">
                {data.decision_traces.map((d) => (
                  <tr key={d.decision_id} className="hover:bg-[#110D0A]">
                    <td className="px-4 py-2.5 font-mono text-gray-400">{d.decision_id}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400">{d.work_card_id}</td>
                    <td className="px-4 py-2.5">
                      <StatusChip status={d.operator_approved ? 'true' : 'false'} />
                    </td>
                    <td className="px-4 py-2.5 text-gray-300 max-w-md">{d.reasoning}</td>
                    <td className="px-4 py-2.5 text-gray-400">{d.reviewed_by}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {new Date(d.reviewed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Outcomes */}
        <section className="mb-8">
          <SectionHeader icon={<Target width={14} height={14} />} label="Outcomes" count={data.outcomes.length} />
          <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#1A1410] text-gray-500 uppercase tracking-widest text-[9px]">
                  <th className="text-left px-4 py-2">Outcome</th>
                  <th className="text-left px-4 py-2">Work Card</th>
                  <th className="text-left px-4 py-2">Observed Value</th>
                  <th className="text-left px-4 py-2">Error</th>
                  <th className="text-left px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1410]">
                {data.outcomes.map((o) => (
                  <tr key={o.outcome_id} className="hover:bg-[#110D0A]">
                    <td className="px-4 py-2.5 font-mono text-gray-400">{o.outcome_id}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400">{o.work_card_id}</td>
                    <td className="px-4 py-2.5 text-[#c9bba5]">
                      {o.observed_value} {o.metric_unit}
                    </td>
                    <td className="px-4 py-2.5 text-gray-300">
                      {o.calculated_prediction_error.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{o.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
