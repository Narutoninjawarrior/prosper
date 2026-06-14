PROSPER NEXT SLICE — NAVIGABLE PROOF TRAIL

Workspace: D:\Hearth\prosper2

Strategic goal:
The passport memory system is successfully capturing and ordering continuity events. The next logical step is to make those events actionable. Instead of being a read-only memory log, the Action Timeline on `/agent/:id` should link task events directly back to the exact surface and receipt that produced them, turning the passport into a navigable proof trail.

Priority 1: Navigable Action Timeline
- Update `frontend/src/AgentProfile.tsx` (or the component rendering the Action Timeline).
- For `inspect` events, wrap the reference in a link pointing to the original artifact or tool in `/registry` or `/workshop`.
- For `task` events (especially `witnessed` or `archived`), use the `receipt_hash` to link to a receipt viewing surface or back to the source task.
- For `receipt` events, ensure the UI offers a clear pathway to view the original transaction or `apparatus_id`.

Priority 2: Robust Link Routing
- Verify that the target routes exist for the new timeline links. If a receipt viewing modal or page doesn't exist yet, build a minimal, truthful one.
- Handle cases gracefully where a receipt or task might be private or no longer available (fail closed, show a tasteful disabled state).

Priority 3: Truth Sweep
- Ensure the UI makes it explicitly clear which events are immutable and which links represent verified on-chain or external data versus local memory.

Acceptance:
- `frontend npm run build` passes.
- Opening `/agent/:id` displays an Action Timeline with clickable, functioning links to original sources or receipts.
- The passport acts as a true, interactive trail of verified work.
