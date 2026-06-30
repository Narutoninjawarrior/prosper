/**
 * Deterministic canonicalization helpers for local artifact drafting.
 */

type CanonicalObject = Record<string, unknown>

function isPlainObject(value: unknown): value is CanonicalObject {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function mapKeyToString(value: unknown): string {
  const canonical = canonicalize(value)
  return typeof canonical === 'string' ? canonical : JSON.stringify(canonical)
}

function canonicalizeInternal(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return value
  if (valueType === 'bigint') return String(value)
  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') return undefined

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeInternal(entry, ancestors))
  }

  if (value instanceof Set) {
    return Array.from(value, (entry) => canonicalizeInternal(entry, ancestors)).sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )
  }

  if (value instanceof Map) {
    const mappedEntries = Array.from(value.entries(), ([key, entry]) => [
      mapKeyToString(key),
      canonicalizeInternal(entry, ancestors),
    ] as const).sort(([left], [right]) => left.localeCompare(right))

    return Object.fromEntries(mappedEntries)
  }

  if (valueType === 'object') {
    const objectValue = value as object
    if (ancestors.has(objectValue)) {
      throw new TypeError('circular reference')
    }

    ancestors.add(objectValue)
    try {
      if (!isPlainObject(value)) {
        const entries = Object.entries(value as CanonicalObject)
          .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalizeInternal(entry, ancestors)] as const)

        return Object.fromEntries(entries)
      }

      const entries = Object.entries(value)
        .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeInternal(entry, ancestors)] as const)

      return Object.fromEntries(entries)
    } finally {
      ancestors.delete(objectValue)
    }
  }

  return null
}

/**
 * Convert a value to a deterministic JSON-safe structure.
 */
export function canonicalize(value: unknown): unknown {
  return canonicalizeInternal(value, new WeakSet<object>())
}

/**
 * Serialize a value using the canonical ordering rules above.
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(canonicalize(obj))
}

/**
 * Hash canonical text to a SHA-256 hex digest using Web Crypto.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Derive a deterministic short artifact id from a digest.
 */
export function artifactIdFromDigest(digestHex: string, prefix = 'hearth'): string {
  return `${prefix}-${digestHex.slice(0, 16)}`
}
