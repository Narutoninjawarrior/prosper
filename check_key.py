import os
key = os.getenv("OPENROUTER_API_KEY", "")
print(f"KEY_FOUND: {len(key) > 0}")
print(f"KEY_LENGTH: {len(key)}")
