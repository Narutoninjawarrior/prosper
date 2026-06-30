export type SandboxObjectType = 'earthbag_dome' | 'aquaponics_core'

export interface SandboxObject {
  id: string
  type: SandboxObjectType
  x: number
  y: number
  z: number
  ownerWallet?: string | null
  createdAt: number
}

const STORAGE_KEY = 'hearth_sandbox_objects_v1'

export function loadLocalSandboxObjects(): SandboxObject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SandboxObject[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalSandboxObjects(objects: SandboxObject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(objects))
}

export function forgeNodeToSandboxObject(node: Record<string, unknown>): SandboxObject | null {
  const type = node.object_type as string | undefined
  if (type !== 'earthbag_dome' && type !== 'aquaponics_core') return null
  if (typeof node.x !== 'number' || typeof node.z !== 'number') return null
  return {
    id: String(node.id ?? `${type}-${node.x}-${node.z}`),
    type,
    x: node.x,
    y: typeof node.y === 'number' ? node.y : 0,
    z: node.z,
    ownerWallet: typeof node.placed_by === 'string' ? node.placed_by : null,
    createdAt: typeof node.ts === 'number' ? node.ts : Date.now(),
  }
}

export function sandboxObjectToForgeNode(obj: SandboxObject) {
  return {
    id: obj.id,
    x: obj.x,
    y: obj.y,
    z: obj.z,
    object_type: obj.type,
    placed_by: obj.ownerWallet ?? 'anonymous',
    ts: obj.createdAt,
    heat_level: 0,
  }
}
