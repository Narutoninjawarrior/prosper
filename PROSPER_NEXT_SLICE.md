PROSPER NEXT SLICE — LEGACY FUNCTION CLEANUP

Workspace: D:\Hearth\prosper2

We now have:
- Shared `edgeGuard` payload caps and rate-limits across our public API.
- Fixed `treasuryIntent` from making uncontrolled read-writes.
- Locked `chemistry/execute` behind Firebase Auth.

Next goal:
Clean up and lock down the legacy function URLs exposed in `index.ts`. We cannot afford to leave unmetered or unauthenticated execution paths open.

Priority 1: Legacy Functions Pruning & Lockdown
Review `functions/src/index.ts` and the associated files for these exports:
- `claimBounty`
- `mcpDiscovery`
- `forge_execute`
- `claim_tile`
- `get_world_map`

Action Plan:
1. If any of these are truly obsolete (e.g., replaced by the new registry or mcpServer), remove them entirely.
2. If they are still required, wrap them in the `edgeGuard` payload/rate limiters, or put them behind `requireAuth` if they mutate state.
3. Clean up any loose imports and ensure `npm run build` passes.

Priority 2: Architecture for Scale (Bonus)
If time permits, write up a short paragraph in `RESEARCH_NOTES.md` on how we should implement App Check and configure function max instances to further harden this edge.

Capture the changes, make sure `npm test` and `npm run build` stay green in `functions`, and commit cleanly when done.
