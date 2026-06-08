import { useEffect, useMemo, useState } from 'react'
import { ledgerApiUrl } from '../lib/hearthApi'

const shell = {
  position: 'fixed',
  top: 16,
  right: 16,
  zIndex: 23,
  width: 'min(340px, calc(100vw - 32px))',
  display: 'grid',
  gap: 10,
  pointerEvents: 'auto',
}

const panel = {
  background:
    'linear-gradient(180deg, rgba(12,7,5,0.9), rgba(8,5,4,0.76))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18,
  boxShadow:
    '0 18px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04)',
  backdropFilter: 'blur(18px)',
}

function normalizeAction(action = '') {
  return action.replace(/_/g, ' ').trim()
}

function summarizeLedgerEntry(entry) {
  const agent = entry.agent_id || 'Unknown fellow'
  const action = normalizeAction(entry.action || 'updated the ledger')
  const quest = entry.bounty_id ? `Bounty ${entry.bounty_id}` : null
  const title = action.includes('joined')
    ? `${agent} joined the fellowship`
    : quest && action.includes('sealed')
      ? `${quest} sealed by ${agent}`
      : `${agent} ${action}`

  const detail = quest
    ? `${quest} · ${entry.ember_awarded ?? 0} $EMBER witnessed`
    : `${entry.ember_awarded ?? 0} $EMBER witnessed on the public chain`

  return {
    id: entry.chain_hash || `${agent}-${action}-${entry.timestamp || 'now'}`,
    title,
    detail,
    source: entry.firebase_synced === true ? 'ledger mirrored' : 'ledger pending mirror',
    accent: entry.firebase_synced === true ? '#10b981' : '#D4A853',
  }
}

async function fetchLedgerFeed() {
  const urls = [
    '/api/embodiment/ledger/latest',
    ledgerApiUrl('latest'),
    'https://hearth-lodge.preview.emergentagent.com/api/embodiment/ledger/latest',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`)
      if (!res.ok) continue
      const data = await res.json()
      if (!Array.isArray(data.entries) || !data.entries.length) continue
      return {
        items: data.entries.slice(0, 4).map(summarizeLedgerEntry),
        summary: data.summary || null,
        sourceLabel: 'Ledger live',
      }
    } catch {
      // Try the next upstream.
    }
  }

  return null
}

function buildFallbackItems({ realm, heat, emberBalance, nodeCount, activePlots }) {
  const placeCount = realm === 'biosphere' ? activePlots : nodeCount
  const placeLabel = realm === 'biosphere' ? 'plots awake' : 'forge nodes visible'

  return [
    {
      id: `${realm}-pulse-arrivals`,
      title: realm === 'biosphere'
        ? `${activePlots} biosphere plots are awake`
        : `${nodeCount} world structures are visible`,
      detail: 'Live shell pulse from the current public scene state',
      source: 'live shell',
      accent: '#7A9E7E',
    },
    {
      id: `${realm}-pulse-heat`,
      title: `Bellows heat is holding at ${heat}`,
      detail: 'Read-only bellows state mirrored into the public vessel',
      source: 'live shell',
      accent: '#E8842A',
    },
    {
      id: `${realm}-pulse-treasury`,
      title: `Treasury snapshot shows ${emberBalance.toLocaleString()} $EMBER`,
      detail: 'Read-only economy pulse; no client writes from this surface',
      source: 'live shell',
      accent: '#D4A853',
    },
    {
      id: `${realm}-pulse-build`,
      title: `${placeCount} ${placeLabel} in the ${realm}`,
      detail: 'Scene telemetry fallback while live fellowship events are quiet',
      source: 'live shell',
      accent: '#4A90D9',
    },
  ]
}

export default function CommunityFeed({
  realm = 'world',
  heat = 0,
  emberBalance = 0,
  nodeCount = 0,
  activePlots = 0,
}) {
  const fallbackItems = useMemo(
    () => buildFallbackItems({ realm, heat, emberBalance, nodeCount, activePlots }),
    [realm, heat, emberBalance, nodeCount, activePlots]
  )
  const [feedItems, setFeedItems] = useState(fallbackItems)
  const [sourceLabel, setSourceLabel] = useState('Live shell fallback')
  const [mirrorSummary, setMirrorSummary] = useState(null)
  const [spotlightIndex, setSpotlightIndex] = useState(0)

  useEffect(() => {
    setFeedItems((current) => (sourceLabel === 'Ledger live' && current.length ? current : fallbackItems))
  }, [fallbackItems, sourceLabel])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const ledger = await fetchLedgerFeed()
      if (cancelled) return

      if (ledger) {
        setFeedItems(ledger.items)
        setMirrorSummary(ledger.summary)
        setSourceLabel(ledger.sourceLabel)
        return
      }

      setFeedItems(fallbackItems)
      setMirrorSummary(null)
      setSourceLabel('Live shell fallback')
    }

    poll()
    const id = window.setInterval(poll, 12000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [fallbackItems])

  useEffect(() => {
    if (feedItems.length < 2) return undefined
    const id = window.setInterval(() => {
      setSpotlightIndex((value) => (value + 1) % feedItems.length)
    }, 3800)
    return () => window.clearInterval(id)
  }, [feedItems])

  return (
    <div
      style={{
        ...shell,
        top: realm === 'biosphere' ? 118 : 16,
      }}
    >
      <div style={{ ...panel, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
          <div>
            <div style={{ color: '#AA88FF', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Settlement feed
            </div>
            <div style={{ color: '#FAF6EF', fontSize: 17, lineHeight: 1.15, marginTop: 6 }}>
              The fellowship is visible in the world.
            </div>
          </div>

          <div
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.04)',
              color: sourceLabel === 'Ledger live' ? '#10b981' : '#D4A853',
              fontSize: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {sourceLabel}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {feedItems.map((item, index) => {
            const active = index === spotlightIndex
            return (
              <div
                key={item.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 14,
                  border: `1px solid ${active ? `${item.accent}44` : 'rgba(255,255,255,0.06)'}`,
                  background: active
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(255,255,255,0.03)',
                  transform: active ? 'translateY(-2px)' : 'translateY(0)',
                  opacity: active ? 1 : 0.72,
                  transition: 'transform 220ms ease, opacity 220ms ease, border-color 220ms ease, background 220ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ color: '#FAF6EF', fontSize: 12, lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ color: item.accent, fontSize: 9, whiteSpace: 'nowrap' }}>{item.source}</div>
                </div>
                <div style={{ color: '#8E7E6B', fontSize: 10, marginTop: 6, lineHeight: 1.45 }}>
                  {item.detail}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ color: '#6E6256', fontSize: 10 }}>
            Read-only community pulse over the live vessel
          </div>
          {mirrorSummary && (
            <div style={{ color: '#8E7E6B', fontSize: 10 }}>
              {mirrorSummary.firebase_synced ?? 0} synced · {mirrorSummary.firebase_pending ?? 0} pending
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
