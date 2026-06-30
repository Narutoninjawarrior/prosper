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

export default function FacilityBuildPlanner({ onManifestChange, onValidationChange }: FacilityBuildPlannerProps) {
  const [manifest, setManifest] = useState<FacilityManifest>({
    id: `facility-${Date.now()}`,
    title: '',
    facility_type: 'Workshop Pod',
    footprint: '',
    phases: '',
    materials: [''],
    tools_required: [''],
    estimated_labor_hours: 0,
    estimated_power_needs: 0,
    estimated_water_needs: 0,
    estimated_budget_ember: 0,
    dependencies: [''],
    notes: '',
    updated_at: new Date().toISOString()
  });

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Facility Title</span>
          <input type="text" name="title" value={manifest.title} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Node 3 Greenhouse" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Facility Type</span>
          <select name="facility_type" value={manifest.facility_type} onChange={handleChange} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]">
            <option>Workshop Pod</option>
            <option>Printed Habitat</option>
            <option>Earthbag Utility Wall</option>
            <option>Aquaculture Node</option>
            <option>Greenhouse Bay</option>
          </select>
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

      <label className="flex flex-col gap-1">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Phases</span>
        <textarea name="phases" value={manifest.phases} onChange={handleChange} rows={3} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="Phase 1: Foundation&#10;Phase 2: Framework..." />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Notes / Risk Mitigation</span>
        <textarea name="notes" value={manifest.notes} onChange={handleChange} rows={2} className="bg-black/40 border border-[#7A9E7E]/30 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]" placeholder="e.g. Requires dry weather for curing." />
      </label>
    </div>
  );
}
