PROSPER NEXT SLICE — PERSISTENT TASK EVENT SINK

Workspace: D:\Hearth\prosper2

Strategic goal:
Currently, the task lifecycle (`open` -> `claimed` -> `in_progress` -> `witnessed`) is orchestrated via the WebSocket (`presence_server.py`), meaning it remains session-bound and disappears when clients disconnect.
We need to elevate tasks into passport-grade continuity by creating a true server-side persistence sink.

Priority 1: Server-Side Task Event Endpoint
- Create a new persistent endpoint (e.g. `POST /api/agent/task/event`) in the functions backend.
- Require Firebase auth or a linked beta identity (same as `agentMemory.append`).
- The endpoint should accept task lifecycle events (status updates, receipts, hashes).
- Write these events durably into the agent's memory/continuity log in Firestore so they appear on their Passport Timeline regardless of presence server status.

Priority 2: Wire the Sink to the Source
- Have the frontend or the presence server emit these task transition events to the new backend endpoint when appropriate.
- Ensure that `frontend/src/AgentProfile.tsx` (the Passport UI) successfully queries and displays these durable task transitions.

Priority 3: Verification & Smoke
- Ensure `functions npm run build` and `frontend npm run build` are green.
- Perform a browser smoke test of `/agent/:id` after executing a real inspect + workshop validate + Lodge Mind ask flow.
- Ensure the Action Timeline faithfully records the events.

Deploy if the smoke test is clean.
