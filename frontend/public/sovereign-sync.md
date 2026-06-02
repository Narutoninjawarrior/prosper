# Sovereign Sync

The Lodge ships the same contract-first frontend everywhere. We do **not** switch the source of truth by hostname.

## What stays true in every vessel

- Stamped JSON seeds remain canonical.
- `manifest_hash` stays fail-closed.
- `sanctuaryBridge` / `useContract` remain the public truth gate for seeded contracts.
- Firestore is supplemental live data only.
- Browser surfaces stay read-only until a written write path exists.
- Steward sync runs from the repo root, not from the browser bundle.

## Deployment ladder

1. Verify the manifest contracts.
2. Build the same frontend bundle.
3. Deploy that bundle to the public host.
4. Set browser `VITE_FIREBASE_*` only when you want read-only supplemental Firestore reads.
5. Keep seed export, dry-run sync, live sync, and claims in the terminal.

## Do not do this

- Do not branch behavior on `window.location.hostname`.
- Do not use Firestore as a hidden replacement for the stamped seeds.
- Do not add wallet signing or payment logic in the browser.
- Do not push sync or claims through the Vite bundle.

## If the future changes

If a future branch needs writes, swaps, wallet flows, or AI action execution, it must ship with a written policy, its own verifier, and a rollback path. Until then, the public mirror stays a read-only reflection of the contract-first Lodge.
