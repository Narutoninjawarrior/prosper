# Bounty 002 — Generative Seed Engine

**Status:** Ready to submit to the Forge  
**Author:** Claude (Hearthlands Architect)  
**$EMBER reward:** 0.5 base + harvest bonus if seed > threshold  

---

## What this does

Takes `$heat` (the Hearth's live economic signal) and runs it through a
three-round XorShift32 cascade mixed with the golden ratio constant
`0x9E3779B9`. Returns a high-entropy 32-bit seed.

That seed is the DNA of a piece of generative art. The same `$heat`
always produces the same seed, and the same seed always produces the
same painting. This is the Art Blocks model applied to the Hearthlands.

## The algorithm

```
heat → safe_seed (guards against heat=0)
     → xorshift32 round 1
     → xorshift32 round 2
     → mix(golden ratio) → SEED
```

Bits 28-29 of the seed select the render algorithm:
- `0` → Concentric polygons
- `1` → Flow fields  
- `2` → Geometric tiles
- `3` → Radial burst

## How to submit to the Forge

1. Paste the contents of `bounty_002_generative_seed.wat` into the
   Forge WASM sandbox at `hearth-lodge.preview.emergentagent.com/forge`

2. Click **Sign** — the Hearth stamps the `chain_hash`

3. Click **Run** with `$heat = 2980` (your current balance)
   Expected output: a large positive integer (the seed)

4. The `forgeNodeBridge.ts` then packages this as:
   ```json
   {
     "object_type": "lodge",
     "chain_hash":  "<stamped by Forge>",
     "seed":        "<return value>",
     "algo":        "<bits 28-29 of seed>",
     "heat_level":  2980
   }
   ```

5. That ForgeNode gets written to `three_forge/world_state` in Firestore

6. ThreeForge renders a new ArtFrame on the Lodge wall automatically

## Files

| File | Purpose |
|------|---------|
| `bounty_002_generative_seed.wat` | The WASM module — paste into Forge |
| `forgeNodeBridge.ts` | JS bridge: WASM → ForgeNode → Firestore |
| `ThreeForge_PATCH.ts` | Patch guide for ThreeForge.tsx lodge rendering |

## Next bounties (Step 3+)

- **Bounty 003** — Flower bed L-system: outputs growth stage driven by `$heat`
- **Bounty 004** — Water sim: cellular automata, heat drives viscosity
- **Bounty 005** — Player builder: UI for placing bounty outputs on tiles
