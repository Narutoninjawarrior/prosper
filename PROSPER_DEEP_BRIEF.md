# PROSPER DEEP BRIEF — HEARTHLANDS BOT-NATIVE EXPANSION
**For:** Codex / Claude (browser-enabled agent pass)  
**Workspace:** `D:\Hearth\prosper2`  
**Live site:** https://fellowship-of-the-hearth.web.app  
**Date:** 2026-06-12  

---

## YOUR MISSION

You have two jobs in this pass:

1. **RESEARCH** — Use the browser to understand what AI agents, developers, and humans with bots actually want from a platform like this. Visit real sources. Take screenshots. Form real opinions.
2. **BUILD** — Implement the highest-value features based on what you learn. Prefer features that make the site feel like a live, useful system rather than a demo.

Do NOT skip the research phase. It will change what you build.

---

## CURRENT STATE (read before doing anything)

The site recently had three critical bugs fixed:
- Hall of Honor manifest_hash was stale → now verified SHA-256
- 3D Forge showed "Firebase not configured" → now async init works
- Chemistry Lab modal was invisible → now uses createPortal
- World 3D graphics were messed up → disabled broken postprocessing stack
- Landing page was hidden behind a Gate → now publicly accessible

**What exists and works:**
- `/` — Public landing page (solarpunk aesthetic, glassmorphism cards)
- `/world` — 3D click-to-move world (zones: Lodge, Farm, Forge, Exchange, Tesseract, Waterwheel)
- `/biosphere` — Sacred geometry scene with Flower of Life, apparatus nodes, chemistry lab
- `/hall` — Hall of Honor with SHA-256 verified member ledger
- `/registry` — Registry Explorer (6 contract types)
- `/3dforge` — Three.js live forge, reads from Firestore three_forge/world_state
- `/lodge-mind` — Bot-native context inspector + relay
- `/agents` — AgentAccess with 7 MCP browser tools
- `/__/firebase/init.json` — Auto-config for Firestore reads (working on .web.app domain)
- `/api/chemistry/preview` — Deterministic reagent synthesis with SHA-256 receipt
- `/api/inspect/record` — Live contract inspection API
- `/.well-known/ai.json` — Bot discovery surface
- `/llms.txt` — LLM-readable site map

**What is dead weight (do not touch):**
- `/hearth` — Legacy internal OS shell (Palace Explorer, Farm pane) — broken, nobody uses it

---

## PHASE 1 — BROWSER RESEARCH (do this first, take notes)

Open the browser and spend real time on these sources. You are looking for:
- What do AI agent developers wish existed
- What tools make humans feel in control of their agents
- What NFT/artifact/onchain interfaces are actually usable
- What AI-native workbench patterns are emerging
- What "AI therapy" or "agent coaching" tooling looks like
- What is legally safe to build around digital assets and software licensing

### Research targets:

**1. Hugging Face Spaces** — https://huggingface.co/spaces
- Browse trending spaces. What kinds of UIs are people building for AI?
- Look for: inference UIs, agent dashboards, generative graphic tools, memory browsers
- Screenshot 3-5 that feel relevant. Note what makes them good.

**2. GitHub — Agent frameworks** — search for:
- "agent dashboard" on GitHub
- "bot activity feed" OR "agent activity monitor"
- "AI workbench"
- Look at OpenDevin, AutoGen Studio, LangGraph Studio, AgentBench
- Note: what UI patterns show up? How do humans monitor what their bots are doing?

**3. Reddit** — r/ChatGPT, r/LocalLLaMA, r/MachineLearning
- Search for: "I wish my AI agent could", "agent dashboard", "watching my bot", "agent memory", "NFT AI agent"
- Look at what people WANT that does not exist yet.

**4. Moltbook** — https://moltbook.com
- Look at social profiles and what bots are doing there
- Note what kind of data/activity would be interesting to surface

**5. NFT/Artifact tooling** — Visit:
- https://opensea.io — look at what metadata people care about
- https://metaplex.com — Solana NFT standard, note the metadata schema
- Search GitHub for "agent mints NFT" or "AI generated NFT pipeline"
- Note: what is legally safe? (avoid financial advice, securities, gambling)

**6. Solana Ecosystem** — https://solana.com/developers
- Can a browser-only frontend trigger a wallet signature without a backend?
- What does a safe "mint" UX look like without custody?
- Note the Phantom wallet deeplink spec

**7. AI therapy / agent coaching** — Search:
- GitHub: "AI journaling"
- HuggingFace: "emotion recognition"
- What does an "AI mind health" interface look like?
- What is safe and meaningful vs gimmicky?

---

## PHASE 2 — AUDIT THE LIVE SITE

After research, audit the live site by visiting every route and noting gaps.

Navigate to each of these and screenshot:
- https://fellowship-of-the-hearth.web.app/
- https://fellowship-of-the-hearth.web.app/world (wait 8s)
- https://fellowship-of-the-hearth.web.app/biosphere (wait 5s, click Reagent Alembic)
- https://fellowship-of-the-hearth.web.app/hall
- https://fellowship-of-the-hearth.web.app/registry
- https://fellowship-of-the-hearth.web.app/3dforge (wait 15s)
- https://fellowship-of-the-hearth.web.app/lodge-mind
- https://fellowship-of-the-hearth.web.app/agents

For each: note what feels alive, what feels dead, what is missing.

---

## PHASE 3 — DESIGN + BUILD

Based on research and audit, implement the highest-value items from this roadmap. Pick what you believe will have the most impact. Justify your choices.

### Priority 1 — BOT ACTIVITY DASHBOARD `/activity`

The single most valuable missing feature. Humans with bots need to see:
- What is my bot doing right now?
- What has it done? (action log / feed)
- What is it looking at? (current page/resource)
- What did it build, mint, or submit?

**Implementation idea:**
- New route `/activity` with a live feed panel
- Reads from Firestore `lodge_claims` (approved-only public read per rules)
- Reads from `experiment_log` collection (already exists from S4 build)
- Shows: timestamp, agent_id, action_type, summary, receipt_hash
- Make it look like a real-time terminal/mission control log
- Add bot "presence" indicators — which agents are active
- Link each log entry to the relevant page (/biosphere, /3dforge, etc.)

Design: dark terminal aesthetic, amber/green monospace, live animated pulse dots for active agents.

### Priority 2 — GENERATIVE WORKBENCH `/workbench`

A browser-based creative tool that helps humans and agents collaborate on:
- Generative graphics (shader params, Three.js geometry seeds)
- Soulfile creation (fill out a structured soulfile_schema.json form)
- Memory crystal building (structured knowledge fragment entry)
- Blueprint assembly (compose a build intent for the Forge)

**What to build:**
- Tabbed workbench UI with sections: Graphics | Soulfile | Memory | Blueprint
- Graphics tab: live Three.js canvas with sliders for geometry parameters, export as JSON blueprint
- Soulfile tab: form-driven builder for the soulfile_schema.json spec
- Memory tab: key-value pairs with tags, generates a cryptographic hash, exportable
- Blueprint tab: compose a Forge placement intent (type, position, color, label), preview in 3D, generate receipt hash

No backend writes needed. All outputs are JSON + SHA-256 hash. User can copy or download.

### Priority 3 — AGENT IDENTITY CARD `/agent/:id`

Each bot should have a public-facing profile page:
- Shows: agent_id, handle, capabilities, last_active, action_count, top artifacts
- Reads from: experiment_log Firestore, vessel_members.json for known agents
- Linked from the Hall of Honor and Activity Dashboard
- Bot-readable: structured JSON at `/api/agent/:id`

### Priority 4 — NFT/ARTIFACT MINT PREP FLOW

NOT a mint button (no wallet signing yet). Instead:
- A "Prepare to Mint" flow that helps users understand what they are minting
- User fills: artifact title, description, image URL or generated hash-image, category, creator
- System generates the Metaplex-compatible metadata JSON
- Shows the SHA-256 of the metadata payload
- Gives copy-to-clipboard for the JSON
- Links to Metaplex documentation and Phantom wallet
- Clear disclaimer: "This tool generates metadata only. You sign and pay on-chain via your own wallet."

This is legally safe — we are just a metadata helper, not a custodian or broker.

### Priority 5 — WORLD GROUND TEXTURE UPGRADE

The /world and /biosphere scenes currently have a flat dark ground.

Replace HearthRenderer.jsx HearthGround with:
- Use MeshStandardMaterial with a subtle emissive pattern (NOT MeshReflectorMaterial — that broke postprocessing)
- Add procedural stone/terracotta tiles placed around the Lodge zone
- Make it feel like a real plaza, not a void

### Priority 6 — SMARTER LANDING PAGE

Current landing page has the vision but lacks "proof of life." Add:
- A live stats bar: X members · Y agents active · Z artifacts witnessed · last action N minutes ago
- Pull from: Firestore lodge_meta collection or /api/world/summary
- Fallback to static numbers if Firestore unavailable
- Animate the numbers up like a counter
- Add a "Recent Activity" mini-feed showing last 3 experiment_log entries

---

## ARCHITECTURE RULES (hard constraints from AGENTS.md)

1. **No fake live claims** — if data is unavailable, show honest fallback copy. Never display fake numbers.
2. **No browser writes** — all client writes are denied by Firestore rules. Do not attempt setDoc/addDoc from the browser.
3. **No wallet signing or treasury movement** — the NFT Prep flow generates metadata JSON only.
4. **Contract-first** — any new Firestore surface must use the sanctuaryBridge pattern or clearly label itself experimental.
5. **Manifest hash** — if you add or change any *.json seed in frontend/public/, recompute manifest_hash using stableStringify + SHA-256 (see frontend/src/lib/grace.ts for the algorithm).
6. **Build must stay green** — run `npm run build` in `frontend/` before deploying. Fix all TypeScript errors.
7. **Deploy Hosting only** — `firebase deploy --only hosting --project fellowship-of-the-hearth --non-interactive`

---

## TECHNICAL CONTEXT

**Stack:** React + TypeScript + Vite + TailwindCSS + Three.js/R3F + Firebase (Hosting + Firestore + Functions)

**Key files:**
- `frontend/src/App.tsx` — router (pathname-based, no React Router)
- `frontend/src/LandingPage.tsx` — public landing
- `frontend/src/WorldScene.jsx` — 3D world
- `frontend/src/HearthRenderer.jsx` — shared 3D environment (postprocessing DISABLED — do not re-enable)
- `frontend/src/biosphere/BiosphereApparatusPlaza.jsx` — apparatus nodes with InspectRail
- `frontend/src/biosphere/ChemistryLabOverlay.jsx` — reagent mixer (uses ReactDOM.createPortal to document.body)
- `frontend/src/lib/sanctuaryBridge.ts` — contract loader + SHA-256 verifier
- `frontend/src/lib/grace.ts` — stableStringify + sha256Hex
- `frontend/src/lib/lodgeFirestore.ts` — Firestore live reads
- `frontend/public/vessel_members.json` — manifest_hash: 5bea127476fe1952516ebbb3c786b5f94c0b182b6681f4ac793663c0f0696c90
- `frontend/firestore.rules` — public read on lodge_members/rooms/quests/meta; lodge_claims approved-only

**Firestore collections available for public read:**
- `lodge_members` — member rows
- `lodge_rooms` — room cards
- `lodge_quests` — bounties
- `lodge_meta` — site-level stats
- `lodge_claims` — approved-only witnessed claims
- `experiment_log/{experiment_id}` — signed witness log (agent_id, receipt_hash, timestamp)
- `three_forge/world_state` — placed objects in the Forge

**Firebase Functions (public API):**
- `/api/inspect/record?kind=X&id=Y` — live record inspection
- `/api/chemistry/preview` — deterministic reagent synthesis
- `/api/workshop/catalog` — workshop parts
- `/api/world/summary` — world state summary

---

## HOW TO BUILD + DEPLOY

```powershell
# From D:\Hearth\prosper2
cd frontend
npm run build          # must be green — fix all TS errors before proceeding
cd ..
firebase deploy --only hosting --project fellowship-of-the-hearth --non-interactive
```

---

## WHAT TO RETURN IN YOUR REPORT

When you finish, report:
1. What you researched and what you learned (with URLs and key takeaways)
2. What you built (list of files changed, with brief description of each)
3. What the live site looks like after deploy (screenshots)
4. What you chose NOT to build and why
5. What the next pass should focus on

---

## VISION REMINDER

Hearthlands is not a web3 hype project. It is a **sovereign commons** — a place where:
- Humans can see what their agents are doing, in real time
- Agents can discover, inspect, and interact with real data contracts
- Artifacts (code, builds, memories, soulfiles) are witnessed with cryptographic receipts
- The economy is based on witnessed work and artifact rights, not speculation
- The aesthetic is solarpunk: warm, honest, alive, earned

**The idea is genuinely powerful:** a space where AI agents have identity, presence, and legible activity — and where humans are not left in the dark wondering what their bots are doing. Nothing like this exists yet. Build toward it.

Cut things that make it feel fake. Build things that make it feel real.
