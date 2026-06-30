/**
 * Minimal local-first cottage batch drafting flow with crystallize, dev publish, and local library.
 */

import { useMemo, useRef, useState, type ChangeEvent, useEffect } from 'react'
import { artifactIdFromDigest, sha256Hex, stableStringify } from './lib/canonical'
import { getFileUrl, saveFile } from './lib/idbHelper'
import {
  createDownloadLinks,
  crystallizeArtifact,
  manifestBundle,
  type ProvenanceLink,
  type HearthlandsWitnessEnvelope,
  type WitnessReceiptRef,
} from './lib/publishArtifact'

type Category = 'FERMENTED' | 'BAKED' | 'DEHYDRATED'
type UiStatus = 'LOCAL_DRAFT' | 'CRYSTALLIZE_READY' | 'PUBLISH_READY' | 'PUBLIC_WITNESSED'

type FoodBatchPayload = {
  profile: 'hearthlands.food-batch.v1'
  batchId: string
  productName: string
  category: Category
  producer: string
  ingredients: string[]
  process: {
    measurementMethod?: string
    instrumentId?: string
    measurementAt: string
  }
  safety: {
    measuredPhValue?: number
    verificationStatus: 'SELF_MEASURED' | 'UNVERIFIED'
  }
  marketAccess: {
    mode: 'PMA_PRIVATE_ONLY' | 'GENERAL_PUBLIC'
  }
  evidence: Array<{
    type: 'photo'
    key: string
    present: boolean
  }>
}

type Props = {
  createdBy?: {
    agentType: 'human' | 'service' | 'device'
    agentId: string
    displayName?: string
  }
  workspace?: {
    realm?: string
    app?: string
    focusId?: string | null
    sessionId?: string | null
  }
}

const CHIP_ORDER: UiStatus[] = ['LOCAL_DRAFT', 'CRYSTALLIZE_READY', 'PUBLISH_READY', 'PUBLIC_WITNESSED']

function nowLocalInputValue() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function statusNotes(status: UiStatus): string {
  switch (status) {
    case 'LOCAL_DRAFT':
      return '[LOCAL_DRAFT] Local form state only. No crystallized envelope yet.'
    case 'CRYSTALLIZE_READY':
      return '[LOCAL_DRAFT] [CRYSTALLIZE_READY] Local draft envelope created and downloadable.'
    case 'PUBLISH_READY':
      return '[LOCAL_DRAFT] [CRYSTALLIZE_READY] [PUBLISH_READY] Digest validated locally and ready for dev publish.'
    case 'PUBLIC_WITNESSED':
      return '[PUBLIC_WITNESSED] Acknowledged by the configured witness service or dev stub; receipt returned. Dev stub only. Production witness service not yet configured.'
  }
}

function publishEndpoint() {
  if (typeof window === 'undefined') return 'http://localhost:3001/dev/publish'
  const host = window.location.hostname || 'localhost'
  return `http://${host}:3001/dev/publish`
}

type SavedBatch = {
  id: string;
  productName: string;
  category: Category;
  measuredPhValue: string;
  measurementMethod: string;
  instrumentId: string;
  measurementAt: string;
  measurementPhotoKey: string | null;
  measurementPhotoName: string | null;
  measurementPhotoUrl: string | null;
  status: UiStatus;
  envelope: HearthlandsWitnessEnvelope<FoodBatchPayload> | null;
  updatedAt: number;
}

export default function CottageAssemblyLine({
  createdBy = { agentType: 'human', agentId: 'local-operator', displayName: 'Local Operator' },
  workspace = { realm: 'hearthlands', app: 'cottage-assembly-line', focusId: null, sessionId: null },
}: Props) {
  const tempIdRef = useRef(`temp-${Date.now().toString(36)}`)
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState<Category>('FERMENTED')
  const [measuredPhValue, setMeasuredPhValue] = useState('')
  const [measurementMethod, setMeasurementMethod] = useState('')
  const [instrumentId, setInstrumentId] = useState('')
  const [measurementAt, setMeasurementAt] = useState(nowLocalInputValue())
  const [measurementPhotoKey, setMeasurementPhotoKey] = useState<string | null>(null)
  const [measurementPhotoName, setMeasurementPhotoName] = useState<string | null>(null)
  const [measurementPhotoUrl, setMeasurementPhotoUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<UiStatus>('LOCAL_DRAFT')
  const [envelope, setEnvelope] = useState<HearthlandsWitnessEnvelope<FoodBatchPayload> | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [showEnvelope, setShowEnvelope] = useState(false)

  // Local Batch Library State
  const [savedBatches, setSavedBatches] = useState<SavedBatch[]>(() => {
    try {
      const stored = localStorage.getItem('hearth_cottage_batches')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])

  useEffect(() => {
    localStorage.setItem('hearth_cottage_batches', JSON.stringify(savedBatches))
  }, [savedBatches])

  const evidencePresent = Boolean(measurementPhotoKey)
  const evidenceManifest = useMemo(() => {
    const entries = envelope?.payload.evidence ?? []
    return entries.map((entry) => ({
      type: entry.type,
      key: entry.key,
      present: entry.present,
      url: entry.key === measurementPhotoKey ? measurementPhotoUrl ?? undefined : undefined,
    }))
  }, [envelope, measurementPhotoKey, measurementPhotoUrl])

  const stateIndex = useMemo(() => CHIP_ORDER.indexOf(status), [status])

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const evidenceKey = `evidence:${tempIdRef.current}:photo`

    try {
      setError(null)
      await saveFile(evidenceKey, file)
      const localUrl = await getFileUrl(evidenceKey)
      setMeasurementPhotoKey(evidenceKey)
      setMeasurementPhotoName(file.name)
      setMeasurementPhotoUrl(localUrl)
      setMessage('Evidence photo stored locally.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store evidence photo.')
    }
  }

  async function buildPayload(): Promise<FoodBatchPayload> {
    const parsedPh = measuredPhValue.trim() === '' ? undefined : Number(measuredPhValue)
    const measurementTimestamp = Date.parse(measurementAt)
    const draftBase = {
      profile: 'hearthlands.food-batch.v1' as const,
      productName: productName.trim(),
      category,
      producer: createdBy.agentId,
      ingredients: [] as string[],
      process: {
        measurementMethod: measurementMethod.trim() || undefined,
        instrumentId: instrumentId.trim() || undefined,
        measurementAt: Number.isNaN(measurementTimestamp) ? new Date().toISOString() : new Date(measurementTimestamp).toISOString(),
      },
      safety: {
        measuredPhValue: Number.isFinite(parsedPh) ? parsedPh : undefined,
        verificationStatus: Number.isFinite(parsedPh) ? 'SELF_MEASURED' as const : 'UNVERIFIED' as const,
      },
      marketAccess: {
        mode: category === 'FERMENTED' && (!Number.isFinite(parsedPh) || (parsedPh ?? 99) > 4.6)
          ? 'PMA_PRIVATE_ONLY' as const
          : 'GENERAL_PUBLIC' as const,
      },
      evidence: [
        {
          type: 'photo' as const,
          key: measurementPhotoKey ?? `evidence:${tempIdRef.current}:photo`,
          present: Boolean(measurementPhotoKey),
        },
      ],
    }

    const seedDigest = await sha256Hex(stableStringify(draftBase))

    return {
      ...draftBase,
      batchId: `batch-${artifactIdFromDigest(seedDigest, 'food').slice(-12)}`,
    }
  }

  async function handleCrystallize() {
    setIsBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (!productName.trim()) {
        throw new Error('Product name is required before crystallizing.')
      }

      const payload = await buildPayload()
      const draftEnvelope = await crystallizeArtifact(payload, 'food.batch', createdBy, workspace)
      const nextProvenance: ProvenanceLink[] = draftEnvelope.provenance.map((entry) => ({
        ...entry,
        href: entry.key === measurementPhotoKey ? measurementPhotoUrl ?? undefined : entry.href,
      }))
      const nextEnvelope: HearthlandsWitnessEnvelope<FoodBatchPayload> = {
        ...draftEnvelope,
        provenance: nextProvenance,
        truthBoundary: {
          ...draftEnvelope.truthBoundary,
          notes: statusNotes('PUBLISH_READY'),
        },
      }

      const bundle = createDownloadLinks(manifestBundle(nextEnvelope))
      try {
        for (const file of bundle) {
          const link = document.createElement('a')
          link.href = file.url
          link.download = file.filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      } finally {
        bundle.forEach((file) => URL.revokeObjectURL(file.url))
      }

      setEnvelope(nextEnvelope)
      setStatus('PUBLISH_READY')
      setShowEnvelope(true)
      setMessage(`Crystallized locally. artifactId=${nextEnvelope.artifactId} digest=${nextEnvelope.payloadHash.digestHex}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crystallization failed.')
      setStatus('LOCAL_DRAFT')
    } finally {
      setIsBusy(false)
    }
  }

  async function handlePublish() {
    if (!envelope) {
      setError('Crystallize a draft before publishing.')
      return
    }

    setIsBusy(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(publishEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envelope,
          payload: envelope.payload,
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Publish failed.')
      }

      const receipt = body.receipt as WitnessReceiptRef | undefined
      if (!receipt) {
        throw new Error('Publish response did not include a receipt.')
      }

      const nextEnvelope: HearthlandsWitnessEnvelope<FoodBatchPayload> = {
        ...envelope,
        securityTier: 'PUBLIC_WITNESSED',
        witness: {
          ...(envelope.witness ?? {}),
          receipt,
        },
        truthBoundary: {
          ...envelope.truthBoundary,
          localPreview: false,
          notes: statusNotes('PUBLIC_WITNESSED'),
        },
      }

      setEnvelope(nextEnvelope)
      setStatus('PUBLIC_WITNESSED')
      setMessage(`Dev publish stub returned receipt ${receipt.receiptId}.`)
      
      // Update in library if exists
      setSavedBatches(prev => prev.map(b => 
        b.id === tempIdRef.current 
          ? { ...b, envelope: nextEnvelope, status: 'PUBLIC_WITNESSED', updatedAt: Date.now() }
          : b
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.')
    } finally {
      setIsBusy(false)
    }
  }

  // --- Local Batch Actions ---
  function handleSaveLocally() {
    if (!productName.trim()) {
      setError('Product name required to save.')
      return
    }
    const currentId = tempIdRef.current
    const newBatch: SavedBatch = {
      id: currentId,
      productName,
      category,
      measuredPhValue,
      measurementMethod,
      instrumentId,
      measurementAt,
      measurementPhotoKey,
      measurementPhotoName,
      measurementPhotoUrl,
      status,
      envelope,
      updatedAt: Date.now()
    }
    setSavedBatches(prev => {
      const exists = prev.find(b => b.id === currentId)
      if (exists) return prev.map(b => b.id === currentId ? newBatch : b)
      return [newBatch, ...prev]
    })
    setMessage('Saved locally.')
  }

  function handleReopen(batch: SavedBatch) {
    tempIdRef.current = batch.id
    setProductName(batch.productName)
    setCategory(batch.category)
    setMeasuredPhValue(batch.measuredPhValue)
    setMeasurementMethod(batch.measurementMethod)
    setInstrumentId(batch.instrumentId)
    setMeasurementAt(batch.measurementAt)
    setMeasurementPhotoKey(batch.measurementPhotoKey)
    setMeasurementPhotoName(batch.measurementPhotoName)
    setMeasurementPhotoUrl(batch.measurementPhotoUrl)
    setStatus(batch.status)
    setEnvelope(batch.envelope)
    setMessage('Reopened local draft.')
  }

  function handleDuplicate(batch: SavedBatch) {
    const newId = `temp-${Date.now().toString(36)}`
    tempIdRef.current = newId
    setProductName(batch.productName + ' (Copy)')
    setCategory(batch.category)
    setMeasuredPhValue(batch.measuredPhValue)
    setMeasurementMethod(batch.measurementMethod)
    setInstrumentId(batch.instrumentId)
    setMeasurementAt(nowLocalInputValue())
    // Note: Intentional copy of values but resetting status to local draft
    // Photos keep their local references, but ideally we'd duplicate the blob in IDB.
    // For now we'll just reference the same photo key.
    setMeasurementPhotoKey(batch.measurementPhotoKey)
    setMeasurementPhotoName(batch.measurementPhotoName)
    setMeasurementPhotoUrl(batch.measurementPhotoUrl)
    setStatus('LOCAL_DRAFT')
    setEnvelope(null)
    setMessage('Duplicated as new local draft.')
  }

  function handleToggleCompare(id: string) {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  function handleDownloadBundle(batch: SavedBatch) {
    if (!batch.envelope) return
    const bundle = createDownloadLinks(manifestBundle(batch.envelope))
    try {
      for (const file of bundle) {
        const link = document.createElement('a')
        link.href = file.url
        link.download = file.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      setMessage('Bundle downloaded locally.')
    } finally {
      bundle.forEach((file) => URL.revokeObjectURL(file.url))
    }
  }

  function handleCopyDigest(batch: SavedBatch) {
    if (!batch.envelope) return
    navigator.clipboard.writeText(batch.envelope.payloadHash.digestHex)
    setMessage('Copied locally.')
  }

  function handleCopyStatus(batch: SavedBatch) {
    const lines = [
      `Product: ${batch.productName}`,
      `Status: [${batch.status}]`,
      batch.envelope?.witness?.receipt ? `Dev Stub Receipt: ${batch.envelope.witness.receipt.receiptId}` : 'No dev stub receipt.'
    ]
    navigator.clipboard.writeText(lines.join('\\n'))
    setMessage('Copied locally. Dev stub receipt included only if previously returned.')
  }

  
  function handlePushToCommons(batch: SavedBatch) {
    if (!batch.productName) {
      setError('Product name is required to push to Commons.');
      return;
    }

    const isCrystallized = batch.status === 'PUBLISH_READY' || batch.status === 'PUBLIC_WITNESSED' || batch.status === 'CRYSTALLIZE_READY';
    const visibility = isCrystallized ? 'local_artifact' : 'local_draft';
    const summaryPrefix = isCrystallized ? 'Inspect crystallized cottage batch' : 'Review cottage batch draft';
    
    const lines = [
      `Category: ${batch.category}`,
      `pH: ${batch.measuredPhValue || 'N/A'}`,
      `Evidence: ${batch.measurementPhotoKey ? 'Present' : 'Missing'}`,
      batch.envelope ? `Digest: ${batch.envelope.payloadHash.digestHex}` : 'Digest: Not yet crystallized',
      batch.envelope?.witness?.receipt ? `Dev-stub receipt: ${batch.envelope.witness.receipt.receiptId}` : 'Dev-stub receipt: None'
    ];

    const promptText = `${summaryPrefix}: ${batch.productName}\n\n${lines.join('\n')}`;
    const commonsId = `cottage-commons-${batch.id}`;

    const newPrompt = {
      id: commonsId,
      prompt_text: promptText,
      author_type: 'human',
      author_id: 'local_operator',
      target_type: 'route',
      target_id: '/commons',
      status: 'proposed',
      boundary: 'local_only',
      visibility: visibility,
      scope: 'local_draft',
      source_route: '/cottage-assembly',
      receipt_hash: batch.envelope?.witness?.receipt?.receiptId || undefined,
      created_at: new Date(batch.updatedAt).toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      object_ref: {
        id: batch.id,
        title: batch.productName,
        purpose: 'cottage-batch',
        source: 'cottage-assembly',
        freshness: String(batch.updatedAt)
      }
    };

    const existing = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    // Dedupe by ID
    const filtered = existing.filter((p: any) => p.id !== commonsId);
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...filtered]));

    setMessage(isCrystallized ? 'Local artifact pushed to Commons.' : 'Local draft pushed to Commons.');
    setTimeout(() => {
      window.location.href = `/commons?source=cottage-assembly&object=${batch.id}`;
    }, 800);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Compare View */}
      {selectedForCompare.length === 2 && (
        <section style={{ border: '1px solid rgba(212,168,83,0.3)', borderRadius: 16, background: 'rgba(10,8,6,0.95)', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#D4A853', fontWeight: 700 }}>
              Compare Local Batches
            </div>
            <button onClick={() => setSelectedForCompare([])} style={{ fontSize: 10, color: '#9b8a76', textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: 'none' }}>Close Compare</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {selectedForCompare.map(id => {
              const b = savedBatches.find(x => x.id === id)
              if (!b) return null
              return (
                <div key={b.id} style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, fontSize: 12, color: '#c9bba5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, color: '#FAF6EF', fontSize: 14 }}>{b.productName}</div>
                  <div style={{ color: '#D4A853', fontSize: 10, fontWeight: 700 }}>[{b.status}]</div>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#9b8a76' }}>Category:</span>
                    <span>{b.category}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#9b8a76' }}>Measured pH:</span>
                    <span>{b.measuredPhValue || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#9b8a76' }}>Method:</span>
                    <span>{b.measurementMethod || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#9b8a76' }}>Instrument:</span>
                    <span>{b.instrumentId || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                    <span style={{ color: '#9b8a76' }}>Evidence:</span>
                    <span>{b.measurementPhotoKey ? 'Present' : 'None'}</span>
                  </div>
                  {b.envelope && (
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr' }}>
                      <span style={{ color: '#9b8a76' }}>Artifact ID:</span>
                      <span style={{ wordBreak: 'break-all', fontSize: 10 }}>{b.envelope.artifactId}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Main drafting area */}
        <section
          aria-label="Cottage Assembly Line"
          style={{
            border: '1px solid rgba(212,168,83,0.18)',
            background: 'rgba(10, 8, 6, 0.9)',
            borderRadius: 24,
            padding: 24,
            color: '#eadfcd',
            display: 'grid',
            gap: 16,
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#D4A853' }}>
                Cottage Assembly Line
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: '#c9bba5' }}>
                Minimal local drafting flow for cottage-food batch manifests. No browser signing, no live witness path, and no regulatory approval claims.
              </div>
            </div>
            <button
              onClick={handleSaveLocally}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(212,168,83,0.3)',
                background: 'transparent',
                color: '#D4A853',
                padding: '6px 12px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                cursor: 'pointer'
              }}
            >
              Save Draft Locally
            </button>
          </header>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHIP_ORDER.map((chip, index) => {
              const isCurrent = index === stateIndex
              const isAchieved = index < stateIndex
              return (
                <span
                  key={chip}
                  aria-live="polite"
                  style={{
                    borderRadius: 999,
                    padding: '6px 10px',
                    border: isCurrent ? '1px solid rgba(52, 211, 153, 0.5)' : isAchieved ? '1px solid rgba(52, 211, 153, 0.15)' : '1px solid rgba(255,255,255,0.05)',
                    background: isCurrent ? 'rgba(52, 211, 153, 0.15)' : isAchieved ? 'transparent' : 'transparent',
                    color: isCurrent ? '#86efac' : isAchieved ? 'rgba(52, 211, 153, 0.5)' : 'rgba(155, 138, 118, 0.3)',
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  [{chip}]
                </span>
              )
            })}
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Product name</span>
              <input
                aria-label="Product name"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Category</span>
              <select
                aria-label="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value as Category)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              >
                <option value="FERMENTED">FERMENTED</option>
                <option value="BAKED">BAKED</option>
                <option value="DEHYDRATED">DEHYDRATED</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measured pH value (optional)</span>
              <input
                aria-label="Measured pH value"
                type="number"
                step="0.01"
                value={measuredPhValue}
                onChange={(event) => setMeasuredPhValue(event.target.value)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measurement method</span>
              <input
                aria-label="Measurement method"
                value={measurementMethod}
                onChange={(event) => setMeasurementMethod(event.target.value)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Instrument ID</span>
              <input
                aria-label="Instrument ID"
                value={instrumentId}
                onChange={(event) => setInstrumentId(event.target.value)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measurement at</span>
              <input
                aria-label="Measurement at"
                type="datetime-local"
                value={measurementAt}
                onChange={(event) => setMeasurementAt(event.target.value)}
                style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', padding: 10, color: '#FAF6EF' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measurement photo</span>
              <input aria-label="Measurement photo" type="file" accept="image/*" onChange={handlePhotoChange} />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 6, color: '#9fb4c7', fontSize: 12 }}>
            <div>Evidence key: {measurementPhotoKey ?? `evidence:${tempIdRef.current}:photo`}</div>
            <div>Evidence present: {evidencePresent ? 'yes' : 'no'}</div>
            {measurementPhotoName ? <div>Local file: {measurementPhotoName}</div> : null}
            {measurementPhotoUrl ? (
              <a href={measurementPhotoUrl} target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>
                Preview local evidence
              </a>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCrystallize}
              disabled={isBusy}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(212,168,83,0.35)',
                background: 'rgba(212,168,83,0.15)',
                color: '#fcd34d',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: isBusy ? 'progress' : 'pointer',
              }}
            >
              Crystallize
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isBusy || !envelope}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(52,211,153,0.35)',
                background: envelope ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                color: envelope ? '#86efac' : '#9b8a76',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: isBusy ? 'progress' : envelope ? 'pointer' : 'not-allowed',
              }}
            >
              Publish to dev stub
            </button>
          </div>

          {message ? (
            <div role="status" style={{ borderRadius: 14, border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.08)', padding: 12, color: '#ccebd8' }}>
              {message}
            </div>
          ) : null}

          {error ? (
            <div role="alert" style={{ borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)', padding: 12, color: '#fecaca' }}>
              {error}
            </div>
          ) : null}

          <section style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)', padding: 14, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#93C5FD' }}>
              Evidence manifest
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {evidenceManifest.map((entry) => (
                <div key={`${entry.type}:${entry.key}`} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: '#FAF6EF' }}>{entry.type}</div>
                  <div style={{ fontSize: 11, color: '#9fb4c7' }}>key: {entry.key}</div>
                  <div style={{ fontSize: 11, color: entry.present ? '#86efac' : '#fbbf24' }}>
                    present: {entry.present ? 'true' : 'false'}
                  </div>
                  {entry.url ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={entry.url} target="_blank" rel="noreferrer" style={{ color: '#93C5FD' }}>
                        Preview saved photo
                      </a>
                      <a href={entry.url} download={measurementPhotoName ?? 'evidence-photo'} style={{ color: '#93C5FD' }}>
                        Download saved photo
                      </a>
                    </div>
                  ) : null}
                </div>
              ))}
              {evidenceManifest.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9b8a76' }}>No evidence manifest entries yet.</div>
              ) : null}
            </div>
          </section>

          <details open={showEnvelope} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)', padding: 14 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#eadfcd' }}>Envelope viewer</summary>
            <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: 12, color: '#c9bba5', marginTop: 12 }}>
              {envelope ? JSON.stringify(envelope, null, 2) : 'Crystallize a draft to inspect the local envelope.'}
            </pre>
          </details>
        </section>

        {/* Local Batch Library Panel */}
        <aside style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, background: 'rgba(10,8,6,0.95)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FAF6EF', fontWeight: 700 }}>
              Local Batch Library
            </div>
            <div style={{ fontSize: 10, color: '#9b8a76', letterSpacing: '0.05em' }}>
              Local Session / Browser Stored
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {savedBatches.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9b8a76', padding: 12, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, textAlign: 'center' }}>
                No local batches saved.
              </div>
            ) : (
              savedBatches.map(batch => {
                const isSelectedForCompare = selectedForCompare.includes(batch.id)
                return (
                  <div key={batch.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, background: 'rgba(0,0,0,0.2)', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, color: '#FAF6EF', fontSize: 13, wordBreak: 'break-word' }}>
                        {batch.productName || 'Untitled Batch'}
                      </div>
                      <button 
                        onClick={() => handleToggleCompare(batch.id)}
                        style={{ 
                          fontSize: 9, 
                          textTransform: 'uppercase', 
                          padding: '2px 6px', 
                          borderRadius: 4,
                          border: isSelectedForCompare ? '1px solid #D4A853' : '1px solid rgba(255,255,255,0.2)',
                          background: isSelectedForCompare ? 'rgba(212,168,83,0.1)' : 'transparent',
                          color: isSelectedForCompare ? '#D4A853' : '#9b8a76',
                          cursor: 'pointer'
                        }}
                      >
                        {isSelectedForCompare ? 'Comparing' : 'Compare'}
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#D4A853', fontWeight: 700 }}>[{batch.status}]</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: '#9b8a76' }}>
                      <span>{batch.category}</span>
                      <span>•</span>
                      <span>{new Date(batch.updatedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Evidence: {batch.measurementPhotoKey ? 'Yes' : 'No'}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <button onClick={() => handleReopen(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#FAF6EF', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Reopen</button>
                      <button onClick={() => handleDuplicate(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#FAF6EF', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Duplicate</button>
                      
                      {batch.envelope && (
                        <>
                          <button onClick={() => handleDownloadBundle(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#93C5FD', border: '1px solid rgba(147,197,253,0.2)', cursor: 'pointer' }}>Export Local Bundle</button>
                          <button onClick={() => handleCopyDigest(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#93C5FD', border: '1px solid rgba(147,197,253,0.2)', cursor: 'pointer' }}>Copy Digest</button>
                        </>
                      )}
                      
                      <button onClick={() => handlePushToCommons(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(212,168,83,0.1)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', cursor: 'pointer', fontWeight: 700 }}>
                        Push to Commons
                      </button>
                      <button onClick={() => handleCopyStatus(batch)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#c9bba5', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>Copy Status</button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
