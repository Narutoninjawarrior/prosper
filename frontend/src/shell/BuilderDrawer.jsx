import { latestCouncilProposalPulse } from '../lib/vesselRegistry'
import { useContract, sanctuaryBridge } from '../lib/sanctuaryBridge'

const STATUS_STYLE = {
  live: { color: '#34D399', label: 'Live' },
  seeded: { color: '#D4A853', label: 'Seeded' },
  mirrored: { color: '#60A5FA', label: 'Mirrored' },
  prototype: { color: '#8E7E6B', label: 'Prototype · preview only' },
}

const FALLBACK_QUICK_LINKS = [
  { public_route: '/forge', title: 'Forge', status: 'prototype' },
  { public_route: '/3dforge', title: '3D Forge', status: 'live' },
  { public_route: '/council', title: 'Council', status: 'seeded' },
  { public_route: '/hall', title: 'Hall', status: 'live' },
  { public_route: '/artifacts', title: 'Artifacts', status: 'seeded' },
]

export default function BuilderDrawer({
  visible = false,
  realm = 'world',
  nodeCount = 0,
  activePlots = 0,
  buildingLabel = null,
  emberBalance = 0,
  onClose,
}) {
  if (!visible) return null

  const council = latestCouncilProposalPulse()
  const appsEnvelope = useContract('/lodge_apps.json', sanctuaryBridge.normalizeLodgeApps, [])
  const quickLinks = appsEnvelope.data.length > 0 ? appsEnvelope.data : FALLBACK_QUICK_LINKS

  const objectLabel = realm === 'biosphere'
    ? `${activePlots} of 19 plots awake`
    : `${nodeCount} mirrored forge object${nodeCount === 1 ? '' : 's'}`

  return (
    <div style={{
      position: 'fixed',
      left: '50%',
      bottom: 72,
      transform: 'translateX(-50%)',
      zIndex: 28,
      width: 'min(520px, calc(100vw - 32px))',
      background: 'linear-gradient(180deg, rgba(22,12,8,0.94), rgba(10,6,4,0.92))',
      border: '1px solid rgba(212,168,83,0.28)',
      borderRadius: 16,
      padding: 14,
      fontFamily: 'monospace',
      color: '#FAF6EF',
      backdropFilter: 'blur(18px)',
      boxShadow: '0 18px 50px rgba(0,0,0,0.38)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
        <div>
          <div style={{ color: '#D4A853', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Builder drawer · {realm}
          </div>
          <div style={{ fontSize: 16, marginTop: 6 }}>Forge state</div>
          <div style={{ color: '#8E7E6B', fontSize: 10, marginTop: 4 }}>
            Preview-only placement until steward write path is sealed.
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#FAF6EF',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            Close
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: '#8E7E6B', fontSize: 9 }}>Active objects</div>
          <div style={{ color: '#7A9E7E', fontSize: 18, marginTop: 4 }}>{realm === 'biosphere' ? activePlots : nodeCount}</div>
          <div style={{ color: '#5E5143', fontSize: 9, marginTop: 2 }}>{objectLabel}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: '#8E7E6B', fontSize: 9 }}>Building</div>
          <div style={{ color: '#E8842A', fontSize: 13, marginTop: 6, lineHeight: 1.35 }}>
            {buildingLabel || 'Browse catalogue · preview only'}
          </div>
        </div>
        <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ color: '#8E7E6B', fontSize: 9 }}>Treasury</div>
          <div style={{ color: '#E8842A', fontSize: 18, marginTop: 4 }}>{emberBalance.toLocaleString()}</div>
          <div style={{ color: '#5E5143', fontSize: 9 }}>$EMBER · read-only</div>
        </div>
      </div>

      <div style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 12,
        background: 'rgba(170,136,255,0.08)',
        border: '1px solid rgba(170,136,255,0.22)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ color: '#AA88FF', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Council pulse · {council.state}
          </div>
          <span style={{
            fontSize: 9,
            color: STATUS_STYLE[council.status_label]?.color || '#8E7E6B',
          }}>
            {STATUS_STYLE[council.status_label]?.label || council.status_label}
          </span>
        </div>
        <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{council.title}</div>
        <div style={{ color: '#8E7E6B', fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>{council.synthesis}</div>
        <a
          href="/council"
          style={{ display: 'inline-block', marginTop: 8, color: '#D4A853', fontSize: 10, textDecoration: 'none' }}
        >
          Open full council board →
        </a>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {quickLinks.slice(0, 6).map((link) => {
          // Dynamic accent logic
          const accent = link.status === 'live' ? '#34D399' : link.status === 'seeded' ? '#D4A853' : link.status === 'mirrored' ? '#60A5FA' : '#8E7E6B'
          return (
            <a
              key={link.public_route}
              href={link.public_route}
              title={link.summary || link.title}
              style={{
                borderRadius: 999,
                border: `1px solid ${accent}44`,
                background: `${accent}18`,
                color: '#FAF6EF',
                padding: '6px 12px',
                fontSize: 10,
                textDecoration: 'none',
              }}
            >
              {link.title}
            </a>
          )
        })}
      </div>
    </div>
  )
}
