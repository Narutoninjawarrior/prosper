import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { suggestCreativity } from '../creativity';

const BASE_STATE = {
  tick: 4102,
  heat: 3002,
  ember_balance: 3147.57,
  state_hash: 'abc123def456',
  biosphere_nodes: [
    { active: true, bloomStage: 0 },
    { active: true, bloomStage: 2 },
    { active: false, bloomStage: 0 },
  ],
  weather: 'rain',
};

test('same state produces identical suggest_hash across 50 runs', () => {
  const hashes = Array.from({ length: 50 }, () =>
    suggestCreativity(BASE_STATE, 5).suggest_hash,
  );
  assert.equal(new Set(hashes).size, 1);
});

test('pure module has no Firebase imports', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/creativity.ts'), 'utf8');
  assert.doesNotMatch(source, /firebase-admin|firebase-functions/);
});

test('suggestions include chemistry, duel, ceremony, blueprint, and pipeline kinds', () => {
  const receipt = suggestCreativity(BASE_STATE, 100);
  const kinds = new Set(receipt.experiments.map((e) => e.kind));
  assert.ok(kinds.has('chemistry'));
  assert.ok(kinds.has('duel'));
  assert.ok(kinds.has('ceremony'));
  assert.ok(kinds.has('blueprint'));
  assert.ok(kinds.has('pipeline'));
});

test('limit caps experiment count', () => {
  assert.equal(suggestCreativity(BASE_STATE, 3).experiments.length, 3);
});

test('each experiment names an apparatus and MCP tool', () => {
  const receipt = suggestCreativity(BASE_STATE, 8);
  for (const exp of receipt.experiments) {
    assert.ok(exp.apparatus_id.length > 0);
    assert.ok(exp.mcp_tool.startsWith('hearthlands_'));
    assert.ok(exp.rest_endpoint.length > 0);
  }
});
