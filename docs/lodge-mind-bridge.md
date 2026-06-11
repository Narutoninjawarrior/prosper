# Lodge Mind Bridge

## Purpose
This slice creates the first honest public surface for the future Builders Lodge mind.

It does **not** claim Gemma or Qwen is already operating live in the cloud.
It does **not** mutate world state.
It does **not** hide a browser `localhost` dependency behind a public route.

Instead, it does four narrow things:

1. exposes backend readiness as public JSON
2. shows the context bundle a cloud mind would read
3. offers a truthful public ask relay when Cloud Run is configured
4. keeps the write boundary inside Cloud Functions and future Cloud Run

## Public Endpoints

### `GET /api/lodge-mind/status`
Returns:
- bridge mode
- provider label
- Cloud Run/service URL readiness
- model name if configured
- sovereign/admin guard readiness
- counts for core civic collections
- current forge world-state summary

### `GET /api/lodge-mind/context-preview`
Returns:
- generated timestamp
- recent embodiment ledger events
- active quests
- public summary counts
- proposed actions for a future cloud mind

### `POST /api/lodge-mind/ask`
Returns:
- an OpenAI-compatible chat-completions response when `LODGE_MIND_SERVICE_URL` is configured
- `503` with a truthful readiness message when the relay is not configured

Rules:
- no browser `localhost` dependency
- no world writes
- no hidden fallback to local-only daemons on the public route

## Public Route

### `/lodge-mind`
Read-only browser page that renders:
- readiness cards
- readable civic context
- truthful ask-panel availability
- recent witnessed events
- proposed actions

This route is a **public diagnostic/intelligence surface**, not an operator console.

## Required Secrets For Real Inference Later

To move from readiness into live inference, the following server-side settings are expected:

- `LODGE_MIND_SERVICE_URL`
- `LODGE_MIND_PROVIDER`
- `LODGE_MIND_MODEL`
- `SOVEREIGN_UID`

Optional:

- `LODGE_MIND_HMAC_SECRET`
- `VERTEX_PROJECT_ID`
- `VERTEX_LOCATION`

## Recommended Runtime Split

### Firestore
Shared civic memory:
- `three_forge/world_state`
- `agent_profiles`
- `lodge_quests`
- `artifact_registry`
- `embodiment_ledger`

### Cloud Functions
Deterministic policy boundary:
- seal verification
- build intent validation
- artifact witnessing
- treasury/order integrity
- scheduled wake/sweep orchestration

### Cloud Run
Always-on cognitive layer:
- Gemma/Qwen inference
- RAG assembly over Firestore-safe context
- proposal generation
- optional tool invocation back through guarded Cloud Functions

## Non-Goals Of This Slice

- no autonomous spending
- no direct browser writes
- no wallet logic changes
