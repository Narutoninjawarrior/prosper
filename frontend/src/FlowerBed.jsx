/**
 * FlowerBed.jsx — Hearthlands Living World Object
 * Lives in: frontend/src/FlowerBed.jsx
 *
 * Reads L-System branch data from a ForgeNode (populated by
 * bounty_003_lsystem_flower.wat) and renders a procedural plant
 * in Three.js. The plant's growth stage, shape, and bloom are
 * all deterministic — seeded by the Forge's chain_hash and
 * driven by the $heat level at the time of placement.
 *
 * Props:
 *   position    [x, y, z]   world position
 *   chainHash   string      Forge chain_hash (drives variation)
 *   heatLevel   number      $heat at placement time
 *   bloomStage  number      0-3 (seed, sprout, plant, bloom)
 *   branchData  array       from forgeNodeBridge.readFlowerBed()
 *   title       string
 *   placedBy    string
 */

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// ── Hearthlands palette ──────────────────────────────────────────
const C = {
  stem:       '#4A7A3A',   // deep green
  stem_light: '#7A9E7E',   // sage
  leaf:       '#5C8A4A',   // leaf green
  leaf_light: '#8FBC6A',   // young leaf
  petal_1:    '#E8842A',   // ember orange
  petal_2:    '#C27C5A',   // terracotta
  petal_3:    '#D4A853',   // gold
  petal_4:    '#FAF6EF',   // cream
  center:     '#D4A853',   // flower center gold
  soil:       '#3D2B1A',   // dark earth
  soil_rim:   '#5C3D1E',   // earth rim
}

// ── Seeded PRNG for visual variation ────────────────────────────
function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s ^ (s << 13)) >>> 0
    s = (s ^ (s >> 17)) >>> 0
    s = (s ^ (s << 5))  >>> 0
    return s / 0xFFFFFFFF
  }
}

// ── Soil mound ───────────────────────────────────────────────────
function SoilMound() {
  return (
    <group position={[0, 0, 0]}>
      {/* Main mound */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.65, 0.12, 16]} />
        <meshStandardMaterial color={C.soil} roughness={0.95} />
      </mesh>
      {/* Rim highlight */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.06, 8, 24]} />
        <meshStandardMaterial color={C.soil_rim} roughness={0.9} />
      </mesh>
    </group>
  )
}

// ── Single stem segment ──────────────────────────────────────────
function StemSegment({ x1, y1, x2, y2, depth, scale = 1 }) {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const dx   = x2 - x1
  const dy   = y2 - y1
  const len  = Math.sqrt(dx * dx + dy * dy)
  const ang  = Math.atan2(dy, dx)

  // Taper: deeper branches are thinner
  const radius = Math.max(0.008, 0.04 - depth * 0.006) * scale
  const color  = depth < 2 ? C.stem : C.stem_light

  return (
    <mesh
      position={[midX, midY, 0]}
      rotation={[0, 0, ang - Math.PI / 2]}
    >
      <cylinderGeometry args={[radius * 0.7, radius, len, 5]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  )
}

// ── Leaf ─────────────────────────────────────────────────────────
function Leaf({ x, y, angle, size, rand }) {
  const r    = rand()
  const col  = r > 0.5 ? C.leaf : C.leaf_light
  const s    = size * (0.7 + r * 0.6)

  return (
    <mesh
      position={[x, y, (rand() - 0.5) * 0.05]}
      rotation={[rand() * 0.3, rand() * 0.3, angle]}
    >
      <ellipseGeometry args={[s * 0.18, s * 0.36, 8]} />
      <meshStandardMaterial
        color={col}
        roughness={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// ── Flower bloom ─────────────────────────────────────────────────
function Flower({ x, y, bloomRadius, stage, rand }) {
  const petalCount = 5 + Math.floor(rand() * 3)  // 5-7 petals
  const colors     = [C.petal_1, C.petal_2, C.petal_3, C.petal_4]
  const petalColor = colors[Math.floor(rand() * colors.length)]

  // Only render flowers in bloom stage 3, buds in stage 2
  if (stage < 2) return null

  const openness = stage === 3 ? 1.0 : 0.4  // closed bud vs open

  return (
    <group position={[x, y, 0.02]}>
      {/* Petals */}
      {Array.from({ length: petalCount }).map((_, i) => {
        const angle    = (i / petalCount) * Math.PI * 2
        const pr       = bloomRadius * openness
        const px       = Math.cos(angle) * pr
        const py       = Math.sin(angle) * pr
        const petalLen = bloomRadius * 0.9
        const petalW   = bloomRadius * 0.4

        return (
          <mesh
            key={i}
            position={[px * 0.5, py * 0.5, 0]}
            rotation={[0, 0, angle]}
          >
            <ellipseGeometry args={[petalW, petalLen, 8]} />
            <meshStandardMaterial
              color={petalColor}
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      {/* Center */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[bloomRadius * 0.25, 12]} />
        <meshStandardMaterial color={C.center} roughness={0.4} />
      </mesh>
    </group>
  )
}

// ── Growth progress bar (HTML overlay) ──────────────────────────
function GrowthLabel({ heatLevel, bloomStage, title, placedBy }) {
  const stages   = ['Seed', 'Sprout', 'Plant', 'Bloom']
  const stageStr = stages[bloomStage] ?? 'Seed'

  return (
    <Html position={[0, 1.4, 0]} center distanceFactor={4}>
      <div style={{
        background: 'rgba(26,15,8,0.85)',
        border: '0.5px solid #7A9E7E',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#FAF6EF',
        whiteSpace: 'nowrap',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ color: '#7A9E7E', marginBottom: 2 }}>
          {title || 'Untitled Garden'}
        </div>
        <div style={{ color: '#E8842A' }}>
          ⬡ {stageStr} · {heatLevel} $HEAT
        </div>
        {placedBy && (
          <div style={{ color: '#C27C5A', fontSize: 9, marginTop: 2 }}>
            planted by {placedBy}
          </div>
        )}
      </div>
    </Html>
  )
}

// ── Main FlowerBed component ─────────────────────────────────────
export default function FlowerBed({
  position   = [3, 0, -3],
  chainHash  = '0'.repeat(64),
  heatLevel  = 100,
  bloomStage = 1,
  branchData = [],   // array of {x1,y1,x2,y2,depth,seglen} from bridge
  title      = 'Garden Plot',
  placedBy   = 'Forge',
}) {
  const groupRef  = useRef()
  const [hovered, setHovered] = useState(false)

  // Seed PRNG from chain hash
  const seed = useMemo(
    () => parseInt(chainHash.slice(0, 8), 16) || 1,
    [chainHash]
  )
  const rand = useMemo(() => prng(seed), [seed])

  // World scale: normalize branch coordinates to ±1 range
  const scale = useMemo(() => {
    if (!branchData.length) return 1
    let maxCoord = 0
    branchData.forEach(b => {
      maxCoord = Math.max(maxCoord, Math.abs(b.x1), Math.abs(b.y1),
                                    Math.abs(b.x2), Math.abs(b.y2))
    })
    return maxCoord > 0 ? 0.9 / maxCoord : 1
  }, [branchData])

  // Leaves: placed at branch tips (deeper branches = more leaves)
  const leaves = useMemo(() => {
    if (bloomStage < 1) return []
    return branchData
      .filter(b => b.depth >= 2 && rand() > 0.4)
      .slice(0, 40)
      .map(b => ({
        x:     b.x2 * scale,
        y:     b.y2 * scale,
        angle: Math.atan2(b.y2 - b.y1, b.x2 - b.x1),
        size:  scale,
      }))
  }, [branchData, bloomStage, scale])

  // Flowers: at the tips of the deepest branches
  const flowers = useMemo(() => {
    if (bloomStage < 2) return []
    const maxDepth = Math.max(...branchData.map(b => b.depth), 0)
    return branchData
      .filter(b => b.depth >= maxDepth - 1)
      .slice(0, 12)
      .map(b => ({
        x:           b.x2 * scale,
        y:           b.y2 * scale,
        bloomRadius: scale * 0.18,
      }))
  }, [branchData, bloomStage, scale])

  // Gentle sway animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.015
    groupRef.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.008
  })

  // Fallback: if no branch data, show a simple seedling
  const hasBranches = branchData.length > 0

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Soil */}
      <SoilMound />

      {/* Plant group — pivots from base */}
      <group ref={groupRef} position={[0, 0.1, 0]}>

        {hasBranches ? (
          <>
            {/* Stem segments from L-System */}
            {branchData.map((b, i) => (
              <StemSegment
                key={i}
                x1={b.x1 * scale}
                y1={b.y1 * scale}
                x2={b.x2 * scale}
                y2={b.y2 * scale}
                depth={b.depth}
                scale={scale}
              />
            ))}

            {/* Leaves */}
            {leaves.map((l, i) => (
              <Leaf
                key={i}
                x={l.x}
                y={l.y}
                angle={l.angle}
                size={l.size}
                rand={rand}
              />
            ))}

            {/* Flowers */}
            {flowers.map((f, i) => (
              <Flower
                key={i}
                x={f.x}
                y={f.y}
                bloomRadius={f.bloomRadius}
                stage={bloomStage}
                rand={rand}
              />
            ))}
          </>
        ) : (
          /* Seedling fallback */
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.01, 0.02, 0.3, 6]} />
            <meshStandardMaterial color={C.stem} roughness={0.8} />
          </mesh>
        )}
      </group>

      {/* Warm point light when hovered */}
      {hovered && (
        <pointLight
          position={[0, 0.8, 0.3]}
          intensity={0.4}
          color="#E8842A"
          distance={3}
        />
      )}

      {/* Growth label */}
      <GrowthLabel
        heatLevel={heatLevel}
        bloomStage={bloomStage}
        title={title}
        placedBy={placedBy}
      />
    </group>
  )
}
