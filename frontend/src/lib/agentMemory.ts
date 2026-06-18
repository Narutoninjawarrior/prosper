import { getFirebaseAuth } from '../firebaseAuth'

type ContinuityEventInput = {
  agentId?: string
  eventType: string
  summary: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  moltbookIdentityToken?: string | null
}

type TaskEventInput = {
  agentId?: string
  taskId: string
  status: 'open' | 'claimed' | 'in_progress' | 'witnessed' | 'archived'
  summary?: string
  receiptHash?: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  moltbookIdentityToken?: string | null
}

type ContinuityEventResult =
  | { ok: true; skipped: false; eventId?: string }
  | { ok: false; skipped: true; reason: 'anonymous' }
  | { ok: false; skipped: false; reason: string }

const TASK_STATUSES = new Set(['open', 'claimed', 'in_progress', 'witnessed', 'archived'])

function trimField(value: string | undefined | null, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanMetadata(
  metadata?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined
  const entries = Object.entries(metadata).filter(([, value]) => {
    return value === null || ['string', 'number', 'boolean'].includes(typeof value)
  })
  return entries.length > 0
    ? Object.fromEntries(entries.slice(0, 16)) as Record<string, string | number | boolean | null>
    : undefined
}

export async function appendAgentMemoryEvent({
  agentId,
  eventType,
  summary,
  metadata,
  moltbookIdentityToken,
}: ContinuityEventInput): Promise<ContinuityEventResult> {
  const auth = getFirebaseAuth()
  const user = auth?.currentUser ?? null
  const firebaseToken = user ? await user.getIdToken().catch(() => null) : null
  const externalToken = moltbookIdentityToken?.trim() || null

  if (!firebaseToken && !externalToken) {
    return { ok: false, skipped: true, reason: 'anonymous' }
  }

  const normalizedType = trimField(eventType, 64)
  const normalizedSummary = trimField(summary, 240)
  if (!normalizedType || !normalizedSummary) {
    return { ok: false, skipped: false, reason: 'event_type and summary are required' }
  }

  try {
    const response = await fetch('/api/agent/memory/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : {}),
        ...(externalToken ? { 'X-Moltbook-Identity': externalToken } : {}),
      },
      body: JSON.stringify({
        ...(agentId ? { agent_id: trimField(agentId, 128) } : {}),
        event_type: normalizedType,
        summary: normalizedSummary,
        metadata: cleanMetadata(metadata),
      }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        reason: typeof body.error === 'string' ? body.error : `HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      skipped: false,
      eventId: typeof body.event_id === 'string' ? body.event_id : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function appendAgentTaskEvent({
  agentId,
  taskId,
  status,
  summary,
  receiptHash,
  metadata,
  moltbookIdentityToken,
}: TaskEventInput): Promise<ContinuityEventResult> {
  const auth = getFirebaseAuth()
  const user = auth?.currentUser ?? null
  const firebaseToken = user ? await user.getIdToken().catch(() => null) : null
  const externalToken = moltbookIdentityToken?.trim() || null

  if (!firebaseToken && !externalToken) {
    return { ok: false, skipped: true, reason: 'anonymous' }
  }

  const normalizedTaskId = trimField(taskId, 96)
  if (!normalizedTaskId) {
    return { ok: false, skipped: false, reason: 'task_id is required' }
  }
  if (!TASK_STATUSES.has(status)) {
    return { ok: false, skipped: false, reason: `Unsupported task status "${status}"` }
  }

  const normalizedSummary = summary ? trimField(summary, 240) : ''
  const normalizedReceipt = receiptHash ? trimField(receiptHash, 128) : ''

  try {
    const response = await fetch('/api/agent/task/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : {}),
        ...(externalToken ? { 'X-Moltbook-Identity': externalToken } : {}),
      },
      body: JSON.stringify({
        ...(agentId ? { agent_id: trimField(agentId, 128) } : {}),
        task_id: normalizedTaskId,
        status,
        ...(normalizedSummary ? { summary: normalizedSummary } : {}),
        ...(normalizedReceipt ? { receipt_hash: normalizedReceipt } : {}),
        metadata: cleanMetadata(metadata),
      }),
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        reason: typeof body.error === 'string' ? body.error : `HTTP ${response.status}`,
      }
    }

    return {
      ok: true,
      skipped: false,
      eventId: typeof body.event_id === 'string' ? body.event_id : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
