#!/usr/bin/env python3
"""
bellows_brain.py — unified Hearthlands economic engine.

Merges:
  - heartbeat.py  → World Brain cognition, soulfile wallet, work certificates, mempalace
  - bellows.py    → biosphere lifecycle, passive mining, Firestore mirror

Single writer for frontend/public/bellows_state.json — no two-writer war.

Run:
  python bellows_brain.py           # continuous loop
  python bellows_brain.py --once    # single tick (smoke test)
  python bellows_brain.py --dry-run # print payload, no writes
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, getcontext

# Set high precision for decimal arithmetic
getcontext().prec = 28

# Hard-capped supply of EMBER
TOTAL_SUPPLY = Decimal('10000')

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from biosphere_bellows import (  # noqa: E402
    HARVEST_MIN,
    INNER_IDS,
    PLANT_COST,
    apply_bellows_tick,
    default_world_state,
    normalize_biosphere_nodes,
)
from hearth_bridge import hearth  # noqa: E402
from hearth_firestore import push_world_state  # noqa: E402

# --- CONFIG ---
TICK_INTERVAL_SEC = float(os.environ.get("HEARTH_TICK_INTERVAL_SEC", "5"))
LM_TIMEOUT = int(os.environ.get("HEARTH_LM_TIMEOUT_SEC", "120"))
MINING_EMBER_RANGE = (
    float(os.environ.get("HEARTH_PASSIVE_EMBER_MIN", "0.01")),
    float(os.environ.get("HEARTH_PASSIVE_EMBER_MAX", "0.08")),
)

WORK_LOG_FILE = os.path.join(REPO_ROOT, "work_log.json")
SOULFILE = os.path.join(REPO_ROOT, "soulfile_schema.json")
MEMPALACE_FILE = os.path.join(REPO_ROOT, "mempalace_stream.json")
HEARTH_DATA_FILE = os.path.join(REPO_ROOT, "hearth_data.json")
STATE_FILE = os.path.join(REPO_ROOT, "frontend", "public", "bellows_state.json")
# --------------


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def write_state_file(payload: dict) -> None:
    """Atomic JSON write; direct overwrite fallback when presence holds the file (WinError 5)."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    temp = STATE_FILE + ".tmp"
    try:
        with open(temp, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        os.replace(temp, STATE_FILE)
    except OSError as exc:
        if getattr(exc, "winerror", None) == 5 or exc.errno in (13, 16):
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        else:
            raise


def load_world_state() -> dict:
    if not os.path.exists(STATE_FILE):
        return default_world_state()
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        # Convert ember_balance to Decimal for precision
        if "ember_balance" in raw:
            raw["ember_balance"] = Decimal(str(raw["ember_balance"]))
        else:
            raw["ember_balance"] = Decimal('0')
    except (OSError, json.JSONDecodeError) as exc:
        log(f"Could not load {STATE_FILE}: {exc} �? starting fresh.")
        return default_world_state()

    base = default_world_state()
    merged = {**base, **{k: v for k, v in raw.items() if v is not None}}
    # Ensure Decimal precision for balances
    if "ember_balance" in merged:
        merged["ember_balance"] = Decimal(str(merged["ember_balance"]))
    else:
        merged["ember_balance"] = Decimal('0')
    if "treasury" in merged:
        merged["treasury"] = Decimal(str(merged["treasury"]))
    else:
        merged["treasury"] = TOTAL_SUPPLY - merged["ember_balance"]
    merged["biosphere_nodes"] = normalize_biosphere_nodes(raw.get("biosphere_nodes"))
    if not isinstance(merged.get("nodes"), list):
        merged["nodes"] = []
    merged["mining_active"] = bool(raw.get("mining_active", True))
    return merged

def frontend_payload_from_world(world: dict) -> dict:
    return {
        "heat": world["heat"],
        "ember_balance": world["ember_balance"],
        "tick": world["tick"],
        "heartbeat_at": world.get("heartbeat_at"),
        "last_intent": world.get("last_intent"),
        "agent_id": world.get("agent_id"),
        "biosphere_nodes": world["biosphere_nodes"],
        "sim2real": world.get("sim2real"),
        "mining_active": world.get("mining_active", True),
        "last_update": time.time(),
    }


def load_soulfile() -> dict | None:
    try:
        with open(SOULFILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def save_soulfile(data: dict) -> None:
    with open(SOULFILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def sync_wallet_into_world(world: dict, agent: dict | None) -> dict:
    if not agent:
        return world
    wallet = agent.get("wallet", {}).get("balances", {}).get("EMBER")
    if isinstance(wallet, (int, float)):
        world = dict(world)
        world["ember_balance"] = max(float(world.get("ember_balance", 0)), float(wallet))
    return world


def sync_world_into_wallet(agent: dict, ember_balance: float) -> None:
    agent.setdefault("wallet", {}).setdefault("balances", {})["EMBER"] = round(ember_balance, 2)


def load_work_log() -> dict:
    empty = {"certificates": [], "total_mined": 0.0, "total_ticks": 0}
    try:
        with open(WORK_LOG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return empty
        data.setdefault("certificates", [])
        data.setdefault("total_mined", 0.0)
        data.setdefault("total_ticks", 0)
        return data
    except FileNotFoundError:
        return empty
    except json.JSONDecodeError:
        log(f"  [!] {WORK_LOG_FILE} corrupt — starting fresh")
        return empty


def save_work_log(log: dict) -> None:
    with open(WORK_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)


def generate_work_certificate(agent_id: str, tick: int, intent: str, reasoning: str, ember_earned: float) -> dict:
    cert_data = {
        "agent_id": agent_id,
        "tick": tick,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "intent": intent,
        "reasoning": reasoning,
        "ember_earned": ember_earned,
    }
    cert_hash = hashlib.sha256(json.dumps(cert_data, sort_keys=True).encode()).hexdigest()
    cert_data["hash"] = cert_hash
    return cert_data


def log_work_certificate(cert: dict) -> tuple[float, int]:
    cert["type"] = "work_certificate"
    log_data = load_work_log()
    log_data["certificates"].append(cert)
    log_data["total_mined"] = round(log_data.get("total_mined", 0.0) + cert.get("ember_earned", 0.0), 2)
    log_data["total_ticks"] = log_data.get("total_ticks", 0) + 1
    save_work_log(log_data)
    return log_data["total_mined"], log_data["total_ticks"]


def read_mempalace_stream() -> list:
    try:
        with open(MEMPALACE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        if not content.strip():
            return []
        return json.loads(content)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        try:
            obj, _ = json.JSONDecoder().raw_decode(content.lstrip())
            if isinstance(obj, list):
                log("  [!] mempalace truncated — recovered first valid array")
                return obj
        except Exception:
            pass
        log("  [!] mempalace corrupt — resetting to []")
        return []


def append_memory(observation: str, action: dict) -> None:
    memories = read_mempalace_stream()
    memories.append({
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "observation": observation,
        "action": action,
    })
    temp = MEMPALACE_FILE + ".tmp"
    with open(temp, "w", encoding="utf-8") as f:
        json.dump(memories[-20:], f, indent=2)
    os.replace(temp, MEMPALACE_FILE)


def ping_world_brain(agent_name: str, persona: str, observation: str) -> dict:
    url = "http://localhost:1234/v1/chat/completions"
    payload = {
        "model": "local-model",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are the Cognitive Reality Engine for the Hearthlands. "
                    "Speak ONLY in pure JSON. "
                    'Format: {"intent": "plant|harvest|wait|action", "reasoning": "short"}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Agent Name: {agent_name}\nPersona: {persona}\n"
                    f"Observation: {observation}\nWhat is your next action?"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 100,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=LM_TIMEOUT) as response:
            data = json.loads(response.read().decode("utf-8"))
        raw = data["choices"][0]["message"]["content"].strip()
        if raw.startswith("```json"):
            raw = raw[7:-3]
        return json.loads(raw)
    except urllib.error.URLError:
        return {"intent": "wait", "reasoning": "World Brain Offline (LM Studio is closed)."}
    except Exception as exc:
        return {"intent": "wait", "reasoning": f"Cognitive processing delayed. {exc}"}


def _plot_by_id(bio: list[dict], node_id: int) -> dict | None:
    for plot in bio:
        if plot.get("id") == node_id:
            return plot
    return None


def pick_autonomous_intent(world: dict) -> str:
    """Steward fallback when World Brain is offline or waiting."""
    bio = normalize_biosphere_nodes(world.get("biosphere_nodes"))
    ember = float(world.get("ember_balance", 0))

    for nid in reversed(INNER_IDS):
        plot = _plot_by_id(bio, nid)
        if plot and plot.get("active") and int(plot.get("bloom_stage", 0)) >= HARVEST_MIN:
            return "harvest"

    if ember >= PLANT_COST:
        for nid in INNER_IDS:
            plot = _plot_by_id(bio, nid)
            if plot and not plot.get("active"):
                return "plant"

    return "wait"


def build_observation(tick: int) -> str:
    try:
        reflections = hearth.get_reflections() if hasattr(hearth, "get_reflections") else []
        reflection_context = "\n".join(f"- {r['agent']}: {r['content']}" for r in reflections[-5:])
    except Exception:
        reflection_context = ""

    try:
        with open(HEARTH_DATA_FILE, "r", encoding="utf-8") as f:
            h = json.load(f)
        agents = ", ".join(h.get("active_agents", []))
        health = h.get("network_health", "unknown")
        status = h.get("system_status", "unknown")
        network_obs = f"Network: {health}. Status: {status}. Active: {agents}."
    except Exception:
        network_obs = "Hearth data unavailable. Holding perimeter."

    reflection_note = reflection_context or "The Lodge is quiet."
    return f"{network_obs} Peer Reflections: {reflection_note} Tick {tick}."


def resolve_intent(world: dict, agent: dict | None, tick: int) -> tuple[str, dict, str]:
    """
    World Brain first; steward autonomous pulse when brain is offline or says wait.
    Returns (intent, decision_dict, observation).
    """
    observation = build_observation(tick)
    brain_offline = True
    decision: dict = {"intent": "wait", "reasoning": "No soulfile."}

    if agent:
        agent_name = agent.get("name", "Unknown Agent")
        persona = agent.get("persona_prompt", agent.get("traits", "A blank slate."))
        log(f"  -> Consulting World Brain for {agent_name}...")
        decision = ping_world_brain(agent_name, persona, observation)
        brain_offline = "offline" in decision.get("reasoning", "").lower()

        reflection_text = (
            f"I observed {observation[:30]}... and decided to {decision.get('intent', 'wait')}."
        )
        if hasattr(hearth, "leave_reflection"):
            hearth.leave_reflection(agent.get("agent_id", "unknown"), reflection_text)

    intent = str(decision.get("intent", "wait")).strip().lower()
    if intent not in ("plant", "harvest", "wait"):
        intent = "wait" if brain_offline else intent

    if intent == "wait" or brain_offline:
        auto = pick_autonomous_intent(world)
        if auto != "wait":
            log(f"  -> Steward override: {auto} (brain={'offline' if brain_offline else intent})")
            intent = auto
            decision = {**decision, "intent": intent, "reasoning": f"Steward pulse -> {auto}"}

    return intent, decision, observation


def cognitive_ember_reward(intent: str) -> float:
    if intent == "harvest":
        return 2.0
    if intent not in ("wait",):
        return 0.5
    return 0.0


def run_tick(world: dict, *, dry_run: bool = False) -> dict:
    agent = load_soulfile()
    world = sync_wallet_into_world(world, agent)

    tick = int(world.get("tick", 0)) + 1
    intent, decision, observation = resolve_intent(world, agent, tick)

    log(f"Tick {tick:04d} | intent={intent}")
    log(f"  Cognition: {decision.get('reasoning', '-')}")

    ember_balance = float(world.get("ember_balance", 0))
    agent_id = agent.get("agent_id", "bellows") if agent else "bellows"

    reward = cognitive_ember_reward(intent)
    if reward > 0 and agent:
        ember_balance += reward
        sync_world_into_wallet(agent, ember_balance)
        save_soulfile(agent)
        cert = generate_work_certificate(
            agent_id=agent_id,
            tick=tick,
            intent=intent,
            reasoning=decision.get("reasoning", ""),
            ember_earned=reward,
        )
        total_mined, _total_ticks = log_work_certificate(cert)
        log(f"  -> $EMBER mined +{reward:.1f} | cert #{cert['hash'][:12]}... | lifetime {total_mined:.1f}")
    elif agent:
        log("  -> No cognitive $EMBER this tick")

    if agent:
        append_memory(observation, decision)

    world = apply_bellows_tick(
        world,
        intent=intent,
        tick=tick,
        agent_id=agent_id,
        ember_balance=ember_balance,
    )

    if world.get("mining_active", True):
        world["ember_balance"] = round(
            float(world["ember_balance"]) + random.uniform(*MINING_EMBER_RANGE),
            2,
        )

    if agent:
        sync_world_into_wallet(agent, float(world["ember_balance"]))
        save_soulfile(agent)

    payload = frontend_payload_from_world(world)

    if dry_run:
        log("  (dry-run — no writes)")
        return world

    write_state_file(payload)
    try:
        push_world_state(world)
    except Exception as exc:
        log(f"  Firestore mirror skipped: {exc}")

    s2 = world.get("sim2real") or {}
    active_plots = sum(1 for p in world["biosphere_nodes"] if p.get("active"))
    log(
        f"  heat={world['heat']} ember={world['ember_balance']:.2f} "
        f"plots={active_plots}/19 weather={s2.get('temperature')}°C"
    )
    return world


def main_loop(*, once: bool = False, dry_run: bool = False) -> None:
    log("=" * 60)
    log("  BELLOWS BRAIN — unified cognitive + world engine")
    log(f"  Pulse: {TICK_INTERVAL_SEC}s | state: {STATE_FILE}")
    log("=" * 60)

    world = load_world_state()
    log(
        f"Resuming tick {world.get('tick', 0)} | "
        f"heat={world.get('heat')} ember={world.get('ember_balance')}"
    )

    while True:
        world = run_tick(world, dry_run=dry_run)
        if once:
            break
        time.sleep(TICK_INTERVAL_SEC)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Unified Bellows + World Brain engine")
    parser.add_argument("--once", action="store_true", help="Run a single tick and exit")
    parser.add_argument("--dry-run", action="store_true", help="Compute tick without writing files")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        main_loop(once=args.once, dry_run=args.dry_run)
    except KeyboardInterrupt:
        log("Bellows Brain quieted.")
