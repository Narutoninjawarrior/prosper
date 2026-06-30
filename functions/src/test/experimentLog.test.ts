import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import {
  buildLogReceipt,
  buildLogSignPayload,
  validateExperimentLogInput,
} from '../experimentLog';
import { suggestCreativity } from '../creativity';

const BASE_STATE = {
  tick: 4102,
  heat: 3002,
  ember_balance: 3147.57,
  state_hash: 'abc123def456',
  biosphere_nodes: [{ active: true, bloomStage: 0 }],
  weather: 'clear',
};

test('validateExperimentLogInput requires matching agent_id and public_key', () => {
  const keyPair = nacl.sign.keyPair();
  const public_key = bs58.encode(keyPair.publicKey);
  const body = {
    agent_id: 'other',
    public_key,
    signature: 'abc',
    receipt_hash: 'a'.repeat(64),
    experiment_id: 'chem_salt+ember_dust',
    kind: 'chemistry',
    apparatus_id: 'reagent_alembic',
  };
  const parsed = validateExperimentLogInput(body);
  assert.equal(parsed.ok, false);
});

test('signed payload verifies with tweetnacl', () => {
  const keyPair = nacl.sign.keyPair();
  const public_key = bs58.encode(keyPair.publicKey);
  const input = {
    agent_id: public_key,
    public_key,
    receipt_hash: 'b'.repeat(64),
    experiment_id: 'chem_salt+ember_dust',
    kind: 'chemistry' as const,
    apparatus_id: 'reagent_alembic',
  };
  const message = Buffer.from(buildLogSignPayload(input));
  const signature = bs58.encode(nacl.sign.detached(message, keyPair.secretKey));
  const verified = nacl.sign.detached.verify(
    message,
    bs58.decode(signature),
    keyPair.publicKey,
  );
  assert.equal(verified, true);
  const receipt = buildLogReceipt(input);
  assert.equal(receipt.log, 'experiment-log-v1');
  assert.match(receipt.log_hash, /^[a-f0-9]{64}$/);
});

test('pure experimentLog module has no Firebase imports', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../src/experimentLog.ts'), 'utf8');
  assert.doesNotMatch(source, /firebase-admin|firebase-functions/);
});

test('creativity suggest excludes logged experiment_ids', () => {
  const before = suggestCreativity(BASE_STATE, 100, new Set());
  const targetId = before.experiments[0]?.experiment_id;
  assert.ok(targetId);
  const after = suggestCreativity(BASE_STATE, 100, new Set([targetId]));
  assert.ok(before.experiments.some((e) => e.experiment_id === targetId));
  assert.ok(!after.experiments.some((e) => e.experiment_id === targetId));
  assert.equal(after.excluded_experiment_ids, 1);
});
