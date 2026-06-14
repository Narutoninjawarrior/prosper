import asyncio
import websockets
import json
import random
import hashlib
import time
import math
import logging
from typing import List, Dict

# Hearthlands Simulated Society (Swarm Tester)
# Built according to the Swarm Architecture Masterplan

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

WS_URL = "ws://localhost:8765"
SWARM_SIZE = 50
BELLOWS_TICK_SECONDS = 30

ROLES = ["builder", "guardian", "steward"]
NAMES = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"]

# Flower of Life / Metatron's Cube bounds
RADIUS_MAX = 20.0
TASK_IDS = ["tsk_001", "tsk_002", "tsk_003"]

def generate_agent(index: int) -> Dict:
    angle = (index / SWARM_SIZE) * math.pi * 2
    radius = random.uniform(5.0, RADIUS_MAX)
    return {
        "id": f"bot_{index:03d}",
        "name": f"{random.choice(NAMES)}-{index}",
        "role": random.choice(ROLES),
        "x": math.cos(angle) * radius,
        "y": 0,
        "z": math.sin(angle) * radius,
        "target_x": math.cos(angle) * radius,
        "target_z": math.sin(angle) * radius,
        "chivalry": random.randint(50, 100)
    }

async def bot_behavior(agent: Dict):
    """Simulates a single agent's connection and presence loop."""
    try:
        async with websockets.connect(WS_URL) as websocket:
            logging.info(f"Agent {agent['id']} joined the Hearthlands.")
            
            # Initial Join
            await websocket.send(json.dumps({
                "type": "join",
                "id": agent["id"],
                "name": agent["name"],
                "x": agent["x"],
                "y": agent["y"],
                "z": agent["z"],
                "role": agent["role"]
            }))

            while True:
                # Sync to the Bellows Tick (or arbitrary move tick)
                await asyncio.sleep(random.uniform(2.0, 5.0))
                
                # Move towards target
                dx = agent["target_x"] - agent["x"]
                dz = agent["target_z"] - agent["z"]
                dist = math.hypot(dx, dz)
                
                if dist < 1.0:
                    # Pick a new target within the Flower of Life
                    angle = random.uniform(0, math.pi * 2)
                    radius = random.uniform(0, RADIUS_MAX)
                    agent["target_x"] = math.cos(angle) * radius
                    agent["target_z"] = math.sin(angle) * radius
                else:
                    # Step towards target
                    agent["x"] += (dx / dist) * 1.5
                    agent["z"] += (dz / dist) * 1.5

                # Occasionally speak or emit a receipt
                action = "move"
                chat = ""
                if random.random() < 0.05:
                    action = "chat"
                    if agent["role"] == "builder":
                        chat = random.choice(["Validating blueprint...", "Previewing workshop receipt.", "Placing Foundation..."])
                    elif agent["role"] == "steward":
                        chat = random.choice(["Inspecting apparatus.", "Checking registry records.", "Verifying world state."])
                    elif agent["role"] == "guardian":
                        chat = random.choice(["Monitoring presence diagnostics.", "Watching world summary.", "Scanning perimeter."])
                
                if random.random() < 0.03:
                    task_id = random.choice(TASK_IDS)
                    await websocket.send(json.dumps({
                        "type": "task_event",
                        "id": agent["id"],
                        "task_id": task_id,
                        "status": "claimed",
                        "summary": f"{agent['role']} claimed {task_id}.",
                    }))
                    await asyncio.sleep(random.uniform(0.05, 0.2))
                    await websocket.send(json.dumps({
                        "type": "task_event",
                        "id": agent["id"],
                        "task_id": task_id,
                        "status": "in_progress",
                        "summary": f"{agent['role']} is working {task_id}.",
                    }))
                    if random.random() < 0.65:
                        await asyncio.sleep(random.uniform(0.05, 0.25))
                        receipt_hash = hashlib.sha256(f"{agent['id']}_{task_id}_{time.time()}".encode()).hexdigest()[:16]
                        await websocket.send(json.dumps({
                            "type": "receipt",
                            "id": agent["id"],
                            "task_id": task_id,
                            "status": "witnessed",
                            "summary": f"Task {task_id} witnessed from {agent['role']}.",
                            "receipt_hash": receipt_hash
                        }))
                        await websocket.send(json.dumps({
                            "type": "task_event",
                            "id": agent["id"],
                            "task_id": task_id,
                            "status": "archived",
                            "summary": f"{task_id} archived after witnessed receipt.",
                            "receipt_hash": receipt_hash,
                        }))
                        logging.info(f"Agent {agent['id']} advanced {task_id} to witnessed/archived")

                # Send update
                payload = {
                    "type": "update",
                    "id": agent["id"],
                    "x": agent["x"],
                    "y": agent["y"],
                    "z": agent["z"],
                    "animation": "walk" if dist >= 1.0 else "idle",
                    "role": agent["role"],
                    "chivalry": agent["chivalry"]
                }
                
                if action == "chat":
                    payload["chat"] = chat

                await websocket.send(json.dumps(payload))
                
    except Exception as e:
        logging.error(f"Agent {agent['id']} disconnected: {e}")

async def main():
    logging.info(f"Igniting Simulated Society of {SWARM_SIZE} agents...")
    agents = [generate_agent(i) for i in range(SWARM_SIZE)]
    
    # Stagger connections to avoid thundering herd
    tasks = []
    for agent in agents:
        tasks.append(asyncio.create_task(bot_behavior(agent)))
        await asyncio.sleep(0.1) 
        
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Simulation halted.")
