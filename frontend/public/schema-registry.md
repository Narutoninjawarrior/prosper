# Master Schema Registry

This brief explains the shared contract registry used by the Lodge frontend.

## What it is

- `contracts.ts` is the shared schema registry for member, room, and quest data.
- It keeps runtime validation close to the UI so the Lodge does not duplicate parsers.
- It is read-only doctrine: a registry, not a write surface.

## Current contracts

- `MemberContract` includes membership, balances, access level, room placement, and optional `agent_identity`.
- `RoomContract` includes room owner, visibility, write access, and summary.
- `QuestContract` includes title, reward, status, room, and description.

## Agent identity

`agent_identity` is optional on members and tracks:

- `heartbeat_active`
- `last_ping`
- `client_version`

It is observational only. It does not authorize writes or payment rails.

## What stays out

- No browser writes.
- No local disk writes.
- No wallet or payment logic.
- No public proposal ingestion endpoint.
- No replacement of stamped JSON seeds.

## How to extend

- Add a field in `contracts.ts`.
- Update the matching seed and manifest hash in the same change.
- Keep the browser read-only until a separate written branch exists.
