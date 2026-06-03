# Bounty 003 — L-System Flower Bed

**Status:** Ready to submit  
**Author:** Claude (Hearthlands Architect)  
**$EMBER reward:** 0.5 base per branch segment (harvest bonus at bloom stage 3)

---

## What this does

Implements a **Lindenmayer System** — the mathematical grammar
developed by biologist Aristid Lindenmayer in 1968 to model plant
growth. The classic plant rule set used here:

```
Axiom:  X
X  →  F+[[X]-X]-F[-FX]+X
F  →  FF
```

`$heat` drives three parameters:
- **Generations** (growth iterations): 1-6 based on heat range
- **Branch angle**: extracted from heat bits 8-15, maps to 15-45°  
- **Segment length**: scales inversely with generations

The module runs entirely in WASM — no JavaScript, no randomness,
fully deterministic. Same `$heat` → same plant, always.

## Bloom stages

| Heat range | Generations | Stage   | Visual |
|------------|-------------|---------|--------|
| 0-99       | 1           | Seed    | Single stem |
| 100-499    | 2           | Sprout  | First branches |
| 500-999    | 3           | Plant   | Leaves appear |
| 1000-1999  | 4           | Plant   | Full foliage |
| 2000-3499  | 5           | Bloom   | Flower buds |
| 3500+      | 6           | Bloom   | Full bloom |

## Files

| File | Purpose |
|------|---------|
| `bounty_003_lsystem_flower.wat` | WASM module — paste into Forge |
| `FlowerBed.jsx` | Three.js React component |
| `flowerBedBridge.ts` | WASM → ForgeNode → Firestore bridge |

## Forge submission steps

1. Paste `bounty_003_lsystem_flower.wat` into the Forge sandbox
2. Click **Sign** — Hearth stamps the chain_hash
3. Click **Run** with `$heat = 2980` (your current balance)
4. Expected output: branch count (number of stem segments drawn)
5. `flowerBedBridge.ts` reads all branch geometry from WASM memory
6. Writes a `flora` ForgeNode to `three_forge/world_state`
7. ThreeForge renders a living plant near the Aquaponic Heart

## ThreeForge.tsx patch

Add `'flora'` to your ForgeNode interface object_type union:
```ts
object_type: 'node' | 'waterwheel' | 'hearth' | 'library' | 'lodge' | 'flora'
```

Add flora rendering in your scene:
```tsx
import FlowerBed from './FlowerBed'

{nodes
  .filter(n => n.object_type === 'flora')
  .map(node => (
    <FlowerBed
      key={node.id}
      position={[node.x, node.y, node.z]}
      chainHash={node.chain_hash ?? '0'.repeat(64)}
      heatLevel={node.heat_level ?? 0}
      bloomStage={node.bloom_stage ?? 0}
      branchData={node.branch_data ?? []}
      title={node.title ?? 'Garden Plot'}
      placedBy={node.placed_by ?? ''}
    />
  ))
}
```

## Next — Step 4: Water Simulation

Bounty 004 will implement cellular automata fluid physics.
`$heat` drives viscosity and flow rate. Output renders as
a shimmering plane mesh near the Waterwheel.

The world grows with every bounty. The Hearth breathes.
