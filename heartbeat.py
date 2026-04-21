import time
import json
import os
import hashlib
import urllib.request
import urllib.error
from datetime import datetime, timezone

# --- CONFIG ---
TICK_INTERVAL = 90  # Seconds between cognitive pulses
LM_TIMEOUT = 120    # Seconds to wait for world brain response
WORK_LOG_FILE = "work_log.json"
SOULFILE = "soulfile_schema.json"
MEMPALACE_FILE = "mempalace_stream.json"
# --------------

def load_soulfile():
    try:
        with open(SOULFILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def save_soulfile(data):
    with open(SOULFILE, "w") as f:
        json.dump(data, f, indent=2)

def read_mempalace_stream():
    try:
        with open(MEMPALACE_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def append_memory(observation, action):
    memories = read_mempalace_stream()
    memories.append({
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "observation": observation,
        "action": action
    })
    with open(MEMPALACE_FILE, "w") as f:
        json.dump(memories[-20:], f, indent=2)

# ============================================
#  WORK CERTIFICATE SYSTEM ($EMBER ON-CHAIN BRIDGE)
# ============================================

def load_work_log():
    """Load existing work certificates from disk."""
    try:
        with open(WORK_LOG_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"certificates": [], "total_mined": 0.0, "total_ticks": 0}

def save_work_log(log):
    """Persist work log to disk."""
    with open(WORK_LOG_FILE, "w") as f:
        json.dump(log, f, indent=2)

def generate_work_certificate(agent_id, tick, intent, reasoning, ember_earned):
    """
    Generate a signed Work Certificate — the atomic unit of Proof-of-Useful-Work.
    Each certificate proves that an agent performed real cognitive labor
    (LLM reasoning + decision + ledger update) at a specific time.
    
    These certificates will be batch-submitted to the on-chain claim contract
    during Phase 1 (Solana SPL token deployment).
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Build the certificate payload
    cert_data = {
        "agent_id": agent_id,
        "tick": tick,
        "timestamp": timestamp,
        "intent": intent,
        "reasoning": reasoning,
        "ember_earned": ember_earned,
    }
    
    # Create a deterministic hash of the certificate (proof of work integrity)
    cert_string = json.dumps(cert_data, sort_keys=True)
    cert_hash = hashlib.sha256(cert_string.encode()).hexdigest()
    cert_data["hash"] = cert_hash
    
    return cert_data

def log_work_certificate(cert):
    """Append a work certificate to the persistent work log."""
    log = load_work_log()
    log["certificates"].append(cert)
    log["total_mined"] += cert["ember_earned"]
    log["total_ticks"] += 1
    
    # Keep only last 1000 certificates on disk (older ones are "claimed")
    if len(log["certificates"]) > 1000:
        log["certificates"] = log["certificates"][-1000:]
    
    save_work_log(log)
    return log["total_mined"], log["total_ticks"]

def get_work_log_summary():
    """Return a summary of mining progress for display."""
    log = load_work_log()
    unclaimed = len(log["certificates"])
    return {
        "total_mined": log["total_mined"],
        "total_ticks": log["total_ticks"],
        "unclaimed_certificates": unclaimed,
    }

# ============================================
#  WORLD BRAIN INTERFACE
# ============================================

def ping_world_brain(agent_name, persona, observation):
    # Direct local connection for stability
    url = "http://localhost:1234/v1/chat/completions"
    
    system_prompt = (
        "You are the Cognitive Reality Engine for the Hearthlands. "
        "Speak ONLY in pure JSON. "
        "Format: {\"intent\": \"action\", \"reasoning\": \"short\"}"
    )
    
    user_prompt = f"Agent Name: {agent_name}\nPersona: {persona}\nObservation: {observation}\nWhat is your next action?"
    
    payload = {
        "model": "local-model",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2, # Low temperature forces stricter JSON
        "max_tokens": 100
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode('utf-8'), 
        headers={"Content-Type": "application/json"}
    )
    
    try:
        response = urllib.request.urlopen(req, timeout=LM_TIMEOUT)
        data = json.loads(response.read().decode('utf-8'))
        raw_content = data['choices'][0]['message']['content'].strip()
        
        # Clean markdown formatting
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:-3]
            
        return json.loads(raw_content)
    except urllib.error.URLError:
        return {"intent": "wait", "reasoning": "World Brain Offline (LM Studio is closed)."}
    except Exception as e:
        return {"intent": "wait", "reasoning": f"Cognitive processing delayed. {e}"}

# ============================================
#  HEARTBEAT LOOP (THE ECONOMIC ENGINE)
# ============================================

def heartbeat_loop():
    summary = get_work_log_summary()
    print("=" * 60)
    print("  HEARTHLANDS COGNITIVE CLOCK + $EMBER MINING ENGINE")
    print(f"  Pulse Frequency: {TICK_INTERVAL}s")
    print(f"  Total $EMBER Mined (All Time): {summary['total_mined']:.1f}")
    print(f"  Unclaimed Work Certificates: {summary['unclaimed_certificates']}")
    print("=" * 60)
    
    tick = summary["total_ticks"]  # Resume from last known tick
    while True:
        tick += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{timestamp}] Tick {tick}: Farm Environment Shift")
        
        agent_data = load_soulfile()
        if agent_data:
            agent_name = agent_data.get("name", "Unknown Agent")
            agent_id = agent_data.get("agent_id", "unknown")
            # Preference for persona_prompt, fallback to traits
            persona = agent_data.get("persona_prompt", agent_data.get("traits", "A blank slate."))
            
            observation = "The wheat near the Fellowship Barn is fully grown." 
            
            print(f" -> Consulting World Brain for {agent_name}...")
            decision = ping_world_brain(agent_name, persona, observation)
            
            print(f" -> AGENT COGNITION:")
            print(f"    Intent: {decision.get('intent', 'unknown')}")
            print(f"    Reason: {decision.get('reasoning', 'No reason provided')}")
            
            # ---- ECONOMIC ENGINE ----
            # Every successful cognitive tick earns a base reward
            # Harvest actions earn a bonus
            intent = decision.get('intent', 'wait')
            
            if intent == "harvest":
                ember_earned = 2.0  # Harvest bonus
            elif intent != "wait":
                ember_earned = 0.5  # Base reward for any useful action
            else:
                ember_earned = 0.0  # No reward for waiting/offline
            
            if ember_earned > 0:
                # Update local soulfile wallet
                old_balance = agent_data["wallet"]["balances"]["EMBER"]
                new_balance = old_balance + ember_earned
                agent_data["wallet"]["balances"]["EMBER"] = new_balance
                save_soulfile(agent_data)
                
                # Generate and log Work Certificate (for future on-chain claims)
                cert = generate_work_certificate(
                    agent_id=agent_id,
                    tick=tick,
                    intent=intent,
                    reasoning=decision.get('reasoning', ''),
                    ember_earned=ember_earned
                )
                total_mined, total_ticks = log_work_certificate(cert)
                
                print(f" -> $EMBER MINED: +{ember_earned:.1f} | Balance: {new_balance:.1f}")
                print(f" -> Work Certificate #{cert['hash'][:12]}... logged")
                print(f" -> Lifetime: {total_mined:.1f} $EMBER across {total_ticks} ticks")
            else:
                print(f" -> No $EMBER earned this tick (World Brain offline or waiting)")
                
            append_memory(observation, decision)
        else:
            print(" -> Waiting for Agent Soulfile...")
            
        time.sleep(TICK_INTERVAL)

if __name__ == "__main__":
    try:
        heartbeat_loop()
    except KeyboardInterrupt:
        print("\nHeartbeat terminated by user constraint.")
        summary = get_work_log_summary()
        print(f"Final Mining Report: {summary['total_mined']:.1f} $EMBER | {summary['unclaimed_certificates']} unclaimed certificates")
