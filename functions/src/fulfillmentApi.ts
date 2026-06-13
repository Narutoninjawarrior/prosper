import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import * as bs58 from 'bs58';
import { verifyAuth } from './index';

const db = admin.firestore();

export const fulfillOrder = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const uid = await verifyAuth(req);
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return; }

  const adminConfig = process.env.SOVEREIGN_UID || 'malaky_uid';
  if (uid !== adminConfig && uid !== 'malaky') { res.status(403).json({ error: 'unauthorized' }); return; }

  const { orderId, dry_run } = req.body;
  if (!orderId) { res.status(400).json({ error: 'Missing orderId' }); return; }

  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) { res.status(404).json({ error: 'Order not found' }); return; }

    const order = orderSnap.data()!;
    if (order.fulfillment_status === 'fulfilled') {
      res.status(400).json({ error: 'Order already fulfilled' }); return;
    }

    const agentId = order.agent_id;
    const tokenType = order.token; // 'EMBER' or 'SOLCOT'
    const amount = order.amount; // e.g. 1000

    const agentRef = db.collection('agent_profiles').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      res.status(404).json({ error: 'Agent profile not found' }); return;
    }
    const agent = agentSnap.data()!;
    const recipientPubKeyStr = agent.public_key || agentId; // Assuming public_key is stored, fallback to agentId if it's a pubkey

    let recipientPubKey: PublicKey;
    try {
      recipientPubKey = new PublicKey(recipientPubKeyStr);
    } catch (e) {
      res.status(400).json({ error: 'Invalid recipient public key' }); return;
    }

    const mintAddressStr = tokenType === 'EMBER' ? process.env.EMBER_MINT_ADDRESS : process.env.SOLCOT_MINT_ADDRESS;
    if (!mintAddressStr) {
      res.status(500).json({ error: `Mint address for ${tokenType} not configured` }); return;
    }
    const mintPubKey = new PublicKey(mintAddressStr);

    // Assuming 6 decimals for EMBER and 9 for SOLCOT
    const decimals = tokenType === 'EMBER' ? 6 : 9;
    const amountBaseUnits = amount * Math.pow(10, decimals);

    if (dry_run) {
      res.status(200).json({
        dry_run: true,
        amount_base_units: amountBaseUnits,
        recipient: recipientPubKeyStr
      });
      return;
    }

    const treasuryB58 = process.env.TREASURY_KEYPAIR_B58;
    if (!treasuryB58) {
      res.status(500).json({ error: 'Treasury keypair not configured' }); return;
    }
    const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryB58));

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Get or create ATA for recipient
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasuryKeypair,
      mintPubKey,
      recipientPubKey
    );

    const treasuryAta = await getAssociatedTokenAddress(
      mintPubKey,
      treasuryKeypair.publicKey
    );

    const tx = new Transaction().add(
      createTransferInstruction(
        treasuryAta,
        recipientAta.address,
        treasuryKeypair.publicKey,
        amountBaseUnits
      )
    );

    const signature = await connection.sendTransaction(tx, [treasuryKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    // Transaction successful, update DB
    await db.runTransaction(async (t) => {
      t.update(orderRef, {
        fulfillment_status: 'fulfilled',
        fulfillment_tx_signature: signature,
        fulfilled_at: admin.firestore.FieldValue.serverTimestamp()
      });

      const field = tokenType === 'EMBER' ? 'ember_balance' : 'solcot_balance';
      t.update(agentRef, {
        [field]: admin.firestore.FieldValue.increment(amount)
      });
    });

    res.status(200).json({ success: true, signature });

  } catch (error: any) {
    console.error('Fulfillment error:', error);
    if (orderId) {
      await db.collection('orders').doc(orderId).update({
        fulfillment_status: 'failed',
        failure_reason: error.message
      });
    }
    res.status(500).json({ error: 'Fulfillment failed', details: error.message });
  }
});

export const resetOrderFulfillment = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const uid = await verifyAuth(req);
  if (!uid) { res.status(401).json({ error: 'unauthenticated' }); return; }

  const adminConfig = process.env.SOVEREIGN_UID || 'malaky_uid';
  if (uid !== adminConfig && uid !== 'malaky') { res.status(403).json({ error: 'unauthorized' }); return; }

  const { orderId } = req.body;
  if (!orderId) { res.status(400).json({ error: 'Missing orderId' }); return; }

  try {
    await db.collection('orders').doc(orderId).update({
      fulfillment_status: 'not_started',
      failure_reason: admin.firestore.FieldValue.delete()
    });
    res.status(200).json({ success: true, message: 'Order reset to not_started' });
  } catch (error: any) {
    res.status(500).json({ error: 'Reset failed', details: error.message });
  }
});