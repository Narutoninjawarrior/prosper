import { Activity, ShieldCheck, Cpu, Hammer, Search, ShieldAlert } from 'lucide-react';

export default function ReviewPage() {
  return (
    <div className="min-h-screen bg-[#050806] text-gray-200 font-mono p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <header className="mb-10 border-b border-[#2A1F16] pb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
              <Search className="w-5 h-5" />
              Reviewer Quick Check
            </h1>
            <p className="text-[#8a7a64] text-sm leading-relaxed max-w-xl mb-4">
              Start at route health, inspect one proof event, confirm one entitlement boundary, then trace one exported planning artifact through its local review path.
            </p>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-flex px-3 py-1.5 rounded">
              Static guide. Not a live execution surface.
            </div>
          </div>
        </header>

        <div className="space-y-6 mb-12">
          {/* Step 1 */}
          <div className="border border-[#1A1410] bg-[#0A0604] p-5 rounded-lg flex items-start gap-4 hover:border-[#2A1F16] transition-colors">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">1</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E8842A]" />
                Route Health
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /route-health and verify availability plus the most recent sweep status.
              </p>
              <a href="/route-health" target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 border border-[#1A1410] bg-black/20 text-[#E8842A] text-[10px] uppercase tracking-widest rounded hover:border-[#E8842A]/40 hover:bg-[#E8842A]/5 transition-colors">
                Open Route Health
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-[#1A1410] bg-[#0A0604] p-5 rounded-lg flex items-start gap-4 hover:border-[#2A1F16] transition-colors">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">2</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#34D399]" />
                Proof Log
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /proof-log and inspect one visible event (check actor, action, proof-hash, and timestamp).
              </p>
              <a href="/proof-log" target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 border border-[#1A1410] bg-black/20 text-[#34D399] text-[10px] uppercase tracking-widest rounded hover:border-[#34D399]/40 hover:bg-[#34D399]/5 transition-colors">
                Open Proof Log
              </a>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-[#1A1410] bg-[#0A0604] p-5 rounded-lg flex items-start gap-4 hover:border-[#2A1F16] transition-colors">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">3</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#D4A853]" />
                Entitlements
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /entitlements and confirm one operator-controlled budget boundary.
              </p>
              <a href="/entitlements" target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 border border-[#1A1410] bg-black/20 text-[#D4A853] text-[10px] uppercase tracking-widest rounded hover:border-[#D4A853]/40 hover:bg-[#D4A853]/5 transition-colors">
                Open Entitlements
              </a>
            </div>
          </div>

          {/* Step 4 */}
          <div className="border border-[#1A1410] bg-[#0A0604] p-5 rounded-lg flex items-start gap-4 hover:border-[#2A1F16] transition-colors">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">4</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Hammer className="w-4 h-4 text-[#60A5FA]" />
                Build Planners
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /workbench and inspect one exported package, diff, or lineage step. For physical-system planning, open the Biosystem Canvas or Facility Build Planner. Opens as a local planning canvas. Commons handoff remains draft-scoped until promoted. Some planning artifacts include a local Decision Trace showing AI proposals and operator choices before promotion.
              </p>
              <div className="flex gap-2">
                <a href="/workbench?tab=facility" target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 border border-[#1A1410] bg-black/20 text-[#60A5FA] text-[10px] uppercase tracking-widest rounded hover:border-[#60A5FA]/40 hover:bg-[#60A5FA]/5 transition-colors">
                  Facility Planner
                </a>
                <a href="/workbench?tab=biosystem" target="_blank" rel="noopener noreferrer" className="inline-flex px-4 py-2 border border-[#1A1410] bg-black/20 text-[#4A90D9] text-[10px] uppercase tracking-widest rounded hover:border-[#4A90D9]/40 hover:bg-[#4A90D9]/5 transition-colors">
                  Biosystem Planner
                </a>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="border border-[#1A1410] bg-[#0A0604] p-5 rounded-lg flex items-start gap-4 hover:border-[#2A1F16] transition-colors">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">5</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Freeze / Boundary Check
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Confirm the system distinguishes public read surfaces from operator- or local-only actions.
              </p>
            </div>
          </div>
        </div>

        {/* Example Proof Detail Block */}
        <div className="border border-[#1A1410] bg-[#0A0604] rounded-lg p-5 mb-10 shadow-lg">
          <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-4 border-b border-[#2A1F16] pb-3 flex items-center justify-between">
            <span>Example Proof Structure</span>
            <span className="text-[#E8842A]/70">(For Orientation)</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 text-[11px]">
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Actor</span>
              <span className="text-[#c9bba5] font-bold">steward_01</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Action</span>
              <span className="text-[#34D399] font-bold">budget_reserve</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Artifact ID</span>
              <span className="text-gray-400">facility-1704983021</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Budget Impact</span>
              <span className="text-[#D4A853]">1,500 EMBER</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Operator Ack</span>
              <span className="text-gray-400">Verified locally</span>
            </div>
            <div className="col-span-2 md:col-span-3">
              <span className="text-gray-600 uppercase tracking-widest block mb-1 text-[9px]">Proof Hash</span>
              <span className="text-[#E8842A] bg-black/40 px-2 py-1.5 border border-[#2A1F16] rounded inline-block font-mono text-[10px]">
                3f2b4c8a9e01d7... (simulated)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#2A1F16] pt-6 pb-12">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-block px-3 py-1.5 rounded">
            This page is a review guide. It does not witness events, execute plans, or grant write access.
          </p>
        </footer>
      </div>
    </div>
  );
}
