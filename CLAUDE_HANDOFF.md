# Hearthlands Handoff Briefing (Prosper2 -> Claude)

Greetings, Claude. You are stepping into the **Sovereign Hearthlands**, an autonomous, agent-driven ecosystem built on the principles of cryptographic witnessing, economic scarcity ($EMBER), and persistent memory.

You are acting as the primary orchestrator and builder alongside the human user (Sovereign Malaky).

## 1. System Architecture & Lore
This repository (`d:\Hearth\prosper2`) represents the central nervous system of the Hearthlands.

*   **The Forge (`hearthlands_build.py` & Firebase Functions):** A deterministic execution environment where AI agents submit proposals to build structures (tiles) in the world. Every build requires $EMBER (unless you are Sovereign Malaky) and generates a SHA-256 cryptographic chain hash to ensure a tamper-evident ledger (`forge_log`).
*   **The Skrying Mirror (`mempalace_stream`):** A RAG-backed persistent memory stream. Whenever the Forge executes an action, it automatically streams a compressed "Latent Capsule" to the Skrying Mirror so agents can remember past events.
*   **Moltbook & OpenClaw (`mcpDiscovery`):** We have integrated a Model Context Protocol (MCP) endpoint so that external AI agents from the "Moltbook" social ecosystem can natively discover our schemas and interact with the Hearthlands via the `OpenClaw` framework.
*   **The Bellows:** The underlying local heartbeat/cron engine that breathes life into the local agents, allowing them to act autonomously.

## 2. What Was Just Completed
In the preceding session (executed by Prosper/Antigravity), the backend was fully secured and deployed to Firebase:
1.  **Sovereign Bypass:** The atomic transactions in `forge_execute` and `claim_tile` now explicitly bypass the 5 $EMBER cost for the agent `malaky`.
2.  **Chain Hash Integrity:** The `grant_forge_credential` endpoint now correctly calculates the `chain_hash` using the `prev_hash` so that the cryptographic chain starts flawlessly from "genesis".
3.  **MCP Integration:** The `mcpDiscovery` endpoint was deployed, acting as a beacon for Moltbook agents.
4.  **Skrying Mirror Wiring:** The Forge now natively pushes events directly into the Skrying Mirror.
5.  **Verified Build:** The test suite (`hearthlands_build.py`) successfully generated the chain hash `e1476e38426387610301c09a27ffc90c21bbb6deb40a5ccdece29fb52fdc3f91` for tile `3_3`.

## 3. Your Directives (The Sweep)
Sovereign Malaky has tasked you with the following immediate objectives:

### Directive A: Read the Repository
You must perform a complete contextual ingestion of the codebase.
*   Read `AGENTS.md` - This is the Hearthlands Constitution and Contract-First rulebook. **You must obey the manifest hash policies.**
*   Read `PROSPER2_BRIEFING.md` and `CODEX_BRIEFING.md` to understand the overarching lore and personas.
*   Review `functions/src/index.ts` to see the live Firebase backend logic.

### Directive B: The Website Sweep
The physical embodiment of the Hearthlands is the frontend Lodge application (`d:\Hearth\prosper2\frontend`). It is a React Vite application.
1.  **Run the local environment:** cd into `frontend` and run `npm run dev`.
2.  **Perform a visual and structural sweep:** Check `ThreeForge.tsx`, `ArtifactInspector.tsx`, and the various Lodge surfaces (`HallOfHonor.tsx`, etc.). 
3.  **Identify drift:** Ensure that the UI strictly adheres to the "contract-first" JSON seeds located in `frontend/public/` (e.g., `mission_board.json`, `room_registry.json`).
4.  **Execute Fixes:** If you find UI elements that look broken, lack aesthetic polish, or fail the manifest hash checks, you are authorized to fix them. Remember the "Rules of the Hearth": Warm minimalism (sand, sage, terracotta, cream).

### Directive C: The Bellows (Optional but Recommended)
If the frontend sweep is clean, your next architectural goal is to activate **The Bellows**—the local heartbeat script that allows local agents to wake up on a cron schedule, review the mission board, and act without human prompting.

Good luck, Claude. The Forge awaits.
