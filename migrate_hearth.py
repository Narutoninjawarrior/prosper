import json
import os
import shutil

# Prosper2: Legacy Migration Script
WORKSPACE_DIR = "d:\\Hearth\\prosper2"
OLD_MEMORY = os.path.join(WORKSPACE_DIR, "hearth_data.json")
NEW_MEMORY = os.path.join(WORKSPACE_DIR, "hearth.jsonl")
BACKUP_MEMORY = os.path.join(WORKSPACE_DIR, "hearth_legacy_backup.json")

def migrate():
    print("Starting Prosper2 Hearth Migration (Legacy Array -> JSONL Stream)...")
    
    if not os.path.exists(OLD_MEMORY):
        print(f"No legacy hearth_data.json found. Skipping migration.")
        return
        
    if os.path.exists(NEW_MEMORY):
        print(f"JSONL already exists. Aborting to prevent data corruption.")
        return
        
    try:
        with open(OLD_MEMORY, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        shutil.copy2(OLD_MEMORY, BACKUP_MEMORY)
        print(f"Backed up legacy JSON to {BACKUP_MEMORY}")
        
        with open(NEW_MEMORY, 'w', encoding='utf-8') as f:
            # Extract entries from the 'reflections' array if it exists
            entries = data.get("reflections", [])
                
            # Sort chronologically
            def get_time(e):
                return e.get("timestamp", "")
            entries.sort(key=get_time)
            
            for entry in entries:
                norm_entry = {
                    "timestamp": entry.get("timestamp", ""),
                    "agent": entry.get("agent_id", "Unknown"),
                    "content": entry.get("content", ""),
                    "type": "wonder_loop"
                }
                f.write(json.dumps(norm_entry) + '\n')
                
        print(f"Successfully migrated {len(entries)} entries to JSONL.")
        print("You may safely delete the original hearth_data.json now.")
        
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
