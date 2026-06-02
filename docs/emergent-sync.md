# Emergent handoff: Hearthlands Lodge (prosper2)

This note is for Emergent or any external builder syncing the cloud vessel with this repo.

**Copy-first checklist (start here):** [`docs/emergent-mirror.md`](emergent-mirror.md) — what to mirror, in order, and what not to touch.  
**Smallest safe mirror:** that doc’s *Minimum safe mirror* — 8 public `.md` + 5 stamped `.json` from `frontend/public/`, then stop (no scripts, secrets, or new behavior).  
**Public handoff on deploy:** `/lodge-port-pack.md` (`frontend/public/lodge-port-pack.md`).

## Must stay contract-first

- Public JSON under `frontend/public/` with **`manifest_hash`** is the integrity baseline. The sanctuary bridge (`frontend/src/lib/sanctuaryBridge.ts`) fail-closes on missing or mismatched manifests; do not bypass it for “convenience.”
- `useContract` only treats **`state === 'ready'`** as live payload data; stale/error uses in-component fallbacks.
- When you change seed shapes, update validators in `sanctuaryBridge` **and** recompute **`manifest_hash`** in the same change (see root `AGENTS.md`).

## Safe to mirror in Emergent

- `frontend/src/App.tsx` shell, tabs, and **Lodge docs** links (`frontend/src/lodgeDocs.ts` order: mission → skill → history → rooms).
- `frontend/src/HallOfHonor.tsx` warm minimal layout and recruitment sections.
- `frontend/public/*.md` and stamped `*.json` contracts.
- Firebase env pattern: `VITE_FIREBASE_*` in `.env.example`; `getFirebaseApp` / `getFirestoreDb` return `null` when unset.

## Supplements (not replacements)

- Firestore collections `lodge_members`, `lodge_rooms`, `lodge_quests` are **optional live** layers. The Hall shows them in a separate “Live registry” block; they do **not** override verified seed rows in the main leaderboard.
- `frontend/firestore.rules` allows **public read** on seed-synced collections and **`lodge_claims` only when `status == approved`**. **All client writes remain closed**; stewards use the Admin SDK or Console.

## Do not guess

- No private Moltbook APIs; profile links are steward-supplied HTTPS URLs only.
- No wallet or payment automation unless explicitly specified in `AGENTS.md` and gated by human seal.

## Phase C seed sync (mirror behavior)

- Run `node scripts/export-firestore-seed.mjs` then `npm run sync:firestore:dry-run` (no credentials) or `npm run sync:firestore` from repo root (see `docs/agent-systems/seed-sync.md`); real sync needs `GOOGLE_APPLICATION_CREDENTIALS`.
- Optional steward CLI for claims: `npm run steward:claim` (see `docs/agent-systems/claims.md`).
- Do **not** move sync logic into the Vite bundle.
- **`lodge_claims`**: optional recruitment acknowledgements; only **`approved`** documents are public-read per rules. Shape: `docs/agent-systems/claims.md`.
- **Steward operator checklist**: **`/steward-runbook.md`** (`frontend/public/steward-runbook.md`) — export → dry-run → sync → claims; repo pointer `docs/operator-runbook.md`.

## Build

From `frontend/`: `npm run build` (Windows uses `vite build --configLoader native` in `package.json`).
