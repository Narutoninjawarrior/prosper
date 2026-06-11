import { useEffect, useMemo, useState } from 'react';
import { sha256Hex, stableStringify } from './grace';
import type {
  MemberContract,
  RoomContract,
  QuestContract,
  ArtifactContract,
  ToolContract,
  InterfaceModuleContract,
  LodgeAppContract,
  ValidationResult,
} from './contracts';
import {
  validateMember as readMember,
  validateRoom as readRoom,
  validateQuest as readQuest,
  validateArtifact as readArtifact,
  validateTool as readTool,
  validateInterfaceModule as readInterfaceModule,
  validateLodgeApp as readLodgeApp,
} from './contracts';

/** Shown in UI; never paste raw fetch URLs, stack traces, or validator internals here. */
export const CONTRACT_USER_ERROR = {
  loadFailed: 'Could not load lodge data.',
  missingSignature: 'Missing manifest signature.',
  verificationFailed: 'Verification failed.',
} as const;

export type ContractState = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export type ContractEnvelope<T> = {
  source: string;
  data: T;
  hash: string;
  loadedAt: string;
  state: ContractState;
  verified: boolean;
  manifestHash?: string;
  error?: string;
};

// Re-export type parameters so dependent components compile without any changes
export type {
  MemberContract,
  RoomContract,
  QuestContract,
  ArtifactContract,
  ToolContract,
  InterfaceModuleContract,
  LodgeAppContract,
  ValidationResult,
};

type MemberSeed = { members?: unknown; manifest_hash?: unknown };
type RoomSeed = { rooms?: unknown; manifest_hash?: unknown };
type QuestSeed = { quests?: unknown; manifest_hash?: unknown };
type ArtifactSeed = { records?: unknown; manifest_hash?: unknown };
type ToolSeed = { records?: unknown; manifest_hash?: unknown };
type InterfaceModuleSeed = { records?: unknown; manifest_hash?: unknown };
type LodgeAppSeed = { records?: unknown; manifest_hash?: unknown };

const contractCache = new Map<string, ContractEnvelope<unknown>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function normalizeMembers(seed: unknown): ValidationResult<MemberContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'member contract seed is not an object' };
  const source = (seed as MemberSeed).members;
  if (!Array.isArray(source)) return { ok: false, error: 'member contract seed missing members array' };

  const members: MemberContract[] = [];
  for (const entry of source) {
    const parsed = readMember(entry);
    if (!parsed.ok) return parsed;
    members.push(parsed.value);
  }
  return { ok: true, value: members };
}

function normalizeRooms(seed: unknown): ValidationResult<RoomContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'room contract seed is not an object' };
  const source = (seed as RoomSeed).rooms;
  if (!Array.isArray(source)) return { ok: false, error: 'room contract seed missing rooms array' };

  const rooms: RoomContract[] = [];
  for (const entry of source) {
    const parsed = readRoom(entry);
    if (!parsed.ok) return parsed;
    rooms.push(parsed.value);
  }
  return { ok: true, value: rooms };
}

function normalizeQuests(seed: unknown): ValidationResult<QuestContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'quest contract seed is not an object' };
  const source = (seed as QuestSeed).quests;
  if (!Array.isArray(source)) return { ok: false, error: 'quest contract seed missing quests array' };

  const quests: QuestContract[] = [];
  for (const entry of source) {
    const parsed = readQuest(entry);
    if (!parsed.ok) return parsed;
    quests.push(parsed.value);
  }
  return { ok: true, value: quests };
}

function normalizeArtifacts(seed: unknown): ValidationResult<ArtifactContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'artifact contract seed is not an object' };
  const source = (seed as ArtifactSeed).records;
  if (!Array.isArray(source)) return { ok: false, error: 'artifact contract seed missing records array' };

  const artifacts: ArtifactContract[] = [];
  for (const entry of source) {
    const parsed = readArtifact(entry);
    if (!parsed.ok) return parsed;
    artifacts.push(parsed.value);
  }
  return { ok: true, value: artifacts };
}

function normalizeTools(seed: unknown): ValidationResult<ToolContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'tool contract seed is not an object' };
  const source = (seed as ToolSeed).records;
  if (!Array.isArray(source)) return { ok: false, error: 'tool contract seed missing records array' };

  const tools: ToolContract[] = [];
  for (const entry of source) {
    const parsed = readTool(entry);
    if (!parsed.ok) return parsed;
    tools.push(parsed.value);
  }
  return { ok: true, value: tools };
}

function normalizeInterfaceModules(seed: unknown): ValidationResult<InterfaceModuleContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'interface module contract seed is not an object' };
  const source = (seed as InterfaceModuleSeed).records;
  if (!Array.isArray(source)) {
    return { ok: false, error: 'interface module contract seed missing records array' };
  }

  const modules: InterfaceModuleContract[] = [];
  for (const entry of source) {
    const parsed = readInterfaceModule(entry);
    if (!parsed.ok) return parsed;
    modules.push(parsed.value);
  }
  return { ok: true, value: modules };
}

function normalizeLodgeApps(seed: unknown): ValidationResult<LodgeAppContract[]> {
  if (!isRecord(seed)) return { ok: false, error: 'lodge app contract seed is not an object' };
  const source = (seed as LodgeAppSeed).records;
  if (!Array.isArray(source)) return { ok: false, error: 'lodge app contract seed missing records array' };

  const apps: LodgeAppContract[] = [];
  for (const entry of source) {
    const parsed = readLodgeApp(entry);
    if (!parsed.ok) return parsed;
    apps.push(parsed.value);
  }
  return { ok: true, value: apps };
}

async function fetchContract<T>(
  source: string,
  validate: (value: unknown) => ValidationResult<T>,
): Promise<ContractEnvelope<T>> {
  const response = await fetch(source, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source}: ${response.status}`);
  }

  const json = await response.json();
  const parsed = validate(json);
  if (!parsed.ok) {
    throw new Error(`Invalid contract ${source}: ${parsed.error}`);
  }

  const hash = await sha256Hex(stableStringify(parsed.value));
  const manifestHash = isRecord(json) && isString(json.manifest_hash) ? json.manifest_hash : undefined;

  if (!manifestHash) {
    return {
      source,
      data: parsed.value,
      hash,
      loadedAt: new Date().toISOString(),
      state: 'error',
      verified: false,
      manifestHash,
      error: CONTRACT_USER_ERROR.missingSignature,
    };
  }

  return {
    source,
    data: parsed.value,
    hash,
    loadedAt: new Date().toISOString(),
    state: manifestHash === hash ? 'ready' : 'stale',
    verified: manifestHash === hash,
    manifestHash,
    error: manifestHash === hash ? undefined : CONTRACT_USER_ERROR.verificationFailed,
  };
}

export async function loadContract<T>(
  source: string,
  validate: (value: unknown) => ValidationResult<T>,
  options: { refresh?: boolean } = {},
): Promise<ContractEnvelope<T>> {
  if (!options.refresh) {
    const cached = contractCache.get(source) as ContractEnvelope<T> | undefined;
    if (cached) return cached;
  }

  const result = await fetchContract(source, validate).catch((error: unknown) => {
    console.error('[sanctuaryBridge] contract load failed', { source, error });
    return {
      source,
      data: null as T,
      hash: '',
      loadedAt: new Date().toISOString(),
      state: 'error' as const,
      verified: false,
      error: CONTRACT_USER_ERROR.loadFailed,
    };
  });

  contractCache.set(source, result as ContractEnvelope<unknown>);
  return result;
}

export function useContract<T>(
  source: string,
  validate: (value: unknown) => ValidationResult<T>,
  fallback: T,
) {
  const [envelope, setEnvelope] = useState<ContractEnvelope<T>>({
    source,
    data: fallback,
    hash: '',
    loadedAt: '',
    state: 'loading',
    verified: false,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await loadContract(source, validate, { refresh: true });
      if (!cancelled) {
        setEnvelope(result);
      }
    };

    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [source, validate]);

  return useMemo(
    () => ({
      ...envelope,
      data: envelope.state === 'ready' ? envelope.data : fallback,
    }),
    [envelope, fallback],
  );
}

/** Single-line trust copy for headers; `error` must already be user-safe (from bridge envelopes). */
export function contractTrustSummary(state: ContractState, verified: boolean, error?: string): string {
  if (state === 'loading') return 'Loading…';
  if (state === 'idle') return 'Idle';
  if (state === 'ready' && verified) return 'SHA-256 verified';
  if (state === 'stale') return `${CONTRACT_USER_ERROR.verificationFailed} · offline ledger`;
  if (state === 'error') return error ?? 'Offline ledger';
  return 'Offline ledger';
}

export const sanctuaryBridge = {
  readMember,
  readRoom,
  readQuest,
  readArtifact,
  readTool,
  readInterfaceModule,
  readLodgeApp,
  normalizeMembers,
  normalizeRooms,
  normalizeQuests,
  normalizeArtifacts,
  normalizeTools,
  normalizeInterfaceModules,
  normalizeLodgeApps,
};
