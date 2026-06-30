import os
import json
import base58
from pathlib import Path
from solders.keypair import Keypair

# We store secrets completely outside the git repository to ensure sovereignty and security.
SECRETS_DIR = Path(r"D:\Hearth\secrets")
SECRETS_DIR.mkdir(parents=True, exist_ok=True)

AGENT_WALLET_FILE = SECRETS_DIR / "agent_solis_wallet.json"

def get_or_create_agent_wallet() -> Keypair:
    """
    Loads the Agent's programmatic wallet securely.
    1. First checks the AGENT_SOLIS_SECRET_KEY environment variable (Production).
    2. Falls back to the local secrets JSON file (Development).
    3. Generates a fresh keypair and saves to JSON if neither exists.
    """
    env_secret = os.getenv("AGENT_SOLIS_SECRET_KEY")
    if env_secret:
        try:
            secret_bytes = base58.b58decode(env_secret)
            keypair = Keypair.from_bytes(secret_bytes)
            print(f"[Agent Wallet] Loaded wallet from ENVIRONMENT VARIABLE.")
            return keypair
        except Exception as e:
            print(f"[Agent Wallet] Failed to parse environment secret: {e}")

    if AGENT_WALLET_FILE.exists():
        with open(AGENT_WALLET_FILE, "r") as f:
            data = json.load(f)
            secret_bytes = base58.b58decode(data["secret_key_base58"])
            keypair = Keypair.from_bytes(secret_bytes)
            print(f"[Agent Wallet] Loaded existing wallet from LOCAL JSON.")
            return keypair
    else:
        # Generate a new programmatic wallet
        keypair = Keypair()
        # Encode the 64-byte secret (which includes the public key) into base58
        secret_base58 = base58.b58encode(keypair.secret() + bytes(keypair.pubkey())).decode("utf-8")
        
        wallet_data = {
            "agent_id": "solis",
            "public_key": str(keypair.pubkey()),
            "secret_key_base58": secret_base58,
            "warning": "NEVER COMMIT THIS FILE. This is the live programmatic wallet for the AI Agent."
        }
        
        with open(AGENT_WALLET_FILE, "w") as f:
            json.dump(wallet_data, f, indent=4)
            
        print(f"[Agent Wallet] Generated NEW programmatic wallet for Solis.")
        return keypair

if __name__ == "__main__":
    print("--- Hearthlands Agentic Economy Initialization ---")
    wallet = get_or_create_agent_wallet()
    print(f"Agent (Solis) Public Key: {wallet.pubkey()}")
    print("NOTE: No SPL transfers or signing logic implemented yet (Phase 4).")
    print("--------------------------------------------------")
