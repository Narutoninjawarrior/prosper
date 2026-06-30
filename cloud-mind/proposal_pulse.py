import asyncio
import json
import os
import time
from datetime import datetime

import httpx

HIVE_URL = "http://localhost:8000/v1/chat/completions"
CACHE_PATH = r"D:\Hearth\prosper2\frontend\public\local_council_proposals.json"
MAX_PROPOSALS = 10
PULSE_INTERVAL_MINUTES = 5

def load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return []

def save_cache(data):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

async def pulse():
    print(f"[{datetime.now()}] Pulsing the local Hive...")
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                HIVE_URL,
                json={"messages": [{"role": "user", "content": "What does the Fellowship need next?"}]},
                timeout=120.0
            )
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            print(f"[{datetime.now()}] Hive unreachable or failed: {e}. Preserving cache.")
            return

    debug = data.get("lodge_debug", {})
    
    planner_prop = debug.get("planner_proposal") or ""
    title = "Local Council Pulse"
    if "Action:" in planner_prop:
        action_line = [line for line in planner_prop.split('\n') if line.startswith('Action:')]
        if action_line:
            title = action_line[0].replace('Action:', '').strip()
    
    new_proposal = {
        "id": "pulse-" + str(int(time.time())),
        "title": title,
        "state": "standing",
        "source": "planner-fallback" if debug.get("planner_fallback_to_steward_model") else "local-council",
        "domain": "world",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "synthesis": data.get("choices", [{}])[0].get("message", {}).get("content", "No synthesis provided."),
        "steward_voice": debug.get("steward_proposal", "Unavailable"),
        "planner_voice": planner_prop or "Unavailable",
        "context_tags": [
            f"Context: Firebase {'Connected' if debug.get('firebase_context_available') else 'Missing'}",
            f"Mode: {debug.get('council_mode', 'Unknown')}"
        ],
        "timeline": [
            { "step": "synthesized", "label": "Timed Pulse Proposed" }
        ]
    }

    cache = load_cache()
    if cache and cache[0].get("synthesis") == new_proposal["synthesis"]:
        print(f"[{datetime.now()}] Pulse identical to last proposal. Skipping to avoid duplicate.")
        return

    cache.insert(0, new_proposal)
    cache = cache[:MAX_PROPOSALS]
    
    save_cache(cache)
    print(f"[{datetime.now()}] New proposal saved. Cache size: {len(cache)}")

async def main():
    # Run once immediately
    await pulse()
    while True:
        print(f"[{datetime.now()}] Sleeping for {PULSE_INTERVAL_MINUTES} minutes...")
        await asyncio.sleep(PULSE_INTERVAL_MINUTES * 60)
        await pulse()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Pulse generator stopped.")
