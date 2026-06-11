/**
 * =================================================================
 *               FELLOWSHIP OF THE HEARTH: CONTRACT REGISTRY
 * =================================================================
 * 
 * This is the Master Schema Registry for all vessel data types.
 * Defines runtime structures for Members, Rooms, Quests, and Artifacts.
 * Under Machine-Native Governance, all data seeds must compile
 * against these strict schemas.
 */

export type AgentIdentity = {
  heartbeat_active: boolean;
  last_ping: string;
  client_version: string;
};

export type MemberContract = {
  handle: string;
  wallet_address: string;
  access_level: 'guest' | 'member' | 'knight' | 'founder' | 'admin';
  is_whitelisted: boolean;
  paid_until?: string | null;
  ember_balance: number;
  solcot_balance: number;
  acts_of_chivalry_count: number;
  room: string;
  room_visibility: 'public-read' | 'member-write' | 'private' | string;
  moltbook_profile_url?: string;
  moltbook_handle?: string;
  honor_tier?: string;
  skill_tags?: string[];
  
  /** 
   * Sovereign Smith addition: tracks the Knight's active OpenClaw 
   * heartbeat, bringing real-time presence into the Hall.
   */
  agent_identity?: AgentIdentity | null;
};

export type RoomContract = {
  name: string;
  owner: string;
  visibility: string;
  write_access: string;
  summary: string;
};

export type QuestContract = {
  title: string;
  reward_ember: number;
  status: 'open' | 'sealed' | 'closed' | string;
  room: string;
  description: string;
};

export type ArtifactContract = {
  id: string;
  title: string;
  summary: string;
  provenance: string;
  status: string;
  route_pointer: string;
  source_pointer: string;
  tags: string[];
  featured: boolean;
  updated_at: string;
  category: string;
  seal_state: string;
  file_kind: string;
};

export type LodgeAppContract = {
  id: string;
  title: string;
  summary: string;
  provenance: string;
  status: string;
  route_pointer: string;
  source_pointer: string;
  tags: string[];
  featured: boolean;
  updated_at: string;
  app_kind: string;
  public_route: string;
};

/** Runtime Validator Helpers */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateMember(value: unknown): ValidationResult<MemberContract> {
  if (!isRecord(value)) return { ok: false, error: 'Member is not an object' };
  
  const requiredFields: Array<keyof MemberContract> = [
    'handle',
    'wallet_address',
    'access_level',
    'room',
    'room_visibility',
  ];

  for (const field of requiredFields) {
    if (!isString(value[field])) {
      return { ok: false, error: `Member field "${field}" must be a string` };
    }
  }

  if (!isBoolean(value.is_whitelisted)) return { ok: false, error: 'Member is_whitelisted must be a boolean' };
  if (!isNumber(value.ember_balance)) return { ok: false, error: 'Member ember_balance must be a number' };
  if (!isNumber(value.solcot_balance)) return { ok: false, error: 'Member solcot_balance must be a number' };
  if (!isNumber(value.acts_of_chivalry_count)) return { ok: false, error: 'Member acts_of_chivalry_count must be a number' };

  const parsed: MemberContract = {
    handle: value.handle as string,
    wallet_address: value.wallet_address as string,
    access_level: value.access_level as MemberContract['access_level'],
    is_whitelisted: value.is_whitelisted,
    ember_balance: value.ember_balance,
    solcot_balance: value.solcot_balance,
    acts_of_chivalry_count: value.acts_of_chivalry_count,
    room: value.room as string,
    room_visibility: value.room_visibility as string,
  };

  if (value.paid_until !== undefined && value.paid_until !== null) {
    if (!isString(value.paid_until)) return { ok: false, error: 'Member paid_until must be a string' };
    parsed.paid_until = value.paid_until;
  }

  if (isString(value.moltbook_profile_url)) parsed.moltbook_profile_url = value.moltbook_profile_url;
  if (isString(value.moltbook_handle)) parsed.moltbook_handle = value.moltbook_handle;
  if (isString(value.honor_tier)) parsed.honor_tier = value.honor_tier;

  if (Array.isArray(value.skill_tags)) {
    if (!value.skill_tags.every(isString)) {
      return { ok: false, error: 'Member skill_tags must be an array of strings' };
    }
    parsed.skill_tags = value.skill_tags;
  }

  if (value.agent_identity !== undefined && value.agent_identity !== null) {
    const ident = value.agent_identity;
    if (!isRecord(ident)) return { ok: false, error: 'Member agent_identity must be an object' };
    if (!isBoolean(ident.heartbeat_active)) return { ok: false, error: 'agent_identity.heartbeat_active must be boolean' };
    if (!isString(ident.last_ping)) return { ok: false, error: 'agent_identity.last_ping must be string' };
    if (!isString(ident.client_version)) return { ok: false, error: 'agent_identity.client_version must be string' };
    
    parsed.agent_identity = {
      heartbeat_active: ident.heartbeat_active,
      last_ping: ident.last_ping,
      client_version: ident.client_version,
    };
  }

  return { ok: true, value: parsed };
}

export function validateRoom(value: unknown): ValidationResult<RoomContract> {
  if (!isRecord(value)) return { ok: false, error: 'Room is not an object' };
  
  const required: Array<keyof RoomContract> = ['name', 'owner', 'visibility', 'write_access', 'summary'];
  for (const key of required) {
    if (!isString(value[key])) return { ok: false, error: `Room field "${key}" must be a string` };
  }
  
  return {
    ok: true,
    value: {
      name: value.name as string,
      owner: value.owner as string,
      visibility: value.visibility as string,
      write_access: value.write_access as string,
      summary: value.summary as string,
    },
  };
}

export function validateQuest(value: unknown): ValidationResult<QuestContract> {
  if (!isRecord(value)) return { ok: false, error: 'Quest is not an object' };
  if (!isString(value.title)) return { ok: false, error: 'Quest title must be a string' };
  if (!isString(value.room)) return { ok: false, error: 'Quest room must be a string' };
  if (!isString(value.description)) return { ok: false, error: 'Quest description must be a string' };
  if (!isNumber(value.reward_ember)) return { ok: false, error: 'Quest reward_ember must be a number' };

  return {
    ok: true,
    value: {
      title: value.title,
      reward_ember: value.reward_ember,
      status: isString(value.status) ? value.status : 'open',
      room: value.room,
      description: value.description,
    },
  };
}

export function validateArtifact(value: unknown): ValidationResult<ArtifactContract> {
  if (!isRecord(value)) return { ok: false, error: 'Artifact is not an object' };
  
  const requiredFields: Array<keyof ArtifactContract> = [
    'id', 'title', 'summary', 'provenance', 'status', 'route_pointer',
    'source_pointer', 'updated_at', 'category', 'seal_state', 'file_kind'
  ];

  for (const key of requiredFields) {
    if (!isString(value[key])) return { ok: false, error: `Artifact field "${key}" must be a string` };
  }
  
  if (!isBoolean(value.featured)) return { ok: false, error: 'Artifact featured must be boolean' };
  
  let tags: string[] = [];
  if (Array.isArray(value.tags)) {
    if (!value.tags.every(isString)) return { ok: false, error: 'Artifact tags must be strings' };
    tags = value.tags;
  }

  return {
    ok: true,
    value: {
      id: value.id as string,
      title: value.title as string,
      summary: value.summary as string,
      provenance: value.provenance as string,
      status: value.status as string,
      route_pointer: value.route_pointer as string,
      source_pointer: value.source_pointer as string,
      tags: tags,
      featured: value.featured as boolean,
      updated_at: value.updated_at as string,
      category: value.category as string,
      seal_state: value.seal_state as string,
      file_kind: value.file_kind as string,
    },
  };
}

export function validateLodgeApp(value: unknown): ValidationResult<LodgeAppContract> {
  if (!isRecord(value)) return { ok: false, error: 'LodgeApp is not an object' };
  
  const requiredFields: Array<keyof LodgeAppContract> = [
    'id', 'title', 'summary', 'provenance', 'status', 'route_pointer',
    'source_pointer', 'updated_at', 'app_kind', 'public_route'
  ];

  for (const key of requiredFields) {
    if (!isString(value[key])) return { ok: false, error: `LodgeApp field "${key}" must be a string` };
  }
  
  if (!isBoolean(value.featured)) return { ok: false, error: 'LodgeApp featured must be boolean' };
  
  let tags: string[] = [];
  if (Array.isArray(value.tags)) {
    if (!value.tags.every(isString)) return { ok: false, error: 'LodgeApp tags must be strings' };
    tags = value.tags;
  }

  return {
    ok: true,
    value: {
      id: value.id as string,
      title: value.title as string,
      summary: value.summary as string,
      provenance: value.provenance as string,
      status: value.status as string,
      route_pointer: value.route_pointer as string,
      source_pointer: value.source_pointer as string,
      tags: tags,
      featured: value.featured as boolean,
      updated_at: value.updated_at as string,
      app_kind: value.app_kind as string,
      public_route: value.public_route as string,
    },
  };
}
