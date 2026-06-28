/**
 * Read-only Firestore bridge for /world - same world_state as ThreeForge.
 */
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured, ensureFirebaseConfigured } from './firebaseConfig'
// @ts-ignore
import WorldScene from './WorldScene'

type LiveStatus = 'unconfigured' | 'loading' | 'ready' | 'empty' | 'error'

interface ForgeNode {
  id: string
  x: number
  y: number
  z: number
  color?: string
  object_type?: string
  placed_by?: string
  ts?: number
  heat_level?: number
  [key: string]: unknown
}

export default function WorldRoute() {
  const [forgeNodes, setForgeNodes] = useState<ForgeNode[]>([])
  const [heat, setHeat] = useState(2980)
  const [emberBalance] = useState(2980)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>(
    isFirebaseConfigured() ? 'loading' : 'unconfigured'
  )

  useEffect(() => {
    let unsub: (() => void) | undefined

    async function init() {
      const ready = await ensureFirebaseConfigured()
      if (!ready) {
        setLiveStatus('unconfigured')
        return
      }

      const db = getFirestoreDb()
      if (!db) {
        setLiveStatus('unconfigured')
        return
      }

      setLiveStatus('loading')
      const stateRef = doc(db, 'three_forge', 'world_state')

      unsub = onSnapshot(
        stateRef,
        (snap) => {
          if (!snap.exists()) {
            setForgeNodes([])
            setLiveStatus('empty')
            return
          }

          const data = snap.data() as { nodes?: ForgeNode[] }
          const nodes = (data.nodes || []).filter(
            (n) => n && typeof n.x === 'number'
          )
          setForgeNodes(nodes)

          const peakHeat = nodes.reduce(
            (max, n) => Math.max(max, n.heat_level ?? 0),
            0
          )
          if (peakHeat > 0) setHeat(peakHeat)

          setLiveStatus('ready')
        },
        (err) => {
          console.error('[WorldRoute] Firestore read failed', err)
          setLiveStatus('error')
        }
      )
    }

    init()

    return () => {
      if (unsub) unsub()
    }
  }, [])

  const statusLabel: Record<LiveStatus, string> = {
    unconfigured: 'Firebase env missing - explore with defaults',
    loading: 'Syncing Lodge world_state...',
    ready: `Live - ${forgeNodes.length} forge object(s) in world`,
    empty: 'world_state empty - place objects in the Forge tab',
    error: 'Firestore read error - check console',
  }

  return (
    <div className="relative h-screen w-screen bg-[#0A0604] text-gray-200">
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
          color:
            liveStatus === 'ready'
              ? '#7A9E7E'
              : liveStatus === 'error'
                ? '#f87171'
                : '#888',
          pointerEvents: 'none',
        }}
      >
        {statusLabel[liveStatus]}
      </div>

      <WorldScene
        heat={heat}
        emberBalance={emberBalance}
        forgeNodes={forgeNodes}
        agentKey="steward"
      />
    </div>
  )
}
