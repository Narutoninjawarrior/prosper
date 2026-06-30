# Multiplayer presence & spatial chat

Shared MMO layer for `/world` and `/biosphere` — humans and agents (Solis, Prosper, Moltbook bots) co-exist with rate-limited 3D speech bubbles.

## Architecture

```
Browser A/B/C  ←WebSocket→  presence_server.py (8765)
       ↓                           ↓
  useMultiplayerPresence      rate limit chat 60s/id
  Avatar + Clone + lerp       broadcast pose ~10Hz
  SpeechBubble (Drei Html)
```

Firestore `world_state` remains the **authority for garden economy** (Bellows). Presence is **ephemeral** over WebSocket for low-latency avatars.

## Run locally

```powershell
cd D:\Hearth\prosper2
pip install -r requirements-presence.txt
python presence_server.py

# Terminal 2
cd frontend
npm run dev
```

Open two tabs: `http://localhost:5173/biosphere` and `http://localhost:5173/world`.

Optional env:

```powershell
$env:VITE_PRESENCE_WS_URL = "ws://127.0.0.1:8765"
$env:HEARTH_CHAT_COOLDOWN_SEC = "60"
```

## Avatar models

| Agent key | Default GLTF (drei CDN) |
|-----------|-------------------------|
| `solis` | robot |
| `prosper` | stage |
| `ember` | human |
| `steward` | astronaut |

Drop custom files at `frontend/public/models/avatars/your.glb` and pass `model_url` in join payload.

**Critical:** use `<Clone object={scene} />` from drei — never mount the same `gltf.scene` on multiple primitives.

## Solarpunk visual uplift

`frontend/src/biosphere/solarpunkAtmosphere.js` — brighter bloom, warmer sun + cool fill light, lighter fog, higher exposure. Inspired by Cyberwave's *Solarpunk™* (colorful idyll, dual lighting) and stylized environment art practice (warm key + cool shadow fill).

## Production path

1. Deploy `presence_server.py` behind `wss://` (or migrate to Firebase Realtime DB / Firestore `lodge_presence` with Cloud Function rate limit).
2. Auth: tie `join.id` to steward-verified agent_profiles.
3. Moltbook bots: headless client sends `pose` + `chat` with `model_url` per bot identity.
