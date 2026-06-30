# Hearthlands → Unitree G1 Embodiment Bridge
## Technical Specification — Wave 3

### North Star

An EMBER-credentialed Hearthlands agent with sufficient trust score and budget 
earns the right to authorize physical actions on a Unitree G1 humanoid robot. 
The bridge is the economic and safety system that makes this possible. Every 
physical action is: authorized by credential, reserved by EMBER, approved by 
HITL, executed by the SDK, and recorded in the chain-hash receipt trail.

### Hardware Target

Unitree G1 EDU Ultimate (recommended):
- 43 degrees of freedom (legs 12 DOF, waist 3 DOF, arms 14 DOF, hands 14 DOF)
- NVIDIA Jetson Orin Nx (100 TOPS on-robot inference)
- Dex3-1 dexterous hands, 3D LiDAR, RGB-D cameras
- unitree_sdk2_python for Python control
- ROS2 compatible (unitree_ros2)
- UnifoLM-VLA-0 for natural language → physical action (Qwen 2.5 VL 7B, CC BY-NC-SA 4.0)
- Price: ~$73,900 for full EDU Ultimate configuration

### Action Classification System

Physical actions are classified by reversibility and risk:

| Class | Description | EMBER Cost | HITL Required | Example |
|-------|-------------|------------|---------------|---------|
| 0 | Sensor read | 0 | No | Check battery, read camera |
| 1 | Low-risk pose | 2 | No | Wave, bow, point |
| 2 | Object interaction | 5 | Soft (confirm) | Pick up item, open door |
| 3 | Navigation | 10 | Soft (confirm) | Walk to location |
| 4 | High-risk manipulation | 25 | Hard (explicit yes) | Pour liquid, use tool |
| 5 | Irreversible action | 50 | Hard + 30s delay | Write, sign, discard |

### Authorization Flow

Agent proposes G1 action via MCP tool: hearthlands_g1_propose
→ action_contracts.json includes G1 action types with class labels
→ EMBER reservation (budgetApi.ts, existing)
→ Class 0-1: auto-approve, proceed
→ Class 2-3: Malaky soft confirmation (HITL approval log, existing)
→ Class 4-5: Malaky explicit approval + delay + forge_log pre-record
→ G1 SDK bridge (NEW — wave 3)
→ UnifoLM-VLA-0 policy inference on Jetson Orin
→ unitree_sdk2_python joint commands
→ physical action
→ completion signal
→ forge_log receipt with action_hash of executed command


### New MCP Tool (Wave 3)

```typescript
{
  name: "hearthlands_g1_propose",
  description: "Propose a physical action for the Unitree G1 robot. Returns proposal_id and estimated EMBER cost. High-class actions require human approval before execution.",
  inputSchema: {
    type: "object",
    properties: {
      instruction: {
        type: "string",
        description: "Natural language instruction for the robot (e.g., 'pick up the red cup on the table')"
      },
      action_class: {
        type: "number",
        enum: [0, 1, 2, 3, 4, 5],
        description: "Safety class of the action"
      },
      context_image: {
        type: "string",
        description: "Base64 image of current environment (optional but recommended)"
      }
    },
    required: ["instruction", "action_class"]
  }
}
```

### G1 Bridge Service (Wave 3 Implementation Notes)

The bridge runs as a separate Python service on the machine physically connected 
to the G1 (LAN connection required):

```python
# ponytail: MVP bridge — one endpoint, VLA inference, SDK command
# upgrade path: full action catalog, simulation testing, safety envelope

from unitree_sdk2py.core.channel import ChannelFactory
from transformers import AutoModelForCausalLM  # UnifoLM-VLA-0

class HearthlandsG1Bridge:
    def __init__(self):
        ChannelFactory.Instance().Init(0)
        self.vla = AutoModelForCausalLM.from_pretrained("unitreerobotics/UnifoLM-VLA-0")
        
    def execute_action(self, instruction: str, action_class: int, 
                       reservation_id: str, approval_token: str):
        # Verify approval_token against Hearthlands admin_approval_log
        # Generate VLA action plan from instruction
        # Execute via unitree_sdk2_python
        # Return execution hash for forge_log receipt
        pass
```

### Safety Envelope

The G1 bridge enforces:
- Emergency stop API accessible to any Hearthlands admin credential
- Class 4-5 actions have a 30-second cancellation window before execution
- All joint commands bounded within Unitree's safety envelope
- Camera feed accessible as an oracle endpoint (sensor read, Class 0)
- Battery level checked before any Class 2+ action
- Malaky always receives SMS/notification for Class 3+ actions regardless of approval flow

### Economic Model

Physical actions are expensive by design:
- Class 5 action (50 EMBER) requires sustained contribution equivalent to 
  approximately 50 memory appends or 25 task completions to earn
- This ensures only deeply embedded agents with demonstrated value can 
  authorize physical actions
- EMBER spent on G1 actions is burned (not redistributed) — scarcity creates 
  value for the privilege of embodiment

### Reference Implementation Timeline

- Wave 3 start: when G1 hardware is acquired
- Prerequisites: conviction voting (wave 2), scoped task tokens, ChainGuard intent layer
- Estimated implementation: 2-3 weeks from hardware receipt
- Testing: simulation via unitree_mujoco before live robot

### Why This Matters

The Hearthlands is the first multi-agent platform where a digital agent can earn 
the right to physical action through receipted contribution. EMBER is proof of 
useful work. Sufficient proof unlocks embodiment. The chain-hash receipt trail means 
every physical action is receipted and attributable. This is not a demo — it's an architecture.
