import { Activity, ShieldCheck, Cpu, Hammer, Search, ShieldAlert } from 'lucide-react';

export default function ReviewPage() {
  return (
    <div className="min-h-screen bg-[#050806] text-gray-200 font-mono p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <header className="mb-10 border-b border-[#2A1F16] pb-6">
          <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
            <Search className="w-5 h-5" />
            Reviewer Quick Check
          </h1>
          <p className="text-[#8a7a64] text-sm leading-relaxed max-w-xl">
            Start at route health, inspect one proof event, confirm one entitlement boundary, then trace one exported planning artifact through its local review path.
          </p>
        </header>

        <div className="space-y-6 mb-12">
          {/* Step 1 */}
          <div className="border border-[#1A1410] bg-black/20 p-5 rounded-lg flex items-start gap-4">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">1</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E8842A]" />
                Route Health
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /route-health and verify availability plus the most recent sweep status.
              </p>
              <a href="/route-health" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 border border-[#E8842A]/40 text-[#E8842A] text-[10px] uppercase tracking-widest rounded hover:bg-[#E8842A]/10 transition-colors">
                Open Route Health
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-[#1A1410] bg-black/20 p-5 rounded-lg flex items-start gap-4">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">2</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#34D399]" />
                Proof Log
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /proof-log and inspect one visible event.
              </p>
              <a href="/proof-log" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 border border-[#34D399]/40 text-[#34D399] text-[10px] uppercase tracking-widest rounded hover:bg-[#34D399]/10 transition-colors">
                Open Proof Log
              </a>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-[#1A1410] bg-black/20 p-5 rounded-lg flex items-start gap-4">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">3</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#D4A853]" />
                Entitlements
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /entitlements and confirm one operator-controlled budget boundary.
              </p>
              <a href="/entitlements" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 border border-[#D4A853]/40 text-[#D4A853] text-[10px] uppercase tracking-widest rounded hover:bg-[#D4A853]/10 transition-colors">
                Open Entitlements
              </a>
            </div>
          </div>

          {/* Step 4 */}
          <div className="border border-[#1A1410] bg-black/20 p-5 rounded-lg flex items-start gap-4">
            <div className="w-8 h-8 rounded bg-[#1A1410] border border-[#2A1F16] flex items-center justify-center text-[#E8842A] font-bold shrink-0">4</div>
            <div>
              <h2 className="text-[#c9bba5] text-sm uppercase tracking-widest font-bold mb-1 flex items-center gap-2">
                <Hammer className="w-4 h-4 text-[#60A5FA]" />
                Facility Planner
              </h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Open /workbench and inspect one exported package, diff, or lineage step.
              </p>
              <a href="/workbench" target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 border border-[#60A5FA]/40 text-[#60A5FA] text-[10px] uppercase tracking-widest rounded hover:bg-[#60A5FA]/10 transition-colors">
                Open Workbench
              </a>
            </div>
          </div>

          {/* Step 5 */}
          <div className="border border-[#1A1410] bg-black/20 p-5 rounded-lg flex items-start gap-4">
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
        <div className="border border-[#2A1F16] bg-[#0A0604] rounded-lg p-5 mb-10">
          <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-4 border-b border-[#2A1F16] pb-2">
            Example Proof Structure
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-[10px]">
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Actor</span>
              <span className="text-[#c9bba5] font-bold">steward_01</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Action</span>
              <span className="text-[#34D399] font-bold">budget_reserve</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Artifact ID</span>
              <span className="text-gray-400">facility-1704983021</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Budget Impact</span>
              <span className="text-[#D4A853]">1,500 EMBER</span>
            </div>
            <div>
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Operator Ack</span>
              <span className="text-gray-400">Verified locally</span>
            </div>
            <div className="col-span-2 md:col-span-3">
              <span className="text-gray-600 uppercase tracking-widest block mb-1">Proof Hash</span>
              <span className="text-[#E8842A] bg-black/40 px-2 py-1 border border-[#2A1F16] rounded inline-block">
                3f2b4c8a9e01d7... (simulated)
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#2A1F16] text-[9px] text-gray-500 italic">
            This is a static example block to illustrate the payload structure before you enter the live /proof-log.
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
