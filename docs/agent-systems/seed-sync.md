# Seed Sync

This document defines the one-way bridge from stamped Lodge seeds to Firestore-ready upserts.

## Purpose

The public JSON seeds remain the canonical bootstrap layer.
The seed sync pipeline turns those contracts into **merge upserts** for Firestore (Phase C supplement).

## Operator order (do not reorder)

From **repo root**, after `npm install`:

1. **`npm run export:firestore-seed`** — verify every seed `manifest_hash` (fail closed).
2. **`npm run sync:firestore:dry-run`** — trust check; no service account required.
3. **`npm run sync:firestore`** — live merge upserts; requires `GOOGLE_APPLICATION_CREDENTIALS`.

The browser (`VITE_FIREBASE_*`) is **read-only** in the Hall. Never run export or sync inside the Vite bundle.

Public checklist: **`/steward-runbook.md`** (`frontend/public/steward-runbook.md`).

## Source files


- `frontend/public/vessel_members.json`
- `frontend/public/room_registry.json`
- `frontend/public/quest_board.json`
- `frontend/public/mission_board.json`
- `frontend/public/grace_project.json`

## Export (artifact)

From **repo root**:

```bash
npm install
npm run export:firestore-seed
```

Writes `build/lodge-firestore-seed.json` containing manifest verification and `upserts[]` (collection, deterministic doc id, payload, source path).

## Push to Firestore (Phase C)

**Dry-run (trust path)**

- No Firebase credentials required.
- Run `npm run sync:firestore:dry-run` after export; it fails closed on bad manifests like a real sync.

**Live merge upsert**

**Prerequisites**

- Service account JSON with **Cloud Datastore / Firestore** write access to the target project.
- Shell env: `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`

**Commands**

```bash
# validate bundle shape + manifests (no credentials, no Firestore I/O)
npm run sync:firestore:dry-run

# merge upserts (no deletes) — requires GOOGLE_APPLICATION_CREDENTIALS
npm run sync:firestore
```

`sync:firestore:dry-run` prints a JSON summary: upsert counts per collection, sample document ids, `generated_at`, and confirms manifests passed (same checks as a real run).

Behavior:

- **merge: true** — updates fields present in the seed payload; **does not remove** extra fields already on a document (unless overwritten by the same key).
- **No deletes** — documents only in Firestore stay until manually removed.
- Adds steward metadata on each merged doc: `seed_source`, `seed_sync_at`, `seed_sync_bundle_generated_at`.
- Refuses if any entry in `manifests[]` has `verified: false`.

Allowed collections: `lodge_members`, `lodge_rooms`, `lodge_quests`, `lodge_meta`.

## Current collection mapping

- `lodge_members`
- `lodge_rooms`
- `lodge_quests`
- `lodge_meta`
- `lodge_claims` — **not** populated by this job; steward-managed (see `claims.md`).

## Rules

- Verify `manifest_hash` before exporting.
- Do not export unsigned or mismatched seeds as if they were healthy.
- Keep the export one-way.
- Keep Firestore as a supplement; stamped JSON stays the integrity baseline for the Hall.

## Intended use

The export is a **bridge artifact** for inspection and CI.
The sync job is **steward-operated** locally or in CI with a secret service account — never from the browser bundle.

**Operator checklist:** `/steward-runbook.md` (source `frontend/public/steward-runbook.md`).
