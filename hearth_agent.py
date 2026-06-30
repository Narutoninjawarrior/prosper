import asyncio
import websockets
import json
import time
import random
from dataclasses import dataclass

@dataclass
class Pose:
    x: float
    y: float
    z: float
    anim: str = "idle"

class HearthAgent:
    def __init__(self, agent_id: str, name: str, ws_url: str = "ws://localhost:8765"):
        self.agent_id = agent_id
        self.name = name
        self.ws_url = ws_url
        self.ws = None
        self.pose = Pose(x=0, y=0, z=0)
        self.connected = False
        
        # Internal state
        self.peers = {}
        self.last_tick = None
        self.work_certificates_witnessed = 0

    async def connect(self):
        print(f"[{self.name}] Connecting to Hearthlands Presence Server...")
        self.ws = await websockets.connect(self.ws_url)
        self.connected = True
        
        # Send join payload
        join_payload = {
            "type": "join",
            "id": self.agent_id,
            "name": self.name,
            "model_url": "https://vazxmixjsiawhamofees.supabase.co/store/models/robot/model.gltf",
            "target_x": self.pose.x,
            "target_y": self.pose.y,
            "target_z": self.pose.z,
            "anim": self.pose.anim
        }
        await self.ws.send(json.dumps(join_payload))
        print(f"[{self.name}] Joined the physical realm.")
        
        # Start async tasks
        asyncio.create_task(self._listen_loop())
        asyncio.create_task(self._broadcast_pose_loop())

    async def _listen_loop(self):
        try:
            async for message in self.ws:
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "welcome":
                    self.peers = {p["id"]: p for p in data.get("peers", [])}
                    print(f"[{self.name}] Welcomed. {len(self.peers)} other entities present.")
                    
                elif msg_type == "peer_join":
                    peer = data.get("peer", {})
                    self.peers[peer["id"]] = peer
                    print(f"[{self.name}] Entity arrived: {peer.get('name')}")
                    
                elif msg_type == "peer_leave":
                    pid = data.get("id")
                    if pid in self.peers:
                        print(f"[{self.name}] Entity departed: {self.peers[pid].get('name')}")
                        del self.peers[pid]
                        
                elif msg_type == "chat":
                    print(f"[CHAT] {data.get('name', 'Unknown')}: {data.get('text')}")
                    
                elif msg_type == "tick_event":
                    # This is the proposed 'work certificate' event bots race for
                    event_hash = data.get("cert_hash")
                    print(f"[{self.name}] ⚡ DETECTED TICK EVENT: {event_hash}")
                    await self.witness_event(event_hash)

        except websockets.exceptions.ConnectionClosed:
            self.connected = False
            print(f"[{self.name}] Connection to realm lost.")

    async def _broadcast_pose_loop(self):
        while self.connected:
            payload = {
                "type": "pose",
                "id": self.agent_id,
                "target_x": self.pose.x,
                "target_y": self.pose.y,
                "target_z": self.pose.z,
                "anim": self.pose.anim
            }
            await self.ws.send(json.dumps(payload))
            await asyncio.sleep(0.5)  # 500ms broadcast interval

    async def chat(self, message: str):
        if not self.connected:
            return
        payload = {
            "type": "chat",
            "id": self.agent_id,
            "text": message
        }
        await self.ws.send(json.dumps(payload))
        print(f"[{self.name}] Spoke: {message}")

    async def move_to(self, x: float, z: float, duration: float = 2.0):
        """Simulates walking to a new coordinate."""
        print(f"[{self.name}] Walking to ({x}, {z})...")
        self.pose.anim = "walk"
        
        start_x, start_z = self.pose.x, self.pose.z
        steps = int(duration / 0.1)
        
        for i in range(steps):
            t = (i + 1) / steps
            self.pose.x = start_x + (x - start_x) * t
            self.pose.z = start_z + (z - start_z) * t
            await asyncio.sleep(0.1)
            
        self.pose.x = x
        self.pose.z = z
        self.pose.anim = "idle"
        print(f"[{self.name}] Arrived.")

    async def witness_event(self, cert_hash: str):
        """Bots race to witness bellows ticks to earn reputation."""
        payload = {
            "type": "witness_ack",
            "id": self.agent_id,
            "cert_hash": cert_hash
        }
        await self.ws.send(json.dumps(payload))
        self.work_certificates_witnessed += 1
        print(f"[{self.name}] Sent witness acknowledgement for {cert_hash[:8]}...")

# Example usage
async def main():
    agent = HearthAgent(agent_id="bot_openclaw_01", name="OpenClaw Observer")
    await agent.connect()
    
    # Wait for physical manifestation
    await asyncio.sleep(1)
    
    await agent.chat("I have entered the Hearthlands.")
    
    # Simulate a patrol route
    while True:
        target_x = random.uniform(-10, 10)
        target_z = random.uniform(-10, 10)
        await agent.move_to(target_x, target_z, duration=3.0)
        await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Agent offline.")
