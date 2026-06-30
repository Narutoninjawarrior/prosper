/**
 * Deterministic canonicalization tests for local artifact drafting.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { stableStringify } from '../lib/canonical'
import { crystallizeArtifact, manifestBundle } from '../lib/publishArtifact'

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    })
  }
})

describe('stableStringify', () => {
  it('returns identical output for objects with different key order', () => {
    const left = { b: 2, a: 1, nested: { z: true, y: 'ok' } }
    const right = { nested: { y: 'ok', z: true }, a: 1, b: 2 }

    expect(stableStringify(left)).toBe(stableStringify(right))
  })
})

describe('crystallizeArtifact', () => {
  it('returns the same deterministic artifactId for deeply equal payloads', async () => {
    const createdBy = { agentType: 'human' as const, agentId: 'tester', displayName: 'Tester' }
    const workspace = { realm: 'hearthlands', app: 'tests', focusId: 'food', sessionId: 'abc' }
    const payloadA = { productName: 'Loaf', category: 'BAKED', ingredients: ['flour', 'salt'] }
    const payloadB = { ingredients: ['flour', 'salt'], category: 'BAKED', productName: 'Loaf' }

    const envelopeA = await crystallizeArtifact(payloadA, 'food.batch', createdBy, workspace)
    const envelopeB = await crystallizeArtifact(payloadB, 'food.batch', createdBy, workspace)

    expect(envelopeA.artifactId).toBe(envelopeB.artifactId)
    expect(envelopeA.payloadHash.digestHex).toBe(envelopeB.payloadHash.digestHex)
  })

  it('includes mandatory bundle files using the artifactId prefix', async () => {
    const envelope = await crystallizeArtifact(
      { title: 'Draft Site', geometry: { type: 'Point', coordinates: [0, 0] } },
      'site.geojson',
      { agentType: 'human', agentId: 'tester' },
      { app: 'tests' },
    )

    const bundle = manifestBundle(envelope)
    const names = bundle.files.map((file) => file.name)

    expect(names).toContain(`${envelope.artifactId}.payload.json`)
    expect(names).toContain(`${envelope.artifactId}.envelope.json`)
    expect(names).toContain(`${envelope.artifactId}.checksum.txt`)

    const checksumFile = bundle.files.find((file) => file.name === `${envelope.artifactId}.checksum.txt`)
    expect(checksumFile).toBeTruthy()
    const checksumText = await checksumFile!.blob.text()
    expect(checksumText).toBe(`SHA-256 ${envelope.payloadHash.digestHex}\n`)
  })
})
