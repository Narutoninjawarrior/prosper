/**
 * experimentLog.ts — pure helpers for signed experiment witness logs.
 * No Firebase imports.
 */
import * as crypto from 'crypto';

export const EXPERIMENT_LOG_VERSION = 'experiment-log-v1';

export type ExperimentKind =
  | 'chemistry'
  | 'duel'
  | 'ceremony'
  | 'blueprint'
  | 'pipeline';

export type ExperimentLogInput = {
  agent_id: string;
  public_key: string;
  signature: string;
  receipt_hash: string;
  experiment_id: string;
  kind: ExperimentKind;
  apparatus_id: string;
};

export type ExperimentLogReceipt = {
  log: typeof EXPERIMENT_LOG_VERSION;
  receipt_hash: string;
  experiment_id: string;
  kind: ExperimentKind;
  apparatus_id: string;
  agent_id: string;
  log_hash: string;
  note: string;
};

const KINDS = new Set<ExperimentKind>([
  'chemistry', 'duel', 'ceremony', 'blueprint', 'pipeline',
]);

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

export function buildLogSignPayload(input: Omit<ExperimentLogInput, 'signature'>): string {
  return stableStringify({
    agent_id: input.agent_id,
    receipt_hash: input.receipt_hash,
    experiment_id: input.experiment_id,
    kind: input.kind,
    apparatus_id: input.apparatus_id,
  });
}

export function validateExperimentLogInput(body: unknown): { ok: true; value: ExperimentLogInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be a JSON object' };
  const record = body as Record<string, unknown>;
  const required = ['agent_id', 'public_key', 'signature', 'receipt_hash', 'experiment_id', 'kind', 'apparatus_id'];
  for (const key of required) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) {
      return { ok: false, error: `missing or invalid field: ${key}` };
    }
  }
  if (!KINDS.has(record.kind as ExperimentKind)) {
    return { ok: false, error: 'kind must be chemistry, duel, ceremony, blueprint, or pipeline' };
  }
  if (record.agent_id !== record.public_key) {
    return { ok: false, error: 'agent_id must equal public_key for signed agent logs' };
  }
  if (!/^[a-f0-9]{64}$/.test(record.receipt_hash as string)) {
    return { ok: false, error: 'receipt_hash must be a 64-char lowercase hex SHA-256 digest' };
  }
  return {
    ok: true,
    value: {
      agent_id: record.agent_id as string,
      public_key: record.public_key as string,
      signature: record.signature as string,
      receipt_hash: record.receipt_hash as string,
      experiment_id: record.experiment_id as string,
      kind: record.kind as ExperimentKind,
      apparatus_id: record.apparatus_id as string,
    },
  };
}

export function buildLogReceipt(input: Omit<ExperimentLogInput, 'signature'>): ExperimentLogReceipt {
  const log_hash = sha256Hex(stableStringify({
    receipt_hash: input.receipt_hash,
    experiment_id: input.experiment_id,
    kind: input.kind,
    apparatus_id: input.apparatus_id,
    agent_id: input.agent_id,
  }));
  return {
    log: EXPERIMENT_LOG_VERSION,
    receipt_hash: input.receipt_hash,
    experiment_id: input.experiment_id,
    kind: input.kind,
    apparatus_id: input.apparatus_id,
    agent_id: input.agent_id,
    log_hash,
    note: 'Experiment witnessed in the discovery log. No world write performed.',
  };
}
