/**
 * WaterSim.jsx — Hearthlands Water Simulation Renderer
 * Lives in: frontend/src/WaterSim.jsx
 *
 * Renders the cellular automata grid from bounty_004_water_sim.wasm
 * as a living, shimmering water surface with ice phase transitions.
 *
 * Visual system:
 *   - Water cells: animated instanced quads with vertex displacement
 *   - Ice cells:   static crystalline geometry, frosted material
 *   - Steam cells: rising particle-like quads with fade out
 *   - Reagent tints applied via instance color
 *   - Point lights for ember/moonstone glow
 */

import { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import { getReagentById, getWaterColor, getIceColor } from './lib/reagentRegistry'

// Grid constants — must match WASM
const GRID_W    = 32
const GRID_H    = 32
const CELL_SIZE = 0.09
const GRID_WORLD_W = GRID_W * CELL_SIZE
const GRID_WORLD_H = GRID_H * CELL_SIZE

// Cell state constants
const EMPTY = 0
const WATER = 1
const ICE   = 2
const STEAM = 3

// ── Shared geometries and materials ──────────────────────────────

const CELL_GEO = new THREE.PlaneGeometry(CELL_SIZE * 0.92, CELL_SIZE * 0.92)

// ── Water renderer (instanced) ────────────────────────────────────

function WaterCells({ cells, tick }) {
  const meshRef   = useRef()
  const countRef  = useRef(0)
  const colorTemp = useMemo(() => new THREE.Color(), [])
  const dummy     = useMemo(() => new THREE.Object3D(), [])

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    transparent: true,
    opacity:     0.78,
    roughness:   0.1,
    metalness:   0.3,
    side:        THREE.FrontSide,
  }), [])

  // Animate water displacement
  useFrame(({ clock }) => {
    if (!meshRef.current || !cells) return
    const t  = clock.elapsedTime
    let idx  = 0

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell  = cells[y * GRID_W + x]
        const state = cell & 3
        if (state !== WATER) continue

        const sub   = (cell >> 2) & 7
        const conc  = (cell >> 5) & 7

        // World position with wave displacement
        const wx = (x - GRID_W / 2) * CELL_SIZE
        const wy = (GRID_H / 2 - y) * CELL_SIZE
        const wave = Math.sin(t * 2.5 + x * 0.8 + y * 0.6) * 0.008

        dummy.position.set(wx, wy + wave, 0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx, dummy.matrix)

        // Color from reagent
        const hexColor = getWaterColor(sub, conc)
        colorTemp.set(hexColor)
        meshRef.current.setColorAt(idx, colorTemp)

        idx++
      }
    }

    countRef.current = idx
    meshRef.current.count = idx
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[CELL_GEO, mat, GRID_W * GRID_H]}
      castShadow
    />
  )
}

// ── Ice renderer (instanced) ──────────────────────────────────────

function IceCells({ cells }) {
  const meshRef   = useRef()
  const colorTemp = useMemo(() => new THREE.Color(), [])
  const dummy     = useMemo(() => new THREE.Object3D(), [])

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    transparent: true,
    opacity:     0.88,
    roughness:   0.05,
    metalness:   0.15,
    color:       '#C8E8FF',
  }), [])

  useEffect(() => {
    if (!meshRef.current || !cells) return
    let idx = 0

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell  = cells[y * GRID_W + x]
        const state = cell & 3
        if (state !== ICE) continue

        const sub = (cell >> 2) & 7
        const wx  = (x - GRID_W / 2) * CELL_SIZE
        const wy  = (GRID_H / 2 - y) * CELL_SIZE

        dummy.position.set(wx, wy, 0.001)
        dummy.rotation.z = ((x * 7 + y * 13) % 8) * Math.PI / 8  // crystal rotation
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx, dummy.matrix)

        colorTemp.set(getIceColor(sub))
        meshRef.current.setColorAt(idx, colorTemp)
        idx++
      }
    }

    meshRef.current.count = idx
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, [cells])

  return (
    <instancedMesh
      ref={meshRef}
      args={[CELL_GEO, mat, GRID_W * GRID_H]}
    />
  )
}

// ── Steam renderer ────────────────────────────────────────────────

function SteamCells({ cells, tick }) {
  const meshRef  = useRef()
  const dummy    = useMemo(() => new THREE.Object3D(), [])

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    transparent: true,
    opacity:     0.25,
    color:       '#DDDDFF',
    depthWrite:  false,
  }), [])

  useFrame(({ clock }) => {
    if (!meshRef.current || !cells) return
    const t  = clock.elapsedTime
    let idx  = 0

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const state = cells[y * GRID_W + x] & 3
        if (state !== STEAM) continue
        const wx = (x - GRID_W / 2) * CELL_SIZE
        const wy = (GRID_H / 2 - y) * CELL_SIZE + Math.sin(t * 3 + x) * 0.02

        dummy.position.set(wx, wy, 0.01)
        dummy.scale.setScalar(0.8 + Math.sin(t * 2 + y) * 0.2)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx, dummy.matrix)
        idx++
      }
    }

    meshRef.current.count = idx
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[CELL_GEO, mat, GRID_W * GRID_H]} />
  )
}

// ── Reagent glow lights ───────────────────────────────────────────

function ReagentLights({ substanceId, conc, isFrozen }) {
  const reagent = getReagentById(substanceId)
  if (!reagent?.emissive || conc < 2) return null

  const intensity = isFrozen
    ? (reagent.emberOnFreeze > 0 ? 0.8 : 0.2)
    : reagent.emissiveIntensity ?? 0.3

  return (
    <pointLight
      position={[0, 0, 0.5]}
      color={reagent.emissive}
      intensity={intensity}
      distance={3}
    />
  )
}

// ── Info overlay ──────────────────────────────────────────────────

function WaterInfo({ substanceId, waterCount, iceCount, heatLevel, title, placedBy }) {
  const reagent  = getReagentById(substanceId ?? 0)
  const frozen   = iceCount > waterCount
  const state    = iceCount > waterCount * 2 ? '❄ Frozen'
                 : iceCount > 0 ? '〜 Partial ice'
                 : '〜 Flowing'

  return (
    <Html position={[0, GRID_WORLD_H / 2 + 0.3, 0]} center distanceFactor={5}>
      <div style={{
        background: 'rgba(10,6,4,0.85)',
        border:     `0.5px solid ${reagent?.color ?? '#4A90D9'}`,
        borderRadius: 8,
        padding:    '6px 12px',
        fontSize:   10,
        fontFamily: 'monospace',
        color:      '#FAF6EF',
        whiteSpace: 'nowrap',
        textAlign:  'center',
        pointerEvents: 'none',
        minWidth:   140,
      }}>
        <div style={{ color: reagent?.color ?? '#4A90D9', marginBottom: 2, fontWeight: 500 }}>
          {title || 'Water Pool'}
        </div>
        <div style={{ color: '#AAA', fontSize: 9 }}>
          {reagent?.name ?? 'Pure Water'} · {state}
        </div>
        <div style={{ color: '#E8842A', fontSize: 9, marginTop: 2 }}>
          ⬡ {heatLevel ?? 0} $HEAT · {waterCount}W {iceCount}I
        </div>
        {placedBy && (
          <div style={{ color: '#7A9E7E', fontSize: 8, marginTop: 1 }}>
            placed by {placedBy}
          </div>
        )}
      </div>
    </Html>
  )
}

// ── Main WaterSim component ───────────────────────────────────────

export default function WaterSim({
  position     = [-3, 0.05, -2],
  chainHash    = '0'.repeat(64),
  heatLevel    = 1000,
  substanceId  = 0,
  substanceName = 'Pure Water',
  wasmInstance = null,  // pre-loaded WebAssembly.Instance
  title        = 'Water Pool',
  placedBy     = 'Forge',
  onTick       = null,  // callback(waterCount, iceCount, steamCount)
}) {
  const [cells, setCells]       = useState(null)
  const [waterCount, setWC]     = useState(0)
  const [iceCount, setIC]       = useState(0)
  const [tick, setTick]         = useState(0)
  const wasmRef                 = useRef(wasmInstance)
  const tickRef                 = useRef(0)
  const groupRef                = useRef()

  // Load WASM cells
  useEffect(() => {
    if (!wasmInstance) return
    wasmRef.current = wasmInstance

    // Read initial grid snapshot from WASM memory
    const readGrid = () => {
      const inst    = wasmRef.current
      if (!inst) return
      const exports = inst.exports
      const grid    = new Uint8Array(512)

      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          grid[y * GRID_W + x] = exports.read_cell(x, y)
        }
      }

      const wc = exports.read_param(0x0810)
      const ic = exports.read_param(0x0814)
      const sc = exports.read_param(0x0818)

      setCells(grid)
      setWC(wc)
      setIC(ic)
      if (onTick) onTick(wc, ic, sc)
    }

    readGrid()
  }, [wasmInstance])

  // Advance simulation every 200ms
  useEffect(() => {
    if (!wasmRef.current) return
    const interval = setInterval(() => {
      const inst = wasmRef.current
      if (!inst) return

      // Dissolve reagent if specified
      if (substanceId > 0 && tickRef.current === 0) {
        inst.exports.dissolve(substanceId, 5)
      }

      // Run 1 tick
      inst.exports.run_ticks(1)

      // Read new state
      const grid = new Uint8Array(GRID_W * GRID_H)
      for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
          grid[y * GRID_W + x] = inst.exports.read_cell(x, y)
        }
      }

      const wc = inst.exports.read_param(0x0810)
      const ic = inst.exports.read_param(0x0814)
      const sc = inst.exports.read_param(0x0818)

      setCells(grid)
      setWC(wc)
      setIC(ic)
      setTick(t => t + 1)
      tickRef.current++

      if (onTick) onTick(wc, ic, sc)
    }, 200)

    return () => clearInterval(interval)
  }, [wasmInstance, substanceId])

  // Subtle idle rotation
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.03
  })

  const isFrozen = iceCount > waterCount

  return (
    <group ref={groupRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Container rim */}
      <mesh position={[0, 0, -0.015]} rotation={[0, 0, 0]}>
        <ringGeometry args={[
          Math.max(GRID_WORLD_W, GRID_WORLD_H) * 0.52,
          Math.max(GRID_WORLD_W, GRID_WORLD_H) * 0.58,
          32
        ]} />
        <meshStandardMaterial color="#5C3D1E" roughness={0.9} />
      </mesh>

      {/* Floor */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[GRID_WORLD_W + 0.1, GRID_WORLD_H + 0.1]} />
        <meshStandardMaterial color="#2A1A10" roughness={0.95} />
      </mesh>

      {/* Simulation cells */}
      {cells && (
        <>
          <WaterCells cells={cells} tick={tick} />
          <IceCells   cells={cells} />
          <SteamCells cells={cells} tick={tick} />
        </>
      )}

      {/* Reagent lighting */}
      <ReagentLights
        substanceId={substanceId}
        conc={5}
        isFrozen={isFrozen}
      />
    </group>
  )
}
