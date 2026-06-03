/**
 * MyceliumNetwork.jsx
 * Lives in: frontend/src/biosphere/MyceliumNetwork.jsx
 *
 * Bioluminescent mycelium network spreading between activated
 * Flower of Life nodes. Uses CatmullRom curves for organic threading
 * and a custom TSL-compatible shader for the bioluminescent pulse.
 *
 * Visual reference: branching cyan-white threads through dark earth,
 * azure glow at connection nodes, spreading fractal patterns.
 * (https://stockcake.com/s/mycelium)
 *
 * The network:
 *   - Connects ONLY between active nodes (bloomStage >= 1)
 *   - Threads route through the ground with organic sag
 *   - Pulses at 0.3 Hz — the breathing rate of the Bellows
 *   - Glows brighter on resonance (color changes by pattern)
 *   - New connections animate in over 2 seconds
 */

import { useRef, useMemo } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

// ── Constants ─────────────────────────────────────────────────────
const PULSE_RATE   = 0.3          // Hz — Bellows breath rate
const GROUND_SAG   = -0.12        // how far threads dip into the earth
const TUBE_RADIUS  = 0.025        // tube radius — readable on dark earth

const INNER_RING_IDS = [1, 2, 3, 4, 5, 6]

function edgeKey(aId, bId) {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`
}

function xzDist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)
}

/** Prim MST + Seed-of-Life hexagon overlay — sparse organic highway */
function buildMyceliumEdges(activeNodes) {
  if (activeNodes.length < 2) return []

  const byId = new Map(activeNodes.map(n => [n.id, n]))
  const edgeSet = new Map()

  const addEdge = (idA, idB) => {
    const a = byId.get(idA)
    const b = byId.get(idB)
    if (!a || !b) return
    edgeSet.set(edgeKey(idA, idB), { a, b })
  }

  const ids = activeNodes.map(n => n.id)
  const startId = byId.has(0) ? 0 : Math.min(...ids)
  const visited = new Set([startId])

  while (visited.size < ids.length) {
    let bestPair = null
    let bestDist = Infinity
    for (const vid of visited) {
      const va = byId.get(vid)
      for (const n of activeNodes) {
        if (visited.has(n.id)) continue
        const d = xzDist(va, n)
        if (d < bestDist) {
          bestDist = d
          bestPair = [vid, n.id]
        }
      }
    }
    if (!bestPair) break
    addEdge(bestPair[0], bestPair[1])
    visited.add(bestPair[1])
  }

  if (INNER_RING_IDS.every(id => byId.has(id))) {
    for (let i = 0; i < INNER_RING_IDS.length; i++) {
      addEdge(INNER_RING_IDS[i], INNER_RING_IDS[(i + 1) % INNER_RING_IDS.length])
    }
  }

  return [...edgeSet.values()]
}

// ── Color palette ─────────────────────────────────────────────────
const COLORS = {
  dormant:    '#00DDCC',   // default cyan-teal
  seed:       '#D4A853',   // gold on Seed of Life
  ember:      '#E8842A',   // orange on inner hexagon
  star:       '#4A90D9',   // blue on Star of David
  tree:       '#7A9E7E',   // sage on Tree of Life
  metatron:   '#AA88FF',   // purple on Metatron's Cube
  full:       '#FFFFFF',   // white on full Flower
}

const RESONANCE_COLOR_MAP = {
  none:          COLORS.dormant,
  seed_of_life:  COLORS.seed,
  inner_hexagon: COLORS.ember,
  star_of_david: COLORS.star,
  tree_of_life:  COLORS.tree,
  metatrons_cube:COLORS.metatron,
  full_flower:   COLORS.full,
}

const MyceliumMaterial = shaderMaterial(
  { time: 0, color: new THREE.Color('#00DDCC'), opacity: 0.8 },
  `varying vec2 vUv;
   void main() {
     vUv = uv;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }`,
  `uniform float time;
   uniform vec3 color;
   uniform float opacity;
   varying vec2 vUv;

   void main() {
     float w1 = sin(vUv.x * 18.0 - time * 2.8) * 0.5 + 0.5;
     float w2 = sin(vUv.x * 7.0 - time * 1.4 + 1.2) * 0.5 + 0.5;
     float wave = pow(w1, 6.0) * 0.7 + pow(w2, 4.0) * 0.3;

     float fade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
     float radial = 1.0 - abs(vUv.y * 2.0 - 1.0);
     radial = pow(radial, 1.5);

     float glow = (0.08 + wave * 0.92) * fade * radial;
     vec3 finalColor = mix(color * 0.3, color * 2.5, wave);

     gl_FragColor = vec4(finalColor, glow * opacity);
   }`
)
extend({ MyceliumMaterial })

// ── Thread geometry ───────────────────────────────────────────────
// Creates an organic sagging curve between two ground points

function threadPoints(
  ax, az,
  bx, bz,
  segments = 12
) {
  const mid = new THREE.Vector3((ax + bx) / 2, GROUND_SAG, (az + bz) / 2)

  // Add slight random lateral offset for organic feel
  const dist  = Math.sqrt((bx-ax)**2 + (bz-az)**2)
  const perp  = new THREE.Vector3(-(bz-az), 0, (bx-ax)).normalize()
  const wobble = (dist * 0.08) * (Math.sin(ax * 7.3 + bz * 4.1) * 2 - 1)
  mid.addScaledVector(perp, wobble)

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(ax, 0.02, az),
    new THREE.Vector3(ax * 0.7 + bx * 0.3, GROUND_SAG * 0.6, az * 0.7 + bz * 0.3),
    mid,
    new THREE.Vector3(ax * 0.3 + bx * 0.7, GROUND_SAG * 0.6, az * 0.3 + bz * 0.7),
    new THREE.Vector3(bx, 0.02, bz),
  ])

  return curve.getPoints(segments)
}

// ── Single thread ─────────────────────────────────────────────────

function MyceliumThread({
  ax, az, bx, bz,
  color,
  pulse,
  opacity = 0.7,
}) {
  const matRef = useRef()
  const points = useMemo(() => threadPoints(ax, az, bx, bz), [ax, az, bx, bz])
  const curve  = useMemo(() => new THREE.CatmullRomCurve3(points), [points])
  const tube   = useMemo(() => new THREE.TubeGeometry(curve, 30, TUBE_RADIUS, 6, false), [curve])

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.time = clock.elapsedTime
  })

  return (
    <mesh geometry={tube}>
      <myceliumMaterial
        ref={matRef}
        color={color}
        opacity={opacity}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ── Node glow disk ─────────────────────────────────────────────────

function NodeGlow({ x, z, color, intensity = 0.5 }) {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const brightness = 0.3 + Math.sin(clock.elapsedTime * Math.PI * 2 * PULSE_RATE) * 0.3
    meshRef.current.material.opacity = intensity * brightness
  })

  return (
    <group position={[x, 0.01, z]}>
      {/* Ground glow disk */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Point light at node */}
      <pointLight
        color={color}
        intensity={0.3 * intensity}
        distance={2}
        position={[0, 0.1, 0]}
      />
    </group>
  )
}

// ── Main MyceliumNetwork ──────────────────────────────────────────


export default function MyceliumNetwork({
  nodes,
  resonanceType = 'none',
  resonanceNodeIds = [],
}) {
  const color = RESONANCE_COLOR_MAP[resonanceType] || COLORS.dormant

  // Only render threads between active nodes
  const activeNodes = nodes.filter(n => n.active && n.bloomStage >= 1)

  const connections = useMemo(
    () => buildMyceliumEdges(activeNodes),
    [activeNodes.map(n => n.id).join(',')]
  )

  if (activeNodes.length < 2) return null

  return (
    <group>
      {/* Thread network */}
      {connections.map(({ a, b }, i) => {
        const isResonant = resonanceNodeIds.includes(a.id) && resonanceNodeIds.includes(b.id)
        return (
          <MyceliumThread
            key={`${a.id}-${b.id}`}
            ax={a.x} az={a.z}
            bx={b.x} bz={b.z}
            color={isResonant ? color : COLORS.dormant}
            pulse={true}
            opacity={isResonant ? 0.9 : 0.4}
          />
        )
      })}

      {/* Node glow at active nodes */}
      {activeNodes.map(n => (
        <NodeGlow
          key={n.id}
          x={n.x}
          z={n.z}
          color={resonanceNodeIds.includes(n.id) ? color : COLORS.dormant}
          intensity={resonanceNodeIds.includes(n.id) ? 1.0 : 0.5}
        />
      ))}
    </group>
  )
}
