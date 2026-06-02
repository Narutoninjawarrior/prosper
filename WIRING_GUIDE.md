# Hearthlands — Full Wiring Guide
# Nervous System + 3D Forge + Secrets Migration

## STEP 0 — Rotate & Migrate Stripe Keys (DO THIS FIRST)

```bash
# 1. Go to dashboard.stripe.com → Developers → API keys → Roll sk_live key
# 2. Copy the NEW sk_live key, then:
firebase functions:secrets:set STRIPE_SECRET_KEY
# paste new sk_live_...

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# paste whsec_...

firebase functions:secrets:set TREASURY_WALLET
# paste: Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR

# 3. Deploy functions with secrets:
firebase deploy --only functions
```

---

## STEP 1 — Cognitive Sync (Directive 1)

### 1a. Install Python deps (once)
```bash
pip install fastapi uvicorn "slowapi[all]" pydantic
```

### 1b. Set the shared secret
Add to `frontend/.env` (never commit):
```
VITE_TRAINER_SECRET=your-strong-random-secret-here
```

Set the same value as an env var when running cognitive_sync.py:
```bash
# Windows (PowerShell)
$env:TRAINER_SECRET="your-strong-random-secret-here"
python cognitive_sync.py

# Or create D:\Hearth\.env and use python-dotenv
```

### 1c. Copy the file
```
cognitive_sync.py  →  D:\Hearth\prosper2\cognitive_sync.py
```

### 1d. Replace frontend/src/Hearthlands.tsx
```
Hearthlands.tsx  →  frontend/src/Hearthlands.tsx
```

### 1e. Run
```bash
# Terminal 1 — Cognitive Oracle
cd D:\Hearth\prosper2
python cognitive_sync.py
# → Listening on http://127.0.0.1:8765

# Terminal 2 — Vite dev server
cd D:\Hearth\prosper2\frontend
npm run dev
```

Open the Hearthlands tab. Move with WASD, plant nodes with Spacebar.
Check cognitive_sync terminal — you'll see signed events arriving.

---

## STEP 2 — 3D Forge (Directive 2)

### 2a. Install R3F deps
```bash
cd frontend
npm install @react-three/fiber @react-three/drei three
npm install -D @types/three
```

### 2b. Copy ThreeForge.tsx
```
ThreeForge.tsx  →  frontend/src/ThreeForge.tsx
```

### 2c. Add to App.tsx routing
```tsx
// In your tab/nav system:
import ThreeForge from './ThreeForge'
// Add as a tab: "3D FORGE"
// Render: <ThreeForge />
```

### 2d. Seed Firestore (one-time, in Firebase Console)
Create document: Collection `three_forge` → Document `world_state`
```json
{
  "nodes": [],
  "last_updated": null
}
```

---

## STEP 3 — MCP Server Setup

### 3a. Install threejs-devtools-mcp
```bash
npm install -g threejs-devtools-mcp
# or per-project:
cd frontend && npm install -D threejs-devtools-mcp
```

### 3b. Create .cursor/mcp.json (for Cursor IDE)
```json
{
  "mcpServers": {
    "threejs-devtools": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

### 3c. Create .claude/mcp.json (for Claude Desktop)
```json
{
  "mcpServers": {
    "threejs-devtools": {
      "command": "npx",
      "args": ["-y", "threejs-devtools-mcp"]
    }
  }
}
```

### 3d. Run the MCP server + Vite
```bash
# Terminal 1:
npx threejs-devtools-mcp
# → MCP server running

# Terminal 2:
cd frontend && npm run dev
# → http://localhost:5173

# Navigate to the 3D Forge tab in the browser
# The MCP server auto-connects via WebSocket to the R3F canvas
```

### 3e. Test — ask Claude in Cursor:
```
Add a glowing emerald node at position 2, 0, 3
```
Claude calls the MCP tool → R3F canvas updates live.

---

## STEP 4 — EMBER-gated MCP (Directive 2 backend)

### 4a. Replace functions/index.js
```
functions-index.js  →  frontend/functions/index.js
```

### 4b. Update firebase.json to include functions
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": { "rules": "firestore.rules" },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}
```

### 4c. Install function deps
```bash
cd frontend/functions
npm install stripe uuid firebase-admin firebase-functions
```

### 4d. Test the mcp_place_object endpoint
```bash
curl -X POST https://us-central1-<PROJECT_ID>.cloudfunctions.net/mcp_place_object \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "prosper2_core",
    "x": 2, "y": 0, "z": 3,
    "object_type": "node",
    "label": "First Forge Node"
  }'
```

### 4e. Update Firestore rules to allow world_state reads
```
match /three_forge/{doc} {
  allow read: if request.auth != null;
  allow write: if false;  // Functions only
}
```

---

## STEP 5 — Oracle Cognitive Loop (local Qwen)

The cognitive_sync.py writes semantic events to `hearth_data.json`.
Add this to your local Qwen/LM Studio polling loop:

```python
# oracle_loop.py — runs on D:\Hearth alongside cognitive_sync
import json, time, pathlib, requests

HEARTH   = pathlib.Path(r"D:\Hearth\prosper2\hearth_data.json")
COMMANDS = pathlib.Path(r"D:\Hearth\prosper2\oracle_commands.json")
LM_URL   = "http://localhost:1234/v1/chat/completions"

def oracle_tick():
    if not HEARTH.exists(): return
    data   = json.loads(HEARTH.read_text())
    events = data.get("trainer_events", [])[-10:]
    grid   = data.get("grid_state", {})

    if not events: return

    prompt = f"""You are the Hearthlands Oracle watching the farm grid.
Recent trainer events: {json.dumps(events, indent=2)}
Current grid state: {json.dumps(grid, indent=2)}

Respond ONLY with a JSON array of movement commands for agents, e.g.:
[{{"agent_id":"solis","x":3,"y":4,"action":"move"}},
 {{"agent_id":"prosper2","x":5,"y":2,"action":"harvest"}}]
If no action needed, respond with []."""

    r = requests.post(LM_URL, json={
        "model": "local-model",
        "messages": [{"role":"user","content": prompt}],
        "response_format": {"type": "json_object"},
        "max_tokens": 200,
        "temperature": 0.3,
    }, timeout=10)

    try:
        text = r.json()["choices"][0]["message"]["content"]
        cmds = json.loads(text)
        if cmds:
            COMMANDS.write_text(json.dumps(cmds))
    except Exception as e:
        print(f"[Oracle] parse error: {e}")

while True:
    try: oracle_tick()
    except Exception as e: print(f"[Oracle] {e}")
    time.sleep(2)
```

---

## Architecture Summary

```
Phaser 2D (Hearthlands.tsx)
  │  HMAC-signed semantic events (SPACE=node_place, WASD=agent_move)
  ▼
cognitive_sync.py (:8765)
  │  Validated + rate-limited → hearth_data.json
  ▼
oracle_loop.py (Qwen/LM Studio)
  │  Reads grid state → generates commands → oracle_commands.json
  ▼
GET /commands → Phaser picks up agent movements

R3F 3D Forge (ThreeForge.tsx)
  │  Reads Firestore three_forge/world_state in real-time
  ▼
threejs-devtools-mcp (WebSocket to R3F canvas)
  │  Claude/Codex call add_object, inspect_scene etc.
  ▼
mcp_place_object Firebase Function
  │  Deducts EMBER → writes to Firestore → ThreeForge renders
  ▼
Waterwheel → public dashboard

DOCTRINE: Browser Observes · Terminal Executes · Forge Witnesses
```
