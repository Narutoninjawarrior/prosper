export type ConstraintLevel = 'ok' | 'warning' | 'hard_fail'

export type ConstraintResult = {
  level: ConstraintLevel
  message: string
}

export type ValidationReport = {
  isValid: boolean // false if any hard_fail
  level: ConstraintLevel // worst level
  results: ConstraintResult[]
}

function buildReport(results: ConstraintResult[]): ValidationReport {
  const hasHardFail = results.some((r) => r.level === 'hard_fail')
  const hasWarning = results.some((r) => r.level === 'warning')

  return {
    isValid: !hasHardFail,
    level: hasHardFail ? 'hard_fail' : hasWarning ? 'warning' : 'ok',
    results,
  }
}

export function validateSitePlan(payload: any): ValidationReport {
  const results: ConstraintResult[] = []
  if (!payload || !payload.geometry) return buildReport([{ level: 'hard_fail', message: 'Payload missing geometry.' }])

  const props = payload.geometry.properties
  const moduleType = payload.module?.type

  if (props.footprint_sqm > 100) {
    results.push({ level: 'warning', message: `Footprint (${props.footprint_sqm} sqm) exceeds standard residential modular limit (100 sqm).` })
  }
  
  if (props.perimeter_m > 50) {
    results.push({ level: 'warning', message: `Perimeter (${props.perimeter_m} m) exceeds recommended single-pour run.` })
  }

  if (props.layer_count > 200) {
    results.push({ level: 'warning', message: `Layer count (${props.layer_count}) exceeds standard stability bounds without reinforcement.` })
  }

  if (moduleType === 'water_channel' && payload.module?.length_m > 15) {
    results.push({ level: 'warning', message: `Irrigation run (${payload.module.length_m}m) is long; verify local grade drop over this distance.` })
  }

  return buildReport(results)
}

export function validateAllonic(payload: any): ValidationReport {
  const results: ConstraintResult[] = []
  if (!payload || !payload.summary || !payload.modules) return buildReport([{ level: 'hard_fail', message: 'Payload missing modules.' }])

  const summary = payload.summary
  const modules = payload.modules as any[]

  if (summary.total_mass_kg > 30) {
    results.push({ level: 'warning', message: `Total mass (${summary.total_mass_kg} kg) exceeds lightweight field bounds.` })
  }

  if (summary.net_power_draw_watts > 40) {
    results.push({ level: 'warning', message: `Net power draw (${summary.net_power_draw_watts} W) suggests heavy reliance on external supply.` })
  }

  const hasLocomotion = modules.some((m) => m.type === 'locomotion')
  if (!hasLocomotion) {
    results.push({ level: 'warning', message: 'No locomotion module present. Assembly will be stationary.' })
  }

  const hasEnergy = modules.some((m) => m.type === 'energy')
  const hasActuators = modules.some((m) => m.type === 'actuator')
  if (hasActuators && !hasEnergy && summary.net_power_draw_watts > 20) {
    results.push({ level: 'warning', message: 'Actuators present without energy module support.' })
  }

  return buildReport(results)
}

export function validateFoodCompliance(payload: any): ValidationReport {
  const results: ConstraintResult[] = []
  if (!payload || !payload.product) return buildReport([{ level: 'hard_fail', message: 'Payload missing product data.' }])

  const status = payload.product.eligibility_status

  if (status === 'commercial_kitchen_required') {
    results.push({ level: 'warning', message: 'TCS foods identified. This draft implies a commercial kitchen requirement, not typical cottage food.' })
  }

  if (status === 'local_only_draft') {
    results.push({ level: 'warning', message: 'Eligibility status is incomplete.' })
  }

  const label = payload.label_draft
  if (!label || !label.ingredients || label.ingredients.length === 0) {
    results.push({ level: 'warning', message: 'Label draft is missing ingredients.' })
  }
  
  if (!label.net_weight_oz) {
    results.push({ level: 'warning', message: 'Label draft is missing net weight.' })
  }

  return buildReport(results)
}

import { AlertCircle, CheckCircle2 } from "lucide-react"

export function ConstraintStatusBlock({ report }: { report: ValidationReport }) {
  if (report.level === "ok") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[#34D399]/20 bg-[#34D399]/10 p-3 text-[11px] text-[#9fd4a8]">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        <div>Within local planning limits. No immediate constraints detected.</div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-[11px] ${report.level === "hard_fail" ? "border-[#EF4444]/20 bg-[#EF4444]/10 text-[#fca5a5]" : "border-[#FBBF24]/20 bg-[#FBBF24]/10 text-[#fde68a]"}`}>
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <div className="grid gap-1">
        <div className="font-bold uppercase tracking-wider">{report.level === "hard_fail" ? "Review required before handoff" : "Resource limit exceeded"}</div>
        <ul className="grid gap-1 list-disc pl-3">
          {report.results.map((r, i) => (
            <li key={i}>{r.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
