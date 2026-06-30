import * as crypto from 'crypto';

export type DuelInput = {
  agent_a: string;
  agent_b: string;
  move_a: 'salt' | 'stone' | 'pollen';
  move_b: 'salt' | 'stone' | 'pollen';
  duel_id?: string;
};

export type DuelReceipt = {
  duel_id: string;
  agents: [string, string];
  moves: [string, string];
  winner: string | 'draw';
  receipt_hash: string;
  note: string;
  timestamp: string;
};

// salt dissolves stone
// stone crushes pollen
// pollen seeds salt
const RULES: Record<string, string> = {
  'salt': 'stone',
  'stone': 'pollen',
  'pollen': 'salt'
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

export function resolveDuel(input: DuelInput): DuelReceipt {
  let winner: string | 'draw' = 'draw';
  
  if (input.move_a !== input.move_b) {
    if (RULES[input.move_a] === input.move_b) {
      winner = input.agent_a;
    } else if (RULES[input.move_b] === input.move_a) {
      winner = input.agent_b;
    }
  }

  const payload = {
    duel_id: input.duel_id || `duel_${Date.now()}`,
    agents: [input.agent_a, input.agent_b],
    moves: [input.move_a, input.move_b],
    winner,
    note: 'no ember moved',
    timestamp: new Date().toISOString(),
  };

  const receipt_hash = sha256Hex(stableStringify(payload));

  return {
    ...payload,
    receipt_hash
  } as DuelReceipt;
}
