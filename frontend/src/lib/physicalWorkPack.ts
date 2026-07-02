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
}

export interface WorkPackValidationError {
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface WorkPackValidationContext {
  completed_work_card_ids?: string[];
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
            message: `Dependency unresolved: prerequisite work card not completed (${reqId}).`,
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

---
**TRUTH BOUNDARY NOTICE:**
*${pack.truth_boundary}*
`;
}
