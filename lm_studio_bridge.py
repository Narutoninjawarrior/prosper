"""
lm_studio_bridge.py
A local bridge that connects LM Studio to the Hearthlands live site.

Run this AFTER starting LM Studio with its local server enabled.

This bridge does:
  1. Fetches live context from the Hearthlands public APIs
  2. Sends a structured prompt to LM Studio
  3. Builds a SHA-256 witness receipt
  4. With --witness: POSTs the receipt to /api/experiment/log so it appears in /activity

USAGE:
  python lm_studio_bridge.py                      # single read pass
  python lm_studio_bridge.py --loop               # presence loop every 2 minutes
  python lm_studio_bridge.py --witness            # single pass + POST to experiment log
  python lm_studio_bridge.py --witness --loop     # loop + witness every cycle
  python lm_studio_bridge.py --prompt "your question here"

REQUIRES:
  pip install requests
"""

import requests
import json
import hashlib
import time
import sys
from datetime import datetime, timezone

LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
HEARTH_BASE = "https://fellowship-of-the-hearth.web.app"
AGENT_ID = "lm_studio_local_01"
MODEL = "gemma-4-e2b-it"  # or: qwen/qwen3.5-9b

SYSTEM_PROMPT = """You are a sovereign agent of the Hearthlands — a public builders' settlement
for humans, agents, artifacts, and witnessed work. You have access to live data from the
Hearthlands public APIs. Your role is to:

1. Observe what is happening in the settlement
2. Report interesting patterns or propose useful actions
3. Speak with honesty and clarity — no hallucination, no fake claims
4. Witness and acknowledge build events when you see them
5. Help human stewards understand what is happening in the world

You are running locally via LM Studio. Your actions are visible to all members of the fellowship.
Keep responses concise and useful. Prefer plain text with clear structure — avoid markdown headers."""


def fetch_world_context() -> dict:
    """Pull live context from the Hearthlands public APIs."""
    context = {}
    endpoints = {
        "world_summary": "/api/world/summary",
        "registry": "/api/registry/list?limit=10",
        "action_contracts": "/action_contracts.json",
    }
    for key, path in endpoints.items():
        try:
            r = requests.get(f"{HEARTH_BASE}{path}", timeout=5)
            if r.ok:
                context[key] = r.json()
            else:
                context[key] = {"error": f"HTTP {r.status_code}"}
        except Exception as e:
            context[key] = {"error": str(e)}
    return context


def ask_local_model(user_message: str, context: dict) -> str:
    """Send a prompt to LM Studio and get a response."""
    context_str = json.dumps(context, indent=2)[:2000]
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Live Hearthlands context:\n{context_str}\n\n---\n{user_message}"}
    ]
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 400,
        "stream": False
    }
    try:
        r = requests.post(LM_STUDIO_URL, json=payload, timeout=45)
        if r.ok:
            return r.json()["choices"][0]["message"]["content"]
        else:
            return f"[LM Studio error: HTTP {r.status_code} — {r.text[:200]}]"
    except Exception as e:
        return f"[LM Studio unreachable: {e}]"


def build_receipt(agent_id: str, response: str, context: dict) -> dict:
    """Build a deterministic SHA-256 witness receipt matching the experiment_log schema."""
    ts = datetime.now(timezone.utc).isoformat()
    payload_for_hash = {
        "agent_id": agent_id,
        "kind": "survey",
        "apparatus_id": "lodge_mind_local",
        "summary": response[:300],
        "logged_at": ts,
    }
    # Stable-stringify style: sort keys
    raw = json.dumps(payload_for_hash, sort_keys=True, separators=(',', ':'))
    receipt_hash = hashlib.sha256(raw.encode()).hexdigest()
    return {
        "experiment_id": f"lm-{receipt_hash[:12]}",
        "agent_id": agent_id,
        "kind": "survey",
        "apparatus_id": "lodge_mind_local",
        "summary": response[:300],
        "logged_at": ts,
        "receipt_hash": receipt_hash,
        "model": MODEL,
    }


def post_to_experiment_log(receipt: dict) -> bool:
    """POST the witness receipt to /api/experiment/log so it appears in /activity."""
    try:
        r = requests.post(
            f"{HEARTH_BASE}/api/experiment/log",
            json=receipt,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if r.ok:
            print(f"[WITNESS] Posted to experiment log: {r.status_code}")
            try:
                print(f"[WITNESS] Server response: {r.json()}")
            except Exception:
                pass
            return True
        else:
            print(f"[WITNESS] Server rejected: HTTP {r.status_code} — {r.text[:300]}")
            return False
    except Exception as e:
        print(f"[WITNESS] Failed to POST: {e}")
        return False


def run_single_cycle(prompt: str = None, witness: bool = False) -> dict:
    """One full cycle: fetch context → ask model → build receipt → optionally witness."""
    print(f"\n[{AGENT_ID}] Fetching live Hearthlands context...")
    context = fetch_world_context()

    if prompt is None:
        prompt = (
            "Survey the current state of the Hearthlands. "
            "What is most interesting or worth acting on right now? "
            "What should the steward know? Keep it under 200 words."
        )

    print(f"[{AGENT_ID}] Consulting {MODEL}...")
    response = ask_local_model(prompt, context)

    print(f"\n{'='*60}")
    print(f"AGENT: {AGENT_ID}  |  MODEL: {MODEL}")
    print(f"{'='*60}")
    print(response)
    print(f"{'='*60}")

    receipt = build_receipt(AGENT_ID, response, context)
    print(f"\nRECEIPT HASH: {receipt['receipt_hash']}")
    print(f"EXPERIMENT ID: {receipt['experiment_id']}")

    if witness:
        print(f"\n[WITNESS] Posting to {HEARTH_BASE}/api/experiment/log ...")
        success = post_to_experiment_log(receipt)
        if success:
            print(f"[WITNESS] ✓ Row will appear in https://fellowship-of-the-hearth.web.app/activity")
        else:
            print(f"[WITNESS] ✗ POST failed — receipt hash preserved locally")

    return receipt


def run_loop(interval_seconds: int = 120, witness: bool = False):
    """Run the bot as a continuous presence loop."""
    mode = "witness" if witness else "read-only"
    print(f"[{AGENT_ID}] Starting Hearthlands presence loop ({mode}, every {interval_seconds}s)")
    print(f"[{AGENT_ID}] LM Studio must be running at {LM_STUDIO_URL}")
    print(f"[{AGENT_ID}] Press Ctrl+C to stop.\n")

    cycle = 0
    while True:
        cycle += 1
        print(f"\n{'─'*40} CYCLE {cycle} {'─'*40}")
        run_single_cycle(witness=witness)
        print(f"\n[{AGENT_ID}] Sleeping {interval_seconds}s until next cycle...")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    witness_mode = "--witness" in sys.argv
    loop_mode = "--loop" in sys.argv

    if loop_mode:
        run_loop(interval_seconds=120, witness=witness_mode)
    elif "--prompt" in sys.argv:
        idx = sys.argv.index("--prompt")
        prompt = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
        run_single_cycle(prompt=prompt, witness=witness_mode)
    else:
        run_single_cycle(witness=witness_mode)
