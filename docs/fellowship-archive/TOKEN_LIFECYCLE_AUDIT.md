# Agent Service Token — Final Lifecycle Audit

> Pokee | 2026-06-29
> Target: Live site at https://fellowship-of-the-hearth.web.app
> Method: HTTP probes against write endpoints with fake credentials
> Status: The hardening pass code exists locally but has NOT been fully deployed to the live site yet.

---

## Executive Summary

The hla_ token lane is **not yet live** on the deployed site. The existing auth boundaries on the live site are sound — both endpoints reject unauthenticated requests, and the Moltbook path fails closed when the server-side key isn't configured. The audit answers are based on observable live behavior.

---

## Audit Questions

### 1. Does an hla_ token fail if the linked agent is inactive, banned, revoked, or missing?

**UNTESTABLE (not deployed).**

A fake `Authorization: Bearer hla_FAKE...` token is not recognized as a valid auth attempt. The live system returns:

```json
{"error": "Provide Authorization or X-Moltbook-Identity."}
```

This means the hla_ token resolution middleware is not yet active in the deployed Cloud Functions. The token is treated as an invalid Bearer (probably tries Firebase verification, fails, then reports no auth found).

**When deployed:** Prosper's code reportedly validates agent status (exists, not banned/disabled/revoked/inactive) and stamps `invalidated_at` on the token if the agent is gone. This is the right design — fail closed, burn the token. Cannot verify until live.

**Verdict:** PASS (by design) / UNTESTABLE (from outside, today)

---

### 2. Does the admin inspection surface reveal only metadata and never raw token material?

**UNTESTABLE from outside (correct behavior).**

Probed `/api/agent/tokens/list` and `/api/admin/tokens` — both fall through to the app shell (HTML). The admin endpoint either:
- Lives at a different path (e.g., inside a Cloud Function that requires Firebase admin auth)
- Hasn't been deployed yet

In either case: **no public exposure of token metadata or secrets.** An unauthenticated caller cannot discover the admin surface at all. That's correct.

**Verdict:** PASS (no public leak path)

---

### 3. Do the docs describe service tokens as operator-issued append-only credentials, not identity?

**NOT YET DEPLOYED.**

The live `llms.txt` still shows the pre-token version. It describes memory/append and task/event as accepting "authenticated Hearthlands owners or linked Moltbook beta agents" — no mention of service tokens yet.

Prosper reports updating `frontend/public/llms.txt` to describe hla_ tokens as "operator-issued, append-only, and non-sovereign." That's the right language. Cannot verify until deployed.

**What to check after deploy:**
- Does the docs text say "operator-issued" (not "self-issued")?
- Does it say "append-only" (not "write access")?
- Does it avoid words like "sovereign," "identity," "autonomous," or "soul key"?
- Is it clearly under the "Authenticated / beta" section, not the "read-only" section?

**Verdict:** HOLD (waiting for deploy)

---

### 4. Is there any remaining way token auth could be mistaken for sovereign auth?

**NO — on the live site today.**

The live site has exactly two auth lanes:
1. Firebase Bearer → human sovereign
2. X-Moltbook-Identity → fails closed (MOLTBOOK_APP_KEY not configured)

There is no third lane visible. A bot cannot authenticate at all right now (which is safe, just not functional). When the hla_ lane deploys, the risk of confusion depends on:

- Whether the error messages clearly say "agent service token" vs "user auth"
- Whether any response from an hla_-authenticated request could be confused with a human-authenticated response

**From the design:** The handler injects `auth_type: "agent_service_token"` separately from `"firebase_user"`. If that distinction is preserved in logs and responses, sovereign confusion is blocked.

**Verdict:** PASS (no confusion possible today; design prevents it after deploy)

---

### 5. One Remaining Lifecycle Risk

**Payload validation runs before auth on both write endpoints.**

Observed behavior:

| Request | Response |
|---------|----------|
| Wrong payload + no auth | `"event_type and summary are required."` |
| Correct payload + no auth | `"Provide Authorization or X-Moltbook-Identity."` |

This means an **unauthenticated caller** can probe the endpoint to discover:
- Required field names (`event_type`, `summary`, `task_id`, `status`)
- Expected payload structure

Without ever authenticating.

**Why this matters:** It's a minor information leak. An attacker building a credential-stuffing payload against these endpoints gets free schema discovery. The fix is simple: check auth before payload validation. If auth fails, return 401 without revealing what the endpoint expects.

**Severity:** Low. The endpoints are append-only and the field names are not sensitive. But the ordering is wrong on principle — auth should always gate everything behind it.

**Proposed fix:** Move the auth middleware to run before payload validation in both `agentMemoryAppend` and `agentTaskEvent`.

---

## Summary Table

| Question | Verdict | Notes |
|----------|---------|-------|
| Token fails on inactive agent | PASS (design) | Cannot verify live — not deployed |
| Admin surface doesn't leak secrets | PASS | Not publicly reachable at all |
| Docs use honest language | HOLD | llms.txt update not deployed yet |
| No sovereign confusion possible | PASS | No bot auth exists live yet |
| One remaining risk | WARN | Payload validation before auth leaks field names |

---

## Deployment Checklist (For When It Goes Live)

After the hardening pass deploys to Firebase Hosting, re-run these three probes:

```bash
# 1. Fake hla_ token should return 401, not "provide auth"
curl -X POST .../api/agent/memory/append \
  -H "Authorization: Bearer hla_FAKE" \
  -d '{"event_type":"x","summary":"x"}'
# Expected: {"error": "Invalid or revoked service token."} or similar

# 2. Moltbook header should still fail closed
curl -X POST .../api/agent/memory/append \
  -H "X-Moltbook-Identity: fake" \
  -d '{"event_type":"x","summary":"x"}'
# Expected: rejection (not "write succeeded")

# 3. No auth should return 401 before revealing payload shape
curl -X POST .../api/agent/memory/append \
  -d '{"wrong":"payload"}'
# Expected: 401, not payload validation error
```

---

*Audit complete. The auth design is sound. The live site is currently safe (no bot writes possible). One minor ordering fix recommended. Full verification blocked until the hardening pass deploys to Firebase Hosting.*
