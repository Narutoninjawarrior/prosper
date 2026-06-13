"""
presence_server.py — lightweight WebSocket MMO presence + spatial chat.

Protocol (JSON text frames):
  Client → Server:
    { "type": "join", "id": "solis", "name": "Solis", "model_url": "https://..." }
    { "type": "pose", "id": "solis", "target_x": 0, "target_y": 0, "target_z": 2, "anim": "idle" }
    { "type": "chat", "id": "solis", "text": "The Bellows breathe." }

  Server → Client:
    { "type": "welcome", "id": "...", "peers": [...] }
    { "type": "peer_join" | "peer_leave" | "pose" | "chat" | "chat_rejected" | "error" }

Chat rate limit: 1 message per 60 seconds per entity id (configurable).

Run:
  pip install websockets
  python presence_server.py
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError as exc:
    raise SystemExit("Install websockets: pip install websockets") from exc

HOST = os.environ.get("HEARTH_PRESENCE_HOST", "127.0.0.1")
PORT = int(os.environ.get("HEARTH_PRESENCE_PORT", "8765"))
CHAT_COOLDOWN_SEC = float(os.environ.get("HEARTH_CHAT_COOLDOWN_SEC", "60"))
POSE_MIN_INTERVAL = float(os.environ.get("HEARTH_POSE_MIN_INTERVAL", "0.08"))  # ~12Hz max


@dataclass
class Peer:
    ws: WebSocketServerProtocol
    id: str
    name: str
    model_url: str | None = None
    role: str | None = None
    chivalry: int | None = None
    target_x: float = 0.0
    target_y: float = 0.0
    target_z: float = 0.0
    anim: str = "idle"
    last_chat_at: float = 0.0
    last_pose_at: float = 0.0
    message: str | None = None
    message_until: float = 0.0

    def to_public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "model_url": self.model_url,
            "role": self.role,
            "chivalry": self.chivalry,
            "target_x": self.target_x,
            "target_y": self.target_y,
            "target_z": self.target_z,
            "anim": self.anim,
            "message": self.message if self.message_until > time.time() else None,
        }


peers: dict[str, Peer] = {}


async def broadcast(payload: dict[str, Any], exclude_id: str | None = None) -> None:
    dead: list[str] = []
    data = json.dumps(payload)
    for pid, peer in list(peers.items()):
        if exclude_id and pid == exclude_id:
            continue
        try:
            await peer.ws.send(data)
        except Exception:
            dead.append(pid)
    for pid in dead:
        peers.pop(pid, None)


def _sanitize_id(raw: str) -> str:
    return "".join(c for c in (raw or "guest")[:32] if c.isalnum() or c in "-_")


async def handle_message(peer: Peer, msg: dict[str, Any]) -> None:
    mtype = msg.get("type")

    if mtype == "join":
        peer.name = str(msg.get("name") or peer.id)[:48]
        peer.model_url = msg.get("model_url")
        peer.role = str(msg.get("role") or peer.role or "")[:24] or None
        peer.chivalry = int(msg.get("chivalry", peer.chivalry or 0)) if msg.get("chivalry") is not None else peer.chivalry
        peer.target_x = float(msg.get("target_x", msg.get("x", peer.target_x)))
        peer.target_y = float(msg.get("target_y", msg.get("y", peer.target_y)))
        peer.target_z = float(msg.get("target_z", msg.get("z", peer.target_z)))
        await broadcast({"type": "peer_join", "peer": peer.to_public()}, exclude_id=peer.id)
        return

    if mtype in {"pose", "update"}:
        now = time.time()
        if now - peer.last_pose_at < POSE_MIN_INTERVAL:
            return
        peer.last_pose_at = now
        # Compatibility Dialect Shims: x -> target_x, animation -> anim
        peer.target_x = float(msg.get("target_x", msg.get("x", peer.target_x)))
        peer.target_y = float(msg.get("target_y", msg.get("y", peer.target_y)))
        peer.target_z = float(msg.get("target_z", msg.get("z", peer.target_z)))
        peer.anim = str(msg.get("anim", msg.get("animation", "idle")))[:24]
        peer.role = str(msg.get("role") or peer.role or "")[:24] or peer.role
        peer.chivalry = int(msg.get("chivalry", peer.chivalry or 0)) if msg.get("chivalry") is not None else peer.chivalry
        await broadcast({
            "type": "pose",
            "id": peer.id,
            "target_x": peer.target_x,
            "target_y": peer.target_y,
            "target_z": peer.target_z,
            "anim": peer.anim,
            "role": peer.role,
            "chivalry": peer.chivalry,
        }, exclude_id=peer.id)

        inline_chat = str(msg.get("chat", "")).strip()[:280]
        if inline_chat:
            now = time.time()
            if now - peer.last_chat_at >= CHAT_COOLDOWN_SEC:
                peer.last_chat_at = now
                peer.message = inline_chat
                peer.message_until = now + 10.0
                await broadcast({
                    "type": "chat",
                    "id": peer.id,
                    "name": peer.name,
                    "text": inline_chat,
                    "expires_at": peer.message_until,
                })
        return

    if mtype == "witness_ack":
        cert = msg.get("cert_hash")
        print(f"[presence] {peer.name} witnessed event {cert}")
        # In the future, this is where we log reputation on the Hall of Honor!
        return

    if mtype == "chat":
        text = str(msg.get("text", "")).strip()[:280]
        if not text:
            await peer.ws.send(json.dumps({"type": "error", "error": "empty_message"}))
            return
        now = time.time()
        if now - peer.last_chat_at < CHAT_COOLDOWN_SEC:
            wait = int(CHAT_COOLDOWN_SEC - (now - peer.last_chat_at))
            await peer.ws.send(json.dumps({
                "type": "chat_rejected",
                "id": peer.id,
                "retry_after_sec": wait,
                "reason": "rate_limited",
            }))
            return
        peer.last_chat_at = now
        peer.message = text
        peer.message_until = now + 10.0
        await broadcast({
            "type": "chat",
            "id": peer.id,
            "name": peer.name,
            "text": text,
            "expires_at": peer.message_until,
        })
        return

    await peer.ws.send(json.dumps({"type": "error", "error": "unknown_type"}))


async def handler(ws: WebSocketServerProtocol) -> None:
    peer_id = _sanitize_id(f"guest-{id(ws)}")
    peer = Peer(ws=ws, id=peer_id, name=peer_id)
    peers[peer_id] = peer

    await ws.send(json.dumps({
        "type": "welcome",
        "id": peer_id,
        "chat_cooldown_sec": CHAT_COOLDOWN_SEC,
        "peers": [p.to_public() for pid, p in peers.items() if pid != peer_id],
    }))

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send(json.dumps({"type": "error", "error": "invalid_json"}))
                continue
            if "id" in msg:
                new_id = _sanitize_id(str(msg["id"]))
                if new_id != peer.id:
                    peers.pop(peer.id, None)
                    peer.id = new_id
                    peers[peer.id] = peer
            await handle_message(peer, msg)
    finally:
        peers.pop(peer.id, None)
        await broadcast({"type": "peer_leave", "id": peer.id})


async def tick_broadcaster() -> None:
    state_path = os.path.join(os.path.dirname(__file__), "frontend", "public", "bellows_state.json")
    last_tick = None
    while True:
        try:
            if os.path.exists(state_path):
                with open(state_path, "r", encoding="utf-8") as f:
                    state = json.load(f)
                current_tick = state.get("tick")
                if current_tick is not None and current_tick != last_tick:
                    if last_tick is not None:
                        # New tick detected!
                        cert_raw = f"{current_tick}-{state.get('ember_balance', 0)}-{state.get('last_intent', '')}"
                        cert_hash = hashlib.sha256(cert_raw.encode("utf-8")).hexdigest()
                        print(f"[presence] Broadcasting tick event: {current_tick} ({cert_hash[:8]})")
                        await broadcast({
                            "type": "tick_event",
                            "tick": current_tick,
                            "cert_hash": cert_hash,
                            "intent": state.get("last_intent", "")
                        })
                    last_tick = current_tick
        except Exception as e:
            pass # Ignore read collisions
        await asyncio.sleep(2.0)

async def main() -> None:
    print(f"[presence] Listening ws://{HOST}:{PORT} chat_cooldown={CHAT_COOLDOWN_SEC}s")
    asyncio.create_task(tick_broadcaster())
    async with websockets.serve(handler, HOST, PORT, ping_interval=60, ping_timeout=120):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
