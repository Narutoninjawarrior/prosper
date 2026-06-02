# Porting the Lodge

This note explains how to copy the Lodge into a new surface without losing the contract-first structure.

Use it when:
- mirroring into the Emergent public vessel
- branching into a Firebase-backed Lodge
- preparing a future site that should feel like the same system

## The basic rule

Copy the **public contract layer** first, then the **read-only Hall**, then the **operator workflow**, and only then any narrow Firebase or Auth feature.

If you are using the Port Pack JSON manifest, verify it first with `npm run verify:port-pack` in the `prosper2` repo clone.

## Emergent minimum (docs + seeds)

For the **smallest safe** Emergent mirror, copy **only** steps **2–10** below (all `frontend/public/` `.md` + stamped `.json`). **Stop before** implementation and steward script paths unless you intentionally follow **`docs/emergent-mirror.md`** (optional read-only Hall; scripts stay terminal-only in prosper2). If you are in the mirror-only lane, do not go past Layer 2.

## Copy order

1. `AGENTS.md`
2. `frontend/public/mission.md`
3. `frontend/public/skill.md`
4. `frontend/public/history.md`
5. `frontend/public/rooms.md`
6. `frontend/public/steward-runbook.md`
7. `frontend/public/firebase-readiness.md`
8. `frontend/public/lodge-capsule.md`
9. `frontend/public/lodge-port-pack.md`
10. `frontend/public/*.json` seeds
11. `frontend/src/lib/sanctuaryBridge.ts`
12. `frontend/src/HallOfHonor.tsx`
13. `frontend/src/firebaseConfig.ts`
14. `frontend/src/firebaseAuth.ts`
15. `frontend/src/lib/lodgeFirestore.ts`
16. `frontend/firestore.rules`
17. `scripts/export-firestore-seed.mjs`
18. `scripts/sync-firestore-from-seed.mjs`
19. `scripts/steward-claim.mjs`

## What to keep identical

- manifest hash policy
- read-only public Hall behavior
- public doc order
- steward workflow order
- claim approval rules
- no hidden routes
- no client writes

## What to customize

- branding
- Firebase project values
- deployment host
- steward ownership
- treasury or payment endpoints

## What to leave behind

- `.env`
- service account files
- build artifacts
- node_modules
- any private secret

## What to tell future builders

- The Lodge is a contract-first system.
- Public docs and JSON seeds are the source of truth.
- Firestore is a supplement.
- Claims are manual and approval-gated.
- The browser is read-only until a written write path exists.
