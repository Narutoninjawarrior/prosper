import * as crypto from 'crypto';
import catalogSeed from '../data/workshop_parts.json';

export const WORKSHOP_SCHEMA_VERSION = 'workshop-v1';
export const WORKSHOP_CATALOG_VERSION: string = catalogSeed.catalog_version;
export const WORKSHOP_RECEIPT_VERSION = 'workshop-receipt-v1';

export const WORKSHOP_LIMITS = {
  world_min: -30,
  world_max: 30,
  grid_size: 0.5,
  max_parts: 64,
  max_payload_bytes: 64 * 1024,
  max_title_chars: 80,
  max_author_chars: 64,
  max_notes_chars: 500,
  max_tags: 8,
  max_tag_chars: 24,
} as const;

export type WorkshopMode = 'validation' | 'preview';

export type WorkshopCatalogPart = {
  part_id: string;
  name: string;
  category: 'water' | 'flora' | 'art' | 'structure' | 'fire';
  ember_cost: number;
  footprint: { width: number; depth: number };
  buildable: boolean;
  config_keys: string[];
};

// Canonical source: frontend/public/workshop_parts.json (synced to functions/data
// at build time by the sync-catalog script). Validation uses only the fields
// below; UI-only fields (icon, colors, descriptions) are ignored here.
export const WORKSHOP_CATALOG: WorkshopCatalogPart[] = catalogSeed.records.map((record) => ({
  part_id: record.part_id,
  name: record.name,
  category: record.category as WorkshopCatalogPart['category'],
  ember_cost: record.ember_cost,
  footprint: { width: record.footprint.width, depth: record.footprint.depth },
  buildable: record.buildable,
  config_keys: record.config_keys,
}));

export const WORKSHOP_CATALOG_MANIFEST = {
  declared_hash: catalogSeed.manifest_hash,
  computed_hash: sha256Hex(stableStringify(catalogSeed.records)),
  get verified(): boolean {
    return this.declared_hash === this.computed_hash;
  },
};

export type WorkshopFinding = {
  code: string;
  path: string;
  detail: string;
};

export type WorkshopReceipt = {
  receipt: typeof WORKSHOP_RECEIPT_VERSION;
  kind: WorkshopMode;
  valid: boolean;
  schema_version: typeof WORKSHOP_SCHEMA_VERSION;
  catalog_version: typeof WORKSHOP_CATALOG_VERSION;
  blueprint_hash: string;
  receipt_hash: string;
  errors: WorkshopFinding[];
  warnings: WorkshopFinding[];
  compatibility: WorkshopFinding[];
  cost_estimate: {
    total_ember: number;
    by_part: Record<string, number>;
    note: string;
  };
  footprint: {
    min_x: number | null;
    max_x: number | null;
    min_z: number | null;
    max_z: number | null;
    area_cells: number;
  };
  world_write: false;
  note: string;
  validated_at: string;
};

type ValidatedPart = {
  index: number;
  part: WorkshopCatalogPart;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  config: Record<string, unknown>;
};

const CATALOG_BY_ID = new Map(WORKSHOP_CATALOG.map((part) => [part.part_id, part]));
const TOP_LEVEL_KEYS = new Set(['schema', 'title', 'author', 'parts', 'tags', 'notes']);
const PART_KEYS = new Set(['part_id', 'position', 'rotation_deg', 'config']);
const POSITION_KEYS = new Set(['x', 'z']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: string): string {
  return value.normalize('NFC');
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') return normalizeString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const entry = (value as Record<string, unknown>)[key];
    if (entry !== undefined) result[key] = canonicalize(entry);
  }
  return result;
}

function canonicalBlueprint(input: unknown): unknown {
  const base = canonicalize(input);
  if (!isRecord(base)) return base;

  const parts = Array.isArray(base.parts)
    ? base.parts.map((part) => {
      if (!isRecord(part)) return part;
      return {
        ...part,
        rotation_deg: part.rotation_deg === undefined ? 0 : part.rotation_deg,
        config: part.config === undefined ? {} : part.config,
      };
    })
    : base.parts;

  return { ...base, parts };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'null' : encoded;
  }
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
}

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function finding(code: string, path: string, detail: string): WorkshopFinding {
  return { code, path, detail };
}

function findingIndex(item: WorkshopFinding): number {
  const match = item.path.match(/^\/parts\/(\d+)/);
  return match ? Number(match[1]) : -1;
}

function sortFindings(items: WorkshopFinding[]): WorkshopFinding[] {
  return items.sort((a, b) =>
    findingIndex(a) - findingIndex(b)
      || a.code.localeCompare(b.code)
      || a.path.localeCompare(b.path)
      || a.detail.localeCompare(b.detail),
  );
}

function isHalfGrid(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

function distance(a: ValidatedPart, b: ValidatedPart): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function rotatedFootprint(part: WorkshopCatalogPart, rotation: number): { width: number; depth: number } {
  return rotation === 90 || rotation === 270
    ? { width: part.footprint.depth, depth: part.footprint.width }
    : part.footprint;
}

function validateStringField(
  record: Record<string, unknown>,
  key: string,
  path: string,
  min: number,
  max: number,
  errors: WorkshopFinding[],
): void {
  const value = record[key];
  if (typeof value !== 'string' || normalizeString(value).length < min || normalizeString(value).length > max) {
    errors.push(finding('E_SCHEMA', path, `${key} must be a string with ${min}-${max} characters`));
  }
}

export function validateBlueprint(input: unknown, requestedMode: WorkshopMode = 'validation'): WorkshopReceipt {
  const mode: WorkshopMode = requestedMode === 'preview' ? 'preview' : 'validation';
  const errors: WorkshopFinding[] = [];
  const warnings: WorkshopFinding[] = [];
  const compatibility: WorkshopFinding[] = [];
  const validatedParts: ValidatedPart[] = [];
  const canonical = canonicalBlueprint(input);
  const blueprintHash = sha256Hex(stableStringify(canonical));

  if (!isRecord(input)) {
    errors.push(finding('E_SCHEMA', '/', 'blueprint must be a JSON object'));
  } else {
    for (const key of Object.keys(input)) {
      if (!TOP_LEVEL_KEYS.has(key)) {
        errors.push(finding('E_SCHEMA', `/${key}`, 'unknown top-level key'));
      }
    }

    if (input.schema !== WORKSHOP_SCHEMA_VERSION) {
      errors.push(finding('E_SCHEMA', '/schema', `schema must equal "${WORKSHOP_SCHEMA_VERSION}"`));
    }
    validateStringField(input, 'title', '/title', 1, WORKSHOP_LIMITS.max_title_chars, errors);
    validateStringField(input, 'author', '/author', 1, WORKSHOP_LIMITS.max_author_chars, errors);

    if (input.notes !== undefined && (typeof input.notes !== 'string' || normalizeString(input.notes).length > WORKSHOP_LIMITS.max_notes_chars)) {
      errors.push(finding('E_SCHEMA', '/notes', `notes must be a string of at most ${WORKSHOP_LIMITS.max_notes_chars} characters`));
    }

    if (input.tags !== undefined) {
      if (!Array.isArray(input.tags) || input.tags.length > WORKSHOP_LIMITS.max_tags) {
        errors.push(finding('E_SCHEMA', '/tags', `tags must be an array of at most ${WORKSHOP_LIMITS.max_tags} strings`));
      } else {
        input.tags.forEach((tag, index) => {
          if (typeof tag !== 'string' || normalizeString(tag).length < 1 || normalizeString(tag).length > WORKSHOP_LIMITS.max_tag_chars) {
            errors.push(finding('E_SCHEMA', `/tags/${index}`, `tag must be a string with 1-${WORKSHOP_LIMITS.max_tag_chars} characters`));
          }
        });
      }
    }

    if (!Array.isArray(input.parts)) {
      errors.push(finding('E_SCHEMA', '/parts', 'parts must be an array with 1-64 entries'));
    } else {
      if (input.parts.length === 0) {
        errors.push(finding('E_SCHEMA', '/parts', 'parts must contain at least one entry'));
      }
      if (input.parts.length > WORKSHOP_LIMITS.max_parts) {
        errors.push(finding('E_TOO_MANY_PARTS', '/parts', `parts exceeds the ${WORKSHOP_LIMITS.max_parts}-part limit`));
      }

      input.parts.slice(0, WORKSHOP_LIMITS.max_parts).forEach((rawPart, index) => {
        const path = `/parts/${index}`;
        if (!isRecord(rawPart)) {
          errors.push(finding('E_SCHEMA', path, 'part must be an object'));
          return;
        }

        for (const key of Object.keys(rawPart)) {
          if (!PART_KEYS.has(key)) errors.push(finding('E_SCHEMA', `${path}/${key}`, 'unknown part key'));
        }

        if (typeof rawPart.part_id !== 'string') {
          errors.push(finding('E_SCHEMA', `${path}/part_id`, 'part_id must be a string'));
          return;
        }
        const partId = normalizeString(rawPart.part_id);
        const catalogPart = CATALOG_BY_ID.get(partId);
        if (!catalogPart) {
          errors.push(finding('E_UNKNOWN_PART', `${path}/part_id`, `unknown part_id "${partId}"`));
          return;
        }
        if (!catalogPart.buildable) {
          errors.push(finding('E_PART_NOT_BUILDABLE', `${path}/part_id`, `"${partId}" is catalogued but not currently buildable`));
        }

        if (!isRecord(rawPart.position)) {
          errors.push(finding('E_SCHEMA', `${path}/position`, 'position must be an object with finite x and z numbers'));
          return;
        }
        for (const key of Object.keys(rawPart.position)) {
          if (!POSITION_KEYS.has(key)) errors.push(finding('E_SCHEMA', `${path}/position/${key}`, 'unknown position key'));
        }
        const x = rawPart.position.x;
        const z = rawPart.position.z;
        if (typeof x !== 'number' || !Number.isFinite(x)) {
          errors.push(finding('E_SCHEMA', `${path}/position/x`, 'x must be a finite number'));
        }
        if (typeof z !== 'number' || !Number.isFinite(z)) {
          errors.push(finding('E_SCHEMA', `${path}/position/z`, 'z must be a finite number'));
        }
        if (typeof x !== 'number' || !Number.isFinite(x) || typeof z !== 'number' || !Number.isFinite(z)) return;

        if (!isHalfGrid(x)) errors.push(finding('E_GRID_MISALIGNED', `${path}/position/x`, 'x must align to the 0.5 world grid'));
        if (!isHalfGrid(z)) errors.push(finding('E_GRID_MISALIGNED', `${path}/position/z`, 'z must align to the 0.5 world grid'));

        const rotation = rawPart.rotation_deg === undefined ? 0 : rawPart.rotation_deg;
        if (typeof rotation !== 'number' || ![0, 90, 180, 270].includes(rotation)) {
          errors.push(finding('E_SCHEMA', `${path}/rotation_deg`, 'rotation_deg must be one of 0, 90, 180, 270'));
          return;
        }

        const config = rawPart.config === undefined ? {} : rawPart.config;
        if (!isRecord(config)) {
          errors.push(finding('E_SCHEMA', `${path}/config`, 'config must be an object'));
          return;
        }
        for (const key of Object.keys(config)) {
          if (!catalogPart.config_keys.includes(key)) {
            errors.push(finding('E_BAD_CONFIG_KEY', `${path}/config/${key}`, `"${key}" is not allowed for "${partId}"`));
          }
        }
        if (config.title !== undefined && (typeof config.title !== 'string' || normalizeString(config.title).length < 1 || normalizeString(config.title).length > 60)) {
          errors.push(finding('E_SCHEMA', `${path}/config/title`, 'title must be a string with 1-60 characters'));
        }
        if (catalogPart.category === 'art' && (typeof config.title !== 'string' || normalizeString(config.title).trim() === '')) {
          warnings.push(finding('W_NO_TITLE', `${path}/config/title`, 'art parts are clearer to humans and bots when titled'));
        }

        const footprint = rotatedFootprint(catalogPart, rotation);
        if (
          x - footprint.width / 2 < WORKSHOP_LIMITS.world_min
          || x + footprint.width / 2 > WORKSHOP_LIMITS.world_max
          || z - footprint.depth / 2 < WORKSHOP_LIMITS.world_min
          || z + footprint.depth / 2 > WORKSHOP_LIMITS.world_max
        ) {
          errors.push(finding('E_OUT_OF_BOUNDS', `${path}/position`, `rotated footprint must remain within ${WORKSHOP_LIMITS.world_min}..${WORKSHOP_LIMITS.world_max}`));
        }

        validatedParts.push({
          index,
          part: catalogPart,
          x,
          z,
          rotation,
          width: footprint.width,
          depth: footprint.depth,
          config,
        });
      });
    }
  }

  for (let leftIndex = 0; leftIndex < validatedParts.length; leftIndex += 1) {
    const left = validatedParts[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < validatedParts.length; rightIndex += 1) {
      const right = validatedParts[rightIndex];
      const overlaps = Math.abs(left.x - right.x) < (left.width + right.width) / 2
        && Math.abs(left.z - right.z) < (left.depth + right.depth) / 2;
      if (overlaps) {
        errors.push(finding('E_OVERLAP', `/parts/${right.index}`, `overlaps /parts/${left.index}`));
      }

      const pairDistance = distance(left, right);
      const categories = new Set([left.part.category, right.part.category]);
      if (categories.has('fire') && categories.has('water') && pairDistance < 1.5) {
        warnings.push(finding('W_FIRE_NEAR_WATER', `/parts/${right.index}`, `fire and water parts are ${pairDistance.toFixed(2)} units apart`));
      }
      if (categories.has('flora') && categories.has('water') && pairDistance < 2) {
        compatibility.push(finding('C_SYNERGY_FLORA_WATER', `/parts/${right.index}`, `flora and water parts are ${pairDistance.toFixed(2)} units apart`));
      }
    }
  }

  const denseAnchor = validatedParts.find((anchor) =>
    validatedParts.filter((candidate) =>
      Math.abs(candidate.x - anchor.x) <= 1.5 && Math.abs(candidate.z - anchor.z) <= 1.5,
    ).length > 6,
  );
  if (denseAnchor) {
    warnings.push(finding('W_DENSE_CLUSTER', `/parts/${denseAnchor.index}`, 'more than six parts occupy a 3x3 area'));
  }

  sortFindings(errors);
  sortFindings(warnings);
  sortFindings(compatibility);

  const byPart: Record<string, number> = {};
  for (const item of validatedParts) {
    byPart[item.part.part_id] = (byPart[item.part.part_id] || 0) + item.part.ember_cost;
  }
  const costEstimate = {
    total_ember: Object.values(byPart).reduce((sum, value) => sum + value, 0),
    by_part: Object.fromEntries(Object.entries(byPart).sort(([a], [b]) => a.localeCompare(b))),
    note: 'estimate only - no $EMBER charged or held',
  };

  const footprint = validatedParts.length === 0
    ? { min_x: null, max_x: null, min_z: null, max_z: null, area_cells: 0 }
    : {
      min_x: Math.min(...validatedParts.map((item) => item.x - item.width / 2)),
      max_x: Math.max(...validatedParts.map((item) => item.x + item.width / 2)),
      min_z: Math.min(...validatedParts.map((item) => item.z - item.depth / 2)),
      max_z: Math.max(...validatedParts.map((item) => item.z + item.depth / 2)),
      area_cells: Number(validatedParts.reduce((sum, item) => sum + (item.width * item.depth) / 0.25, 0).toFixed(2)),
    };

  const valid = errors.length === 0;
  const hashPayload = {
    schema_version: WORKSHOP_SCHEMA_VERSION,
    catalog_version: WORKSHOP_CATALOG_VERSION,
    blueprint_hash: blueprintHash,
    valid,
    errors,
    warnings,
    compatibility,
    cost_estimate: costEstimate,
    footprint,
  };

  return {
    receipt: WORKSHOP_RECEIPT_VERSION,
    kind: mode,
    valid,
    schema_version: WORKSHOP_SCHEMA_VERSION,
    catalog_version: WORKSHOP_CATALOG_VERSION,
    blueprint_hash: blueprintHash,
    receipt_hash: sha256Hex(stableStringify(hashPayload)),
    errors,
    warnings,
    compatibility,
    cost_estimate: costEstimate,
    footprint,
    world_write: false,
    note: 'No world write performed. This receipt is not witnessed.',
    validated_at: new Date().toISOString(),
  };
}
