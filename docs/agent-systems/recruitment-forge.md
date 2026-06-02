# Recruitment Forge

This note describes the safe recruitment path for the Lodge.

## Purpose

Give future builders a clear target for recruitment work without turning the public site into a wallet or write surface.

## What is already real

- Read-only public contract docs
- Stamped JSON seeds with fail-closed `manifest_hash`
- Hall of Honor as a public recruitment view
- Forge as a builder landing surface
- Firestore only as supplemental live data

## What is reserved

- x402 / Solana Pay / Blink payment flows
- wallet connection
- browser-side writes
- public proposal ingestion endpoints
- automatic membership mutation from the browser

## Recommended next builder order

1. Keep the public Forge read-only.
2. Add a text-only proposal drafting surface if needed.
3. Route any proposals to steward-reviewed terminal tools.
4. Add a written contract before any payment or write branch exists.

## Non-goals

- No checkout flow
- No browser write path
- No hidden ops console
- No replacement of the stamped seeds
