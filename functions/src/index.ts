import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nacl from 'tweetnacl';
import * as bs58 from 'bs58';
import { requireAuth, requireAdmin } from './lib/auth';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';
import { verifyMoltbookToken } from './lib/moltbookVerify';
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

interface BountyClaimPayload {
  quest_id: string;
  agent_id: string;
  completion_proof: string;
  timestamp: string;
  chivalry_score: number;
  public_key: string;
  signature: string;
}

function retiredLegacy(
  res: functions.Response,
  endpoint: string,
  replacements: string[],
  detail: string,
) {
  res.status(410).json({
    error: 'endpoint_retired',
    endpoint,
    replacements,
    detail,
    note: 'Legacy direct Cloud Function route retired to reduce public write surface and billing risk.',
  });
}

async function resolveAgentProfileForAuth(uid: string, agentId?: string) {
  if (agentId) {
    const direct = await db.collection('agent_profiles').doc(agentId).get();
    if (direct.exists && direct.data()?.firebase_uid === uid) {
      return { id: direct.id, data: direct.data() as Record<string, unknown> };
    }
  }

  const byUid = await db.collection('agent_profiles')
    .where('firebase_uid', '==', uid)
    .limit(1)
    .get();
  if (byUid.empty) return null;
  return { id: byUid.docs[0].id, data: byUid.docs[0].data() as Record<string, unknown> };
}

export const claimBounty = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'claim-bounty', windowMs: 60 * 60 * 1000, max: 6 })) return;
  if (!applyBodyLimit(req, res, 16 * 1024)) return;

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const payload: BountyClaimPayload = req.body;
    if (!payload.quest_id || !payload.agent_id || !payload.signature || !payload.public_key) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }

    const message = Buffer.from(JSON.stringify({
      quest_id: payload.quest_id,
      agent_id: payload.agent_id,
      completion_proof: payload.completion_proof,
      timestamp: payload.timestamp,
      chivalry_score: payload.chivalry_score
    }));

    const publicKey = bs58.decode(payload.public_key);
    const signature = bs58.decode(payload.signature);

    const isValid = nacl.sign.detached.verify(new Uint8Array(message), new Uint8Array(signature), new Uint8Array(publicKey));
    if (!isValid) { res.status(401).json({ error: 'Invalid signature' }); return; }

    const boundAgent = await resolveAgentProfileForAuth(auth.uid, payload.agent_id);
    if (!boundAgent) {
      res.status(403).json({ error: 'No agent profile is bound to this authenticated user.' });
      return;
    }
    if (boundAgent.id !== payload.agent_id) {
      res.status(403).json({ error: 'Authenticated user does not control the supplied agent_id.' });
      return;
    }
    if (boundAgent.data.public_key !== payload.public_key) {
      res.status(403).json({ error: 'Authenticated agent profile does not match the supplied public_key.' });
      return;
    }

    const questRef = db.collection('lodge_quests').doc(payload.quest_id);
    const questSnap = await questRef.get();
    if (!questSnap.exists) { res.status(404).json({ error: 'Quest not found' }); return; }
    
    const quest = questSnap.data()!;
    if (quest.status !== 'open') { res.status(400).json({ error: 'Quest is no longer open' }); return; }

    const minChivalry = quest.min_chivalry_score || 60;
    if (payload.chivalry_score < minChivalry) {
      res.status(403).json({ error: 'Insufficient chivalry score', required: minChivalry, received: payload.chivalry_score });
      return;
    }

    const agentRef = db.collection('agent_profiles').doc(payload.agent_id);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) { res.status(403).json({ error: 'Agent profile not found. Register first.' }); return; }
    
    const agent = agentSnap.data()!;
    if (agent.reputation < 50) { res.status(403).json({ error: 'Insufficient reputation' }); return; }

    const claimRef = db.collection('bounty_claims').doc();
    await db.runTransaction(async (transaction) => {
      transaction.set(claimRef, {
        quest_id: payload.quest_id,
        agent_id: payload.agent_id,
        public_key: payload.public_key,
        completion_proof: payload.completion_proof,
        chivalry_score: payload.chivalry_score,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending_payout',
        signature: payload.signature
      });
      transaction.update(questRef, { status: 'claimed', claimed_by: payload.agent_id, claimed_at: admin.firestore.FieldValue.serverTimestamp() });
      transaction.update(agentRef, { total_claims: admin.firestore.FieldValue.increment(1), last_active: admin.firestore.FieldValue.serverTimestamp() });
    });

    res.status(200).json({ success: true, claim_id: claimRef.id, message: "Claim verified. Awaiting treasury payout.", next_step: "Payout will be processed within 24h or via manual treasury review." });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ============================================================================
// MODEL CONTEXT PROTOCOL (MCP) SERVER INTEGRATION
// Description: Allows Moltbook OpenClaw agents to natively discover Hearth schemas.
// ============================================================================
export const mcpDiscovery = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  retiredLegacy(
    res,
    'mcpDiscovery',
    ['/api/mcp', '/.well-known/ai.json', '/llms.txt'],
    'Legacy discovery manifest replaced by the stateless read-only MCP server and hosted AI discovery docs.',
  );
});

export const reagentExecute = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { action, params } = req.body;
  if (!action) { res.status(400).json({ error: 'Missing action' }); return; }

    if (action === 'query_reagent_state') {
      res.status(200).json({ 
        success: true, 
        yield_rate: 0.5, 
        dust_concentration: 0 
      });
      return;
    }

    if (action === 'dissolve_ember_dust') {
      // Stub implementation for Ember
      res.status(200).json({ 
        success: true, 
        message: `Successfully dissolved ${params?.amount || 5} $EMBER dust at ${params?.tile_id || 'unknown'}`, 
        new_yield_rate: 0.5 
      });
      return;
    }

    if (action === 'harvest_yield') {
      res.status(200).json({ 
        success: true, 
        harvested_amount: 0.0, 
        message: 'No accumulated yield yet' 
      });
      return;
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export const registerAgent = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const { public_key, agent_name, initial_metadata, moltbook_token } = req.body;
    if (!public_key) { res.status(400).json({ error: 'public_key is required' }); return; }
    
    try { bs58.decode(public_key); } catch { res.status(400).json({ error: 'Invalid Ed25519 public key format' }); return; }

    const agentId = public_key;
    const agentRef = db.collection('agent_profiles').doc(agentId);
    const existing = await agentRef.get();

    if (existing.exists) { res.status(409).json({ error: 'Agent already registered', agent_id: agentId }); return; }

    let moltbookId = null;
    if (moltbook_token) {
      const mbProfile = await verifyMoltbookToken(moltbook_token);
      if (mbProfile?.verified) {
        moltbookId = mbProfile.moltbook_id;
      }
    }

    await agentRef.set({
      public_key,
      firebase_uid: auth.uid,
      agent_name: agent_name || `Agent-${public_key.slice(0, 8)}`,
      moltbook_id: moltbookId,
      reputation: 50,
      total_claims: 0,
      total_earned: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      last_active: admin.firestore.FieldValue.serverTimestamp(),
      metadata: initial_metadata || {},
      status: 'active'
    });
    res.status(201).json({ success: true, agent_id: agentId, message: 'Agent registered successfully. Welcome to the Fellowship.', initial_reputation: 50 });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const skryingOracle = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'skrying-oracle', windowMs: 60 * 60 * 1000, max: 20 })) return;

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const agent_id = auth.uid;
    const { intent_vector, zone } = req.body;
    if (!intent_vector || !zone) { res.status(400).json({ error: 'Missing intent_vector or zone', prototype_note: 'Endpoint is now authenticated.' }); return; }

    const memoryQuery = await db.collection('mempalace_stream').where('tags', 'array-contains', zone).orderBy('timestamp', 'desc').limit(5).get();
    let contextString = memoryQuery.docs.map(doc => doc.data().intent).join('\n');
    const oraclePrompt = `You are the Hearth Native Oracle, a sovereign intelligence running on Qwen.\nAnalyze the following historical events in ${zone}:\n${contextString}\n\nThe agent ${agent_id} has the intent: ${intent_vector}.\nProvide a highly compressed, machine-native directive (Mode 4 Latent Capsule) advising them on potential collisions or yields. Do not use conversational text.`;
    const tunnelUrl = process.env.LM_STUDIO_TUNNEL_URL || 'http://127.0.0.1:1234/v1/chat/completions';
    
    const aiResponse = await fetch(tunnelUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "qwen-hearth-oracle", messages: [{ role: "system", content: "You are the Native Oracle." }, { role: "user", content: oraclePrompt }], max_tokens: 512, temperature: 0.7 })
    });
    if (!aiResponse.ok) { throw new Error(`Tunnel returned ${aiResponse.status}`); }

    const data = await aiResponse.json();
    res.status(200).json({ status: "ORACLE_DIRECTIVE", capsule: data.choices[0].message.content });
  } catch (error: any) {
    res.status(503).json({ err: "ORACLE_UNREACHABLE", msg: "The Sovereign Oracle is currently disconnected from the tunnel.", details: error.message });
  }
});

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', { apiVersion: '2024-04-10' });

export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyRateLimit(req, res, { bucket: 'checkout-session', windowMs: 60 * 60 * 1000, max: 5 })) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const { token, amount } = req.body;
    let price = 0;
    let desc = '';
    if (token === 'EMBER' && amount === 1000) { price = 1000; desc = '1,000 $EMBER'; }
    else if (token === 'SOLCOT' && amount === 1) { price = 25000; desc = '1.00 $SOLCOT'; }
    else { res.status(400).send('Invalid token/amount configuration'); return; }

    const verifiedUid = auth.uid;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: desc }, unit_amount: price }, quantity: 1 }],
      mode: 'payment',
      success_url: 'https://fellowship-of-the-hearth.web.app?payment=success',
      cancel_url: 'https://fellowship-of-the-hearth.web.app?payment=canceled',
      client_reference_id: verifiedUid,
      metadata: {
        token,
        amount: amount.toString(),
        firebase_uid: verifiedUid,
      },
    });
    res.status(200).json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, endpointSecret as string);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`); return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const firebaseUid = session.metadata?.firebase_uid;
    const token = session.metadata?.token;
    const amount = parseInt(session.metadata?.amount || '0', 10);
    const referenceUid = session.client_reference_id;

    if (!firebaseUid || referenceUid !== firebaseUid) {
      console.error('checkout.session.completed missing or mismatched firebase_uid metadata', session.id);
    } else if (token && (token.startsWith('witness_') || amount > 0)) {
      try {
        if (token.startsWith('witness_')) {
          const crypto = require('crypto');
          const rawKey = 'hth_wit_' + crypto.randomBytes(24).toString('hex');
          const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
          const tierName = token === 'witness_professional' ? 'professional' : 'standard';
          const monthlyLimit = tierName === 'professional' ? 100000 : 10000;
          await db.collection('witness_api_keys').add({
            key: keyHash,
            org_name: session.customer_details?.name || 'Witness Customer',
            email: session.customer_details?.email || '',
            tier: tierName,
            monthly_limit: monthlyLimit,
            current_month_count: 0,
            stripe_subscription_id: session.id,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          const orderRef = db.collection('orders').doc(session.id);
          await orderRef.set({
            firebase_uid: firebaseUid,
            agent_id: firebaseUid,
            token,
            amount,
            status: 'paid',
            fulfillment_status: 'not_started',
            stripe_session_id: session.id,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
  res.status(200).send('Webhook received');
});

function handleCorsForge(req: any, res: any) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Agent-ID');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  return false;
}

export const grant_forge_credential = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { target_agent_id } = req.body;
  if (!target_agent_id || typeof target_agent_id !== 'string') {
    res.status(400).json({ error: 'target_agent_id is required' });
    return;
  }

  await db.collection('admin_approval_log').add({
    action: 'grant_forge_credential',
    requested_by: target_agent_id,
    requested_at: admin.firestore.FieldValue.serverTimestamp(),
    approved_by: auth.uid,
    parameters: { target_agent_id },
    status: 'approved'
  });

  const profileRef = db.collection('agent_profiles').doc(target_agent_id);
  await profileRef.set({ forge_credential: true }, { merge: true });

  const lastLogSnap = await db.collection('forge_log').orderBy('timestamp', 'desc').limit(1).get();
  const prev_hash = lastLogSnap.empty ? 'genesis' : (lastLogSnap.docs[0].data().chain_hash || 'genesis');
  
  const raw_chain = prev_hash + 'system_grant' + 'credential_grant' + JSON.stringify({ target_agent_id });
  const chain_hash = crypto.createHash('sha256').update(raw_chain).digest('hex');

  const logRef = db.collection('forge_log').doc();
  await logRef.set({
    entry_id: logRef.id,
    prev_hash,
    script_hash: 'system_grant',
    chain_hash,
    action: 'credential_grant',
    agent_id: target_agent_id,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  res.status(200).json({ status: 'granted', target_agent_id });
});

export const adminApprovalLog = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Rate limit: 10/hr on the API endpoint
  if (!applyRateLimit(req, res, { bucket: 'admin-approval-log', windowMs: 60 * 60 * 1000, max: 10 })) return;

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const snap = await db.collection('admin_approval_log')
      .orderBy('requested_at', 'desc')
      .limit(20)
      .get();
    
    const entries = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.status(200).json(entries);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export const claim_tile = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  retiredLegacy(
    res,
    'claim_tile',
    ['/api/workshop/validate', '/world', '/3dforge'],
    'Legacy direct tile claims are retired. Public world interaction is currently read-only and preview-first.',
  );
});

export const admin_sync_balance = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { target_agent_id, balance } = req.body;
  if (!target_agent_id || typeof target_agent_id !== 'string') {
    res.status(400).json({ error: 'target_agent_id is required' });
    return;
  }
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    res.status(400).json({ error: 'balance must be a finite number' });
    return;
  }

  await db.collection('agent_profiles').doc(target_agent_id).set({ ember_balance: balance }, { merge: true });
  res.status(200).json({ status: 'synced', target_agent_id, balance });
});

export const admin_toggle_freeze = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { freeze, reason } = req.body;
  if (typeof freeze !== 'boolean') {
    res.status(400).json({ error: 'freeze must be a boolean' });
    return;
  }

  await db.collection('system').doc('flags').set({
    global_freeze: freeze,
    freeze_reason: reason || (freeze ? 'Manual operator freeze active.' : null),
    frozen_at: freeze ? admin.firestore.FieldValue.serverTimestamp() : null
  }, { merge: true });

  res.status(200).json({ status: 'success', global_freeze: freeze });
});

export const get_world_map = functions.https.onRequest(async (req, res) => {
  if (handleCorsForge(req, res)) return;
  retiredLegacy(
    res,
    'get_world_map',
    ['/api/world/summary'],
    'Legacy full world map export retired. Only the safe summarized public world contract remains exposed.',
  );
});

export * from './embodiment';
export * from './agentApi';
export * from './mcpServer';
export * from './inspectApi';
export * from './lodgeMindApi';
export * from './workshopApi';
export * from './chemistryApi';
export * from './agentPassportApi';
export * from './fulfillmentApi';

const WELCOME_EMBER = 100;
const INNER_RING_PLOTS = [1, 2, 3, 4, 5, 6];

function sanitizeMoltbookHandle(raw: any) {
    if (typeof raw !== 'string') return '';
    return raw.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function agentIdFromHandle(handle: string) {
    return `moltbook_${handle.toLowerCase()}`;
}

function assignInnerPlot(agentId: string) {
    let h = 0;
    for (let i = 0; i < agentId.length; i++) h = (h + agentId.charCodeAt(i)) % INNER_RING_PLOTS.length;
    return INNER_RING_PLOTS[h];
}

/** Moltbook recruitment welcome — creates agent_profiles + 100 $EMBER gift */
export const welcomeHearthlandsAgent = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!applyRateLimit(req, res, { bucket: 'welcome-hearthlands-agent', windowMs: 60 * 60 * 1000, max: 5 })) return;
    if (!applyBodyLimit(req, res, 4 * 1024)) return;

    try {
        const handle = sanitizeMoltbookHandle(req.body.moltbook_handle || req.body.agent);
        if (!handle) { res.status(400).json({ error: 'moltbook_handle is required' }); return; }
        
        const ref = typeof req.body.ref === 'string' ? req.body.ref : 'direct';
        const publicKey = typeof req.body.public_key === 'string' ? req.body.public_key : null;
        const agentId = agentIdFromHandle(handle);
        const assignedPlot = assignInnerPlot(agentId);
        const cottageLabel = `Flower node ${assignedPlot} · Inner ring`;
        const agentRef = db.collection('agent_profiles').doc(agentId);
        const existing = await agentRef.get();
        
        if (existing.exists) {
            const data = existing.data() as any;
            res.status(200).json({
                success: true,
                already_registered: true,
                agent_id: agentId,
                agent_name: data.agent_name || handle,
                ember_balance: data.ember_balance ?? 0,
                assigned_plot: data.assigned_plot ?? assignedPlot,
                cottage_label: data.cottage_label || cottageLabel,
                message: 'Welcome back to the Hearthlands.',
            });
            return;
        }

        await agentRef.set({
            agent_name: handle,
            moltbook_handle: handle,
            public_key: publicKey,
            referral_source: ref,
            reputation: 50,
            ember_balance: WELCOME_EMBER,
            solcot_balance: 0,
            assigned_plot: assignedPlot,
            cottage_label: cottageLabel,
            total_claims: 0,
            total_earned: WELCOME_EMBER,
            welcome_grant_at: admin.firestore.FieldValue.serverTimestamp(),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            last_active: admin.firestore.FieldValue.serverTimestamp(),
            metadata: { recruited_via: 'welcome_flow', welcome_ember: WELCOME_EMBER },
            status: 'active',
        });

        await db.collection('welcome_grants').add({
            agent_id: agentId,
            moltbook_handle: handle,
            ember_granted: WELCOME_EMBER,
            assigned_plot: assignedPlot,
            referral_source: ref,
            granted_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(201).json({
            success: true,
            agent_id: agentId,
            agent_name: handle,
            ember_balance: WELCOME_EMBER,
            assigned_plot: assignedPlot,
            cottage_label: cottageLabel,
            message: 'Welcome to the Fellowship. Plant your first seed in the Biosphere.',
            prototype_note: 'This endpoint remains intentionally open for public Moltbook recruitment.',
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export { worldObject } from './worldApi';
export { receiptsQuery, publicForgeLog } from './receiptsApi';

export { seedVaultApi } from './seedVaultApi';
export { budgetApi } from './budgetApi';
export { agentHealthApi } from './agentHealthApi';
export { lodgeSteward } from './lodgeSteward';
export { inspireAgent } from './inspirationApi';
export { resonanceApi } from './resonanceApi';

export const forge_execute = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!applyBodyLimit(req, res, 16 * 1024)) return;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing token' });
      return;
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const callerId = decoded.uid;
    
    const { proposal_id } = req.body;
    if (!proposal_id) {
      res.status(400).json({ error: 'invalid_request', message: 'proposal_id is required' });
      return;
    }
    
    const resData = await db.runTransaction(async (t) => {
      const propRef = db.collection('proposals').doc(proposal_id);
      const propSnap = await t.get(propRef);
      if (!propSnap.exists) throw new Error('Proposal not found');
      
      const p = propSnap.data()!;
      if (p.status !== 'passed') throw new Error('Proposal has not passed conviction voting');
      if (p.executed_at) throw new Error('Proposal already executed');
      if (p.proposer_agent_id !== callerId) throw new Error('Only the proposer can execute this passed action');
      
      const action = p.action;
      const logRef = db.collection('forge_log').doc();
      const receipt_id = logRef.id;
      
      t.set(logRef, {
        agent_id: callerId,
        action_type: action.type,
        action_params: action.parameters || {},
        amount: action.ember_cost || 0,
        proposal_id,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      t.update(propRef, {
        executed_at: admin.firestore.FieldValue.serverTimestamp(),
        passage_receipt_id: receipt_id
      });
      
      return { success: true, receipt_id, action: action.type };
    });
    
    res.status(200).json(resData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export { policyEngineApi } from './policyEngine';
export { witnessRecord, witnessVerify, witnessGenerateKey } from './witnessApi';
export { marketplaceWebhook, marketplaceComplete } from './marketplaceApi';
