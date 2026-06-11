/**
 * lodgeMindApi.ts - public readiness surfaces for /lodge-mind UI.
 */
import * as crypto from 'crypto'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

function applyCors(res: functions.Response, methods = 'GET, OPTIONS'): void {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', methods)
  res.set('Access-Control-Allow-Headers', 'Content-Type')
}

async function countCollection(name: string): Promise<number> {
  const snap = await admin.firestore().collection(name).count().get()
  return snap.data().count
}

export async function fetchLodgeMindStatus() {
  const db = admin.firestore()
  const worldSnap = await db.doc('three_forge/world_state').get()
  const world = worldSnap.exists ? worldSnap.data() : null
  const nodes = world && Array.isArray(world.nodes) ? world.nodes : []

  const cloudRunConfigured = Boolean(process.env.LODGE_MIND_SERVICE_URL)
  const modelName = process.env.LODGE_MIND_MODEL || 'gemma-4-e4b'
  const sovereignUid = Boolean(process.env.SOVEREIGN_UID)

  let mode: 'offline' | 'readiness' | 'connected' = 'readiness'
  if (!cloudRunConfigured) mode = 'offline'
  else if (sovereignUid) mode = 'connected'

  return {
    mode,
    provider: 'cloud-run-gemma',
    runtime: {
      cloud_run_configured: cloudRunConfigured,
      model_name: modelName,
      service_url_configured: cloudRunConfigured,
      sovereign_uid_configured: sovereignUid,
    },
    collections: {
      agent_profiles: await countCollection('agent_profiles'),
      lodge_quests: await countCollection('lodge_quests'),
      artifact_registry: await countCollection('artifact_registry'),
      embodiment_ledger: await countCollection('embodiment_ledger'),
    },
    world: {
      forge_nodes: nodes.length,
      has_world_state: worldSnap.exists,
      last_updated:
        world && typeof world.heartbeat_at === 'string'
          ? world.heartbeat_at
          : worldSnap.updateTime?.toMillis() ?? null,
    },
    note: 'Readiness snapshot - inference remains unavailable on the public route until a server-side Lodge Mind service URL is configured.',
  }
}

export async function fetchLodgeMindContextPreview() {
  const db = admin.firestore()
  const [members, quests, artifacts, embodiment, worldSnap, ledgerSnap] = await Promise.all([
    countCollection('agent_profiles'),
    countCollection('lodge_quests'),
    countCollection('artifact_registry'),
    countCollection('embodiment_ledger'),
    db.doc('three_forge/world_state').get(),
    db.collection('embodiment_ledger').orderBy('timestamp', 'desc').limit(5).get(),
  ])

  const nodes = worldSnap.exists && Array.isArray(worldSnap.data()?.nodes) ? worldSnap.data()!.nodes : []
  const recentEvents = ledgerSnap.docs.map((doc) => doc.data())
  const questSnap = await db.collection('lodge_quests').limit(5).get()
  const activeQuests = questSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  return {
    generated_at: new Date().toISOString(),
    summary: {
      members,
      quests,
      artifacts,
      embodiment_events: embodiment,
      forge_nodes: nodes.length,
    },
    recent_events: recentEvents,
    active_quests: activeQuests,
    proposed_actions: [
      'Sync manifest-verified seeds to Firestore',
      'Poll /api/creativity/suggest for bot discovery loops',
      'Witness experiments via /api/experiment/log',
    ],
    policy: 'Context preview only - no LLM inference on this endpoint.',
  }
}

type LodgeMindAskRequest = {
  messages?: Array<{ role?: string; content?: string }>
  prompt?: string
  model?: string
  temperature?: number
  max_tokens?: number
}

function getServiceUrl(): string {
  return (process.env.LODGE_MIND_SERVICE_URL || '').trim()
}

function hmacFor(payload: string): string | null {
  const secret = (process.env.LODGE_MIND_HMAC_SECRET || '').trim()
  if (!secret) return null
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function normalizeAskRequest(body: unknown): LodgeMindAskRequest | null {
  if (typeof body === 'string') {
    try {
      return normalizeAskRequest(JSON.parse(body))
    } catch {
      return null
    }
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null
  }

  const request = body as Record<string, unknown>
  const messages = Array.isArray(request.messages)
    ? request.messages
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          role: typeof entry.role === 'string' ? entry.role : 'user',
          content: typeof entry.content === 'string' ? entry.content.trim() : '',
        }))
        .filter((entry) => entry.content.length > 0)
    : []

  const prompt = typeof request.prompt === 'string' ? request.prompt.trim() : ''
  if (messages.length === 0 && !prompt) {
    return null
  }

  return {
    messages: messages.length > 0 ? messages : [{ role: 'user', content: prompt }],
    prompt,
    model: typeof request.model === 'string' ? request.model : undefined,
    temperature: typeof request.temperature === 'number' ? request.temperature : undefined,
    max_tokens: typeof request.max_tokens === 'number' ? request.max_tokens : undefined,
  }
}

export const lodgeMindStatus = functions.https.onRequest(async (req, res) => {
  applyCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' })
    return
  }
  try {
    res.set('Cache-Control', 'public, max-age=30')
    res.status(200).json(await fetchLodgeMindStatus())
  } catch (err) {
    console.error('[lodgeMindStatus]', err)
    res.status(500).json({ error: 'Status failed' })
  }
})

export const lodgeMindContextPreview = functions.https.onRequest(async (req, res) => {
  applyCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' })
    return
  }
  try {
    res.set('Cache-Control', 'no-store')
    res.status(200).json(await fetchLodgeMindContextPreview())
  } catch (err) {
    console.error('[lodgeMindContextPreview]', err)
    res.status(500).json({ error: 'Context preview failed' })
  }
})

export const lodgeMindAsk = functions.https.onRequest(async (req, res) => {
  applyCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const serviceUrl = getServiceUrl()
  if (!serviceUrl) {
    res.status(503).json({
      error: 'Lodge Mind ask relay is unavailable.',
      detail: 'Server-side LODGE_MIND_SERVICE_URL is not configured yet.',
      state: 'prototype',
    })
    return
  }

  const request = normalizeAskRequest(req.body)
  if (!request || !request.messages || request.messages.length === 0) {
    res.status(400).json({
      error: 'messages[] or prompt is required',
      detail: 'Send an OpenAI-compatible messages array or a non-empty prompt string.',
    })
    return
  }

  const upstreamPayload = JSON.stringify({
    model: request.model || process.env.LODGE_MIND_MODEL || 'gemma-4-e4b',
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
  })

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hearthlands-Route': 'lodge-mind-public',
    }
    const signature = hmacFor(upstreamPayload)
    if (signature) headers['X-Hearthlands-Signature'] = signature

    const upstream = await fetch(serviceUrl, {
      method: 'POST',
      headers,
      body: upstreamPayload,
    })

    const text = await upstream.text()
    res.set('Cache-Control', 'no-store')
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')

    if (!upstream.ok) {
      res.status(upstream.status).send(text)
      return
    }

    res.status(200).send(text)
  } catch (err) {
    console.error('[lodgeMindAsk]', err)
    res.status(502).json({
      error: 'Lodge Mind upstream request failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})
