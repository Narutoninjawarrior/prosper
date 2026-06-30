/**
 * Local crystallization helpers for deterministic Hearthlands witness drafts.
 */

import { artifactIdFromDigest, sha256Hex, stableStringify } from './canonical'

export type ArtifactKind =
  | 'site.geojson'
  | 'food.batch'
  | 'robot.urdf'
  | 'thing.description'
  | 'ledger.statement'
  | 'media.annotation'

export type HashBundle = {
  algorithm: 'SHA-256'
  digestHex: string
}

export type ProvenanceLink = {
  label: string
  href?: string
  key?: string
  present?: boolean
}

export type WitnessReceiptRef = {
  receiptId: string
  includedAt: string
  logId: string
}

export type HearthlandsWitnessEnvelope<T = unknown> = {
  schemaVersion: 'hearthlands.witness.envelope.v1'
  securityTier: 'LOCAL_DRAFT' | 'PUBLIC_WITNESSED'
  artifactId: string
  artifactKind: ArtifactKind
  createdAt: string
  createdBy: {
    agentType: 'human' | 'service' | 'device'
    agentId: string
    displayName?: string
  }
  workspace: {
    realm?: string
    app?: string
    focusId?: string | null
    sessionId?: string | null
  }
  payloadHash: HashBundle
  payloadMediaType: string
  payload: T
  provenance: ProvenanceLink[]
  witness?: {
    statementHash?: HashBundle
    receipt?: WitnessReceiptRef
  }
  truthBoundary: {
    localPreview: boolean
    downloadable: boolean
    witnessedPublicationEligible: boolean
    notes?: string
  }
}

type EvidenceManifestEntry = {
  type: string
  key: string | null
  present: boolean
  url?: string
}

function collectEvidence(payload: unknown): ProvenanceLink[] {
  if (!payload || typeof payload !== 'object') return []
  const maybeEvidence = (payload as { evidence?: unknown }).evidence
  if (!Array.isArray(maybeEvidence)) return []

  return maybeEvidence.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const label = typeof row.type === 'string' ? row.type : 'evidence'
    return [{
      label,
      key: typeof row.key === 'string' ? row.key : undefined,
      present: Boolean(row.present),
    }]
  })
}

function buildEvidenceManifest<T>(envelope: HearthlandsWitnessEnvelope<T>): EvidenceManifestEntry[] {
  const payloadEvidence = (() => {
    const maybeEvidence = (envelope.payload as { evidence?: unknown } | null | undefined)?.evidence
    if (!Array.isArray(maybeEvidence)) return [] as EvidenceManifestEntry[]

    return maybeEvidence.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry as Record<string, unknown>
      return [{
        type: typeof row.type === 'string' ? row.type : 'evidence',
        key: typeof row.key === 'string' ? row.key : null,
        present: Boolean(row.present),
        url: typeof row.url === 'string' ? row.url : undefined,
      }]
    })
  })()

  const provenanceEvidence = envelope.provenance.map((entry) => ({
    type: entry.label,
    key: entry.key ?? null,
    present: Boolean(entry.present),
    url: entry.href,
  }))

  const merged = new Map<string, EvidenceManifestEntry>()
  for (const entry of [...payloadEvidence, ...provenanceEvidence]) {
    const identity = `${entry.type}:${entry.key ?? ''}`
    if (!merged.has(identity)) {
      merged.set(identity, entry)
      continue
    }

    const previous = merged.get(identity)!
    merged.set(identity, {
      type: previous.type,
      key: previous.key,
      present: previous.present || entry.present,
      url: previous.url ?? entry.url,
    })
  }

  return Array.from(merged.values())
}

function getJurisdictionSummary(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return ['No jurisdiction profile embedded in this draft payload.']
  }

  const profiles = (payload as { jurisdictionProfiles?: unknown }).jurisdictionProfiles
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return ['No jurisdiction profile embedded in this draft payload.']
  }

  return profiles.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const label = typeof row.label === 'string'
      ? row.label
      : typeof row.jurisdiction === 'string'
        ? row.jurisdiction
        : 'jurisdiction'
    const summary = typeof row.summary === 'string'
      ? row.summary
      : typeof row.mode === 'string'
        ? row.mode
        : 'profile attached'
    return [`- ${label}: ${summary}`]
  })
}

export async function crystallizeArtifact<T>(
  payload: T,
  kind: ArtifactKind,
  createdBy: HearthlandsWitnessEnvelope['createdBy'],
  workspace: HearthlandsWitnessEnvelope['workspace'] = {},
  mediaType = 'application/json',
): Promise<HearthlandsWitnessEnvelope<T>> {
  const canonicalPayload = stableStringify(payload)
  const digestHex = await sha256Hex(canonicalPayload)
  const artifactId = artifactIdFromDigest(digestHex)

  return {
    schemaVersion: 'hearthlands.witness.envelope.v1',
    securityTier: 'LOCAL_DRAFT',
    artifactId,
    artifactKind: kind,
    createdAt: new Date().toISOString(),
    createdBy,
    workspace,
    payloadHash: {
      algorithm: 'SHA-256',
      digestHex,
    },
    payloadMediaType: mediaType,
    payload,
    provenance: collectEvidence(payload),
    truthBoundary: {
      localPreview: true,
      downloadable: true,
      witnessedPublicationEligible: true,
      notes: '[LOCAL_DRAFT] Local crystallization only. Downloadable. Not yet witnessed.',
    },
  }
}

export function manifestBundle<T>(envelope: HearthlandsWitnessEnvelope<T>): { files: { name: string; blob: Blob }[] } {
  const artifactPrefix = envelope.artifactId
  const canonicalPayload = stableStringify(envelope.payload)
  const evidenceManifest = buildEvidenceManifest(envelope)
  const requiredEvidence = evidenceManifest.length
    ? evidenceManifest.map((entry) => `${entry.type}: ${entry.present ? 'present' : 'missing'}${entry.key ? ` (${entry.key})` : ''}`).join('\n')
    : 'No evidence references recorded in this draft.'
  const jurisdictionSummary = getJurisdictionSummary(envelope.payload)

  const readme = [
    `Hearthlands Local Draft Bundle`,
    `artifactId: ${envelope.artifactId}`,
    `artifactKind: ${envelope.artifactKind}`,
    `createdAt: ${envelope.createdAt}`,
    `securityTier: ${envelope.securityTier}`,
    '',
    `Truth boundary: ${envelope.truthBoundary.notes ?? '[LOCAL_DRAFT]'}`,
    `Downloadable: ${envelope.truthBoundary.downloadable ? 'yes' : 'no'}`,
    `Witness publication eligible: ${envelope.truthBoundary.witnessedPublicationEligible ? 'yes' : 'no'}`,
    '',
    'Checklist:',
    '- Review payload.json before sharing.',
    '- Confirm checksum.txt matches payload.json exactly.',
    '- Confirm evidence presence locally before any witnessed publication.',
    '- This bundle is local draft output only; no receipt is minted by download.',
    '- Bundle generated locally. Witness status reflects dev-stub acknowledgment only.',
    '',
    'Required evidence:',
    requiredEvidence,
    '',
    'Jurisdiction summary:',
    ...jurisdictionSummary,
    '- Local evidence references may point to browser-only IndexedDB blobs.',
  ].join('\n')

  return {
    files: [
      {
        name: `${artifactPrefix}.envelope.json`,
        blob: new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }),
      },
      {
        name: `${artifactPrefix}.payload.json`,
        blob: new Blob([canonicalPayload], { type: 'application/json' }),
      },
      {
        name: `${artifactPrefix}.checksum.txt`,
        blob: new Blob([`${envelope.payloadHash.algorithm} ${envelope.payloadHash.digestHex}\n`], { type: 'text/plain' }),
      },
      {
        name: `${artifactPrefix}.evidence-manifest.json`,
        blob: new Blob([JSON.stringify(evidenceManifest, null, 2)], { type: 'application/json' }),
      },
      {
        name: `${artifactPrefix}.README.txt`,
        blob: new Blob([readme], { type: 'text/plain' }),
      },
    ],
  }
}

export function createDownloadLinks(bundle: { files: { name: string; blob: Blob }[] }) {
  return bundle.files.map((file) => ({
    filename: file.name,
    url: URL.createObjectURL(file.blob),
  }))
}
