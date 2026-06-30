import * as crypto from 'crypto';

export type ChemistryPreviewReceipt = {
  reagent_a: string;
  reagent_b: string;
  target_type: string;
  actions: ReagentActionPreview[];
  receipt_hash: string;
  note: string;
};

export type ReagentActionPreview = {
  type: string;
  effect: string;
  detail: any;
};

// Simplified interactions map cloned from reagentRegistry
const INTERACTIONS: Record<string, { targetType: string, effect: string, action: any }[]> = {
  'ember_dust': [
    { targetType: 'flora', effect: 'Warm water accelerates plant growth by 1 stage', action: { type: 'grow_flora', stages: 1 } },
    { targetType: 'lodge', effect: 'Ember-tinted water casts warm glow on nearby art frames', action: { type: 'tint_artframe', color: '#E8842A' } }
  ],
  'salt': [
    { targetType: 'any', effect: 'Salt crystals precipitate on nearby surfaces when water evaporates', action: { type: 'salt_crystal', probability: 0.15 } },
    { targetType: 'water', effect: 'Mixing salt + ember dust produces superheated Brine', action: { type: 'mix_substance', resultId: 7, resultKey: 'brine' } }
  ],
  'ash': [
    { targetType: 'flora', effect: 'Ash-water fertilizes soil, adds +2 growth stages to nearby flora', action: { type: 'grow_flora', stages: 2 } }
  ],
  'pollen': [
    { targetType: 'flora', effect: 'Pollen in water creates a growth feedback loop — connected plants bloom faster', action: { type: 'grow_flora', stages: 1 } },
    { targetType: 'any', effect: 'Emits flora growth signal to all nearby world nodes', action: { type: 'signal', signalType: 'flora_growth' } }
  ],
  'moonstone': [],
  'chain_dust': [
    { targetType: 'lodge', effect: 'Chain dust tints nearby art frames with the hash color signature', action: { type: 'tint_artframe', color: '#AA88FF' } }
  ],
  'brine': [
    { targetType: 'flora', effect: 'Too hot — scorches flora. Reduces growth by 1 stage.', action: { type: 'grow_flora', stages: -1 } }
  ],
  'lightning': [],
  'soil': [
    { targetType: 'flora', effect: 'Soil-water is the most fertile — adds +3 growth stages', action: { type: 'grow_flora', stages: 3 } }
  ],
  'void': [],
  'moonstone_brine': [
    { targetType: 'water', effect: 'Instantly crystallizes water to geometric moonstone lattice', action: { type: 'mix_substance', resultKey: 'moonstone_lattice' } }
  ],
  'pollen_mist': [
    { targetType: 'flora', effect: 'Synergistic growth burst from aerosolized pollen', action: { type: 'grow_flora', stages: 4 } }
  ]
};

function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return 'null';
}

function sha256Hex(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function previewMix(reagent_a: string, reagent_b: string, target_type: string = 'any'): ChemistryPreviewReceipt {
  const actions: ReagentActionPreview[] = [];
  
  const rulesA = INTERACTIONS[reagent_a] || [];
  const rulesB = INTERACTIONS[reagent_b] || [];
  
  const applicableA = rulesA.filter(r => r.targetType === 'any' || r.targetType === target_type || r.targetType === reagent_b);
  const applicableB = rulesB.filter(r => r.targetType === 'any' || r.targetType === target_type || r.targetType === reagent_a);
  
  for (const r of [...applicableA, ...applicableB]) {
    actions.push({
      type: r.action.type,
      effect: r.effect,
      detail: r.action
    });
  }
  
  if (reagent_a === 'salt' && reagent_b === 'ember_dust') {
    actions.push({
      type: 'mix_substance',
      effect: 'Mixing salt + ember dust produces superheated Brine',
      detail: { type: 'mix_substance', resultKey: 'brine' }
    });
  }

  // Deduplicate
  const uniqueActions = actions.filter((v, i, a) => a.findIndex(t => t.type === v.type && t.effect === v.effect) === i);

  const payload = {
    reagent_a,
    reagent_b,
    target_type,
    actions: uniqueActions,
  };
  
  const receipt_hash = sha256Hex(stableStringify(payload));
  
  return {
    ...payload,
    receipt_hash,
    note: "Preview receipt only. No world state mutated.",
  };
}
