const shell = {
  position: 'fixed',
  top: 16,
  left: 16,
  zIndex: 24,
  width: 'min(360px, calc(100vw - 32px))',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  pointerEvents: 'auto',
}

const panel = {
  background:
    'linear-gradient(180deg, rgba(22,12,8,0.88), rgba(10,6,4,0.78))',
  border: '1px solid rgba(212,168,83,0.24)',
  borderRadius: 18,
  boxShadow: '0 18px 50px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.04)',
  backdropFilter: 'blur(18px)',
}

const goalsForRealm = {
  world: [
    { label: 'Forge commons', cap: 5000, accent: '#E8842A' },
    { label: 'Portal signage', cap: 2600, accent: '#4A90D9' },
    { label: 'Gemma sanctum', cap: 3400, accent: '#D4A853' },
  ],
  biosphere: [
    { label: 'Soil beds', cap: 3800, accent: '#7A9E7E' },
    { label: 'Wind canopy', cap: 2900, accent: '#C27C5A' },
    { label: 'Mycelium choir', cap: 4200, accent: '#AA88FF' },
  ],
}

function GoalBar({ label, progress, accent }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#C8B89A' }}>
        <span>{label}</span>
        <span>{progress}% funded</span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${accent}, rgba(250,246,239,0.82))`,
            boxShadow: `0 0 16px ${accent}55`,
          }}
        />
      </div>
    </div>
  )
}

export default function CommunityPulse({
  realm = 'biosphere',
  heat = 2980,
  emberBalance = 0,
  nodeCount = 0,
  activePlots = 0,
  onOpenBuilder,
  onOpenSteward,
}) {
  const goals = goalsForRealm[realm] || goalsForRealm.biosphere
  const energyRatio = Math.max(0, Math.min(1, emberBalance / 5000))
  const activityRatio = realm === 'biosphere'
    ? Math.max(0, Math.min(1, activePlots / 19))
    : Math.max(0, Math.min(1, nodeCount / 24))

  return (
    <div style={shell}>
      <div style={{ ...panel, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
          <div>
            <div style={{ color: '#D4A853', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Fellowship pulse
            </div>
            <div style={{ color: '#FAF6EF', fontSize: 20, lineHeight: 1.1, marginTop: 6 }}>
              {realm === 'biosphere' ? 'Biosphere stewardship' : 'World build commons'}
            </div>
            <div style={{ color: '#8E7E6B', fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>
              Live community intent, treasury pressure, and build momentum without leaving the scene.
            </div>
          </div>

          <div
            style={{
              minWidth: 84,
              padding: '8px 10px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              textAlign: 'right',
            }}
          >
            <div style={{ color: '#7A9E7E', fontSize: 10 }}>heat pulse</div>
            <div style={{ color: '#FAF6EF', fontSize: 22 }}>{heat}</div>
            <div style={{ color: '#C27C5A', fontSize: 10 }}>$HEAT</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
          <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ color: '#8E7E6B', fontSize: 10 }}>Treasury</div>
            <div style={{ color: '#E8842A', fontSize: 18, marginTop: 4 }}>{emberBalance.toLocaleString()}</div>
            <div style={{ color: '#5E5143', fontSize: 9 }}>$EMBER liquid</div>
          </div>
          <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ color: '#8E7E6B', fontSize: 10 }}>{realm === 'biosphere' ? 'Plots awake' : 'Nodes live'}</div>
            <div style={{ color: '#7A9E7E', fontSize: 18, marginTop: 4 }}>{realm === 'biosphere' ? activePlots : nodeCount}</div>
            <div style={{ color: '#5E5143', fontSize: 9 }}>{realm === 'biosphere' ? 'of 19 bloom beds' : 'shared objects'}</div>
          </div>
          <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ color: '#8E7E6B', fontSize: 10 }}>Cadence</div>
            <div style={{ color: '#D4A853', fontSize: 18, marginTop: 4 }}>
              {Math.round((energyRatio * 0.55 + activityRatio * 0.45) * 100)}%
            </div>
            <div style={{ color: '#5E5143', fontSize: 9 }}>collective momentum</div>
          </div>
        </div>
      </div>

      <div style={{ ...panel, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: '#FAF6EF', fontSize: 13 }}>Community blueprints</div>
          <div style={{ color: '#8E7E6B', fontSize: 10 }}>read-only, live shell</div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {goals.map((goal, index) => {
            const base = realm === 'biosphere' ? activePlots * 7 + emberBalance / goal.cap * 40 : nodeCount * 4 + emberBalance / goal.cap * 35
            const progress = Math.max(12, Math.min(96, Math.round(base + index * 11)))
            return <GoalBar key={goal.label} label={goal.label} progress={progress} accent={goal.accent} />
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={onOpenSteward}
            style={{
              flex: 1,
              borderRadius: 12,
              border: '1px solid rgba(212,168,83,0.32)',
              background: 'linear-gradient(135deg, rgba(212,168,83,0.18), rgba(136,96,255,0.1))',
              color: '#FAF6EF',
              padding: '10px 12px',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Speak with Gemma
          </button>
          <button
            type="button"
            onClick={onOpenBuilder}
            style={{
              flex: 1,
              borderRadius: 12,
              border: '1px solid rgba(232,132,42,0.32)',
              background: 'rgba(232,132,42,0.12)',
              color: '#FAF6EF',
              padding: '10px 12px',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Open build ledger
          </button>
        </div>
      </div>
    </div>
  )
}
