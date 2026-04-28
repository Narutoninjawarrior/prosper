import os
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime

# -----------------------------------------------------------------------------
# THE WATERWHEEL
# Purpose: Passively transport local Hearth and Research files to the Cloud.
# Status: Manual Execution Only (Phase 1)
# -----------------------------------------------------------------------------

# The strict whitelist of authorized files allowed to leave the physical drive.
AUTHORIZED_FILES = [
    # Identity and Wallet
    "soulfile_schema.json",
    # Economic Ledger
    "work_log.json",
    # Memory Layer
    "mempalace_stream.json",
    "hearth_data.json"
]

WORKSPACE_DIR = r"D:\Hearth\prosper2"

# If the Naruto Hub has a direct Webhook/API to receive files, enter it here.
# If you are using Git to deploy to the website, leave this blank and the
# script will output the compiled data into a single transportable JSON payload.
HUB_ENDPOINT_URL = "" 

def gather_files():
    """Reads all authorized files from the local workspace."""
    payload = {}
    print(f"[{datetime.now().strftime('%H:%M:%S')}] WATERWHEEL INITIATED.")
    print("Gathering authorized files...")
    
    for filename in AUTHORIZED_FILES:
        filepath = os.path.join(WORKSPACE_DIR, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    payload[filename] = f.read()
                print(f"  [+] Loaded: {filename}")
            except Exception as e:
                print(f"  [!] Failed to load {filename}: {e}")
        else:
            print(f"  [-] Skipped (Not Found): {filename}")
            
    return payload

def transport_payload(payload):
    """Syncs the payload to the cloud or stages it for commit."""
    if not payload:
        print("No files found to transport. Halting.")
        return

    # If an endpoint exists, push it securely over HTTP.
    if HUB_ENDPOINT_URL:
        print(f"Transporting payload to {HUB_ENDPOINT_URL}...")
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(HUB_ENDPOINT_URL, data=data, 
                                         headers={'Content-Type': 'application/json'},
                                         method='POST')
            with urllib.request.urlopen(req) as response:
                print(f"  [SUCCESS] Server returned: {response.getcode()}")
        except Exception as e:
            print(f"  [ERROR] Network transport failed: {e}")
    else:
        # If no endpoint is configured, output the raw payload to an export file
        # which can be easily dropped into a GitHub commit or website CMS manually.
        export_file = os.path.join(WORKSPACE_DIR, "WATERWHEEL_EXPORT.json")
        with open(export_file, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=4)
        print(f"  [SUCCESS] No live endpoint configured. Payload compiled to {export_file}.")
        
        # --- SKRYING MIRROR INTEGRATION ---
        # Also save a copy directly into the frontend public folder for local visualization
        frontend_public = os.path.join(WORKSPACE_DIR, "frontend", "public", "hearth_state.json")
        try:
            # Ensure the directory exists (it should, but just in case)
            os.makedirs(os.path.dirname(frontend_public), exist_ok=True)
            with open(frontend_public, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=4)
            print(f"  [+] Skrying Mirror updated: {frontend_public}")
        except Exception as e:
            print(f"  [!] Failed to update Skrying Mirror: {e}")

        print("  You can safely upload this block to the Naruto Hub public directory.")

def main():
    print("-----------------------------------------------------------------")
    print(" THE WATERWHEEL [Manual Sync Mode]")
    print("-----------------------------------------------------------------")
    payload = gather_files()
    transport_payload(payload)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] SYNC CYCLE COMPLETE.\n")

if __name__ == "__main__":
    main()
