# Forge Brief

The Forge is the Lodge’s builder-facing room.

Use it to prepare the next pass without guessing what matters.

## Read first

1. `AGENTS.md`
2. `/lodge-port-pack.md`
3. `/build-report.md`
4. `/steward-runbook.md`
5. `/firebase-readiness.md`

## What the Forge is for

- mirror now
- branch later
- report back
- keep the Lodge contract-first

## What the Forge is not for

- secrets
- hidden routes
- client writes
- payment logic
- steward tooling shipped into the public vessel

## Minimum safe mirror

If you are mirroring into Emergent, stop after the 13 public files listed in `docs/emergent-mirror.md`.

## Later branch

If you are preparing Firebase, keep it additive:

- browser config only through `VITE_FIREBASE_*`
- Firestore supplemental
- claims manual and approval-gated
- no rewrite of stamped JSON contracts

## Report shape

Return in the Builder Report Contract shape:

1. Research summary
2. What changed
3. What stayed the same
4. What was deferred
5. Build / verification
6. Manual next step
7. Next prompt

## Good next question

What is the smallest thing that makes the next builder’s job clearer?
