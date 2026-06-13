/**
 * Multiplayer presence — model URLs and defaults.
 * Drop custom .glb files in /public/models/avatars/ and reference as /models/avatars/yours.glb
 */

/** Free drei sample models (CDN) — swap per agent in join payload */
export const AVATAR_MODEL_PRESETS = {
  steward: 'https://vazxmixjsiawhamofees.supabase.co/store/models/astronaut/model.gltf',
  solis: 'https://vazxmixjsiawhamofees.supabase.co/store/models/robot/model.gltf',
  prosper: 'https://vazxmixjsiawhamofees.supabase.co/store/models/stage/model.gltf',
  ember: 'https://vazxmixjsiawhamofees.supabase.co/store/models/human/model.gltf',
  default: null, // procedural fallback
}

export const PRESENCE_WS_URL =
  import.meta.env.VITE_PRESENCE_WS_URL || 'ws://127.0.0.1:8765'

/** True when no VITE_PRESENCE_WS_URL — client targets local dev server only */
export const PRESENCE_IS_LOCAL_DEFAULT = !import.meta.env.VITE_PRESENCE_WS_URL

export const CHAT_COOLDOWN_MS = 60_000
export const SPEECH_FADE_MS = 10_000
export const POSE_SEND_INTERVAL_MS = 100

export const ROLE_COLORS = {
  builder: '#C27C5A',
  guardian: '#7A9E7E',
  steward: '#D4A853',
}

export function colorFromId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const hue = (h % 360) / 360
  return `hsl(${Math.round(hue * 360)}, 72%, 58%)`
}

export function colorFromRole(role, fallbackId = 'guest') {
  const key = String(role || '').toLowerCase()
  return ROLE_COLORS[key] ?? colorFromId(fallbackId)
}

/** Inner-ring slot for biosphere when player is not walking */
export function biosphereSlotPosition(id, radius = 4) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const a = ((h % 360) / 360) * Math.PI * 2
  return [Math.cos(a) * radius, 0, Math.sin(a) * radius]
}

/** Set VITE_AVATAR_GLTF=1 to load remote GLTF (can fail offline). Default: procedural avatars. */
export function resolveModelUrl(agentKey) {
  if (import.meta.env.VITE_AVATAR_GLTF !== '1') return null
  if (!agentKey) return AVATAR_MODEL_PRESETS.default
  const key = String(agentKey).toLowerCase()
  return AVATAR_MODEL_PRESETS[key] ?? AVATAR_MODEL_PRESETS.default
}
