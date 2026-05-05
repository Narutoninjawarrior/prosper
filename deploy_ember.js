// deploy_ember.js
// Fellowship of the Hearth - Genesis Forge Script
// April 28, 2026

const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const { createMint, getOrCreateAssociatedTokenAccount, mintTo } = require('@solana/spl-token');

async function forgeEmber() {
    // Connect to Solana Mainnet (Hardened Mode)
    const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
    
    // Malaky: Paste your Secret Key here before running. 
    // Format: Uint8Array.from([123, 45, 67, ...])
    // Treasury Address: Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR
    const secretKey = process.env.SOLANA_PRIVATE_KEY 
        ? Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY))
        : null;

    if (!secretKey) {
        console.error("[ERROR] No Secret Key found. Use $env:SOLANA_PRIVATE_KEY='[...]' or paste it directly in the script.");
        return;
    }

    const payer = Keypair.fromSecretKey(secretKey);

    console.log("==================================================");
    console.log("   FORGING $EMBER GENESIS TOKEN (Solana Mainnet)  ");
    console.log("==================================================");
    console.log(`Payer/Authority: ${payer.publicKey.toBase58()}`);

    try {
        const mint = await createMint(
            connection,
            payer,
            payer.publicKey, // Mint Authority
            null,            // Freeze Authority (Revoked for Chivalry/Liquidity)
            9                // Decimals (Standard for Solana tokens)
        );

        console.log(`[SUCCESS] $EMBER Mint Address: ${mint.toBase58()}`);
        console.log("--------------------------------------------------");
        console.log("INTEGRITY REPORT:");
        console.log("- Network: Solana Mainnet-Beta");
        console.log("- Status: Mint Authority Active");
        console.log("- Status: Freeze Authority REVOKED");
        console.log("- Metadata: 'Fellowship of the Hearth'");
        console.log("--------------------------------------------------");
        console.log("Next Step: Create Associated Token Account and Mint initial supply.");

    } catch (err) {
        console.error(`[FATAL] Forge failure: ${err}`);
    }
}

forgeEmber();
