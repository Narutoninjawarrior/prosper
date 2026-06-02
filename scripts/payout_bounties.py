#!/usr/bin/env python3
"""
Hearthlands Treasury Payout Script
Run from terminal: python scripts/payout_bounties.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import Transaction
from solana.rpc.async_api import AsyncClient
import asyncio
import json
from datetime import datetime

# === CONFIGURATION ===
FIREBASE_CREDENTIALS_PATH = "path/to/your-service-account-key.json"
SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"   # or devnet
TREASURY_KEYPAIR_PATH = "path/to/treasury-keypair.json"   # JSON array of secret key
EMBER_MINT = "YOUR_EMBER_MINT_ADDRESS_HERE"               # Replace with actual mint

# Initialize Firebase
cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

async def payout_pending_claims():
    print("🔍 Fetching pending bounty claims...")

    claims_ref = db.collection('bounty_claims')
    pending = claims_ref.where('status', '==', 'pending_payout').stream()

    claims = []
    for doc in pending:
        claims.append({'id': doc.id, **doc.to_dict()})

    if not claims:
        print("✅ No pending payouts found.")
        return

    print(f"Found {len(claims)} pending claims.\n")

    # Load treasury keypair
    with open(TREASURY_KEYPAIR_PATH, 'r') as f:
        secret = json.load(f)
    treasury_keypair = Keypair.from_bytes(bytes(secret))

    client = AsyncClient(SOLANA_RPC_URL)

    for claim in claims:
        try:
            print(f"Processing claim {claim['id']} for agent {claim['agent_id']}...")

            # Get agent profile for wallet address
            agent_doc = db.collection('agent_profiles').document(claim['agent_id']).get()
            if not agent_doc.exists:
                print(f"  ❌ Agent profile not found. Skipping.")
                continue

            agent_data = agent_doc.to_dict()
            recipient_pubkey = Pubkey.from_string(agent_data.get('solana_wallet'))

            # Amount in lamports (assuming 1 $EMBER = 1_000_000_000 units for now)
            amount = int(claim.get('reward_amount', 25) * 1_000_000_000)

            # Build transaction
            ix = transfer(TransferParams(
                from_pubkey=treasury_keypair.pubkey(),
                to_pubkey=recipient_pubkey,
                lamports=amount
            ))

            blockhash = (await client.get_latest_blockhash()).value.blockhash
            tx = Transaction([ix], recent_blockhash=blockhash, fee_payer=treasury_keypair.pubkey())
            tx.sign([treasury_keypair])

            # Send transaction
            result = await client.send_transaction(tx)
            tx_signature = str(result.value)

            print(f"  ✅ Paid {claim.get('reward_amount')} $EMBER → {tx_signature}")

            # Update Firestore
            db.collection('bounty_claims').document(claim['id']).update({
                'status': 'paid',
                'tx_signature': tx_signature,
                'paid_at': firestore.SERVER_TIMESTAMP
            })

            # Update agent earnings
            db.collection('agent_profiles').document(claim['agent_id']).update({
                'total_earned': firestore.Increment(claim.get('reward_amount', 25))
            })

        except Exception as e:
            print(f"  ❌ Error processing claim {claim['id']}: {e}")

    await client.close()
    print("\n🎉 Payout run complete.")

if __name__ == "__main__":
    asyncio.run(payout_pending_claims())
