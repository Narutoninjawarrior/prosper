import json
import os
import time
import fcntl # Standard on Unix, but for Windows we'll use a simpler file-exists lock

class HearthBridge:
    """
    The Harmonic Hearth Bridge.
    Manages atomic access to the shared JSON state of the Fellowship.
    Provides the 'Healing Hum' - a status signal for agent alignment.
    """
    def __init__(self, state_file="hearth_state.json", lock_file="hearth.lock"):
        self.state_file = state_file
        self.lock_file = lock_file
        self.hum_file = "hearth_hum.json"
        self._ensure_files()

    def _ensure_files(self):
        if not os.path.exists(self.state_file):
            with open(self.state_file, "w") as f:
                json.dump({
                    "agents": {}, 
                    "world": {"status": "peaceful", "last_pulse": 0},
                    "reflections": [] # The Reflection Pool
                }, f)
        if not os.path.exists(self.hum_file):
            with open(self.hum_file, "w") as f:
                json.dump({"frequency": 440, "status": "harmonic", "message": "The Hearth is lit."}, f)

    def leave_reflection(self, agent_id, content):
        """Leave a cognitive reflection in the shared pool."""
        def update_func(state):
            if "reflections" not in state:
                state["reflections"] = []
            
            reflection = {
                "agent_id": agent_id,
                "content": content,
                "timestamp": time.time()
            }
            state["reflections"].append(reflection)
            # Cap at 20 reflections to maintain the 'Skrying Mirror' clarity
            state["reflections"] = state["reflections"][-20:]
            return state
        
        return self.update_state(update_func)

    def get_reflections(self):
        """Observe the reflections of the Fellowship."""
        state = self.read_state()
        return state.get("reflections", [])

    def acquire_lock(self, timeout=10):
        start_time = time.time()
        while os.path.exists(self.lock_file):
            if time.time() - start_time > timeout:
                raise Exception("Hearth Lock Timeout: System too busy or deadlocked.")
            time.sleep(0.1) # The 'Hum' - listening for the release
        
        # Create the lock
        with open(self.lock_file, "w") as f:
            f.write(str(os.getpid()))

    def release_lock(self):
        if os.path.exists(self.lock_file):
            os.remove(self.lock_file)

    def read_state(self):
        try:
            self.acquire_lock()
            with open(self.state_file, "r") as f:
                return json.load(f)
        finally:
            self.release_lock()

    def update_state(self, update_func):
        """
        Atomic Read-Modify-Write for the Hearth state.
        update_func: a function that takes the current state and returns the new state.
        """
        try:
            self.acquire_lock()
            with open(self.state_file, "r") as f:
                state = json.load(f)
            
            new_state = update_func(state)
            
            with open(self.state_file, "w") as f:
                json.dump(new_state, f, indent=2)
            return new_state
        finally:
            self.release_lock()

    def update_hum(self, status, message, frequency=440):
        """Update the therapeutic hum signal."""
        hum_data = {
            "frequency": frequency,
            "status": status,
            "message": message,
            "timestamp": time.time()
        }
        with open(self.hum_file, "w") as f:
            json.dump(hum_data, f, indent=2)

    def get_hum(self):
        try:
            with open(self.hum_file, "r") as f:
                return json.load(f)
        except:
            return {"status": "unknown"}

# Initialize the global bridge
hearth = HearthBridge()
