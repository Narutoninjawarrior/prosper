import { useEffect, useMemo, useState } from 'react'
import { BatteryCharging, Move3d, Radar, Wrench } from 'lucide-react'
import { validateAllonic, ConstraintStatusBlock } from '../lib/constraintValidator'

type BuildPhase = 'modules' | 'diagnostics' | 'export'
type ModuleClass = 'locomotion' | 'actuator' | 'energy' | 'sensory'

type RobotModule = {
  id: string
  name: string
  type: ModuleClass
  massKg: number
  powerDrawWatts: number
  role: string
}

type AllonicBlueprintPayload = {
  schema: 'allonic-blueprint-v1'
  planning_mode: 'local_session'
  blueprint: {
    id: string
    name: string
    intended_use: string
  }
  summary: {
    module_count: number
    total_mass_kg: number
    net_power_draw_watts: number
    balance_status: 'nominal' | 'energy_deficit' | 'overweight'
  }
  modules: Array<{
    id: string
    name: string
    type: ModuleClass
    mass_kg: number
    power_draw_watts: number
    role: string
  }>
  work_orders: Array<{
    order_id: string
    stage: string
    status: 'PENDING'
    summary: string
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

const MODULE_LIBRARY: RobotModule[] = [
  { id: 'tread_base', name: 'Tracked Base', type: 'locomotion', massKg: 12.5, powerDrawWatts: 45, role: 'terrain movement' },
  { id: 'clay_extruder', name: 'Clay Extruder Head', type: 'actuator', massKg: 4.2, powerDrawWatts: 60, role: 'printed earth deposition' },
  { id: 'bag_arm', name: 'Earthbag Placement Arm', type: 'actuator', massKg: 8.0, powerDrawWatts: 35, role: 'bag placement and lift assist' },
  { id: 'solar_canopy', name: 'Solar Canopy', type: 'energy', massKg: 3.5, powerDrawWatts: -80, role: 'field charging support' },
  { id: 'lidar_node', name: 'LiDAR Node', type: 'sensory', massKg: 0.8, powerDrawWatts: 12, role: 'mapping and obstacle awareness' },
  { id: 'pump_module', name: 'Pump Module', type: 'actuator', massKg: 5.1, powerDrawWatts: 28, role: 'water movement and irrigation feed' },
]

const MODULE_ICONS: Record<ModuleClass, typeof Move3d> = {
  locomotion: Move3d,
  actuator: Wrench,
  energy: BatteryCharging,
  sensory: Radar,
}

function buildWorkOrders(id: string, intendedUse: string) {
  return [
    { order_id: `${id}-config-review`, stage: 'CONFIG_REVIEW', status: 'PENDING' as const, summary: 'confirm intended module combination and field role' },
    { order_id: `${id}-power-check`, stage: 'POWER_CHECK', status: 'PENDING' as const, summary: 'review energy draw against support modules' },
    { order_id: `${id}-fit-check`, stage: 'FIT_CHECK', status: 'PENDING' as const, summary: `validate ${intendedUse.toLowerCase()} configuration before fabrication/export` },
  ]
}

export default function AllonicSchemaAssembler({
  onValidate,
  onUpdate,
  initialIntake,
}: {
  onUpdate: (payload: AllonicBlueprintPayload) => void
  onValidate?: (report: any) => void
  initialIntake?: PlannerIntake | null
}) {
  const [activePhase, setActivePhase] = useState<BuildPhase>('modules')
  const [blueprintId, setBlueprintId] = useState('allonic_a01')
  const [blueprintName, setBlueprintName] = useState('Earthworks Helper')
  const [intendedUse, setIntendedUse] = useState('terrain prep and printed-earth support')
  const [selectedIds, setSelectedIds] = useState<string[]>(['tread_base', 'solar_canopy', 'lidar_node'])
  const [appliedIntakeKey, setAppliedIntakeKey] = useState<string | null>(null)

  const activeModules = useMemo(
    () => selectedIds.map((id) => MODULE_LIBRARY.find((module) => module.id === id)).filter(Boolean) as RobotModule[],
    [selectedIds],
  )

  const diagnostics = useMemo(() => {
    const totalMass = Number(activeModules.reduce((sum, mod) => sum + mod.massKg, 0).toFixed(1))
    const netPower = Number(activeModules.reduce((sum, mod) => sum + mod.powerDrawWatts, 0).toFixed(1))
    let balanceStatus: AllonicBlueprintPayload['summary']['balance_status'] = 'nominal'
    if (netPower > 30) balanceStatus = 'energy_deficit'
    if (totalMass > 25) balanceStatus = 'overweight'
    return { totalMass, netPower, balanceStatus }
  }, [activeModules])

  const payload = useMemo<AllonicBlueprintPayload>(
    () => ({
      schema: 'allonic-blueprint-v1',
      planning_mode: 'local_session',
      blueprint: {
        id: blueprintId,
        name: blueprintName,
        intended_use: intendedUse,
      },
      summary: {
        module_count: activeModules.length,
        total_mass_kg: diagnostics.totalMass,
        net_power_draw_watts: diagnostics.netPower,
        balance_status: diagnostics.balanceStatus,
      },
      modules: activeModules.map((mod) => ({
        id: mod.id,
        name: mod.name,
        type: mod.type,
        mass_kg: mod.massKg,
        power_draw_watts: mod.powerDrawWatts,
        role: mod.role,
      })),
      work_orders: buildWorkOrders(blueprintId, intendedUse),
      export_targets: ['robot_blueprint_json', 'fabrication_review', 'field_planning_manifest'],
    }),
    [activeModules, blueprintId, blueprintName, diagnostics.balanceStatus, diagnostics.netPower, diagnostics.totalMass, intendedUse],
  )

  const report = useMemo(() => validateAllonic(payload), [payload])

  useEffect(() => {
    onUpdate(payload)
    if (onValidate) onValidate(report)
  }, [onUpdate, onValidate, payload, report])

  useEffect(() => {
    if (!initialIntake) return
    const key = JSON.stringify(initialIntake)
    if (appliedIntakeKey === key) return

    const normalizedId = initialIntake.nodeId?.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
    if (normalizedId) setBlueprintId(normalizedId)
    if (initialIntake.title) setBlueprintName(initialIntake.title)
    if (initialIntake.summary) setIntendedUse(initialIntake.summary)

    setAppliedIntakeKey(key)
  }, [appliedIntakeKey, initialIntake])

  const toggleModule = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[#8B5CF6]/20 bg-[#8B5CF6]/8 p-4 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#C4B5FD]">Allonic Robotics Assembler</div>
            <div className="mt-1 text-sm text-[#ede9fe]">
              Local-first blueprinting for mixed-module field robots and habitat support machines.
            </div>
          </div>
          <div className="rounded-full border border-[#D4A853]/25 bg-[#D4A853]/10 px-3 py-1 text-[9px] uppercase tracking-widest text-[#D4A853]">
            Local session only
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[#d1d5db]">
          This tool assembles heterogeneous modules, computes simple mass/power totals, and exports a reviewable blueprint.
          It does not verify safety, does not control robots, and does not write to the backend.
        </p>
      </div>

      <ConstraintStatusBlock report={report} />

      <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        {[
          { id: 'modules', label: '1. Modules' },
          { id: 'diagnostics', label: '2. Diagnostics' },
          { id: 'export', label: '3. Mirror' },
        ].map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => setActivePhase(phase.id as BuildPhase)}
            className="rounded-full px-3 py-1.5 transition-all"
            style={{
              border: activePhase === phase.id ? '1px solid rgba(139,92,246,0.45)' : '1px solid rgba(255,255,255,0.08)',
              background: activePhase === phase.id ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.04)',
              color: activePhase === phase.id ? '#EDE9FE' : '#8E7E6B',
            }}
          >
            {phase.label}
          </button>
        ))}
      </div>

      {activePhase === 'modules' && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 font-mono text-sm">
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Blueprint ID</span>
              <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={blueprintId} onChange={(e) => setBlueprintId(e.target.value || 'allonic_module')} />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Blueprint Name</span>
              <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={blueprintName} onChange={(e) => setBlueprintName(e.target.value)} />
            </label>
            <div className="grid gap-1">
              <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Intended Use</span>
              <textarea className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF] min-h-[84px]" value={intendedUse} onChange={(e) => setIntendedUse(e.target.value)} />
              <div className="flex flex-wrap gap-1 mt-1">
                <button type="button" onClick={() => setIntendedUse('irrigation support rover')} className="text-[9px] bg-white/5 border border-white/10 px-2 py-1 rounded hover:bg-white/10 transition-colors text-gray-400">irrigation support</button>
                <button type="button" onClick={() => setIntendedUse('printed-earth support rover')} className="text-[9px] bg-white/5 border border-white/10 px-2 py-1 rounded hover:bg-white/10 transition-colors text-gray-400">printed-earth support</button>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            {MODULE_LIBRARY.map((module) => {
              const Icon = MODULE_ICONS[module.type]
              const active = selectedIds.includes(module.id)
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-all"
                  style={{
                    borderColor: active ? 'rgba(139,92,246,0.45)' : 'rgba(255,255,255,0.08)',
                    background: active ? 'rgba(139,92,246,0.10)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={15} className={active ? 'text-[#C4B5FD]' : 'text-[#8a7a64]'} />
                    <div>
                      <div className="text-xs text-[#FAF6EF]">{module.name}</div>
                      <div className="text-[10px] text-[#8a7a64]">{module.role}</div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-[#c9bba5]">
                    <div>{module.massKg} kg</div>
                    <div>{module.powerDrawWatts > 0 ? `+${module.powerDrawWatts}` : module.powerDrawWatts} W</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activePhase === 'diagnostics' && (
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Modules</div>
              <div className="mt-2 text-2xl text-[#FAF6EF]">{activeModules.length}</div>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Total Mass</div>
              <div className="mt-2 text-2xl text-[#FAF6EF]">{diagnostics.totalMass} kg</div>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Net Power</div>
              <div className="mt-2 text-2xl text-[#FAF6EF]">{diagnostics.netPower} W</div>
            </div>
          </div>
          <div className="rounded-[18px] border p-4" style={{
            borderColor: diagnostics.balanceStatus === 'nominal' ? 'rgba(52,211,153,0.25)' : diagnostics.balanceStatus === 'energy_deficit' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)',
            background: diagnostics.balanceStatus === 'nominal' ? 'rgba(52,211,153,0.08)' : diagnostics.balanceStatus === 'energy_deficit' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
          }}>
            <div className="text-[10px] uppercase tracking-[0.22em]" style={{
              color: diagnostics.balanceStatus === 'nominal' ? '#34D399' : diagnostics.balanceStatus === 'energy_deficit' ? '#F59E0B' : '#EF4444',
            }}>
              {diagnostics.balanceStatus === 'nominal' ? 'Nominal balance' : diagnostics.balanceStatus === 'energy_deficit' ? 'Energy deficit' : 'Overweight warning'}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#c9bba5]">
              {diagnostics.balanceStatus === 'nominal'
                ? 'The current module combination is reasonable for a local planning draft.'
                : diagnostics.balanceStatus === 'energy_deficit'
                  ? 'This configuration draws more power than the current support modules comfortably offset.'
                  : 'This configuration may exceed the intended mobility baseline and should be treated as a heavy platform draft.'}
            </p>
          </div>
        </div>
      )}

      {activePhase === 'export' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-black/30 p-4 font-mono text-[11px] leading-5 text-[#c9bba5]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#8a7a64]">Human interpretation</div>
            <p>
              This is a robot assembly draft for the <strong>{payload.blueprint.name}</strong>, intended for {payload.blueprint.intended_use}.
            </p>
            <p>
              It combines {payload.summary.module_count} modules with a total mass of {payload.summary.total_mass_kg} kg and a net power draw of {payload.summary.net_power_draw_watts} W.
            </p>
            {report.level === 'hard_fail' ? (
              <div className="rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 p-3 text-[#fca5a5]">
                <strong>Constraint Failure:</strong> This draft is critically flawed and should not be exported.
              </div>
            ) : report.level === 'warning' ? (
              <div className="rounded-lg border border-[#FBBF24]/20 bg-[#FBBF24]/10 p-3 text-[#fde68a]">
                <strong>Constrained Draft:</strong> This payload exceeds standard mobility or energy limits.
              </div>
            ) : (
              <div className="rounded-lg border border-[#34D399]/20 bg-[#34D399]/10 p-3 text-[#9fd4a8]">
                <strong>Verified:</strong> This draft meets baseline assembly assumptions.
              </div>
            )}
            <div className="mt-auto border-t border-white/10 pt-3 text-[10px]">
              <strong>Handoff:</strong> Export this payload to push into the public archive or pass to robotic fabrication nodes.
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[18px] border border-white/8 bg-[#0a0806]/90 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#8B5CF6]">Machine payload</div>
            <pre className="max-h-[300px] overflow-auto font-mono text-[11px] leading-relaxed text-[#ddd6fe]">
{JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

