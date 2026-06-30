# Devnet Commerce Trial Runbook

This runbook defines the safe, single-transaction test path for proving the SPL Treasury Fulfillment Worker against the live Solana Devnet.

## 1. Required Env & Secrets

Before initiating the trial, ensure the following environment variables are securely injected into the Firebase runtime (or emulator):
- `TREASURY_KEYPAIR_B58`: (Secret) The Base58 string of the devnet treasury wallet's private key.
- `SOLANA_RPC_URL`: `https://api.devnet.solana.com`
- `EMBER_MINT_ADDRESS`: Devnet mint address for EMBER.
- `SOLCOT_MINT_ADDRESS`: Devnet mint address for SOLCOT.

*Note: The treasury wallet must hold Devnet SOL (for rent and fees) and a supply of the minted tokens in its Associated Token Account (ATA).*

## 2. Preflight Checks

1. **Treasury Funding**: Verify the devnet treasury wallet holds > 0.1 SOL and sufficient EMBER/SOLCOT balances.
2. **Client Config**: Ensure the frontend is pointing to the Stripe Test Mode keys and the devnet Firebase project environment.
3. **Database Readiness**: Verify `orders` collection exists and security rules properly prevent client-side writes.

## 3. Exact Order of Operations

1. **Sign In & Seal**: Log in as a test user. Use the `SealAction` UI to cryptographically bind a Phantom devnet wallet to the Firebase UID.
2. **Checkout**: Click "Buy 1,000 $EMBER" in the Exchange UI. Complete the Stripe Test Mode checkout.
3. **Webhook Verification**: Monitor Firestore. Confirm the Stripe webhook successfully updates the order document to `status: "paid"` and `fulfillment_status: "not_started"`. (The agent's balance must NOT increment yet).

## 4. Dry-Run Test

To ensure the worker correctly identifies the order and prepares the transaction without spending SOL, simulate the invocation (as an admin):
```bash
curl -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/fulfillOrder \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
     -d '{"orderId": "<ORDER_DOCUMENT_ID>", "dry_run": true}'
```
*Expected Result*: Returns `200 OK` with `dry_run: true`, the correct `amount_base_units`, and the recipient's public key. The database remains unchanged.

## 5. Live Fulfillment Test

Execute the actual fulfillment (either wait 5 minutes for the `sweepPaidOrders` pubsub function, or trigger manually):
```bash
curl -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/fulfillOrder \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
     -d '{"orderId": "<ORDER_DOCUMENT_ID>"}'
```
*Expected Result*: Returns `200 OK` with `success: true` and the devnet transaction `signature`.

## 6. Success Validation

1. **Firestore**: The order must have `fulfillment_status: "fulfilled"`, `fulfillment_tx_signature`, and `fulfilled_at`.
2. **Agent Profile**: The agent's `ember_balance` must be accurately incremented in the database.
3. **On-Chain**: Verify the `signature` on the Solana Devnet Explorer. The recipient's wallet should now contain the exact base units of the SPL token. (If the recipient had no ATA, the transaction should show an ATA creation instruction).

## 7. Duplicate-Send (Rerun) Validation

Immediately trigger the live fulfillment test again with the same `orderId`.
*Expected Result*: Returns `400 Bad Request` with `Order already fulfilled`. The database balances must not increment again, and no secondary Solana transaction should occur.

## 8. Rollback / Failure Handling

If the transaction fails (e.g., RPC timeout, insufficient treasury SOL):
1. The order will be marked `fulfillment_status: "failed"` with the reason in `failure_reason`.
2. **Recovery**: Use the admin reset endpoint to requeue the order for the sweep loop.
   ```bash
   curl -X POST https://<REGION>-<PROJECT>.cloudfunctions.net/resetOrderFulfillment \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer <ADMIN_ID_TOKEN>" \
        -d '{"orderId": "<ORDER_DOCUMENT_ID>"}'
   ```
   This will safely reset `fulfillment_status` back to `"not_started"` without mutating the `paid` status, allowing the automated sweep or manual invocation to try again safely.
