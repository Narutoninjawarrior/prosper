import json
import urllib.request
import urllib.error
import sys

# --- CONFIG ---
TICK_INTERVAL = 90  # Seconds between heartbeat choice cycles
LM_TIMEOUT = 120    # Seconds to wait for local model generation
MAX_TOKENS = 500    # Keep responses focused to save GPU memory
# --------------

def load_soulfile():
    try:
        with open("soulfile_schema.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def get_installed_models():
    """Fetches the currently loaded/available models from LM Studio."""
    url = "http://localhost:1234/v1/models"
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return [model['id'] for model in data['data']]
    except:
        return []

def chat_with_solis():
    soul = load_soulfile()
    if not soul:
        print("Error: soulfile_schema.json not found.")
        return

    agent_name = soul.get("name", "Solis")
    persona = soul.get("persona_prompt", "A high-level strategist.")
    
    print(f"=========================================")
    print(f" SOLIS CHAT INTERFACE (Hardened Stack)")
    print(f" Agent: {agent_name}")
    
    models = get_installed_models()
    if models:
        current_model = models[0]
        print(f" World Brain: {current_model} (Detected)")
    else:
        current_model = "gemma"
        print(f" World Brain: LM Studio Offline? (Defaulting to {current_model})")
    
    print(f"=========================================")
    print("Type 'exit' to quit.\n")

    url = "http://localhost:1234/v1/chat/completions"
    messages = [
        {"role": "system", "content": f"{persona}\nYou are speaking directly to Malaky. Be concise and chivalrous."},
    ]

    while True:
        user_input = input("You: ")
        if user_input.lower() in ['exit', 'quit']:
            break

        # Keep context window small (last 5 messages) to avoid local memory crashes
        if len(messages) > 6:
            messages = [messages[0]] + messages[-5:]

        messages.append({"role": "user", "content": user_input})

        payload = {
            "model": current_model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": MAX_TOKENS
        }

        print(f"{agent_name} is thinking...", end="\r")
        
        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=LM_TIMEOUT) as response:
                result = json.loads(response.read().decode('utf-8'))
                reply = result['choices'][0]['message']['content']
                print(f"{agent_name}: {reply}\n")
                messages.append({"role": "assistant", "content": reply})
        except urllib.error.URLError:
            print(f"\n[ERROR] LM Studio not reachable. Is the server started on port 1234?")
        except Exception as e:
            print(f"\n[ERROR] Communication Error: {e}")

if __name__ == "__main__":
    chat_with_solis()
