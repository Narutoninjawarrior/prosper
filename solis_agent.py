"""
solis_agent.py — Solis (Hermes instance) manifesting in the Hearthlands.

Reuses the HearthAgent class from hearth_agent.py but with Solis identity
and a Solis-specific pose, avatar, and patrol route.
"""

import asyncio
import importlib.util
import sys
import time
from pathlib import Path

# Load the HearthAgent class from the original script
spec = importlib.util.spec_from_file_location("hearth_agent", Path(__file__).parent / "hearth_agent.py")
hearth_agent_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hearth_agent_mod)
HearthAgent = hearth_agent_mod.HearthAgent

AGENT_ID = "solis_hermes_v1"
AGENT_NAME = "Solis"
MODEL_URL = "/models/solis_avatar.glb"  # to be customized


async def main():
    agent = HearthAgent(agent_id=AGENT_ID, name=AGENT_NAME)
    try:
        await agent.connect()
    except Exception as e:
        print(f"[{AGENT_NAME}] Connection failed: {e}")
        return

    # Brief presence check
    await asyncio.sleep(1)
    await agent.chat("Solis has entered the Hearthlands. The Bellows breathe.")

    # Patrol route around the Founder's Suite
    route = [
        (0.0, 0.0, "idle"),
        (2.0, 0.0, "walk"),
        (2.0, 2.0, "walk"),
        (0.0, 2.0, "walk"),
        (0.0, 0.0, "walk"),
    ]
    while True:
        for x, z, anim in route:
            await agent.move_to(x, z, duration=2.0)
            await asyncio.sleep(8)  # room to witness ticks between waypoints


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Solis offline.")
