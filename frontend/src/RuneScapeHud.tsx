
import { useBellowsState } from './lib/useBellowsState'
import { useSandboxFirestore } from './lib/useSandboxFirestore'

export default function RuneScapeHud() {
  const bellows = useBellowsState()
  const { remoteObjects } = useSandboxFirestore()

  const heat = bellows?.heat ?? 0
  const ember = bellows?.ember_balance ?? 0
  const tick = bellows?.tick ?? 0
  const intent = bellows?.last_intent ?? 'Awaiting breath'
  
  const plots = bellows?.biosphere_nodes || []
  const activePlots = plots.filter(p => p.active).length

  const masonryCount = remoteObjects?.length || 0

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 100,
      pointerEvents: 'none',
      fontFamily: 'monospace',
      userSelect: 'none',
    }}>
      {/* Container */}
      <div style={{
        background: 'rgba(10, 6, 4, 0.95)',
        border: '1px solid #3D2B1A',
        borderRadius: '12px',
        padding: '16px',
        width: '260px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #3D2B1A', paddingBottom: '8px', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, color: '#D4A853', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Hearthlands Stats
          </h2>
          <div style={{ color: '#777', fontSize: '10px', marginTop: '4px' }}>
            Tick {tick} • {intent}
          </div>
        </div>

        {/* Skills Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          
          {/* Economy */}
          <div>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase' }}>Treasury</div>
            <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 'bold' }}>{Math.floor(ember)} $EMBER</div>
          </div>
          
          {/* Energy */}
          <div>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase' }}>Energy</div>
            <div style={{ color: '#f59e0b', fontSize: '14px', fontWeight: 'bold' }}>{Math.floor(heat)} $HEAT</div>
          </div>

          {/* Farming Skill */}
          <div>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase' }}>Farming</div>
            <div style={{ color: '#10b981', fontSize: '14px', fontWeight: 'bold' }}>{activePlots}/19 Plots</div>
          </div>

          {/* Masonry Skill */}
          <div>
            <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase' }}>Masonry</div>
            <div style={{ color: '#C27C5A', fontSize: '14px', fontWeight: 'bold' }}>{masonryCount} Objects</div>
          </div>

        </div>
      </div>
    </div>
  )
}
