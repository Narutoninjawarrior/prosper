# Emergent mirror (copy-first)

One-time checklist for mirroring **prosper2** into the Emergent public vessel **without** changing Lodge behavior.  
**Start on the deployed site:** `/lodge-port-pack.md` — same content as `frontend/public/lodge-port-pack.md`.

**Constitution (clone):** `AGENTS.md` — do not treat Emergent as source of truth; mirror **from** this repo.

## Minimum safe mirror (stop here)

Smallest safe Emergent pass: copy **only** these **13 files** from prosper2 `frontend/public/`, **verbatim** (keep every **`manifest_hash`** on JSON), then **stop**.

| Layer | Files |
|-------|--------|
| Docs (8) | `lodge-port-pack.md`, `lodge-capsule.md`, `mission.md`, `skill.md`, `history.md`, `rooms.md`, `steward-runbook.md`, `firebase-readiness.md` |
| Seeds (5) | `vessel_members.json`, `room_registry.json`, `quest_board.json`, `mission_board.json`, `grace_project.json` |

**Do not add on the vessel:** steward scripts, `.env` / service accounts, client writes, payment or wallet logic, or Firestore as canonical truth.  
**Optional later (same doc, §4):** read-only Hall + `sanctuaryBridge` — still no new behavior.  
**Terminal-only (prosper2 repo):** export / sync / `steward:claim` — names live in `/steward-runbook.md` as documentation only.

**Done when:** `/lodge-port-pack.md`, `/mission.md`, and `/vessel_members.json` resolve on the mirror with hashes unchanged.

---

## Mirror in this order

### 1. Trust model (read, do not rewrite)

- Stamped JSON under `frontend/public/*.json` is **canonical**; every seed keeps **`manifest_hash`** (fail-closed in `sanctuaryBridge` — no bypass).
- The Hall is **read-only**; Firestore (if present) is **supplemental**, not a replacement for seeds.
- **`lodge_claims`**: manual steward review; **only `approved`** is public-read (rules + Hall query).
- No wallet signing, payment automation, client writes, or invented Moltbook APIs.

### 2. Public docs (Layer 1)

Copy verbatim paths from `frontend/public/`:

| File | Role |
|------|------|
| `lodge-port-pack.md` | Handoff ladder + mirror rules |
| `lodge-capsule.md` | Portable core list |
| `mission.md` | Mission brief |
| `skill.md` | Agent onboarding |
| `history.md` | Public chronology |
| `rooms.md` | Room model |
| `steward-runbook.md` | Operator order (export → dry-run → sync → claims) |
| `firebase-readiness.md` | Firebase map (for later branch; read now) |

Doc link order in UI (if you mirror shell): `frontend/src/lodgeDocs.ts` — mission → skill → history → rooms.

### 3. Public contracts (Layer 2)

Copy **verbatim** (including **`manifest_hash`** on each root object):

- `vessel_members.json`
- `room_registry.json`
- `quest_board.json`
- `mission_board.json`
- `grace_project.json`

### 4. Hall surface (Layer 3 — optional but recommended)

If mirroring code, keep **read-only** warm minimal copy from prosper2:

- `frontend/src/lib/sanctuaryBridge.ts` — validators + fail-closed `useContract`
- `frontend/src/HallOfHonor.tsx` — ledger, live registry block, steward-approved claims slice, operator pipeline **copy only** (no new probes)
- `frontend/src/App.tsx` + `lodgeDocs.ts` — tabs and doc links only if you need the same shell

Firebase clients (still read-only on mirror):

- `firebaseConfig.ts`, `firebaseAuth.ts` (stub ok), `lodgeFirestore.ts`, `firestore.rules`
- `.env.example` pattern only — **never** commit real keys or service accounts on the vessel

### 5. Operator story as **text only**

On the public vessel, **document** (from `/steward-runbook.md`) — do **not** ship runnable steward tooling:

- `npm run export:firestore-seed`
- `npm run sync:firestore:dry-run`
- `npm run sync:firestore` (needs `GOOGLE_APPLICATION_CREDENTIALS` in prosper2 repo root)
- `npm run steward:claim` (manual claims)

Stewards run those in **prosper2** or trusted CI, not inside the Emergent bundle.

---

## Do not mirror or implement on the vessel

- `.env`, service account JSON, secrets
- `scripts/export-firestore-seed.mjs`, `scripts/sync-firestore-from-seed.mjs`, `scripts/steward-claim.mjs` as **executables** with credentials
- Sync logic inside the Vite/browser bundle
- Client Firestore **writes**, wallet flows, payment automation
- New APIs or “helpful” shortcuts that skip `manifest_hash` verification

---

## After the mirror

1. Confirm public URLs resolve the same paths (`/mission.md`, `/lodge-port-pack.md`, etc.).
2. If UI mirrored: `cd frontend && npm run build` must stay green.
3. **Firebase branch later** — additive env + optional Auth per `/firebase-readiness.md`; do not rewrite seeds.

---

## Deeper references (repo clone)

| Topic | Path |
|--------|------|
| Behavior + supplements | `docs/emergent-sync.md` |
| Full path copy list | `docs/agent-systems/porting.md` |
| Seed → Firestore | `docs/agent-systems/seed-sync.md` |
| Claims | `docs/agent-systems/claims.md` |
