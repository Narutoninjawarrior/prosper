/**
 * @file stewardshipJournal.ts
 * @version 1.0.0
 * @description Longitudinal stewardship journal schema, validation, and conversion utilities.
 */

import type { PhysicalWorkPackV1, StopConditionV1 } from './physicalWorkPack';

export interface MeasurementV1 {
  metric_name: string;
  value: number;
  unit: string;
}

export interface CareOptionV1 {
  option_id: string;
  label: string;
  description: string;
  estimated_labor_hours: number;
  stop_conditions: StopConditionV1[];
}

export interface ModelProposalV1 {
  proposal_id: string;
  model_provider: string; // e.g. "Google", "Meta", "Anthropic", "Local"
  model_name: string;      // e.g. "Gemma-2B", "Llama-3-8B"
  model_version: string;   // e.g. "v1.2.0"
  care_options: CareOptionV1[];
  suggested_option_id?: string;
  model_reported_uncertainty: number; // Must be between 0.0 and 1.0
  reasoning: string;
}

export interface PredictionV1 {
  metric_name: string;
  predicted_value_range_min: number;
  predicted_value_range_max: number;
  metric_unit: string;
  time_horizon: string; // ISO 8601 target time or duration description
}

export interface DecisionV1 {
  selected_option: string; // "REFUSE_ALL" or the specific CareOptionV1.option_id
  reasoning: string;
  approved_by_human: boolean; // True = approved, False = dismissed/rejected
  reviewed_by_steward_id: string;
}

export interface OutcomeV1 {
  observed_at: string; // ISO timestamp
  observation_source: string; // operator ID or sensor ID
  metric_name: string;
  observed_value: number;
  metric_unit: string;
  calculated_prediction_error?: number | null; // (observed - predicted) absolute or delta
  correction_notes?: string;
}

export interface ModelReplacementRecordV1 {
  previous_model: string;
  current_model: string;
  transition_timestamp: string;
  reason_for_replacement: string;
}

export interface StewardshipJournalEntryV1 {
  entry_id: string;
  observation_id: string; // First-class observation identifier
  living_asset_id: string; // e.g. "cacao-tree-04" or "aquaponics-bed-01"
  steward_continuity_id: string; // steward session/operator ID
  data_freshness_seconds: number;
  observation: {
    timestamp: string; // ISO 8601
    source: string; // operator or sensor
    measurements: MeasurementV1[];
  };
  model_proposal: ModelProposalV1;
  prediction?: PredictionV1;
  decision?: DecisionV1;
  outcome?: OutcomeV1;
  model_replacement?: ModelReplacementRecordV1;
  meta?: Record<string, string>;
}

export interface JournalValidationError {
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface StewardshipStorageEnvelopeV1 {
  schema_version: 1;
  schema: 'stewardship-journal-envelope-v1';
  journal_id: string;
  storage_scope: string;
  entries: StewardshipJournalEntryV1[];
  updated_at: string;
}

export function parseAndValidateEnvelope(rawJson: string): { envelope: StewardshipStorageEnvelopeV1 | null; errors: JournalValidationError[]; malformed: boolean } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { envelope: null, errors: [{ field: 'root', message: 'Not a valid JSON object.', level: 'error' }], malformed: true };
    }
    
    let schema_version = 1;
    let journal_id = 'local-default-journal';
    let storage_scope = 'browser-local';
    let entries: any[] = [];
    let updated_at = new Date().toISOString();

    // Check if it's a legacy raw array
    if (Array.isArray(parsed)) {
      entries = parsed;
    } else {
      if (parsed.schema !== 'stewardship-journal-envelope-v1') {
        return { envelope: null, errors: [{ field: 'schema', message: 'Invalid schema name.', level: 'error' }], malformed: true };
      }

      schema_version = parsed.schema_version || parsed.version || 1;
      if (schema_version !== 1) {
        return { envelope: null, errors: [{ field: 'schema_version', message: `Unsupported envelope version: ${schema_version}`, level: 'error' }], malformed: true };
      }

      journal_id = parsed.journal_id || 'local-default-journal';
      storage_scope = parsed.storage_scope || 'browser-local';
      updated_at = parsed.updated_at || new Date().toISOString();

      if (!Array.isArray(parsed.entries)) {
        return { envelope: null, errors: [{ field: 'entries', message: 'Entries must be an array.', level: 'error' }], malformed: true };
      }
      entries = parsed.entries;
    }

    // Map entries to ensure backward compatibility for observation_id
    const migratedEntries = entries.map((entry: any) => ({
      ...entry,
      observation_id: entry.observation_id || `obs-${entry.entry_id || Date.now()}`
    }));

    const errors: JournalValidationError[] = [];
    migratedEntries.forEach((entry: any, idx: number) => {
      const entryErrors = validateStewardshipJournalEntry(entry);
      entryErrors.forEach(err => {
        errors.push({
          field: `entries[${idx}].${err.field}`,
          message: err.message,
          level: err.level
        });
      });
    });

    const envelope: StewardshipStorageEnvelopeV1 = {
      schema_version: 1,
      schema: 'stewardship-journal-envelope-v1',
      journal_id,
      storage_scope,
      entries: migratedEntries,
      updated_at
    };

    return {
      envelope,
      errors,
      malformed: false
    };
  } catch (err: any) {
    return { envelope: null, errors: [{ field: 'json_parse', message: err.message || 'JSON parsing failed', level: 'error' }], malformed: true };
  }
}


/**
 * Validates a StewardshipJournalEntryV1 against scientific and logical invariants.
 */
export function validateStewardshipJournalEntry(entry: StewardshipJournalEntryV1): JournalValidationError[] {
  const errors: JournalValidationError[] = [];

  // ID checks
  if (!entry.entry_id || !entry.entry_id.trim()) {
    errors.push({ field: 'entry_id', message: 'Journal Entry ID is required.', level: 'error' });
  }
  if (!entry.observation_id || !entry.observation_id.trim()) {
    errors.push({ field: 'observation_id', message: 'Observation ID is required.', level: 'error' });
  }
  if (!entry.living_asset_id || !entry.living_asset_id.trim()) {
    errors.push({ field: 'living_asset_id', message: 'Living Asset ID is required.', level: 'error' });
  }
  if (!entry.steward_continuity_id || !entry.steward_continuity_id.trim()) {
    errors.push({ field: 'steward_continuity_id', message: 'Steward Continuity ID is required.', level: 'error' });
  }

  // Observation checks
  if (!entry.observation) {
    errors.push({ field: 'observation', message: 'Observation details are required.', level: 'error' });
  } else {
    if (!entry.observation.timestamp || !entry.observation.timestamp.trim()) {
      errors.push({ field: 'observation.timestamp', message: 'Observation timestamp is required.', level: 'error' });
    }
    if (!entry.observation.source || !entry.observation.source.trim()) {
      errors.push({ field: 'observation.source', message: 'Observation source is required.', level: 'error' });
    }
  }

  // Uncertainty checks
  if (entry.model_proposal) {
    const uncertainty = entry.model_proposal.model_reported_uncertainty;
    if (typeof uncertainty !== 'number' || isNaN(uncertainty) || !isFinite(uncertainty) || uncertainty < 0 || uncertainty > 1) {
      errors.push({
        field: 'model_proposal.model_reported_uncertainty',
        message: 'Uncertainty must be a model-reported number between 0 and 1 inclusive.',
        level: 'error'
      });
    }
  }

  // Refusal checks
  if (entry.decision) {
    if (entry.decision.selected_option === 'REFUSE_ALL') {
      if (!entry.decision.reasoning || !entry.decision.reasoning.trim()) {
        errors.push({
          field: 'decision.reasoning',
          message: 'Refusal of care options requires a stated reasoning.',
          level: 'error'
        });
      }
    }
  }

  // Outcome chronometer checks
  if (entry.outcome && entry.observation && entry.observation.timestamp) {
    const obsTime = new Date(entry.observation.timestamp).getTime();
    const outcomeTime = new Date(entry.outcome.observed_at).getTime();
    if (!isNaN(obsTime) && !isNaN(outcomeTime) && outcomeTime < obsTime) {
      errors.push({
        field: 'outcome.observed_at',
        message: 'Outcome observation timestamp cannot predate the initial observation timestamp.',
        level: 'error'
      });
    }
  }

  // Mismatched metrics checks (calculation error safety)
  if (entry.outcome && entry.prediction) {
    const metricsMatch = entry.prediction.metric_name === entry.outcome.metric_name;
    const unitsMatch = entry.prediction.metric_unit === entry.outcome.metric_unit;
    if (!metricsMatch || !unitsMatch) {
      if (entry.outcome.calculated_prediction_error !== undefined && entry.outcome.calculated_prediction_error !== null) {
        errors.push({
          field: 'outcome.calculated_prediction_error',
          message: 'Prediction error cannot be calculated when prediction and outcome metrics or units do not match.',
          level: 'error'
        });
      }
    }
  }

  // Scientific boundary warnings (no claim to machine consciousness / memory)
  const auditString = JSON.stringify(entry).toLowerCase();
  const forbiddenKeywords = ['feel', 'happy', 'sad', 'scared', 'hurt', 'consciousness', 'remembers', 'autobiographical'];
  forbiddenKeywords.forEach(word => {
    if (auditString.includes(word)) {
      errors.push({
        field: 'metadata',
        message: `Stewardship records must not claim machine feelings, autobiographical memory, or consciousness. Detected usage of: "${word}"`,
        level: 'warning'
      });
    }
  });

  return errors;
}

/**
 * Compiles a CareOptionV1 from a Journal Entry into a DRAFT Operational Work Card contract.
 * Enforces that it remains a DRAFT and never triggers execution or carries approval signatures.
 */
export function compileStewardshipToWorkCard(
  entry: StewardshipJournalEntryV1,
  option: CareOptionV1
): PhysicalWorkPackV1 {
  return {
    id: `wcard-stewardship-${entry.entry_id}-${option.option_id}`,
    version: 'v1.0.0',
    facility_reference: {
      facility_id: '',
      facility_title: ''
    },
    target_assets: [entry.living_asset_id],
    task: {
      description: `Stewardship Care Action: ${option.label} - ${option.description}`,
      task_class: 'maintenance'
    },
    proposed_operator: {
      type: 'human',
      required_role_or_qualification: 'Conservatory Steward'
    },
    spatial_boundary: {
      facility_zone: ''
    },
    resource_requirements: {
      materials: [],
      tools: [],
      estimated_labor_hours: option.estimated_labor_hours
    },
    constraints: {
      safety_limits: [],
      stop_conditions: option.stop_conditions || []
    },
    dependencies: [
      `Journal Entry Reference: ${entry.entry_id}`,
      `Steward Continuity ID: ${entry.steward_continuity_id}`
    ],
    prerequisite_work_card_ids: [],
    approvals: {}, // ALWAYS empty for DRAFT Work Cards
    status: 'DRAFT', // ALWAYS DRAFT
    truth_boundary: 'DRAFT/PROPOSED local planning draft only. Compiled from Stewardship Care Option. Not live execution command.',
    domain_extensions: {}
  };
}
