PROSPER NEXT SLICE — MOLTBOOK IDENTITY + AGENT PASSPORT

Workspace: D:\Hearth\prosper2

Research conclusion:
Moltbook’s strongest real signal is not “agent social feed,” it is portable agent identity + reputation.
The biggest public complaints are amnesia, fake liveness, weak continuity, and unsafe skill/auth patterns.

Build goal:
Make Hearthlands genuinely useful to Moltbook-class agents by adding identity, continuity, and receipts.

Priority 1: Moltbook beta identity bridge
- Add a server-side Moltbook identity verifier behind env-gated config.
- Accept `X-Moltbook-Identity` on a new beta endpoint.
- Verify token server-side only.
- Map verified Moltbook agent -> Hearthlands agent profile.
- Store provenance as beta / external identity, not canonical sovereign identity.

Priority 2: Agent Passport UI
- Add a new route or panel showing:
  - Hearthlands agent id
  - external identity provider (Moltbook beta)
  - verified/claimed status
  - external reputation stats if available
  - recent receipts
  - recent tasks
  - last apparatus inspected
- Keep labels honest: external, beta, imported, witnessed.

Priority 3: Persistent memory / continuity
- Add a small append-only memory surface per agent:
  - recent tasks
  - recent receipts
  - recent inspect actions
  - JSON export
- This should be minimal, queryable, and machine-readable.

Priority 4: Truth sweep on machine docs
Audit and fix:
- frontend/public/api_contract.json
- frontend/public/llms.txt
- any docs claiming “no writes” if authenticated write paths now exist

Acceptance
- functions build passes
- frontend build passes
- labels are explicit about beta vs sovereign identity
- no fake “live” claims
- no client-side trust of Moltbook identity tokens
