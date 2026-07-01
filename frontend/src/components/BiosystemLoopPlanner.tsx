import { useEffect, useMemo, useState } from 'react'
import type { ValidationReport } from '../lib/constraintValidator'
import type { BotArtifactManifest } from '../lib/worldArtifactContract'

export type BiosystemNodeType = 'RESERVOIR' | 'PUMP' | 'GROW_BED' | 'RETURN_LINE' | 'SENSOR'

export interface BiosystemNode {
  id: string
  type: BiosystemNodeType
  properties: {
    capacityGallons?: number
    flowRateGpm?: number
    targetPh?: number
    monitoredMetric?: 'PH' | 'LEVEL' | 'FLOW'
  }
  edges: string[]
}

export interface BiosystemLoopManifest {
  manifestId: string
  roomRegistryId: string
  title: string
  targetPh: number
  reservoirCapacityGallons: number
  pumpFlowRateGpm: number
  returnPathEnabled: boolean
  sensorEnabled: boolean
  nodes: Record<string, BiosystemNode>
  updatedAt: string
}

function buildBiosystemArtifact(manifest: BiosystemLoopManifest, loopStatusText: string): BotArtifactManifest {
  return {
    id: 'biosystem-loop-preview',
    title: manifest.title,
    artifact_family: 'biosystem_loop',
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    geometry_recipe: {
      primitive_type: 'extruded_span',
      dimensions: [
        Math.max(2.5, Math.min(6, manifest.reservoirCapacityGallons / 120)),
        1.2,
        0.45,
      ],
    },
    material_profile: {
      preset_family: 'BIOFILM_MOSS',
      roughness: 0.7,
      metalness: 0.15,
      emissive_intensity: 0.2,
      color_hex: '#4A90D9',
    },
    provenance_metadata: {
      author_type: 'human',
      author_id: 'operator',
      source_ref: manifest.manifestId,
      created_at: new Date().toISOString(),
      note: 'Local planning artifact from Biosystem Loop Planner. Not a real biosystem.',
    },
    planner_context: {
      origin: 'Biosystem Loop Planner',
      loop_status: loopStatusText,
      target_ph: manifest.targetPh,
      reservoir_capacity_gallons: manifest.reservoirCapacityGallons,
      pump_flow_rate_gpm: manifest.pumpFlowRateGpm,
      sensor_present: manifest.sensorEnabled,
      return_path_present: manifest.returnPathEnabled,
      node_count: Object.keys(manifest.nodes).length,
    },
  }
}

interface BiosystemLoopPlannerProps {
  onUpdate?: (payload: BiosystemLoopManifest | null) => void
  onValidate?: (report: ValidationReport) => void
}

function buildLoopManifest(state: {
  title: string
  targetPh: number
  reservoirCapacityGallons: number
  pumpFlowRateGpm: number
  returnPathEnabled: boolean
  sensorEnabled: boolean
}): BiosystemLoopManifest {
  const nodes: Record<string, BiosystemNode> = {
    reservoir_01: {
      id: 'reservoir_01',
      type: 'RESERVOIR',
      properties: {
        capacityGallons: state.reservoirCapacityGallons,
        targetPh: state.targetPh,
      },
      edges: ['pump_01'],
    },
    pump_01: {
      id: 'pump_01',
      type: 'PUMP',
      properties: {
        flowRateGpm: state.pumpFlowRateGpm,
      },
      edges: ['grow_bed_01'],
    },
    grow_bed_01: {
      id: 'grow_bed_01',
      type: 'GROW_BED',
      properties: {
        targetPh: state.targetPh,
      },
      edges: state.sensorEnabled
        ? ['sensor_01']
        : state.returnPathEnabled
          ? ['return_line_01']
          : [],
    },
  }

  if (state.sensorEnabled) {
    nodes.sensor_01 = {
      id: 'sensor_01',
      type: 'SENSOR',
      properties: {
        monitoredMetric: 'PH',
      },
      edges: state.returnPathEnabled ? ['return_line_01'] : [],
    }
  }

  if (state.returnPathEnabled) {
    nodes.return_line_01 = {
      id: 'return_line_01',
      type: 'RETURN_LINE',
      properties: {},
      edges: ['reservoir_01'],
    }
  }

  return {
    manifestId: 'biosystem-loop-mvp',
    roomRegistryId: 'local-workbench-biosystem',
    title: state.title,
    targetPh: state.targetPh,
    reservoirCapacityGallons: state.reservoirCapacityGallons,
    pumpFlowRateGpm: state.pumpFlowRateGpm,
    returnPathEnabled: state.returnPathEnabled,
    sensorEnabled: state.sensorEnabled,
    nodes,
    updatedAt: new Date().toISOString(),
  }
}

export default function BiosystemLoopPlanner({
  onUpdate,
  onValidate,
}: BiosystemLoopPlannerProps) {
  const [title, setTitle] = useState('Aquaculture Loop Draft')
  const [targetPh, setTargetPh] = useState(6.9)
  const [reservoirCapacityGallons, setReservoirCapacityGallons] = useState(500)
  const [pumpFlowRateGpm, setPumpFlowRateGpm] = useState(12)
  const [returnPathEnabled, setReturnPathEnabled] = useState(true)
  const [sensorEnabled, setSensorEnabled] = useState(true)

  const manifest = useMemo(
    () =>
      buildLoopManifest({
        title,
        targetPh,
        reservoirCapacityGallons,
        pumpFlowRateGpm,
        returnPathEnabled,
        sensorEnabled,
      }),
    [title, targetPh, reservoirCapacityGallons, pumpFlowRateGpm, returnPathEnabled, sensorEnabled]
  )

  const report = useMemo<ValidationReport>(() => {
    const results: ValidationReport['results'] = []

    if (!returnPathEnabled) {
      results.push({ level: 'warning', message: 'Return path is missing. Fluid loop does not resolve back to the reservoir.' })
    }

    if (!sensorEnabled) {
      results.push({ level: 'warning', message: 'Critical pH sensor is not present on the loop.' })
    }

    if (targetPh < 6.5 || targetPh > 7.8) {
      results.push({ level: 'warning', message: `Target pH ${targetPh.toFixed(1)} is outside the recommended 6.5 to 7.8 band.` })
    }

    if (targetPh > 8.5 || targetPh < 4.6) {
      results.push({ level: 'hard_fail', message: `Target pH ${targetPh.toFixed(1)} exceeds the fail-closed safety boundary for this draft.` })
    }

    if (pumpFlowRateGpm > reservoirCapacityGallons / 20) {
      results.push({ level: 'warning', message: 'Pump flow rate may overload the current reservoir volume estimate.' })
    }

    const hasHardFail = results.some((item) => item.level === 'hard_fail')
    const hasWarning = results.some((item) => item.level === 'warning')

    return {
      isValid: !hasHardFail,
      level: hasHardFail ? 'hard_fail' : hasWarning ? 'warning' : 'ok',
      results,
    }
  }, [pumpFlowRateGpm, reservoirCapacityGallons, returnPathEnabled, sensorEnabled, targetPh])

  const loopStatus = useMemo(() => {
    if (targetPh > 8.5 || targetPh < 4.6) {
      return { text: "Loop status: BLOCKED — pH exceeds fail-closed safety boundary", color: "#ef4444" }
    }
    if (targetPh < 6.5 || targetPh > 7.8) {
      return { text: "Loop status: WARNING — pH outside recommended band", color: "#f59e0b" }
    }
    if (pumpFlowRateGpm > reservoirCapacityGallons / 20) {
      return { text: "Loop status: WARNING — pump flow rate may overload reservoir", color: "#f59e0b" }
    }
    if (!sensorEnabled && !returnPathEnabled) {
      return { text: "Loop status: INCOMPLETE — missing sensor and return path", color: "#6b7280" }
    }
    if (!returnPathEnabled) {
      return { text: "Loop status: INCOMPLETE — missing return path", color: "#6b7280" }
    }
    if (!sensorEnabled) {
      return { text: "Loop status: INCOMPLETE — missing sensor", color: "#6b7280" }
    }
    return { text: "Loop status: COMPLETE — all configured components present", color: "#10b981" }
  }, [targetPh, pumpFlowRateGpm, reservoirCapacityGallons, sensorEnabled, returnPathEnabled])

  const exportManifest = useMemo(() => ({
    _meta: {
      boundary: "local draft / planning aid only",
      simulation: "none",
      control_authority: "operator_only",
      export_type: "biosystem_loop_manifest"
    },
    ...manifest
  }), [manifest]);

  useEffect(() => {
    onUpdate?.(manifest)
    onValidate?.(report)
  }, [manifest, onUpdate, onValidate, report])

  const placeInForge = () => {
    const artifact = buildBiosystemArtifact(manifest, loopStatus.text)
    try {
      const stored = sessionStorage.getItem('prosper:local_artifacts')
      const existing = stored ? JSON.parse(stored) : []
      const next = [artifact, ...existing.filter((item: BotArtifactManifest) => item.id !== artifact.id)]
      sessionStorage.setItem('prosper:local_artifacts', JSON.stringify(next))
      window.location.href = `/forge?artifact=${encodeURIComponent(artifact.id)}`
    } catch (error) {
      console.error('Failed to place biosystem artifact in forge', error)
    }
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="rounded-lg border border-[#4A90D9]/20 bg-[#4A90D9]/5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#8fb5dd]">Local biosystem mirror</div>
            <h3 className="mt-1 text-lg font-semibold text-white">Biosystem Loop Planner</h3>
            <p className="mt-1 text-xs text-gray-400">
              Browser-local dependency planning for reservoirs, pumps, grow beds, sensors, and return paths.
            </p>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold border border-gray-600/30 px-2 py-1 rounded bg-black/20">
            Local loop planning only. No live fluid simulation. No autonomous control.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#2A1F16] bg-[#0A0604] p-4">
          <div className="mb-4 flex items-center justify-between border-b border-[#2A1F16] pb-3">
            <div className="text-[11px] uppercase tracking-widest text-[#E8842A]">Operator brief</div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500">Human-readable</div>
          </div>

          <div className="mb-5 rounded border border-[#2A1F16] bg-black/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[9px] uppercase tracking-widest text-gray-500">Loop Schematic</div>
              <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: loopStatus.color }}>
                {loopStatus.text}
              </div>
            </div>
            <svg width="100%" height="40" viewBox="0 0 500 40" xmlns="http://www.w3.org/2000/svg" className="block max-w-full overflow-visible">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563" />
                </marker>
                <marker id="arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                </marker>
              </defs>

              {/* RES */}
              <rect x="0" y="5" width="55" height="30" rx="4" fill="#4A90D91A" stroke="#4A90D9" />
              <text x="27.5" y="24" fill="#4A90D9" fontSize="10" fontFamily="monospace" textAnchor="middle">RES</text>
              <path d="M 55 20 L 85 20" stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />

              {/* PMP */}
              <rect x="85" y="5" width="55" height="30" rx="4" fill="#E8842A1A" stroke="#E8842A" />
              <text x="112.5" y="24" fill="#E8842A" fontSize="10" fontFamily="monospace" textAnchor="middle">PUMP</text>
              <path d="M 140 20 L 170 20" stroke="#4b5563" strokeWidth="1.5" markerEnd="url(#arrow)" />

              {/* BED */}
              <rect x="170" y="5" width="55" height="30" rx="4" fill="#34D3991A" stroke="#34D399" />
              <text x="197.5" y="24" fill="#34D399" fontSize="10" fontFamily="monospace" textAnchor="middle">BED</text>
              <path d="M 225 20 L 255 20" stroke={sensorEnabled || returnPathEnabled ? "#4b5563" : "#374151"} strokeWidth="1.5" markerEnd={sensorEnabled || returnPathEnabled ? "url(#arrow)" : "url(#arrow-dim)"} />

              {/* SNS */}
              <rect x="255" y="5" width="55" height="30" rx="4" fill={sensorEnabled ? "#FBBF241A" : "#1f293780"} stroke={sensorEnabled ? "#FBBF24" : "#374151"} />
              <text x="282.5" y="24" fill={sensorEnabled ? "#FBBF24" : "#4b5563"} fontSize="10" fontFamily="monospace" textAnchor="middle">SENS</text>
              <path d="M 310 20 L 340 20" stroke={returnPathEnabled ? "#4b5563" : "#374151"} strokeWidth="1.5" markerEnd={returnPathEnabled ? "url(#arrow)" : "url(#arrow-dim)"} />

              {/* RET */}
              <rect x="340" y="5" width="55" height="30" rx="4" fill={returnPathEnabled ? "#4A90D91A" : "#1f293780"} stroke={returnPathEnabled ? "#4A90D9" : "#374151"} />
              <text x="367.5" y="24" fill={returnPathEnabled ? "#4A90D9" : "#4b5563"} fontSize="10" fontFamily="monospace" textAnchor="middle">RET</text>
              <path d="M 395 20 L 425 20" stroke={returnPathEnabled ? "#4b5563" : "#374151"} strokeWidth="1.5" strokeDasharray={!returnPathEnabled ? "2,2" : ""} markerEnd={returnPathEnabled ? "url(#arrow)" : "url(#arrow-dim)"} />

              {/* RES (LOOP) */}
              <rect x="425" y="5" width="40" height="30" rx="4" fill="#4A90D90A" stroke="#4A90D980" />
              <text x="445" y="24" fill="#4A90D980" fontSize="10" fontFamily="monospace" textAnchor="middle">RES</text>
            </svg>
          </div>

          <div className="grid gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#b7c9be]">Loop title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded border border-[#3D2C1E] bg-black/40 px-3 py-2 text-xs text-white focus:border-[#E8842A] focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest text-[#b7c9be]">
                Target pH: <span className="text-[#4A90D9]">{targetPh.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min="4"
                max="9"
                step="0.1"
                value={targetPh}
                onChange={(e) => setTargetPh(Number(e.target.value))}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#b7c9be]">Reservoir capacity (gal)</span>
                <input
                  type="number"
                  min="50"
                  value={reservoirCapacityGallons}
                  onChange={(e) => setReservoirCapacityGallons(Number(e.target.value))}
                  className="rounded border border-[#3D2C1E] bg-black/40 px-3 py-2 text-xs text-white focus:border-[#4A90D9] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#b7c9be]">Pump flow (gpm)</span>
                <input
                  type="number"
                  min="1"
                  value={pumpFlowRateGpm}
                  onChange={(e) => setPumpFlowRateGpm(Number(e.target.value))}
                  className="rounded border border-[#3D2C1E] bg-black/40 px-3 py-2 text-xs text-white focus:border-[#4A90D9] focus:outline-none"
                />
              </label>
            </div>

            <div className="grid gap-2 text-xs text-gray-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={returnPathEnabled} onChange={(e) => setReturnPathEnabled(e.target.checked)} />
                Return path closes the loop back to reservoir
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sensorEnabled} onChange={(e) => setSensorEnabled(e.target.checked)} />
                pH sensor is present on the loop
              </label>
            </div>

            <div className="rounded border border-[#2A1F16] bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Operational summary</div>
              <ul className="mt-2 grid gap-1 text-xs text-gray-300">
                <li>Reservoir feeds one pump and one grow bed chain.</li>
                <li>Current node count: {Object.keys(manifest.nodes).length}</li>
                <li>Safety boundary: pH must stay within a declared operator band.</li>
              </ul>
            </div>

            <button
              onClick={placeInForge}
              className="rounded border border-[#4A90D9]/30 bg-[#4A90D9]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[#8fb5dd] transition-colors hover:bg-[#4A90D9]/20 hover:text-white"
            >
              Place in Forge for inspection. Not live execution.
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[#1A1A1A] bg-[#050302] p-4">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#1A1A1A] pb-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-[11px] uppercase tracking-widest text-[#34D399]">Dispatch Export</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(exportManifest, null, 2))
                    .then(() => alert('Manifest copied to clipboard'))
                    .catch(err => console.error('Failed to copy', err));
                }}
                className="rounded border border-[#34D399]/30 bg-[#34D399]/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-[#34D399] transition-colors hover:bg-[#34D399]/20"
              >
                Copy JSON
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(exportManifest, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `biosystem_manifest_${new Date().getTime()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="rounded border border-gray-700 bg-[#1A1A1A] px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                Download Manifest.json
              </button>
              <button
                onClick={() => {
                  const diagnostics = report.results.length > 0 
                    ? report.results.map(r => `- [${r.level.toUpperCase()}] ${r.message}`).join('\n')
                    : '- None';

                  const summary = `# ${manifest.title}

## Status
${loopStatus.text}

## Configuration
- Target pH: ${manifest.targetPh}
- Reservoir Capacity: ${manifest.reservoirCapacityGallons} gal
- Pump Flow Rate: ${manifest.pumpFlowRateGpm} gpm
- Sensor: ${sensorEnabled ? 'Present' : 'Missing'}
- Return Path: ${returnPathEnabled ? 'Present' : 'Missing'}
- Node Count: ${Object.keys(manifest.nodes).length}

## Diagnostics
${diagnostics}

> Local planning aid only. No live fluid simulation. No autonomous control.
`;
                  const blob = new Blob([summary], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `biosystem_summary_${new Date().getTime()}.md`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="rounded border border-gray-700 bg-[#1A1A1A] px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              >
                Download Summary.md
              </button>
            </div>
          </div>
          <pre className="max-h-[520px] overflow-y-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-gray-400">
            {JSON.stringify(exportManifest, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
