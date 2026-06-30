# Biosphere Visual Lab — research & tooling

Deep reference for debugging and evolving the Sovereign Biosphere (`/biosphere`) without touching `resonance.ts` or economy logic.

## Architecture map

| File | Responsibility |
|------|----------------|
| `frontend/src/App.tsx` | Route gate: `/biosphere` bypasses Lodge handshake |
| `frontend/src/BiosphereScene.jsx` | Canvas, Sky/Stars/Environment, postprocessing, HUD shell |
| `frontend/src/biosphere/BiosphereGrid.jsx` | 19 nodes, ground, Metatron lines, structures, plant UI |
| `frontend/src/biosphere/MyceliumNetwork.jsx` | MST + hex overlay, tube shader, node glows |
| `frontend/src/biosphere/SolarpunkStructures.jsx` | Towers, WindCatcher, Hearth |
| `frontend/src/biosphere/terrainNoise.js` | FBM `DataTexture` → ground `displacementMap` |
| `frontend/src/biosphere/resonance.ts` | Sacred geometry detection (do not change for visual passes) |

## Render pipeline (order matters)

1. **Base pass** — `meshStandardMaterial` / custom `shaderMaterial` / `meshPhysicalMaterial`
2. **Transparent** — mycelium tubes (`depthWrite: false`, additive blending)
3. **Post** — `EffectComposer` → Bloom → SSAO → Vignette
4. **Overlay** — `Html` HUD (outside Suspense in scene)

Bloom reads luminance from the composed image. SSAO with `MULTIPLY` and high `luminanceInfluence` darkens emissive threads on `#1A0E06` soil.

## Known code issues (research)

### 1. `ellipseGeometry` was invalid

Three.js has no `EllipseGeometry`. JSX tags like `<ellipseGeometry />` only work if registered via `extend()`.

**Used in:** `BiosphereGrid.jsx`, `SolarpunkStructures.jsx`, `FlowerBed.jsx` (water tower petals mount on every biosphere load).

**Fix:** `frontend/src/biosphere/geometries.js` + import in `main.tsx`.

### 2. Metatron floor spaghetti

`MetatronPaths` always draws **78** lines from `metatronConnections()`, independent of mycelium MST. Even with a clean mycelium graph, the floor can look busy.

**Next slice:** only draw pairs where both nodes are active, or `resonance !== null`.

### 3. HUD resonance (fixed in System & Clarity slice)

`BiosphereGrid` calls `onResonanceChange` → `BiosphereScene` `setResonance`. Bottom-left HUD now tracks live patterns.

### 4. Firestore on route (fixed)

`BiosphereRoute.tsx` read-only `onSnapshot(three_forge/world_state)` → `forgeNodes`. Sync uses `biosphere_node_id` on forge nodes when present.

### 5. Production blank root

If `https://fellowship-of-the-hearth.web.app/biosphere` shows an empty `#root`, the deployed bundle is crashing at runtime (check browser console) or hosting is serving a stale build.

## Tooling stack (recommended)

### Tier 0 — already in prosper2

| Tool | Status | Use |
|------|--------|-----|
| **threejs-devtools-mcp** | In `devDependencies`, documented in `WIRING_GUIDE.md` | 59 MCP tools: inspect scene, materials, shaders, move objects live |
| **cursor-ide-browser** | Cursor MCP | Screenshots, CDP `Runtime.evaluate`, automation |
| **Vite + React Refresh** | Running | Fast shader iteration |

#### Enable threejs-devtools-mcp in Cursor

Create `prosper2/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "threejs-devtools-mcp": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

Terminal 1: `npx threejs-devtools-mcp`  
Terminal 2: `cd frontend && npm run dev`  
Browser: open `/biosphere` or 3D Forge tab — MCP WebSocket attaches to the R3F canvas.

Example prompts: “List all meshes in the scene”, “Set emissiveIntensity on resonant rings to 3”, “Screenshot the canvas”.

### Tier 1 — install when tuning visuals (low risk)

| Package | Purpose |
|---------|---------|
| **leva** | Live sliders for `displacementScale`, bloom threshold, tube radius without rebuild |
| **@react-three/drei** `Perf` / `Stats` | FPS, draw calls, triangle count in dev |
| **r3f-perf** | Deep R3F performance charts |

Dev-only pattern in `BiosphereScene.jsx`:

```jsx
import { Perf } from 'r3f-perf'
// inside Canvas, if import.meta.env.DEV:
{import.meta.env.DEV && <Perf position="top-left" />}
```

### Tier 2 — browser / GPU debugging

| Tool | Purpose |
|------|---------|
| **Chrome DevTools → Performance** | Frame spikes when planting 6 nodes |
| **Spector.js** (Chrome extension) | Capture WebGL frames, see draw order / shader failures |
| **React DevTools** | Component tree, why Suspense stalls |
| **@vitejs/devtools** | Already optional in lockfile — Vite 8 pipeline inspect |

### Tier 3 — when shaders outgrow `shaderMaterial`

| Tool | When |
|------|------|
| **three-custom-shader-material (CSM)** | FBM in vertex shader *with* correct normals (terrain v2) |
| **React Three Fiber WebGPU renderer** | Commented path in `BiosphereScene.jsx` |
| **Blender + GLTF** | Hero structures if procedural hits ceiling |

## Visual acceptance ritual

1. `cd frontend && npm run dev`
2. Open `http://localhost:5173/biosphere` (no handshake on this route)
3. Confirm HUD: `$EMBER`, `$HEAT`, “Sovereign Biosphere”
4. Plant inner nodes **1–6** → Seed of Life banner, ≤ ~11 mycelium tubes, gold rims
5. Ground: subtle hills + shadows under outer towers
6. Wind towers: extruded leaf vanes, amber pulse when `heat > 3000` (default 2980)

## What agents should not do

- Rewrite `resonance.ts` for visuals
- Add Firestore client writes from the browser
- Connect all active nodes within distance 10 (spaghetti)
- Raise SSAO `luminanceInfluence` on dark emissive scenes without testing bloom

## Next prompts (copy-paste)

**Codex — terrain v2:** roughnessMap from same FBM; gate Metatron lines to active nodes only.

**Claude — light:** Leva panel for bloom/SSAO; optional remove SSAO entirely.

**Integration:** `BiosphereRoute.tsx` wrapper with `onSnapshot(three_forge/world_state)` → `forgeNodes`.

---

*This doc is the “mind” for biosphere work — pair it with live `threejs-devtools-mcp` when the canvas is running.*
