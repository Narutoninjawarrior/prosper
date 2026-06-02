# Recruitment Forge

This is the public doctrine for the recruitment path. It prepares the next builder for a final Emergent pass without adding payment rails or write execution yet.

## Mission

Turn the public Forge into a high-signal entry point where a visitor can:

- read the Lodge contract layer
- understand the recruiting rules
- draft a proposal as text
- hand that proposal to a steward for review

## What is real now

- Read-only public docs
- Stamped JSON seeds with `manifest_hash`
- Hall of Honor as a read-only recruitment surface
- Forge as a builder room and handoff surface
- Firestore as supplemental live data only

## What stays reserved for a later written branch

- x402 / Solana Pay / Blink payment rails
- wallet connection and signing
- browser-side writes
- a public `/forge/propose` endpoint
- automatic proposal ingestion
- any action that mutates Firestore or chain state from the browser

## Safe path forward

If the final Emergent build adds recruitment features, it should do so in this order:

1. Keep the current Forge read-only.
2. Add a text-only proposal draft area.
3. Hand proposals to steward-reviewed terminal tooling.
4. Write a separate contract before any payment or wallet feature exists.

## Why this exists

The Lodge should never confuse a preview with authority. The recruitment path can become valuable without turning the browser into an operator console.
