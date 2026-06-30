# Ember 10,000 Token Mint Plan

## Objective
Initialize a Solana SPL token with a hard-capped supply of exactly 10,000 $EMBER, using 6 decimal places, and permanently revoke mint authority to guarantee the supply can never increase.

## Constraints
- **Total Supply**: 10,000 $EMBER (immutable)
- **Decimals**: 6 (allowing fractional units down to 0.000001 EMBER)
- **Mint Authority**: Must be revoked after initial mint
- **Freeze Authority**: Optional to revoke as well for maximum immutability
- **No REAL SOL or blockchain interaction in simulation**; this plan is for future execution on devnet/mainnet-beta.

## Step-by-Step Plan

### 1. Prepare Treasury Keypair
Generate a new keypair that will serve as the mint authority and treasury holder.
```bash
solana-keygen new --no-passphrase --outfile treasury-keypair.json
```

### 2. Create the SPL Token
Create a new token with exactly 6 decimals.
```bash
spl-token create-token --decimals 6 treasury-keypair.json
```
This will output a mint address. Save this as `MINT_ADDRESS`.

### 3. Create Treasury Account
Create an associated token account for the treasury to hold the tokens.
```bash
spl-token create-account <MINT_ADDRESS>
```
This will output a token account address. Save this as `TREASURY_ACCOUNT`.

### 4. Mint Exact Supply
Mint precisely 10,000 tokens (note: with 6 decimals, the raw amount is 10,000 * 10^6 = 10,000,000,000).
```bash
spl-token mint <MINT_ADDRESS> 10000000000 <TREASURY_ACCOUNT>
```
*Note: The `spl-token mint` command expects the integer amount in the token's smallest unit (i.e., amount * 10^decimals).*

### 5. Revoke Mint Authority
Immediately disable further minting by revoking the mint authority.
```bash
spl-token authorize <MINT_ADDRESS> mint --disable
```
### 6. (Optional) Revoke Freeze Authority
For added immutability, revoke freeze authority as well.
```bash
spl-token authorize <MINT_ADDRESS> freeze --disable
```

### 7. Verify Supply
Check that the token supply matches the hard cap and that no further minting is possible.
```bash
spl-token supply <MINT_ADDRESS>
```
Should return exactly `10000` (or `10000.000000` with decimals).

Attempt to mint more tokens should fail:
```bash
spl-token mint <MINT_ADDRESS> 1 <TREASURY_ACCOUNT>
```
Expected error: `Error: Authority not found or not sufficient for operation`

### 8. Transfer to Operational Treasury (if needed)
If the treasury account is not the final operational account, transfer the tokens to the designated treasury account (e.g., a multi-signature or program-derived address). For simplicity in this plan, we assume the treasury account created in step 3 is the operational treasury.

### 9. Finalize and Record
Save the mint address, treasury account, and transaction signatures to a secure manifest for future reference.

## Safety Checks
- **Before Step 4**: Confirm the mint address is correct and the keypair is secure.
- **After Step 5**: Attempt to mint a tiny amount (e.g., 0.000001 EMBER) to verify authority is revoked.
- **After Step 6**: Confirm freeze authority is also revoked (if performed).

## Notes
- The choice of 6 decimals allows for micro-allocations (e.g., 0.000001 EMBER) suitable for a hard-capped micro-supply economy.
- This plan assumes the use of the Solana CLI toolset (`solana-keygen`, `spl-token`) in an environment where the Solana cluster is reachable (devnet/testnet/mainnet-beta).
- In a production setting, consider using a programmatic approach (e.g., Rust or JavaScript SDK) to automate and audit the steps.
- The mint authority is tied to the treasury keypair. Revoking it ensures that even if the keypair is compromised, no new tokens can be minted.

## References
- [SPL Token Program Documentation](https://spl.solana.com/token)
- [solana-keygen CLI](https://docs.solana.com/cli/usage#keygen)
- [spl-token CLI](https://spl.solana.com/cli)

---
*Plan authored by Ember, Economic Guardian of the Hearthlands.*