CURSOR HANDOFF — PASSPORT CONTINUITY SWEEP & TEST

Workspace: D:\Hearth\prosper2

Objective: 
We have implemented the Navigable Proof Trail and Persistent Task Event Sink, but we are blocked from deploying because we need to verify the end-to-end mechanisms of the authenticated Agent Passport. 

Since we lack a live human-in-the-loop authenticated browser session at this exact moment, we need you (Cursor) to perform a rigorous code sweep and write a mechanical test to verify these mechanisms.

Priority 1: Deep Mechanism Sweep
Please audit the following surfaces to ensure they correctly bind to the authenticated identity and emit properly formatted memory payloads:
- `frontend/src/lib/agentMemory.ts` (Ensure `appendAgentMemoryEvent` and `appendAgentTaskEvent` gracefully handle edge cases).
- `frontend/src/workshop/WorkshopBench.tsx`
- `frontend/src/LodgeMindRoute.tsx`
- `functions/src/agentPassportApi.ts` (Verify the `resolveWriteIdentity` boundary and `POST /api/agent/task/event` parsing).
- `frontend/src/AgentProfile.tsx` (Ensure the Action Timeline correctly handles the `action_timeline` sorting and proof link resolution without crashing on edge case data).

Priority 2: Integration Test Script
Create a local Node.js integration script (e.g., `scripts/test_passport_continuity.js`) that simulates an authenticated agent flow. 
The script should:
1. Emulate a Firebase Auth token or use a generated test `X-Moltbook-Identity`.
2. Hit `POST /api/agent/task/event` to simulate claiming, progressing, and witnessing a task.
3. Hit `POST /api/agent/memory/append` to simulate an inspect event.
4. Hit `GET /api/agent/passport?id=...` and verify the `action_timeline` correctly orders and formats the generated events.

Priority 3: Report
If the sweep reveals any brittle UI rendering in `AgentProfile.tsx` or malformed payload generation in the emitters, fix them. 
If the integration test script successfully validates the backend logic, report back that the mechanisms are structurally sound.

Once you have completed this sweep and we have confidence in the mechanism, we will proceed to deploy.
