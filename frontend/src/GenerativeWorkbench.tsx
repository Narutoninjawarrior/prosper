/**
 * /workbench - Browser-safe creative JSON + SHA-256 receipts (no backend writes).
 */
import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Box, Copy, Download, Sparkles, FileText, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { sha256Hex, stableStringify } from './lib/grace'
import type { ValidationReport } from './lib/constraintValidator'
import { useContract } from './lib/sanctuaryBridge'
import MasonPanel from './mason/MasonPanel'
import ParametricSitePlanner from './components/ParametricSitePlanner'
import FoodCompliancePlanner from './components/FoodCompliancePlanner'
import AllonicSchemaAssembler from './components/AllonicSchemaAssembler'
import FacilityBuildPlanner from './components/FacilityBuildPlanner'
import BiosystemLoopCanvas from './components/BiosystemLoopCanvas'
import StewardshipJournalManager from './components/StewardshipJournalManager'
import PhysicalWorkPackCompiler from './components/PhysicalWorkPackCompiler'

type TabId = 'graphics' | 'soulfile' | 'memory' | 'blueprint' | 'siteplan' | 'mason' | 'food_compliance' | 'allonic' | 'facility' | 'biosystem' | 'stewardship' | 'workpack'
type DraftStage = 'Rough Cut' | 'Smoothed' | 'Sealed'
type SaveState = 'Saved locally' | 'Saving...' | 'Unsaved changes'
type PlannerContractRecord = {
  tab: 'siteplan' | 'food_compliance' | 'allonic' | 'facility'
  state_boundary: 'local_only' | string
  primary_payload_schema_name: string
  export_targets: string[]
  constraint_source: string
  intended_use: string
  safe_handoff_routes: string[]
}
type ExportTargetRecord = {
  id: string
  planner_tab: 'siteplan' | 'food_compliance' | 'allonic' | 'facility'
  label: string
  format: string
  state_boundary: 'local_only' | string
  primary_route: string
  handoff_route: string
  machine_surface: string
  downstream_examples: string[]
  notes: string
}
type PlannerIntake = {
  source?: string
  nodeId?: string
  title?: string
  kind?: string
  summary?: string
  intendedTab?: string
}

type WorkbenchHandoff = {
  source?: string
  sourceId?: string
  objectId?: string
  title?: string
  objectType?: string
  freshness?: string
  author?: string
  scope?: string
  audience?: string
  timestamp?: number
}

type DraftMetadata = {
  source?: string
  objectId?: string
  title?: string
  objectType?: string
  freshness?: string
  author?: string
  scope?: string
  audience?: string
  imported_at?: string
}

type WorkbenchDraftState = {
  version: 2
  title: string
  active_stage: DraftStage
  stages: {
    rough_cut: string
    smoothed: string
    sealed: string
  }
  metadata: DraftMetadata | null
  updated_at: string
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'graphics', label: 'Graphics' },
  { id: 'soulfile', label: 'Soulfile' },
  { id: 'memory', label: 'Memory' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'siteplan', label: 'Site Planner' },
  { id: 'food_compliance', label: 'Cottage Food Planner' },
  { id: 'allonic', label: 'Allonic Robotics' },
  { id: 'facility', label: 'Facility Build Planner' },
  { id: 'biosystem', label: 'Biosystem Loop Planner' },
  { id: 'stewardship', label: 'Stewardship Journal' },
  { id: 'workpack', label: 'Operational Work Card' },
  { id: 'mason', label: 'Mason' },
]

const WORKBENCH_DRAFT_KEY = 'hearth_workbench_draft'
const DEFAULT_DRAFT_TITLE = 'Untitled Artifact'
const DEFAULT_DRAFT_STAGE: DraftStage = 'Rough Cut'
const MUTUAL_CREDIT_SCHEMA_PREVIEW = `{
  "title": "Hearthlands Mutual Credit Clearing Pool",
  "credit_denomination_unit": "MEGAJOULES_THERMAL | CALORIC_KCAL | COMPUTE_TOKEN_HOURS",
  "account_balances_matrix": [
    {
      "member_id": "local-participant-id",
      "current_balance": 0,
      "maximum_credit_extension_limit": 0
    }
  ]
}`

function normalizePlannerContracts(seed: unknown) {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
    return { ok: false as const, error: 'planner contracts seed is not an object' }
  }

  const source = (seed as { records?: unknown }).records
  if (!Array.isArray(source)) {
    return { ok: false as const, error: 'planner contracts seed missing records array' }
  }

  const records: PlannerContractRecord[] = []
  for (const entry of source) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false as const, error: 'planner contract record is not an object' }
    }
    const row = entry as Record<string, unknown>
    if (
      typeof row.tab !== 'string'
      || typeof row.state_boundary !== 'string'
      || typeof row.primary_payload_schema_name !== 'string'
      || !Array.isArray(row.export_targets)
      || !Array.isArray(row.safe_handoff_routes)
      || typeof row.constraint_source !== 'string'
      || typeof row.intended_use !== 'string'
    ) {
      return { ok: false as const, error: 'planner contract record fields are invalid' }
    }

    records.push({
      tab: row.tab as PlannerContractRecord['tab'],
      state_boundary: row.state_boundary,
      primary_payload_schema_name: row.primary_payload_schema_name,
      export_targets: row.export_targets.filter((value): value is string => typeof value === 'string'),
      constraint_source: row.constraint_source,
      intended_use: row.intended_use,
      safe_handoff_routes: row.safe_handoff_routes.filter((value): value is string => typeof value === 'string'),
    })
  }

  return { ok: true as const, value: records }
}

function normalizeExportTargets(seed: unknown) {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
    return { ok: false as const, error: 'export targets seed is not an object' }
  }

  const source = (seed as { records?: unknown }).records
  if (!Array.isArray(source)) {
    return { ok: false as const, error: 'export targets seed missing records array' }
  }

  const records: ExportTargetRecord[] = []
  for (const entry of source) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false as const, error: 'export target record is not an object' }
    }
    const row = entry as Record<string, unknown>
    if (
      typeof row.id !== 'string'
      || typeof row.planner_tab !== 'string'
      || typeof row.label !== 'string'
      || typeof row.format !== 'string'
      || typeof row.state_boundary !== 'string'
      || typeof row.primary_route !== 'string'
      || typeof row.handoff_route !== 'string'
      || typeof row.machine_surface !== 'string'
      || !Array.isArray(row.downstream_examples)
      || typeof row.notes !== 'string'
    ) {
      return { ok: false as const, error: 'export target record fields are invalid' }
    }

    records.push({
      id: row.id,
      planner_tab: row.planner_tab as ExportTargetRecord['planner_tab'],
      label: row.label,
      format: row.format,
      state_boundary: row.state_boundary,
      primary_route: row.primary_route,
      handoff_route: row.handoff_route,
      machine_surface: row.machine_surface,
      downstream_examples: row.downstream_examples.filter((value): value is string => typeof value === 'string'),
      notes: row.notes,
    })
  }

  return { ok: true as const, value: records }
}

function PreviewMesh({ scale, twist, hue }: { scale: number; twist: number; hue: number }) {
  return (
    <mesh rotation={[0, twist, 0]} scale={scale}>
      <icosahedronGeometry args={[0.6, 1]} />
      <meshStandardMaterial color={`hsl(${hue}, 65%, 55%)`} emissive={`hsl(${hue}, 80%, 35%)`} emissiveIntensity={0.35} wireframe />
    </mesh>
  )
}

async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(stableStringify(payload))
}

function buildEmptyDraftState(metadata: DraftMetadata | null = null): WorkbenchDraftState {
  return {
    version: 2,
    title: DEFAULT_DRAFT_TITLE,
    active_stage: DEFAULT_DRAFT_STAGE,
    stages: {
      rough_cut: '',
      smoothed: '',
      sealed: '',
    },
    metadata,
    updated_at: new Date().toISOString(),
  }
}

function normalizeDraftMetadata(value: unknown): DraftMetadata | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  return {
    ...(typeof input.source === 'string' ? { source: input.source } : {}),
    ...(typeof input.objectId === 'string' ? { objectId: input.objectId } : {}),
    ...(typeof input.title === 'string' ? { title: input.title } : {}),
    ...(typeof input.objectType === 'string' ? { objectType: input.objectType } : {}),
    ...(typeof input.freshness === 'string' ? { freshness: input.freshness } : {}),
    ...(typeof input.author === 'string' ? { author: input.author } : {}),
    ...(typeof input.scope === 'string' ? { scope: input.scope } : {}),
    ...(typeof input.audience === 'string' ? { audience: input.audience } : {}),
    ...(typeof input.imported_at === 'string' ? { imported_at: input.imported_at } : {}),
  }
}

function parseStructuredDraft(input: unknown): WorkbenchDraftState | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  const stages = value.stages
  if (!stages || typeof stages !== 'object') return null
  const stageMap = stages as Record<string, unknown>
  const activeStage = value.active_stage

  if (
    value.version !== 2 ||
    typeof value.title !== 'string' ||
    (activeStage !== 'Rough Cut' && activeStage !== 'Smoothed' && activeStage !== 'Sealed') ||
    typeof stageMap.rough_cut !== 'string' ||
    typeof stageMap.smoothed !== 'string' ||
    typeof stageMap.sealed !== 'string'
  ) {
    return null
  }

  return {
    version: 2,
    title: value.title,
    active_stage: activeStage,
    stages: {
      rough_cut: stageMap.rough_cut,
      smoothed: stageMap.smoothed,
      sealed: stageMap.sealed,
    },
    metadata: normalizeDraftMetadata(value.metadata),
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : new Date().toISOString(),
  }
}

function migrateLegacyDraft(input: unknown): WorkbenchDraftState | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>

  if (
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    (value.stage !== 'Rough Cut' && value.stage !== 'Smoothed' && value.stage !== 'Sealed')
  ) {
    return null
  }

  const content = value.content
  const stage = value.stage as DraftStage

  return {
    version: 2,
    title: value.title || DEFAULT_DRAFT_TITLE,
    active_stage: stage,
    stages: {
      rough_cut: content,
      smoothed: stage === 'Smoothed' || stage === 'Sealed' ? content : '',
      sealed: stage === 'Sealed' ? content : '',
    },
    metadata: normalizeDraftMetadata(value.metadata),
    updated_at: new Date().toISOString(),
  }
}

function readStoredDraft(): { draft: WorkbenchDraftState | null; malformed: boolean } {
  const raw = sessionStorage.getItem(WORKBENCH_DRAFT_KEY)
  if (!raw) return { draft: null, malformed: false }

  try {
    const parsed = JSON.parse(raw)
    const structured = parseStructuredDraft(parsed)
    if (structured) return { draft: structured, malformed: false }

    const migrated = migrateLegacyDraft(parsed)
    if (migrated) return { draft: migrated, malformed: false }

    return { draft: null, malformed: true }
  } catch {
    return { draft: null, malformed: true }
  }
}

function stageToKey(stage: DraftStage): keyof WorkbenchDraftState['stages'] {
  if (stage === 'Rough Cut') return 'rough_cut'
  if (stage === 'Smoothed') return 'smoothed'
  return 'sealed'
}

function plannerIntakeSourceHref(intake: PlannerIntake | null): string | null {
  if (!intake?.source) return null
  if (intake.source === 'observatory') {
    return intake.nodeId ? `/observatory?node=${encodeURIComponent(intake.nodeId)}` : '/observatory'
  }
  if (intake.source === 'registry') {
    return intake.nodeId
      ? `/observatory?node=${encodeURIComponent(intake.nodeId)}`
      : '/registry?kind=module'
  }
  if (intake.source === 'artifacts') {
    return intake.nodeId
      ? `/observatory?node=${encodeURIComponent(intake.nodeId)}`
      : '/artifacts?category=Blueprints'
  }
  return null
}

export default function GenerativeWorkbench() {
  const [tab, setTab] = useState<TabId>('graphics')
  const [geoScale, setGeoScale] = useState(1)
  const [geoTwist, setGeoTwist] = useState(0)
  const [geoHue, setGeoHue] = useState(28)
  const [soulName, setSoulName] = useState('Traveler')
  const [soulVoice, setSoulVoice] = useState('Warm solarpunk steward')
  const [soulRules, setSoulRules] = useState('Never claim financial advice. Encourage witnessed work.')
  const [memKey, setMemKey] = useState('plot_assignment')
  const [memValue, setMemValue] = useState('inner ring node 3')
  const [memTag, setMemTag] = useState('cottage')
  const [bpTitle, setBpTitle] = useState('Cottage Garden')
  const [bpPart, setBpPart] = useState('flora_flower')
  const [bpX, setBpX] = useState(0)
  const [bpZ, setBpZ] = useState(0)
  const [digest, setDigest] = useState('')
  const [exportJson, setExportJson] = useState('')
  const [masonBlueprint, setMasonBlueprint] = useState<any>(null)
  const [foodCompliancePayload, setFoodCompliancePayload] = useState<any>(null)
  const [sitePlanPayload, setSitePlanPayload] = useState<any>(null)
  const [allonicPayload, setAllonicPayload] = useState<any>(null)
  const [facilityPayload, setFacilityPayload] = useState<any>(null)
  const [biosystemPayload, setBiosystemPayload] = useState<any>(null)
  const [draftReport, setDraftReport] = useState<ValidationReport | null>(null)

  const [handoff, setHandoff] = useState<WorkbenchHandoff | null>(null)
  const [plannerIntake, setPlannerIntake] = useState<PlannerIntake | null>(null)
  const [draftState, setDraftState] = useState<WorkbenchDraftState>(() => buildEmptyDraftState())
  const [draftRecoveryNeeded, setDraftRecoveryNeeded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('Saved locally')
  const [exportNotice, setExportNotice] = useState('')
  const plannerContractsEnvelope = useContract('/planner_contracts.json', normalizePlannerContracts, [])
  const exportTargetsEnvelope = useContract('/export_targets.json', normalizeExportTargets, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedTab = params.get('tab')
    if (
      requestedTab === 'siteplan'
      || requestedTab === 'food_compliance'
      || requestedTab === 'allonic'
      || requestedTab === 'graphics'
      || requestedTab === 'soulfile'
      || requestedTab === 'memory'
      || requestedTab === 'blueprint'
      || requestedTab === 'mason'
      || requestedTab === 'facility'
      || requestedTab === 'biosystem'
      || requestedTab === 'stewardship'
      || requestedTab === 'workpack'
    ) {
      setTab(requestedTab)
    }

    const source = params.get('source') || undefined
    const nodeId = params.get('node') || undefined
    const title = params.get('title') || undefined
    const kind = params.get('kind') || undefined
    const summary = params.get('summary') || undefined

    if (source || nodeId || title || kind || summary) {
      setPlannerIntake({ source, nodeId, title, kind, summary, intendedTab: requestedTab || undefined })
    }

    const rawHandoff = sessionStorage.getItem('workbench_handoff')
    if (rawHandoff) {
      try {
        setHandoff(JSON.parse(rawHandoff))
      } catch {
        sessionStorage.removeItem('workbench_handoff')
      }
    }

    const { draft, malformed } = readStoredDraft()
    if (draft) {
      setDraftState(draft)
      setSaveState('Saved locally')
      sessionStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(draft))
    } else if (malformed) {
      setDraftRecoveryNeeded(true)
      setSaveState('Unsaved changes')
    }
  }, [])

  useEffect(() => {
    if (draftRecoveryNeeded) return undefined

    setSaveState('Saving...')
    const timeoutId = window.setTimeout(() => {
      try {
        const nextState: WorkbenchDraftState = {
          ...draftState,
          updated_at: new Date().toISOString(),
        }
        sessionStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(nextState))
        setDraftState(nextState)
        setSaveState('Saved locally')
      } catch {
        setDraftRecoveryNeeded(true)
        setSaveState('Unsaved changes')
      }
    }, 400)

    return () => window.clearTimeout(timeoutId)
  }, [
    draftRecoveryNeeded,
    draftState.active_stage,
    draftState.metadata,
    draftState.stages.rough_cut,
    draftState.stages.sealed,
    draftState.stages.smoothed,
    draftState.title,
  ])

  useEffect(() => {
    if (!exportNotice) return undefined
    const timeoutId = window.setTimeout(() => setExportNotice(''), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [exportNotice])

  const draftTitle = draftState.title
  const draftStage = draftState.active_stage
  const draftMetadata = draftState.metadata
  const draftContent = draftState.stages[stageToKey(draftStage)]
  const intakeSourceHref = plannerIntakeSourceHref(plannerIntake)
  const activePlannerContract = useMemo(
    () => (
      tab === 'siteplan' || tab === 'food_compliance' || tab === 'allonic'
        ? plannerContractsEnvelope.data.find((record) => record.tab === tab) ?? null
        : null
    ),
    [plannerContractsEnvelope.data, tab],
  )
  const activeExportTarget = useMemo(
    () => (
      tab === 'siteplan' || tab === 'food_compliance' || tab === 'allonic'
        ? exportTargetsEnvelope.data.find((record) => record.planner_tab === tab) ?? null
        : null
    ),
    [exportTargetsEnvelope.data, tab],
  )

  const updateDraftState = (updater: (prev: WorkbenchDraftState) => WorkbenchDraftState) => {
    setDraftState(prev => updater(prev))
    setSaveState('Unsaved changes')
  }

  const setDraftTitleValue = (value: string) => {
    updateDraftState(prev => ({ ...prev, title: value }))
  }

  const setDraftStageValue = (stage: DraftStage) => {
    updateDraftState(prev => ({ ...prev, active_stage: stage }))
  }

  const setDraftContentForStage = (stage: DraftStage, value: string) => {
    const key = stageToKey(stage)
    updateDraftState(prev => ({
      ...prev,
      stages: {
        ...prev.stages,
        [key]: value,
      },
    }))
  }

  const importHandoff = () => {
    if (!handoff) return

    const sourceId = handoff.objectId || handoff.sourceId || 'unknown'
    const initialContent = `### Artifact Draft: ${handoff.title}\n\n` +
      `*   **Provenance:** ${handoff.source === 'commons' ? 'Commons Prompt' : 'World Object'}\n` +
      `*   **Identity:** ${sourceId}\n` +
      `*   **Classification:** ${handoff.objectType || 'Generic'}\n` +
      `*   **Freshness:** ${handoff.freshness || 'N/A'}\n\n` +
      `<!-- Define specification guidelines, behavioral rules, or schema details below -->\n\n` +
      `#### 1. Core Specification\n\n` +
      `#### 2. Runtime Behavior\n\n` +
      `#### 3. Verification Details\n`

    const metadata: DraftMetadata = {
      ...(typeof handoff.source === 'string' ? { source: handoff.source } : {}),
      ...(typeof sourceId === 'string' ? { objectId: sourceId } : {}),
      ...(typeof handoff.title === 'string' ? { title: handoff.title } : {}),
      ...(typeof handoff.objectType === 'string' ? { objectType: handoff.objectType } : {}),
      ...(typeof handoff.freshness === 'string' ? { freshness: handoff.freshness } : {}),
      ...(typeof handoff.author === 'string' ? { author: handoff.author } : {}),
      ...(typeof handoff.scope === 'string' ? { scope: handoff.scope } : {}),
      ...(typeof handoff.audience === 'string' ? { audience: handoff.audience } : {}),
      imported_at: new Date().toISOString(),
    }

    updateDraftState(() => ({
      version: 2,
      title: handoff.title || DEFAULT_DRAFT_TITLE,
      active_stage: 'Rough Cut',
      stages: {
        rough_cut: initialContent,
        smoothed: '',
        sealed: '',
      },
      metadata,
      updated_at: new Date().toISOString(),
    }))

    sessionStorage.removeItem('workbench_handoff')
    setHandoff(null)
  }

  const clearPlannerIntake = () => {
    setPlannerIntake(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('source')
    params.delete('node')
    params.delete('title')
    params.delete('kind')
    params.delete('summary')
    const next = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`)
  }

  const returnToCommons = () => {
    const newPrompt = {
      id: `local-artifact-${Date.now()}`,
      prompt_text: `### Artifact: ${draftTitle}\n\n${draftState.stages.sealed}`,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: (draftMetadata?.scope as any) || 'commons_public',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      ...(draftMetadata?.objectId ? {
        object_ref: {
          id: draftMetadata.objectId,
          title: draftMetadata.title,
          purpose: draftMetadata.objectType || 'Artifact',
          source: draftMetadata.source,
          freshness: draftMetadata.freshness || 'N/A',
        },
      } : {}),
    }

    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))

    sessionStorage.removeItem(WORKBENCH_DRAFT_KEY)
    setDraftState(buildEmptyDraftState())
    setSaveState('Saved locally')

    window.location.href = `/commons?source=workbench&object=${newPrompt.id}`
  }

  const recoverWithEmptyDraft = () => {
    const empty = buildEmptyDraftState()
    sessionStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(empty))
    setDraftState(empty)
    setDraftRecoveryNeeded(false)
    setSaveState('Saved locally')
  }

  const resetLocalDraftState = () => {
    sessionStorage.removeItem(WORKBENCH_DRAFT_KEY)
    setDraftState(buildEmptyDraftState())
    setDraftRecoveryNeeded(false)
    setSaveState('Saved locally')
  }

  const graphicsPayload = useMemo(() => ({
    workbench: 'graphics-seed-v1',
    geometry: 'icosahedron',
    scale: geoScale,
    twist: geoTwist,
    hue: geoHue,
  }), [geoScale, geoTwist, geoHue])

  const soulPayload = useMemo(() => ({
    workbench: 'soulfile-v1',
    name: soulName,
    voice: soulVoice,
    rules: soulRules.split('\n').filter(Boolean),
  }), [soulName, soulVoice, soulRules])

  const memoryPayload = useMemo(() => ({
    workbench: 'memory-crystal-v1',
    entries: [{ key: memKey, value: memValue, tags: [memTag] }],
  }), [memKey, memValue, memTag])

  const blueprintPayload = useMemo(() => ({
    schema: 'workshop-v1',
    title: bpTitle,
    author: 'workbench',
    parts: [{ part_id: bpPart, position: { x: bpX, z: bpZ }, rotation_deg: 0, config: {} }],
    tags: ['workbench'],
  }), [bpTitle, bpPart, bpX, bpZ])

  const activePayload = tab === 'graphics' ? graphicsPayload
    : tab === 'soulfile' ? soulPayload
    : tab === 'memory' ? memoryPayload
    : tab === 'siteplan' ? (sitePlanPayload || { schema: 'site-plan-v1', note: 'Use the Site Planner tab to configure a local geometry + sequencing manifest.' })
    : tab === 'food_compliance' ? (foodCompliancePayload || { schema: 'food-compliance-v1', note: 'Use the Cottage Food Planner tab to stage local compliance data.' })
    : tab === 'allonic' ? (allonicPayload || { schema: 'allonic-blueprint-v1', note: 'Use the Allonic Robotics tab to assemble a local mixed-module robot blueprint.' })
    : tab === 'facility' ? (facilityPayload || { schema: 'facility-manifest-v1', note: 'Use the Facility Build Planner tab to coordinate physical resources.' })
    : tab === 'biosystem' ? (biosystemPayload || { schema: 'biosystem-loop-v1', note: 'Use the Biosystem Loop Planner tab to map local water, pH, and dependency loops.' })
    : tab === 'mason' ? (masonBlueprint || { workbench: 'mason-blueprint-v1', note: 'Generate or select a template to preview JSON.' })
    : blueprintPayload

  const stamp = async () => {
    const json = JSON.stringify(activePayload, null, 2)
    const hash = await hashPayload(activePayload)
    setExportJson(json)
    setDigest(hash)
  }

  const copyAll = async () => {
    const json = JSON.stringify(activePayload, null, 2)
    const hash = await hashPayload(activePayload)
    setExportJson(json)
    setDigest(hash)
    await navigator.clipboard.writeText(`${json}\n\nreceipt_hash: ${hash}`)
  }

  const formatConstraintSummary = () => {
    if (!draftReport || draftReport.level === 'ok') return ''
    return `\n\n### Constraint Summary (${draftReport.level.toUpperCase()})\n` + draftReport.results.map(r => `- [${r.level}] ${r.message}`).join('\n')
  }

  const pushSitePlanToCommons = () => {
    if (!sitePlanPayload) return
    const newPrompt = {
      id: `local-site-plan-${Date.now()}`,
      prompt_text: `### Site Plan: ${sitePlanPayload.module.id}\n\nType: ${sitePlanPayload.module.type}\nMaterial: ${sitePlanPayload.module.material}\nDimensions: ${sitePlanPayload.module.length_m}m x ${sitePlanPayload.module.width_m}m\nLayers: ${sitePlanPayload.module.layer_count}\nZone: X:${sitePlanPayload.module.zone.x_m} Z:${sitePlanPayload.module.zone.z_m}${formatConstraintSummary()}\n\n\`\`\`json\n${JSON.stringify(sitePlanPayload, null, 2)}\n\`\`\``,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'world_room',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: sitePlanPayload.module.id,
        title: `${sitePlanPayload.module.type} Plan`,
        purpose: 'Site Plan Manifest',
        source: 'Workbench Planner',
        freshness: 'Local Session',
      }
    }
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))
    window.location.href = `/commons?source=workbench&object=${sitePlanPayload.module.id}`
  }

  const pushFoodComplianceToCommons = () => {
    if (!foodCompliancePayload) return
    const newPrompt = {
      id: `local-food-compliance-${Date.now()}`,
      prompt_text: `### Cottage Food Planning: ${foodCompliancePayload.product.name}\n\nProducer: ${foodCompliancePayload.producer.name}\nStatus: ${foodCompliancePayload.product.eligibility_status}\nPickup: ${foodCompliancePayload.pickup_node.location}${formatConstraintSummary()}\n\n\`\`\`json\n${JSON.stringify(foodCompliancePayload, null, 2)}\n\`\`\``,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'commons_public',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: `food-${Date.now()}`,
        title: `${foodCompliancePayload.product.name} Compliance Draft`,
        purpose: 'Food Compliance Manifest',
        source: 'Workbench Planner',
        freshness: 'Local Session',
      }
    }
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))
    window.location.href = `/commons?source=workbench&object=${newPrompt.object_ref.id}`
  }

  const pushAllonicToCommons = () => {
    if (!allonicPayload) return
    const newPrompt = {
      id: `local-allonic-${Date.now()}`,
      prompt_text: `### Allonic Blueprint: ${allonicPayload.blueprint.name}\n\nID: ${allonicPayload.blueprint.id}\nIntended Use: ${allonicPayload.blueprint.intended_use}\nModules: ${allonicPayload.summary.module_count}\nMass: ${allonicPayload.summary.total_mass_kg} kg\nNet Power: ${allonicPayload.summary.net_power_draw_watts} W\nStatus: ${allonicPayload.summary.balance_status}${formatConstraintSummary()}\n\n\`\`\`json\n${JSON.stringify(allonicPayload, null, 2)}\n\`\`\``,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'forge_room',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: allonicPayload.blueprint.id,
        title: allonicPayload.blueprint.name,
        purpose: 'Allonic Robot Blueprint',
        source: 'Workbench Planner',
        freshness: 'Local Session',
      }
    }
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))
    window.location.href = `/commons?source=workbench&object=${allonicPayload.blueprint.id}`
  }

  const pushFacilityToCommons = () => {
    if (!facilityPayload) return
    const newPrompt = {
      id: `local-facility-${Date.now()}`,
      prompt_text: `### Facility Build Manifest: ${facilityPayload.title}\n\n**Derived BOM Summary**\n- Type: ${facilityPayload.facility_type}\n- Footprint: ${facilityPayload.footprint}\n- Material Lines: ${facilityPayload.materials.length}\n- Labor Est: ${facilityPayload.estimated_labor_hours} hours\n- Power Needs: ${facilityPayload.estimated_power_needs} W\n- Water Needs: ${facilityPayload.estimated_water_needs} L\n- Budget Est: ${facilityPayload.estimated_budget_ember} EMBER\n- Dependency Count: ${facilityPayload.dependencies.length}${formatConstraintSummary()}\n\n\`\`\`json\n${JSON.stringify(facilityPayload, null, 2)}\n\`\`\``,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'builders_room',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: facilityPayload.id,
        title: facilityPayload.title,
        purpose: 'Facility Build Manifest',
        source: 'Workbench Planner',
        freshness: 'Local Session',
      }
    }
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))
    window.location.href = `/commons?source=workbench&object=${facilityPayload.id}`
  }

  const pushBiosystemToCommons = () => {
    if (!biosystemPayload) return
    let historyBlock = '';
    let networkIdeasBlock = '';
    if (biosystemPayload.suggestionHistory && biosystemPayload.suggestionHistory.length > 0) {
      historyBlock = `\n\n## Recent Changes\nLocal draft edits. Not reviewed, witnessed, or approved.\nLocal suggestion trace. Documents client-side options presented to the operator prior to manual layout promotion.\n${biosystemPayload.suggestionHistory.slice(0, 3).map((h: any) => `- AI proposed ${h.component_type}. Human ${h.action}.`).join('\n')}`;
    } else {
      historyBlock = `\n\n## Recent Changes\nLocal draft edits. Not reviewed, witnessed, or approved.\nNo suggestion interactions recorded in this session.`;
    }
    if (biosystemPayload.networkIdeas && biosystemPayload.networkIdeas.length > 0) {
      networkIdeasBlock = `\n\n## Network Vision Seeds\nLocal planning ideas only. Visionary context, not implemented coordination.\n${biosystemPayload.networkIdeas.slice(0, 3).map((idea: any) => `- ${idea.title}: ${idea.prompt}`).join('\n')}`;
    } else {
      networkIdeasBlock = `\n\n## Network Vision Seeds\nLocal planning ideas only. Visionary context, not implemented coordination.\nNo network vision ideas were saved in this session.`;
    }
    const newPrompt = {
      id: `local-biosystem-${Date.now()}`,
      prompt_text: `### Biosystem Loop Draft: ${biosystemPayload.title}\n\n**Loop Configuration Summary**\n- Target pH: ${biosystemPayload.targetPh}\n- Reservoir Capacity: ${biosystemPayload.reservoirCapacityGallons} gal\n- Pump Flow Rate: ${biosystemPayload.pumpFlowRateGpm} GPM\n- Sensor: ${biosystemPayload.sensorEnabled ? 'Present' : 'Missing'}\n- Return Path: ${biosystemPayload.returnPathEnabled ? 'Present' : 'Missing'}\n- Node Count: ${Object.keys(biosystemPayload.nodes).length}${formatConstraintSummary()}${historyBlock}${networkIdeasBlock}\n\n\`\`\`json\n${JSON.stringify(biosystemPayload, null, 2)}\n\`\`\``,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'builders_room',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: biosystemPayload.manifestId,
        title: biosystemPayload.title,
        purpose: 'Biosystem Loop Manifest',
        source: 'Workbench Planner',
        freshness: 'Local Session',
      }
    }
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]')
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]))
    window.location.href = `/commons?source=workbench&object=${biosystemPayload.manifestId}`
  }

  const pushBiosystemToForge = () => {
    if (!biosystemPayload) return;
    
    // Determine loop status text
    const isWarning = (biosystemPayload.targetPh < 6.5 && biosystemPayload.targetPh > 4.6) || (biosystemPayload.targetPh > 7.8 && biosystemPayload.targetPh < 8.5);
    const isFail = biosystemPayload.targetPh >= 8.5 || biosystemPayload.targetPh <= 4.6;
    const loopStatusText = isFail ? 'CRITICAL: PH OUT OF BOUNDS' : isWarning ? 'WARNING: SUBOPTIMAL' : 'OPTIMAL';

    const artifact = {
      id: 'biosystem-loop-preview',
      title: biosystemPayload.title,
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
          Math.max(2.5, Math.min(6, biosystemPayload.reservoirCapacityGallons / 120)),
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
        source_ref: biosystemPayload.manifestId,
        created_at: new Date().toISOString(),
        note: 'Local planning artifact from Biosystem Loop Canvas. Not a real biosystem.',
      },
      planner_context: {
        origin: 'Biosystem Loop Canvas',
        loop_status: loopStatusText,
        target_ph: biosystemPayload.targetPh,
        reservoir_capacity_gallons: biosystemPayload.reservoirCapacityGallons,
        pump_flow_rate_gpm: biosystemPayload.pumpFlowRateGpm,
        sensor_present: biosystemPayload.sensorEnabled,
        return_path_present: biosystemPayload.returnPathEnabled,
        node_count: Object.keys(biosystemPayload.nodes).length,
        suggestion_history: biosystemPayload.suggestionHistory?.map((h: any) => ({
          component_type: h.component_type,
          action: h.action
        })) || [],
        network_ideas: biosystemPayload.networkIdeas?.map((idea: any) => ({
          title: idea.title,
          category: idea.category
        })) || []
      },
    };

    try {
      const stored = sessionStorage.getItem('prosper:local_artifacts')
      const existing = stored ? JSON.parse(stored) : []
      const next = [artifact, ...existing.filter((item: any) => item.id !== artifact.id)]
      sessionStorage.setItem('prosper:local_artifacts', JSON.stringify(next))
      window.location.href = `/forge?artifact=${encodeURIComponent(artifact.id)}`
    } catch (error) {
      console.error('Failed to place biosystem artifact in forge', error)
    }
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(122,158,126,0.12),transparent_42%),#070a08] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-[24px] border border-[#7A9E7E]/25 bg-black/35 px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7A9E7E]/35 bg-[#7A9E7E]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9fd4a8]">
              <Sparkles size={12} />
              Generative workbench
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Build artifacts in the browser</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b7c9be]">
              Export JSON + SHA-256 digest only. No Firestore writes, no wallet signing. Copy or download for steward review.<br/>
              <span className="text-[#D4A853]">Hearthlands can now stage local site geometry and work-order manifests for future CAD/GIS/field-tool handoff.</span>
              <br/>
              <span className="text-[#A78BFA] mt-1 inline-block">Looking for published work? Browse the <a href="/artifacts?category=Blueprints" className="underline hover:text-white transition-colors">Public Blueprints Archive</a>.</span>
            </p>
          </div>

          {handoff && (
            <div className="flex-none inline-flex flex-col gap-2 rounded-lg border border-[#4A90D9]/30 bg-[#4A90D9]/10 px-4 py-3 font-mono text-[11px] max-w-sm">
              <div className="text-[#4A90D9] font-bold uppercase tracking-widest flex justify-between">
                <span>INTAKE FROM {handoff.source === 'commons' ? 'COMMONS' : 'WORLD'}</span>
                <span className="opacity-50 ml-4">LOCAL SESSION</span>
              </div>
              <div className="text-gray-300 leading-normal">
                Target: <span className="text-[#FAF6EF] font-bold">{handoff.title}</span> ({handoff.objectId || handoff.sourceId || 'n/a'})
                <br />
                Context: {handoff.objectType || 'Generic Object'}
              </div>
              <button
                onClick={importHandoff}
                className="w-full mt-1 bg-[#4A90D9] text-[#0A0604] hover:bg-white transition-colors text-[9px] uppercase tracking-wider font-bold py-1.5 rounded"
              >
                Begin Local Draft from Intake
              </button>
            </div>
          )}
        </header>

        {plannerIntake && (tab === 'siteplan' || tab === 'food_compliance' || tab === 'allonic') && (
          <div className="rounded-[18px] border border-[#60A5FA]/20 bg-[#60A5FA]/8 px-4 py-3 font-mono text-[11px] text-[#c9d9ee]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#93C5FD]">
                Planner Intake
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-[#EADFCB]">
                {plannerIntake.source === 'registry' ? 'Registry module' : plannerIntake.source === 'artifacts' ? 'Artifact archive' : (plannerIntake.source || 'linked context')}
              </span>
            </div>
            <div className="mt-2 leading-5">
              <span className="text-white">{plannerIntake.title || plannerIntake.nodeId || 'Local context'}</span>
              {plannerIntake.kind ? <span className="text-[#8a7a64]"> · {plannerIntake.kind}</span> : null}
            </div>
            {plannerIntake.summary && (
              <div className="mt-1 text-[#9fb4c7]">{plannerIntake.summary}</div>
            )}
            {plannerIntake.intendedTab && plannerIntake.intendedTab !== tab && (
              <div className="mt-2 text-[10px] text-[#FBBF24]">
                This intake was prepared for another planner tab.
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {intakeSourceHref && (
                <a
                  href={intakeSourceHref}
                  className="rounded-full border border-[#60A5FA]/25 bg-[#60A5FA]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BFDBFE] no-underline"
                >
                  Return to Source
                </a>
              )}
              <button
                type="button"
                onClick={clearPlannerIntake}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#EADFCB]"
              >
                Clear Intake
              </button>
              <a
                href="/planner_contracts.json"
                className="ml-auto text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7a64] underline hover:text-[#c9bba5] transition-colors"
              >
                Planner Contract
              </a>
              <a
                href="/export_targets.json"
                className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7a64] underline hover:text-[#c9bba5] transition-colors"
              >
                Export Targets
              </a>
            </div>
          </div>
        )}

        {activePlannerContract && (
          <div className="rounded-[18px] border border-[#D4A853]/18 bg-[#D4A853]/6 px-4 py-3 font-mono text-[11px] text-[#d8ccb8]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4A853]/10 pb-2 mb-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#D4A853]">
                Active Planner Contract
              </div>
              <span className="rounded-full border border-[#D4A853]/25 bg-[#D4A853]/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-[#fcd34d]">
                {activePlannerContract.state_boundary.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Schema</div>
                  <div className="mt-1 text-[#FAF6EF]">{activePlannerContract.primary_payload_schema_name}</div>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Constraint Source</div>
                  <div className="mt-1 text-[#FAF6EF]">{activePlannerContract.constraint_source}</div>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Export / Handoff</div>
                  <div className="mt-1 text-[#FAF6EF]">{activePlannerContract.export_targets.join(', ') || 'none'} <span className="text-[#8a7a64] mx-1">→</span> {activePlannerContract.safe_handoff_routes.join(', ') || 'none'}</div>
                </div>
              </div>
              <div className="rounded-lg border border-[#34D399]/10 bg-[#34D399]/5 px-3 py-2 flex flex-col justify-center">
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#34D399] mb-1">Intended Use</div>
                <div className="text-[10px] leading-4 text-[#c9bba5]">{activePlannerContract.intended_use}</div>
              </div>
            </div>
          </div>
        )}

        {activeExportTarget && (
          <div className="rounded-[18px] border border-[#60A5FA]/18 bg-[#60A5FA]/6 px-4 py-3 font-mono text-[11px] text-[#d6e6f5]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#60A5FA]/10 pb-2 mb-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#60A5FA]">
                Local Export Contract
              </div>
              <span className="rounded-full border border-[#60A5FA]/25 bg-[#60A5FA]/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-[#BFDBFE]">
                {activeExportTarget.state_boundary.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Export Format</div>
                  <div className="mt-1 text-[#FAF6EF]">{activeExportTarget.format}</div>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Primary Route</div>
                  <div className="mt-1 text-[#FAF6EF]">{activeExportTarget.primary_route}</div>
                </div>
                <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#8a7a64]">Safe Handoff</div>
                  <div className="mt-1 text-[#FAF6EF]">{activeExportTarget.handoff_route} <span className="text-[#8a7a64] mx-1">via</span> {activeExportTarget.machine_surface}</div>
                </div>
              </div>
              <div className="rounded-lg border border-[#34D399]/10 bg-[#34D399]/5 px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#34D399] mb-1">Downstream Examples</div>
                <ul className="space-y-1 text-[10px] leading-4 text-[#c9d9ee]">
                  {activeExportTarget.downstream_examples.map((example) => (
                    <li key={example}>- {example}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-3 text-[10px] leading-4 text-[#a9bfd6]">
              {activeExportTarget.notes}
            </div>
          </div>
        )}

        <section className="rounded-[24px] border border-[#7A9E7E]/20 bg-black/45 p-6 shadow-xl relative overflow-hidden font-mono">
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#7A9E7E]/40" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#7A9E7E]/40" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-[#E8842A]" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FAF6EF]">Local Sequential Drafting Console</h2>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded border border-[#E8842A]/20 bg-[#E8842A]/10 text-[#E8842A]">
              Local session. Not witnessed. Export does not mint receipt.
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4 mb-4">
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Save state</div>
            <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest">
              <span className={`px-2 py-1 rounded border ${
                saveState === 'Saved locally'
                  ? 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]'
                  : saveState === 'Saving...'
                    ? 'border-[#D4A853]/30 bg-[#D4A853]/10 text-[#D4A853]'
                    : 'border-white/10 bg-white/5 text-gray-400'
              }`}>
                {saveState}
              </span>
              {exportNotice && <span className="text-[#D4A853]">{exportNotice}</span>}
            </div>
          </div>

          {draftRecoveryNeeded ? (
            <div className="rounded-[16px] border border-red-500/25 bg-red-500/8 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Draft recovery required</div>
              <p className="mt-2 text-sm leading-6 text-[#d2c5b8]">
                The local draft state in this browser session is malformed or unreadable. The Draft surface is paused so the rest of the workbench stays usable.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={resetLocalDraftState}
                  className="bg-white/5 border border-white/10 text-gray-300 text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                >
                  Reset local draft state
                </button>
                <button
                  onClick={recoverWithEmptyDraft}
                  className="bg-[#E8842A]/20 border border-[#E8842A]/40 text-[#E8842A] text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-[#E8842A]/30 transition-colors"
                >
                  Recover with empty draft
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                  Stage progression is manual. Move forward only when the draft is ready.
                </div>

                <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider">
                  <span className={`px-2.5 py-1 rounded border ${draftStage === 'Rough Cut' ? 'bg-[#E8842A]/20 text-[#E8842A] border-[#E8842A]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Rough Cut</span>
                  <span className="text-gray-600">-&gt;</span>
                  <span className={`px-2.5 py-1 rounded border ${draftStage === 'Smoothed' ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Smoothed</span>
                  <span className="text-gray-600">-&gt;</span>
                  <span className={`px-2.5 py-1 rounded border ${draftStage === 'Sealed' ? 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Sealed</span>
                </div>
              </div>

              {draftMetadata && (
                <div className="mb-4 bg-[#1A1410] border border-[#3D2C1E] rounded-lg px-3 py-2 text-[10px] text-gray-400 flex items-center justify-between">
                  <div>
                    <span className="text-[#D4A853] font-bold">Provenance Intake:</span> {draftMetadata.title} ({draftMetadata.objectId}) • Source: {draftMetadata.source}
                  </div>
                  <div className="text-[9px] bg-[#E8842A]/10 text-[#E8842A] border border-[#E8842A]/20 px-1.5 py-0.5 rounded uppercase font-bold">
                    Linked Context
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="text-[9px] uppercase tracking-widest text-gray-500 block mb-1.5 font-bold">Artifact Name</label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitleValue(e.target.value)}
                  disabled={draftStage === 'Sealed'}
                  className="w-full bg-[#0A0604] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#FAF6EF] focus:outline-none focus:border-[#7A9E7E] disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                  placeholder="E.g., Waterwheel Flow Regulator Spec"
                />
              </div>

              <div className="mb-4">
                <label className="text-[9px] uppercase tracking-widest text-gray-500 block mb-1.5 font-bold">Draft Content (Markdown Supported)</label>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContentForStage(draftStage, e.target.value)}
                  disabled={draftStage === 'Sealed'}
                  rows={6}
                  className="w-full bg-[#0A0604] border border-white/10 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-[#7A9E7E] disabled:opacity-50 disabled:cursor-not-allowed font-mono leading-relaxed resize-y"
                  placeholder="Write design notes, specifications, or paste playground configurations..."
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex gap-2">
                  {draftStage === 'Rough Cut' && (
                    <button
                      onClick={() => {
                        updateDraftState(prev => ({
                          ...prev,
                          active_stage: 'Smoothed',
                          stages: {
                            ...prev.stages,
                            smoothed: prev.stages.rough_cut,
                          },
                        }))
                      }}
                      className="bg-[#D4A853]/20 border border-[#D4A853]/40 text-[#D4A853] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-[#D4A853]/30 transition-colors"
                    >
                      Send to Smoothed
                    </button>
                  )}
                  {draftStage === 'Smoothed' && (
                    <>
                      <button
                        onClick={() => {
                          updateDraftState(prev => ({
                            ...prev,
                            active_stage: 'Rough Cut',
                            stages: {
                              ...prev.stages,
                              rough_cut: prev.stages.smoothed,
                            },
                          }))
                        }}
                        className="bg-white/5 border border-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                      >
                        Re-open as Rough Cut
                      </button>
                      <button
                        onClick={() => {
                          updateDraftState(prev => ({
                            ...prev,
                            active_stage: 'Sealed',
                            stages: {
                              ...prev.stages,
                              sealed: prev.stages.smoothed,
                            },
                          }))
                        }}
                        className="bg-[#34D399]/20 border border-[#34D399]/40 text-[#34D399] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-[#34D399]/30 transition-colors"
                      >
                        Send to Sealed
                      </button>
                    </>
                  )}
                  {draftStage === 'Sealed' && (
                    <button
                      onClick={() => setDraftStageValue('Smoothed')}
                      className="bg-white/5 border border-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                    >
                      Unseal Draft
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(draftContent)
                      setExportNotice('Copied. Local draft remains.')
                    }}
                    className="bg-white/5 border border-white/10 text-gray-300 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                  >
                    Copy Text
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([`# ${draftTitle}\n\n${draftContent}`], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${draftTitle.toLowerCase().replace(/\s+/g, '-')}.md`
                      a.click()
                      URL.revokeObjectURL(url)
                      setExportNotice('Saved as markdown. Local draft remains.')
                    }}
                    className="bg-white/5 border border-white/10 text-gray-300 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                  >
                    Download MD
                  </button>
                  {draftStage === 'Sealed' && (
                    <button
                      onClick={returnToCommons}
                      className="bg-[#E8842A] text-[#0A0402] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-white transition-colors flex items-center gap-1.5"
                    >
                      <ArrowLeftRight className="w-3 h-3" /> Push to Commons (Local Draft)
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500 uppercase tracking-widest font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                  Status: Stage {draftStage} • Local Session Draft
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#E8842A]" />
                  No Multi-user Sync • Export != Cryptographic Receipt
                </div>
              </div>
            </>
          )}
        </section>

        <div className="border-t border-white/5 pt-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7a64] mb-3 font-bold">Playground Toolset</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="rounded-full px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] transition"
                style={{
                  border: tab === t.id ? '1px solid rgba(212,168,83,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: tab === t.id ? 'rgba(212,168,83,0.14)' : 'rgba(255,255,255,0.04)',
                  color: tab === t.id ? '#FAF6EF' : '#8E7E6B',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[20px] border border-white/8 bg-black/30 p-5">
              {tab === 'graphics' && (
                <div className="grid gap-4 font-mono text-sm">
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Scale</span>
                    <input type="range" min={0.4} max={2} step={0.05} value={geoScale} onChange={(e) => setGeoScale(Number(e.target.value))} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Twist</span>
                    <input type="range" min={0} max={6.28} step={0.05} value={geoTwist} onChange={(e) => setGeoTwist(Number(e.target.value))} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Hue</span>
                    <input type="range" min={0} max={360} value={geoHue} onChange={(e) => setGeoHue(Number(e.target.value))} />
                  </label>
                  <div className="h-56 rounded-xl border border-white/8 bg-[#0a0604]">
                    <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
                      <ambientLight intensity={0.6} />
                      <pointLight position={[2, 2, 2]} intensity={1.2} />
                      <PreviewMesh scale={geoScale} twist={geoTwist} hue={geoHue} />
                      <OrbitControls enablePan={false} />
                    </Canvas>
                  </div>
                </div>
              )}

              {tab === 'soulfile' && (
                <div className="grid gap-3 font-mono text-sm">
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulName} onChange={(e) => setSoulName(e.target.value)} placeholder="Agent name" />
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulVoice} onChange={(e) => setSoulVoice(e.target.value)} placeholder="Voice" />
                  <textarea className="min-h-[120px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulRules} onChange={(e) => setSoulRules(e.target.value)} placeholder="Rules (one per line)" />
                </div>
              )}

              {tab === 'memory' && (
                <div className="grid gap-3 font-mono text-sm">
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memKey} onChange={(e) => setMemKey(e.target.value)} placeholder="Key" />
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memValue} onChange={(e) => setMemValue(e.target.value)} placeholder="Value" />
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memTag} onChange={(e) => setMemTag(e.target.value)} placeholder="Tag" />
                </div>
              )}

              {tab === 'blueprint' && (
                <div className="grid gap-3 font-mono text-sm">
                  <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpTitle} onChange={(e) => setBpTitle(e.target.value)} placeholder="Blueprint title" />
                  <select className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpPart} onChange={(e) => setBpPart(e.target.value)}>
                    <option value="flora_flower">flora_flower</option>
                    <option value="water_pool">water_pool</option>
                    <option value="art_frame">art_frame</option>
                    <option value="earthbag_dome">earthbag_dome</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpX} onChange={(e) => setBpX(Number(e.target.value))} placeholder="x" />
                    <input type="number" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpZ} onChange={(e) => setBpZ(Number(e.target.value))} placeholder="z" />
                  </div>
                </div>
              )}

              {tab === 'siteplan' && (
                <ParametricSitePlanner
                  initialIntake={tab === 'siteplan' ? plannerIntake : null}
                  onUpdate={(payload) => {
                    setSitePlanPayload(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                  onValidate={setDraftReport}
                />
              )}

              {tab === 'food_compliance' && (
                <FoodCompliancePlanner
                  initialIntake={tab === 'food_compliance' ? plannerIntake : null}
                  onUpdate={(payload) => {
                    setFoodCompliancePayload(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                  onValidate={setDraftReport}
                />
              )}

              {tab === 'allonic' && (
                <AllonicSchemaAssembler
                  initialIntake={tab === 'allonic' ? plannerIntake : null}
                  onUpdate={(payload) => {
                    setAllonicPayload(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                  onValidate={setDraftReport}
                />
              )}

              {tab === 'facility' && (
                <FacilityBuildPlanner
                  onManifestChange={(payload) => {
                    setFacilityPayload(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                  onValidationChange={setDraftReport}
                />
              )}

              {tab === 'biosystem' && (
                <BiosystemLoopCanvas
                  onUpdate={(payload) => {
                    setBiosystemPayload(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                  onValidate={setDraftReport}
                />
              )}

              {tab === 'stewardship' && (
                <StewardshipJournalManager />
              )}

              {tab === 'workpack' && (
                <PhysicalWorkPackCompiler
                  facilityPayload={facilityPayload}
                  biosystemPayload={biosystemPayload}
                />
              )}

              {tab === 'mason' && (
                <MasonPanel
                  onStamp={(json, hash) => {
                    setExportJson(json)
                    setDigest(hash)
                  }}
                  onUpdate={(payload) => {
                    setMasonBlueprint(payload)
                    setExportJson('')
                    setDigest('')
                  }}
                />
              )}

              {tab !== 'mason' && tab !== 'stewardship' && tab !== 'workpack' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={stamp} className="inline-flex items-center gap-2 rounded-lg bg-[#E8842A] px-4 py-2 font-mono text-[11px] font-semibold text-[#0A0402]">
                    <Box size={14} />
                    Stamp hash
                  </button>
                  <button type="button" onClick={copyAll} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] text-[#c9bba5]">
                    <Copy size={14} />
                    Copy JSON + hash
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const json = JSON.stringify(activePayload, null, 2)
                      const hash = await hashPayload(activePayload)
                      setExportJson(json)
                      setDigest(hash)
                      const blob = new Blob([`${json}\n\ncontent_hash: ${hash}`], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `hearth-workbench-${tab}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] text-[#c9bba5]"
                  >
                    <Download size={14} />
                    Download JSON
                  </button>
                  {tab === 'siteplan' && sitePlanPayload && (
                    <button
                      type="button"
                      onClick={pushSitePlanToCommons}
                      disabled={draftReport?.level === 'hard_fail'}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#34D399]/20 border-[#34D399]/40 text-[#34D399] hover:bg-[#34D399]/30'}`}
                    >
                      <ArrowLeftRight size={14} />
                      Push Plan to Commons (Local Draft)
                    </button>
                  )}
                  {tab === 'food_compliance' && foodCompliancePayload && (
                    <button
                      type="button"
                      onClick={pushFoodComplianceToCommons}
                      disabled={draftReport?.level === 'hard_fail'}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/30'}`}
                    >
                      <ArrowLeftRight size={14} />
                      Push Compliance to Commons (Local Draft)
                    </button>
                  )}
                  {tab === 'allonic' && allonicPayload && (
                    <button
                      type="button"
                      onClick={pushAllonicToCommons}
                      disabled={draftReport?.level === 'hard_fail'}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#8B5CF6]/20 border-[#8B5CF6]/40 text-[#C4B5FD] hover:bg-[#8B5CF6]/30'}`}
                    >
                      <ArrowLeftRight size={14} />
                      Push Blueprint to Commons (Local Draft)
                    </button>
                  )}
                  {tab === 'facility' && facilityPayload && (
                    <button
                      type="button"
                      onClick={pushFacilityToCommons}
                      disabled={draftReport?.level === 'hard_fail'}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#10B981]/20 border-[#10B981]/40 text-[#34D399] hover:bg-[#10B981]/30'}`}
                    >
                      <ArrowLeftRight size={14} />
                      Push Facility Plan to Commons (Local Draft)
                    </button>
                  )}
                  {tab === 'biosystem' && biosystemPayload && (
                    <>
                      <button
                        type="button"
                        onClick={pushBiosystemToForge}
                        disabled={draftReport?.level === 'hard_fail'}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#E8842A]/20 border-[#E8842A]/40 text-[#E8842A] hover:bg-[#E8842A]/30'}`}
                      >
                        <ArrowLeftRight size={14} />
                        Place in Forge for inspection
                      </button>
                      <button
                        type="button"
                        onClick={pushBiosystemToCommons}
                        disabled={draftReport?.level === 'hard_fail'}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-mono text-[11px] font-semibold transition-colors ${draftReport?.level === 'hard_fail' ? 'bg-red-500/10 border-red-500/30 text-red-400 opacity-50 cursor-not-allowed' : draftReport?.level === 'warning' ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24] hover:bg-[#FBBF24]/30' : 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9] hover:bg-[#4A90D9]/30'}`}
                      >
                        <ArrowLeftRight size={14} />
                        Push Biosystem Plan to Commons (Local Draft)
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            {tab !== 'facility' && tab !== 'stewardship' && tab !== 'workpack' && (
              <section className="rounded-[20px] border border-[#D4A853]/15 bg-[#0a0806]/90 flex flex-col overflow-hidden">
                <div className="border-b border-[#D4A853]/15 bg-black/40 px-5 py-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">Human / Machine Mirror</div>
                  {(tab === 'siteplan' || tab === 'food_compliance' || tab === 'allonic') && (
                    <div className="text-[10px] uppercase tracking-[0.18em] font-semibold">
                      {draftReport?.level === 'hard_fail' ? (
                        <span className="text-[#EF4444]">Missing required structure</span>
                      ) : draftReport?.level === 'warning' ? (
                        <span className="text-[#FBBF24]">Review recommended</span>
                      ) : draftReport?.level === 'ok' ? (
                        <span className="text-[#34D399]">Ready for local export</span>
                      ) : (
                        <span className="text-[#8a7a64]">Drafting</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">
                  <div className="p-5 flex flex-col font-sans">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8a7a64] mb-4">Human readable</div>
                    {tab === 'siteplan' && sitePlanPayload ? (
                      <div className="grid gap-3 text-sm text-[#c9bba5]">
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">ID</strong> {sitePlanPayload.module.id}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Type</strong> {sitePlanPayload.module.type}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Material</strong> {sitePlanPayload.module.material}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Dimensions</strong> {sitePlanPayload.module.length_m}m x {sitePlanPayload.module.width_m}m</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Placement</strong> X: {sitePlanPayload.module.zone.x_m}, Z: {sitePlanPayload.module.zone.z_m}</div>
                      </div>
                    ) : tab === 'food_compliance' && foodCompliancePayload ? (
                      <div className="grid gap-3 text-sm text-[#c9bba5]">
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Product</strong> {foodCompliancePayload.product.name}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Producer</strong> {foodCompliancePayload.producer.name}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Status</strong> {foodCompliancePayload.product.eligibility_status}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Ingredients</strong> {foodCompliancePayload.label_draft.ingredients.join(', ')}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Pickup</strong> {foodCompliancePayload.pickup_node.location}</div>
                      </div>
                    ) : tab === 'allonic' && allonicPayload ? (
                      <div className="grid gap-3 text-sm text-[#c9bba5]">
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Name</strong> {allonicPayload.blueprint.name}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Intended Use</strong> {allonicPayload.blueprint.intended_use}</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Mass</strong> {allonicPayload.summary.total_mass_kg} kg</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Power</strong> {allonicPayload.summary.net_power_draw_watts} W</div>
                        <div><strong className="text-white block text-[11px] uppercase tracking-wider text-[#D4A853]">Modules</strong> {allonicPayload.summary.module_count} active modules</div>
                      </div>
                    ) : (
                      <div className="text-sm text-[#6b5d4b] italic">
                        Interact with the playground toolset to generate a human-readable summary.
                      </div>
                    )}
                  </div>
                  <div className="p-5 font-mono flex flex-col bg-black/40">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7a64] mb-4">Machine manifest</div>
                    {digest && (
                      <div className="mb-3 rounded-lg border border-[#34D399]/25 bg-[#34D399]/8 px-3 py-2 text-[#86efac] text-[11px]">
                        receipt_hash: {digest}
                      </div>
                    )}
                    <pre className="flex-1 overflow-auto rounded-lg border border-white/5 bg-transparent p-0 text-[#b89c82] leading-relaxed text-[11px]">
                      {exportJson || JSON.stringify(activePayload, null, 2)}
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {tab !== 'stewardship' && tab !== 'workpack' && (
              <section className="rounded-[20px] border border-[#60A5FA]/15 bg-[#08101a]/90 p-5 font-mono">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-[#93C5FD]">
                      Specification // Post-Scarcity Ledger
                    </div>
                    <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#c5d7e8]">
                      Draft schema for future local resource accounting. This is a planning contract only.
                      It is not a live ledger, not a settlement surface, and not connected to checkout or witness flows.
                    </p>
                  </div>
                  <a
                    href="/mutual_credit_pool.schema.json"
                    className="rounded-full border border-[#60A5FA]/25 bg-[#60A5FA]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BFDBFE] no-underline hover:bg-[#60A5FA]/20 transition-colors"
                  >
                    Open raw schema
                  </a>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3 text-[10px] text-[#d7e4ef]">
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="uppercase tracking-[0.16em] text-[#8fb5d9]">Boundary</div>
                    <div className="mt-1 text-[#FAF6EF]">Specification only</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="uppercase tracking-[0.16em] text-[#8fb5d9]">Current use</div>
                    <div className="mt-1 text-[#FAF6EF]">Reviewer and builder reference</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                    <div className="uppercase tracking-[0.16em] text-[#8fb5d9]">Not included</div>
                    <div className="mt-1 text-[#FAF6EF]">No balances, no clearing, no payments</div>
                  </div>
                </div>

                <pre className="mt-4 overflow-auto rounded-lg border border-white/8 bg-black/30 p-4 text-[11px] leading-relaxed text-[#b7d0e6]">
                  {MUTUAL_CREDIT_SCHEMA_PREVIEW}
                </pre>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}



