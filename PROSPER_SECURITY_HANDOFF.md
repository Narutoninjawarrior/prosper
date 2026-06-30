# SECURITY HANDOFF — Claude Audit vs Repo Reality (for Prosper / Cursor)

**Workspace:** `D:\Hearth\prosper2`  
**Date:** 2026-06-18  
**Context:** External security audit + Ponytail discipline. This doc corrects stale findings and lists what still matters.

---

## Ponytail (github.com/DietrichGebert/ponytail)

Plugin/ruleset for AI coding agents (Cursor, Claude Code, Codex). **Philosophy:** YAGNI ladder before writing code — stdlib → platform → dependency → one line → minimum that works.

**Never cuts:** trust-boundary validation, security, data-loss prevention.

**Useful commands after install:**
```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/ponytail-review   # find over-engineering to delete
```

**Pair with Hearthlands:** After security fixes, run `/ponytail-review` on diffs >50 lines so remediation does not balloon complexity.

---

## Audit finding truth table

| # | Claude finding | Repo reality (June 2026) | Action |
|---|----------------|--------------------------|--------|
| 1 | Plaintext `fellows` gate | **Was true** — `Gate.tsx` compared password in client | **FIXED (Cursor)** — Firebase email/password + `admin`/`sovereign` claims |
| 2 | Service account in git history | `secrets/` untracked; `.gitignore` hardened | **Malaky:** run `git log -S "private_key"` manually; rotate if any key committed |
| 3 | `agent_id === 'malaky'` bypass | **Mostly fixed** — `forge_execute`/`claim_tile` return **410 retired**; `grant_forge_credential` uses `requireAdmin()` | **DONE** — remove stale `functions/lib/*.js` via rebuild; deprecate root `grant_ember.py` |
| 4 | No rate limiting | **FALSE** — `edgeGuard.ts` on passport, welcome, lodge-mind, workshop, chemistry, MCP, embodiment | Optional: App Check on browser writes |
| 5 | Chain hash no external anchor | **TRUE gap** — internal SHA-256 chain only | Optional GH Actions anchor gist (Phase 2) |
| 6 | MOLTBOOK_API_KEY on disk | Recruiter uses `os.getenv("MOLTBOOK_API_KEY")` — env only, not committed | Ensure `.env` never committed |
| 7 | Agents hold admin credentials | Stewards use `GOOGLE_APPLICATION_CREDENTIALS` locally only | Document: never give admin SA to Cursor long-term |
| 8 | Missing security headers | **FIXED (Cursor)** — `firebase.json` X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy | Strict CSP deferred (breaks Vite/Firebase until tuned) |
| 9 | cottage-commons prompt injection | **Different repo** — not in prosper2 | Handle in cottage-commons separately |
| 10 | Make prosper2 private | **Product decision** — public contract-first lodge | Scrub bypass comments in public docs instead |
| 11 | Structured logging | Partial — `console.error` in passport fallback | Optional Cloud Logging wrapper |
| 12 | Pin dependencies | Mixed — `functions` has pinned TS; run `npm audit` in CI | Low priority hygiene |
| 13 | try/catch on all functions | Partial — many handlers wrapped | Incremental |
| 14 | localStorage untrusted on migration | Future — when Studio migrates | Defer |

---

## Prosper status (2026-06-18 evening)

- **Passport OS slice:** Identity resolver API + Next Valid Actions panel — **in repo** (`agentPassportApi.ts`, `AgentProfile.tsx`).
- **Functions build:** `npm run build` in `functions/` — **green**.
- **Deploy blocked:** root had no `.firebaserc` → **FIXED (Cursor)** — added `/.firebaserc` with `fellowship-of-the-hearth`.
- **Hosting rewrite gap:** `/api/agent/passport/resolve` → **FIXED (Cursor)** in root `firebase.json`.
- **Git secret scan:** Prosper cannot run `git log -S "private_key"` — **Malaky must run manually** (see step 1 below).

## What Cursor added for Phase 2 scaffolding (same session)

1. **`functions/src/lib/appCheckGate.ts`** — optional enforcement when `APP_CHECK_ENFORCE=true` on functions.
2. **`frontend/src/lib/appCheck.ts`** — init + `mergeAppCheckHeaders` on welcome, passport writes, lodge-mind ask.
3. **`functions/src/lib/auth.ts`** — structured `functions.logger.warn` on 401/403.
4. **`grant_forge_credential`** — structured `functions.logger.info` on successful grant.
5. **`.github/workflows/audit.yml`** — `npm audit --audit-level=high` on root, frontend, functions.
6. **`scripts/deploy-security-phase2.ps1`** — one-shot build + deploy script from repo root.

**App Check is OFF by default** until:
- Firebase Console → App Check enabled for web (reCAPTCHA v3).
- `VITE_FIREBASE_APP_CHECK_SITE_KEY` in `frontend/.env.local`.
- `APP_CHECK_ENFORCE=true` on Cloud Functions env (after tokens verified in prod).

---

## What Cursor fixed earlier this session

1. **`frontend/src/Gate.tsx`** — removed `fellows`; steward Firebase sign-in with custom claims.
2. **`frontend/src/HallOfHonor.tsx`** — updated steward gate copy.
3. **`functions/src/grant.ts`** — `grant_ember` returns 410 retired (was unauthenticated malaky ember grant).
4. **`.gitignore`** — `secrets/`, service account JSON patterns, `.env.*`.
5. **`firebase.json`** — security headers (non-CSP).
6. **`PROSPER_HANDOFF_PASSPORT_OS.md`** — passport operating surface backlog (separate track).

---

## PROSPER TECHNICAL PROMPT — Security Phase 2 (after Cursor deploy)

```
SECURITY PHASE 2 — HEARTHLANDS (prosper2)

Prerequisites:
- Deploy Cursor security slice: hosting (Gate + headers) + functions (grant_ember 410)
- Confirm steward Firebase user has custom claim admin:true or sovereign:true

1. Git history secret scan (Malaky must approve if keys found):
   git log --all -p -S "private_key" -- "*.json" | head -80
   git log --all -p -S "MOLTBOOK_API_KEY" | head -40
   If firebase-service-account.json bytes appear in history → rotate keys in Firebase Console.

2. Firebase App Check (browser write surfaces):
   - Enable App Check for web app
   - Enforce on: welcomeHearthlandsAgent, agentPassportApi writes, lodge-mind/ask, chemistry/execute
   - Document in firebase-readiness.md

3. Deploy retired legacy functions (verify 410 live):
   curl -X POST https://fellowship-of-the-hearth.web.app/api/... 
   forge_execute, claim_tile, grant_ember should NOT accept writes

4. Remove or quarantine root dev scripts (do not use in production):
   grant_ember.py, sync_ember.py, test.py, hearthlands_build.py
   They send admin_id: malaky to retired endpoints.

5. Optional chain anchor (.github/workflows/chain-anchor.yml):
   Only if GET /api/ledger/root-hash exists — else skip until ledger API ships.

6. Install ponytail on your agent session; run /ponytail-review on next feature diff.

7. Continue passport operating surface (PROSPER_HANDOFF_PASSPORT_OS.md) — separate from security.

Verify:
- Hearth OS gate rejects non-steward Firebase accounts
- Public routes (/explore, /hall, /agent/*) work without gate
- npm run test:passport-browser-sweep
```

---

## Parallel track: Passport Operating Surface

Continuity is **live and verified** (31 integration + 12 browser checks). Next: identity resolver, Next Valid Actions panel — see `PROSPER_HANDOFF_PASSPORT_OS.md`.

---

## Deploy after Cursor security + passport slice

```powershell
powershell -File D:\Hearth\prosper2\scripts\deploy-security-phase2.ps1
```

Or manually:

```powershell
cd D:\Hearth\prosper2\functions
npm run build
cd ..
firebase deploy --project fellowship-of-the-hearth --only hosting,functions:grant_ember,functions:agentPassportApi,functions:welcomeHearthlandsAgent,functions:lodgeMindAsk
```

Set steward claim (once per sovereign uid):
```javascript
// Firebase Admin SDK one-liner or Console → Authentication → user → custom claims
{ "admin": true, "sovereign": true }
```

---

## What we should NOT do (ponytail + sovereignty)

- Strict CSP without testing every Firebase/Google script domain
- Re-implement forge_execute world writes before economy wave 2 policy engine
- Client-side password gates of any kind
- cottage-commons changes inside prosper2 PR
