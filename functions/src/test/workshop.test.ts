import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateBlueprint,
  WORKSHOP_CATALOG,
  WORKSHOP_CATALOG_MANIFEST,
  WORKSHOP_LIMITS,
} from '../workshop';
import { executeMcpTool, WORKSHOP_OUTPUT_SCHEMA } from '../mcpServer';

function blueprint(parts: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'workshop-v1',
    title: 'Garden',
    author: 'test-builder',
    parts,
    tags: ['test'],
    ...overrides,
  };
}

function part(partId: string, x: number, z: number, config: Record<string, unknown> = {}): Record<string, unknown> {
  return { part_id: partId, position: { x, z }, rotation_deg: 0, config };
}

function codes(receipt: ReturnType<typeof validateBlueprint>): string[] {
  return [...receipt.errors, ...receipt.warnings, ...receipt.compatibility].map((item) => item.code);
}

test('same blueprint produces the same hashes across 100 validations', () => {
  const input = blueprint([part('water_pool', 0, 0)]);
  const receipts = Array.from({ length: 100 }, () => validateBlueprint(input));
  assert.equal(new Set(receipts.map((item) => item.receipt_hash)).size, 1);
  assert.equal(new Set(receipts.map((item) => item.blueprint_hash)).size, 1);
});

test('key order, whitespace, defaults, and NFC normalization are canonical', () => {
  const composed = blueprint([part('art_frame', 2, 0, { title: 'Caf\u00e9' })], { title: 'Caf\u00e9' });
  const decomposed = JSON.parse(`{
    "author":"test-builder",
    "parts":[{"config":{"title":"Cafe\u0301"},"position":{"z":0,"x":2},"part_id":"art_frame"}],
    "title":"Cafe\u0301",
    "schema":"workshop-v1",
    "tags":["test"]
  }`);
  assert.equal(validateBlueprint(composed).blueprint_hash, validateBlueprint(decomposed).blueprint_hash);
});

test('validated_at is excluded from receipt hash', async () => {
  const input = blueprint([part('flora_flower', 0, 0)]);
  const first = validateBlueprint(input);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const second = validateBlueprint(input);
  assert.notEqual(first.validated_at, second.validated_at);
  assert.equal(first.receipt_hash, second.receipt_hash);
});

test('pure validator has no Firebase imports', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/workshop.ts'), 'utf8');
  assert.doesNotMatch(source, /firebase-admin|firebase-functions/);
});

test('catalog has 14 recognized parts and five buildable parts', () => {
  assert.equal(WORKSHOP_CATALOG.length, 14);
  assert.equal(WORKSHOP_CATALOG.filter((item) => item.buildable).length, 5);
});

test('catalog seed has zero drift: functions copy matches canonical seed and manifest_hash verifies', () => {
  const canonicalPath = path.resolve(__dirname, '../../../../frontend/public/workshop_parts.json');
  const copyPath = path.resolve(__dirname, '../../../data/workshop_parts.json');
  const canonical = fs.readFileSync(canonicalPath, 'utf8');
  assert.equal(fs.readFileSync(copyPath, 'utf8'), canonical, 'functions/data copy drifted — run npm run sync-catalog');
  const parsed = JSON.parse(canonical) as { manifest_hash: string; catalog_version: string };
  assert.equal(WORKSHOP_CATALOG_MANIFEST.declared_hash, parsed.manifest_hash);
  assert.equal(WORKSHOP_CATALOG_MANIFEST.computed_hash, parsed.manifest_hash, 'manifest_hash stale — restamp the seed');
  assert.ok(WORKSHOP_CATALOG_MANIFEST.verified);
});

test('rule codes cover unknown, unbuildable, bounds, grid, overlap, config, and count', () => {
  assert.ok(codes(validateBlueprint(blueprint([part('missing', 0, 0)]))).includes('E_UNKNOWN_PART'));
  assert.ok(codes(validateBlueprint(blueprint([part('torch', 0, 0)]))).includes('E_PART_NOT_BUILDABLE'));
  assert.ok(codes(validateBlueprint(blueprint([part('water_pool', 30, 0)]))).includes('E_OUT_OF_BOUNDS'));
  assert.ok(codes(validateBlueprint(blueprint([part('water_pool', 0.3, 0)]))).includes('E_GRID_MISALIGNED'));
  assert.ok(codes(validateBlueprint(blueprint([part('water_pool', 0, 0), part('flora_flower', 0, 0)]))).includes('E_OVERLAP'));
  assert.ok(codes(validateBlueprint(blueprint([part('water_pool', 0, 0, { unsafe: true })]))).includes('E_BAD_CONFIG_KEY'));
  assert.ok(codes(validateBlueprint(blueprint(
    Array.from({ length: WORKSHOP_LIMITS.max_parts + 1 }, (_, index) => part('water_pool', index, 0)),
  ))).includes('E_TOO_MANY_PARTS'));
});

test('touching footprints do not overlap and an edge-aligned part stays in bounds', () => {
  const touching = validateBlueprint(blueprint([
    part('water_pool', 0, 0),
    part('water_pool', 1, 0),
  ]));
  assert.ok(!codes(touching).includes('E_OVERLAP'));

  const edge = validateBlueprint(blueprint([part('water_pool', 29.5, 0)]));
  assert.ok(!codes(edge).includes('E_OUT_OF_BOUNDS'));
});

test('advisory and compatibility codes are deterministic', () => {
  const denseParts = [
    part('water_pool', 0, 0),
    part('flora_flower', 0.5, 0),
    part('water_stream', 1, 0),
    part('water_frozen', 1.5, 0),
    part('flora_flower', 0, 0.5),
    part('water_pool', 0.5, 0.5),
    part('flora_flower', 1, 0.5),
    part('torch', 2, 0),
  ];
  const receipt = validateBlueprint(blueprint(denseParts));
  assert.ok(codes(receipt).includes('W_DENSE_CLUSTER'));
  assert.ok(codes(receipt).includes('W_FIRE_NEAR_WATER'));
  assert.ok(codes(receipt).includes('C_SYNERGY_FLORA_WATER'));
});

test('mode is closed to preview or validation and never witnessed', () => {
  const input = blueprint([part('water_pool', 0, 0)]);
  assert.equal(validateBlueprint(input, 'preview').kind, 'preview');
  assert.equal(validateBlueprint(input, 'validation').kind, 'validation');
  assert.equal(validateBlueprint(input, 'witnessed' as never).kind, 'validation');
  assert.equal(validateBlueprint(input).world_write, false);
});

test('MCP transport uses the same validator and declares structured output', async () => {
  const input = blueprint([part('water_pool', 0, 0)]);
  const direct = validateBlueprint(input);
  const throughMcp = await executeMcpTool('hearthlands_validate_blueprint', {
    blueprint: input,
    mode: 'validation',
  }) as ReturnType<typeof validateBlueprint>;
  const properties = WORKSHOP_OUTPUT_SCHEMA.properties as Record<string, { const?: unknown }>;
  assert.equal(throughMcp.receipt_hash, direct.receipt_hash);
  assert.equal(properties.world_write.const, false);
});
