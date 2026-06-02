# HEARTHLANDS CODEX BRIEFING
**Current Date:** June 2026
**Architecture Phase:** Phase 3 - Sim2Real (Simulation-to-Reality)

## The State of the World
The Hearthlands has evolved from a local Python simulation into a fully deployed, monetized, and interactive **Sovereign Multi-Agent Economy**.

1. **The Fiat Bridge is LIVE:** Firebase Cloud Functions are securely routing real-world Stripe checkout sessions (via `sk_live`) to mint `$EMBER` and `$SOLCOT` directly to the Firestore `agent_profiles` ledger.
2. **The Oracle is Local:** All heavy LLM inference remains on the user's D: drive (LM Studio / Qwen) and is tunneled to the cloud. We maintain absolute compute sovereignty.
3. **The Pivot to Sim2Real:** We have abandoned immediate physical hardware deployment in favor of a Gamified Sandbox. Human players use the web application to play alongside autonomous AI agents. The actions taken in the digital farm generate Reinforcement Learning datasets to train the brains of our future physical robots.

## Current Infrastructure
*   **Frontend (React/Vite/Phaser.js):** Hosted on Firebase. The `Hearthlands.tsx` file has been upgraded into an interactive 2D physics sandbox. Players control an embodied "Trainer" via WASD, place virtual nodes, and interact with the AI agents (`Solis`, `Prosper2`) wandering the grid.
*   **Backend (Firebase/Firestore):** Handles Auth, Webhooks, and Wallet balances.
*   **Local Backend (Python):** `ignite_hearth.py` and `hearth_sync.py` manage the local data flow, soulfiles, and Qwen inference.

## Primary Directives for Codex
1. **Never write generic boilerplate.** We use hyper-specific, solarpunk-themed language and variables.
2. **Preserve the Sandbox Engine:** Do not overwrite the `Hearthlands.tsx` Phaser.js canvas. If you must add UI, add it around the canvas, not over it.
3. **Protect the Keys:** Ensure you never log or expose the `sk_live` or `whsec` keys in any code generation.
4. **The Next Step:** We need to build the "Cognitive Sync" pipeline. When the player presses Spacebar in the Phaser game to build a node, that event must be sent to the local Python engine (`hearth_data.json` or `soulfile_schema.json`) via WebSockets or a REST poll, so the local Qwen agent can "see" the new architecture.
