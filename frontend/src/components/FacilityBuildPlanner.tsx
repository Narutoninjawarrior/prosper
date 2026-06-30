import React, { useState, useEffect } from 'react';
import type { ValidationReport, ConstraintResult } from '../lib/constraintValidator';

export interface FacilityManifest {
  id: string;
  title: string;
  facility_type: string;
  footprint: string;
  phases: string;
  materials: string[];
  tools_required: string[];
  estimated_labor_hours: number;
  estimated_power_needs: number;
  estimated_water_needs: number;
  estimated_budget_ember: number;
  dependencies: string[];
  notes: string;
  updated_at: string;
}

export interface FacilityBuildPlannerProps {
  onManifestChange?: (manifest: FacilityManifest | null) => void;
  onValidationChange?: (report: ValidationReport) => void;
}

const PRESETS: Record<string, Partial<FacilityManifest>> = {
  'Workshop Pod': {
    facility_type: 'Workshop Pod',
    footprint: '5m x 5m',
    phases: 'Phase 1: Foundation pad\nPhase 2: Pod shell\nPhase 3: Tool racks',
    materials: ['50kg Hempcrete', 'Timber Framing', 'Steel brackets'],
    tools_required: ['Drill', 'Saw', 'Level'],
    estimated_labor_hours: 40,
    estimated_power_needs: 1500,
    estimated_water_needs: 50,
    estimated_budget_ember: 250,
    dependencies: ['Level Ground', 'Grid Power Drop'],
    notes: 'Standard fabrication node.'
  },
  'Printed Habitat': {
    facility_type: 'Printed Habitat',
    footprint: '8m x 12m',
    phases: 'Phase 1: Site prep\nPhase 2: Gantry setup\nPhase 3: Continuous print\nPhase 4: Roof seal',
    materials: ['2000kg Earth-composite', 'Roofing Membrane', 'Window Frames'],
    tools_required: ['3D Print Gantry', 'Mixer', 'Scaffolding'],
    estimated_labor_hours: 120,
    estimated_power_needs: 5000,
    estimated_water_needs: 1500,
    estimated_budget_ember: 1200,
    dependencies: ['Raw Earth Supply', 'Clear Weather'],
    notes: 'Requires continuous power during print phase.'
  },
  'Earthbag Utility Wall': {
    facility_type: 'Earthbag Utility Wall',
    footprint: '10m x 0.5m',
    phases: 'Phase 1: Trench\nPhase 2: Bag filling & tamping\nPhase 3: Plaster coat',
    materials: ['100 Polypropylene bags', 'Subsoil', 'Barbed wire', 'Lime plaster'],
    tools_required: ['Shovels', 'Tampers', 'Trowels'],
    estimated_labor_hours: 60,
    estimated_power_needs: 0,
    estimated_water_needs: 200,
    estimated_budget_ember: 150,
    dependencies: ['Soil testing'],
    notes: 'Highly labor intensive but low material cost.'
  },
  'Aquaculture Node': {
    facility_type: 'Aquaculture Node',
    footprint: '4m x 6m',
    phases: 'Phase 1: Tank placement\nPhase 2: Plumbing & Pumps\nPhase 3: Biofilter cycling',
    materials: ['IBC Totes (x4)', 'PVC Piping', 'Air stones', 'Clay pebbles'],
    tools_required: ['Pipe Cutter', 'Drill', 'Water testing kit'],
    estimated_labor_hours: 30,
    estimated_power_needs: 300,
    estimated_water_needs: 4000,
    estimated_budget_ember: 450,
    dependencies: ['Clean Water Source'],
    notes: 'Constant aeration required.'
  },
  'Greenhouse Bay': {
    facility_type: 'Greenhouse Bay',
    footprint: '6m x 10m',
    phases: 'Phase 1: Base rail\nPhase 2: Hoops\nPhase 3: Skinning & Ventilation',
    materials: ['Steel Hoops', 'Polyethylene film', 'Roll-up side hardware'],
    tools_required: ['Pipe Bender', 'Ladders', 'Wrenches'],
    estimated_labor_hours: 45,
    estimated_power_needs: 100,
    estimated_water_needs: 1000,
    estimated_budget_ember: 600,
    dependencies: ['Level Ground', 'Irrigation main'],
    notes: 'Orient long axis East-West.'
  }
};

export default function FacilityBuildPlanner({ onManifestChange, onValidationChange }: FacilityBuildPlannerProps) {
  const [manifest, setManifest] = useState<FacilityManifest>(() => {
    const base = PRESETS['Workshop Pod'];
    return {
      id: `facility-${Date.now()}`,
      title: 'Initial Pod Draft',
      facility_type: 'Workshop Pod',
      footprint: base.footprint || '',
      phases: base.phases || '',
      materials: base.materials || [''],
      tools_required: base.tools_required || [''],
      estimated_labor_hours: base.estimated_labor_hours || 0,
      estimated_power_needs: base.estimated_power_needs || 0,
      estimated_water_needs: base.estimated_water_needs || 0,
      estimated_budget_ember: base.estimated_budget_ember || 0,
      dependencies: base.dependencies || [''],
      notes: base.notes || '',
      updated_at: new Date().toISOString()
    };
  });

  const handleApplyPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      setManifest(prev => ({
        ...prev,
        ...preset,
        title: `${presetName} Draft`,
        updated_at: new Date().toISOString()
      }));
    }
  };

  const validate = (current: FacilityManifest): ValidationReport => {
    const results: ConstraintResult[] = [];
    let isHardFail = false;

    if (!current.title.trim()) {
      results.push({ level: 'hard_fail', message: 'Title is required for the facility manifest.' });
      isHardFail = true;
    }

    if (!current.footprint.trim()) {
      results.push({ level: 'hard_fail', message: 'Footprint dimensions are missing.' });
      isHardFail = true;
    }

    if (current.estimated_labor_hours <= 0) {
      results.push({ level: 'hard_fail', message: 'Estimated labor hours must be greater than zero.' });
      isHardFail = true;
    }

    if (current.estimated_budget_ember <= 0) {
      results.push({ level: 'warning', message: 'No EMBER budget estimated.' });
    }

    const validMaterials = current.materials.filter(m => m.trim() !== '');
    if (validMaterials.length === 0) {
      results.push({ level: 'hard_fail', message: 'At least one material is required.' });
      isHardFail = true;
    }

    const hasWarning = results.some(r => r.level === 'warning');
    const level = isHardFail ? 'hard_fail' : (hasWarning ? 'warning' : 'ok');
    
    return { isValid: !isHardFail, level, results };
  };

  useEffect(() => {
    const updated = { ...manifest, updated_at: new Date().toISOString() };
    const cleanedManifest = {
      ...updated,
      materials: updated.materials.filter(m => m.trim() !== ''),
      tools_required: updated.tools_required.filter(t => t.trim() !== ''),
      dependencies: updated.dependencies.filter(d => d.trim() !== '')
    };
    
    if (onManifestChange) onManifestChange(cleanedManifest);
    if (onValidationChange) onValidationChange(validate(updated));
  }, [manifest]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setManifest(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleArrayChange = (field: 'materials' | 'tools_required' | 'dependencies', index: number, value: string) => {
    setManifest(prev => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field: 'materials' | 'tools_required' | 'dependencies') => {
    setManifest(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field: 'materials' | 'tools_required' | 'dependencies', index: number) => {
    setManifest(prev => {
      const arr = [...prev[field]];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full text-sm">
      <div className="flex flex-wrap gap-2 mb-2 pb-4 border-b border-[#7A9E7E]/10">
        <span className="w-full text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Quick Presets:</span>
        {Object.keys(PRESETS).map(p => (
          <button key={p} onClick={() => handleApplyPreset(p)} className="text-[10px] uppercase tracking-widest text-[#7A9E7E] hover:text-white border border-[#7A9E7E]/30 px-3 py-1.5 rounded bg-black/20 hover:bg-[#7A9E7E]/20 transition-colors">
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Facility Title</span>
          <input type="text" name="title" value={manifest.title} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Node 3 Greenhouse" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Facility Type</span>
          <input type="text" name="facility_type" value={manifest.facility_type} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Workshop Pod" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Footprint (L x W)</span>
          <input type="text" name="footprint" value={manifest.footprint} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. 5m x 5m" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Labor Hours Est.</span>
          <input type="number" min="0" name="estimated_labor_hours" value={manifest.estimated_labor_hours} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Power (Watts)</span>
          <input type="number" min="0" name="estimated_power_needs" value={manifest.estimated_power_needs} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Water (Liters)</span>
          <input type="number" min="0" name="estimated_water_needs" value={manifest.estimated_water_needs} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#D4A853] font-mono text-[10px] uppercase tracking-wider">Budget Est. ($EMBER)</span>
          <input type="number" min="0" name="estimated_budget_ember" value={manifest.estimated_budget_ember} onChange={handleChange} className="bg-black/40 border border-[#D4A853]/50 rounded px-3 py-2 text-[#D4A853] font-mono text-xs focus:outline-none focus:border-[#D4A853]" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Materials</span>
        {manifest.materials.map((mat, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={mat} onChange={(e) => handleArrayChange('materials', i, e.target.value)} className="flex-1 bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. 50kg Hempcrete" />
            <button onClick={() => removeArrayItem('materials', i)} className="px-3 border border-[#7A9E7E]/30 rounded text-[#7A9E7E] hover:text-white bg-black/20 hover:bg-black/40">✕</button>
          </div>
        ))}
        <button onClick={() => addArrayItem('materials')} className="self-start text-[10px] uppercase tracking-widest text-[#7A9E7E] hover:text-white border border-[#7A9E7E]/30 px-3 py-1 rounded">+ Add Material</button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Required Tools</span>
        {manifest.tools_required.map((tool, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={tool} onChange={(e) => handleArrayChange('tools_required', i, e.target.value)} className="flex-1 bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Concrete Mixer" />
            <button onClick={() => removeArrayItem('tools_required', i)} className="px-3 border border-[#7A9E7E]/30 rounded text-[#7A9E7E] hover:text-white bg-black/20 hover:bg-black/40">✕</button>
          </div>
        ))}
        <button onClick={() => addArrayItem('tools_required')} className="self-start text-[10px] uppercase tracking-widest text-[#7A9E7E] hover:text-white border border-[#7A9E7E]/30 px-3 py-1 rounded">+ Add Tool</button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Dependencies / Pre-requisites</span>
        {manifest.dependencies.map((dep, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={dep} onChange={(e) => handleArrayChange('dependencies', i, e.target.value)} className="flex-1 bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Level Ground" />
            <button onClick={() => removeArrayItem('dependencies', i)} className="px-3 border border-[#7A9E7E]/30 rounded text-[#7A9E7E] hover:text-white bg-black/20 hover:bg-black/40">✕</button>
          </div>
        ))}
        <button onClick={() => addArrayItem('dependencies')} className="self-start text-[10px] uppercase tracking-widest text-[#7A9E7E] hover:text-white border border-[#7A9E7E]/30 px-3 py-1 rounded">+ Add Dependency</button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Phases</span>
        <textarea name="phases" value={manifest.phases} onChange={handleChange} rows={3} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="Phase 1: Foundation&#10;Phase 2: Framework..." />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Notes / Risk Mitigation</span>
        <textarea name="notes" value={manifest.notes} onChange={handleChange} rows={2} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Requires dry weather for curing." />
      </label>

      {/* Derived BOM Compiler & Rollup Panel */}
      <div className="mt-4 border border-[#D4A853]/30 rounded-lg bg-[#D4A853]/5 p-4">
        <h3 className="text-[#D4A853] font-mono text-xs uppercase tracking-widest font-bold mb-3 border-b border-[#D4A853]/20 pb-2 flex justify-between items-center">
          <span>Derived Rollup & BOM</span>
          <span className="text-[#8a7a64] text-[9px] tracking-wider">Planning Aid Only</span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2 text-[11px] font-mono mt-3">
          <div>
            <div className="text-[#b7c9be] text-[9px] uppercase tracking-widest mb-0.5">Material Lines</div>
            <div className="text-white text-sm">{manifest.materials.filter(m => m.trim()).length}</div>
          </div>
          <div>
            <div className="text-[#b7c9be] text-[9px] uppercase tracking-widest mb-0.5">Dependencies</div>
            <div className="text-white text-sm">{manifest.dependencies.filter(d => d.trim()).length}</div>
          </div>
          <div>
            <div className="text-[#b7c9be] text-[9px] uppercase tracking-widest mb-0.5">Est. Labor</div>
            <div className="text-white text-sm">{manifest.estimated_labor_hours} <span className="text-[10px] text-gray-500">hrs</span></div>
          </div>
          <div>
            <div className="text-[#b7c9be] text-[9px] uppercase tracking-widest mb-0.5">Power Load</div>
            <div className="text-white text-sm">{manifest.estimated_power_needs} <span className="text-[10px] text-gray-500">W</span></div>
          </div>
          <div>
            <div className="text-[#b7c9be] text-[9px] uppercase tracking-widest mb-0.5">Water Volume</div>
            <div className="text-white text-sm">{manifest.estimated_water_needs} <span className="text-[10px] text-gray-500">L</span></div>
          </div>
          <div>
            <div className="text-[#D4A853] text-[9px] uppercase tracking-widest mb-0.5">Est. Cost</div>
            <div className="text-[#D4A853] text-sm font-bold">{manifest.estimated_budget_ember} <span className="text-[10px] text-[#D4A853]/70">EMBER</span></div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#D4A853]/20 text-[10px] text-[#8a7a64] italic">
          Disclaimer: This compiled summary is a rough structural planning proxy. Not for engineering certification or automated robotic procurement.
        </div>
      </div>
    </div>
  );
}
