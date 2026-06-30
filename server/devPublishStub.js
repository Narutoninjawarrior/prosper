/**
 * Dev-only publish stub.
 * Replace this with a secure serverless signing + witness submission function for production.
 */

import express from 'express'
import crypto from 'node:crypto'

function mapKeyToString(value) {
  const canonical = canonicalize(value)
  return typeof canonical === 'string' ? canonical : JSON.stringify(canonical)
}

function canonicalizeInternal(value, ancestors) {
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
    return Object.fromEntries(
      Array.from(value.entries(), ([key, entry]) => [mapKeyToString(key), canonicalizeInternal(entry, ancestors)])
        .sort(([left], [right]) => left.localeCompare(right)),
    )
  }

  if (valueType === 'object') {
    if (ancestors.has(value)) {
      throw new TypeError('circular reference')
    }

    ancestors.add(value)
    try {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, canonicalizeInternal(entry, ancestors)]),
      )
    } finally {
      ancestors.delete(value)
    }
  }

  return null
}

function canonicalize(value) {
  return canonicalizeInternal(value, new WeakSet())
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value))
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

const app = express()
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'devPublishStub' })
})

app.get('/dev/publish', (req, res) => {
  res.json({
    ok: true,
    route: '/dev/publish',
    method: 'POST',
    purpose: 'dev witness stub',
    note: 'Send POST with envelope + payload. GET is status only.'
  })
})

app.post('/dev/publish', (req, res) => {
  try {
    const { envelope, payload } = req.body ?? {}
    if (!envelope || !payload || !envelope.payloadHash?.digestHex) {
      res.status(400).json({ error: 'INVALID_REQUEST' })
      return
    }

    const digestHex = sha256Hex(stableStringify(payload))
    if (digestHex !== envelope.payloadHash.digestHex) {
      res.status(400).json({ error: 'HASH_MISMATCH' })
      return
    }

    console.log('[devPublishStub] accepted artifact', envelope.artifactId)
    res.json({
      receipt: {
        receiptId: `mock-${envelope.artifactId}`,
        includedAt: new Date().toISOString(),
        logId: 'mock-log-1',
        note: 'DEV STUB - NOT CRYPTOGRAPHICALLY WITNESSED',
      },
    })
  } catch (error) {
    console.error('[devPublishStub] publish failed', error)
    res.status(500).json({ error: 'PUBLISH_FAILED' })
  }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`[devPublishStub] listening on http://localhost:${port}/dev/publish`)
})
