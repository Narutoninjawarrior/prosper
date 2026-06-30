import { getFirebaseProjectId } from '../firebaseConfig'
import { mergeAppCheckHeaders } from './appCheck'

const REGION = 'us-central1'

export function cloudFunctionUrl(name: string): string {
  const project =
    import.meta.env.VITE_FIREBASE_PROJECT_ID || getFirebaseProjectId() || 'fellowship-of-the-hearth'
  return `https://${REGION}-${project}.cloudfunctions.net/${name}`
}

export interface WelcomeAgentResult {
  success?: boolean
  already_registered?: boolean
  agent_id: string
  agent_name: string
  ember_balance: number
  assigned_plot: number
  cottage_label: string
  message?: string
}

export async function welcomeHearthlandsAgent(params: {
  moltbookHandle: string
  ref?: string
  publicKey?: string
}): Promise<WelcomeAgentResult> {
  const body = JSON.stringify({
    moltbook_handle: params.moltbookHandle,
    ref: params.ref ?? 'moltbook',
    public_key: params.publicKey,
  })

  const urls = ['/api/welcome', cloudFunctionUrl('welcomeHearthlandsAgent')]
  let lastError = 'Welcome failed'

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: await mergeAppCheckHeaders({ 'Content-Type': 'application/json' }),
        body,
      })
      const data = (await res.json()) as WelcomeAgentResult & { error?: string }
      if (!res.ok) {
        lastError = data.error || `Welcome failed (${res.status})`
        continue
      }
      return data
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Welcome failed'
    }
  }

  throw new Error(lastError)
}

export function ledgerApiUrl(path: 'ledger' | 'latest'): string {
  const fn = path === 'latest' ? 'embodimentLedgerLatest' : 'embodimentLedger'
  return cloudFunctionUrl(fn)
}
