import { useEffect, useState, useMemo } from 'react';
import type { 
  PhysicalWorkPackV1, 
  WorkPackStatus, 
  OperatorType,
  StopConditionV1,
  WorkPackValidationContext
} from '../lib/physicalWorkPack';
import { 
  validatePhysicalWorkPack, 
  compileWorkPackMarkdown,
  resolveLocalCompletedWorkCards
} from '../lib/physicalWorkPack';
import { Download, CheckCircle2, AlertTriangle, RefreshCw, Layers, ShieldAlert, Sparkles } from 'lucide-react';

interface PhysicalWorkPackCompilerProps {
  facilityPayload?: any;
  biosystemPayload?: any;
}

export default function PhysicalWorkPackCompiler({ 
  facilityPayload, 
  biosystemPayload 
}: PhysicalWorkPackCompilerProps) {
  // Main fields
  const [id, setId] = useState(() => `wcard-${Date.now()}`);
  const [facilityId, setFacilityId] = useState('facility-example-01');
  const [facilityTitle, setFacilityTitle] = useState('Example Planning Area');
  const [targetAssets, setTargetAssets] = useState('example-asset-01');
  const [taskDescription, setTaskDescription] = useState('Verify structural alignment');
  const [taskClass, setTaskClass] = useState('inspection');
  const [operatorType, setOperatorType] = useState<OperatorType>('human');
  const [qualification, setQualification] = useState('Standard Operator');
  const [zone, setZone] = useState('Main Area');
  const [coordinates, setCoordinates] = useState('Local Grid [0.0, 0.0]');
  const [materials, setMaterials] = useState('');
  const [tools, setTools] = useState('');
  const [estimatedLaborHours, setEstimatedLaborHours] = useState(2);
  const [safetyLimits, setSafetyLimits] = useState('Wear protective gear');
  const [stopConditions, setStopConditions] = useState('abort_override | Manual operator emergency halt | Cut motor power and hold position');
  const [prerequisites, setPrerequisites] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [status, setStatus] = useState<WorkPackStatus>('DRAFT');
  const [isOperatorApproved, setIsOperatorApproved] = useState(false);
  
  // Approval Records
  const [reviewedBy, setReviewedBy] = useState('');
  const [reviewedAt, setReviewedAt] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [authorizedAt, setAuthorizedAt] = useState('');

  // Domain Extensions
  const [buildingCodeRef, setBuildingCodeRef] = useState('');
  const [structuralInspection, setStructuralInspection] = useState(false);
  const [species, setSpecies] = useState('');
  const [cultivar, setCultivar] = useState('');
  const [healthMetricTarget, setHealthMetricTarget] = useState('');
  const [commandVocabulary, setCommandVocabulary] = useState('');
  const [maxPayloadKg, setMaxPayloadKg] = useState(0);
  const [safeStateMode, setSafeStateMode] = useState('');

  // Validation Context
  const [validationContext, setValidationContext] = useState<WorkPackValidationContext>({ completed_work_card_ids: [] });

  useEffect(() => {
    let mounted = true;
    resolveLocalCompletedWorkCards().then(ctx => {
      if (mounted) setValidationContext(ctx);
    });
    return () => { mounted = false; };
  }, []);

  // View state
  const [previewTab, setPreviewTab] = useState<'md' | 'json'>('md');

  // Load from active inputs
  const hasActiveFacility = !!facilityPayload;
  const hasActiveBiosystem = !!biosystemPayload;

  const loadFromActiveDraft = () => {
    if (facilityPayload) {
      setFacilityId(facilityPayload.id || `facility-${Date.now()}`);
      setFacilityTitle(facilityPayload.title || 'Example Facility Draft');
      setZone(facilityPayload.footprint || 'Zone A');
      
      const mats = Array.isArray(facilityPayload.materials) ? facilityPayload.materials.filter(Boolean).join(', ') : '';
      const tls = Array.isArray(facilityPayload.tools_required) ? facilityPayload.tools_required.filter(Boolean).join(', ') : '';
      const deps = Array.isArray(facilityPayload.dependencies) ? facilityPayload.dependencies.filter(Boolean).join(', ') : '';
      
      setMaterials(mats);
      setTools(tls);
      setPrerequisites('');
      setDependencies(deps);
      setEstimatedLaborHours(facilityPayload.estimated_labor_hours || 2);
      setTaskDescription(`Install structural modules for ${facilityPayload.facility_type || 'facility'}`);
      setTaskClass('install');
      setOperatorType('human');
      setQualification('Construction Team');
      
      // Clear professional verification flags
      setBuildingCodeRef('');
      setStructuralInspection(false);
    } else if (biosystemPayload) {
      setFacilityId(biosystemPayload.manifestId || `biosystem-${Date.now()}`);
      setFacilityTitle(biosystemPayload.title || 'Example Biosystem Draft');
      setZone('Biosystem Enclosure');
      setTaskDescription(`Inspect loop hydraulics, pump status, and verify target pH ${biosystemPayload.targetPh}`);
      setTaskClass('inspection');
      setOperatorType('human');
      setQualification('Aquaculture Steward');
      setMaterials('pH calibration buffer');
      setTools('pH probe, multimeter');
      setEstimatedLaborHours(1);
      
      // Set target assets
      const nodes = Object.keys(biosystemPayload.nodes || {});
      setTargetAssets(nodes.length > 0 ? nodes.join(', ') : 'example-aquaponics-node');
      setPrerequisites('');
      setDependencies('Loop cycling active');
    }
  };

  // Preset Loaders
  const loadConstructionPreset = () => {
    setId(`wcard-construction-${Date.now()}`);
    setFacilityId('facility-example-cottage');
    setFacilityTitle('Example Cottage Plan');
    setTargetAssets('wall-frame-east');
    setTaskDescription('Install timber wall framing for eastern bedroom wall');
    setTaskClass('install');
    setOperatorType('human');
    setQualification('Carpenter Apprentice');
    setZone('Bedroom / Zone 2');
    setCoordinates('Local Grid [10.4, -5.2]');
    setMaterials('Timber studs 2x4 (x15), Screws 3" (x100)');
    setTools('Miter Saw, Impact Driver, Tape Measure');
    setEstimatedLaborHours(6);
    setSafetyLimits('Wear eye protection\nSecure workpieces during cuts');
    setStopConditions('abort_hazard | High wind or storm detected | Secure loose frames and suspend work\nabort_injury | Operator injury reported | Call emergency medical aid and halt all site operations');
    setPrerequisites('');
    setDependencies('Foundation curing completed');
    setStatus('DRAFT');
    
    // Clear approval records
    setReviewedBy('');
    setReviewedAt('');
    setAuthorizedBy('');
    setAuthorizedAt('');

    // Clear extensions to be operator-entered
    setBuildingCodeRef('');
    setStructuralInspection(false);
    setSpecies('');
    setCultivar('');
    setHealthMetricTarget('');
    setCommandVocabulary('');
    setMaxPayloadKg(0);
    setSafeStateMode('');
  };

  const loadRoboticPreset = () => {
    setId(`wcard-robotic-${Date.now()}`);
    setFacilityId('facility-example-biosphere');
    setFacilityTitle('Example Biosphere Chamber');
    setTargetAssets('cacao-humidity-sensor-04');
    setTaskDescription('Inspect cacao tree humidity sensor');
    setTaskClass('inspection');
    setOperatorType('robot');
    setQualification('Autonomous Inspection Swarm Agent');
    setZone('Cacao Conservatory / Node B');
    setCoordinates('Local Grid [2.1, 4.8]');
    setMaterials('');
    setTools('Swarm Drone Model A');
    setEstimatedLaborHours(0.5);
    setSafetyLimits('Keep altitude below 2.5m\nMaintain 0.5m clearance from leaves');
    setStopConditions('abort_battery | Battery low (< 20%) | Return to base docking station immediately\nabort_obstruction | Optical path obscured | Hover and broadcast telemetry warning');
    setPrerequisites('');
    setDependencies('Docking station power verified');
    setStatus('DRAFT');

    // Clear approval records (never prepopulated for drafts)
    setReviewedBy('');
    setReviewedAt('');
    setAuthorizedBy('');
    setAuthorizedAt('');

    // Set biological & robotic extensions
    setSpecies('Theobroma cacao');
    setCultivar('Criollo');
    setHealthMetricTarget('Relative Humidity 70-85%');
    setCommandVocabulary('NAV_TO, MEASURE_HUMIDITY, RETURN_TO_DOCK');
    setMaxPayloadKg(0.2);
    setSafeStateMode('AUTO_LAND_IMMEDIATE');

    // Clear construction
    setBuildingCodeRef('');
    setStructuralInspection(false);
  };

  // Compile full object
  const compiledPack = useMemo<PhysicalWorkPackV1 | null>(() => {
    if (!isOperatorApproved) return null;

    const splitCommaStr = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean);
    const splitLinesStr = (str: string) => str.split('\n').map(s => s.trim()).filter(Boolean);
    
    const parseStopConditions = (str: string): StopConditionV1[] => {
      return str.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const parts = trimmed.split('|').map(s => s.trim());
        return {
          condition_id: parts[0] || '',
          description: parts[1] || '',
          required_response: parts[2] || ''
        };
      }).filter((c): c is StopConditionV1 => c !== null);
    };

    const pack: PhysicalWorkPackV1 = {
      id,
      version: 'v1.0.0',
      facility_reference: {
        facility_id: facilityId,
        facility_title: facilityTitle
      },
      target_assets: splitCommaStr(targetAssets),
      task: {
        description: taskDescription,
        task_class: taskClass
      },
      proposed_operator: {
        type: operatorType,
        required_role_or_qualification: qualification
      },
      spatial_boundary: {
        facility_zone: zone,
        ...(coordinates ? { coordinates } : {})
      },
      resource_requirements: {
        materials: splitCommaStr(materials),
        tools: splitCommaStr(tools),
        estimated_labor_hours: Number(estimatedLaborHours)
      },
      constraints: {
        safety_limits: splitLinesStr(safetyLimits),
        stop_conditions: parseStopConditions(stopConditions)
      },
      prerequisite_work_card_ids: splitCommaStr(prerequisites),
      dependencies: splitLinesStr(dependencies),
      approvals: {
        ...(reviewedBy ? { reviewed_by: reviewedBy, reviewed_at: reviewedAt } : {}),
        ...(authorizedBy ? { authorized_by: authorizedBy, authorized_at: authorizedAt } : {})
      },
      status,
      truth_boundary: status === 'AUTHORIZED' 
        ? 'AUTHORIZED local planning draft. Bounded to safe zones and approved for defined downstream handoff. Not an engineering certification, and does not authorize automated real-world execution without direct operator control.'
        : status === 'REVIEWED'
        ? 'REVIEWED local planning draft. Checked against structure or biosystem constraints. Awaiting final authorized steward handoff before any queue staging.'
        : 'DRAFT/PROPOSED local planning draft only. Not live execution command.',
      domain_extensions: {}
    };

    // Add extensions conditionally
    if (buildingCodeRef || structuralInspection) {
      pack.domain_extensions.construction = {
        ...(buildingCodeRef ? { building_code_reference: buildingCodeRef } : {}),
        structural_inspection_required: structuralInspection
      };
    }
    if (species || cultivar || healthMetricTarget) {
      pack.domain_extensions.biological = {
        ...(species ? { species } : {}),
        ...(cultivar ? { cultivar } : {}),
        ...(healthMetricTarget ? { health_metric_target: healthMetricTarget } : {})
      };
    }
    if (commandVocabulary || maxPayloadKg > 0 || safeStateMode) {
      pack.domain_extensions.robotic = {
        ...(commandVocabulary ? { command_vocabulary: splitCommaStr(commandVocabulary) } : {}),
        max_payload_kg: Number(maxPayloadKg) || 0,
        ...(safeStateMode ? { safe_state_mode: safeStateMode } : {})
      };
    }

    return pack;
  }, [
    id, facilityId, facilityTitle, targetAssets, taskDescription, taskClass,
    operatorType, qualification, zone, coordinates, materials, tools,
    estimatedLaborHours, safetyLimits, stopConditions, prerequisites, dependencies,
    status, reviewedBy, reviewedAt, authorizedBy, authorizedAt,
    buildingCodeRef, structuralInspection, species, cultivar,
    healthMetricTarget, commandVocabulary, maxPayloadKg, safeStateMode
  ]);

  // Validation report
  const validationReport = useMemo(() => {
    return compiledPack ? validatePhysicalWorkPack(compiledPack, validationContext) : [];
  }, [compiledPack, validationContext]);

  const isContextStale = useMemo(() => {
    if (!validationContext.generatedAt) return false;
    const time = new Date(validationContext.generatedAt).getTime();
    if (isNaN(time)) return false;
    return (Date.now() - time) > 24 * 60 * 60 * 1000;
  }, [validationContext.generatedAt]);

  const triggerDownload = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    if (!compiledPack || validationReport.length > 0 || !isOperatorApproved) return;
    const data = JSON.stringify(compiledPack, null, 2);
    triggerDownload(`${id}-work-card.json`, data, 'application/json');
  };

  const downloadMarkdown = () => {
    if (!compiledPack || validationReport.length > 0 || !isOperatorApproved) return;
    const md = compileWorkPackMarkdown(compiledPack);
    triggerDownload(`${id}-brief.md`, md, 'text/markdown');
  };

  return (
    <div className="flex flex-col gap-6 text-sm text-gray-300 font-sans">
      
      {/* Preset controller */}
      <div className="border border-[#7A9E7E]/30 bg-[#7A9E7E]/5 rounded-lg p-4 flex flex-col gap-3">
        <h3 className="text-white font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D4A853]" />
          <span>Operational Work Card Compiler</span>
        </h3>
        <p className="text-[11px] text-gray-400">
          Load templates or import an active planner draft. The compiler validates variables against schema checks.
        </p>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button" 
            onClick={loadConstructionPreset} 
            className="text-[10px] uppercase tracking-wider text-[#7A9E7E] hover:text-white border border-[#7A9E7E]/30 px-3 py-1.5 rounded bg-black/20 hover:bg-[#7A9E7E]/20 transition-all"
          >
            Template: Carpenter Wall Framing
          </button>
          <button 
            type="button" 
            onClick={loadRoboticPreset} 
            className="text-[10px] uppercase tracking-wider text-[#D4A853] hover:text-white border border-[#D4A853]/30 px-3 py-1.5 rounded bg-black/20 hover:bg-[#D4A853]/20 transition-all"
          >
            Template: Robot inspects cacao sensor
          </button>
          {(hasActiveFacility || hasActiveBiosystem) && (
            <button 
              type="button" 
              onClick={loadFromActiveDraft} 
              className="text-[10px] uppercase tracking-wider text-[#60A5FA] hover:text-white border border-[#60A5FA]/30 px-3 py-1.5 rounded bg-[#60A5FA]/10 hover:bg-[#60A5FA]/20 transition-all flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Load Active Planner Draft ({hasActiveFacility ? 'Facility' : 'Biosystem'})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Compiler Form */}
        <div className="flex flex-col gap-4 border border-[#2A1F16] bg-black/20 p-5 rounded-xl">
          <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold border-b border-white/5 pb-2">
            Work Card Attributes
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Work Card ID</span>
              <input 
                type="text" 
                value={id} 
                onChange={(e) => setId(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Status</span>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value as WorkPackStatus)}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              >
                <option value="DRAFT">DRAFT (Proposed)</option>
                <option value="REVIEWED">REVIEWED (Checked)</option>
                <option value="AUTHORIZED">AUTHORIZED (Approved)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Ref Project/Facility ID</span>
              <input 
                type="text" 
                value={facilityId} 
                onChange={(e) => setFacilityId(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Ref Project/Facility Title</span>
              <input 
                type="text" 
                value={facilityTitle} 
                onChange={(e) => setFacilityTitle(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Operator Type</span>
              <select 
                value={operatorType} 
                onChange={(e) => setOperatorType(e.target.value as OperatorType)}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              >
                <option value="human">human (Crew/Carpenter)</option>
                <option value="robot">robot (Automated/Drone)</option>
                <option value="AI">AI (Digital Steward)</option>
                <option value="team">team (Collaborative)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Required Qualification</span>
              <input 
                type="text" 
                value={qualification} 
                onChange={(e) => setQualification(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
                placeholder="e.g. Certified Arborist"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Spatial Zone Boundary</span>
              <input 
                type="text" 
                value={zone} 
                onChange={(e) => setZone(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
                placeholder="e.g. Zone B / Greenhouse"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Coordinates</span>
              <input 
                type="text" 
                value={coordinates} 
                onChange={(e) => setCoordinates(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
                placeholder="e.g. Local Grid [0.0, 0.0]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Task Description</span>
            <input 
              type="text" 
              value={taskDescription} 
              onChange={(e) => setTaskDescription(e.target.value)} 
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Target Assets (comma separated)</span>
            <input 
              type="text" 
              value={targetAssets} 
              onChange={(e) => setTargetAssets(e.target.value)} 
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              placeholder="e.g. pump-01, valve-02"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Materials (comma separated)</span>
              <input 
                type="text" 
                value={materials} 
                onChange={(e) => setMaterials(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Tools (comma separated)</span>
              <input 
                type="text" 
                value={tools} 
                onChange={(e) => setTools(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Est. Labor Hours</span>
              <input 
                type="number" 
                value={estimatedLaborHours} 
                onChange={(e) => setEstimatedLaborHours(Number(e.target.value))} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Task Class</span>
              <select 
                value={taskClass} 
                onChange={(e) => setTaskClass(e.target.value)}
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              >
                <option value="install">install</option>
                <option value="inspection">inspection</option>
                <option value="maintenance">maintenance</option>
                <option value="desalination">desalination</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Safety Limits (one per line)</span>
            <textarea 
              value={safetyLimits} 
              onChange={(e) => setSafetyLimits(e.target.value)} 
              rows={2}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853] resize-y"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Stop Conditions (format: `id | description | response` per line)</span>
            <textarea 
              value={stopConditions} 
              onChange={(e) => setStopConditions(e.target.value)} 
              rows={2}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853] resize-y"
              placeholder="e.g. abort_battery | Battery low | Return to dock"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Prerequisite Work Card IDs (comma separated)</span>
            <textarea 
              value={prerequisites} 
              onChange={(e) => setPrerequisites(e.target.value)} 
              rows={1}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853] resize-y"
              placeholder="e.g. wcard-123, wcard-456"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Dependencies (one per line)</span>
            <textarea 
              value={dependencies} 
              onChange={(e) => setDependencies(e.target.value)} 
              rows={2}
              className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853] resize-y"
            />
          </label>

          {/* Completion Context Metadata Strip */}
          <div className="bg-black/30 border border-[#7A9E7E]/10 rounded p-3 flex flex-col gap-1.5 font-mono text-[10px] text-gray-400">
            <div className="flex justify-between">
              <span className="uppercase text-gray-500 tracking-wider">Completion Context Source:</span>
              <span className="text-gray-300 font-bold">{validationContext.source || 'No completion context loaded'}</span>
            </div>
            <div className="flex justify-between">
              <span className="uppercase text-gray-500 tracking-wider">Completed Cards:</span>
              <span className="text-gray-300 font-bold">{validationContext.completed_work_card_ids?.length || 0}</span>
            </div>
            {validationContext.generatedAt && (
              <div className="flex justify-between">
                <span className="uppercase text-gray-500 tracking-wider">Snapshot Generated:</span>
                <span className="text-gray-300">{new Date(validationContext.generatedAt).toLocaleString()}</span>
              </div>
            )}
            {isContextStale && (
              <div className="text-[10px] text-gray-500 italic mt-1 border-t border-[#7A9E7E]/10 pt-1.5 leading-relaxed">
                Completion context may be stale. Re-export local ops journal for newer dependency state.
              </div>
            )}
          </div>

          {/* Approval Records Panel */}
          <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold border-b border-white/5 pb-2 mt-2">
            Approval Records
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Reviewed By</span>
              <input 
                type="text" 
                value={reviewedBy} 
                onChange={(e) => setReviewedBy(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
                placeholder="Reviewer ID"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Reviewed At</span>
              <input 
                type="date" 
                value={reviewedAt} 
                onChange={(e) => setReviewedAt(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Authorized By</span>
              <input 
                type="text" 
                value={authorizedBy} 
                onChange={(e) => setAuthorizedBy(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
                placeholder="Authorizer ID"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#b7c9be] font-mono text-[10px] uppercase tracking-wider">Authorized At</span>
              <input 
                type="date" 
                value={authorizedAt} 
                onChange={(e) => setAuthorizedAt(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4A853]"
              />
            </label>
          </div>

          {/* Extensions Panel */}
          <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold border-b border-white/5 pb-2 mt-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>Domain Extensions</span>
          </h4>

          {/* Construction Ext */}
          <div className="border border-[#7A9E7E]/10 bg-black/10 p-3 rounded space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7A9E7E] block">Construction Extension</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Building Code Ref</span>
                <input 
                  type="text" 
                  value={buildingCodeRef} 
                  onChange={(e) => setBuildingCodeRef(e.target.value)} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
              <label className="flex items-center gap-2 mt-4">
                <input 
                  type="checkbox" 
                  checked={structuralInspection} 
                  onChange={(e) => setStructuralInspection(e.target.checked)} 
                  className="rounded border-[#7A9E7E]/20 bg-black/40"
                />
                <span className="text-gray-400 font-mono text-[9px] uppercase">Inspection Required</span>
              </label>
            </div>
          </div>

          {/* Biological Ext */}
          <div className="border border-[#D4A853]/10 bg-black/10 p-3 rounded space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#D4A853] block">Biological Extension</span>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Species</span>
                <input 
                  type="text" 
                  value={species} 
                  onChange={(e) => setSpecies(e.target.value)} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Cultivar</span>
                <input 
                  type="text" 
                  value={cultivar} 
                  onChange={(e) => setCultivar(e.target.value)} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Health Target</span>
                <input 
                  type="text" 
                  value={healthMetricTarget} 
                  onChange={(e) => setHealthMetricTarget(e.target.value)} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
            </div>
          </div>

          {/* Robotic Ext */}
          <div className="border border-[#60A5FA]/10 bg-black/10 p-3 rounded space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#60A5FA] block">Robotic Extension</span>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Command Vocab (comma separated)</span>
                <input 
                  type="text" 
                  value={commandVocabulary} 
                  onChange={(e) => setCommandVocabulary(e.target.value)} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-500 font-mono text-[9px] uppercase">Max Payload (kg)</span>
                <input 
                  type="number" 
                  value={maxPayloadKg} 
                  onChange={(e) => setMaxPayloadKg(Number(e.target.value))} 
                  className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-gray-500 font-mono text-[9px] uppercase">Safe State Mode</span>
              <input 
                type="text" 
                value={safeStateMode} 
                onChange={(e) => setSafeStateMode(e.target.value)} 
                className="bg-black/40 border border-[#7A9E7E]/20 rounded px-2 py-1 text-white font-mono text-xs"
                placeholder="e.g. HOLD_POSITION, AUTO_LAND"
              />
            </label>
          </div>

        </div>

        {/* Live Validation & Preview */}
        <div className="flex flex-col gap-4">
          
          {/* Validator Report Card */}
          <div className={`border rounded-xl p-4 ${validationReport.length > 0 ? 'border-red-900/40 bg-red-950/20' : 'border-[#34D399]/40 bg-[#34D399]/5'}`}>
            <div className="flex items-center justify-between">
              <h4 className="text-white font-mono text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                {validationReport.length > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Validation Fail ({validationReport.length} issue{validationReport.length > 1 ? 's' : ''})</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                    <span className="text-[#34D399]">Contract checks passed</span>
                  </>
                )}
              </h4>
              <span className="text-[10px] text-gray-500 font-mono">PhysicalWorkPackV1</span>
            </div>
            {validationReport.length > 0 ? (
              <ul className="mt-3 space-y-2 border-t border-red-900/20 pt-3">
                {validationReport.map((err, idx) => {
                  const match = err.field.match(/prerequisite_work_card_ids\[(\d+)\]/);
                  const unresolvedId = match && compiledPack?.prerequisite_work_card_ids?.[parseInt(match[1])];
                  return (
                    <li key={idx} className="text-xs text-red-300 flex flex-col gap-0.5 font-mono">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                        <span>
                          <strong>{err.field}</strong>: {err.message}
                        </span>
                      </div>
                      {unresolvedId && (
                        <div className="text-[10px] text-red-400 pl-[22px] font-mono">
                          Unresolved Prerequisite ID: {unresolvedId}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#86efac] font-mono leading-relaxed">
                This draft satisfies the current schema checks. It is not engineering certification or execution authorization.
              </p>
            )}
          </div>

          {/* Manual Operator Approval Gate */}
          <div className={`border rounded-xl p-4 flex flex-col gap-3 ${isOperatorApproved ? 'border-[#7A9E7E]/30 bg-[#7A9E7E]/5' : 'border-[#D4A853]/30 bg-[#D4A853]/5'}`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="isOperatorApprovedCheck"
                checked={isOperatorApproved}
                onChange={(e) => setIsOperatorApproved(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#7A9E7E]/20 bg-black/40 text-[#7A9E7E] focus:ring-[#7A9E7E]"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="isOperatorApprovedCheck" className="text-white font-bold text-xs cursor-pointer select-none">
                  Confirm Operator Approval Gate (isOperatorApproved)
                </label>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  By checking this box, the steward confirms manual operator verification of constraints, dependencies, and stop conditions. Downloads are disabled without this active approval check.
                </p>
              </div>
            </div>
            {!isOperatorApproved && (
              <div className="border border-red-900/40 bg-red-950/20 px-3 py-2 rounded text-red-300 text-[10px] font-mono flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>Export locked: Manual operator approval gate ('isOperatorApproved') must be checked to enable exports.</span>
              </div>
            )}
          </div>

          {/* Preview Tab Panel */}
          <div className="border border-white/10 bg-black/40 rounded-xl overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="bg-black/35 px-4 py-2 border-b border-b-white/10 flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setPreviewTab('md')}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest font-mono border transition-all ${previewTab === 'md' ? 'border-[#7A9E7E] text-[#7A9E7E] bg-[#7A9E7E]/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  Field Brief (Markdown)
                </button>
                <button 
                  type="button" 
                  onClick={() => setPreviewTab('json')}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-widest font-mono border transition-all ${previewTab === 'json' ? 'border-[#D4A853] text-[#D4A853] bg-[#D4A853]/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  Schema JSON
                </button>
              </div>
              
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={downloadMarkdown}
                  disabled={validationReport.length > 0 || !isOperatorApproved}
                  className={`flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#7A9E7E] border border-[#7A9E7E]/30 px-2 py-1 rounded transition-colors ${validationReport.length > 0 || !isOperatorApproved ? 'opacity-30 cursor-not-allowed border-gray-700 text-gray-500' : 'hover:bg-[#7A9E7E]/20'}`}
                >
                  <Download className="w-3 h-3" /> Brief
                </button>
                <button 
                  type="button" 
                  onClick={downloadJson}
                  disabled={validationReport.length > 0 || !isOperatorApproved}
                  className={`flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#D4A853] border border-[#D4A853]/30 px-2 py-1 rounded transition-colors ${validationReport.length > 0 || !isOperatorApproved ? 'opacity-30 cursor-not-allowed border-gray-700 text-gray-500' : 'hover:bg-[#D4A853]/20'}`}
                >
                  <Download className="w-3 h-3" /> JSON
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto max-h-[600px] font-mono text-[11px] leading-relaxed select-all flex flex-col justify-center">
              {!compiledPack ? (
                <div className="flex flex-col items-center justify-center text-center p-8 gap-3 my-auto">
                  <AlertTriangle className="w-8 h-8 text-[#D4A853] animate-pulse" />
                  <div className="font-bold text-xs uppercase tracking-wider text-[#D4A853]">[MANUAL_CONFIRMATION_REQUIRED]</div>
                  <div className="text-gray-400 max-w-sm text-[10px]">
                    You must check the 'Confirm Operator Approval Gate' box above to compile, validate, and preview the Operational Work Card.
                  </div>
                </div>
              ) : previewTab === 'md' ? (
                <pre className="text-gray-300 whitespace-pre-wrap font-mono select-text">
                  {compileWorkPackMarkdown(compiledPack)}
                </pre>
              ) : (
                <pre className="text-[#b89c82] whitespace-pre font-mono select-text">
                  {JSON.stringify(compiledPack, null, 2)}
                </pre>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
