import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDb, isFirebaseConfigured } from '../firebaseConfig'
import { normalizeSim2Real, type Sim2RealWeather } from '../biosphere/sim2real'

export interface BellowsPlot {
  id: number
  active: boolean
  bloom_stage: number
  substance?: string | null
}

export interface BellowsState {
  heat: number
  ember_balance: number
  tick: number
  biosphere_nodes: BellowsPlot[]
  sim2real: Sim2RealWeather | null
  last_intent?: string
  mining_active?: boolean
  heartbeat_at?: string | null
}

const DEFAULT: BellowsState = {
  heat: 2980,
  ember_balance: 2980,
  tick: 0,
  biosphere_nodes: [],
  sim2real: null,
}

function parsePlots(raw: unknown): BellowsPlot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p) => p && typeof p === 'object' && typeof (p as BellowsPlot).id === 'number')
    .map((p) => ({
      id: (p as BellowsPlot).id,
      active: Boolean((p as BellowsPlot).active),
      bloom_stage: Number((p as BellowsPlot).bloom_stage ?? 0),
      substance: (p as BellowsPlot).substance ?? null,
    }))
}

function isStaleZeroEconomy(data: Record<string, unknown>): boolean {
  return (
    data.ember_balance === 0 &&
    data.heat === 0 &&
    typeof data.tick === 'number' &&
    data.tick > 0
  )
}

function parsePayload(data: Record<string, unknown>): BellowsState {
  const stale = isStaleZeroEconomy(data)
  return {
    heat: stale
      ? DEFAULT.heat
      : typeof data.heat === 'number'
        ? data.heat
        : DEFAULT.heat,
    ember_balance: stale
      ? DEFAULT.ember_balance
      : typeof data.ember_balance === 'number'
        ? data.ember_balance
        : DEFAULT.ember_balance,
    tick: typeof data.tick === 'number' ? data.tick : DEFAULT.tick,
    biosphere_nodes: parsePlots(data.biosphere_nodes),
    sim2real: normalizeSim2Real(data.sim2real),
    last_intent: typeof data.last_intent === 'string' ? data.last_intent : undefined,
    mining_active:
      typeof data.mining_active === 'boolean' ? data.mining_active : undefined,
    heartbeat_at:
      typeof data.heartbeat_at === 'string' ? data.heartbeat_at : null,
  }
}

function mergeBellows(prev: BellowsState, next: BellowsState): BellowsState {
  if (next.tick > prev.tick) return next
  if (next.tick === prev.tick && next.ember_balance > prev.ember_balance) return next
  return prev.tick > 0 ? prev : next
}

/**
 * Live economy: Firestore three_forge/world_state when configured,
 * plus local bellows_state.json poll (bellows.py / heartbeat.py on dev machine).
 */
export function useBellowsState(pollMs = 2500): BellowsState {
  const [state, setState] = useState<BellowsState>(DEFAULT)

  useEffect(() => {
    let cancelled = false

    const apply = (raw: Record<string, unknown>) => {
      if (cancelled) return
      const next = parsePayload(raw)
      setState((prev) => mergeBellows(prev, next))
    }

    let fsUnsub: (() => void) | undefined
    const db = getFirestoreDb()
    if (db && isFirebaseConfigured()) {
      fsUnsub = onSnapshot(
        doc(db, 'three_forge', 'world_state'),
        (snap) => {
          if (snap.exists()) apply(snap.data() as Record<string, unknown>)
        },
        () => {
          // Firestore denied — JSON poll remains fallback
        }
      )
    }

    const fetchBellows = async () => {
      try {
        const res = await fetch(`/bellows_state.json?${Date.now()}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as Record<string, unknown>
        apply(data)
      } catch {
        // Bellows not running — keep Firestore or defaults
      }
    }

    fetchBellows()
    const interval = window.setInterval(fetchBellows, pollMs)
    return () => {
      cancelled = true
      fsUnsub?.()
      window.clearInterval(interval)
    }
  }, [pollMs])

  return state
}
