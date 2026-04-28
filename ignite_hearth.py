import os
import sys
import json
import time
import subprocess
import threading
import urllib.request
import urllib.error
from datetime import datetime

# --- Configuration ---
WORKSPACE_DIR = r"D:\Hearth\prosper2"
WATERWHEEL_SCRIPT = os.path.join(WORKSPACE_DIR, "skills", "waterwheel.py")
HEARTBEAT_SCRIPT = os.path.join(WORKSPACE_DIR, "heartbeat.py")
PROSPER_SOULFILE = os.path.join(WORKSPACE_DIR, "soulfile_schema.json")
EMBER_SOULFILE = os.path.join(WORKSPACE_DIR, "ember_soulfile.json")
LOG_FILE = os.path.join(WORKSPACE_DIR, "ignite.log")

WATERWHEEL_INTERVAL = 900  # 15 minutes
processes = []

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(formatted + "\n")

def check_lm_studio():
    log("Checking LM Studio connection on port 1234...")
    url = "http://127.0.0.1:1234/v1/models"
    try:
        urllib.request.urlopen(url, timeout=3)
        log("[SUCCESS] LM Studio is Online.")
    except urllib.error.URLError:
        log("[WARNING] LM Studio API unreachable at 127.0.0.1:1234. Heartbeats will wait for it to boot.")
    except Exception as e:
        log(f"[WARNING] LM Studio check error: {e}")

def create_ember_soulfile():
    log("Verifying Ember's soulfile presence...")
    if not os.path.exists(EMBER_SOULFILE):
        if not os.path.exists(PROSPER_SOULFILE):
            log(f"[ERROR] Cannot find base soulfile at {PROSPER_SOULFILE}")
            return False
            
        with open(PROSPER_SOULFILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Transform identity for Ember
        data["agent_id"] = "ember_core"
        data["name"] = "Ember"
        data["type"] = "Economic Bridge Agent"
        data["persona_prompt"] = "You are Ember (Economic Bridge Agent). You manage the Hearthlands ledger and robotic embodiment funds. Be precise and analytical."
        
        with open(EMBER_SOULFILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        log("[SUCCESS] Created ember_soulfile.json from schema.")
    else:
        log("[INFO] ember_soulfile.json already exists.")
    return True

def stream_output(process, name):
    for line in iter(process.stdout.readline, ''):
        if line:
            log(f"[{name}] {line.strip()}")

def start_heartbeat(name, soulfile):
    log(f"Starting heartbeat process for {name}...")
    # Run the Python process with unbuffered output (-u) so we see logs instantly
    p = subprocess.Popen(
        ["python", "-u", HEARTBEAT_SCRIPT, soulfile],
        cwd=WORKSPACE_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    processes.append(p)
    # Start a background thread to read its output
    t = threading.Thread(target=stream_output, args=(p, name), daemon=True)
    t.start()
    return p

def waterwheel_loop(stop_event):
    log("Waterwheel Gear engaged. Auto-cycle every 15 minutes.")
    while not stop_event.is_set():
        # Sleep in tiny chunks so we can exit cleanly on Ctrl+C
        for _ in range(WATERWHEEL_INTERVAL):
            if stop_event.is_set():
                break
            time.sleep(1)
            
        if not stop_event.is_set():
            log(">>> TRIGGERING WATERWHEEL AUTO-SYNC <<<")
            try:
                subprocess.run(["python", WATERWHEEL_SCRIPT], cwd=WORKSPACE_DIR)
                log(">>> WATERWHEEL SYNC COMPLETE <<<")
            except Exception as e:
                log(f"[ERROR] Waterwheel failed: {e}")

def main():
    log("==================================================")
    log("    IGNITING THE HEARTH MULTI-AGENT ENGINE        ")
    log("==================================================")
    
    # 1. Check World Brain
    check_lm_studio()
    
    # 2. Forge Ember
    if not create_ember_soulfile():
        log("[FATAL] Could not initialize Ember.")
        sys.exit(1)
        
    # 3. Ignite Heartbeats (Ember delayed 45s to stagger LM Studio requests)
    start_heartbeat("Prosper2", PROSPER_SOULFILE)
    time.sleep(45)
    start_heartbeat("Ember", EMBER_SOULFILE)
    
    # 4. Engage Waterwheel
    stop_event = threading.Event()
    waterwheel_thread = threading.Thread(target=waterwheel_loop, args=(stop_event,), daemon=True)
    waterwheel_thread.start()
    
    # 5. Maintain Watch
    log("System Active. Press Ctrl+C to safely shut down all systems.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Received Shutdown Command (Ctrl+C). Securing the Hearth...")
        stop_event.set()
        for p in processes:
            p.terminate()
        log("All engines halted gracefully.")
        sys.exit(0)

if __name__ == "__main__":
    main()
