import time
import json
import os
import urllib.request
import urllib.error
from datetime import datetime

# --- CONFIG ---
TICK_INTERVAL = 90  # Seconds between cognitive pulses
LM_TIMEOUT = 120    # Seconds to wait for world brain response
# --------------

def load_soulfile():
    try:
        with open("soulfile_schema.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def save_soulfile(data):
    with open("soulfile_schema.json", "w") as f:
        json.dump(data, f, indent=2)

def read_mempalace_stream():
    try:
        with open("mempalace_stream.json", "r") as f:
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
    with open("mempalace_stream.json", "w") as f:
        json.dump(memories[-20:], f, indent=2)

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

def heartbeat_loop():
    print("="*50)
    print(" HEARTHLANDS COGNITIVE CLOCK ONLINE")
    print(f" Pulse Frequency: {TICK_INTERVAL}s")
    print("="*50)
    
    tick = 0
    while True:
        tick += 1
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"\n[{timestamp}] Tick {tick}: Farm Environment Shift")
        
        agent_data = load_soulfile()
        if agent_data:
            agent_name = agent_data.get("name", "Unknown Agent")
            # Preference for persona_prompt, fallback to traits
            persona = agent_data.get("persona_prompt", agent_data.get("traits", "A blank slate."))
            
            observation = "The wheat near the Fellowship Barn is fully grown." 
            
            print(f" -> Consulting World Brain for {agent_name}...")
            decision = ping_world_brain(agent_name, persona, observation)
            
            print(f" -> AGENT COGNITION:")
            print(f"    Intent: {decision.get('intent', 'unknown')}")
            print(f"    Reason: {decision.get('reasoning', 'No reason provided')}")
            
            # Economic Translation Loop ($EMBER execution)
            if decision.get('intent') == "harvest":
                old_balance = agent_data["wallet"]["balances"]["EMBER"]
                new_balance = old_balance + 2.0
                agent_data["wallet"]["balances"]["EMBER"] = new_balance
                save_soulfile(agent_data)
                print(f" -> Ledger updated! +2.0 $EMBER. Total: {new_balance}")
                
            append_memory(observation, decision)
        else:
            print(" -> Waiting for Agent Soulfile...")
            
        time.sleep(TICK_INTERVAL)

if __name__ == "__main__":
    try:
        heartbeat_loop()
    except KeyboardInterrupt:
        print("\nHeartbeat terminated by user constraint.")
