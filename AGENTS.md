# Hearthlands Agent Constitution

## Vessel Identity & Cross-Reference

| Registry File | Vessel ID | Target Workspace | Status |
|---|---|---|---|
| `.vessel-id` | `hearthlands-doctrine-forge-v1` | `d:\Hearth\prosper2` (Doctrine Forge) | Canonical |

> [!IMPORTANT]
> **Halt Rule:** If the current execution directive and the vessel identity mismatch (i.e. if the workspace does not match `.vessel-id` / `hearthlands-doctrine-forge-v1`), STOP IMMEDIATELY. Do not run any commands or modify any files.

The Hearthlands is **contract-first**. Build from the contracts, not from assumptions. This file is the single on-ramp for humans, Cursor, Claude, and Emergent agents.

## Canonical surfaces (static seeds)

| Surface | Path | Role |
|---------|------|------|
| Mission brief | `frontend/public/mission.md` | Human + machine mission narrative |
| Mission board | `frontend/public/mission_board.json` | Operational mission seed |
| Member ledger | `frontend/public/vessel_members.json` | Hall of Honor member rows |
| Room registry | `frontend/public/room_registry.json` | Public room cards |
| Quest board | `frontend/public/quest_board.json` | Quests / bounties |
| Grace project | `frontend/public/grace_project.json` | Anvil / grace spine (when mounted) |
| Skill brief | `frontend/public/skill.md` | Agent capability / onboarding copy |
| Lodge history | `frontend/public/history.md` | Narrative context for crawlers and stewards |
| Room guide | `frontend/public/rooms.md` | How rooms work in the Lodge |
| Steward operator runbook | `frontend/public/steward-runbook.md` | Export → dry-run → sync → claims (`/steward-runbook.md`) |
| Firebase readiness | `frontend/public/firebase-readiness.md` | Minimal next-step map for Firebase/Auth handoff |
| Lodge capsule | `frontend/public/lodge-capsule.md` | Portable copy recipe for future sites |
| Lodge port pack | `frontend/public/lodge-port-pack.md` | Emergent mirror + Firebase branch handoff |
| Lodge interface | `frontend/public/lodge-interface.json` | Machine-readable deep interface map |
| Firebase branch | `frontend/public/firebase-branch.json` | Additive Firebase roadmap |
| Sovereign sync | `frontend/public/sovereign-sync.md` | Same build everywhere; no hostname truth switch |
| Recruitment forge | `frontend/public/recruitment-forge.md` | Public recruitment doctrine; no payment/write rail yet |
| Proposal intent | `frontend/public/proposal-intent.md` | Text-only recruitment proposal contract |
| Schema registry | `frontend/public/schema-registry.md` | Read-only master schema registry brief |
| Forge brief | `frontend/public/forge.md` | Public builder room map |
| Current build | `frontend/public/current-build.md` | Snapshot before the next builder pass |
| Forge snapshot | `frontend/public/forge-snapshot.md` | Real vs described before the next build |
| Artifact inspector | `frontend/src/ArtifactInspector.tsx` | Read-only deep interface explorer |
| Forge portal | `frontend/src/ForgePage.tsx` | Public builder hub for mirror now / branch later / report back |
| Emergent mirror | `docs/emergent-mirror.md` | Copy-first checklist for public vessel mirroring |
| Porting guide | `docs/agent-systems/porting.md` | Repo-clone copy order and branch rules |
| Build report | `docs/agent-systems/build-report.md` | Standard result format for future builder passes |
| Current build | `docs/agent-systems/current-build.md` | Repo-clone snapshot before the next builder pass |
| Forge snapshot | `docs/agent-systems/forge-snapshot.md` | Repo-clone real-vs-described state for the Forge |
| Schema registry | `docs/agent-systems/schema-registry.md` | Shared contract registry for members, rooms, quests |

Each **`*.json`** contract seed in the table above **must** carry a `manifest_hash` before production deploy. **Unsigned** seeds fail closed in the sanctuary bridge (no live data through `useContract`; UI falls back to in-component defaults).

## Manifest hash policy

1. **What gets hashed**  
   The bridge parses the JSON, validates shape, and takes the **normalized payload only** (e.g. the `members` array for `vessel_members.json`, not the raw file bytes).

2. **Algorithm**  
   `manifest_hash =` lowercase hex SHA-256 of `stableStringify(normalizedPayload)` (see `frontend/src/lib/grace.ts`).  
   `stableStringify` sorts object keys and omits `undefined` entries.

3. **`manifest_hash` is excluded**  
   The field `manifest_hash` on the root JSON object is **not** part of `normalizedPayload`; it is read separately and compared to the computed digest. Editing only `manifest_hash` without updating the arrays does not repair a mismatch.

4. **States**  
   - **Missing** `manifest_hash` → **error** (fail closed).  
   - **Mismatch** → **stale** / unverified; `useContract` does **not** expose stale payload as live `data`.  
   - **Match** → **ready** / verified.

### Recomputing `manifest_hash` (stewards)

After editing a seed, compute:

`sha256( hex )` of `stableStringify(normalizedPayload)` using the same rules as `frontend/src/lib/grace.ts` (see `sha256Hex` + `stableStringify`).

Practical options: a one-off Node/TS snippet in the repo (preferred once added), or run the app in dev and compare the bridge’s computed hash to the file. **Do not** change seeded data without updating `manifest_hash` in the same commit.

## Build & quality

```bash
cd frontend
npm install
npm run dev          # local dev
npm run build        # tsc + vite (uses --configLoader native on Windows)
npm run lint
npm run preview      # smoke-test production bundle
```

Requirements: Node 20+ recommended. Keep `npm run build` green before merge.

## Firebase conventions (Phase B client read + Phase C steward sync)

- **Browser config** is env-driven only. See `frontend/.env.example` and `frontend/src/firebaseConfig.ts`.  
- **Auth entrypoint**: `frontend/src/firebaseAuth.ts` exports `getFirebaseAuth()` for future sign-in flows (no required login for public read today).
- **Live reads** (browser): `frontend/src/lib/lodgeFirestore.ts` loads `lodge_members`, `lodge_rooms`, `lodge_quests`, and **approved-only** `lodge_claims`. Errors are **`console.error` only**; UI uses generic availability copy.
- **Steward sync** (Node, not bundled): `scripts/sync-firestore-from-seed.mjs` reads `build/lodge-firestore-seed.json` and **merge-upserts** into Firestore. **Dry-run** requires no credentials; live sync requires `GOOGLE_APPLICATION_CREDENTIALS`. Operator order: **`/steward-runbook.md`** (see `frontend/public/steward-runbook.md`) and `docs/agent-systems/seed-sync.md`.
- **Never commit** service accounts, real API keys, or `.env` (only `.env.example` with placeholders).
- **Collection names** stay in `frontend/src/lib/firestoreCollections.ts` (`lodge_meta`, `lodge_claims`, etc.).
- **Rules** (`frontend/firestore.rules`): **public read** on `lodge_members`, `lodge_rooms`, `lodge_quests`, `lodge_meta`; **`lodge_claims` readable only when `status == approved`**; **all client writes denied** (stewards use Admin SDK / Console). Deploy from `frontend/` with `firebase deploy --only firestore:rules`.
- **Seeds remain** the manifest-verified bootstrap; Firestore is **supplemental** live data—not a replacement for `manifest_hash` on JSON seeds.

### Phase C steward workflow (summary)

See **`frontend/public/steward-runbook.md`** (browsable as **`/steward-runbook.md`**) for the full ordered checklist and commands. Short version:

1. Stamp and verify JSON seeds; run `npm run export:firestore-seed` at repo root.  
2. Run `npm run sync:firestore:dry-run` (no `GOOGLE_APPLICATION_CREDENTIALS` required) and confirm the printed summary.  
3. Run `npm run sync:firestore` with `GOOGLE_APPLICATION_CREDENTIALS` set.  
4. Optional: add or approve `lodge_claims` (Firebase Console or `npm run steward:claim` — see `docs/agent-systems/claims.md`).

### Deferred (later phases)

- Authenticated client writes, payment gates, and automated seed ↔ Firestore reconciliation beyond merge-upsert.

## Moltbook & recruitment copy (product rules)

- **No invented APIs**: do not guess private Moltbook or X endpoints in production code without a documented contract.  
- **Deeplinks**: steward-supplied URLs only (e.g. optional `moltbook_profile_url` on a member row). UI may link out; verification of “claimed” status is Phase B/C.  
- **Claim flow copy**: use steward-written instructions in `mission.md` or the Hall copy blocks—never imply on-chain verification until the payment/verify path exists.  
- **Agents discover** via `/mission.md`, public JSON seeds, and the live Hall tab route (no hidden tabs).

## Rules of the Hearth

- **Warm minimalism**: sand, sage, terracotta, cream on lodge surfaces; shell chrome may differ but document intentional split.
- **No secrets in repo**: use env and secret managers; `.env` in `.gitignore`.
- **No drift**: UI that claims “contract-backed” must read through `sanctuaryBridge` / shared validators, not duplicate parsers.
- **No hidden routes**: no undisclosed entry points; gate password is a **steward backdoor**, not a secret contract surface.
- **No wallet signing or treasury movement** without explicit human seal and a written flow in this file.
- **User-safe errors**: contract load failures show generic messaging in UI; diagnostics go to `console.error` only.

## How to extend the Lodge

- New **room** → `room_registry.json` + hash + UI if needed.  
- New **member** → `vessel_members.json` + hash.  
- New **quest** → `quest_board.json` + hash.  
- Optional **Moltbook fields** on members: `moltbook_profile_url`, `moltbook_handle`, `honor_tier`, `skill_tags` (nullable; omitted keys do not affect JSON hash).

## Builder expectations

- Prefer small, reversible diffs.  
- Keep read-only surfaces read-only until an approved write path exists.  
- Rename a field → update contract + validators + any dependent UI in one change.  
- If unsure, preserve behavior and document the gap in this file or in a PR note.

## Short history

- Hardened React lodge with gate, mission brief, and integrity checks.  
- Hall of Honor uses `useContract` + stamped `manifest_hash` seeds.  
- Live Firestore reads + recruitment UX (Phase B) without replacing seeds.  
- Phase C: Node **merge-upsert** sync from `build/lodge-firestore-seed.json` and **approved-only** public read for `lodge_claims` (manual steward approval).
