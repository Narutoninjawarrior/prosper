/** Welcome → Biosphere deep-link state (session-scoped). */

const PLOT_KEY = 'hearth_welcome_plot'
const ACTIVE_KEY = 'hearth_welcome_highlight'
const AGENT_KEY = 'hearth_welcome_agent_id'
const NAME_KEY = 'hearth_welcome_agent_name'

export function readWelcomePlotId(): number | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('plot')
  const welcomeFlag = params.get('welcome') === '1'

  if (welcomeFlag && fromUrl) {
    const id = Number(fromUrl)
    if (Number.isFinite(id)) {
      sessionStorage.setItem(PLOT_KEY, String(id))
      sessionStorage.setItem(ACTIVE_KEY, 'true')
      scrubWelcomeQueryParams()
      return id
    }
  }

  if (sessionStorage.getItem(ACTIVE_KEY) !== 'true') return null
  const stored = sessionStorage.getItem(PLOT_KEY)
  if (!stored) return null
  const id = Number(stored)
  return Number.isFinite(id) ? id : null
}

export function readWelcomeAgentName(): string | null {
  return sessionStorage.getItem(NAME_KEY) || sessionStorage.getItem(AGENT_KEY)
}

export function setWelcomeAgentMeta(agentId: string, agentName?: string) {
  sessionStorage.setItem(AGENT_KEY, agentId)
  if (agentName) sessionStorage.setItem(NAME_KEY, agentName)
}

export function clearWelcomeHighlight() {
  sessionStorage.removeItem(ACTIVE_KEY)
}

export function scrubWelcomeQueryParams() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('welcome') && !url.searchParams.has('plot')) return
  url.searchParams.delete('welcome')
  url.searchParams.delete('plot')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
