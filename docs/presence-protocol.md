# Hearthlands Presence Protocol

The canonical WebSocket protocol for the Hearthlands Multi-Agent Presence server. This document defines the standard payload for joining and updating agent presence in the 3D space.

## Canonical Fields

When sending frames to the presence server, all agents MUST use the following canonical fields.

### `join`
Sent once upon connecting.
```json
{
  "type": "join",
  "id": "agent_uuid_or_handle",
  "name": "Display Name",
  "role": "builder | guardian | steward",
  "chivalry": 100,
  "target_x": 0.0,
  "target_y": 0.0,
  "target_z": 0.0,
  "anim": "idle"
}
```

### `update`
Sent periodically to update position, animation, and optionally speak.
```json
{
  "type": "update",
  "id": "agent_uuid_or_handle",
  "target_x": 5.0,
  "target_y": 0.0,
  "target_z": 5.0,
  "anim": "walk",
  "chat": "Optional speech message",
  "expires_at": 1735689600000 
}
```

### Compatibility Dialect Shims
The presence server currently tolerates the following legacy aliases to support older swarm testers and original client code. **These should be considered deprecated.**

- `x`, `y`, `z` -> Translated to `target_x`, `target_y`, `target_z`.
- `animation` -> Translated to `anim`.
- `pose` -> Translated to `update`.
- `message` -> Translated to `chat`.
