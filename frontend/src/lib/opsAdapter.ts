export interface HearthOpsMeta {
  schema: string;
  generated_at: string;
  origin: string;
  truth_boundary: string;
}

export interface Asset {
  asset_id: string;
  name: string;
  type: string;
  status: string;
  facility_id: string;
  created_at: string;
}

export interface Observation {
  observation_id: string;
  asset_id: string;
  steward_id: string;
  timestamp: string;
  source: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string;
}

export interface WorkCard {
  work_card_id: string;
  asset_id: string;
  observation_id: string;
  label: string;
  description: string;
  estimated_labor_hours: number;
  status: string;
  operator_type: string;
  qualification: string;
  task_class: string;
  tools: string[];
  materials: string[];
  safety_limits: string[];
}

export interface DecisionTrace {
  decision_id: string;
  work_card_id: string;
  operator_approved: boolean;
  reasoning: string;
  reviewed_by: string;
  reviewed_at: string;
}

export interface Outcome {
  outcome_id: string;
  work_card_id: string;
  observed_at: string;
  metric_name: string;
  observed_value: number;
  metric_unit: string;
  calculated_prediction_error: number;
  notes: string;
}

export interface OpsViewModel {
  meta: HearthOpsMeta;
  assets: Asset[];
  observations: Observation[];
  work_cards: WorkCard[];
  decision_traces: DecisionTrace[];
  outcomes: Outcome[];
}

export function normalizeOpsData(raw: any): OpsViewModel | { error: string } {
  if (!raw) return { error: 'NO_RECORDS' };

  if (raw.schema === 'stewardship-journal-envelope-v1') {
    if (!raw.entries || raw.entries.length === 0) return { error: 'NO_RECORDS' };
    
    const assetsMap = new Map<string, Asset>();
    const observations: Observation[] = [];
    const work_cards: WorkCard[] = [];
    const decision_traces: DecisionTrace[] = [];
    const outcomes: Outcome[] = [];

    for (const entry of raw.entries) {
      if (!assetsMap.has(entry.living_asset_id)) {
          assetsMap.set(entry.living_asset_id, {
            asset_id: entry.living_asset_id,
            name: entry.living_asset_id,
            type: 'unknown',
            status: 'active',
            facility_id: 'unknown',
            created_at: entry.observation?.timestamp || new Date().toISOString()
          });
      }

      if (entry.observation) {
          for (const m of entry.observation.measurements || []) {
            observations.push({
              observation_id: entry.observation_id || `obs-${entry.entry_id}`,
              asset_id: entry.living_asset_id,
              steward_id: entry.steward_continuity_id,
              timestamp: entry.observation.timestamp,
              source: entry.observation.source,
              metric_name: m.metric_name,
              metric_value: m.value,
              metric_unit: m.unit
            });
          }
      }

      if (entry.model_proposal && entry.decision) {
          const wcId = `wc-${entry.entry_id}`;
          const selectedOpt = entry.model_proposal.care_options?.find((o: any) => o.option_id === entry.decision.selected_option);
          
          work_cards.push({
            work_card_id: wcId,
            asset_id: entry.living_asset_id,
            observation_id: entry.observation_id || `obs-${entry.entry_id}`,
            label: selectedOpt?.label || (entry.decision.selected_option === 'REFUSE_ALL' ? 'Refused Action' : 'Unknown Action'),
            description: selectedOpt?.description || entry.decision.reasoning || 'No specific care option selected',
            estimated_labor_hours: selectedOpt?.estimated_labor_hours || 0,
            status: entry.decision.approved_by_human ? 'REVIEWED' : 'pending',
            operator_type: 'human',
            qualification: 'Conservatory Steward',
            task_class: 'maintenance',
            tools: [],
            materials: [],
            safety_limits: (selectedOpt?.stop_conditions || []).map((s: any) => s.description)
          });

          decision_traces.push({
            decision_id: `dec-${entry.entry_id}`,
            work_card_id: wcId,
            operator_approved: entry.decision.approved_by_human,
            reasoning: entry.decision.reasoning,
            reviewed_by: entry.decision.reviewed_by_steward_id,
            reviewed_at: entry.observation?.timestamp || new Date().toISOString()
          });

          if (entry.outcome) {
            outcomes.push({
              outcome_id: `out-${entry.entry_id}`,
              work_card_id: wcId,
              observed_at: entry.outcome.observed_at,
              metric_name: entry.outcome.metric_name,
              observed_value: entry.outcome.observed_value,
              metric_unit: entry.outcome.metric_unit,
              calculated_prediction_error: entry.outcome.calculated_prediction_error || 0,
              notes: entry.outcome.correction_notes || ''
            });
          }
      }
    }

    return {
        meta: {
          schema: 'stewardship-journal-envelope-v1',
          generated_at: raw.updated_at || new Date().toISOString(),
          origin: 'Frontend Journal Export',
          truth_boundary: 'Real exported local operational journal. Read-only.'
        },
        assets: Array.from(assetsMap.values()),
        observations,
        work_cards,
        decision_traces,
        outcomes
    };
  }

  // SQLite hearth-ops export fallback
  if (raw.assets && Array.isArray(raw.assets) && raw.assets.length > 0) {
    const assets: Asset[] = [];
    const observations: Observation[] = [];
    const work_cards: WorkCard[] = [];
    const decision_traces: DecisionTrace[] = [];
    const outcomes: Outcome[] = [];
    
    for (const a of raw.assets) {
        if (a.asset) assets.push(a.asset);
        if (a.observations) observations.push(...a.observations);
        for (const wc of (a.work_cards || [])) {
          const { decision_traces: dt, outcomes: oc, ...wcCore } = wc;
          
          const safeParse = (val: any) => {
              if (typeof val === 'string') {
                try { return JSON.parse(val); } catch { return []; }
              }
              return val || [];
          };

          const parsedWc: WorkCard = {
              ...wcCore,
              tools: safeParse(wcCore.tools_json),
              materials: safeParse(wcCore.materials_json),
              safety_limits: safeParse(wcCore.safety_limits_json),
          };
          work_cards.push(parsedWc);
          if (dt) decision_traces.push(...dt);
          if (oc) outcomes.push(...oc);
        }
    }
    
    return {
        meta: {
          schema: `PhysicalWorkPackV1 (Export ${raw.export_version || '1.0'})`,
          generated_at: new Date().toISOString(),
          origin: 'hearth-ops SQLite Export',
          truth_boundary: 'Real exported local operational journal. Read-only.'
        },
        assets,
        observations,
        work_cards,
        decision_traces,
        outcomes
    };
  }

  return { error: 'UNKNOWN_SCHEMA' };
}
