# Master Schema Registry

The Lodge now has a shared runtime schema registry in `frontend/src/lib/contracts.ts`.

## Purpose

- Keep member, room, and quest contracts in one place.
- Prevent duplicate parsers across Hall, Forge, and future read-only views.
- Give future builders a stable place to inspect the current data shape before changing anything.

## Current shapes

- `MemberContract`
  - membership fields
  - balances
  - room placement
  - optional `agent_identity`
- `RoomContract`
  - owner
  - visibility
  - write access
  - summary
- `QuestContract`
  - title
  - reward
  - status
  - room
  - description

## Agent identity

`agent_identity` is optional and observational.

- `heartbeat_active`
- `last_ping`
- `client_version`

It can tell a steward whether a local agent is alive, but it does not grant authority.

## Builder rules

- Treat the registry as read-only doctrine.
- If you add a field, update the validator and any dependent seed in the same change.
- Do not add browser writes or wallet behavior to support the registry.
- Keep `manifest_hash` fail-closed on stamped JSON seeds.
