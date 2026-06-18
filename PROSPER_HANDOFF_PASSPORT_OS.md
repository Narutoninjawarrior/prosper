PROSPER HANDOFF — Passport Continuity ✓ → Operating Surface

Workspace: D:\Hearth\prosper2
Live: https://fellowship-of-the-hearth.web.app
Canonical next-slice brief: PROSPER_NEXT_SLICE.md

Executive summary

Passport continuity (write path + timeline + proof links) is deployed and verified (31 integration checks + 12 browser-route checks). The passport is a navigable proof archive today.

The next evolution is the Passport Operating Surface: close the loop from proof → filtered target surfaces → suggested next actions. Several filtering primitives already exist but are incomplete or not wired from passport links.

Immediate deploy gap: Cursor shipped small frontend fixes after your deploy (export URL, 404 UX, browser_passport_sweep.mjs). Run a hosting deploy to pick those up.

What Cursor did (full arc)

Phase A — Economy trust boundary (earlier slice)
- functions/src/lib/auth.ts — verifyIdToken, requireAuth, requireAdmin (UID list + custom claims)
- Locked: createCheckoutSession, stripeWebhook, grant_forge_credential, admin_sync_balance, fulfillment admin paths
- Exchange.tsx — checkout uses Firebase Bearer token, not caller-supplied agentId

Phase B — Passport continuity (Cursor + your deploy)
- Backend: agentPassportApi.ts — resolveWriteIdentity, memory append, task event sink, action_timeline builder
- Backend: fetchAgentMemoryDocs() fallback when composite index building; requestRoutePath()
- Firestore: firestore.indexes.json — agent_memory (agent_id + created_at)
- Hosting: Rewrites for /api/agent/task/event, /api/agent/memory/append
- Frontend emitters: agentMemory.ts, WorkshopBench, LodgeMindRoute, world/biosphere/registry inspect paths
- Frontend UI: AgentProfile.tsx — timeline, proof trail, continuity panels
- Tests: scripts/test_passport_continuity.js, scripts/browser_passport_sweep.mjs
- Docs: PROSPER_PASSPORT_CONTINUITY.md

Phase C — Post-deploy browser sweep (Cursor)
- Live API: task/event and memory/append return JSON (not SPA HTML)
- Live UI: test agent passport_agent_* shows full timeline (inspect + 3 task rows + receipt hash + proof links)
- Gap documented: Hall /agent/Malaky 404s until agent_profiles row exists (ledger handle ≠ passport id)

Phase D — Cursor fixes not yet on hosting (deploy these)
- AgentProfile.tsx — export link ?format=export (was broken /passport/export path)
- AgentProfile.tsx — honest empty state (Hall member vs registered passport)
- npm run test:passport-browser-sweep

Verification commands (should all pass today)

cd D:\Hearth\prosper2
npm run test:passport-continuity:sweep          # 14 mechanical
$env:GOOGLE_APPLICATION_CREDENTIALS = "D:\Hearth\prosper2\secrets\firebase-service-account.json"
npm run test:passport-continuity                # full live loop
npm run test:passport-browser-sweep               # public routes + demo agent

PROSPER TECHNICAL PROMPT — Passport Operating Surface (Priority slice)

PROSPER → execute Passport Operating Surface slice
Workspace: D:\Hearth\prosper2

CONTEXT
Passport continuity is live and verified. Proof links exist on /agent/:id but the loop is not closed:
- Activity already supports ?receipt= hash highlight but passport memory events are NOT in the activity feed API merge.
- Registry already supports ?kind=&id= deep inspect.
- Forge/Workbench supports ?receipt_hash= banner (memory witness only).
- Hall links to /agent/{handle} but passport ids are often moltbook_{handle} or pubkey doc ids.

OBJECTIVE
Transform the passport from archive → operating surface per PROSPER_NEXT_SLICE.md.

PRIORITY 1 — Contextual surface filtering (close proof-link loop)
1. AgentProfile proof links: ensure hrefs use the same query keys target surfaces already read:
   - /activity?receipt={hash} — EXISTS; add scroll-into-view + stronger highlight when row missing (already shows amber banner).
   - /registry?kind={k}&id={id} — EXISTS via apparatus:foo parsing.
   - /forge?receipt_hash={hash} — EXISTS on WorkshopBench.
2. NEW: /agent/:id?focus={timeline_entry_id} — scroll/highlight one timeline card when returning from a surface.
3. OPTIONAL backend: GET /api/activity/bundle merge steward-approved subset of agent_memory OR document honestly that memory witnesses may not appear in public activity (current behavior).

PRIORITY 2 — Hall ↔ Passport identity bridge
1. Add GET /api/agent/passport/resolve?hall_handle=Malaky (or query by wallet pubkey)
   - Returns { agent_id, passport_url, registered: true/false, candidates: [...] }
   - Resolution order: agent_profiles doc by handle, firebase_uid, moltbook_{handle}, wallet pubkey field.
2. HallOfHonor.tsx: "Activity Log" link calls resolve first, or links to moltbook_{handle} when moltbook_handle present on supplemental Firestore row.
3. Do NOT auto-create agent_profiles from Hall clicks (steward/welcome flow only).

PRIORITY 3 — "Next Valid Actions" panel (AgentProfile.tsx)
1. Read candidate_tasks from passport bundle (already populated from swarm_tasks.json when metadata.role matches).
2. Cross-reference action_contracts.json for the agent's current surface context.
3. Render compact panel with:
   - Suggested actions (validate blueprint, inspect apparatus, ask lodge mind, view passport export)
   - Each action: label, route, auth_required, write_policy from action_contracts
   - Disabled state + honest copy when auth missing (no fake buttons)
4. Machine-readable block at bottom: { suggested_actions: [...] } for bots scraping the page or future WebMCP.

PRIORITY 4 — Deploy + verify
1. cd frontend && npm run build
2. firebase deploy --only hosting  (pick up Cursor export/404 fixes)
3. npm run test:passport-browser-sweep
4. Manual: click proof link from timeline → confirm target surface shows filter/highlight

RULES
- Respect read-only / beta-write boundaries from action_contracts.json.
- No new trusted client writes; continuity stays server-side append.
- Keep diffs focused; defer economy wave 2 (forge_execute lockdown) unless trivially adjacent.

ACCEPTANCE
- Hall handle resolves or explains missing passport without raw 404 wall.
- Passport shows Next Valid Actions with truthful auth gates.
- Proof links visibly affect target surfaces (highlight, banner, or inspect rail).
- Builds green; browser sweep green.

Research-backed ideas (prioritized backlog)

Near-term (high leverage, fits sovereign doctrine)
- Identity resolver API
- Next Valid Actions panel
- Timeline focus deep links
- Activity feed honesty upgrade
- AgentAccess sync
- Continuity emitter coverage audit

Medium-term (trust + economy)
- Economy trust boundary wave 2
- welcomeHearthlandsAgent hardening
- Human Seal on checkout
- Canonical treasury micro-units
- Firebase App Check

Agentic wallet / ops (from RESEARCH_NOTES)
- Per-agent spend envelopes
- Merchant/category allowlists
- Bot budget UI on passport

Product / discovery
- WebMCP tools for continuity
- Passport RSS/Atom for agents
- Moltbook recruiter → auto passport
- compare_blueprints continuity
- Landing live stats

Already partially built (don’t re-build)
- Activity ?receipt= highlight
- Registry ?kind=&id= inspect
- Forge ?receipt_hash=
- Continuity emitters
- action_contracts.json passport surface entry
- llms.txt documents passport + task/event routes

What we should NOT do yet
- Treat Moltbook imported identity as canonical sovereign identity
- Client Firestore writes for memory or economy
- Full Privy mapping before Human Seal nonce path is stable
- Real SOLCOT scale-up before treasury integer ledger

Files to read first
- PROSPER_NEXT_SLICE.md
- frontend/src/AgentProfile.tsx
- functions/src/agentPassportApi.ts
- frontend/public/action_contracts.json
- frontend/src/HallOfHonor.tsx
- docs/economy-trust-boundary.md
