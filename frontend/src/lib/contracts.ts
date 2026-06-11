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

export type ToolContract = {
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
  tool_kind: string;
  realm: string;
};

export type InterfaceModuleContract = {
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
  module_kind: string;
  realm: string;
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

export type MachineContract = {
  machine_id: string;
  name: string;
  kind: string;
  mind: {
    provider: string;
    model: string;
    endpoint_note: string;
  };
  body: {
    mesh: string;
    scene: string;
  };
  abilities: string[];
  status: string;
  monetization_note: string;
};

export type ApparatusContract = {
  apparatus_id: string;
  name: string;
  kind: string;
  status: string;
  mcp_tools: string[];
  rest_endpoints: string[];
  mesh: {
    preset: string;
    scene: string;
    position_hint: string;
  };
  capabilities: string[];
  write_policy: string;
  monetization_note: string;
};

/**
 * Canonical Forge part — single source of truth for the BuilderPanel UI and
 * the workshop-v1 validator (functions/src/workshop.ts reads the same seed).
 */
export type WorkshopPartContract = {
  part_id: string;
  name: string;
  description: string;
  category: string;
  category_label: string;
  category_emoji: string;
  category_color: string;
  icon: string;
  object_type: string;
  ember_cost: number;
  footprint: { width: number; depth: number };
  buildable: boolean;
  config_keys: string[];
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

export function validateTool(value: unknown): ValidationResult<ToolContract> {
  if (!isRecord(value)) return { ok: false, error: 'Tool is not an object' };

  const requiredFields: Array<keyof ToolContract> = [
    'id', 'title', 'summary', 'provenance', 'status', 'route_pointer',
    'source_pointer', 'updated_at', 'tool_kind', 'realm'
  ];

  for (const key of requiredFields) {
    if (!isString(value[key])) return { ok: false, error: `Tool field "${key}" must be a string` };
  }

  if (!isBoolean(value.featured)) return { ok: false, error: 'Tool featured must be boolean' };
  if (!Array.isArray(value.tags) || !value.tags.every(isString)) {
    return { ok: false, error: 'Tool tags must be strings' };
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
      tags: value.tags as string[],
      featured: value.featured as boolean,
      updated_at: value.updated_at as string,
      tool_kind: value.tool_kind as string,
      realm: value.realm as string,
    },
  };
}

export function validateInterfaceModule(value: unknown): ValidationResult<InterfaceModuleContract> {
  if (!isRecord(value)) return { ok: false, error: 'Interface module is not an object' };

  const requiredFields: Array<keyof InterfaceModuleContract> = [
    'id', 'title', 'summary', 'provenance', 'status', 'route_pointer',
    'source_pointer', 'updated_at', 'module_kind', 'realm'
  ];

  for (const key of requiredFields) {
    if (!isString(value[key])) {
      return { ok: false, error: `Interface module field "${key}" must be a string` };
    }
  }

  if (!isBoolean(value.featured)) {
    return { ok: false, error: 'Interface module featured must be boolean' };
  }
  if (!Array.isArray(value.tags) || !value.tags.every(isString)) {
    return { ok: false, error: 'Interface module tags must be strings' };
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
      tags: value.tags as string[],
      featured: value.featured as boolean,
      updated_at: value.updated_at as string,
      module_kind: value.module_kind as string,
      realm: value.realm as string,
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

export function validateMachine(value: unknown): ValidationResult<MachineContract> {
  if (!isRecord(value)) return { ok: false, error: 'Machine is not an object' };
  if (!isString(value.machine_id) || !isString(value.name) || !isString(value.kind)) {
    return { ok: false, error: 'Machine identity fields must be strings' };
  }
  if (!isString(value.status) || !isString(value.monetization_note)) {
    return { ok: false, error: 'Machine status fields must be strings' };
  }
  if (!Array.isArray(value.abilities) || !value.abilities.every(isString)) {
    return { ok: false, error: 'Machine abilities must be strings' };
  }
  if (
    !isRecord(value.mind)
    || !isString(value.mind.provider)
    || !isString(value.mind.model)
    || !isString(value.mind.endpoint_note)
  ) {
    return { ok: false, error: 'Machine mind must contain provider, model, and endpoint_note' };
  }
  if (!isRecord(value.body) || !isString(value.body.mesh) || !isString(value.body.scene)) {
    return { ok: false, error: 'Machine body must contain mesh and scene' };
  }

  return {
    ok: true,
    value: {
      machine_id: value.machine_id,
      name: value.name,
      kind: value.kind,
      mind: {
        provider: value.mind.provider,
        model: value.mind.model,
        endpoint_note: value.mind.endpoint_note,
      },
      body: {
        mesh: value.body.mesh,
        scene: value.body.scene,
      },
      abilities: value.abilities,
      status: value.status,
      monetization_note: value.monetization_note,
    },
  };
}

export function validateApparatus(value: unknown): ValidationResult<ApparatusContract> {
  if (!isRecord(value)) return { ok: false, error: 'Apparatus is not an object' };
  const stringFields = ['apparatus_id', 'name', 'kind', 'status', 'write_policy', 'monetization_note'] as const;
  for (const key of stringFields) {
    if (!isString(value[key])) return { ok: false, error: `Apparatus field "${key}" must be a string` };
  }
  for (const key of ['mcp_tools', 'rest_endpoints', 'capabilities'] as const) {
    if (!Array.isArray(value[key]) || !value[key].every(isString)) {
      return { ok: false, error: `Apparatus field "${key}" must contain strings` };
    }
  }
  if (
    !isRecord(value.mesh)
    || !isString(value.mesh.preset)
    || !isString(value.mesh.scene)
    || !isString(value.mesh.position_hint)
  ) {
    return { ok: false, error: 'Apparatus mesh must contain preset, scene, and position_hint' };
  }

  return {
    ok: true,
    value: {
      apparatus_id: value.apparatus_id as string,
      name: value.name as string,
      kind: value.kind as string,
      status: value.status as string,
      mcp_tools: value.mcp_tools as string[],
      rest_endpoints: value.rest_endpoints as string[],
      mesh: {
        preset: value.mesh.preset,
        scene: value.mesh.scene,
        position_hint: value.mesh.position_hint,
      },
      capabilities: value.capabilities as string[],
      write_policy: value.write_policy as string,
      monetization_note: value.monetization_note as string,
    },
  };
}

export function validateWorkshopPart(value: unknown): ValidationResult<WorkshopPartContract> {
  if (!isRecord(value)) return { ok: false, error: 'WorkshopPart is not an object' };

  const stringFields: Array<keyof WorkshopPartContract> = [
    'part_id', 'name', 'description', 'category', 'category_label',
    'category_emoji', 'category_color', 'icon', 'object_type',
  ];
  for (const key of stringFields) {
    if (!isString(value[key])) return { ok: false, error: `WorkshopPart field "${key}" must be a string` };
  }

  if (!isNumber(value.ember_cost)) return { ok: false, error: 'WorkshopPart ember_cost must be a number' };
  if (!isBoolean(value.buildable)) return { ok: false, error: 'WorkshopPart buildable must be boolean' };
  if (!Array.isArray(value.config_keys) || !value.config_keys.every(isString)) {
    return { ok: false, error: 'WorkshopPart config_keys must be strings' };
  }
  if (!isRecord(value.footprint) || !isNumber(value.footprint.width) || !isNumber(value.footprint.depth)) {
    return { ok: false, error: 'WorkshopPart footprint must contain numeric width and depth' };
  }

  return {
    ok: true,
    value: {
      part_id: value.part_id as string,
      name: value.name as string,
      description: value.description as string,
      category: value.category as string,
      category_label: value.category_label as string,
      category_emoji: value.category_emoji as string,
      category_color: value.category_color as string,
      icon: value.icon as string,
      object_type: value.object_type as string,
      ember_cost: value.ember_cost as number,
      footprint: { width: value.footprint.width, depth: value.footprint.depth },
      buildable: value.buildable as boolean,
      config_keys: value.config_keys as string[],
    },
  };
}
