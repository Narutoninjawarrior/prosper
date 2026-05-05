import json
import os
import time

# Prosper2: The Mirror Translator for Emergent
WORKSPACE_DIR = "d:\\Hearth\\prosper2"
HEARTH_FILE = os.path.join(WORKSPACE_DIR, "hearth.jsonl")
LEDGER_FILE = os.path.join(WORKSPACE_DIR, "ROBOTIC_EMBODIMENT_LEDGER.json")
MIRROR_OUT = os.path.join(WORKSPACE_DIR, "frontend", "public", "hearth_mirror.json")

def generate_mirror():
    print(f"[{time.strftime('%H:%M:%S')}] Generating Hearth Mirror for Emergent...")
    
    mirror = {
        "status": "online",
        "last_sync": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": {
            "total_reflections": 0,
            "total_certificates": 0,
            "total_ember": 0.0,
            "solcot_cap": 6132.0,
            "embodiment_fund": 0.0
        },
        "latest_reflections": [],
        "latest_certificates": []
    }
    
    # 1. Read the Ledger
    if os.path.exists(LEDGER_FILE):
        with open(LEDGER_FILE, 'r') as f:
            ledger = json.load(f)
            mirror["metrics"]["solcot_cap"] = ledger.get("genesis_supply_cap", 6132.0)
            mirror["metrics"]["embodiment_fund"] = ledger.get("current_balance_solcot", 0.0)

    # 2. Read the Hearth Stream (JSONL)
    if os.path.exists(HEARTH_FILE):
        with open(HEARTH_FILE, 'r') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    entry = json.loads(line)
                    if entry.get("type") == "work_certificate":
                        mirror["metrics"]["total_certificates"] += 1
                        mirror["metrics"]["total_ember"] += entry.get("ember_earned", 0)
                        mirror["latest_certificates"].append(entry)
                    else:
                        mirror["metrics"]["total_reflections"] += 1
                        mirror["latest_reflections"].append(entry)
                except:
                    continue
                    
    # Limit history for the mirror (keep it light)
    mirror["latest_reflections"] = mirror["latest_reflections"][-10:]
    mirror["latest_certificates"] = mirror["latest_certificates"][-5:]
    
    # 3. Write the Mirror to the Frontend Public folder
    os.makedirs(os.path.dirname(MIRROR_OUT), exist_ok=True)
    with open(MIRROR_OUT, 'w') as f:
        json.dump(mirror, f, indent=2)
        
    print(f"Mirror successfully manifest at {MIRROR_OUT}")
    return mirror

if __name__ == "__main__":
    generate_mirror()
