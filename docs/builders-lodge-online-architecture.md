# Builders Lodge Online Architecture

## Mission
To transition the Hearthlands from a local-only simulation into a 24/7 public online world. The Lodge Mind (the Gemma/Qwen agent) must reside in the cloud, consume the real-time context of the civilization, and make autonomous decisions on the same public infrastructure as human stewards.

## Google Cloud / Firebase Allocation

### 1. Firebase Hosting (The Public Shell)
**Role:** The fast, edge-cached delivery layer for the visual world and user interface.
**Hosted Routes:**
- `/` (Public Landing & Recruitment)
- `/world` (The 2D World Map)
- `/biosphere` (The 3D Scene)
- `/hall` (Hall of Honor)
- `/treasury`, `/solcot` (Commerce & Patronage)
- `/forge`, `/3dforge` (Builder Tools)

### 2. Firestore (The Living Ledger)
**Role:** The real-time supplemental state that clients read and Cloud Functions write to.
**Collections:**
- `world_state`: The canonical spatial map (`three_forge` nodes).
- `build_intents`: Pending proposals from the Forge.
- `artifact_registry`: The recognized outputs of the economy.
- `identity_state` & `orders`: Commerce and human seals.

### 3. Cloud Functions (The Engine)
**Role:** Deterministic, event-driven validation and fulfillment.
**Responsibilities:**
- Auth / Seal verification.
- Order integrity (checkout fulfillment).
- Scheduled sweeps (Bellows ticks in the cloud).
- Artifact mint triggers.
- Writing to Firestore after validating agent or human intents.

### 4. Cloud Run (The Lodge Mind)
**Role:** The always-on Gemma or Qwen cognitive engine.
**Responsibilities:**
- Runs a persistent process with GPU acceleration via Google Cloud Run.
- Subscribes to Firestore updates or receives webhooks from Cloud Functions.
- Consumes the full context: Hall members, active bounties, current world state, treasury pulse, and recent witnessed activity.
- Exerts agency by invoking Cloud Functions to mutate the world (e.g., placing nodes, spending `$EMBER`).

## The AI Mind Strategy: RAG First, LoRA Later

**Why RAG / Tools First:**
A static fine-tune immediately becomes outdated as the community evolves. By using a RAG (Retrieval-Augmented Generation) memory layer and tool-calling, the Gemma agent can dynamically inject the *current* `world_state` and `mission_board` into its context window. It "feels the Lodge" without needing to retrain its weights every time a human steward approves a new recruit.

**Future Fine-Tuning:**
Once the cultural tone, doctrine, and behavioral patterns of the Lodge are well-established through thousands of logs, we can train a LoRA for Gemma/Qwen purely for *style and doctrine adherence*, not for real-time truth.

## Path to 24/7 Operations
1. Build the Gemma Cloud Run service container.
2. Grant it a Service Account identity to securely hit internal Cloud Functions.
3. Wire the Bellows tick (cron) to wake the agent, pass the Firestore state, and request a decision.
