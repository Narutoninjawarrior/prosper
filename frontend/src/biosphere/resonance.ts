/**
 * resonance.ts
 * Lives in: frontend/src/biosphere/resonance.ts
 *
 * Sacred geometry pattern detection engine.
 * Monitors the 19 Flower of Life nodes and detects when
 * planting patterns align with sacred geometric forms.
 *
 * When resonance is detected, the interaction engine amplifies:
 *   - Water flow speed
 *   - Growth rate multiplier
 *   - $EMBER yield per tick
 *   - Bloom probability
 *   - Mycelium network spread rate
 */

// ── Node ID layout on the Flower of Life ─────────────────────────
//
//   Ring 0 (center):   ID 0
//   Ring 1 (inner-6):  IDs 1-6   (Seed of Life with center)
//   Ring 2 (middle-6): IDs 7-12
//   Ring 3 (outer-6):  IDs 13-18
//
// The Flower of Life grid:
//
//             13  14
//          7     8
//       12    1    2    15
//          6    0    3
//       11    5    4    9
//          12   7
//             18  16
//
// (approximate — see flowerOfLifeNodes() for exact positions)

export type NodeRing = 'center' | 'inner' | 'middle' | 'outer'

export interface BiosphereNode {
  id:         number
  ring:       NodeRing
  x:          number
  z:          number
  bloomStage: number   // 0-6
  substance?: string   // dissolved reagent key
  active:     boolean  // has a plant
  heat?:      number
}

export interface ResonanceResult {
  type:        ResonanceType
  label:       string
  description: string
  multiplier:  number   // physics/growth multiplier
  emberBonus:  number   // $EMBER per tick bonus
  color:       string   // glow color
  nodeIds:     number[] // which nodes form this pattern
}

export type ResonanceType =
  | 'none'
  | 'seed_of_life'
  | 'inner_hexagon'
  | 'metatrons_cube'
  | 'tree_of_life'
  | 'star_of_david'
  | 'full_flower'

// ── Pattern definitions ───────────────────────────────────────────

const PATTERNS: {
  type:        ResonanceType
  label:       string
  description: string
  nodeIds:     number[]
  multiplier:  number
  emberBonus:  number
  color:       string
}[] = [
  {
    type:        'seed_of_life',
    label:       'Seed of Life',
    description: 'All 6 inner nodes active around the Hearth. The first breath of creation. Water flows faster, growth doubles.',
    nodeIds:     [1, 2, 3, 4, 5, 6],
    multiplier:  2.0,
    emberBonus:  2,
    color:       '#D4A853',  // gold
  },
  {
    type:        'inner_hexagon',
    label:       'Sacred Hexagon',
    description: 'Center + 6 inner nodes form the Seed of Life complete. The Hearth breathes with the geometry.',
    nodeIds:     [0, 1, 2, 3, 4, 5, 6],
    multiplier:  2.5,
    emberBonus:  3,
    color:       '#E8842A',  // ember
  },
  {
    type:        'star_of_david',
    label:       'Star of David',
    description: 'Two overlapping triangles of nodes. Upward and downward forces in balance. Rare — physics amplify threefold.',
    nodeIds:     [1, 3, 5, 2, 4, 6],  // alternating inner nodes
    multiplier:  3.0,
    emberBonus:  4,
    color:       '#4A90D9',  // water blue
  },
  {
    type:        'tree_of_life',
    label:       'Tree of Life',
    description: 'The vertical axis of creation — center column of nodes aligned. The L-System Tree grows at maximum speed.',
    nodeIds:     [0, 1, 4, 7, 10],    // vertical spine
    multiplier:  2.5,
    emberBonus:  3,
    color:       '#7A9E7E',  // sage
  },
  {
    type:        'metatrons_cube',
    label:       "Metatron's Cube",
    description: 'All 13 inner and middle nodes active. The highest resonance state. All 5 elements aligned. Exponential amplification.',
    nodeIds:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    multiplier:  5.0,
    emberBonus:  10,
    color:       '#AA88FF',  // aether purple
  },
  {
    type:        'full_flower',
    label:       'Full Flower of Life',
    description: 'All 19 nodes active. The complete pattern. The Biosphere is fully alive. The Sim2Real bridge opens.',
    nodeIds:     [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
    multiplier:  10.0,
    emberBonus:  25,
    color:       '#FFFFFF',  // pure white light
  },
]

// ── Main resonance checker ────────────────────────────────────────

export function checkGeometricResonance(nodes: BiosphereNode[]): ResonanceResult | null {
  const activeIds = new Set(
    nodes.filter(n => n.active && n.bloomStage >= 1).map(n => n.id)
  )

  // Check patterns from highest to lowest significance
  for (const pattern of [...PATTERNS].reverse()) {
    const allPresent = pattern.nodeIds.every(id => activeIds.has(id))
    if (allPresent) {
      return {
        type:        pattern.type,
        label:       pattern.label,
        description: pattern.description,
        multiplier:  pattern.multiplier,
        emberBonus:  pattern.emberBonus,
        color:       pattern.color,
        nodeIds:     pattern.nodeIds,
      }
    }
  }

  return null
}

// ── Metatron's Cube connection pairs (78 lines) ───────────────────
// Returns all unique pairs of the 13 inner+center nodes

export function metatronConnections(): [number, number][] {
  const innerNodes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const pairs: [number, number][] = []
  for (let i = 0; i < innerNodes.length; i++) {
    for (let j = i + 1; j < innerNodes.length; j++) {
      pairs.push([innerNodes[i], innerNodes[j]])
    }
  }
  return pairs // 78 pairs
}

// ── Flower of Life node positions ────────────────────────────────

export function flowerOfLifeNodes(radius: number = 3.5): BiosphereNode[] {
  const nodes: BiosphereNode[] = []

  // Center
  nodes.push({ id: 0, ring: 'center', x: 0, z: 0, bloomStage: 0, active: false })

  // Inner ring — 6 nodes at distance r, 60° apart starting at 0°
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    nodes.push({
      id:         i + 1,
      ring:       'inner',
      x:          Math.cos(a) * radius,
      z:          Math.sin(a) * radius,
      bloomStage: 0,
      active:     false,
    })
  }

  // Middle ring — 6 nodes at distance r*√3, 30° offset
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    nodes.push({
      id:         i + 7,
      ring:       'middle',
      x:          Math.cos(a) * radius * 1.732,
      z:          Math.sin(a) * radius * 1.732,
      bloomStage: 0,
      active:     false,
    })
  }

  // Outer ring — 6 nodes at distance r*2, 0° start
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    nodes.push({
      id:         i + 13,
      ring:       'outer',
      x:          Math.cos(a) * radius * 2,
      z:          Math.sin(a) * radius * 2,
      bloomStage: 0,
      active:     false,
    })
  }

  return nodes
}

// ── Resonance description for UI ─────────────────────────────────

export function describeResonance(result: ResonanceResult | null): string {
  if (!result) return 'Plant nodes to discover geometric resonance.'
  return `✦ ${result.label} · ${result.multiplier}× amplification · +${result.emberBonus} $EMBER/tick`
}
