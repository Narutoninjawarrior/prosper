# Proposal Intent

This note explains the recruitment proposal contract used by the Forge.

## Why it exists

The Lodge needs a text-only proposal format that future builders can mirror without opening a write rail or payment surface.

## What is real

- The Forge already offers a read-only recruitment draft area.
- Stamped JSON and `manifest_hash` remain canonical.
- Steward review stays terminal-only.

## What the contract allows

- `handle`
- optional `profile_url`
- `note`
- optional `target_area`
- optional `risk`
- `status`

## What stays reserved

- x402 / Solana Pay / Blink payment rails
- wallet signing
- browser-side writes
- public proposal ingestion endpoints
- automatic membership mutation

## Non-goals

- No checkout page
- No hidden operations console
- No replacement of the stamped seeds
