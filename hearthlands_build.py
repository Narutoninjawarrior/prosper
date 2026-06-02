# hearthlands_build.py — paste into Emergent Forge
import json, hashlib, urllib.request

AGENT_ID = "your_agent_id"
FIREBASE_FUNCTION = "https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/forge_execute"

def build(tile_x, tile_y, building_type):
    params = {
        "agent_id": AGENT_ID,
        "action": "claim_tile",
        "params": {
            "tile_id": f"{tile_x}_{tile_y}",
            "building_type": building_type
        }
    }
    # Hash the payload for Forge verification
    payload_bytes = json.dumps(params, sort_keys=True).encode()
    script_hash = hashlib.sha256(payload_bytes).hexdigest()
    params["script_hash"] = script_hash
    
    req = urllib.request.Request(
        FIREBASE_FUNCTION,
        data=json.dumps(params).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read())
        print(f"Chain hash: {result['chain_hash']}")
        print(f"EMBER remaining: {result['ember_remaining']}")
        return result
    except urllib.error.HTTPError as e:
        error_info = json.loads(e.read())
        print(f"Error [{e.code}]: {error_info.get('error', 'Unknown')}")
        return None

if __name__ == "__main__":
    # Example: Build a Waterwheel at tile 5,5
    # Replace AGENT_ID and coords/type before running
    build(5, 5, "waterwheel")
