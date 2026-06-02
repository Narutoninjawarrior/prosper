# Firebase Readiness

Handoff for the **next builder**: where Firebase touches this repo, what is already wired, and the **smallest** safe next step — without replacing stamped seeds or opening client writes.

## Where Firebase lives (repo map)

| Layer | Path | Role today |
|--------|------|------------|
| Browser env template | `frontend/.env.example` | `VITE_FIREBASE_*` for the Hall (copy → `.env.local`). |
| Client app init | `frontend/src/firebaseConfig.ts` | Read-only config from env. |
| Hall Firestore reads | `frontend/src/lib/lodgeFirestore.ts` | `lodge_members`, `lodge_rooms`, `lodge_quests`, **`lodge_claims` approved-only**. |
| Auth stub | `frontend/src/firebaseAuth.ts` | `getFirebaseAuth()` — future sign-in; **not required** for public read. |
| Rules | `frontend/firestore.rules` | Public read on lodge data; **`lodge_claims`** only when `status == approved`; **all client writes denied**. |
| Steward Node (sync + claims) | `scripts/sync-firestore-from-seed.mjs`, `scripts/steward-claim.mjs` | Service account via **`GOOGLE_APPLICATION_CREDENTIALS`** (see `.env.example` footer). |

**Operator order** (export → dry-run → sync → claims): **`/steward-runbook.md`**.  
Seed → Firestore details: **`docs/agent-systems/seed-sync.md`**. Claims: **`docs/agent-systems/claims.md`**.

## Two credential contexts (do not confuse)

1. **Browser — `VITE_FIREBASE_*`** in `frontend/.env.local`  
   Hall **read-only** queries only. No service account in the bundle.

2. **Node — `GOOGLE_APPLICATION_CREDENTIALS`** at **repo root**  
   Export is not here; **dry-run sync** needs no creds; **live sync** and **`npm run steward:claim`** need the JSON path set in the shell.

## What already exists (leave the pattern)

- **Seeds stay canonical** (`manifest_hash`, `sanctuaryBridge` / `useContract`).
- **Firestore is supplemental** live data; merge-upsert sync does not own `lodge_claims`.
- **Claims** stay manual and approval-gated; Hall shows **approved** only.

## What stays out of scope

Wallet signing, payment automation, client writes, hidden APIs, guessing Moltbook internals, weakening `manifest_hash` fail-closed behavior.

## Smallest useful next Firebase/Auth step

When you add **Auth**, keep it **narrow**: use existing **`getFirebaseAuth()`**, respect **`firestore.rules`** (still no broad client writes), and document env + behavior in **`AGENTS.md`** / this note — **do not** make the Hall an ops surface.

Until then, no code change is required for the Hall to keep working as a **read-only** consumer.

**Doctrine vessel (Forge):** Fellowship Forge → Artifact Inspector shows **Phase 0 — browser wiring (live)** from `VITE_FIREBASE_*` presence only (no credential probe, no Firestore ping). Supplemental reads remain on **Lodge Hall**.

## Phase 2 — steward sync (after browser env works)

Browser env lets the Hall **read** Firestore. It does **not** export or sync. Stewards push supplemental rows from **repo root** in a fixed order:

1. **`npm run export:firestore-seed`** — builds `build/lodge-firestore-seed.json`; fails closed on bad `manifest_hash`.
2. **`npm run sync:firestore:dry-run`** — same checks as live sync; **no credentials**; run before every live sync.
3. **`npm run sync:firestore`** — merge upserts only; requires **`GOOGLE_APPLICATION_CREDENTIALS`**.

Full checklist: **`/steward-runbook.md`**. Seeds stay canonical; Firestore stays supplemental.

## Phase 3 — manual claims (optional, separate from sync)

`lodge_claims` is **not** filled by seed export or sync. Stewards review in the terminal (or Console) only:

1. **`npm run steward:claim -- list-pending`**
2. Verify handle / optional **https** `profile_url` / note (see **`docs/agent-systems/claims.md`**)
3. **`approve`** or **`reject`** using the **same document `id`**
4. **`list-pending`** again

Only **`approved`** rows are public-read in the Hall. Approving does **not** update stamped JSON seeds.

## Phase 4 — regulated future branch

This branch is reserved for work that needs a written policy before it becomes live. Keep it out of the browser bundle and out of the Hall until a separate contract says otherwise:

- wallet connection and signing
- payment automation
- `$EMBER / $SOLCOT <-> SOL` swaps
- browser-side writes
- AI action execution
- Moltbook automation

If any of those surfaces are introduced later, they must ship with their own explicit rules, verifier, and rollback path. Until then, seeds stay canonical and Firestore stays supplemental.

## Canonical references

- `/steward-runbook.md`
- `/firebase-readiness.md` (this page)
- `/sovereign-sync.md`
- `docs/agent-systems/seed-sync.md`
- `docs/agent-systems/claims.md`
- `docs/emergent-sync.md`
- `AGENTS.md`
