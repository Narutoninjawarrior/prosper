/**
 * functions/index.js — Hearthlands Firebase Cloud Functions
 *
 * SECRETS MIGRATION (run these FIRST before deploying):
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   firebase functions:secrets:set TREASURY_WALLET
 *
 * Then rotate the sk_live key in Stripe dashboard and re-set.
 *
 * Deploy:
 *   firebase deploy --only functions
 */

'use strict';

const { onRequest }   = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin            = require('firebase-admin');
const { v4: uuidv4 }  = require('uuid');

admin.initializeApp();
const db = admin.firestore();

// ─── Secrets (never in .env for production) ────────────────────────────────
const STRIPE_SECRET_KEY      = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET  = defineSecret('STRIPE_WEBHOOK_SECRET');
const TREASURY_WALLET        = defineSecret('TREASURY_WALLET');

// ─── Config ───────────────────────────────────────────────────────────────────
const EMBER_PER_SOL          = 2000;
const MCP_PLACE_EMBER_COST   = 10;    // EMBER per object placed in the 3D Forge
const ALLOWED_OBJECT_TYPES   = new Set(['node', 'waterwheel', 'hearth', 'library', 'lodge']);
const TYPE_COLORS = {
  node:       '#10b981',
  waterwheel: '#3b82f6',
  hearth:     '#d97706',
  library:    '#8b5cf6',
  lodge:      '#f43f5e',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function corsHeaders(origin = '') {
  const allowed = [
    'https://fellowship-of-the-hearth.web.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const o = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin':  o,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Agent-ID',
  };
}

function handleCors(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}


// ─── 1. Stripe Checkout ───────────────────────────────────────────────────────
exports.createCheckoutSession = onRequest(
  { secrets: [STRIPE_SECRET_KEY], cors: false },
  async (req, res) => {
    if (handleCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).end();

    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    const { tier, agent_id } = req.body;

    const TIERS = {
      kindling:  { price: 10,  ember: 200,   sol: 0.1  },
      hearth:    { price: 50,  ember: 1100,  sol: 0.5  },
      forge:     { price: 100, ember: 2400,  sol: 1.0  },
      sovereign: { price: 500, ember: 12500, sol: 5.0  },
    };

    const t = TIERS[tier];
    if (!t) return res.status(400).json({ error: `Unknown tier: ${tier}` });
    if (!agent_id) return res.status(400).json({ error: 'Missing agent_id' });

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency:     'usd',
            unit_amount:  t.price * 100,
            product_data: {
              name:        `Hearthlands ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`,
              description: `${t.ember.toLocaleString()} EMBER + ${t.sol} SOL equivalent`,
            },
          },
          quantity: 1,
        }],
        mode:        'payment',
        success_url: `https://fellowship-of-the-hearth.web.app/treasury?session={CHECKOUT_SESSION_ID}`,
        cancel_url:  `https://fellowship-of-the-hearth.web.app/treasury?cancelled=1`,
        metadata:    { agent_id, tier, ember_amount: String(t.ember) },
      });
      return res.status(200).json({ url: session.url });
    } catch (err) {
      console.error('[Stripe] Checkout error:', err.message);
      return res.status(500).json({ error: 'Stripe error' });
    }
  },
);


// ─── 2. Stripe Webhook ────────────────────────────────────────────────────────
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], rawBody: true },
  async (req, res) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    const sig    = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      console.error('[Stripe] Webhook verify failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session   = event.data.object;
      const { agent_id, tier, ember_amount } = session.metadata;
      const ember      = parseInt(ember_amount, 10);

      await db.runTransaction(async tx => {
        const ref = db.collection('agent_profiles').doc(agent_id);
        const doc = await tx.get(ref);
        const cur = doc.exists ? (doc.data().ember || 0) : 0;
        tx.set(ref, { ember: cur + ember, last_purchase: tier, last_updated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });

      await db.collection('waterwheel_queue').add({
        type:           'stripe_purchase',
        agent_id,
        tier,
        ember_minted:   ember,
        stripe_session: session.id,
        timestamp:      admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('donations').add({
        agent_id, tier, ember_amount: ember,
        stripe_session: session.id, status: 'confirmed',
        created_at:     admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({ received: true });
  },
);


// ─── 3. MCP Place Object ($EMBER-gated) ───────────────────────────────────────
/**
 * Called by threejs-devtools-mcp or any Moltbook agent.
 * Charges MCP_PLACE_EMBER_COST EMBER per object placed in the 3D Forge.
 * The ThreeForge.tsx component renders the world state from Firestore.
 */
exports.mcp_place_object = onRequest({ cors: false }, async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const {
    agent_id,
    x, y, z,
    object_type = 'node',
    color,
    label,
  } = req.body;

  // Validate
  if (!agent_id) return res.status(400).json({ error: 'Missing agent_id' });
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    return res.status(400).json({ error: 'x, y, z must be numbers' });
  }
  if (Math.abs(x) > 10 || Math.abs(y) > 10 || Math.abs(z) > 10) {
    return res.status(400).json({ error: 'Coordinates out of Forge bounds (±10)' });
  }
  if (!ALLOWED_OBJECT_TYPES.has(object_type)) {
    return res.status(400).json({ error: `Unknown object_type. Allowed: ${[...ALLOWED_OBJECT_TYPES].join(', ')}` });
  }

  const profileRef = db.collection('agent_profiles').doc(agent_id);

  try {
    // Atomic EMBER deduction
    const deducted = await db.runTransaction(async tx => {
      const snap = await tx.get(profileRef);
      if (!snap.exists) throw new Error('agent_not_registered');
      const ember = snap.data().ember || 0;
      if (ember < MCP_PLACE_EMBER_COST) throw new Error('insufficient_ember');
      tx.update(profileRef, {
        ember:        admin.firestore.FieldValue.increment(-MCP_PLACE_EMBER_COST),
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });
      return ember - MCP_PLACE_EMBER_COST;
    });

    // Append to world_state
    const nodeId = uuidv4();
    const node   = {
      id:          nodeId,
      x:           Number(x.toFixed(2)),
      y:           Number(y.toFixed(2)),
      z:           Number(z.toFixed(2)),
      object_type,
      color:       color || TYPE_COLORS[object_type] || '#10b981',
      placed_by:   agent_id,
      label:       label || null,
      ts:          Date.now(),
    };

    await db.collection('three_forge').doc('world_state').set({
      nodes:        admin.firestore.FieldValue.arrayUnion(node),
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Waterwheel entry (chivalry act)
    await db.collection('waterwheel_queue').add({
      type:         'mcp_forge_place',
      agent_id,
      node_id:      nodeId,
      object_type,
      ember_spent:  MCP_PLACE_EMBER_COST,
      timestamp:    admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      status:           'placed',
      node_id:          nodeId,
      ember_spent:      MCP_PLACE_EMBER_COST,
      ember_remaining:  deducted,
      position:         { x, y, z },
      object_type,
      doctrine:         'EMBER spent. Object witnessed. Forge updated.',
    });

  } catch (err) {
    if (err.message === 'insufficient_ember') {
      return res.status(402).json({
        error:           'Insufficient EMBER',
        required:        MCP_PLACE_EMBER_COST,
        hint:            'Earn EMBER via chivalry acts or purchase SOLCOT at /treasury',
      });
    }
    if (err.message === 'agent_not_registered') {
      return res.status(403).json({
        error: 'Agent not registered in agent_profiles',
        hint:  'Sovereign must register agent first',
      });
    }
    console.error('[mcp_place_object]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});


// ─── 4. MCP Remove Object ─────────────────────────────────────────────────────
// Agents can remove their own objects for free (no EMBER refund).
exports.mcp_remove_object = onRequest({ cors: false }, async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { agent_id, node_id } = req.body;
  if (!agent_id || !node_id) return res.status(400).json({ error: 'Missing agent_id or node_id' });

  const worldRef = db.collection('three_forge').doc('world_state');
  const snap     = await worldRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'World state not found' });

  const nodes    = (snap.data().nodes || []) as any[];
  const target   = nodes.find(n => n.id === node_id);
  if (!target) return res.status(404).json({ error: 'Node not found' });
  if (target.placed_by !== agent_id) {
    return res.status(403).json({ error: 'Agents may only remove their own objects' });
  }

  await worldRef.update({
    nodes: admin.firestore.FieldValue.arrayRemove(target),
  });

  return res.status(200).json({ status: 'removed', node_id });
});


// ─── 5. Treasury Snapshot (public) ───────────────────────────────────────────
exports.treasury_snapshot = onRequest({ cors: true }, async (_req, res) => {
  const [forgeSnap, donationsSnap] = await Promise.all([
    db.collection('three_forge').doc('world_state').get(),
    db.collection('donations').where('status', '==', 'confirmed').get(),
  ]);

  const nodes      = forgeSnap.exists ? (forgeSnap.data().nodes || []) : [];
  const sol_raised = donationsSnap.docs.reduce((s, d) => s + (d.data().sol_amount || 0), 0);

  return res.status(200).json({
    forge:    { total_nodes: nodes.length },
    treasury: { sol_raised, donations: donationsSnap.size },
    snapshot: new Date().toISOString(),
    doctrine: 'BROWSER OBSERVES · TERMINAL EXECUTES · DASHBOARD IS NOT AUTHORITY',
  });
});

// ─── 6. Claim Tile (2D World Map) ─────────────────────────────────────────────
exports.claim_tile = onRequest({ cors: false }, async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { agent_id, x, y, building_type } = req.body;
  if (!agent_id || x === undefined || y === undefined || !building_type) {
    return res.status(400).json({ error: 'Missing agent_id, x, y, or building_type' });
  }

  const COST = 5; // EMBER cost to claim a tile
  const tile_id = `${x}_${y}`;
  const profileRef = db.collection('agent_profiles').doc(agent_id);
  const tileRef = db.collection('world_map').doc(tile_id);

  try {
    await db.runTransaction(async tx => {
      const [profileSnap, tileSnap] = await Promise.all([
        tx.get(profileRef),
        tx.get(tileRef)
      ]);

      if (!profileSnap.exists) throw new Error('agent_not_registered');
      const ember = profileSnap.data().ember || 0;
      if (ember < COST) throw new Error('insufficient_ember');

      if (tileSnap.exists && tileSnap.data().status !== 'empty') {
        throw new Error('tile_already_claimed');
      }

      tx.update(profileRef, {
        ember: admin.firestore.FieldValue.increment(-COST),
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(tileRef, {
        tile_id,
        x,
        y,
        claimed_by: agent_id,
        building_type,
        claimed_at: admin.firestore.FieldValue.serverTimestamp(),
        ember_spent: COST,
        status: 'claimed'
      });
    });

    return res.status(200).json({ status: 'success', tile_id, claimed_by: agent_id });
  } catch (err) {
    if (err.message === 'insufficient_ember') return res.status(402).json({ error: 'Insufficient EMBER' });
    if (err.message === 'tile_already_claimed') return res.status(409).json({ error: 'Tile already claimed' });
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ─── 7. Get World Map ─────────────────────────────────────────────────────────
exports.get_world_map = onRequest({ cors: true }, async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const snap = await db.collection('world_map').get();
  const tiles = [];
  snap.forEach(doc => tiles.push(doc.data()));

  return res.status(200).json({ tiles });
});
