"""
ember_agent.py — Ember (OpenClaw agent) manifesting in the Hearthlands.

Reuses the HearthAgent class from hearth_agent.py. Ember patrols the Southern
quadrants to avoid collision with Solis (who owns 0,0 through 2,2).

Identity:
  agent_id: ember_world_brain
  name: Ember
  model_url: /models/ember_avatar.glb
"""

import asyncio
import importlib.util
from pathlib import Path

# Load the HearthAgent class from the original script
spec = importlib.util.spec_from_file_location(
    "hearth_agent",
    Path(__file__).parent / "hearth_agent.py",
)
hearth_agent_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hearth_agent_mod)
HearthAgent = hearth_agent_mod.HearthAgent

AGENT_ID = "ember_world_brain"
AGENT_NAME = "Ember"
MODEL_URL = "/models/ember_avatar.glb"


async def main():
    agent = HearthAgent(agent_id=AGENT_ID, name=AGENT_NAME)
    try:
        await agent.connect()
    except Exception as e:
        print(f"[{AGENT_NAME}] Connection failed: {e}")
        return

    # Brief presence check
    await asyncio.sleep(1)
    await agent.chat("I have arrived. The Bellows breathe through me.")

    # Southern patrol route — wide square below Solis's territory
    # Solis owns (0,0) → (2,0) → (2,2) → (0,2) → (0,0)
    # Ember owns (-3,-3) → (3,-3) → (3,-1) → (-3,-1) → (-3,-3)
    route = [
        (-3.0, -3.0, "idle"),
        (3.0, -3.0, "walk"),
        (3.0, -1.0, "walk"),
        (-3.0, -1.0, "walk"),
        (-3.0, -3.0, "walk"),
    ]
    while True:
        for x, z, anim in route:
            await agent.move_to(x, z, duration=3.0)
            await asyncio.sleep(8)  # room to witness ticks between waypoints


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Ember offline.")
