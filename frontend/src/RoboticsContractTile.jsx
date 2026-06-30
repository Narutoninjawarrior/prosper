import { useEffect, useState } from 'react'
import { cloudFunctionUrl } from './lib/hearthApi'

async function fetchLedgerLatest() {
  const urls = [
    '/api/embodiment/ledger/latest',
    cloudFunctionUrl('embodimentLedgerLatest'),
    'https://hearth-lodge.preview.emergentagent.com/api/embodiment/ledger/latest',
    '/embodiment_bounty.json',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now())
      if (!res.ok) continue
      const data = await res.json()
      if (url.endsWith('embodiment_bounty.json')) {
        return { entries: (data.entries || []).slice(-10), summary: undefined }
      }
      return data
    } catch {
      /* try next */
    }
  }
  return { entries: [] }
}

function SyncDot({ synced }) {
  return (
    <span
      title={synced ? 'Mirrored to Firebase' : 'Pending mirror'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        marginRight: 6,
        background: synced ? '#10b981' : '#f59e0b',
        boxShadow: synced ? '0 0 6px #10b981' : '0 0 6px #f59e0b88',
      }}
    />
  )
}

/** Embodiment bounty chain — green dot mirrored, amber pending */
export default function RoboticsContractTile() {
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const data = await fetchLedgerLatest()
        if (!cancelled) {
          setEntries(data.entries || [])
          setSummary(data.summary)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'ledger offline')
      }
    }
    poll()
    const id = window.setInterval(poll, 10000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <div
      style={{
        background: 'rgba(10,6,4,0.92)',
        border: '1px solid #C27C5A',
        borderRadius: 10,
        padding: 16,
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#C8B89A',
      }}
    >
      <div style={{ color: '#D4A853', fontSize: 12, fontWeight: 600, marginBottom: 10, letterSpacing: 1 }}>
        ⬡ Embodiment Ledger
      </div>

      {summary && (
        <div style={{ color: '#888', marginBottom: 10, fontSize: 10 }}>
          Mirror: {summary.firebase_synced ?? 0} synced · {summary.firebase_pending ?? 0} pending
          {summary.firebase_configured === false && (
            <span style={{ color: '#f59e0b' }}> · Firebase env not configured</span>
          )}
        </div>
      )}

      {error && <div style={{ color: '#e05a4f', marginBottom: 8 }}>{error}</div>}

      {!entries.length && !error && <div style={{ color: '#666' }}>No ledger entries yet</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((e) => (
          <div
            key={e.chain_hash || e.timestamp + e.agent_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 6,
              borderLeft: '3px solid #E8842A',
            }}
          >
            <div>
              <SyncDot synced={e.firebase_synced === true} />
              <span style={{ color: '#FAF6EF' }}>{e.agent_id}</span>
              <span style={{ color: '#777', marginLeft: 6 }}>{e.action}</span>
            </div>
            <div style={{ color: '#4A90D9', textAlign: 'right' }}>
              {e.ember_awarded ?? 0} $EMBER
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
