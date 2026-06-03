/**
 * reagentRegistry.ts
 * Lives in: frontend/src/lib/reagentRegistry.ts
 *
 * The open reagent registry. Every substance in the Hearthlands
 * world is defined here. New substances are added by registering
 * a new entry — no other files need to change.
 *
 * Each reagent has:
 *   - Visual properties (color, emissive, opacity, particle effect)
 *   - Physics modifiers (freeze threshold, flow speed)
 *   - World interaction rules (what it does to nearby nodes)
 *   - Economic value ($EMBER per tick while dissolved)
 *   - Forge bounty ID (which WASM module produces it)
 */

export interface Reagent {
  id:            number        // 0-7 in WASM, >7 handled by JS only
  key:           string        // unique string key
  name:          string
  description:   string

  // Visual
  color:         string        // hex color for water tint
  emissive?:     string        // glow color (for ember dust etc)
  emissiveIntensity?: number
  opacity:       number        // 0-1, affects water transparency
  particleEffect?: 'none' | 'sparkle' | 'bubble' | 'crystal' | 'pollen' | 'smoke'

  // Physics (applied in WASM)
  freezeModifier:  number      // added to freeze threshold (negative = harder to freeze)
  flowModifier:    number      // added to flow speed (negative = slower)

  // Economy
  emberPerTick:  number        // $EMBER earned per tick while dissolved
  emberOnFreeze: number        // $EMBER bonus when water with this freezes

  // Interactions with other node types
  interactions: ReagentInteraction[]

  // Forge
  bountyId?:     string        // which bounty produced this reagent
  mintable:      boolean       // can be minted as NFT
}

export interface ReagentInteraction {
  targetType:  'flora' | 'lodge' | 'fire' | 'wind' | 'stone' | 'water' | 'any'
  effect:      string          // description
  action:      ReagentAction
}

export type ReagentAction =
  | { type: 'grow_flora';     stages: number }
  | { type: 'tint_artframe';  color: string }
  | { type: 'salt_crystal';   probability: number }
  | { type: 'ember_emit';     rate: number }
  | { type: 'mix_substance';  resultId: number }
  | { type: 'signal';         signalType: string }

// ── The Registry ─────────────────────────────────────────────────

const registry: Map<string, Reagent> = new Map()

function register(r: Reagent) {
  registry.set(r.key, r)
}

// ── Built-in Reagents ─────────────────────────────────────────────

register({
  id:            0,
  key:           'pure',
  name:          'Pure Water',
  description:   'Clean water from the Aquaponic Heart. No dissolved substances.',
  color:         '#4A90D9',
  opacity:       0.75,
  particleEffect: 'bubble',
  freezeModifier:  0,
  flowModifier:    0,
  emberPerTick:  0,
  emberOnFreeze: 0,
  interactions:  [],
  mintable:      false,
})

register({
  id:            1,
  key:           'ember_dust',
  name:          '$EMBER Dust',
  description:   'Dissolved $EMBER particles. Keeps water warm, earns passive income. Freezes into glowing amber crystals.',
  color:         '#E8842A',
  emissive:      '#FF6600',
  emissiveIntensity: 0.4,
  opacity:       0.8,
  particleEffect: 'sparkle',
  freezeModifier:  -200,
  flowModifier:    10,
  emberPerTick:  2,
  emberOnFreeze: 5,
  interactions:  [
    {
      targetType: 'flora',
      effect:     'Warm water accelerates plant growth by 1 stage',
      action:     { type: 'grow_flora', stages: 1 },
    },
    {
      targetType: 'lodge',
      effect:     'Ember-tinted water casts warm glow on nearby art frames',
      action:     { type: 'tint_artframe', color: '#E8842A' },
    },
  ],
  bountyId:      'bounty_004',
  mintable:      true,
})

register({
  id:            2,
  key:           'salt',
  name:          'Salt',
  description:   'Dramatically lowers the freezing point. Salt water churns as superchilled slush. Evaporates into salt crystal formations at edges.',
  color:         '#B8D4E8',
  opacity:       0.65,
  particleEffect: 'crystal',
  freezeModifier:  -400,
  flowModifier:    20,
  emberPerTick:  0,
  emberOnFreeze: 0,
  interactions:  [
    {
      targetType: 'any',
      effect:     'Salt crystals precipitate on nearby surfaces when water evaporates',
      action:     { type: 'salt_crystal', probability: 0.15 },
    },
    {
      targetType: 'water',
      effect:     'Mixing salt + ember dust produces superheated Brine',
      action:     { type: 'mix_substance', resultId: 7 },
    },
  ],
  mintable:      true,
})

register({
  id:            3,
  key:           'ash',
  name:          'Ash',
  description:   'From the Bellows. Darkens water to near-black, slows flow to tar. Fertilizes soil when water drains. Creates obsidian ice.',
  color:         '#2A2A2A',
  opacity:       0.9,
  particleEffect: 'smoke',
  freezeModifier:  100,
  flowModifier:    -25,
  emberPerTick:  0,
  emberOnFreeze: 0,
  interactions:  [
    {
      targetType: 'flora',
      effect:     'Ash-water fertilizes soil, adds +2 growth stages to nearby flora',
      action:     { type: 'grow_flora', stages: 2 },
    },
  ],
  mintable:      true,
})

register({
  id:            4,
  key:           'pollen',
  name:          'Flower Pollen',
  description:   'Dissolves from nearby FlowerBed nodes in bloom. Turns water pale green. Sends growth signals to connected flora. The world talks to itself.',
  color:         '#8FBC6A',
  emissive:      '#5C8A4A',
  emissiveIntensity: 0.1,
  opacity:       0.7,
  particleEffect: 'pollen',
  freezeModifier:  -50,
  flowModifier:    5,
  emberPerTick:  0,
  emberOnFreeze: 0,
  interactions:  [
    {
      targetType: 'flora',
      effect:     'Pollen in water creates a growth feedback loop — connected plants bloom faster',
      action:     { type: 'grow_flora', stages: 1 },
    },
    {
      targetType: 'any',
      effect:     'Emits flora growth signal to all nearby world nodes',
      action:     { type: 'signal', signalType: 'flora_growth' },
    },
  ],
  mintable:      true,
})

register({
  id:            5,
  key:           'moonstone',
  name:          'Moonstone',
  description:   'Active only at night (system clock). Raises the freeze point dramatically. Freezes in perfect geometric lattice patterns — the ice looks like circuit boards.',
  color:         '#E8F0FF',
  emissive:      '#9BB5FF',
  emissiveIntensity: 0.3,
  opacity:       0.55,
  particleEffect: 'crystal',
  freezeModifier:  300,
  flowModifier:    -10,
  emberPerTick:  1,
  emberOnFreeze: 3,
  interactions:  [],
  mintable:      true,
})

register({
  id:            6,
  key:           'chain_dust',
  name:          'Chain Hash Dust',
  description:   'Forge chain_hash dissolved into particles. Each byte maps to a unique color channel. The water\'s hue is literally the cryptographic fingerprint of a past build.',
  color:         '#AA88FF',
  opacity:       0.72,
  particleEffect: 'sparkle',
  freezeModifier:  0,
  flowModifier:    0,
  emberPerTick:  1,
  emberOnFreeze: 1,
  interactions:  [
    {
      targetType: 'lodge',
      effect:     'Chain dust tints nearby art frames with the hash color signature',
      action:     { type: 'tint_artframe', color: '#AA88FF' },
    },
  ],
  mintable:      true,
})

register({
  id:            7,
  key:           'brine',
  name:          'Superheated Brine',
  description:   'Salt + $EMBER dust combined. Flows at double speed, virtually never freezes. Used in the Waterwheel as a heat transfer medium.',
  color:         '#FF8C42',
  emissive:      '#FF4400',
  emissiveIntensity: 0.6,
  opacity:       0.85,
  particleEffect: 'sparkle',
  freezeModifier:  -600,
  flowModifier:    30,
  emberPerTick:  3,
  emberOnFreeze: 0,
  interactions:  [
    {
      targetType: 'flora',
      effect:     'Too hot — scorches flora. Reduces growth by 1 stage.',
      action:     { type: 'grow_flora', stages: -1 },
    },
  ],
  mintable:      true,
})

// ── Future reagents (JS-only, no WASM ID) ────────────────────────
// These are handled entirely by the interaction engine

register({
  id:            8,
  key:           'lightning',
  name:          'Lightning Charge',
  description:   'Rare. Produced by Lightning Rod nodes during storm events. Electrifies water — glows cyan, moves erratically. Instantly vaporizes ice on contact.',
  color:         '#00FFFF',
  emissive:      '#00DDFF',
  emissiveIntensity: 1.0,
  opacity:       0.9,
  particleEffect: 'sparkle',
  freezeModifier:  -1000,
  flowModifier:    50,
  emberPerTick:  5,
  emberOnFreeze: 0,
  interactions:  [],
  mintable:      true,
})

register({
  id:            9,
  key:           'soil',
  name:          'Soil Runoff',
  description:   'Muddy water from eroded soil plots. Slows flow significantly, settles at the bottom. Extremely fertile when drained.',
  color:         '#7B5E3A',
  opacity:       0.95,
  particleEffect: 'none',
  freezeModifier:  150,
  flowModifier:    -40,
  emberPerTick:  0,
  emberOnFreeze: 0,
  interactions:  [
    {
      targetType: 'flora',
      effect:     'Soil-water is the most fertile — adds +3 growth stages',
      action:     { type: 'grow_flora', stages: 3 },
    },
  ],
  mintable:      false,
})

register({
  id:            10,
  key:           'void',
  name:          'Void Water',
  description:   'Water that has been near the Tesseract too long. Completely black, slow, flows upward. Creates geometric void-ice formations.',
  color:         '#000000',
  emissive:      '#2200AA',
  emissiveIntensity: 0.5,
  opacity:       0.98,
  particleEffect: 'none',
  freezeModifier:  500,
  flowModifier:    -50,
  emberPerTick:  0,
  emberOnFreeze: 10,
  interactions:  [],
  mintable:      true,
})

// ── Registry API ─────────────────────────────────────────────────

export function getReagent(key: string): Reagent | undefined {
  return registry.get(key)
}

export function getReagentById(id: number): Reagent | undefined {
  for (const r of registry.values()) {
    if (r.id === id) return r
  }
  return undefined
}

export function getAllReagents(): Reagent[] {
  return Array.from(registry.values())
}

export function getMintableReagents(): Reagent[] {
  return getAllReagents().filter(r => r.mintable)
}

/** Register a new custom reagent. Called by future Forge bounties. */
export function registerReagent(r: Reagent): void {
  if (registry.has(r.key)) {
    console.warn(`[ReagentRegistry] Overwriting reagent: ${r.key}`)
  }
  registry.set(r.key, r)
  console.log(`[ReagentRegistry] Registered: ${r.name} (id=${r.id})`)
}

/** Get the water color for a given substance ID and concentration */
export function getWaterColor(substanceId: number, conc: number): string {
  const reagent = getReagentById(substanceId)
  if (!reagent || substanceId === 0) return '#4A90D9'
  const t = conc / 7
  return blendHex('#4A90D9', reagent.color, t)
}

/** Get ice color based on dissolved substance */
export function getIceColor(substanceId: number): string {
  if (substanceId === 0) return '#B8E0FF'
  if (substanceId === 1) return '#FF9944'   // amber ice
  if (substanceId === 2) return '#E8F8FF'   // salt crystal
  if (substanceId === 3) return '#1A1A1A'   // obsidian
  if (substanceId === 5) return '#CCE0FF'   // moonstone geometric
  if (substanceId === 10) return '#000011'  // void ice
  return '#C0D8F0'
}

/** Simple hex color blend */
function blendHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16)
  const bh = parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xFF, ag = (ah >> 8) & 0xFF, ab = ah & 0xFF
  const br = (bh >> 16) & 0xFF, bg = (bh >> 8) & 0xFF, bb = bh & 0xFF
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')
}
