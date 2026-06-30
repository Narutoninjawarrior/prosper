import { useState, useCallback, useEffect } from 'react'
import BuilderPanel from '../BuilderPanel'
import BuilderDrawer from './BuilderDrawer'
import StewardMount from '../steward/StewardMount'
import { COUNCIL_PROPOSALS } from '../lib/councilProposals'

const DOCK_ACTIONS = [
  { id: 'move', label: 'Move', hint: 'WASD · click ground' },
  { id: 'inspect', label: 'Inspect', hint: 'Click object or portal' },
  { id: 'build', label: 'Build', hint: 'Preview catalogue' },
  { id: 'council', label: 'Council', hint: 'Proposal pulse' },
  { id: 'steward', label: 'Steward', hint: 'Ask Gemma' },
]

const STATUS_BADGE = {
  live: { color: '#34D399', label: 'Live' },
  seeded: { color: '#D4A853', label: 'Seeded' },
  prototype: { color: '#8E7E6B', label: 'Prototype' },
}

function CouncilPanel({ onClose }) {
  const latest = COUNCIL_PROPOSALS.find((p) => p.state === 'standing' || p.state === 'witnessed')
    || COUNCIL_PROPOSALS[0]

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      zIndex: 27,
      width: 'min(360px, calc(100vw - 32px))',
      background: 'linear-gradient(180deg, rgba(22,12,8,0.92), rgba(10,6,4,0.88))',
      border: '1px solid rgba(170,136,255,0.28)',
      borderRadius: 16,
      padding: 14,
      fontFamily: 'monospace',
      color: '#FAF6EF',
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ color: '#AA88FF', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Council · seeded
          </div>
          <div style={{ fontSize: 16, marginTop: 6 }}>{latest.title}</div>
        </div>
        <button type="button" onClick={onClose} style={miniBtn}>Close</button>
      </div>
      <div style={{ color: '#8E7E6B', fontSize: 11, marginTop: 10, lineHeight: 1.55 }}>{latest.synthesis}</div>
      <div style={{ color: '#5E5143', fontSize: 9, marginTop: 8 }}>
        State: {latest.state} · source: {latest.source} · preview-only governance
      </div>
      <a href="/council" style={{ display: 'inline-block', marginTop: 10, color: '#D4A853', fontSize: 10, textDecoration: 'none' }}>
        Open council board →
      </a>
    </div>
  )
}

function InspectHintPanel({ realm, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      zIndex: 27,
      width: 'min(320px, calc(100vw - 32px))',
      background: 'rgba(10,6,4,0.9)',
      border: '0.5px solid #5C3D1E',
      borderRadius: 14,
      padding: 14,
      fontFamily: 'monospace',
      color: '#FAF6EF',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: '#D4A853', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Inspect mode
        </div>
        <button type="button" onClick={onClose} style={miniBtn}>Close</button>
      </div>
      <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
        {realm === 'biosphere'
          ? 'Click a cultivation node to open the inspect rail. Plant and harvest from the rail — not from raw clicks.'
          : 'Click a forge object or realm portal to inspect. Empty ground still walks. One inspect rail at a time.'}
      </div>
      <div style={{ color: '#8E7E6B', fontSize: 10, marginTop: 8 }}>
        Selection opens the inspect rail on the right (or left for portals).
      </div>
    </div>
  )
}

function MoveHintPanel({ realm, onClose, children }) {
  if (children) return children
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 27,
      width: 'min(280px, calc(100vw - 32px))',
      background: 'rgba(10,6,4,0.9)',
      border: '0.5px solid #5C3D1E',
      borderRadius: 14,
      padding: 14,
      fontFamily: 'monospace',
      color: '#FAF6EF',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: '#D4A853', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Movement
        </div>
        <button type="button" onClick={onClose} style={miniBtn}>Close</button>
      </div>
      <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
        {realm === 'biosphere'
          ? 'Orbit with drag · scroll zoom · W/S zoom keys. Movement is camera-first in the garden.'
          : 'WASD / arrows move · click empty ground to walk · right-drag orbits camera.'}
      </div>
    </div>
  )
}

const miniBtn = {
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#FAF6EF',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 10,
}

/**
 * Reusable civic interaction shell for /world and /biosphere.
 * One dominant dock panel at a time; inspect rails render via children.
 */
export default function InteractionShell({
  realm = 'world',
  heat = 2980,
  emberBalance = 0,
  nodeCount = 0,
  activePlots = 0,
  buildingLabel = null,
  onPlace = () => {},
  movementPanel = null,
  inspectChildren = null,
  statusLabel = 'live',
  buildOpenSignal = 0,
  stewardOpenSignal = 0,
}) {
  const [activePanel, setActivePanel] = useState(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [stewardSignal, setStewardSignal] = useState(0)
  const [buildingDraft, setBuildingDraft] = useState(buildingLabel)

  const openPanel = useCallback((id) => {
    setActivePanel((current) => (current === id ? null : id))
    if (id === 'build') setBuilderOpen(true)
    else setBuilderOpen(false)
    if (id === 'steward') setStewardSignal((v) => v + 1)
  }, [])

  const closeAllPanels = useCallback(() => {
    setActivePanel(null)
    setBuilderOpen(false)
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'b' || e.key === 'B') {
        setActivePanel('build')
        setBuilderOpen(true)
      }
      if (e.key === 'Escape') closeAllPanels()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [closeAllPanels])

  useEffect(() => {
    setBuildingDraft(buildingLabel)
  }, [buildingLabel])

  useEffect(() => {
    if (buildOpenSignal > 0) {
      setActivePanel('build')
      setBuilderOpen(true)
    }
  }, [buildOpenSignal])

  useEffect(() => {
    if (stewardOpenSignal > 0) setStewardSignal((v) => v + 1)
  }, [stewardOpenSignal])

  const badge = STATUS_BADGE[statusLabel] || STATUS_BADGE.live

  return (
    <>
      {/* Status strip — top center, minimal */}
      <div style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px',
        borderRadius: 999,
        background: 'rgba(10,6,4,0.72)',
        border: '1px solid rgba(212,168,83,0.18)',
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#8E7E6B',
        pointerEvents: 'none',
      }}>
        <span style={{ color: badge.color }}>{badge.label}</span>
        <span>·</span>
        <span>{realm === 'biosphere' ? 'Sacred garden' : 'World commons'}</span>
        <span>·</span>
        <span>{heat} $HEAT</span>
        <span>·</span>
        <span style={{ color: '#E8842A' }}>{emberBalance.toLocaleString()} $EMBER</span>
      </div>

      {/* Dominant panels — exclusive */}
      {activePanel === 'move' && (
        <MoveHintPanel realm={realm} onClose={closeAllPanels}>
          {movementPanel}
        </MoveHintPanel>
      )}
      {activePanel === 'inspect' && (
        <InspectHintPanel realm={realm} onClose={closeAllPanels} />
      )}
      {activePanel === 'council' && (
        <CouncilPanel onClose={closeAllPanels} />
      )}

      {activePanel === 'build' && (
        <BuilderDrawer
          visible
          realm={realm}
          nodeCount={nodeCount}
          activePlots={activePlots}
          buildingLabel={buildingDraft}
          emberBalance={emberBalance}
          onClose={closeAllPanels}
        />
      )}

      <BuilderPanel
        visible={builderOpen}
        emberBalance={emberBalance}
        onPlace={(type, config) => {
          setBuildingDraft(config?.name || type)
          onPlace(type, config)
        }}
      />

      <StewardMount
        emberBalance={emberBalance}
        realm={realm}
        anchor="right"
        openSignal={stewardSignal}
      />

      {inspectChildren}

      {/* Bottom action dock */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(22,12,8,0.94), rgba(10,6,4,0.9))',
        border: '1px solid rgba(212,168,83,0.28)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(16px)',
        fontFamily: 'monospace',
      }}>
        {DOCK_ACTIONS.map((action) => {
          const active = activePanel === action.id
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => openPanel(action.id)}
              title={action.hint}
              style={{
                minWidth: 72,
                borderRadius: 12,
                border: active ? '1px solid rgba(212,168,83,0.55)' : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(212,168,83,0.18)' : 'rgba(255,255,255,0.04)',
                color: active ? '#FAF6EF' : '#B89C82',
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: 11,
                display: 'grid',
                gap: 2,
              }}
            >
              <span>{action.label}</span>
              <span style={{ fontSize: 8, color: '#5E5143', fontWeight: 400 }}>{action.hint}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

export { BuilderDrawer }
