/**
 * interactionEngine.ts
 * Lives in: frontend/src/lib/interactionEngine.ts
 *
 * The heart of the living world. Every tick, this engine:
 *   1. Reads all ForgeNodes from Firestore world_state
 *   2. Checks proximity between every pair of nodes
 *   3. Applies interaction rules from the reagent registry
 *   4. Writes state changes back to Firestore
 *   5. Emits signals that other nodes can react to
 *
 * This is what makes the Hearthlands feel alive —
 * objects don't just exist, they affect each other.
 */

import { getFirestoreDb } from '../firebaseConfig'
import {
  doc, getDoc, updateDoc, serverTimestamp
} from 'firebase/firestore'
import { getReagentById } from './reagentRegistry'

// ── Types ────────────────────────────────────────────────────────

export interface WorldNode {
  id:           string
  object_type:  string
  x:            number
  y:            number
  z:            number

  // Water-specific
  water_heat?:      number
  substance_id?:    number
  substance_conc?:  number
  is_frozen?:       boolean
  water_count?:     number
  ice_count?:       number

  // Flora-specific
  bloom_stage?:     number
  heat_level?:      number
  chain_hash?:      string

  // Art frame
  frame_tint?:      string

  // General
  ember_balance?:   number
  placed_by?:       string
  ts?:              number
  [key: string]:    any
}

export interface WorldSignal {
  type:       string
  sourceId:   string
  targetId?:  string
  value?:     number
  color?:     string
}

// ── Proximity check ───────────────────────────────────────────────

function distance(a: WorldNode, b: WorldNode): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

// ── Object type categories ────────────────────────────────────────

const OBJECT_TYPES: Record<string, readonly string[]> = {
  water:     ['water'],
  flora:     ['flora'],
  art:       ['lodge'],
  lodge:     ['lodge'],
  fire:      ['fire'],
  wind:      ['wind'],
  stone:     ['stone'],
  structure: ['stone', 'bridge', 'ruins'],
  any:       ['water', 'flora', 'lodge', 'fire', 'wind', 'stone',
               'bridge', 'ruins', 'lightning_rod', 'crystal'],
} as const

// ── Night detection ───────────────────────────────────────────────

function isNight(): boolean {
  const h = new Date().getHours()
  return h >= 20 || h < 6
}

// ── Core interaction processor ────────────────────────────────────

export async function runInteractionTick(): Promise<void> {
  const db       = getFirestoreDb()
  if (!db) return
  const stateRef = doc(db, 'three_forge', 'world_state')
  const snap     = await getDoc(stateRef)
  if (!snap.exists()) return

  const data    = snap.data()
  const nodes: WorldNode[] = data.nodes ?? []
  const signals: WorldSignal[] = []
  const updates: Record<string, Partial<WorldNode>> = {}

  // ── Pass 1: Water → World interactions ──────────────────────────
  const waterNodes = nodes.filter(n => n.object_type === 'water')
  const floraNodes = nodes.filter(n => n.object_type === 'flora')

  for (const water of waterNodes) {
    const sub    = water.substance_id ?? 0
    const conc   = water.substance_conc ?? 0
    const reagent = getReagentById(sub)
    if (!reagent) continue

    // Moonstone: only active at night
    if (sub === 5 && !isNight()) continue

    // $EMBER passive income
    if (reagent.emberPerTick > 0) {
      signals.push({
        type:     'ember_earn',
        sourceId: water.id,
        value:    reagent.emberPerTick,
      })
    }

    // Process each interaction rule
    for (const rule of reagent.interactions) {
      const targetTypes = OBJECT_TYPES[rule.targetType] ?? [rule.targetType]

      // Find nearby targets
      const nearby = nodes.filter(n =>
        n.id !== water.id &&
        targetTypes.includes(n.object_type) &&
        distance(water, n) < 4.0
      )

      for (const target of nearby) {
        const action = rule.action

        switch (action.type) {
          case 'grow_flora':
            if (target.object_type === 'flora') {
              const current = target.bloom_stage ?? 0
              const next    = Math.max(0, Math.min(3, current + action.stages))
              if (next !== current) {
                updates[target.id] = {
                  ...updates[target.id],
                  bloom_stage: next,
                }
              }
            }
            break

          case 'tint_artframe':
            if (target.object_type === 'lodge') {
              updates[target.id] = {
                ...updates[target.id],
                frame_tint: action.color,
              }
            }
            break

          case 'salt_crystal':
            if (Math.random() < action.probability) {
              signals.push({
                type:     'salt_crystal_form',
                sourceId: water.id,
                targetId: target.id,
              })
            }
            break

          case 'ember_emit':
            signals.push({
              type:     'ember_earn',
              sourceId: water.id,
              value:    action.rate,
            })
            break

          case 'mix_substance':
            // Two water bodies mix — produce new substance
            if (target.object_type === 'water') {
              const targetSub = target.substance_id ?? 0
              if (targetSub !== sub && targetSub !== action.resultId) {
                updates[target.id] = {
                  ...updates[target.id],
                  substance_id:   action.resultId,
                  substance_conc: Math.min(7, (conc + (target.substance_conc ?? 0)) >> 1),
                }
              }
            }
            break

          case 'signal':
            signals.push({
              type:     action.signalType,
              sourceId: water.id,
              targetId: target.id,
            })
            break
        }
      }
    }

    // ── Pollen auto-dissolve from nearby flora ──────────────────
    if (sub === 0) {  // Pure water picks up pollen from nearby flowers
      for (const flora of floraNodes) {
        if (flora.bloom_stage === 3 && distance(water, flora) < 3.5) {
          if (Math.random() < 0.1) {  // 10% chance per tick
            updates[water.id] = {
              ...updates[water.id],
              substance_id:   4,   // pollen
              substance_conc: 2,
            }
          }
        }
      }
    }

    // ── Ice freeze bonus $EMBER ──────────────────────────────────
    if (water.is_frozen && reagent.emberOnFreeze > 0) {
      signals.push({
        type:     'ember_earn',
        sourceId: water.id,
        value:    reagent.emberOnFreeze,
      })
    }
  }

  // ── Pass 2: Hearth proximity → melt ice ─────────────────────────
  const hearthNodes = nodes.filter(n => n.object_type === 'hearth')
  for (const hearth of hearthNodes) {
    for (const water of waterNodes) {
      if (water.is_frozen && distance(hearth, water) < 6.0) {
        const d = distance(hearth, water)
        const meltChance = Math.max(0, 0.3 - d * 0.05)
        if (Math.random() < meltChance) {
          updates[water.id] = {
            ...updates[water.id],
            is_frozen:  false,
            water_heat: (water.water_heat ?? 0) + 500,
          }
        }
      }
    }
  }

  // ── Pass 3: Flora + Ice → freeze plants ──────────────────────────
  for (const flora of floraNodes) {
    for (const water of waterNodes) {
      if (water.is_frozen && distance(flora, water) < 2.5) {
        const current = flora.bloom_stage ?? 0
        if (current > 0 && Math.random() < 0.05) {
          updates[flora.id] = {
            ...updates[flora.id],
            bloom_stage: current - 1,
          }
        }
      }
    }
  }

  // ── Apply all node updates ────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    const updatedNodes = nodes.map(n => {
      const patch = updates[n.id]
      return patch ? { ...n, ...patch } : n
    })
    await updateDoc(stateRef, {
      nodes:      updatedNodes,
      updated_at: serverTimestamp(),
      last_tick_signals: signals,
    })
  }

  // Log signal summary
  if (signals.length > 0) {
    console.log(`[InteractionEngine] Tick complete: ${signals.length} signals`)
    const emberEarned = signals
      .filter(s => s.type === 'ember_earn')
      .reduce((sum, s) => sum + (s.value ?? 0), 0)
    if (emberEarned > 0) {
      console.log(`  $EMBER earned this tick: ${emberEarned}`)
    }
  }
}

// ── Auto-tick ─────────────────────────────────────────────────────

let tickInterval: ReturnType<typeof setInterval> | null = null

export function startInteractionEngine(intervalMs = 5000): void {
  if (tickInterval) return
  console.log(`[InteractionEngine] Started (${intervalMs}ms interval)`)
  tickInterval = setInterval(runInteractionTick, intervalMs)
  runInteractionTick()  // run immediately
}

export function stopInteractionEngine(): void {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
    console.log('[InteractionEngine] Stopped')
  }
}
