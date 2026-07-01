# Hearthlands Grant Proposal & Reviewer Run-Through

## The 300-Word Proposal (Locked)

**Infrastructure** for human-governed, AI-assisted coordination is broken. Current multi-agent systems optimize for un-grounded conversational text throughput, creating semantic decay and hidden execution costs. 

Open-ended multi-agent frameworks force humans into micromanagement or leave them entirely out of the loop. Software agents pass endless text strings across unmonitored APIs, creating autonomy theater with zero verifiable constraints.

Hearthlands introduces a serverless, local-first coordination OS that enforces strict, machine-readable data contracts over real-world building, agriculture, and robotics blueprints. Human operators and software agents read identical schemas through asymmetric interfaces: plain-language briefs for humans, JSON-LD manifests for machines. Every action is bounded by tiered capabilities (ALWAYS_DO, ASK_FIRST, NEVER_DO). Every decision is recorded in a local trace. Every plan is inspectable in 3D space before execution.

This architecture scales from a single garden loop to a network of cottage facilities, all governed by the same honest coordination layer. Human intent and machine execution are bound to an identical, auditable **provenance**.

---

## The 4-Minute Run-Through Script

**Minute 1: The Machine Gateway**
- Start at `/agent-access`
- Verify: Capability matrix shows 12 policies with tier badges (ALWAYS_DO, ASK_FIRST, NEVER_DO)
- Verify: Each policy expands to show description
- Verify: Truth boundary footer is visible

**Minute 2: The Handshake**
- Navigate to `/workbench?tab=biosystem`
- Verify: Biosystem Canvas loads with interactive loop and ambient vitality
- Click the reservoir node
- Verify: Dual-pane handshake expands (560px)
- Verify: Left pane shows capacity slider, right pane shows live JSON-LD
- Move the slider and verify both panes update simultaneously (VALID indicator pulses)
- Click 🚀 `[PROJECT BLUEPRINT TO SPATIAL MAP]`
- Verify: Routes to Forge with artifact selected

**Minute 3: The Spatial Map**
- Verify: Forge loads with biosystem artifact visible in 3D
- Verify: Artifact inspection sidecar shows plan data from canvas
- Verify: Decision Trace shows recent changes
- Verify: "Local planning artifact. Not a real biosystem." label is visible

**Minute 4: The Evidence**
- Navigate to `/proof-log`
- Verify: Event history shows the placement event
- Verify: Entry reads: "operator placed biosystem artifact from planner" (No "witness" or "verifiable" language)
- Navigate to `/commons`
- Verify: Artifact card appears with `## Recent Changes` header and sub-header: "Local draft edits. Not reviewed or approved."

## Go / No-Go Criteria
- [x] Dual-pane handshake updates in < 50ms
- [x] JSON-LD matches human brief exactly
- [x] Forge artifact shows correct plan data
- [x] Proof log has no "witness/verifiable" language
- [x] Commons export has truth boundary
- [x] Build passes in < 4.5s
- [x] No console errors

**STATUS: CODEBASE LOCKED.**
