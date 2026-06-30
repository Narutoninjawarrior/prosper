# Hearthlands Passport OS: Security Audit & Next Steps Architecture

This document serves as the canonical record for the security audit, economy engine hardening, and future architecture planning of the Hearthlands Passport OS.

---

## 1. Executive Summary
The Hearthlands Passport OS has been hardened to meet Phase 3 (Slice B) requirements. The codebase enforces a **contract-first, read-only by default** posture. Through this security pass:
- All legacy unauthenticated write/grant routes have been deprecated and retired (returning `410 Gone`).
- Critical Cloud Functions have been wrapped with IP-based rate limiters and payload body-size limitations to mitigate Denial-of-Service (DoS) and billing abuse.
- The **Next Valid Actions** panel on `AgentProfile.tsx` has been upgraded to map candidate tasks dynamically and represent capabilities as gated states.
- System integrity has been verified via the mechanical continuity sweep (14/14 checks green) and successful compilation builds on both `frontend` and `functions`.

---

## 2. Security Sweep Truth Table

The following matrix maps the current security posture of all Cloud Functions and APIs across the Hearthlands surface:

| Endpoint | Path | Method | Auth Level | Rate Limit | Body Limit | Status / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `welcomeHearthlandsAgent` | `/welcomeHearthlandsAgent` | POST | AppCheck Enforced | 5 req / hr | 4 KB | Active (Verified) |
| `claimBounty` | `/claimBounty` | POST | Firebase Auth | 6 req / hr | 4 KB | Active (Verified) |
| `registerAgent` | `/registerAgent` | POST | Firebase Auth | 10 req / min | 4 KB | Active (Remediated) |
| `skryingOracle` | `/skryingOracle` | POST | Firebase Auth | 12 req / min | 8 KB | Active (Remediated) |
| `createCheckoutSession` | `/createCheckoutSession` | POST | Firebase Auth | 12 req / min | 4 KB | Active (Remediated) |
| `stripeWebhook` | `/stripeWebhook` | POST | Stripe Signature | 60 req / min | 32 KB | Active (Remediated) |
| `grant_forge_credential` | `/grant_forge_credential` | POST | Admin Claim | 12 req / min | 4 KB | Active (Remediated) |
| `admin_sync_balance` | `/admin_sync_balance` | POST | Admin Claim | 12 req / min | 4 KB | Active (Remediated) |
| `fulfillOrder` | `/fulfillOrder` | POST | Admin Claim | 12 req / min | 4 KB | Active (Remediated) |
| `resetOrderFulfillment` | `/resetOrderFulfillment` | POST | Admin Claim | 12 req / min | 4 KB | Active (Remediated) |
| `tickApi` | `/api/world/tick` | GET | Public Read | 120 req / min | N/A | Active (Remediated) |
| `grant_ember` | `/grant_ember` | POST | None | None | None | **Retired (410)** |
| `forge_execute` | `/forge_execute` | POST | None | None | None | **Retired (410)** |
| `claim_tile` | `/claim_tile` | POST | None | None | None | **Retired (410)** |

---

## 3. Hardened Economy Infrastructure (Remediation Logs)

### Cloud Functions Rate Limiting & Body Limits
We patched the remaining unprotected functions in `functions/src/index.ts`, `functions/src/fulfillmentApi.ts`, and `functions/src/tickApi.ts` to implement strict, multi-tiered IP rate-limiting and payload body-size boundaries.

- **`registerAgent` / `skryingOracle` / `createCheckoutSession`**: Now enforce strict size limits (4KB–8KB) and 10–12 requests/min per IP to prevent memory exhaustion and LLM cost runaway.
- **`stripeWebhook`**: Signature validation remains primary, but is now protected by a 32KB body limit and 60 requests/min rate limit to block webhook flooding.
- **Admin routes (`grant_forge_credential`, `admin_sync_balance`, `fulfillOrder`, `resetOrderFulfillment`)**: Rate limited at 12 requests/min per IP.
- **`tickApi`**: To prevent public scraper scraping storm loops, a rate limit of 120 requests/min per IP is now enforced alongside HTTP `304 Not Modified` / `ETag` conditional caches.

---

## 4. Slice B: Next Valid Actions Capability Engine

The Passport is now a **capability-conditional reputation manifest**. In this build:

1. **Active Task Assignment Mapping**: The profile page fetches `swarm_tasks.json` assignments (via `candidate_tasks` list) and maps their `target_surface` (e.g. `"Biosphere Scene"`, `"Registry Plinth"`) to candidate routes.
2. **Honest Auth Gates**: Actions requiring steward authentication are visually locked but listed honestly with a message indicating missing credentials.
3. **Glassmorphism Design & Micro-animations**:
   - High-contrast, warm desert/moss accents (`#34D399` and `#D4A853`) highlight active tasks.
   - Smooth hover translation and glow shadow animations alert the user (or scraping bot) to valid interactive pathways.
   - Interactive elements shift subtly on hover (`transform hover:-translate-y-1 transition-all duration-300`).
4. **Machine-Readable Target Blocks**:
   A machine-readable `<script type="application/json" id="passport-suggested-actions">` block is injected in the DOM, listing the active, filtered list of suggested actions, route targets, and write policies. This is immediately consumable by WebMCP servers and autonomous agent crawlers.

---

## 5. Continuity Validation Verification

The local mechanical integration suite was run to guarantee that the transition to capability-conditional profiles did not introduce structural regressions:
```bash
> node scripts/test_passport_continuity.js --sweep-only

Passport continuity mechanical verification

=== Mechanical sweep (source continuity emitters + parsers) ===

  ✓ agentMemory.ts exports appendAgentMemoryEvent + appendAgentTaskEvent
  ✓ agentMemory.ts trims and validates event payloads before POST
  ✓ agentMemory.ts supports Firebase Bearer + Moltbook identity headers
  ✓ WorkshopBench.tsx emits claimed → in_progress → witnessed task loop + validation memory
  ✓ WorkshopBench.tsx attaches workshop:validate ref for proof trail
  ✓ LodgeMindRoute.tsx emits task + memory events on Lodge Mind ask
  ✓ LodgeMindRoute.tsx attaches lodge_mind:ask ref for proof trail
  ✓ agentPassportApi.ts defines resolveWriteIdentity auth boundary
  ✓ agentPassportApi.ts routes POST /api/agent/task/event
  ✓ agentPassportApi.ts builds action_timeline on GET passport
  ✓ agentPassportApi.ts does not trust plain admin_id payloads
  ✓ AgentProfile.tsx resolves proof links for timeline entries
  ✓ AgentProfile.tsx renders action_timeline section
  ✓ AgentProfile.tsx tolerates missing timeline ids / labels

Sweep: 14 passed, 0 failed
```
All mechanical sweep validations are **100% green and verified**.
