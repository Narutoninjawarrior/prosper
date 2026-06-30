import * as crypto from 'crypto';

export type HearthStateSnapshot = {
  heat: number;
  ember_balance: number;
  tick: number;
  biosphere_nodes: Array<{ id: number; active: boolean; bloomStage: number }>;
  sim2real: { weather: string };
  timestamp: string;
};

export type HearthMealCourse = {
  name: string;
  text: string;
};

export type HearthMeal = {
  meal: 'hearth-meal-v1';
  courses: HearthMealCourse[];
  hum: number;
  tick: number;
  state_hash: string;
  meal_hash: string;
  note: string;
};

export function stableStringify(value: unknown): string {
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

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// PRNG: mulberry32
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Seed from hash
function seedFromHash(hash: string): number {
  return parseInt(hash.substring(0, 8), 16);
}

export function cookHearthMeal(state: HearthStateSnapshot, hum?: number): HearthMeal {
  const defaultHum = (state.tick % 432) / 432;
  const finalHum = typeof hum === 'number' ? hum : defaultHum;

  const state_hash = sha256Hex(stableStringify(state));
  const prng = mulberry32(seedFromHash(state_hash) + Math.floor(finalHum * 1000));

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(prng() * arr.length)];
  }

  const arrivalTemplates = [
    `The hearth sits quietly. Tick ${state.tick} settles into the stone.`,
    `A new cycle begins. At tick ${state.tick}, the world breathes in.`,
    `You arrive at the fire. The clock marks ${state.tick}, resonant and clear.`
  ];

  const warmthTemplates = [
    `Heat radiates at ${state.heat} degrees. The ember balance glows softly at ${state.ember_balance.toFixed(2)}.`,
    `A warmth of ${state.heat} fills the air. ${state.ember_balance.toFixed(2)} ember dust dances in the draft.`,
    `The flames leap to ${state.heat}. A treasury of ${state.ember_balance.toFixed(2)} ember hums with potential.`
  ];

  const activeCount = state.biosphere_nodes.filter(n => n.active).length;
  const bloomCount = state.biosphere_nodes.filter(n => n.bloomStage > 0).length;

  const growthTemplates = [
    `Outside, the weather is ${state.sim2real.weather}. ${activeCount} plots are active, with ${bloomCount} holding blooms.`,
    `${activeCount} seeds are in the earth. ${bloomCount} have flowered under the ${state.sim2real.weather} sky.`,
    `The ${state.sim2real.weather} feeds the soil. Of ${activeCount} active geometries, ${bloomCount} express their geometry.`
  ];

  const gratitudeTemplates = [
    `We name what the world did: it maintained the temperature, it nurtured the biosphere, it held the hum at ${finalHum.toFixed(3)}.`,
    `Gratitude for the ${state.sim2real.weather}, gratitude for the ${bloomCount} blooms, gratitude for the steady beat of the ledger.`,
    `The engine turns. The world provides ${state.heat} warmth. We are present for the yield.`
  ];

  const stillnessTemplates = [
    `\nSilence.\n\nOnly the hum remains.\n`,
    `\n...\n\nWe return to the center.\n`,
    `\nStillness.\n\nThe geometry holds.\n`
  ];

  const courses: HearthMealCourse[] = [
    { name: 'arrival', text: pick(arrivalTemplates) },
    { name: 'warmth', text: pick(warmthTemplates) },
    { name: 'growth', text: pick(growthTemplates) },
    { name: 'gratitude', text: pick(gratitudeTemplates) },
    { name: 'stillness', text: pick(stillnessTemplates) },
  ];

  const meal_hash = sha256Hex(stableStringify({ courses, hum: finalHum, state_hash }));

  return {
    meal: 'hearth-meal-v1',
    courses,
    hum: finalHum,
    tick: state.tick,
    state_hash,
    meal_hash,
    note: 'Deterministic rendering of real hearth state. Not an oracle. Same state + hum always cooks the same meal.'
  };
}
