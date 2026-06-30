# CODEX HANDOFF: FINAL SYSTEM STATE FOR LONGVIEW GRANT

## CONTEXT
- The deadline for the Longview Applied Work Grant is July 10 (10 days away).
- The system is structurally locked and deployed to Firebase (Functions + Hosting).
- Claude has explicitly rejected all late-stage architectural refactors (including the Mycelial Braid DAG ledger, the emotensor daemon, Somatic Marker Hypothesis, and Homotopy Type Theory integration). These are firmly deferred to post-grant research.
- Your mandate: **DO NOT REFACTOR THE ARCHITECTURE.** The system works and is SCITT-aligned.

## CURRENT STATUS
- **Health Endpoint**: Currently reads `status: degraded` strictly because the `forge_chain_head` is missing. This is expected on a fresh database.
- **Resolution**: Malaky must run the provided browser fetch calls (Council Fire proposal creation + Seed Vault population) from the authenticated Lodge console. Once the first ledger write occurs, the chain head will initialize and health will flip to `ok`.
- **Dissent Staking**: Live and fully implemented in `policyEngine.ts`.
- **Lodge Steward**: Manually triggered via Cloud Scheduler. Automated cron is active.

## NEXT ACTIONS FOR CODEX
1. **Stand By**: Wait for Malaky to provide the raw console outputs from the browser scripts.
2. **Documentation**: Once provided, update `HEARTHLANDS_STATE.md` with the final `proposal_id` and conviction status.
3. **Focus on the Grant**: Assist Malaky with the Longview application text, the methods section of the paper, and any data exports. Maintain the Ponytail discipline: if it doesn't need to exist right now, do not build it.
