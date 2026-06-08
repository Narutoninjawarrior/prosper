/**
 * Read-only Firestore bridge for /biosphere.
 * Subscribes to three_forge/world_state (same as ThreeForge) — no client writes.
 */
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured, ensureFirebaseConfigured } from './firebaseConfig'
// @ts-ignore — JSX scene module
import BiosphereScene from './BiosphereScene'
import { normalizeSim2Real, type Sim2RealWeather } from './biosphere/sim2real'

type LiveStatus = 'unconfigured' | 'loading' | 'ready' | 'empty' | 'error'

interface ForgeNode {
  id: string
  x: number
  y: number
  z: number
  heat_level?: number
  bloom_stage?: number
  biosphere_node_id?: number
  object_type?: string
  [key: string]: unknown
}

/** Canonical 19-plot state — written by Python Bellows (heartbeat.py). */
export interface BiospherePlot {
  id: number
  active: boolean
  bloom_stage: number
  substance?: string | null
}

interface WorldStateDoc {
  nodes?: ForgeNode[]
  biosphere_nodes?: BiospherePlot[]
  heat?: number
  ember_balance?: number
  tick?: number
  heartbeat_at?: string
  last_intent?: string
  sim2real?: Sim2RealWeather | Record<string, unknown>
}

export default function BiosphereRoute() {
  const [forgeNodes, setForgeNodes] = useState<ForgeNode[]>([])
  const [biospherePlots, setBiospherePlots] = useState<BiospherePlot[]>([])
  const [heat, setHeat] = useState(2980)
  const [emberBalance, setEmberBalance] = useState(2980)
  const [bellowsTick, setBellowsTick] = useState<number | null>(null)
  const [sim2real, setSim2real] = useState<Sim2RealWeather | null>(null)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(
    isFirebaseConfigured() ? 'loading' : 'unconfigured'
  )

  useEffect(() => {
    let unsub: (() => void) | undefined;

    async function init() {
      const ready = await ensureFirebaseConfigured();
      if (!ready) {
        setLiveStatus('unconfigured');
        return;
      }

      const db = getFirestoreDb();
      if (!db) {
        setLiveStatus('unconfigured');
        return;
      }

      setLiveStatus('loading');
      const stateRef = doc(db, 'three_forge', 'world_state');

      unsub = onSnapshot(
      stateRef,
      (snap) => {
        if (!snap.exists()) {
          setForgeNodes([])
          setLiveStatus('empty')
          return
        }

        const data = snap.data() as WorldStateDoc
        const nodes = (data.nodes || []).filter(
          (n) => n && typeof n.x === 'number'
        )
        setForgeNodes(nodes)

        const plots = (data.biosphere_nodes || []).filter(
          (p) => p && typeof p.id === 'number'
        )
        setBiospherePlots(plots)

        if (typeof data.heat === 'number' && data.heat > 0) {
          setHeat(data.heat)
        } else {
          const peakHeat = nodes.reduce(
            (max, n) => Math.max(max, n.heat_level ?? 0),
            0
          )
          if (peakHeat > 0) setHeat(peakHeat)
        }

        if (typeof data.ember_balance === 'number') {
          setEmberBalance(data.ember_balance)
        }

        setBellowsTick(typeof data.tick === 'number' ? data.tick : null)
        setSim2real(normalizeSim2Real(data.sim2real))
        setLiveStatus('ready')
      },
      (err) => {
        console.error('[BiosphereRoute] Firestore read failed', err)
        setLiveStatus('error')
      }
    )

      );
    }
    init();

    return () => { if (unsub) unsub() }
  }, [])

  const statusLabel: Record<LiveStatus, string> = {
    unconfigured: 'Firebase env missing — local defaults',
    loading: 'Syncing Lodge world_state…',
    ready: bellowsTick != null
      ? `Bellows tick ${bellowsTick} · ${biospherePlots.filter((p) => p.active).length}/19 plots${
          sim2real?.temperature != null
            ? ` · ${sim2real.temperature}°C${sim2real.is_raining ? ' rain' : ''}`
            : ''
        }`
      : `Live · ${forgeNodes.length} forge node(s)`,
    empty: 'world_state empty — run heartbeat.py or bellows_tick_once.py',
    error: 'Firestore read error — check console',
  }

  return (
    <div className="relative h-screen w-screen bg-[#0A0402] text-gray-200">
      <div
        style={{
          position: 'fixed',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: 'rgba(10,6,4,0.85)',
          border: '0.5px solid #3D2B1A',
          borderRadius: 6,
          padding: '4px 10px',
          fontFamily: 'monospace',
          fontSize: 10,
          color: liveStatus === 'ready' ? '#7A9E7E' : liveStatus === 'error' ? '#f87171' : '#888',
          pointerEvents: 'none',
        }}
      >
        {statusLabel[liveStatus]}
      </div>

      <BiosphereScene
        heat={heat}
        emberBalance={emberBalance}
        forgeNodes={forgeNodes}
        biospherePlots={biospherePlots}
        sim2real={sim2real}
        bellowsDriven
        agentKey="prosper"
        multiplayerEnabled
      />
    </div>
  )
}
