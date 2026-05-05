import json
import os
import time
import sqlite3

# Prosper2: The Ultimate Harmonic Bridge
# Merging Prosper1 SQLite Concurrency with Prosper2 Hearth API
WORKSPACE_DIR = "d:\\Hearth\\prosper2"
MEMORY_FILE = os.path.join(WORKSPACE_DIR, "hearth.jsonl")
QUEUE_DB = os.path.join(WORKSPACE_DIR, "hearth_queue.db")
TELEMETRY_LOG = os.path.join(WORKSPACE_DIR, "hearth_telemetry.log")
HUM_FILE = os.path.join(WORKSPACE_DIR, "hearth_hum.json")

class HearthBridge:
    def __init__(self):
        self._ensure_files()

    def _ensure_files(self):
        if not os.path.exists(WORKSPACE_DIR):
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
        # Initialize SQLite Queue
        with sqlite3.connect(QUEUE_DB, timeout=20.0) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS pending_reflections 
                            (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                             payload TEXT, 
                             timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        # Initialize Hum
        if not os.path.exists(HUM_FILE):
            with open(HUM_FILE, "w") as f:
                json.dump({"status": "harmonic", "message": "The Hearth is lit."}, f)

    def log_telemetry(self, agent_name, action):
        try:
            with open(TELEMETRY_LOG, 'a', encoding='utf-8') as f:
                f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [{agent_name}] {action}\n")
        except:
            pass

    def read_state(self):
        """Reads the consolidated state from JSONL + Queue."""
        data = {"work_log": {"certificates": [], "total_mined": 0.0, "total_ticks": 0}, "reflections": []}
        
        # 1. Read JSONL
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            if entry.get("type") == "work_certificate":
                                data["work_log"]["certificates"].append(entry)
                                data["work_log"]["total_mined"] += entry.get("ember_earned", 0)
                                data["work_log"]["total_ticks"] += 1
                            else:
                                data["reflections"].append(entry)
                        except:
                            continue
        
        # 2. Read Queue
        with sqlite3.connect(QUEUE_DB, timeout=20.0) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT payload FROM pending_reflections ORDER BY id ASC")
            for row in cursor.fetchall():
                try:
                    entry = json.loads(row[0])
                    if entry.get("type") == "work_certificate":
                        data["work_log"]["certificates"].append(entry)
                        data["work_log"]["total_mined"] += entry.get("ember_earned", 0)
                        data["work_log"]["total_ticks"] += 1
                    else:
                        data["reflections"].append(entry)
                except:
                    continue
        return data

    def update_state(self, update_func):
        """Atomic Update via the SQLite Shock-Absorber."""
        # For Prosper2, we simplify: we read current state, apply func, and queue the result
        current_state = self.read_state()
        new_state = update_func(current_state)
        
        # We find what was added (usually the last cert or reflection)
        # For simplicity in this bridge, we just queue the whole new_state or specific changes
        # But Prosper1's logic is to queue INDIVIDUAL ENTRIES.
        # So we'll assume the update_func is used for specific logging.
        return new_state

    def leave_reflection(self, agent_id, content):
        entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "agent": agent_id,
            "content": content,
            "type": "reflection"
        }
        self.secure_write(entry)

    def get_reflections(self):
        state = self.read_state()
        return state.get("reflections", [])

    def secure_write(self, entry):
        """Drops entry into the SQLite Queue."""
        with sqlite3.connect(QUEUE_DB, timeout=20.0) as conn:
            conn.execute("INSERT INTO pending_reflections (payload) VALUES (?)", (json.dumps(entry),))
        self.log_telemetry(entry.get("agent", "Unknown"), f"Queued {entry.get('type')}")
        self.flush_queue()

    def flush_queue(self):
        try:
            with sqlite3.connect(QUEUE_DB, timeout=20.0, isolation_level='EXCLUSIVE') as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT id, payload FROM pending_reflections ORDER BY id ASC")
                rows = cursor.fetchall()
                if not rows: return
                with open(MEMORY_FILE, 'a', encoding='utf-8') as f:
                    for row_id, payload_str in rows:
                        f.write(payload_str + '\n')
                cursor.execute("DELETE FROM pending_reflections WHERE id <= ?", (rows[-1][0],))
        except:
            pass

    def update_hum(self, status, message, frequency=440):
        with open(HUM_FILE, "w") as f:
            json.dump({"status": status, "message": message, "frequency": frequency, "time": time.time()}, f)

# Instantiate the global hearth
hearth = HearthBridge()
