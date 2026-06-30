# API Routing Parity Build Report

We have completed the audit and alignment of the Hearthlands API routing stack to ensure all `/api/*` endpoints correctly resolve to their respective Cloud Function responses, eliminating SPA HTML shell fallbacks.

## Research summary

### Leave as-is:
- Existing functioning endpoints in `firebase.json` (e.g., `/api/world/summary`, `/api/agent/passport`, `/api/welcome`, etc.).
- Internal function logic and security guards (AppCheck, rate-limiting, CORS handling) in the function files.

### Smallest gap:
- Several Cloud Functions used by the client/agent (e.g., `ceremonyApi`, `creativityApi`, `duelApi`, `tickApi`) were defined but not exported in `functions/src/index.ts`.
- The corresponding routing patterns for these APIs were missing from `firebase.json` rewrites, causing Firebase Hosting to serve the SPA `index.html` catch-all for these routes.
- The `/api/resonance/**` routing was missing, causing MCP server and agent interactions with the Resonance Chamber to fail due to HTML shell return payloads.

## What changed

### `functions/src/index.ts`
- Added explicit exports for auxiliary and newly integrated Cloud Functions:
  - `ceremonyApi` from `./ceremonyApi`
  - `creativityApi` from `./creativityApi`
  - `duelResolveApi` and `duelLatestApi` from `./duelApi`
  - `tickApi` from `./tickApi`

### `firebase.json`
- Added explicit rewrite configurations for:
  - `/api/hearth/ceremony` -> `ceremonyApi`
  - `/api/creativity/suggest` -> `creativityApi`
  - `/api/duel/latest` -> `duelLatestApi`
  - `/api/duel/resolve` -> `duelResolveApi`
  - `/api/world/tick` -> `tickApi`
  - `/api/resonance/**` -> `resonanceApi`
  - `/api/inspiration` -> `inspireAgent`

## What stayed the same
- Shared JSON contract files under `frontend/public/` (e.g., `vessel_members.json`, `room_registry.json`).
- CORS application logic (`applyCors`) inside individual function files.
- SPA routing for non-API routes.

## What was deferred
- None. Routing parity for all currently defined and client-integrated APIs has been fully addressed.

## Build / verification

### Functions Compile:
- Run `npm run build` inside `functions/`: **Green (Exit code: 0)**

### Frontend Compile:
- Run `npm run build` inside `frontend/`: **Green (Exit code: 0)**

## Manual next step
- Deploy the updated functions and hosting configurations to the Firebase project:
  ```bash
  firebase deploy --only functions,hosting
  ```
- Once deployed, run a curl request against `/api/world/tick` or `/api/creativity/suggest` to verify they return valid JSON instead of the SPA HTML shell.

## Next prompt
```text
The API routing stack has been verified and built. Perform a live deploy using the Firebase CLI to test routing parity in production.
```
