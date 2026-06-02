# Lodge Capsule

This is the portable core of the Hearthlands Lodge.

Use it when you want to copy the Lodge into a new site, a Firebase-backed fork, or a future Emergent mirror without re-inventing the shape.

**Machine-readable manifest:** `/lodge-capsule.json` (aligned with `/lodge-port-pack.json` minimum mirror list). Verify from repo root: `npm run verify:port-pack`.

## What the capsule contains

- `AGENTS.md` as the constitution
- `frontend/public/mission.md`
- `frontend/public/skill.md`
- `frontend/public/history.md`
- `frontend/public/rooms.md`
- `frontend/public/steward-runbook.md`
- `frontend/public/firebase-readiness.md`
- `frontend/public/vessel_members.json`
- `frontend/public/room_registry.json`
- `frontend/public/quest_board.json`
- `frontend/public/mission_board.json`
- `frontend/public/grace_project.json`
- `frontend/src/lib/sanctuaryBridge.ts`
- `frontend/src/HallOfHonor.tsx`
- `frontend/src/firebaseConfig.ts`
- `frontend/src/firebaseAuth.ts`
- `frontend/src/lib/lodgeFirestore.ts`
- `frontend/firestore.rules`
- `scripts/export-firestore-seed.mjs`
- `scripts/sync-firestore-from-seed.mjs`
- `scripts/steward-claim.mjs`

## What stays site-specific

- Firebase project config in `frontend/.env.local`
- Firestore rules deployment target
- Steward service account path in `GOOGLE_APPLICATION_CREDENTIALS`
- Treasury / payment addresses
- Any public domain or deployment host

## Copy order

1. Copy the public docs and JSON contracts.
2. Copy the contract bridge and Hall surface.
3. Copy the Firebase config, rules, and steward scripts.
4. Fill in environment values.
5. Run the export → dry-run → sync → claims sequence.

## What not to copy

- `.env`
- service account JSON
- node_modules
- build output
- any private secret

## Rules for future builders

- Keep the JSON contracts canonical.
- Keep Firestore supplemental.
- Keep claims manual and approval-gated.
- Keep browser surfaces read-only until a write path is explicitly approved.
- Keep manifest verification fail-closed.

## Minimal adaptation rule

When a new site adopts the capsule, only change what is truly site-specific:

- branding
- public URLs
- Firebase project IDs
- steward ownership
- treasury/payment endpoints

Do not change the contract-first model unless the new site has a written replacement.
