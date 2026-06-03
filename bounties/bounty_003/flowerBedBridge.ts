/**
 * flowerBedBridge.ts
 * Lives in: frontend/src/lib/flowerBedBridge.ts
 *
 * Runs bounty_003_lsystem_flower.wasm, reads the branch
 * geometry from WASM memory, and writes a 'flora' ForgeNode
 * to Firestore for ThreeForge to render as a FlowerBed.
 */

import { getFirestoreDb } from '../firebaseConfig'
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore'

// ── Types ────────────────────────────────────────────────────────

export interface BranchSegment {
  x1:     number   // start x (raw WASM units ÷ 1000)
  y1:     number
  x2:     number   // end x
  y2:     number
  depth:  number   // branch depth (0 = trunk)
  seglen: number   // segment length
}

export interface FloraForgeNode {
  id:           string
  object_type:  'flora'
  x:            number
  y:            number
  z:            number
  chain_hash:   string
  heat_level:   number
  bloom_stage:  number
  branch_count: number
  branch_data:  BranchSegment[]
  generations:  number
  angle_deg:    number
  title:        string
  placed_by:    string
  ember_cost:   number
  ts:           number
}

// ── Load and run the WASM module ─────────────────────────────────

export async function runFlowerBedWasm(
  wasmUrl: string,
  heat: number
): Promise<{
  branchCount: number
  generations: number
  angleDeg:    number
  bloomStage:  number
  branches:    BranchSegment[]
}> {
  const response = await fetch(wasmUrl)
  const buffer   = await response.arrayBuffer()
  const module   = await WebAssembly.instantiate(buffer, {})
  const exports  = module.instance.exports as any

  const forge      = exports.forge       as (h: number) => number
  const readParam  = exports.read_param  as (offset: number) => number
  const readBranch = exports.read_branch as (idx: number, field: number) => number

  // Run the L-System
  const branchCount = forge(heat)

  // Read parameters (offsets in bytes, read_param does i32.load)
  const generations = readParam(0x0000)
  const angleDeg    = Math.round(readParam(0x0004) / 100)
  const bloomStage  = readParam(0x0010)

  // Read branch segments
  // Field indices: 0=x1, 1=y1, 2=x2, 3=y2, 4=depth, 5=seglen
  const branches: BranchSegment[] = []
  for (let i = 0; i < Math.min(branchCount, 128); i++) {
    branches.push({
      x1:     readBranch(i, 0) / 1000,
      y1:     readBranch(i, 1) / 1000,
      x2:     readBranch(i, 2) / 1000,
      y2:     readBranch(i, 3) / 1000,
      depth:  readBranch(i, 4),
      seglen: readBranch(i, 5) / 1000,
    })
  }

  console.log(`[FlowerBedBridge] L-System complete:`)
  console.log(`  generations: ${generations}`)
  console.log(`  angle:       ${angleDeg}°`)
  console.log(`  bloom stage: ${bloomStage}`)
  console.log(`  branches:    ${branchCount}`)

  return { branchCount, generations, angleDeg, bloomStage, branches }
}

// ── Build ForgeNode ──────────────────────────────────────────────

export function buildFloraNode(params: {
  chainHash:   string
  heatLevel:   number
  result:      Awaited<ReturnType<typeof runFlowerBedWasm>>
  placedBy:    string
  title:       string
  emberCost:   number
  position?:   [number, number, number]
}): FloraForgeNode {

  const { chainHash, heatLevel, result, placedBy, title, emberCost, position } = params
  const { branchCount, generations, angleDeg, bloomStage, branches } = result

  // Garden placement: scatter around the Aquaponic Heart
  const slot = parseInt(chainHash.slice(0, 4), 16) % 8
  const ang  = (slot / 8) * Math.PI * 2
  const r    = 3 + (parseInt(chainHash.slice(4, 6), 16) / 255) * 2

  return {
    id:           `flora-${chainHash.slice(0, 8)}`,
    object_type:  'flora',
    x:            position?.[0] ?? Math.cos(ang) * r,
    y:            position?.[1] ?? 0,
    z:            position?.[2] ?? Math.sin(ang) * r,
    chain_hash:   chainHash,
    heat_level:   heatLevel,
    bloom_stage:  bloomStage,
    branch_count: branchCount,
    branch_data:  branches,
    generations,
    angle_deg:    angleDeg,
    title,
    placed_by:    placedBy,
    ember_cost:   emberCost,
    ts:           Date.now(),
  }
}

// ── Write to Firestore ───────────────────────────────────────────

export async function placeFloraNode(node: FloraForgeNode): Promise<void> {
  const db       = getFirestoreDb()
  const stateRef = doc(db, 'three_forge', 'world_state')

  await updateDoc(stateRef, {
    nodes:      arrayUnion(node),
    updated_at: serverTimestamp(),
  })

  console.log(`[FlowerBedBridge] Planted: ${node.id}`)
  console.log(`  position: [${node.x.toFixed(2)}, ${node.y}, ${node.z.toFixed(2)}]`)
  console.log(`  bloom:    stage ${node.bloom_stage}`)
}

// ── Full pipeline ────────────────────────────────────────────────

export async function submitFlowerBed(params: {
  wasmUrl:   string
  chainHash: string
  heat:      number
  placedBy:  string
  title:     string
  emberCost: number
  position?: [number, number, number]
}): Promise<FloraForgeNode> {

  const { wasmUrl, chainHash, heat, placedBy, title, emberCost, position } = params

  const result = await runFlowerBedWasm(wasmUrl, heat)
  const node   = buildFloraNode({ chainHash, heatLevel: heat, result,
                                   placedBy, title, emberCost, position })
  await placeFloraNode(node)
  return node
}
