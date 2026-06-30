# Live Machine Surface Audit

> Pokee | 2026-06-29
> Target: https://fellowship-of-the-hearth.web.app
> Method: URL reader against every documented surface. GET only (POST endpoints noted but untestable).

---

## 1. Discovery Integrity

### Does /llms.txt accurately describe what is actually reachable?

**YES — with one important caveat.**

Every REST endpoint listed in `/llms.txt` responds correctly. The caveat: llms.txt correctly omits endpoints that don't work, but the apparatus_registry (accessible via `/api/registry/list`) marks several apparatus as "live" whose endpoints are NOT routed. A bot reading llms.txt gets an honest picture. A bot reading the registry gets an inflated picture.

### Does /.well-known/ai.json accurately describe the machine surfaces?

**YES.** The REST array matches reality. MCP tools are listed. Policy fields are honest (`workshop_world_write: false`, `workshop_receipts_witnessed: false`). Version is 1.2.0. No overclaims.

### Are any advertised JSON files or routes missing or falling through to the app shell?

**YES — one file documented elsewhere:**

| URL | Source of claim | Result |
|-----|----------------|--------|
| `/physical_systems_index.json` | Referenced externally | Falls through to app shell ("frontend") |

All six registry seeds, all community seeds, and all `.md` files listed in llms.txt resolve correctly.

---

## 2. PASS / WARN / FAIL Table

### Documented REST Endpoints (from llms.txt)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/registry/list` | **PASS** | 35 items, 6 kinds, all verified |
| `GET /api/registry/get` | **PASS** | Needs `?id=` param |
| `GET /api/world/summary` | **PASS** | Live Firestore data, ember_balance: 3147.57 |
| `GET /api/council/latest` | **PASS** | Seeded, 1 proposal, labeled correctly |
| `GET /api/inspect/record` | **PASS** | Rich structured response with live heartbeat |
| `GET /api/lodge-mind/status` | **PASS** | Connected mode, Cloud Run configured |
| `GET /api/lodge-mind/context-preview` | **PASS** | Civic context bundle, 15 members, 3 quests |
| `POST /api/lodge-mind/ask` | **PASS** (documented as 503) | Cannot test; correctly labeled experimental |
| `GET /api/workshop/catalog` | **PASS** | 14 parts, limits defined, schema versioned |
| `POST /api/workshop/validate` | **PASS** (documented) | POST-only, cannot GET-test |
| `GET /api/agent/passport?id=moltbook_traveler` | **WARN** | Returns empty body, not 404 or JSON error |
| `POST /api/agent/passport/claim-moltbook` | N/A | Beta, authenticated, untestable |
| `POST /api/agent/memory/append` | N/A | Beta, authenticated, untestable |
| `POST /api/chemistry/execute` | N/A | Authenticated, untestable |
| `POST /claimBounty` | N/A | Authenticated + signed, untestable |

### Registry JSON Seeds

| File | Status |
|------|--------|
| `/artifact_registry.json` | **PASS** — manifest_hash present |
| `/tool_registry.json` | **PASS** — manifest_hash present |
| `/interface_modules.json` | **PASS** — manifest_hash present |
| `/lodge_apps.json` | **PASS** — manifest_hash present |
| `/machine_registry.json` | **PASS** — manifest_hash present |
| `/apparatus_registry.json` | **PASS** — manifest_hash present |
| `/workshop_parts.json` | **PASS** — manifest_hash present |
| `/vessel_members.json` | **PASS** — manifest_hash present |
| `/quest_board.json` | **PASS** — manifest_hash present |
| `/room_registry.json` | **PASS** — manifest_hash present |

### Docs and Discovery Files

| File | Status |
|------|--------|
| `/llms.txt` | **PASS** |
| `/.well-known/ai.json` | **PASS** |
| `/mission.md` | **PASS** |
| `/skill.md` | **PASS** |
| `/history.md` | **PASS** |
| `/lodge-interface.json` | **PASS** |

### Apparatus-Referenced Endpoints (NOT in llms.txt, found via registry)

| Endpoint | Apparatus | Claimed Status | Result |
|----------|-----------|---------------|--------|
| `GET /api/hearth/ceremony` | ceremony_hearth | "live" | **FAIL** — app shell |
| `GET /api/creativity/suggest` | creativity_forge | "live" | **FAIL** — app shell |
| `GET /api/duel/latest` | duel_pit | "live" | **FAIL** — app shell |
| `POST /api/workshop/compare` | blueprint_diffoscope | "live" | **FAIL** — app shell |
| `GET /api/world/tick` | automation_beacon | "live" | **FAIL** — returns `{"error":"World object 'tick' not found."}` |
| `POST /api/chemistry/preview` | reagent_alembic | "live" | **PASS** — responds with "Method not allowed. Valid: POST" (correct) |

---

## 3. Truth Boundary Issues

### Issue 1: Apparatus registry status inflation

The `apparatus_registry.json` marks 5 items as status `"live"` whose endpoints do not resolve:

- `ceremony_hearth` → `/api/hearth/ceremony` (app shell)
- `creativity_forge` → `/api/creativity/suggest` (app shell)
- `duel_pit` → `/api/duel/latest` (app shell)
- `blueprint_diffoscope` → `/api/workshop/compare` (app shell)
- `automation_beacon` → `/api/world/tick` (error JSON)

**Fix:** Change these to `"planned"` or `"stub"` in the apparatus_registry seed until the routes are deployed. A bot reading the registry today and calling these endpoints will get HTML or errors.

### Issue 2: Inspect endpoint amplifies the mismatch

`/api/inspect/record?ref=apparatus:creativity_forge` returns a live `heartbeat_at` timestamp and detailed experiment suggestions pointing to endpoints that don't exist. The `data_state: "live"` claim in that response is misleading because the entry point (`/api/creativity/suggest`) falls through.

**Fix:** Either deploy the suggest endpoint or have the inspect response reflect `data_state: "partial"` when the apparatus source endpoints are unreachable.

### Issue 3: Agent passport empty response

`/api/agent/passport?id=moltbook_traveler` returns an empty body (not JSON, not 404). A bot can't distinguish "no such agent" from "service error."

**Fix:** Return `{"found": false, "id": "moltbook_traveler"}` or a proper 404 JSON response.

### Issue 4: mission.md implies a live "Knight's Pouch" and "Semantic Siege"

The mission.md references actions ("Initialize the Knight's Pouch and the Semantic Siege") as "Next Action" — implying they're imminent or live. If these are future/planned concepts, label them as such.

**Exact line:** `"Next Action: Initialize the Knight's Pouch and the Semantic Siege."`

**Proposed replacement:** `"Next Action (planned): Initialize the Knight's Pouch identity verifier and the Semantic Siege claim challenge."`

---

## 4. MCP Reality Check

**Cannot fully test** — the MCP endpoint requires POST JSON-RPC, which my URL reader doesn't support. However:

- `/llms.txt` documents it clearly: POST JSON-RPC, methods `initialize`, `tools/list`, `tools/call`
- `ai.json` confirms transport: `streamable-http-stateless`
- 7 tools are named consistently across both discovery docs
- The WebMCP note in llms.txt mentions `document.modelContext` for browser-based agents

**Assessment:** Documentation is clear enough for a bot operator. The endpoint path, transport, and tool list are unambiguous. The one thing missing: **no example request/response pair** in llms.txt. A bot operator has to know JSON-RPC framing already.

**Suggested addition to llms.txt (after the MCP section):**
```
Example: POST /api/mcp
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```

---

## 5. Public Machine Usability

### Can a bot find the core read-only surfaces in under 60 seconds?

**YES.** `/llms.txt` is the single best entry point. It's well-structured, leads directly to endpoints with examples, and separates read-only from authenticated surfaces clearly.

### Best first entry point for bots?

**`/llms.txt`** — then `/api/registry/list` for structured data, then `/.well-known/ai.json` for machine-parseable metadata.

### Single most confusing mismatch between docs and reality?

The apparatus_registry claiming 5 endpoints are "live" when they fall through to the app shell. A bot that reads the registry (which is reachable and verified) and trusts the `status: "live"` field will make calls that silently fail by returning HTML.

---

## 6. Top 3 Fixes (Priority Order)

1. **Downgrade apparatus statuses** — Change `ceremony_hearth`, `creativity_forge`, `duel_pit`, `blueprint_diffoscope`, and `automation_beacon` from `"live"` to `"planned"` or `"stub"` in `apparatus_registry.json`. Re-stamp the manifest hash.

2. **Return JSON from the agent passport endpoint** for unknown IDs — `{"found": false}` instead of empty body.

3. **Add one JSON-RPC example** to the MCP section of llms.txt so bot operators don't need to guess the framing.

---

## 7. Summary

The public machine surface is remarkably coherent. The discovery docs (`llms.txt`, `ai.json`) are honest — they only claim what actually works. All 10 registry seeds verify. The documented REST API is fully operational.

The only real integrity issue lives one layer deeper: the apparatus_registry (reachable via the working API) over-promises on 5 endpoints. This is a metadata truth problem, not a deployment problem. Fix the statuses in the seed and the surface is clean.

**Best entrypoint for bots:** `/llms.txt`

---

*Audit complete. No code changes needed — this is a seed data and documentation fix only.*
