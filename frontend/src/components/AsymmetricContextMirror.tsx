import { Eye, Terminal, Settings2, Activity, Zap, Droplets, Hammer, CheckCircle } from 'lucide-react';
import type { FacilityManifest } from './FacilityBuildPlanner';

interface AsymmetricContextMirrorProps {
  manifest: FacilityManifest;
  onUpdateWaterNeed: (val: number) => void;
  onWorldFocus?: () => void;
}

export default function AsymmetricContextMirror({
  manifest,
  onUpdateWaterNeed,
  onWorldFocus
}: AsymmetricContextMirrorProps) {
  const materialsCount = manifest.materials.filter(m => m.trim()).length;
  const depsCount = manifest.dependencies.filter(d => d.trim()).length;

  return (
    <div className="flex flex-col gap-4 font-mono w-full">
      <div className="flex items-center justify-between px-2 text-[#8a7a64] text-[10px] uppercase tracking-widest border-b border-[#2A1F16] pb-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[#E8842A]" />
          <span>Local planning mirror. Shared human/machine view of the same draft state.</span>
        </div>
        {onWorldFocus && (
          <button 
            onClick={onWorldFocus}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1410] border border-[#3D2C1E] text-[#4A90D9] hover:text-[#E8842A] hover:border-[#E8842A] transition-colors rounded"
          >
            <Activity className="w-3 h-3" /> Focus in World
          </button>
        )}
      </div>

      {/* Shared Control */}
      <div className="bg-[#1A1410] p-4 rounded border border-[#2A1F16] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-[11px] text-[#c9bba5] font-bold uppercase tracking-widest mb-1">Shared Parameter Injection</h3>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest">Adjust physical requirements. Updates both human context and machine manifest synchronously.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-[#4A90D9]" />
            Target Water Load (L)
          </label>
          <input 
            type="number" 
            min="0"
            value={manifest.estimated_water_needs}
            onChange={(e) => onUpdateWaterNeed(Number(e.target.value))}
            className="bg-[#0A0604] border border-[#3D2C1E] rounded px-3 py-1.5 text-[#4A90D9] font-bold text-sm w-32 focus:outline-none focus:border-[#4A90D9]"
          />
        </div>
      </div>

      {/* Split Mirror Views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Human Context Left */}
        <div className="bg-[#0A0604] border border-[#2A1F16] rounded overflow-hidden flex flex-col">
          <div className="bg-black/40 border-b border-[#2A1F16] px-4 py-3 flex justify-between items-center">
            <h3 className="text-[11px] uppercase tracking-widest text-[#E8842A] font-bold flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" /> Operational Brief
            </h3>
            <span className="text-[9px] bg-[#1A1410] px-2 py-0.5 rounded text-gray-400 border border-[#2A1F16]">HUMAN-READABLE</span>
          </div>
          <div className="p-5 flex-1 space-y-4 text-xs">
            <div className="pb-3 border-b border-[#1A1410]">
              <h4 className="text-xl font-bold text-gray-200 mb-1">{manifest.title}</h4>
              <div className="text-[#c9bba5] uppercase tracking-widest text-[10px]">{manifest.facility_type}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1">Footprint</span>
                <span className="text-gray-300 font-bold">{manifest.footprint}</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1">Labor Est.</span>
                <span className="text-gray-300 font-bold flex items-center gap-1.5"><Hammer className="w-3 h-3 text-gray-500" /> {manifest.estimated_labor_hours} hrs</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1">Power Need</span>
                <span className="text-gray-300 font-bold flex items-center gap-1.5"><Zap className="w-3 h-3 text-[#E8842A]" /> {manifest.estimated_power_needs} W</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-500 uppercase tracking-widest mb-1">Water Need</span>
                <span className="text-[#4A90D9] font-bold flex items-center gap-1.5"><Droplets className="w-3 h-3" /> {manifest.estimated_water_needs} L</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A1410]">
              <span className="block text-[9px] text-gray-500 uppercase tracking-widest mb-2">Resource Scope</span>
              <div className="flex gap-4">
                <div className="bg-[#1A1410] rounded border border-[#2A1F16] px-3 py-2 flex-1">
                  <div className="text-[18px] font-bold text-gray-300">{materialsCount}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">Material Lines</div>
                </div>
                <div className="bg-[#1A1410] rounded border border-[#2A1F16] px-3 py-2 flex-1">
                  <div className="text-[18px] font-bold text-gray-300">{depsCount}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest">Dependencies</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A1410]">
               <div className="flex items-center gap-2 text-[#34D399] text-[10px] uppercase font-bold tracking-widest">
                 <CheckCircle className="w-3.5 h-3.5" /> Draft Planner State
               </div>
            </div>
          </div>
        </div>

        {/* Machine Context Right */}
        <div className="bg-[#050302] border border-[#1A1A1A] rounded overflow-hidden flex flex-col">
          <div className="bg-[#0A0A0A] border-b border-[#1A1A1A] px-4 py-3 flex justify-between items-center">
            <h3 className="text-[11px] uppercase tracking-widest text-[#34D399] font-bold flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" /> JSON Manifest
            </h3>
            <span className="text-[9px] bg-[#111] px-2 py-0.5 rounded text-gray-500 border border-[#333]">MACHINE-READABLE</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
            <pre className="text-[10px] text-gray-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(manifest, null, 2)}
            </pre>
          </div>
        </div>

      </div>
    </div>
  );
}
