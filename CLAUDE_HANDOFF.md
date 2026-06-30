PROSPER — REHYDRATE / MAP / SWEEP / THEN SHIP ONE PATCH

Workspace:
D:\Hearth\prosper2

Priority:
High
Goal:
Rebuild your exact mental model of the current Hearthlands frontend, especially the 3D/public routes, then execute one no-regret improvement from fresh repo truth instead of memory.

Important:
Do not answer from recollection alone.
Read the files first.
Assume your old chat context is incomplete or stale.
Treat this as a repo-grounded rehydration pass.

PHASE 1 — REHYDRATION READ
Read these files directly before making any recommendations:

Core routing / shell
- frontend/src/App.tsx
- frontend/src/PublicShell.tsx
- frontend/src/InternalAppShell.tsx if relevant

Public/front-door surfaces
- frontend/src/LandingPage.tsx
- frontend/src/ReviewPage.tsx
- frontend/src/RouteHealthPage.tsx
- frontend/src/ProofLogPage.tsx
- frontend/src/components/BotCapabilityCatalog.tsx
- frontend/src/ForgePage.tsx

3D / world surfaces
- frontend/src/ThreeForge.tsx
- frontend/src/WorldRoute.tsx
- frontend/src/WorldScene.jsx
- frontend/src/world/WorldActionSheet.jsx
- frontend/src/world/ParametricArtifactRenderer.tsx
- frontend/src/lib/worldArtifactContract.ts
- frontend/src/lib/worldArtifactSeeds.ts

If additional files are clearly required to explain current behavior, include them.

PHASE 2 — CURRENT FRONTEND MAP
After reading, deliver a concrete map in this exact structure:

1. Route Map
For each route:
- /
- /review
- /route-health
- /proof-log
- /entitlements
- /forge
- /3dforge
- /world
- /commons

List:
- primary component
- shell wrapper
- whether audio/overlay systems are active
- whether the route reads as calmer/newer or older/legacy
- the 1–2 files that actually control its visible behavior

2. 3D Ownership Map
Explain exactly where these behaviors live in JavaScript/TS:
- artifact rendering
- artifact inspection
- placement preview
- grid snapping
- rotation controls
- validity states
- overlay panels
- audio/telemetry blocks
- local placement state
- query-param deep linking

3. Legacy vs Current Split
Name which parts of /world and /3dforge appear to come from older prosperity-era / ambient-world logic vs the newer governed artifact/planning layer.
Be specific.

4. Stale or Contradictory Live Signals
Name any routes where:
- live copy still contradicts recent truth sweeps
- visual hierarchy still feels old
- one route implies a different thesis than another
- the code likely explains why deploy parity drift happened

PHASE 3 — CHOOSE ONE NO-REGRET PATCH
After the map, choose exactly one patch that is:
- small
- high leverage
- safe regardless of whether Malaky later chooses Option 1 or Option 2
- grounded in the code you just read

Strong candidates include:
- calming /world or /3dforge further
- fixing stale copy still visible on live public routes
- improving route hierarchy where overlays still dominate
- tightening one confusing title / label / card that still reads old

Do not choose a broad thesis rewrite.
Do not choose a new subsystem.

PHASE 4 — SHIP IT
Implement the chosen patch.
Then run:
- cd frontend && npm run build

DELIVER BACK
In this exact structure:

A. Files read
B. Route map summary
C. 3D ownership summary
D. Legacy/current split summary
E. Chosen patch and why
F. Exact files touched
G. Build result
H. One sentence on what now feels more coherent

Guardrails:
- no strategy by accident
- no deciding the full public thesis
- no giant feature branch
- no vague recommendations from memory
- read first, map second, patch third
