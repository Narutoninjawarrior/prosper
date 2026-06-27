import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();
const HEAD_REF = db.doc('forge_log_metadata/head');

interface ForgeChainHead {
  latest_id: string;
  latest_hash: string;
  updated_at: FirebaseFirestore.Timestamp;
  entry_count: number;
}

interface AppendOptions {
  agent_id: string;
  action_type: string;
  payload_hash?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Atomically append an entry to the forge_log chain.
 * Reads and locks the head pointer inside a Firestore transaction,
 * guaranteeing sequential chain integrity under concurrent writes.
 * 
 * Performance ceiling: ~1 write/second (Firestore single-doc limit).
 * Acceptable at current Hearthlands scale. Document this ceiling clearly.
 * 
 * ponytail: sharded counters if throughput exceeds 1/sec sustained — wave 4
 */
export async function appendForgeLogEntry(opts: AppendOptions): Promise<{
  entry_id: string;
  chain_hash: string;
  prev_hash: string;
}> {
  return db.runTransaction(async (txn) => {
    // READ head (acquires pessimistic lock — blocks all concurrent writers)
    const headSnap = await txn.get(HEAD_REF);
    const head = headSnap.data() as ForgeChainHead | undefined;

    const prev_hash = head?.latest_hash ?? 'GENESIS';
    const timestamp = new Date().toISOString();
    const payload_hash = opts.payload_hash ?? crypto
      .createHash('sha256')
      .update(JSON.stringify({ action_type: opts.action_type, agent_id: opts.agent_id }))
      .digest('hex');

    // Compute new chain hash
    const chain_hash = 'sha256:' + crypto
      .createHash('sha256')
      .update(prev_hash + timestamp + payload_hash)
      .digest('hex');

    // WRITE new forge_log entry
    const entryRef = db.collection('forge_log').doc();
    txn.set(entryRef, {
      agent_id: opts.agent_id,
      action_type: opts.action_type,
      payload_hash,
      prev_hash,
      chain_hash,
      amount: opts.amount ?? 0,
      metadata: opts.metadata ?? {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // UPDATE head pointer atomically
    const newCount = (head?.entry_count ?? 0) + 1;
    txn.set(HEAD_REF, {
      latest_id: entryRef.id,
      latest_hash: chain_hash,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      entry_count: newCount,
    });

    return { entry_id: entryRef.id, chain_hash, prev_hash };
  });
}
