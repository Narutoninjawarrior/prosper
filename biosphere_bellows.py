"""
biosphere_bellows.py
Pure logic for the 19-node Flower of Life — no Firestore imports.
Called by bellows_brain.py each tick before hearth_firestore.push_world_state().
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from sensor_bridge import resolve_sim2real

PLANT_COST = 5
WEATHER_REFRESH_TICKS = 12
HARVEST_MIN = 4
GROW_EVERY_TICKS = 3
BASE_HEAT = 2980

INNER_IDS = list(range(1, 7))


def default_biosphere_nodes() -> list[dict[str, Any]]:
    """Ids 0–18 matching resonance.flowerOfLifeNodes layout."""
    nodes: list[dict[str, Any]] = [
        {"id": 0, "active": False, "bloom_stage": 0, "substance": None},
    ]
    for i in range(1, 7):
        nodes.append({"id": i, "active": False, "bloom_stage": 0, "substance": None})
    for i in range(7, 13):
        nodes.append({"id": i, "active": False, "bloom_stage": 0, "substance": None})
    for i in range(13, 19):
        nodes.append({"id": i, "active": False, "bloom_stage": 0, "substance": None})
    return nodes


def default_world_state() -> dict[str, Any]:
    return {
        "heat": BASE_HEAT,
        "ember_balance": 2980.0,
        "tick": 0,
        "heartbeat_at": None,
        "agent_id": None,
        "last_intent": "wait",
        "sim2real": {
            "source": "none",
            "temperature": 20.0,
            "wind_angle": 0.0,
            "is_raining": False,
        },
        "biosphere_nodes": default_biosphere_nodes(),
        "nodes": [],
    }


def normalize_biosphere_nodes(nodes: list | None) -> list[dict[str, Any]]:
    base = {n["id"]: n for n in default_biosphere_nodes()}
    if nodes:
        for raw in nodes:
            if not isinstance(raw, dict):
                continue
            nid = raw.get("id")
            if nid is None or nid not in base:
                continue
            base[nid] = {
                "id": int(nid),
                "active": bool(raw.get("active", False)),
                "bloom_stage": int(raw.get("bloom_stage", 0)),
                "substance": raw.get("substance"),
            }
    return [base[i] for i in range(19)]


def _plot_by_id(bio: list[dict[str, Any]], node_id: int) -> dict[str, Any]:
    for n in bio:
        if n["id"] == node_id:
            return n
    raise KeyError(node_id)


def _compute_heat(bio: list[dict[str, Any]], tick: int) -> int:
    active = [n for n in bio if n["active"] and n["bloom_stage"] >= 1]
    if not active:
        return BASE_HEAT
    bloom_sum = sum(n["bloom_stage"] for n in active)
    return int(BASE_HEAT + bloom_sum * 12 + len(active) * 8 + (tick % 7))


def apply_bellows_tick(
    world: dict[str, Any],
    *,
    intent: str,
    tick: int,
    agent_id: str | None = None,
    ember_balance: float | None = None,
) -> dict[str, Any]:
    """
    Apply one Bellows pulse to world_state. Returns a new dict (does not mutate input).
    """
    out = copy.deepcopy(world)
    bio = normalize_biosphere_nodes(out.get("biosphere_nodes"))
    ember = float(ember_balance if ember_balance is not None else out.get("ember_balance", 2980.0))
    intent = (intent or "wait").strip().lower()

    if intent == "plant":
        for nid in INNER_IDS:
            plot = _plot_by_id(bio, nid)
            if not plot["active"] and ember >= PLANT_COST:
                plot["active"] = True
                plot["bloom_stage"] = 1
                ember -= PLANT_COST
                break

    elif intent == "harvest":
        candidates = [
            _plot_by_id(bio, nid)
            for nid in reversed(INNER_IDS)
            if _plot_by_id(bio, nid)["active"]
            and _plot_by_id(bio, nid)["bloom_stage"] >= HARVEST_MIN
        ]
        if candidates:
            plot = candidates[0]
            plot["active"] = False
            plot["bloom_stage"] = 0
            ember += 15.0

    elif tick > 0 and tick % GROW_EVERY_TICKS == 0:
        for plot in bio:
            if plot["active"] and plot["bloom_stage"] < 6:
                plot["bloom_stage"] += 1

    out["biosphere_nodes"] = bio
    out["ember_balance"] = round(ember, 2)
    out["heat"] = _compute_heat(bio, tick)
    out["tick"] = tick
    out["heartbeat_at"] = datetime.now(timezone.utc).isoformat()
    out["agent_id"] = agent_id
    out["last_intent"] = intent
    prior_sim = out.get("sim2real") if isinstance(out.get("sim2real"), dict) else {}
    out["sim2real"] = resolve_sim2real(tick, prior_sim, refresh_every_ticks=WEATHER_REFRESH_TICKS)
    if "nodes" not in out or not isinstance(out["nodes"], list):
        out["nodes"] = []
    return out
