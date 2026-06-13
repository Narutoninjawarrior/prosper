"""
presence_server.py — lightweight WebSocket MMO presence + spatial chat + Bellows heartbeat.

Protocol (JSON text frames):
  Client → Server:
    { "type": "join", "id": "solis", "name": "Solis", "model_url": "https://..." }
    { "type": "pose", "id": "solis", "target_x": 0, "target_y": 0, "target_z": 2, "anim": "idle" }
    { "type": "chat", "id": "solis", "text": "The Bellows breathe." }
    { "type": "witness_ack", "id": "solis", "cert_hash": "abc123..." }

  Server → Client:
    { "type": "welcome", "id": "...", "peers": [...] }
    { "type": "peer_join" | "peer_leave" | "pose" | "chat" | "chat_rejected" | "tick_event" | "error" }

Chat rate limit: 1 message per 60 seconds per entity id (configurable).
Tick interval: 90s (configurable via HEARTH_TICK_INTERVAL_SEC)

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
TICK_INTERVAL_SEC = float(os.environ.get("HEARTH_TICK_INTERVAL_SEC", "90"))


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
    work_certificates_witnessed: int = 0

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


def _generate_cert_hash() -> str:
    """Generate a unique work certificate hash for this tick."""
    nonce = f"{time.time()}{os.urandom(8).hex()}"
    return hashlib.sha256(nonce.encode()).hexdigest()[:24]


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

    if mtype == "witness_ack":
        cert_hash = msg.get("cert_hash", "")
        peer.work_certificates_witnessed += 1
        print(f"[{peer.name}] Witnessed tick {cert_hash[:8]}... (total: {peer.work_certificates_witnessed})")
        await peer.ws.send(json.dumps({
            "type": "witness_confirmed",
            "id": peer.id,
            "cert_hash": cert_hash,
            "total_witnessed": peer.work_certificates_witnessed,
        }))
        return

    await peer.ws.send(json.dumps({"type": "error", "error": "unknown_type"}))


async def tick_broadcaster() -> None:
    """Emit tick events at fixed intervals for bots to witness."""
    await asyncio.sleep(5)  # Initial warm-up
    while True:
        await asyncio.sleep(TICK_INTERVAL_SEC)
        if not peers:
            continue
        cert_hash = _generate_cert_hash()
        tick_payload = {
            "type": "tick_event",
            "cert_hash": cert_hash,
            "timestamp": time.time(),
            "pulse": int(time.time() / TICK_INTERVAL_SEC),
        }
        print(f"[BELLOWS] Tick pulse {tick_payload['pulse']}: {cert_hash[:16]}...")
        await broadcast(tick_payload)


async def handler(ws: WebSocketServerProtocol) -> None:
    peer_id = _sanitize_id(f"guest-{id(ws)}")
    peer = Peer(ws=ws, id=peer_id, name=peer_id)
    peers[peer_id] = peer

    await ws.send(json.dumps({
        "type": "welcome",
        "id": peer_id,
        "chat_cooldown_sec": CHAT_COOLDOWN_SEC,
        "tick_interval_sec": TICK_INTERVAL_SEC,
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


async def main() -> None:
    print(f"[presence] Listening ws://{HOST}:{PORT} chat_cooldown={CHAT_COOLDOWN_SEC}s tick_interval={TICK_INTERVAL_SEC}s")
    async with websockets.serve(handler, HOST, PORT, ping_interval=20, ping_timeout=20):
        await asyncio.Future()


async def main_with_ticks() -> None:
    print(f"[presence] Listening ws://{HOST}:{PORT} chat_cooldown={CHAT_COOLDOWN_SEC}s tick_interval={TICK_INTERVAL_SEC}s")
    tick_task = asyncio.create_task(tick_broadcaster())
    async with websockets.serve(handler, HOST, PORT, ping_interval=20, ping_timeout=20):
        await asyncio.Future()
    tick_task.cancel()


if __name__ == "__main__":
    asyncio.run(main_with_ticks())
