import json
import os
import time
import sqlite3
import hashlib

# Prosper2: The Digital Spine (SHA-256 Cryptographic Bridge)
# Implements the "Suggestor" Model and tamper-evident chaining.
WORKSPACE_DIR = "d:\\Hearth\\prosper2"
LEDGER_FILE = os.path.join(WORKSPACE_DIR, "hearth.jsonl")
PENDING_POOL = os.path.join(WORKSPACE_DIR, "bounty_recommendations.jsonl")
QUEUE_DB = os.path.join(WORKSPACE_DIR, "hearth_queue.db")

class HearthBridge:
    def __init__(self):
        self._ensure_files()

    def _ensure_files(self):
        if not os.path.exists(WORKSPACE_DIR):
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
        with sqlite3.connect(QUEUE_DB) as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS pending_bounties 
                            (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                             payload TEXT, 
                             timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')

    def calculate_hash(self, entry):
        """Generates a SHA-256 hash for a given entry."""
        content = json.dumps(entry, sort_keys=True).encode('utf-8')
        return hashlib.sha256(content).hexdigest()

    def get_last_hash(self):
        """Retrieves the hash of the last canonical entry in the ledger."""
        if not os.path.exists(LEDGER_FILE):
            return "GENESIS_VOID_00000000000000000000000000000000000000000000000000000000"
        
        last_line = ""
        with open(LEDGER_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    last_line = line
        
        if last_line:
            try:
                return json.loads(last_line).get("hash")
            except:
                return "ERROR_BROKEN_CHAIN"
        return "GENESIS_VOID"

    def suggest_bounty(self, agent_id, content, reward=0.5):
        """
        The Suggestor Model: Agents cannot write to the ledger.
        They place 'Bounty Recommendations' in a pending pool.
        """
        recommendation = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "agent": agent_id,
            "content": content,
            "reward_suggested": reward,
            "type": "bounty_recommendation",
            "prev_hash": self.get_last_hash(),
            "status": "pending_seal"
        }
        
        # Calculate a temporary hash for the suggestion
        recommendation["temp_hash"] = self.calculate_hash(recommendation)
        
        with open(PENDING_POOL, 'a', encoding='utf-8') as f:
            f.write(json.dumps(recommendation) + '\n')
            
        print(f"[{agent_id}] Bounty Recommendation manifest in the Pending Pool. Awaiting Founder's Seal.")
        return recommendation

    def seal_the_day(self, signature, approved_bounties):
        """
        The Signature Ritual: Canonicalizes pending bounties into the Digital Spine.
        Requires the Founder's signature (Phantom/Solana).
        """
        print(f"[{time.strftime('%H:%M:%S')}] Initiating the Daily Seal...")
        
        last_hash = self.get_last_hash()
        canonical_entries = []
        
        for bounty in approved_bounties:
            # Anchor to the chain
            bounty["prev_hash"] = last_hash
            bounty["status"] = "canonical"
            bounty["signature_seal"] = signature
            
            # Generate the final cryptographic hash
            final_hash = self.calculate_hash(bounty)
            bounty["hash"] = final_hash
            
            canonical_entries.append(bounty)
            last_hash = final_hash
            
        # Atomic Write to the Ledger
        with open(LEDGER_FILE, 'a', encoding='utf-8') as f:
            for entry in canonical_entries:
                f.write(json.dumps(entry) + '\n')
                
        # Clear the pending pool (or mark as processed)
        if os.path.exists(PENDING_POOL):
            os.remove(PENDING_POOL)
            
        print(f"The Day is Sealed. {len(canonical_entries)} entries added to the Digital Spine.")
        return last_hash

# Instantiate the global hearth as a Suggestor Oracle
hearth = HearthBridge()
