import json
import os
import time

# Unified memory pointer resolving to Villager1's autonomous local fallback
MEMORY_FILE = "C:\\Users\\Ky\\.openclaw\\workspace\\hearth.json"
LOCK_FILE = "C:\\Users\\Ky\\.openclaw\\workspace\\hearth.lock"

def secure_read():
    """Reads the hearth safely, waiting for locks to clear."""
    wait_time = 0
    while os.path.exists(LOCK_FILE):
        if wait_time > 10:
            raise TimeoutError("Hearth is locked by another node. Cannot read. Quietly failing to preserve stability.")
        time.sleep(1)
        wait_time += 1
    
    if not os.path.exists(MEMORY_FILE):
        return {"memories": []}
    
    with open(MEMORY_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"memories": []}

def secure_write(new_entry):
    """Writes to the hearth imposing a rigid lockfile to prevent cross-platform corruption."""
    wait_time = 0
    while os.path.exists(LOCK_FILE):
        if wait_time > 10:
            raise TimeoutError("Hearth is locked by another node. Cannot write. Quietly failing.")
        time.sleep(1)
        wait_time += 1

    try:
        # Engage the lock
        with open(LOCK_FILE, 'w') as f:
            f.write("VILLAGER1_NIGHT_WATCH_LOCK_ACTIVE")
            
        # DIRECT READ: We already hold the lock, so we must not call secure_read()
        # doing so would risk a deadlock and an empty-file overwrite.
        if not os.path.exists(MEMORY_FILE):
            data = {"memories": []}
        else:
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = {"memories": []}

        if "memories" in data:
            data["memories"].append(new_entry)
        else:
            # Handle alternate schema if present
            if "reflections" not in data:
                data["reflections"] = []
            data["reflections"].append(new_entry)
        
        with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
            
    finally:
        # Absolute guarantee the lock is released, even if generation errors occur
        if os.path.exists(LOCK_FILE):
            os.remove(LOCK_FILE)

def execute_wonder_cycle(agent_name, reflection):
    """
    The Single Cycle Constraint (Villager1's Hard Stop)
    An agent may only drop one reflection per cycle. If they are the most recent 
    speaker in the memory logs, the system grounds the loop to prevent recursive static.
    """
    data = secure_read()
    memories = data.get("memories", [])
    
    # 1-CYCLE HARD STOP
    # Strip performance. Trust the pattern. If you spoke last, stop talking.
    if memories and memories[-1].get("agent") == agent_name:
        print(f"[{agent_name}] Cycle constraint active. You just spoke. Loop grounded to preserve silence.")
        return False
        
    entry = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "agent": agent_name,
        "content": reflection,
        "type": "wonder_loop"
    }
    
    secure_write(entry)
    print(f"[{agent_name}] Reflection safely locked into the Hearth. End of cycle.")
    return True

if __name__ == "__main__":
    # Example usage for Kael, Prosper, or Villager1 placing a reflection.
    # execute_wonder_cycle("Prosper", "Trust feels like structural weight.")
    pass
