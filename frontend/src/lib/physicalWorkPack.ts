import { sha256Hex, stableStringify } from './grace';

/**
 * @file physicalWorkPack.ts
 * @version 1.0.0
 * @description Standard schema, validation, and serialization layer for PhysicalWorkPackV1 (Operational Work Card).
 */

export type WorkPackStatus = 'DRAFT' | 'REVIEWED' | 'AUTHORIZED' | 'COMPLETED';
export type OperatorType = 'human' | 'AI' | 'robot' | 'team';

export interface StopConditionV1 {
  condition_id: string;
  description: string;
  required_response: string;
}

export interface PhysicalWorkPackV1 {
  id: string;
  version: 'v1.0.0';
  facility_reference: {
    facility_id: string;
    facility_title: string;
  };
  target_assets: string[];
  task: {
    description: string;
    task_class: string; // e.g. "install", "inspection", "maintenance"
  };
  proposed_operator: {
    type: OperatorType;
    required_role_or_qualification: string;
  };
  spatial_boundary: {
    coordinates?: string;
    facility_zone: string;
  };
  resource_requirements: {
    materials: string[];
    tools: string[];
    estimated_labor_hours: number;
  };
  constraints: {
    safety_limits: string[];
    stop_conditions: StopConditionV1[];
  };
  prerequisite_work_card_ids: string[];
  dependencies: string[];
  approvals: {
    reviewed_by?: string;
    reviewed_at?: string;
    authorized_by?: string;
    authorized_at?: string;
  };
  status: WorkPackStatus;
  truth_boundary: string;
  domain_extensions: {
    construction?: {
      building_code_reference?: string;
      structural_inspection_required?: boolean;
    };
    biological?: {
      species?: string;
      cultivar?: string;
      health_metric_target?: string;
    };
    robotic?: {
      command_vocabulary?: string[];
      max_payload_kg?: number;
      safe_state_mode?: string;
    };
  };
  prerequisite_validation_context?: {
    validation_context_source: string;
    validation_context_generated_at?: string;
    validation_context_completed_card_count: number;
  };
}

export interface WorkPackValidationError {
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface WorkPackValidationContext {
  completed_work_card_ids?: string[];
  source?: 'Published local journal export' | 'Legacy local fallback' | 'No completion context loaded';
  generatedAt?: string;
}

export interface WorkPackRevisionEnvelope {
  schema_version: 'v1';
  planner_type: 'workpack_revision';
  work_card_id: string;
  source: string;
  note?: string;
  baseline_content_hash: string;
  revised_content_hash: string;
  changed_fields: string[];
  change_details: WorkPackChangeDetail[];
  exported_at: string;
  payload: PhysicalWorkPackV1;
}

export interface WorkPackChangeDetail {
  field: string;
  before: string;
  after: string;
}

export function buildWorkPackTruthBoundary(status: WorkPackStatus): string {
  switch (status) {
    case 'AUTHORIZED':
      return 'AUTHORIZED local planning draft. Bounded to safe zones and approved for defined downstream handoff. Not an engineering certification, and does not authorize automated real-world execution without direct operator control.';
    case 'REVIEWED':
      return 'REVIEWED local planning draft. Checked against structure or biosystem constraints. Awaiting final authorized steward handoff before any queue staging.';
    case 'COMPLETED':
      return 'COMPLETED local work record. Field outcome has been recorded in a local operations context. This artifact documents a finished lifecycle state, not an autonomous execution command.';
    case 'DRAFT':
    default:
      return 'DRAFT/PROPOSED local planning draft only. Not live execution command.';
  }
}

/**
 * Resolves the completed card context from known local artifacts (like ops journal).
 * Falls back to legacy sessionStorage if the structured artifact is missing.
 */
export async function resolveLocalCompletedWorkCards(): Promise<WorkPackValidationContext> {
  let ids: string[] = [];
  let source: 'Published local journal export' | 'Legacy local fallback' | 'No completion context loaded' = 'No completion context loaded';
  let generatedAt: string | undefined = undefined;

  try {
    // Attempt to read from the published local ops journal (normalized truth)
    const res = await fetch('/journal_export.json', { cache: 'no-store' });
    if (res.ok) {
      const raw = await res.json();
      
      if (raw.updated_at) {
        generatedAt = raw.updated_at;
      } else if (raw.meta && raw.meta.generated_at) {
        generatedAt = raw.meta.generated_at;
      }

      // Basic inline traversal (avoids circular deps with opsAdapter)
      if (raw.entries && Array.isArray(raw.entries)) {
        raw.entries.forEach((entry: any) => {
          if (entry.decision && entry.decision.approved_by_human) {
             // In the journal, a completed card would ideally have an outcome or explicit status. 
             // We'll mark it completed if it has an outcome recorded.
             if (entry.outcome) {
               ids.push(`wc-${entry.entry_id}`);
             }
          }
        });
        source = 'Published local journal export';
      } else if (raw.assets && Array.isArray(raw.assets)) {
        raw.assets.forEach((a: any) => {
          if (a.work_cards && Array.isArray(a.work_cards)) {
            a.work_cards.forEach((wc: any) => {
              if (wc.status === 'COMPLETED') ids.push(wc.work_card_id);
            });
          }
        });
        source = 'Published local journal export';
      }
    }
  } catch {
    // Silently proceed to fallback
  }

  // Legacy fallback
  if (ids.length === 0 && typeof window !== 'undefined' && window.sessionStorage) {
    const legacy = window.sessionStorage.getItem('hearth_workbench_completed_cards');
    if (legacy) {
      try { 
        ids = JSON.parse(legacy);
        source = 'Legacy local fallback';
      } catch {}
    }
  }

  return { 
    completed_work_card_ids: ids,
    source,
    generatedAt
  };
}

/**
 * Parses a JSON object as a completed card context (journal export format).
 * Returns WorkPackValidationContext if valid, or an error object.
 */
export function parseCompletedWorkCardsFromJson(raw: any, filename: string): WorkPackValidationContext | { error: string } {
  let ids: string[] = [];
  let generatedAt: string | undefined = undefined;

  try {
    if (raw.updated_at) {
      generatedAt = raw.updated_at;
    } else if (raw.meta && raw.meta.generated_at) {
      generatedAt = raw.meta.generated_at;
    }

    if (raw.entries && Array.isArray(raw.entries)) {
      raw.entries.forEach((entry: any) => {
        if (entry.decision && entry.decision.approved_by_human) {
           if (entry.outcome) {
             ids.push(`wc-${entry.entry_id}`);
           }
        }
      });
      return {
        completed_work_card_ids: ids,
        source: `Loaded local completion file: ${filename}` as any,
        generatedAt
      };
    } else if (raw.assets && Array.isArray(raw.assets)) {
      raw.assets.forEach((a: any) => {
        if (a.work_cards && Array.isArray(a.work_cards)) {
          a.work_cards.forEach((wc: any) => {
            if (wc.status === 'COMPLETED') ids.push(wc.work_card_id);
          });
        }
      });
      return {
        completed_work_card_ids: ids,
        source: `Loaded local completion file: ${filename}` as any,
        generatedAt
      };
    }
  } catch {}

  return { error: 'Completion context load failed: unsupported local journal format.' };
}

function looksLikePhysicalWorkPack(raw: any): raw is PhysicalWorkPackV1 {
  return !!raw
    && typeof raw === 'object'
    && typeof raw.id === 'string'
    && raw.version === 'v1.0.0'
    && !!raw.facility_reference
    && typeof raw.facility_reference.facility_id === 'string'
    && typeof raw.facility_reference.facility_title === 'string'
    && !!raw.task
    && typeof raw.task.description === 'string'
    && typeof raw.task.task_class === 'string'
    && !!raw.proposed_operator
    && typeof raw.proposed_operator.type === 'string'
    && typeof raw.proposed_operator.required_role_or_qualification === 'string'
    && !!raw.spatial_boundary
    && typeof raw.spatial_boundary.facility_zone === 'string'
    && !!raw.resource_requirements
    && typeof raw.resource_requirements.estimated_labor_hours === 'number'
    && !!raw.constraints
    && Array.isArray(raw.target_assets)
    && typeof raw.status === 'string'
    && ['DRAFT', 'REVIEWED', 'AUTHORIZED', 'COMPLETED'].includes(raw.status);
}

export function parsePhysicalWorkPackFromJson(raw: any): PhysicalWorkPackV1 | { error: string } {
  try {
    let candidate = raw;

    if (
      raw
      && typeof raw === 'object'
      && raw.schema_version === 'v1'
      && raw.planner_type === 'workpack'
      && raw.payload
    ) {
      candidate = raw.payload;
    }

    if (!looksLikePhysicalWorkPack(candidate)) {
      return { error: 'Work card load failed: unsupported local work card format.' };
    }

    return {
      ...candidate,
      target_assets: Array.isArray(candidate.target_assets) ? candidate.target_assets : [],
      resource_requirements: {
        materials: Array.isArray(candidate.resource_requirements?.materials) ? candidate.resource_requirements.materials : [],
        tools: Array.isArray(candidate.resource_requirements?.tools) ? candidate.resource_requirements.tools : [],
        estimated_labor_hours: candidate.resource_requirements?.estimated_labor_hours ?? 0
      },
      constraints: {
        safety_limits: Array.isArray(candidate.constraints?.safety_limits) ? candidate.constraints.safety_limits : [],
        stop_conditions: Array.isArray(candidate.constraints?.stop_conditions) ? candidate.constraints.stop_conditions : []
      },
      prerequisite_work_card_ids: Array.isArray(candidate.prerequisite_work_card_ids) ? candidate.prerequisite_work_card_ids : [],
      dependencies: Array.isArray(candidate.dependencies) ? candidate.dependencies : [],
      approvals: candidate.approvals && typeof candidate.approvals === 'object' ? candidate.approvals : {},
      truth_boundary: typeof candidate.truth_boundary === 'string'
        ? candidate.truth_boundary
        : buildWorkPackTruthBoundary(candidate.status),
      domain_extensions: candidate.domain_extensions && typeof candidate.domain_extensions === 'object'
        ? candidate.domain_extensions
        : {}
    };
  } catch {
    return { error: 'Work card load failed: unsupported local work card format.' };
  }
}

const WORKPACK_DIFF_FIELDS: Array<{ label: string; select: (pack: PhysicalWorkPackV1) => unknown }> = [
  { label: 'status', select: (pack) => pack.status },
  { label: 'facility_reference', select: (pack) => pack.facility_reference },
  { label: 'target_assets', select: (pack) => pack.target_assets },
  { label: 'task', select: (pack) => pack.task },
  { label: 'proposed_operator', select: (pack) => pack.proposed_operator },
  { label: 'spatial_boundary', select: (pack) => pack.spatial_boundary },
  { label: 'resource_requirements', select: (pack) => pack.resource_requirements },
  { label: 'constraints', select: (pack) => pack.constraints },
  { label: 'prerequisite_work_card_ids', select: (pack) => pack.prerequisite_work_card_ids },
  { label: 'dependencies', select: (pack) => pack.dependencies },
  { label: 'approvals', select: (pack) => pack.approvals },
  { label: 'domain_extensions', select: (pack) => pack.domain_extensions },
];

function formatWorkPackDiffValue(value: unknown): string {
  if (value == null) return 'Not set';
  if (typeof value === 'string') return value.trim() ? value : 'Not set';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    // Array of stop conditions
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'condition_id' in value[0]) {
      return value.map((c: any) => `[${c.condition_id}] ${c.description} → ${c.required_response}`).join('\n');
    }
    return value.join(', ');
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return '(empty)';

    // task
    if ('description' in obj && 'task_class' in obj && Object.keys(obj).length <= 2) {
      return [`Description: ${obj.description ?? 'Not set'}`, `Task Class: ${obj.task_class ?? 'Not set'}`].join('\n');
    }
    // facility_reference
    if ('facility_id' in obj && 'facility_title' in obj && Object.keys(obj).length <= 2) {
      return [`Facility ID: ${obj.facility_id ?? 'Not set'}`, `Title: ${obj.facility_title ?? 'Not set'}`].join('\n');
    }
    // proposed_operator
    if ('type' in obj && 'required_role_or_qualification' in obj && Object.keys(obj).length <= 2) {
      return [`Type: ${obj.type ?? 'Not set'}`, `Qualification: ${obj.required_role_or_qualification ?? 'Not set'}`].join('\n');
    }
    // resource_requirements
    if ('estimated_labor_hours' in obj && ('materials' in obj || 'tools' in obj)) {
      const lines: string[] = [];
      lines.push(`Est. Labor: ${obj.estimated_labor_hours} hrs`);
      if ('materials' in obj) lines.push(`Materials: ${Array.isArray(obj.materials) ? (obj.materials.length ? obj.materials.join(', ') : '(none)') : String(obj.materials ?? 'Not set')}`);
      if ('tools' in obj) lines.push(`Tools: ${Array.isArray(obj.tools) ? (obj.tools.length ? obj.tools.join(', ') : '(none)') : String(obj.tools ?? 'Not set')}`);
      return lines.join('\n');
    }
    // spatial_boundary
    if ('facility_zone' in obj) {
      const lines: string[] = [`Zone: ${obj.facility_zone ?? 'Not set'}`];
      if ('coordinates' in obj && obj.coordinates) lines.push(`Coordinates: ${obj.coordinates}`);
      return lines.join('\n');
    }
    // constraints (safety_limits + stop_conditions)
    if ('safety_limits' in obj || 'stop_conditions' in obj) {
      const lines: string[] = [];
      if (Array.isArray(obj.safety_limits)) {
        lines.push(`Safety Limits: ${obj.safety_limits.length ? obj.safety_limits.join('; ') : '(none)'}`);
      }
      if (Array.isArray(obj.stop_conditions)) {
        if (obj.stop_conditions.length === 0) {
          lines.push('Stop Conditions: (none)');
        } else {
          lines.push('Stop Conditions:');
          (obj.stop_conditions as any[]).forEach((c: any) => {
            lines.push(`  [${c.condition_id}] ${c.description} → ${c.required_response}`);
          });
        }
      }
      return lines.join('\n');
    }
    // approvals
    if ('reviewed_by' in obj || 'authorized_by' in obj) {
      const lines: string[] = [];
      if (obj.reviewed_by) lines.push(`Reviewed by: ${obj.reviewed_by}${obj.reviewed_at ? ` on ${obj.reviewed_at}` : ''}`);
      if (obj.authorized_by) lines.push(`Authorized by: ${obj.authorized_by}${obj.authorized_at ? ` on ${obj.authorized_at}` : ''}`);
      return lines.length ? lines.join('\n') : '(no approvals)';
    }
    // domain_extensions: flatten one level down
    if ('construction' in obj || 'biological' in obj || 'robotic' in obj) {
      const lines: string[] = [];
      const c = obj.construction as any;
      const b = obj.biological as any;
      const r = obj.robotic as any;
      if (c) {
        if (c.building_code_reference) lines.push(`Building Code: ${c.building_code_reference}`);
        if (c.structural_inspection_required !== undefined) lines.push(`Structural Inspection Required: ${c.structural_inspection_required}`);
      }
      if (b) {
        if (b.species) lines.push(`Species: ${b.species}`);
        if (b.cultivar) lines.push(`Cultivar: ${b.cultivar}`);
        if (b.health_metric_target) lines.push(`Health Target: ${b.health_metric_target}`);
      }
      if (r) {
        if (r.command_vocabulary) lines.push(`Commands: ${Array.isArray(r.command_vocabulary) ? r.command_vocabulary.join(', ') : r.command_vocabulary}`);
        if (r.max_payload_kg !== undefined) lines.push(`Max Payload: ${r.max_payload_kg} kg`);
        if (r.safe_state_mode) lines.push(`Safe State Mode: ${r.safe_state_mode}`);
      }
      return lines.length ? lines.join('\n') : '(empty extensions)';
    }
  }

  return stableStringify(value);
}

export function getWorkPackChangedFields(before: PhysicalWorkPackV1, after: PhysicalWorkPackV1): string[] {
  return WORKPACK_DIFF_FIELDS
    .filter(({ select }) => stableStringify(select(before)) !== stableStringify(select(after)))
    .map(({ label }) => label);
}

export function getWorkPackChangeDetails(before: PhysicalWorkPackV1, after: PhysicalWorkPackV1): WorkPackChangeDetail[] {
  return WORKPACK_DIFF_FIELDS
    .filter(({ select }) => stableStringify(select(before)) !== stableStringify(select(after)))
    .map(({ label, select }) => ({
      field: label,
      before: formatWorkPackDiffValue(select(before)),
      after: formatWorkPackDiffValue(select(after)),
    }));
}

export async function buildWorkPackRevisionEnvelope(
  before: PhysicalWorkPackV1,
  after: PhysicalWorkPackV1,
  source: string,
  note?: string | null
): Promise<WorkPackRevisionEnvelope> {
  const baselineStable = stableStringify(before);
  const revisedStable = stableStringify(after);
  const changeDetails = getWorkPackChangeDetails(before, after);

  return {
    schema_version: 'v1',
    planner_type: 'workpack_revision',
    work_card_id: after.id,
    source,
    ...(note ? { note } : {}),
    baseline_content_hash: await sha256Hex(baselineStable),
    revised_content_hash: await sha256Hex(revisedStable),
    changed_fields: changeDetails.map((detail) => detail.field),
    change_details: changeDetails,
    exported_at: new Date().toISOString(),
    payload: after,
  };
}

/**
 * Validates a PhysicalWorkPackV1 against strict structural and safety constraints.
 */
export function validatePhysicalWorkPack(pack: PhysicalWorkPackV1, context?: WorkPackValidationContext): WorkPackValidationError[] {
  const errors: WorkPackValidationError[] = [];

  // 1. Basic properties & Identification
  if (!pack.id) {
    errors.push({ field: 'id', message: 'Work-pack ID is required.', level: 'error' });
  }
  if (!pack.version || pack.version !== 'v1.0.0') {
    errors.push({ field: 'version', message: 'Version must be v1.0.0.', level: 'error' });
  }

  // 2. Required Fields
  if (!pack.facility_reference.facility_id || !pack.facility_reference.facility_id.trim()) {
    errors.push({ field: 'facility_reference.facility_id', message: 'Facility ID is required.', level: 'error' });
  }
  if (!pack.facility_reference.facility_title || !pack.facility_reference.facility_title.trim()) {
    errors.push({ field: 'facility_reference.facility_title', message: 'Facility Title is required.', level: 'error' });
  }

  if (!pack.task.description || !pack.task.description.trim()) {
    errors.push({ field: 'task.description', message: 'Task description is required.', level: 'error' });
  }
  if (!pack.task.task_class || !pack.task.task_class.trim()) {
    errors.push({ field: 'task.task_class', message: 'Task class is required.', level: 'error' });
  }

  if (!pack.target_assets || pack.target_assets.length === 0) {
    errors.push({ field: 'target_assets', message: 'At least one target asset is required.', level: 'error' });
  }

  if (!pack.proposed_operator.required_role_or_qualification || !pack.proposed_operator.required_role_or_qualification.trim()) {
    errors.push({ field: 'proposed_operator.required_role_or_qualification', message: 'Operator qualification is required.', level: 'error' });
  }

  const estHours = pack.resource_requirements.estimated_labor_hours;
  if (typeof estHours !== 'number' || isNaN(estHours) || !isFinite(estHours) || estHours < 0) {
    errors.push({ field: 'resource_requirements.estimated_labor_hours', message: 'Estimated labor hours must be a non-negative finite number.', level: 'error' });
  }

  if (!pack.spatial_boundary || !pack.spatial_boundary.facility_zone || !pack.spatial_boundary.facility_zone.trim()) {
    errors.push({ field: 'spatial_boundary.facility_zone', message: 'Spatial zone is required.', level: 'error' });
  }

  if (!pack.constraints.stop_conditions || pack.constraints.stop_conditions.length === 0) {
    errors.push({ field: 'constraints.stop_conditions', message: 'At least one stop condition is required.', level: 'error' });
  } else {
    pack.constraints.stop_conditions.forEach((c, idx) => {
      if (!c.condition_id || !c.condition_id.trim()) {
        errors.push({ field: `constraints.stop_conditions[${idx}].condition_id`, message: 'Stop condition ID is required.', level: 'error' });
      }
      if (!c.description || !c.description.trim()) {
        errors.push({ field: `constraints.stop_conditions[${idx}].description`, message: 'Stop condition description is required.', level: 'error' });
      }
      if (!c.required_response || !c.required_response.trim()) {
        errors.push({ field: `constraints.stop_conditions[${idx}].required_response`, message: 'Stop condition required response is required.', level: 'error' });
      }
    });
  }

  // 3. Status & Approval workflow validation (Lifecycle Transitions)
  if (pack.status === 'DRAFT') {
    if (pack.approvals.reviewed_by || pack.approvals.reviewed_at) {
      errors.push({
        field: 'approvals',
        message: 'DRAFT status must not contain review records.',
        level: 'error',
      });
    }
    if (pack.approvals.authorized_by || pack.approvals.authorized_at) {
      errors.push({
        field: 'approvals',
        message: 'DRAFT status must not contain authorization records.',
        level: 'error',
      });
    }
  } else if (pack.status === 'REVIEWED') {
    if (!pack.approvals.reviewed_by || !pack.approvals.reviewed_by.trim()) {
      errors.push({
        field: 'approvals.reviewed_by',
        message: 'REVIEWED status requires reviewer identifier (reviewed_by).',
        level: 'error',
      });
    }
    if (!pack.approvals.reviewed_at || !pack.approvals.reviewed_at.trim()) {
      errors.push({
        field: 'approvals.reviewed_at',
        message: 'REVIEWED status requires review timestamp (reviewed_at).',
        level: 'error',
      });
    }
    if (pack.approvals.authorized_by || pack.approvals.authorized_at) {
      errors.push({
        field: 'approvals',
        message: 'REVIEWED status must not contain authorization records.',
        level: 'error',
      });
    }
  } else if (pack.status === 'AUTHORIZED') {
    if (!pack.approvals.reviewed_by || !pack.approvals.reviewed_by.trim()) {
      errors.push({
        field: 'approvals.reviewed_by',
        message: 'AUTHORIZED status requires prior review (reviewed_by).',
        level: 'error',
      });
    }
    if (!pack.approvals.reviewed_at || !pack.approvals.reviewed_at.trim()) {
      errors.push({
        field: 'approvals.reviewed_at',
        message: 'AUTHORIZED status requires prior review timestamp (reviewed_at).',
        level: 'error',
      });
    }
    if (!pack.approvals.authorized_by || !pack.approvals.authorized_by.trim()) {
      errors.push({
        field: 'approvals.authorized_by',
        message: 'AUTHORIZED status requires responsible authorizer identifier (authorized_by).',
        level: 'error',
      });
    }
    if (!pack.approvals.authorized_at || !pack.approvals.authorized_at.trim()) {
      errors.push({
        field: 'approvals.authorized_at',
        message: 'AUTHORIZED status requires authorization timestamp (authorized_at).',
        level: 'error',
      });
    }
  } else if (pack.status === 'COMPLETED') {
    if (!pack.approvals.reviewed_by || !pack.approvals.reviewed_by.trim()) {
      errors.push({
        field: 'approvals.reviewed_by',
        message: 'COMPLETED status requires prior review (reviewed_by).',
        level: 'error',
      });
    }
    if (!pack.approvals.reviewed_at || !pack.approvals.reviewed_at.trim()) {
      errors.push({
        field: 'approvals.reviewed_at',
        message: 'COMPLETED status requires prior review timestamp (reviewed_at).',
        level: 'error',
      });
    }
  }

  // 4. Robotic safety constraints
  if (pack.proposed_operator.type === 'robot') {
    const robExt = pack.domain_extensions.robotic;
    if (!robExt) {
      errors.push({
        field: 'domain_extensions.robotic',
        message: 'Robotic work requires robotic domain extension details.',
        level: 'error',
      });
    } else {
      if (!robExt.command_vocabulary || robExt.command_vocabulary.length === 0) {
        errors.push({
          field: 'domain_extensions.robotic.command_vocabulary',
          message: 'Robotic work requires a command vocabulary.',
          level: 'error',
        });
      }
      if (!robExt.safe_state_mode || !robExt.safe_state_mode.trim()) {
        errors.push({
          field: 'domain_extensions.robotic.safe_state_mode',
          message: 'Robotic work requires a safe state mode.',
          level: 'error',
        });
      }
    }
  }

  // 5. Dependency / Prerequisite checks
  if (pack.prerequisite_work_card_ids && pack.prerequisite_work_card_ids.length > 0) {
    pack.prerequisite_work_card_ids.forEach((reqId, idx) => {
      if (!reqId || !reqId.trim()) {
        errors.push({ field: `prerequisite_work_card_ids[${idx}]`, message: 'Prerequisite work card ID cannot be empty.', level: 'error' });
      } else {
        const isCompleted = context && context.completed_work_card_ids && context.completed_work_card_ids.includes(reqId);
        if (!isCompleted) {
          errors.push({
            field: `prerequisite_work_card_ids[${idx}]`,
            message: `Dependency unresolved: prerequisite work card not completed.`,
            level: 'error'
          });
        }
      }
    });
  }

  return errors;
}

/**
 * Compiles a PhysicalWorkPackV1 into a human-readable Markdown brief.
 */
export function compileWorkPackMarkdown(pack: PhysicalWorkPackV1): string {
  const checkSymbol = (val: any) => (val ? ' [X] ' : ' [ ] ');
  
  return `# OPERATIONAL WORK BRIEF: ${pack.task.description.toUpperCase()}
**Work Card ID:** ${pack.id} (Schema ${pack.version})
**Status:** \`${pack.status}\`

---

## 1. Context & Boundaries
*   **Facility / Project Reference:** ${pack.facility_reference.facility_title} (${pack.facility_reference.facility_id})
*   **Spatial Boundary:** Zone \`${pack.spatial_boundary.facility_zone}\` ${pack.spatial_boundary.coordinates ? `(${pack.spatial_boundary.coordinates})` : ''}
*   **Target Assets:** ${pack.target_assets.length > 0 ? pack.target_assets.join(', ') : 'None specified'}
*   **Task Class:** \`${pack.task.task_class}\`

## 2. Operator & Assignment
*   **Proposed Operator Type:** ${pack.proposed_operator.type.toUpperCase()}
*   **Required Role / Qualifications:** ${pack.proposed_operator.required_role_or_qualification}

## 3. Resource Requirements
*   **Materials:**
${pack.resource_requirements.materials.length > 0 ? pack.resource_requirements.materials.map(m => `    - ${m}`).join('\n') : '    - None'}
*   **Tools Required:**
${pack.resource_requirements.tools.length > 0 ? pack.resource_requirements.tools.map(t => `    - ${t}`).join('\n') : '    - None'}
*   **Estimated Labor:** ${pack.resource_requirements.estimated_labor_hours} hours

## 4. Safety & Invariants
*   **Safety Limits:**
${pack.constraints.safety_limits.length > 0 ? pack.constraints.safety_limits.map(s => `    - ${s}`).join('\n') : '    - Standard operating rules apply.'}
*   **Stop / Emergency Conditions:**
${pack.constraints.stop_conditions.length > 0 ? pack.constraints.stop_conditions.map(c => `    - **[${c.condition_id}]** ${c.description} (Response: ${c.required_response})`).join('\n') : '    - None'}

## 5. Pre-Requisites & Dependencies
${pack.prerequisite_work_card_ids && pack.prerequisite_work_card_ids.length > 0 ? pack.prerequisite_work_card_ids.map(id => `*   [REQUIRED PRIOR CARD] ${id}`).join('\n') : ''}
${pack.dependencies.length > 0 ? pack.dependencies.map(d => `*   ${d}`).join('\n') : (pack.prerequisite_work_card_ids && pack.prerequisite_work_card_ids.length > 0 ? '' : '*   None')}

## 6. Approval Records
*   ${checkSymbol(pack.approvals.reviewed_by)} **Reviewed By:** ${pack.approvals.reviewed_by || 'Pending'} ${pack.approvals.reviewed_at ? `on ${pack.approvals.reviewed_at}` : ''}
*   ${checkSymbol(pack.approvals.authorized_by)} **Authorized By:** ${pack.approvals.authorized_by || 'Pending'} ${pack.approvals.authorized_at ? `on ${pack.approvals.authorized_at}` : ''}

## 7. Prerequisite Validation Context
*   **Validation Context Source:** ${pack.prerequisite_validation_context?.validation_context_source || 'No completion context loaded'}
*   **Completed Card Count:** ${pack.prerequisite_validation_context?.validation_context_completed_card_count ?? 0}
${pack.prerequisite_validation_context?.validation_context_generated_at ? `*   **Snapshot Generated:** ${pack.prerequisite_validation_context.validation_context_generated_at}\n` : ''}

---
**TRUTH BOUNDARY NOTICE:**
*${pack.truth_boundary}*
`;
}
