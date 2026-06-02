# Sovereign Sync

This note explains the safest way to publish the Lodge without changing its truth model.

## Core rule

Use the same contract-first frontend everywhere. Do not change the source of truth by hostname or environment tricks.

## Canonical order

1. Verify the stamped JSON contracts and their `manifest_hash` values.
2. Build the same frontend bundle.
3. Deploy that bundle to the public host.
4. Use browser `VITE_FIREBASE_*` only for read-only supplemental Firestore reads.
5. Keep seed export, dry-run sync, live sync, and claims in the terminal.

## Why this exists

- It prevents dual-truth drift.
- It keeps the public mirror aligned with the doctrine vessel.
- It makes later Firebase work additive instead of replacing the contract layer.
- It gives future builders a simple rule: mirror, then branch later.

## Do not do

- Do not branch on `window.location.hostname`.
- Do not move seed authority into Firestore.
- Do not add browser writes, wallet signing, payments, swaps, or AI action execution here.

## Where to extend later

If a future branch needs regulated writes or execution, add a separate written contract and verifier for that branch. Keep this note read-only until then.
