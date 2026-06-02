# Lodge Port Pack

This is the smallest practical handoff for two futures:

1. **Mirror now** into the Emergent public vessel.
2. **Branch later** into a Firebase-backed Lodge **additively** (env + optional narrow Auth)—same contract-first skeleton, **not** a rewrite of seeds or `manifest_hash` policy.

The goal is not to copy every file. The goal is to preserve the Lodge’s contract-first shape, public reading order, and operator workflow so future builders can move quickly without guessing.

## Emergent: mirror first (this order)

For a **docs-and-contracts** mirror only—no new APIs, no behaviors, no secrets:

**Stop condition:** if you are doing the minimum safe mirror, copy only the 13 public files from `frontend/public/`, then stop. Do not continue into scripts, credentials, or new behavior unless you are intentionally following `docs/emergent-mirror.md` and the full repo-clone path.

**Smallest safe mirror:** Layer 1 + Layer 2 only (13 public files) — then stop. Checklist: repo **`docs/emergent-mirror.md`** § *Minimum safe mirror*.

Before you mirror, you can verify the machine-readable manifest with `npm run verify:port-pack` in the `prosper2` repo clone.

1. **Trust model** — Seeds under `frontend/public/*.json` stay canonical with **`manifest_hash`**; the Hall is read-only; Firestore (if you add it) is **supplemental**; claims are **manual** and **approved-only** in public. (Full rules: **`AGENTS.md`** in a repo clone, or a faithful excerpt on the mirror.)
2. **Layer 1 public text** — Include **this page** (`lodge-port-pack.md`), **`steward-runbook.md`**, **`firebase-readiness.md`**, **`lodge-capsule.md`**, plus mission / skill / history / rooms (`/steward-runbook.md` gives operator command order).
3. **Layer 2 JSON** — Mirror all stamped contract seeds **verbatim** (do not drop **`manifest_hash`**).
4. **Hall & bridge (optional but valuable)** — If you mirror UI, copy **`sanctuaryBridge.ts`** validation + **`HallOfHonor.tsx`** read-only patterns per repo **`docs/emergent-sync.md`** (same fail-closed behavior, no bypass for “convenience”).
5. **Terminal story as text only** — Do **not** ship steward scripts or credentials on the public vessel; **paste or summarize** command names and order from **`/steward-runbook.md`** so operators know what exists in prosper2.

Builders with a **full repo clone** should start with **`docs/emergent-mirror.md`** (one-time copy checklist), then **`docs/emergent-sync.md`** and **`docs/agent-systems/porting.md`** for behavior and path-precise lists.

## Source of truth ladder

1. `AGENTS.md` — constitution and no-drift rules.
2. `frontend/public/*.md` — public-facing human guidance.
3. `frontend/public/*.json` — stamped contract seeds.
4. `frontend/src/lib/sanctuaryBridge.ts` — contract validation and fail-closed reads.
5. `frontend/src/HallOfHonor.tsx` — read-only public surface.
6. `scripts/export-firestore-seed.mjs` + `scripts/sync-firestore-from-seed.mjs` — Firestore bridge (steward terminal).
7. `scripts/steward-claim.mjs` — steward-only claims review (steward terminal).

## What to mirror into Emergent now

Mirror only the parts that teach the Lodge without changing behavior:

- mission / skill / history / rooms docs
- **`lodge-port-pack.md` (this handoff)**
- steward runbook
- firebase-readiness note
- lodge-capsule note
- public JSON seed contracts
- Hall of Honor copy and read-only trust surfaces

Do **not** mirror:

- service account material
- hidden credentials
- root Node scripts as runnable artifacts on the public vessel (reference them from the runbook instead)
- any payment or signing logic
- any new write path

## What to branch into Firebase later

When the next deployment adds Firebase, treat it as a **later branch**: same ladder and layers; wire **`VITE_FIREBASE_*`**, optional **`getFirebaseAuth()`**, and supplemental reads—**after** public docs and seeds are stable. No client writes until a written, ruled path exists.

1. Public docs  
2. Stamped JSON seeds  
3. Sanctuary bridge  
4. Read-only Hall  
5. Firestore supplemental reads  
6. Steward terminal scripts (stay in repo / CI, not the bundle)  
7. Manual claim review  

Only then add **narrow** Auth or other writes.

## Copy layers

### Layer 1: public text

- `lodge-port-pack.md`
- `mission.md`
- `skill.md`
- `history.md`
- `rooms.md`
- `steward-runbook.md`
- `firebase-readiness.md`
- `lodge-capsule.md`

### Layer 2: public contracts

- `vessel_members.json`
- `room_registry.json`
- `quest_board.json`
- `mission_board.json`
- `grace_project.json`

### Layer 3: implementation

- `sanctuaryBridge.ts`
- `HallOfHonor.tsx`
- `firebaseConfig.ts`
- `firebaseAuth.ts`
- `lodgeFirestore.ts`
- `firestore.rules`

### Layer 4: steward tooling

- `export-firestore-seed.mjs`
- `sync-firestore-from-seed.mjs`
- `steward-claim.mjs`

*(Keep Layer 4 in the **source repo** or trusted automation; Emergent mirrors **names and order** from the runbook, not executable secrets.)*

## Emergent mirror rules

- Mirror the docs, not the secrets.
- Mirror the trust model, not the credentials.
- Mirror the read-only Hall, not operator executables on the public surface.
- Mirror the **command names and ordering** from **`/steward-runbook.md`** so the next builder does not guess.

## Firebase branch rules

- Keep stamped JSON canonical.
- Keep Firestore supplemental.
- Keep claims manual and approval-gated.
- Keep writes out of the browser until a written write path exists.
- Keep manifest verification fail-closed.

## Fast copy order (full repo)

1. Read **`AGENTS.md`**.
2. Mirror Layer 1 public docs (include this pack).
3. Mirror Layer 2 JSON seeds.
4. Mirror Layer 3 (bridge + Hall + Firebase clients + rules).
5. Layer 4 steward scripts + env—**terminal / CI only**.
6. Treat extra Firebase behavior as a **small branch**: configure, don’t replace contracts.

## What the next builder should ask first

- What is canonical?
- What is readable by the public?
- What is terminal-only?
- What is safe to mirror now?
- What is better left for the Firebase branch?

## Canonical references

| Who | Where |
|-----|--------|
| Public (deployed) | `/lodge-port-pack.md`, `/steward-runbook.md`, `/firebase-readiness.md`, `/lodge-capsule.md` |
| Repo (clone) | `AGENTS.md`, `docs/emergent-mirror.md`, `docs/emergent-sync.md`, `docs/agent-systems/porting.md`, `docs/agent-systems/seed-sync.md`, `docs/agent-systems/claims.md` |
