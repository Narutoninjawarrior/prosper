/** Resolve steward identity from welcome flow + URL. */

export function readStewardAgentHandle() {
  if (typeof window === 'undefined') return 'Traveler'
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('agent') || params.get('handle')
  if (fromUrl) return fromUrl.replace(/^@/, '').trim().slice(0, 64)
  return (
    sessionStorage.getItem('hearth_welcome_agent_name') ||
    sessionStorage.getItem('hearth_welcome_agent_id') ||
    'Traveler'
  )
}

export function readStewardPlotId() {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('hearth_welcome_plot')
  if (stored) {
    const id = Number(stored)
    if (Number.isFinite(id)) return id
  }
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('plot')
  if (fromUrl) {
    const id = Number(fromUrl)
    if (Number.isFinite(id)) return id
  }
  return null
}
