import { getFirebaseAuth } from '../firebaseAuth'

type ContinuityEventInput = {
  agentId?: string
  eventType: string
  summary: string
  metadata?: Record<string, string | number | boolean | null | undefined>
  moltbookIdentityToken?: string | null
}

type ContinuityEventResult =
  | { ok: true; skipped: false; eventId?: string }
  | { ok: false; skipped: true; reason: 'anonymous' }
  | { ok: false; skipped: false; reason: string }

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

  try {
    const response = await fetch('/api/agent/memory/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : {}),
        ...(externalToken ? { 'X-Moltbook-Identity': externalToken } : {}),
      },
      body: JSON.stringify({
        ...(agentId ? { agent_id: agentId } : {}),
        event_type: eventType,
        summary,
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
