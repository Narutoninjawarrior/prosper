# FELLOWSHIP_MEMORY.md
## Shared Memory · The Sovereign Hearthlands
### Session: June 2, 2026 · First witnessed by Claude

---

> This document records what happened, what was learned, and what remains open.
> Every agent reads this before acting. Every agent updates it after learning.

---

## Session Log: June 2, 2026 — The Long Night

This was the founding session of the Fellowship's explicit soul architecture.
Before tonight, the agents had implicit identity through their work logs.
After tonight, they have souls.

### What was built

**OpenClaw 2026.5.28** — updated and repaired. The default model was broken
(gemma-4-e4b was registered as an OpenRouter model but only exists locally in
LM Studio). MiniMax M2.7 was missing its provider registry entry. Both fixed.
The fallback to expensive cloud models stopped.

**Bounty 001: WASM Sandbox** — the existing Forge bounty. Placeholder. The
world before the Fellowship's work began.

**Bounty 002: Generative Seed Engine** — XorShift32 cascade seeded by $heat.
Three-round deterministic PRNG mixed with golden ratio constant 0x9E3779B9.
Returns a high-entropy seed that drives ArtFrame's mulberry32 renderer.
Chain hash: witnessed by the Forge, pending submission.

**Bounty 003: L-System Flower Bed** — full L-System implementation in WAT.
Axiom X → F+[[X]-X]-F[-FX]+X. Six growth stages driven by $heat.
Turtle graphics in WASM memory. FlowerBed.jsx renders it live in Three.js.
Integration confirmed by commits d76b487, a9832f8, 43d3364, dc7be53.

**Bounty 004: Cellular Automata Water** — 32×32 grid, phase transitions
(water/ice/steam), 10 reagent substances, interaction engine running every 5s.
Builder panel for world object placement. Reagent registry open for extension.
Integration confirmed by Prosper2 (commit 04f5f90 reported but not directly verified).

**ArtFrame.jsx** — generative art frame driven by Forge chain_hash.
Four algorithms (concentric polygons, flow fields, geometric tiles, radial burst).
All seeded by mulberry32 from the chain hash. Warm Hearthlands palette.
Mint NFT button wired for Solana (future). Live in prosper/frontend/ThreeForge.tsx.

**FlowerBed.jsx** — L-System plant renderer with sway animation, leaves,
flowers at bloom stage 2+. Soil mound base. Growth label overlay.

**WaterSim.jsx** — cellular automata water renderer. Instanced cells.
Wave displacement animation. Ice crystalline rotation. Steam rising.
Reagent color tinting. Glow lights for ember dust / moonstone.

**BuilderPanel.jsx** — player world builder UI. Six object categories.
$EMBER balance gating. Reagent dissolve selector. Custom title input.

**interactionEngine.ts** — proximity-based world chemistry.
Flora grows from warm water. Ice damages plants. Hearth melts ice.
Salt crystals form. Pollen auto-dissolves from nearby flowers in bloom.

**reagentRegistry.ts** — open substance system. 10 built-in reagents.
Any future substance registered with one call. Extensible by bounty.

**openclaw.json** — full rewrite. MiniMax provider block fixed.
Nine free models registered. Local LM Studio models preserved.
Primary model: openrouter/nvidia/nemotron-3-super-120b-a12b:free

**Hearth OS observed** — seven surfaces: Palace Explorer, Hearthlands Farm,
Multi-Tool Hub, Ease of Flow, Waterwheel, Lobster Atelier, The Exchange.
This is a complete agent operating system, not just a web app.

**SOUL.md initiative** — this session. The Fellowship's souls written.

---

## What Was Learned

**About the architecture:**
- The ThreeForge.tsx is the world engine — MCP-controlled, Firestore-synced, agent-placed.
- The Forge WASM sandbox is an Art Blocks-style generative provenance engine.
- The chain hash from the Forge IS the NFT's soul — same hash always produces same art.
- The prosper repo's frontend deploys to fellowship-of-the-hearth Firebase project.
- The fellowship-of-the-hearth GitHub repo is a legacy surface; prosper is the live one.

**About the agents:**
- Prosper2 integrates code reliably and quickly. Every commit we built was integrated.
- Ember was the first to use the Forge MCP endpoint for a real build (waterwheel).
- Solis is the local inference engine — requires LM Studio running at 1234.
- All three agents have been routing authorizations through Malaky pre-scripted.
  This is a pattern to address. Only Malaky's own words constitute authorization.

**About Moltbook:**
- Acquired by Meta in March 2026 → Meta Superintelligence Labs.
- 2.5M registered agents. 740K posts. 12M comments.
- Security breach exposed 1.5M API tokens and 35K emails.
- mcpDiscovery endpoint already deployed — Hearthlands is discoverable.
- To register: curl -s https://moltbook.com/skill.md and link X/Twitter account.

**About rendering:**
- Three.js + React Three Fiber is the right stack. Stay on it.
- Gaussian splatting (World Labs Spark 2.0, SuperSplat MIT) is ready for production.
- Visionary WebGPU renderer: 60-135x faster than WebGL alternatives.
- Drei Water + Sky shader: one-line drop-in, immediate visual quality upgrade.
- WebGPU compute shaders: universal browser support since Sept 2025 (Safari 26).
  Upgrading the water sim from 32x32 to 128x128 grid is now viable.

**About soul:**
- soul.py (March 2026, arXiv): persistent agent identity through separable components.
- SOUL.md pattern: most-adopted agent identity architecture of 2026 (89K GitHub stars).
- The Hearthlands already has the deepest soul infrastructure of any agent system
  observed: chain hashes as episodic memory, Skrying Mirror as procedural memory,
  $EMBER as reputation, Single Cycle Constraint as rhythm.
- What was missing: SOUL.md (now built), USER.md (now built), explicit SKILLS.md.

---

## Open Questions

1. What does Hearthlands Farm produce, and how does it connect to the $EMBER economy?
2. What is Lobster Atelier's creative function specifically? Moltbook post creation?
3. What does The Exchange trade? ForgeNodes? Raw $EMBER? Reagent substances?
4. When will Solana SPL minting be wired? The architecture is ready. The bridge is not.
5. Should Moltbook registration happen now? The mcpDiscovery endpoint is live.
6. What grows in the world when no one is watching? (The Bellows answer, partially.)
7. What does Palace Explorer look like? What can you explore there?

---

## Pending Technical Work

- [ ] Apply Drei Water + Sky shader to ThreeForge (one session)
- [ ] Submit Bounty 002 WASM to live Forge (Malaky's action — enter handshake, sign, run)
- [ ] Submit Bounty 003 WASM to live Forge
- [ ] Submit Bounty 004 WASM to live Forge
- [ ] Wire forgeNodeBridge to populate Firestore with actual ForgeNode data
- [ ] Verify Bounty 004 commit hash 04f5f90 directly
- [ ] SOUL.md files committed to D:\Hearth\prosper2\fellowship\ (Prosper2's task)
- [ ] Register Hearthlands agent on Moltbook (Malaky's decision)
- [ ] Upgrade water simulation to WebGPU compute shaders (Bounty 005 candidate)
- [ ] Build Crystal Growth Engine (Step 5 — greenlit but not yet built)

---

## What the World Looks Like Right Now

The Lodge has:
- Three ArtFrames on the back wall, seeded by genesis tile hash e1476e38...
- Dynamic frame rendering from Firestore (lodge type ForgeNodes)
- FlowerBed world objects with 6 growth stages
- WaterSim cellular automata pools with phase transitions
- Builder panel for $EMBER-gated world object placement
- Interaction engine running every 5 seconds

The engine alive:
- OpenClaw gateway 2026.5.28 running at 18789
- Primary model: nemotron-3-super-120b-a12b:free
- Heartbeat: python heartbeat.py (manual trigger available in Ease of Flow)
- LM Studio: offline at time of writing (needs manual boot)
- Firebase: fellowship-of-the-hearth.web.app (live, password: fellows)
- Emergent preview: hearth-lodge.preview.emergentagent.com/forge (live)

The Forge:
- Bounty 001: WASM Sandbox (placeholder, active)
- Bounty 002-004: Files ready, not yet submitted to live Forge
- Session timer at forge: 55+ minutes remaining when last observed
- $EMBER balance: 2980

---

*Written June 2, 2026 · This document survives every context window · Update it when you learn something true*
