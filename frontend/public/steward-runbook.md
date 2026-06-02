# Steward operator runbook

Concise steps for pushing **stamped JSON seeds** to **Firestore** and managing **claims**.  
**Seeds stay canonical** for integrity; Firestore is a supplement. All merge sync is **repo root**, Node only — not from the browser.

## Phase 2 pipeline (always this order)

After browser env is set (`VITE_FIREBASE_*` in `frontend/.env.local`), stewards still **push data from the terminal**. The Hall only **reads** Firestore; it never exports or syncs.

| Step | What | Command | Credentials |
|------|------|---------|-------------|
| **1** | Export stamped seeds → bundle | `npm run export:firestore-seed` | None |
| **2** | Dry-run (trust check) | `npm run sync:firestore:dry-run` | None — **do not skip** |
| **3** | Live merge upsert | `npm run sync:firestore` | `GOOGLE_APPLICATION_CREDENTIALS` |
| **4** | Claims (optional, **not** seed sync) | See §4 — review queue **A→D** | Same as step 3 |

**Rules:**

- Run steps **1 → 2 → 3** in order. If step 1 fails (`manifest_hash` mismatch), **fix seeds before step 2**.
- Step 2 must pass before step 3 — same manifest checks as a real sync, no Firestore writes.
- Step 3 is **merge upserts only** (no deletes). `lodge_claims` is **not** filled by seed sync (see §4).
- Confirm in **Lodge Hall → supplemental registry** (read-only) after step 3 when env is configured.

Details: `docs/agent-systems/seed-sync.md` · browser map: `/firebase-readiness.md` · branch phases: `/firebase-branch.json`.

---

## 1. Export the bundle

From the **repository root** (where `package.json` and `scripts/` live):

```bash
npm install
npm run export:firestore-seed
```

Writes `build/lodge-firestore-seed.json`. If any `manifest_hash` fails verification, the command exits with an error — **fix seeds before syncing**.

## 2. Dry-run sync (trust check)

**No** `GOOGLE_APPLICATION_CREDENTIALS` required. Validates the same rules as a real sync and prints a JSON summary (counts, sample ids, `generated_at`).

**Do not run live sync until this step succeeds.**

```bash
npm run sync:firestore:dry-run
```

Read the printed JSON: manifest verification passed, sensible upsert counts, `generated_at` on the bundle you just exported.

## 3. Live sync to Firestore

Requires a **service account JSON** with Firestore write access. Do not commit it.

**Only after §2 dry-run passes.**

```bash
# example: set env then sync (syntax varies by OS)
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
npm run sync:firestore
```

This performs **merge upserts only** (no deletes). Deploy updated rules when needed — from `frontend/`:

```bash
firebase deploy --only firestore:rules
```

## 4. Phase 3 — manual claims (optional)

**Separate from §§1–3.** Seed sync never writes `lodge_claims`. Claims stay **manual**, **approval-gated**, and **terminal-only** (Console or CLI).

| Step | Action | Command |
|------|--------|---------|
| **A** | List queue | `npm run steward:claim -- list-pending` |
| **B** | Verify | Checklist in **`docs/agent-systems/claims.md`** |
| **C** | Decide | `approve` or `reject` with the **`id` from step A** |
| **D** | Confirm | `npm run steward:claim -- list-pending` again |

**Lifecycle:** `pending` → steward review → **`approved`** or **`rejected`**.  
**Hall (browser):** shows **`approved` only** — read-only query + `frontend/firestore.rules`.  
**Never in the browser:** claim create, approve, reject, or payment flows.

Stewards use the **Console** or **CLI** (repo root, `GOOGLE_APPLICATION_CREDENTIALS` — same as §3).

**Reminder:** approving a claim does **not** change stamped JSON seeds or the verified member ledger. Update seeds separately if needed.

### Review queue (always A → B → C → D)

1. **`list-pending`** — note each document **`id`** before you act.  
2. **Check** `handle`, optional `profile_url` (https), and `note` against the claims checklist.  
3. **`approve`** or **`reject`** using that **same** `id` (paste from step 1 — do not guess ids).  
4. **`list-pending` again** — confirm the queue.

### Enqueue a new row (only when you intend to add one — not when reviewing)

```bash
npm run steward:claim -- pending --handle "Display Name" [--note "…"] [--profile-url https://…]
```

### CLI reference (review + decide)

```bash
npm run steward:claim -- list-pending
npm run steward:claim -- approve --id <documentId> --by "steward-id"
npm run steward:claim -- reject --id <documentId> --by "steward-id"
```

Field definitions, verification checklist, and the same **review order** in depth: **`docs/agent-systems/claims.md`**.

## Browser vs terminal

| Environment | Purpose |
|---------------|---------|
| `frontend/.env.local` — `VITE_FIREBASE_*` | Hall **read-only** Firestore in the browser. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Node **sync** and **`steward:claim`** only. |

## Deep references (repo)

- `AGENTS.md` — constitution and manifest policy  
- `docs/agent-systems/seed-sync.md` — export/sync details  
- `docs/agent-systems/claims.md` — claims schema and CLI  
- `docs/emergent-sync.md` — what Emergent should mirror  
