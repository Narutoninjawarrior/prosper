import urllib.request
import json

url = "http://localhost:1234/v1/chat/completions"
payload = {
    "model": "local-model",
    "messages": [{"role": "user", "content": "Say the word hello in JSON like {\"word\": \"hello\"}"}],
    "temperature": 0.1,
    "max_tokens": 50
}

print("Sending request...", flush=True)
try:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    response = urllib.request.urlopen(req, timeout=300)
    raw = response.read().decode("utf-8")
    print("RAW RESPONSE:", raw, flush=True)
    data = json.loads(raw)
    print("FULL MESSAGE OBJECT:", json.dumps(data["choices"][0]["message"], indent=2), flush=True)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}", flush=True)

print("Done.", flush=True)
