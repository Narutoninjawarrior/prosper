/**
 * forgeNodeBridge.ts
 * Lives in: frontend/src/lib/forgeNodeBridge.ts
 *
 * Wires the WASM generative seed module to the ThreeForge
 * ForgeNode system. When a module is run and signed, this
 * bridge packages the output as a lodge ForgeNode and
 * writes it to Firestore so ArtFrame auto-renders it.
 *
 * Flow:
 *   1. Load & run WASM module (bounty_002_generative_seed.wat)
 *   2. Read seed + cascade state from WASM memory
 *   3. Package as ForgeNode with object_type: 'lodge'
 *   4. Write to Firestore: three_forge/world_state
 *   5. ArtFrame in ThreeForge auto-renders on snapshot
 */

import { getFirestoreDb } from '../firebaseConfig'
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'

// ── Types ────────────────────────────────────────────────────────

export interface WasmCascadeState {
  round1:    number   // xorshift round 1 output
  round2:    number   // xorshift round 2 output
  seed:      number   // final seed (post golden-ratio mix)
  algo:      number   // render algorithm 0-3
  heatLevel: number   // original $heat input
}

export interface LodgeForgeNode {
  id:          string
  object_type: 'lodge'
  x:           number
  y:           number
  z:           number
  chain_hash:  string
  seed:        number
  algo:        number
  heat_level:  number
  title:       string
  artist:      string
  ember_cost:  number
  minted:      boolean
  placed_by:   string
  ts:          number
}

// ── WASM loader ──────────────────────────────────────────────────

export async function loadForgeModule(wasmUrl: string) {
  const response = await fetch(wasmUrl)
  const buffer   = await response.arrayBuffer()
  const module   = await WebAssembly.instantiate(buffer, {})
  return module.instance
}

// ── Run module & extract cascade state ──────────────────────────

export function runForgeModule(
  instance: WebAssembly.Instance,
  heat: number
): WasmCascadeState {
  const exports  = instance.exports as any
  const forge    = exports.forge    as (heat: number) => number
  const readState = exports.read_state as (offset: number) => number

  // Run the forge function
  const seed = forge(heat)

  // Read cascade state from WASM memory
  return {
    round1:    readState(0x00),
    round2:    readState(0x04),
    seed:      readState(0x08),   // same as return value
    algo:      readState(0x0C),   // 0-3
    heatLevel: readState(0x10),
  }
}

// ── Package as ForgeNode ─────────────────────────────────────────

export function buildLodgeNode(
  state:      WasmCascadeState,
  chainHash:  string,
  placedBy:   string,
  title:      string,
  emberCost:  number,
  position?:  [number, number, number]
): LodgeForgeNode {

  // Deterministic wall placement based on seed
  // Frames mount on the back wall (z=-5.8), spaced by seed
  const wallSlot = state.seed % 7   // up to 7 frames on back wall
  const x = -6 + wallSlot * 2       // -6 to +6
  const y = 1.6                     // eye level
  const z = position?.[2] ?? -5.8

  return {
    id:          `lodge-${chainHash.slice(0, 8)}`,
    object_type: 'lodge',
    x:           position?.[0] ?? x,
    y:           position?.[1] ?? y,
    z,
    chain_hash:  chainHash,
    seed:        state.seed,
    algo:        state.algo,
    heat_level:  state.heatLevel,
    title,
    artist:      placedBy,
    ember_cost:  emberCost,
    minted:      false,
    placed_by:   placedBy,
    ts:          Date.now(),
  }
}

// ── Write to Firestore ───────────────────────────────────────────

export async function placeLodgeNode(node: LodgeForgeNode): Promise<void> {
  const db      = getFirestoreDb()
  const stateRef = doc(db, 'three_forge', 'world_state')

  await updateDoc(stateRef, {
    nodes:      arrayUnion(node),
    updated_at: serverTimestamp(),
  })

  console.log(`[ForgeNodeBridge] Placed lodge node: ${node.id}`)
  console.log(`  chain_hash: ${node.chain_hash}`)
  console.log(`  seed:       ${node.seed}`)
  console.log(`  algo:       ${node.algo} (${['polygons','flow','tiles','radial'][node.algo]})`)
  console.log(`  position:   [${node.x}, ${node.y}, ${node.z}]`)
}

// ── Full pipeline (load → run → place) ──────────────────────────

export async function submitForgeArt(params: {
  wasmUrl:   string
  chainHash: string
  heat:      number
  placedBy:  string
  title:     string
  emberCost: number
  position?: [number, number, number]
}): Promise<LodgeForgeNode> {

  const { wasmUrl, chainHash, heat, placedBy, title, emberCost, position } = params

  // 1. Load WASM
  const instance = await loadForgeModule(wasmUrl)

  // 2. Run and extract state
  const state = runForgeModule(instance, heat)

  console.log(`[ForgeNodeBridge] Cascade complete:`)
  console.log(`  heat   → ${state.heatLevel}`)
  console.log(`  r1     → ${state.round1.toString(16).padStart(8, '0')}`)
  console.log(`  r2     → ${state.round2.toString(16).padStart(8, '0')}`)
  console.log(`  seed   → ${state.seed.toString(16).padStart(8, '0')}`)
  console.log(`  algo   → ${state.algo}`)

  // 3. Build ForgeNode
  const node = buildLodgeNode(state, chainHash, placedBy, title, emberCost, position)

  // 4. Write to Firestore (ThreeForge auto-renders on snapshot)
  await placeLodgeNode(node)

  return node
}
