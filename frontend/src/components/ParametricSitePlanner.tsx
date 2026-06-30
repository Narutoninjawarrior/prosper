import { useEffect, useMemo, useState } from 'react'
import { validateSitePlan, ConstraintStatusBlock } from '../lib/constraintValidator'
import { Factory, Home, Leaf, Waves } from 'lucide-react'

type PlannerTab = 'geometry' | 'sequence' | 'manifest'
type ModuleType = 'housing_print' | 'earthbag_wall' | 'aquaponics_bed' | 'water_channel'

type SitePlannerPayload = {
  schema: 'site-plan-v1'
  planning_mode: 'local_session'
  module: {
    id: string
    type: ModuleType
    material: string
    length_m: number
    width_m: number
    layer_count: number
    zone: {
      x_m: number
      z_m: number
    }
  }
  geometry: {
    type: 'Feature'
    id: string
    geometry: {
      type: 'Polygon'
      coordinates: number[][][]
    }
    properties: {
      material: string
      layer_count: number
      footprint_sqm: number
      perimeter_m: number
      planning_mode: 'local_session'
    }
  }
  work_orders: Array<{
    order_id: string
    stage: string
    status: 'PENDING'
    summary: string
    depends_on?: string
  }>
  export_targets: string[]
}

type PlannerIntake = {
  source?: string
  nodeId?: string
  title?: string
  kind?: string
  summary?: string
}

const MODULE_OPTIONS: Array<{
  id: ModuleType
  label: string
  icon: typeof Home
  material: string
  defaultLength: number
  defaultWidth: number
  defaultLayers: number
}> = [
  { id: 'housing_print', label: '3D Printed Habitat', icon: Home, material: 'stabilized_earth', defaultLength: 6, defaultWidth: 4, defaultLayers: 120 },
  { id: 'earthbag_wall', label: 'Earthbag Retaining Wall', icon: Factory, material: 'earthbag_fill', defaultLength: 12, defaultWidth: 1.5, defaultLayers: 24 },
  { id: 'aquaponics_bed', label: 'Aquaponics Bed', icon: Leaf, material: 'food_safe_liner', defaultLength: 4, defaultWidth: 2, defaultLayers: 8 },
  { id: 'water_channel', label: 'Irrigation Run', icon: Waves, material: 'packed_clay', defaultLength: 20, defaultWidth: 1.5, defaultLayers: 4 },
]

function buildWorkOrders(moduleId: string, type: ModuleType): SitePlannerPayload['work_orders'] {
  const stepsByType: Record<ModuleType, string[]> = {
    housing_print: ['site_layout', 'foundation_prep', 'wall_extrusion', 'service_stub_review'],
    earthbag_wall: ['site_layout', 'bag_fill', 'course_stack', 'stability_review'],
    aquaponics_bed: ['site_layout', 'bed_frame', 'water_loop_check', 'crop_readiness_review'],
    water_channel: ['site_layout', 'grade_cut', 'flow_lining', 'flow_test'],
  }

  return stepsByType[type].map((stage, index) => ({
    order_id: `${moduleId}-${stage}`,
    stage: stage.toUpperCase(),
    status: 'PENDING',
    summary: stage.replaceAll('_', ' '),
    ...(index > 0 ? { depends_on: `${moduleId}-${stepsByType[type][index - 1]}` } : {}),
  }))
}

function buildPayload(input: {
  id: string
  type: ModuleType
  material: string
  length: number
  width: number
  layers: number
  zoneX: number
  zoneZ: number
}): SitePlannerPayload {
  const halfL = input.length / 2
  const halfW = input.width / 2
  const footprint = Number((input.length * input.width).toFixed(2))
  const perimeter = Number((2 * (input.length + input.width)).toFixed(2))

  const polygon = [
    [Number((input.zoneX - halfL).toFixed(2)), Number((input.zoneZ - halfW).toFixed(2))],
    [Number((input.zoneX + halfL).toFixed(2)), Number((input.zoneZ - halfW).toFixed(2))],
    [Number((input.zoneX + halfL).toFixed(2)), Number((input.zoneZ + halfW).toFixed(2))],
    [Number((input.zoneX - halfL).toFixed(2)), Number((input.zoneZ + halfW).toFixed(2))],
    [Number((input.zoneX - halfL).toFixed(2)), Number((input.zoneZ - halfW).toFixed(2))],
  ]

  return {
    schema: 'site-plan-v1',
    planning_mode: 'local_session',
    module: {
      id: input.id,
      type: input.type,
      material: input.material,
      length_m: input.length,
      width_m: input.width,
      layer_count: input.layers,
      zone: {
        x_m: input.zoneX,
        z_m: input.zoneZ,
      },
    },
    geometry: {
      type: 'Feature',
      id: input.id,
      geometry: {
        type: 'Polygon',
        coordinates: [polygon],
      },
      properties: {
        material: input.material,
        layer_count: input.layers,
        footprint_sqm: footprint,
        perimeter_m: perimeter,
        planning_mode: 'local_session',
      },
    },
    work_orders: buildWorkOrders(input.id, input.type),
    export_targets: ['geojson', 'task_manifest', 'cad_bridge'],
  }
}

export default function ParametricSitePlanner({
  onValidate,
  onUpdate,
  initialIntake,
}: {
  onUpdate: (payload: SitePlannerPayload) => void
  onValidate?: (report: any) => void
  initialIntake?: PlannerIntake | null
}) {
  const [activeTab, setActiveTab] = useState<PlannerTab>('geometry')
  const [moduleId, setModuleId] = useState('habitat_a01')
  const [moduleType, setModuleType] = useState<ModuleType>('housing_print')
  const [lengthM, setLengthM] = useState(6)
  const [widthM, setWidthM] = useState(4)
  const [layerCount, setLayerCount] = useState(120)
  const [zoneX, setZoneX] = useState(0)
  const [zoneZ, setZoneZ] = useState(0)
  const [material, setMaterial] = useState('stabilized_earth')
  const [appliedIntakeKey, setAppliedIntakeKey] = useState<string | null>(null)

  const selectedModule = useMemo(
    () => MODULE_OPTIONS.find((option) => option.id === moduleType) ?? MODULE_OPTIONS[0],
    [moduleType],
  )

  const payload = useMemo(
    () =>
      buildPayload({
        id: moduleId,
        type: moduleType,
        material,
        length: lengthM,
        width: widthM,
        layers: layerCount,
        zoneX,
        zoneZ,
      }),
    [layerCount, lengthM, material, moduleId, moduleType, widthM, zoneX, zoneZ],
  )

  const report = useMemo(() => validateSitePlan(payload), [payload])

  useEffect(() => {
    onUpdate(payload)
    if (onValidate) onValidate(report)
  }, [onUpdate, onValidate, payload, report])

  useEffect(() => {
    if (!initialIntake) return
    const key = JSON.stringify(initialIntake)
    if (appliedIntakeKey === key) return

    const normalizedId = initialIntake.nodeId?.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    const nextType: ModuleType =
      initialIntake.kind === 'farm_zone'
        ? 'aquaponics_bed'
        : initialIntake.kind === 'build_node'
          ? 'housing_print'
          : moduleType

    const option = MODULE_OPTIONS.find((entry) => entry.id === nextType) ?? selectedModule

    if (normalizedId) setModuleId(normalizedId)
    setModuleType(nextType)
    setMaterial(option.material)
    setLengthM(option.defaultLength)
    setWidthM(option.defaultWidth)
    setLayerCount(option.defaultLayers)
    setAppliedIntakeKey(key)
  }, [appliedIntakeKey, initialIntake, moduleType, selectedModule])

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[#60A5FA]/20 bg-[#60A5FA]/6 p-4 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#60A5FA]">Parametric Site Planner</div>
            <div className="mt-1 text-sm text-[#dbeafe]">
              Local-first geometry + sequencing for habitat, water, and growing modules.
            </div>
          </div>
          <div className="rounded-full border border-[#D4A853]/25 bg-[#D4A853]/10 px-3 py-1 text-[9px] uppercase tracking-widest text-[#D4A853]">
            Local session only
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#b7c9be]">
          This planner exports structured coordinates and work-order manifests for later use in CAD, GIS,
          robot tooling, or field runbooks. It does not control machines directly and does not write to the backend.
        </p>
      </div>

      <ConstraintStatusBlock report={report} />

      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        {[
          { id: 'geometry', label: '1. Geometry' },
          { id: 'sequence', label: '2. Sequence' },
          { id: 'manifest', label: '3. Mirror' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as PlannerTab)}
            className="rounded-full px-3 py-1.5 transition-all"
            style={{
              border: activeTab === tab.id ? '1px solid rgba(96,165,250,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === tab.id ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab.id ? '#DBEAFE' : '#8E7E6B',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'geometry' && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 font-mono text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Module ID</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value || 'module')}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Material</span>
                <input
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value || selectedModule.material)}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Module type</span>
                <div className="grid gap-2">
                  {MODULE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    const active = option.id === moduleType
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setModuleType(option.id)
                          setMaterial(option.material)
                          setLengthM(option.defaultLength)
                          setWidthM(option.defaultWidth)
                          setLayerCount(option.defaultLayers)
                        }}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all"
                        style={{
                          borderColor: active ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.08)',
                          background: active ? 'rgba(96,165,250,0.10)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <Icon size={14} className={active ? 'text-[#60A5FA]' : 'text-[#8a7a64]'} />
                        <div>
                          <div className="text-xs text-[#FAF6EF]">{option.label}</div>
                          <div className="text-[10px] text-[#8a7a64]">{option.material}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-black/30 p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">Footprint preview</div>
                <div className="mt-4 grid place-items-center">
                  <div className="relative h-40 w-40 rounded-xl border border-dashed border-[#3b4b63] bg-[#0a0604]">
                    <div
                      className="absolute left-1/2 top-1/2 border border-[#60A5FA]/60 bg-[#60A5FA]/12"
                      style={{
                        width: `${Math.min(120, lengthM * 14)}px`,
                        height: `${Math.min(120, widthM * 14)}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                    <div className="absolute bottom-2 right-2 text-[9px] text-[#5E5143]">local grid</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-[11px] text-[#c9bba5]">
                  <div className="flex items-center justify-between">
                    <span>footprint</span>
                    <span>{payload.geometry.properties.footprint_sqm} sqm</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>perimeter</span>
                    <span>{payload.geometry.properties.perimeter_m} m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>zone</span>
                    <span>{zoneX}m, {zoneZ}m</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#8a7a64]">
                  <span>Length</span>
                  <span>{lengthM.toFixed(1)} m</span>
                </span>
                <input type="range" min={2} max={20} step={0.5} value={lengthM} onChange={(e) => setLengthM(Number(e.target.value))} />
              </label>
              <label className="grid gap-1">
                <span className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#8a7a64]">
                  <span>Width</span>
                  <span>{widthM.toFixed(1)} m</span>
                </span>
                <input type="range" min={1.5} max={12} step={0.5} value={widthM} onChange={(e) => setWidthM(Number(e.target.value))} />
              </label>
              <label className="grid gap-1">
                <span className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#8a7a64]">
                  <span>Layer count</span>
                  <span>{layerCount}</span>
                </span>
                <input type="range" min={8} max={240} step={4} value={layerCount} onChange={(e) => setLayerCount(Number(e.target.value))} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Zone X</span>
                  <input
                    type="number"
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                    value={zoneX}
                    onChange={(e) => setZoneX(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Zone Z</span>
                  <input
                    type="number"
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]"
                    value={zoneZ}
                    onChange={(e) => setZoneZ(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sequence' && (
        <div className="grid gap-3">
          <div className="rounded-[18px] border border-white/8 bg-black/25 p-4 font-mono text-[11px] text-[#c9bba5]">
            These are planning-stage work orders only. They describe a safe execution order for operators,
            bots, or later machine bridges. No command is issued from this browser view.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {payload.work_orders.map((item, index) => (
              <div key={item.order_id} className="rounded-[18px] border border-white/8 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#60A5FA]">
                    Step {index + 1}
                  </div>
                  <div className="rounded-full border border-[#D4A853]/20 bg-[#D4A853]/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-[#D4A853]">
                    {item.status}
                  </div>
                </div>
                <div className="mt-2 text-sm text-[#FAF6EF]">{item.stage}</div>
                <div className="mt-1 text-[11px] text-[#b7c9be]">{item.summary}</div>
                {item.depends_on && (
                  <div className="mt-3 text-[10px] text-[#8a7a64]">
                    depends on <code>{item.depends_on}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'manifest' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-black/30 p-4 font-mono text-[11px] leading-5 text-[#c9bba5]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Human interpretation</div>
            <p>
              This is a site plan draft for a <strong>{payload.module.type.replace('_', ' ')}</strong> structure measuring {payload.module.length_m}m by {payload.module.width_m}m.
            </p>
            <p>
              It is composed of {payload.module.material.replace('_', ' ')} and stacked {payload.module.layer_count} layers high.
            </p>
            {report.level === 'hard_fail' ? (
              <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 p-3 text-[#fca5a5]">
                <strong>Constraint Failure:</strong> This draft is invalid and should not be pushed to Commons.
              </div>
            ) : report.level === 'warning' ? (
              <div className="rounded-lg border border-[#FBBF24]/20 bg-[#FBBF24]/10 p-3 text-[#fde68a]">
                <strong>Constrained Draft:</strong> This plan exceeds standard limits and requires local review.
              </div>
            ) : (
              <div className="rounded-lg border border-[#34D399]/20 bg-[#34D399]/10 p-3 text-[#9fd4a8]">
                <strong>Verified:</strong> This draft appears within normal local bounds.
              </div>
            )}
            <div className="mt-auto border-t border-white/10 pt-3 text-[10px]">
              <strong>Handoff:</strong> Export this payload to push into the public archive or pass to robotic fabrication nodes.
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-[#0a0806]/90 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#60A5FA]">Machine payload</div>
            <pre className="max-h-[300px] overflow-auto font-mono text-[11px] leading-relaxed text-[#bcd5f6]">
{JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}


