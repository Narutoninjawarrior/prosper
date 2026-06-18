# PROSPER HANDOFF — Passport Continuity Deploy & Verify

**Workspace:** `D:\Hearth\prosper2`  
**Status:** Mechanical sweep GREEN locally. Live integration blocked on **deploy drift** (not mechanism design).

## What Cursor completed

1. **Mechanical sweep** — `npm run test:passport-continuity:sweep` → 14/14 checks pass.
2. **`scripts/test_passport_continuity.js`** — Firebase custom-token loop: task events → memory append → GET passport timeline validation.
3. **Emitter hardening** — `frontend/src/lib/agentMemory.ts` trims/validates payloads before POST.
4. **UI hardening** — `AgentProfile.tsx` tolerates missing timeline ids/labels.
5. **Backend fixes (not yet deployed):**
   - `fetchAgentMemoryDocs()` — fallback when Firestore composite index missing.
   - `requestRoutePath()` — more reliable route matching.
   - `firestore.indexes.json` — `agent_memory` index on `agent_id` + `created_at`.

## Live test findings (against production)

| Check | Result |
|-------|--------|
| `POST /api/agent/memory/append` | ✓ Works (201, event written) |
| `POST /api/agent/task/event` | ✗ Returns SPA HTML (hosting rewrite **not deployed**) |
| `GET /api/agent/passport` | ✓ Returns bundle but **empty timeline** (index missing + events not readable) |
| Firestore `agent_memory` query | ✗ `FAILED_PRECONDITION` — composite index required |

## Your deploy order

```powershell
cd D:\Hearth\prosper2\functions
npm run build

cd D:\Hearth\prosper2
firebase deploy --only firestore:indexes
firebase deploy --only functions:agentPassportApi
firebase deploy --only hosting
```

**Critical:** Root `firebase.json` must deploy (not `frontend/firebase.json`). It includes:

- `/api/agent/task/event` → `agentPassportApi`
- `/api/agent/memory/append` → `agentPassportApi`

Wait for Firestore index build (Console → Firestore → Indexes) before expecting ordered timeline queries.

## Verify after deploy

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "D:\Hearth\prosper2\secrets\firebase-service-account.json"
npm run test:passport-continuity
```

Expected: all mechanical + live checks green; `action_timeline` shows claimed → in_progress → witnessed + inspect row.

## If live test still fails

1. **task/event returns HTML** → hosting rewrites stale; redeploy hosting from repo root.
2. **timeline empty but memory writes succeed** → deploy functions + indexes; confirm index status is **Enabled**.
3. **401 on writes** → test agent profile must have `firebase_uid` matching custom token uid (script seeds this automatically).

## Files touched (this slice)

- `scripts/test_passport_continuity.js`
- `frontend/src/lib/agentMemory.ts`
- `frontend/src/AgentProfile.tsx`
- `functions/src/agentPassportApi.ts`
- `firestore.indexes.json`
- `firebase.json` (indexes pointer)
- `package.json` (`test:passport-continuity` scripts)
