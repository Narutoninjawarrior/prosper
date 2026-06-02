"""
cognitive_sync.py — Hardened Semantic Event Bridge
Local-first. Runs on 127.0.0.1:8765 only.

Install:
    pip install fastapi uvicorn slowapi pydantic

Run:
    TRAINER_SECRET=your-secret uvicorn cognitive_sync:app --host 127.0.0.1 --port 8765

The browser sends SIGNED semantic events (trainer.node_place, trainer.agent_move,
trainer.harvest). Raw keypresses are NEVER forwarded. Events are HMAC-verified,
rate-limited, validated, and written to hearth_data.json for the local Qwen Oracle.
The Oracle polls hearth_data.json and sends movement commands back via GET /commands.
"""

import hmac
import hashlib
import json
import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ─── Config ───────────────────────────────────────────────────────────────────
TRAINER_SECRET  = os.environ.get("TRAINER_SECRET", "dev-secret-change-me")
HEARTH_DATA     = Path(os.environ.get("HEARTH_DATA", r"D:\Hearth\prosper2\hearth_data.json"))
COMMANDS_FILE   = Path(os.environ.get("COMMANDS_FILE", r"D:\Hearth\prosper2\oracle_commands.json"))
RING_BUFFER_MAX = 200   # max trainer events kept in hearth_data.json
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",    # Electron production
    # Add Firebase hosting URL if you need remote access:
    # "https://fellowship-of-the-hearth.web.app",
]

ALLOWED_EVENT_TYPES = {
    "trainer.node_place",
    "trainer.agent_move",
    "trainer.harvest",
}

# ─── Rate limiting ─────────────────────────────────────────────────────────────
# Per-IP: 60 events per minute total. Per event-type: enforced in handler.
limiter = Limiter(key_func=get_remote_address)
app     = FastAPI(title="Hearthlands Cognitive Sync", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,   # localhost ONLY
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Trainer-Sig"],
)

# ─── Per-event-type rate limiter (in-process) ──────────────────────────────────
_event_timestamps: Dict[str, deque] = defaultdict(lambda: deque(maxlen=30))
EVENT_RATE: Dict[str, tuple[int, int]] = {
    "trainer.node_place":  (5,  10),   # max 5 per 10s
    "trainer.agent_move":  (20, 10),   # max 20 per 10s
    "trainer.harvest":     (2,  30),   # max 2 per 30s
}

def check_event_rate(event_type: str) -> bool:
    """Returns True if the event should be dropped (rate exceeded)."""
    max_count, window_s = EVENT_RATE.get(event_type, (10, 10))
    now     = time.time()
    bucket  = _event_timestamps[event_type]
    # Prune old timestamps
    while bucket and now - bucket[0] > window_s:
        bucket.popleft()
    if len(bucket) >= max_count:
        return True
    bucket.append(now)
    return False


# ─── Schemas ──────────────────────────────────────────────────────────────────
class TrainerEvent(BaseModel):
    event_type: str
    grid_x:     int
    grid_y:     int
    agent_id:   str
    timestamp:  int
    metadata:   Optional[Dict[str, Any]] = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in ALLOWED_EVENT_TYPES:
            raise ValueError(f"Unknown event type: {v!r}. Allowed: {ALLOWED_EVENT_TYPES}")
        return v

    @field_validator("grid_x", "grid_y")
    @classmethod
    def validate_grid(cls, v: int) -> int:
        if not 0 <= v <= 9:
            raise ValueError("Grid coordinates must be 0–9")
        return v

    @field_validator("agent_id")
    @classmethod
    def validate_agent_id(cls, v: str) -> str:
        allowed = {"human", "solis", "prosper2", "ember", "codex"}
        if v not in allowed:
            raise ValueError(f"Unknown agent_id: {v!r}")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: int) -> int:
        drift = abs(time.time() * 1000 - v)
        if drift > 30_000:   # reject events > 30s old or from the future
            raise ValueError(f"Timestamp drift too large: {drift:.0f}ms")
        return v


# ─── HMAC verification ────────────────────────────────────────────────────────
def verify_hmac(event: TrainerEvent, sig_hex: str) -> bool:
    canonical = f"{event.event_type}:{event.grid_x}:{event.grid_y}:{event.agent_id}:{event.timestamp}"
    expected  = hmac.new(
        TRAINER_SECRET.encode(),
        canonical.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, sig_hex)


# ─── Hearth data I/O ──────────────────────────────────────────────────────────
def load_hearth() -> dict:
    if HEARTH_DATA.exists():
        try:
            return json.loads(HEARTH_DATA.read_text("utf-8"))
        except Exception:
            pass
    return {}


def save_hearth(data: dict) -> None:
    HEARTH_DATA.parent.mkdir(parents=True, exist_ok=True)
    HEARTH_DATA.write_text(json.dumps(data, indent=2), "utf-8")


# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.post("/emit")
@limiter.limit("60/minute")
async def emit_event(event: TrainerEvent, request: Request):
    """Receive a signed semantic event from the Phaser game."""
    # 1. HMAC check
    sig = request.headers.get("X-Trainer-Sig", "")
    if not sig or not verify_hmac(event, sig):
        raise HTTPException(status_code=403, detail="HMAC signature invalid")

    # 2. Per-event-type rate check
    if check_event_rate(event.event_type):
        raise HTTPException(status_code=429, detail=f"Rate limit for {event.event_type!r}")

    # 3. Write to hearth_data.json ring buffer
    data = load_hearth()
    bucket = data.setdefault("trainer_events", [])
    bucket.append({
        **event.model_dump(),
        "received_at": time.time(),
    })
    # Keep ring buffer bounded
    if len(bucket) > RING_BUFFER_MAX:
        data["trainer_events"] = bucket[-RING_BUFFER_MAX:]

    # Update live grid state for Oracle
    grid = data.setdefault("grid_state", {})
    if event.event_type == "trainer.node_place":
        grid[f"{event.grid_x},{event.grid_y}"] = {
            "type": "node", "placed_by": event.agent_id, "ts": event.timestamp
        }
    elif event.event_type == "trainer.agent_move":
        data.setdefault("agent_positions", {})[event.agent_id] = {
            "x": event.grid_x, "y": event.grid_y, "ts": event.timestamp
        }

    save_hearth(data)
    return {"status": "ok", "event": event.event_type}


@app.get("/commands")
async def get_commands():
    """
    Polled by the Phaser game every 500ms to receive Oracle movement commands.
    The local Qwen agent writes to oracle_commands.json after reading hearth_data.json.
    Commands are consumed (deleted) after delivery.
    """
    if not COMMANDS_FILE.exists():
        return {"commands": []}
    try:
        commands = json.loads(COMMANDS_FILE.read_text("utf-8"))
        COMMANDS_FILE.unlink(missing_ok=True)   # consume
        return {"commands": commands}
    except Exception:
        return {"commands": []}


@app.get("/health")
async def health():
    return {
        "status":   "running",
        "time":     time.time(),
        "hearth":   HEARTH_DATA.exists(),
        "doctrine": "Browser observes. Oracle acts. Forge witnesses.",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
