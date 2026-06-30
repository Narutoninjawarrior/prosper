/**
 * creativity.ts — deterministic experiment suggester for agent discovery.
 * No LLM curation: ranks combinatorial experiments from registry rules + world snapshot.
 */
import * as crypto from 'crypto';
import { previewMix } from './chemistry';

export type CreativeExperiment = {
  experiment_id: string;
  kind: 'chemistry' | 'duel' | 'ceremony' | 'blueprint' | 'pipeline';
  title: string;
  why_now: string;
  apparatus_id: string;
  mcp_tool: string;
  rest_endpoint: string;
  suggested_inputs: Record<string, unknown>;
  follow_up?: Array<{ mcp_tool: string; suggested_inputs: Record<string, unknown> }>;
  expected_receipt: string;
  novelty_score: number;
};

export type CreativityContext = {
  tick: number;
  heat: number;
  ember_balance: number;
  state_hash: string;
  biosphere_nodes?: Array<{ active: boolean; bloomStage: number }>;
  weather?: string;
};

export type CreativitySuggestReceipt = {
  suggest: 'creativity-suggest-v1';
  tick: number;
  state_hash: string;
  hum_seed: number;
  experiments: CreativeExperiment[];
  excluded_experiment_ids: number;
  suggest_hash: string;
  note: string;
};

const REAGENT_KEYS = [
  'ember_dust', 'salt', 'ash', 'pollen', 'moonstone', 'chain_dust',
  'brine', 'lightning', 'soil', 'void', 'moonstone_brine', 'pollen_mist',
];

const DUEL_MOVES = ['salt', 'stone', 'pollen'] as const;

const SYNERGY_BLUEPRINT = {
  schema: 'workshop-v1',
  title: 'Flora-Water Synergy Garden',
  author: 'creativity-forge',
  parts: [
    { part_id: 'water_pool', position: { x: 0, z: 0 }, rotation_deg: 0, config: {} },
    { part_id: 'flora_flower', position: { x: 1, z: 0 }, rotation_deg: 0, config: {} },
  ],
  tags: ['synergy', 'suggest'],
};

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function hashNibble(hash: string, index: number): number {
  return parseInt(hash.charAt(index % hash.length), 16);
}

function scoreExperiment(state: CreativityContext, seed: string, richness: number): number {
  const base = hashNibble(state.state_hash, hashNibble(seed, 0)) * 7
    + hashNibble(seed, 2) * 3
    + richness * 10;
  let bonus = 0;
  if (state.heat > 3000 && (seed.includes('ash') || seed.includes('brine'))) bonus += 12;
  if (state.heat < 2500 && seed.includes('ember')) bonus += 8;
  const blooms = (state.biosphere_nodes ?? []).filter((n) => n.bloomStage > 0).length;
  const active = (state.biosphere_nodes ?? []).filter((n) => n.active).length;
  if (blooms < active / 2 && (seed.includes('flora') || seed.includes('pollen'))) bonus += 15;
  if (state.weather === 'rain' && seed.includes('water')) bonus += 6;
  return base + bonus;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

export function suggestCreativity(
  state: CreativityContext,
  limit = 8,
  excludedExperimentIds: ReadonlySet<string> = new Set(),
): CreativitySuggestReceipt {
  const hum_seed = (state.tick % 432) / 432;
  const experiments: CreativeExperiment[] = [];

  // Chemistry pairs — rank by preview richness
  for (let i = 0; i < REAGENT_KEYS.length; i += 1) {
    for (let j = i + 1; j < REAGENT_KEYS.length; j += 1) {
      const a = REAGENT_KEYS[i];
      const b = REAGENT_KEYS[j];
      const target = a.includes('pollen') || b.includes('pollen') ? 'flora' : 'any';
      const preview = previewMix(a, b, target);
      if (preview.actions.length === 0) continue;
      const id = `chem_${pairKey(a, b)}`;
      experiments.push({
        experiment_id: id,
        kind: 'chemistry',
        title: `Mix ${a} with ${b}`,
        why_now: `${preview.actions.length} deterministic action(s) on target "${target}"`,
        apparatus_id: 'reagent_alembic',
        mcp_tool: 'hearthlands_preview_chemistry',
        rest_endpoint: 'POST /api/chemistry/preview',
        suggested_inputs: { reagent_a: a, reagent_b: b, target_type: target },
        expected_receipt: 'chemistry-preview-receipt',
        novelty_score: scoreExperiment(state, id, preview.actions.length),
      });
    }
  }

  // Duel move grid (explorer agents — bots substitute their ids)
  for (const move_a of DUEL_MOVES) {
    for (const move_b of DUEL_MOVES) {
      const id = `duel_${move_a}_${move_b}`;
      experiments.push({
        experiment_id: id,
        kind: 'duel',
        title: `Duel: ${move_a} vs ${move_b}`,
        why_now: 'Salt dissolves stone · stone crushes pollen · pollen seeds salt',
        apparatus_id: 'duel_pit',
        mcp_tool: 'hearthlands_duel_resolve',
        rest_endpoint: 'POST /api/duel/resolve',
        suggested_inputs: {
          agent_a: 'explorer_a',
          agent_b: 'explorer_b',
          move_a,
          move_b,
        },
        expected_receipt: 'duel_receipt-v1',
        novelty_score: scoreExperiment(state, id, 1),
      });
    }
  }

  // Ceremony at tick harmonic
  experiments.push({
    experiment_id: 'ceremony_tick_hum',
    kind: 'ceremony',
    title: 'Cook hearth meal at tick harmonic',
    why_now: `Tick ${state.tick} sets hum ${hum_seed.toFixed(3)} from world pulse`,
    apparatus_id: 'ceremony_hearth',
    mcp_tool: 'hearthlands_hearth_ceremony',
    rest_endpoint: 'GET /api/hearth/ceremony',
    suggested_inputs: { hum: hum_seed },
    expected_receipt: 'hearth-meal-v1',
    novelty_score: scoreExperiment(state, 'ceremony', 3),
  });

  // Synergy blueprint
  experiments.push({
    experiment_id: 'blueprint_synergy_garden',
    kind: 'blueprint',
    title: 'Validate flora–water synergy layout',
    why_now: 'Workshop rules emit C_SYNERGY_FLORA_WATER when flora and water neighbor',
    apparatus_id: 'validator_bench',
    mcp_tool: 'hearthlands_validate_blueprint',
    rest_endpoint: 'POST /api/workshop/validate',
    suggested_inputs: { blueprint: SYNERGY_BLUEPRINT, mode: 'validation' },
    expected_receipt: 'workshop-receipt-v1',
    novelty_score: scoreExperiment(state, 'blueprint_synergy', 4),
  });

  // Pipeline: tick change → ceremony (agent automation pattern)
  experiments.push({
    experiment_id: 'pipeline_tick_to_meal',
    kind: 'pipeline',
    title: 'Poll tick, then cook meal if state shifted',
    why_now: 'Automation beacon pattern for creative loops without world writes',
    apparatus_id: 'automation_beacon',
    mcp_tool: 'hearthlands_world_tick',
    rest_endpoint: 'GET /api/world/tick',
    suggested_inputs: { last_hash: state.state_hash },
    follow_up: [
      {
        mcp_tool: 'hearthlands_hearth_ceremony',
        suggested_inputs: { hum: hum_seed },
      },
    ],
    expected_receipt: 'pipeline-receipt-v1',
    novelty_score: scoreExperiment(state, 'pipeline', 5),
  });

  const pool = excludedExperimentIds.size > 0
    ? experiments.filter((exp) => !excludedExperimentIds.has(exp.experiment_id))
    : experiments;

  pool.sort((a, b) => b.novelty_score - a.novelty_score || a.experiment_id.localeCompare(b.experiment_id));

  const cap = Math.max(1, Math.min(limit, 100));
  const selected: CreativeExperiment[] = [];
  const seenKinds = new Set<string>();
  for (const exp of pool) {
    if (selected.length >= cap) break;
    if (!seenKinds.has(exp.kind)) {
      selected.push(exp);
      seenKinds.add(exp.kind);
    }
  }
  for (const exp of pool) {
    if (selected.length >= cap) break;
    if (!selected.some((s) => s.experiment_id === exp.experiment_id)) selected.push(exp);
  }

  const suggest_hash = sha256Hex(stableStringify({
    tick: state.tick,
    state_hash: state.state_hash,
    hum_seed,
    excluded_experiment_ids: [...excludedExperimentIds].sort(),
    experiment_ids: selected.map((e) => e.experiment_id),
  }));

  const exclusionNote = excludedExperimentIds.size > 0
    ? `${excludedExperimentIds.size} logged experiment_id(s) excluded from this suggest.`
    : 'No logged exclusions yet — log experiments via POST /api/experiment/log after verifying receipts.';

  return {
    suggest: 'creativity-suggest-v1',
    tick: state.tick,
    state_hash: state.state_hash,
    hum_seed,
    experiments: selected,
    excluded_experiment_ids: excludedExperimentIds.size,
    suggest_hash,
    note: `Deterministic combinatorial suggestions. No LLM curation. ${exclusionNote}`,
  };
}
