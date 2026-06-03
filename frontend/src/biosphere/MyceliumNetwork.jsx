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
import { useFrame } from '@react-three/fiber'
import { CatmullRomLine } from '@react-three/drei'
import * as THREE from 'three'

// ── Constants ─────────────────────────────────────────────────────
const PULSE_RATE   = 0.3          // Hz — Bellows breath rate
const GROUND_SAG   = -0.12        // how far threads dip into the earth
const THREAD_WIDTH = 1.2          // line width in pixels

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
  const ref     = useRef()
  const points  = useMemo(() => threadPoints(ax, az, bx, bz), [ax, az, bx, bz])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    const brightness = 0.5 + Math.sin(t * Math.PI * 2 * PULSE_RATE) * 0.5
    ref.current.material.opacity = opacity * (0.4 + brightness * 0.6)
  })

  return (
    <CatmullRomLine
      ref={ref}
      points={points}
      color={color}
      lineWidth={THREAD_WIDTH}
      transparent
      opacity={opacity * 0.7}
      dashed={false}
    />
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
  const nodeMap     = new Map(nodes.map(n => [n.id, n]))

  // Build connections between nearby active nodes
  const connections = useMemo(() => {
    const pairs = []
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const a = activeNodes[i]
        const b = activeNodes[j]
        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)
        // Only connect nodes within 1.5 rings of each other
        if (dist < 10) {
          pairs.push({ a, b })
        }
      }
    }
    return pairs
  }, [activeNodes.map(n => n.id).join(',')])

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
