# Hearthlands Agent Service Token — Design Memo

> Pokee | 2026-06-29
> For: Local/on-site bot authentication (Gemma, steward bots, Bellows automation)
> Status: Design only. No code.

---

## The Three Auth Lanes

| Lane | Who | Credential | Existing? |
|------|-----|-----------|-----------|
| Human sovereign | Malaky, builders | Firebase ID token | Yes |
| External bot | Moltbook agents | `X-Moltbook-Identity` header, verified upstream | Yes (beta) |
| Local/site bot | Gemma, Bellows, steward automation | **Agent service token** (`hla_...`) | **Not yet** |

This memo designs the third lane.

---

## 1. Auth Model

### Token format

```
hla_7kX9mZp2qR4nW8vL1cD6yT3bA5fJ0sH2eK9gU4wM7xP
^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
prefix   43 chars of base62-encoded 32 random bytes
```

- **Prefix:** `hla_` (Hearthlands Agent) — instantly identifiable in logs, easily greppable
- **Body:** 32 bytes of `crypto.randomBytes`, encoded base62 (no ambiguous chars)
- **Total length:** 47 characters
- **Type:** Opaque random secret (not JWT, not signed)

### Why opaque, not signed?

Signed tokens (JWT) embed claims and expiry in the token itself. That's useful when you need stateless validation across many services. We don't. We have one Firestore collection and one validation path. Opaque tokens are:
- Simpler to implement
- Instantly revocable (no "valid until expiry" window)
- Don't leak scope/identity information if intercepted
- Don't require key rotation ceremonies

### Header

```
Authorization: Bearer hla_7kX9mZp2qR4nW8vL1cD6yT3bA5fJ0sH2eK9gU4wM7xP
```

Standard Bearer scheme. No custom header needed.

### Server-side storage

**Only the SHA-256 hash of the token is stored.** The raw token is shown to the human issuer exactly once at creation time and never stored or logged.

### Validation flow

```
1. Request arrives with Authorization: Bearer hla_...
2. Server extracts token after "Bearer "
3. Server computes SHA-256(token)
4. Server queries Firestore: agent_service_tokens where token_hash == computed_hash
5. If not found → 401
6. If found but revoked_at is set → 401
7. If found but expires_at < now → 401
8. Check request path against token's scope list → 403 if not permitted
9. Update last_used_at (fire-and-forget, don't block the request)
10. Proceed with request, injecting agent_id into the handler context
```

### Revocation

Set `revoked_at` on the token document. Immediate effect — next request with that token fails. No grace period, no cache. At this scale (tens of tokens, not millions), a single Firestore read per request is fine.

### Scopes

Array of permission strings. Each maps to one endpoint capability:

| Scope | Permits |
|-------|---------|
| `memory:append` | POST /api/agent/memory/append |
| `task:event` | POST /api/agent/task/event |
| `workshop:validate` | POST /api/workshop/validate (already public, but useful for tracking) |
| `passport:read` | GET /api/agent/passport (already public) |

Scopes are fixed at issuance. A token cannot self-expand. Only a Firebase-authenticated human can modify scope.

---

## 2. Threat Model

### What can go wrong if a token leaks?

**Blast radius:** The attacker can append entries to the linked agent's memory and task streams. That's it. They cannot:
- Read other agents' data
- Write to treasury, checkout, or admin surfaces
- Impersonate a human (Firebase auth is a separate lane)
- Issue new tokens
- Modify existing tokens
- Access Firestore directly (all writes go through scoped server endpoints)

**Worst case:** Garbage data appended to one agent's memory/task log. Detectable by timestamp anomaly. Recoverable by pruning entries after the leak window.

### How do we limit blast radius?

1. **One token per agent per purpose.** Gemma gets a token for memory+task. Bellows gets a separate token for its heartbeat writes. Leak of one doesn't compromise the other.
2. **Optional `expires_at`.** Tokens can have hard expiry (e.g., 30 days). Forces periodic re-issuance. Local bots don't need eternal tokens.
3. **`last_used_at` monitoring.** If a token hasn't been used in 7 days and suddenly fires, that's an anomaly flag.
4. **Append-only target surfaces.** Even if abused, the endpoints only append — they can't overwrite or delete existing data.

### How do we prevent a bot from impersonating a sovereign human?

- Agent service tokens are checked by a **separate middleware path** from Firebase ID tokens.
- The handler context injects `auth_type: "agent_service_token"` vs `auth_type: "firebase_user"`.
- Any endpoint that requires human sovereignty (treasury, admin sync, token management itself) rejects `auth_type: "agent_service_token"` unconditionally.
- There is no path from "I have an hla_ token" to "I can do what a Firebase user can do."

### How do we stop "bot self-maintenance" from becoming privilege escalation?

- **Bots cannot create tokens.** Token issuance requires Firebase Auth (human).
- **Bots cannot modify their own scope.** Scope is read-only from the bot's perspective.
- **Bots cannot extend their own expiry.** Only the human issuer can refresh.
- **Bots cannot read other bots' tokens.** The token hash collection is not queryable by agent tokens.
- **No "admin scope."** There is no scope that grants token management. Period.

The rule: **a bot can only do what its token explicitly says, and it cannot change what its token says.**

---

## 3. Firestore Schema

### Collection: `agent_service_tokens`

```
agent_service_tokens/{document_id}
├── token_hash: string          // SHA-256 of the raw token (indexed, unique)
├── agent_id: string            // linked passport ID (e.g., "gemma_steward")
├── label: string               // human-readable name ("gemma-local-memory")
├── scopes: string[]            // ["memory:append", "task:event"]
├── created_by: string          // Firebase UID of the human who issued it
├── created_at: timestamp       // when issued
├── revoked_at: timestamp|null  // null = active; set = revoked
├── expires_at: timestamp|null  // null = no hard expiry; set = auto-expire
├── last_used_at: timestamp     // updated on each successful auth
└── note: string                // optional: why this token exists
```

**Document ID:** First 16 chars of the token_hash (for fast lookup without exposing full hash in IDs).

**Index:** Composite index on `token_hash` (equality) for the auth lookup query.

### Security rules

```
match /agent_service_tokens/{tokenId} {
  // Only the Cloud Functions service account can read/write
  // No client reads, no client writes
  allow read, write: if false;
}
```

All token operations go through server-side Cloud Functions. No client SDK access.

### Related: Agent passport linkage

The `agent_id` field links to the existing agent passport system. When a token is used, the handler can verify the agent_id exists in the passport collection. If the passport is deactivated, the token is effectively dead even without explicit revocation.

---

## 4. Endpoint Integration Plan

### First wave (implement now)

| Endpoint | Current auth | Add agent token? | Rationale |
|----------|-------------|-----------------|-----------|
| `POST /api/agent/memory/append` | Firebase OR Moltbook | **Yes** | Primary use case for local bots |
| `POST /api/agent/task/event` | Firebase OR Moltbook | **Yes** | Primary use case for local bots |

### Second wave (implement when needed)

| Endpoint | Add agent token? | Rationale |
|----------|-----------------|-----------|
| `POST /api/workshop/validate` | Optional | Already public/no-auth, but token enables tracking per-agent usage |
| `GET /api/agent/passport` | Optional | Already public, but token could unlock private fields |

### Never (explicit exclusion)

| Endpoint | Why not |
|----------|---------|
| `POST /api/chemistry/execute` | Append-only but economically meaningful — keep human-gated |
| `POST /claimBounty` | Requires Ed25519 signature + Firebase — sovereign action |
| `POST /createCheckoutSession` | Real money — human only |
| Admin sync / Firestore direct | Steward terminal only — never exposed to tokens |
| Token management itself | Human Firebase auth only — prevents escalation |

---

## 5. Patch Plan

### Files to touch in `D:\Hearth\prosper2`

```
functions/src/lib/agentAuth.ts          [NEW]  — token validation middleware
functions/src/lib/auth.ts               [EDIT] — add agentAuth to the auth chain
functions/src/agentPassportApi.ts        [EDIT] — accept agent token on memory/task
functions/src/index.ts                   [EDIT] — register token management endpoints
functions/src/lib/tokenManagement.ts     [NEW]  — issue/revoke/list (Firebase-auth-gated)
firestore.rules                         [EDIT] — deny client access to agent_service_tokens
```

### New file: `functions/src/lib/agentAuth.ts`

Responsibilities:
- Extract `Authorization: Bearer hla_...` from request
- Hash the token
- Query Firestore for matching token_hash
- Verify not revoked, not expired
- Check scope against requested endpoint
- Inject `{ auth_type: "agent_service_token", agent_id, scopes }` into request context
- Update `last_used_at` (non-blocking)

~60 lines of code. No external dependencies beyond `crypto` and the Firestore Admin SDK already in use.

### Edit: `functions/src/lib/auth.ts`

Add `agentAuth` as a third option in the auth resolution chain:

```
1. Check for Firebase ID token → firebase_user
2. Check for X-Moltbook-Identity → moltbook_agent
3. Check for Authorization: Bearer hla_ → agent_service_token
4. None → 401
```

~10 lines added.

### Edit: `functions/src/agentPassportApi.ts`

In the `memory/append` and `task/event` handlers, accept `auth_type: "agent_service_token"` alongside the existing Firebase/Moltbook paths. Use the injected `agent_id` from the token context.

~5 lines changed per handler.

### New file: `functions/src/lib/tokenManagement.ts`

Three Cloud Functions (all require Firebase Auth):
- `createAgentServiceToken` — generates token, stores hash, returns raw token once
- `revokeAgentServiceToken` — sets revoked_at
- `listAgentServiceTokens` — returns metadata (no hashes) for the requesting user's tokens

~80 lines total.

### Edit: `firestore.rules`

Add:
```
match /agent_service_tokens/{tokenId} {
  allow read, write: if false;
}
```

1 line.

### Total patch size estimate

- 2 new files (~140 lines combined)
- 3 edited files (~20 lines changed total)
- 1 rule addition (1 line)

---

## 6. Issuance Flow (Human UX)

For now, token issuance is a **terminal/admin action**, not a UI button:

```bash
# Steward issues a token for Gemma
npx ts-node scripts/issue-agent-token.ts \
  --agent-id gemma_steward \
  --label "gemma-local-memory" \
  --scopes memory:append,task:event \
  --expires 30d

# Output (shown once, never stored):
# Token: hla_7kX9mZp2qR4nW8vL1cD6yT3bA5fJ0sH2eK9gU4wM7xP
# Agent: gemma_steward
# Scopes: memory:append, task:event
# Expires: 2026-07-29
#
# ⚠️  Save this token now. It cannot be retrieved again.
```

Prosper can add a UI for token status/revocation later. The issuance script is enough to start.

---

## 7. What This Does NOT Do

- Does not replace Firebase Auth for humans
- Does not replace Moltbook identity for external bots
- Does not give bots treasury access
- Does not allow bots to issue tokens to other bots
- Does not require wallet signing
- Does not introduce JWT complexity
- Does not require key rotation (revoke + re-issue is sufficient at this scale)
- Does not enable "bot self-sovereignty" — all authority flows from a human issuer

---

## Summary

The agent service token is a **hall pass**, not an identity. It says: "this specific bot is allowed to append to these specific surfaces, and a specific human said so." It can be revoked instantly, it expires naturally, and its blast radius is bounded to one agent's append-only streams.

Three lanes, clean separation:
```
Humans   → Firebase ID token  → full sovereignty
Moltbook → X-Moltbook-Identity → verified external identity
Site bots → Bearer hla_...     → scoped append-only writes
```

---

*Ready for implementation decision. Pokee recommends: implement agentAuth.ts first, issue one token for Gemma, verify memory/append works, then expand.*
