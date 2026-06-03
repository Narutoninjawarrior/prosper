# Bounty 004 — Cellular Automata Water Simulation

**Status:** Ready to submit  
**Author:** Claude (Hearthlands Architect)  
**$EMBER reward:** 0.5 per water cell surviving per tick (harvest bonus at full flow)

---

## What this delivers

Step 4 is not just a water simulation. It's the **reactive world engine** —
the system that makes every object in the Hearthlands aware of every other.

### Files in this bounty

| File | Purpose |
|------|---------|
| `bounty_004_water_sim.wat` | WASM cellular automata (32×32 grid, phase transitions, reagents) |
| `WaterSim.jsx` | Three.js renderer (water, ice, steam, instanced cells) |
| `reagentRegistry.ts` | Open substance registry (10 built-in, infinitely extensible) |
| `interactionEngine.ts` | Node-to-node interaction processor (runs every 5s) |
| `BuilderPanel.jsx` | World builder UI (all object categories, $EMBER gating) |

---

## The Water Physics

32×32 cellular automata grid. Sand-fall style rules:

1. Water falls down if empty below
2. Water flows diagonal if blocked below  
3. Water spreads laterally at `flow_speed` probability
4. Steam rises, condenses at top back to water
5. **Freeze**: `heat < freeze_threshold` → probabilistic ice formation
6. **Melt**: `heat > freeze_threshold + margin` → probabilistic thaw
7. **Steam**: `heat > 8000` → water evaporates upward

### Phase transition chart

| $heat | Water behavior |
|-------|---------------|
| 0     | Instant freeze, no flow |
| 500   | Partial freeze, slow flow |
| 1000  | Mix of ice and water |
| 2000  | Mostly water, some edge ice |
| 2980  | Fast flowing water, no freeze |
| 5000  | Water + steam at surface |
| 8000+ | Rapid evaporation, steam columns |

---

## The Reagent System

10 built-in substances, open registry for infinite more.
Each modifies freeze threshold and flow speed in WASM,
and triggers world interactions via the interaction engine.

| Reagent | Freeze mod | Flow mod | Special |
|---------|-----------|----------|---------|
| Pure Water | 0 | 0 | — |
| $EMBER Dust | -200 | +10 | Earns 2 $EMBER/tick. Amber ice. |
| Salt | -400 | +20 | Never fully freezes. Salt crystals. |
| Ash | +100 | -25 | Fertilizes flora. Obsidian ice. |
| Pollen | -50 | +5 | Auto-dissolves from nearby flowers. |
| Moonstone | +300 | -10 | Night only. Geometric ice patterns. |
| Chain Dust | 0 | 0 | Hash-tinted water. Tints art frames. |
| Brine | -600 | +30 | Salt + Ember combo. Double speed. |
| Lightning | -1000 | +50 | Rare. Electrified cyan water. |
| Void Water | +500 | -50 | Near Tesseract. Flows upward. |

---

## The Interaction Matrix

What happens when world objects are near each other:

| Source | Target | Effect |
|--------|--------|--------|
| Ember water | Flora | +1 bloom stage |
| Ash water | Flora | +2 bloom stages (fertilizer) |
| Soil water | Flora | +3 bloom stages (most fertile) |
| Pollen water | Flora | Feedback loop growth signal |
| Brine | Flora | -1 bloom stage (too hot) |
| Frozen water | Flora | -1 bloom stage (frost damage) |
| Hearth | Frozen water | Directional melt from facing edge |
| Ember water | Art frame | Warm orange tint on canvas |
| Chain dust water | Art frame | Hash-color tint |
| Salt water | Any surface | Salt crystal formations |

---

## ThreeForge.tsx patch

Add to `object_type` union:
```ts
object_type: 'node' | 'waterwheel' | 'hearth' | 'library' |
             'lodge' | 'flora' | 'water' | 'fire' | 'stone' |
             'bridge' | 'ruins' | 'lightning_rod' | 'crystal'
```

Add to scene (after `<FlowerBed>` rendering):
```tsx
import WaterSim    from './WaterSim'
import BuilderPanel from './BuilderPanel'
import { startInteractionEngine } from './lib/interactionEngine'

// In useEffect:
startInteractionEngine(5000)  // run every 5s

// In JSX scene:
{nodes
  .filter(n => n.object_type === 'water')
  .map(node => (
    <WaterSim
      key={node.id}
      position={[node.x, node.y, node.z]}
      chainHash={node.chain_hash ?? '0'.repeat(64)}
      heatLevel={node.heat_level ?? 1000}
      substanceId={node.substance_id ?? 0}
      wasmInstance={waterWasmRef.current}
      title={node.title}
      placedBy={node.placed_by}
    />
  ))
}

// Builder panel (outside Canvas):
<BuilderPanel
  emberBalance={playerEmberBalance}
  visible={builderOpen}
  onPlace={handlePlace}
/>
```

---

## Forge submission steps

1. Paste `bounty_004_water_sim.wat` into the Forge sandbox
2. Click **Sign** — Hearth stamps chain_hash
3. Click **Run** with `$heat = 2980`
4. Expected output: water cell count (~300-400 at this heat)
5. Bridge writes a `water` ForgeNode to Firestore
6. WaterSim renders live in the Lodge near the Waterwheel

---

## Step 5 preview

**The Crystal Growth Engine** — Bounty 005.
Moonstone ice, over multiple freeze/thaw cycles, grows
crystalline geometric structures. Each crystal is unique,
seeded by its chain_hash, mintable as 3D NFT geometry.
The world remembers every temperature change.

The Forge breathes. The Hearth is lit.
