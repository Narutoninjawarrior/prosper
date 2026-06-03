/**
 * SacredGeometry.jsx
 * Lives in: frontend/src/sacred/SacredGeometry.jsx
 *
 * Self-contained sacred geometry components for the Tesseract zone.
 * All geometry generated mathematically — no assets required.
 *
 * Exports:
 *   FlowerOfLife       — 19 overlapping torus rings, hexagonal symmetry
 *   MetatronsCube      — 13 spheres + 78 connecting lines
 *   PlatonicSolids     — 5 elements orbiting the altar
 *   GoldenSpiral       — logarithmic Fibonacci spiral
 *   SacredParticles    — particle stream following torus path
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Sphere, Torus, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

// ── Hearthlands sacred palette ────────────────────────────────────
const P = {
  fire:     '#E8842A',   // tetrahedron
  earth:    '#7A9E7E',   // cube
  air:      '#FAF6EF',   // octahedron
  aether:   '#AA88FF',   // dodecahedron
  water:    '#4A90D9',   // icosahedron
  gold:     '#D4A853',   // flower of life
  void:     '#2A1A35',   // background
  glow:     '#FFE4C0',   // warm glow
}

// ── Helper: hex grid positions ────────────────────────────────────
function hexPositions(rings, radius) {
  const positions = [[0, 0, 0]]
  for (let r = 1; r <= rings; r++) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const x = Math.cos(angle) * radius * r
      const z = Math.sin(angle) * radius * r
      positions.push([x, 0, z])

      // Fill in the sides
      if (r > 1) {
        for (let s = 1; s < r; s++) {
          const nextAngle = ((i + 1) / 6) * Math.PI * 2
          const sx = x + Math.cos(nextAngle + Math.PI) * radius * s
          const sz = z + Math.sin(nextAngle + Math.PI) * radius * s
          positions.push([sx, 0, sz])
        }
      }
    }
  }
  return positions
}

// ── Metatron's Cube positions (13 spheres) ────────────────────────
function metatronPositions(r = 1) {
  // Center + 6 inner (Fruit of Life) + 6 outer
  const positions = []
  positions.push(new THREE.Vector3(0, 0, 0))

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    positions.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    positions.push(new THREE.Vector3(Math.cos(a) * r * 1.732, 0, Math.sin(a) * r * 1.732))
  }

  return positions
}

// ── Flower of Life ────────────────────────────────────────────────
// 19 overlapping torus rings arranged in hexagonal symmetry

export function FlowerOfLife({
  position = [0, 0, 0],
  radius   = 1.0,
  scale    = 1,
  heat     = 2980,
}) {
  const groupRef = useRef()

  // 19 ring positions: center + 6 at radius + 12 outer
  const ringPositions = useMemo(() => {
    const pos = [[0, 0]]
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      pos.push([Math.cos(a) * radius, Math.sin(a) * radius])
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      pos.push([Math.cos(a) * radius * 1.732, Math.sin(a) * radius * 1.732])
    }
    // 6 more completing the pattern
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      pos.push([Math.cos(a) * radius * 2, Math.sin(a) * radius * 2])
    }
    return pos.slice(0, 19)
  }, [radius])

  // Gentle rotation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = clock.elapsedTime * 0.05
    }
  })

  const glowIntensity = Math.min(heat / 3000, 1)

  return (
    <group ref={groupRef} position={position} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      {ringPositions.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <torusGeometry args={[radius, radius * 0.018, 8, 64]} />
          <meshStandardMaterial
            color={P.gold}
            emissive={P.gold}
            emissiveIntensity={0.3 + glowIntensity * 0.5}
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Metatron's Cube ───────────────────────────────────────────────
// 13 spheres at Fruit of Life positions + 78 connecting lines

export function MetatronsCube({
  position = [0, 3, 0],
  scale    = 1,
  heat     = 2980,
}) {
  const groupRef = useRef()

  const spherePositions = useMemo(() => metatronPositions(1.4), [])

  // All 78 unique pairs (n*(n-1)/2 where n=13)
  const lineSegments = useMemo(() => {
    const segments = []
    for (let i = 0; i < spherePositions.length; i++) {
      for (let j = i + 1; j < spherePositions.length; j++) {
        segments.push([spherePositions[i], spherePositions[j]])
      }
    }
    return segments
  }, [spherePositions])

  // Line colors by distance
  const lineColor = useMemo(() => {
    return lineSegments.map(([a, b]) => {
      const dist = a.distanceTo(b)
      if (dist < 1.5) return P.gold
      if (dist < 2.5) return P.aether
      return P.water
    })
  }, [lineSegments])

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.12
      groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.07) * 0.15
    }
  })

  const glowIntensity = Math.min(heat / 3000, 1)

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Lines connecting all 13 spheres */}
      {lineSegments.map(([a, b], i) => (
        <Line
          key={i}
          points={[a, b]}
          color={lineColor[i]}
          lineWidth={0.6}
          transparent
          opacity={0.35}
        />
      ))}

      {/* 13 spheres at key positions */}
      {spherePositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color={i === 0 ? P.gold : i < 7 ? P.aether : P.water}
            emissive={i === 0 ? P.gold : i < 7 ? P.aether : P.water}
            emissiveIntensity={0.8 + glowIntensity * 0.4}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
      ))}

      {/* Center glow light */}
      <pointLight
        position={[0, 0, 0]}
        color={P.aether}
        intensity={0.8 + glowIntensity}
        distance={5}
      />
    </group>
  )
}

// ── Platonic Solids ───────────────────────────────────────────────
// The 5 elements orbiting the Tesseract altar

const SOLIDS = [
  { geo: 'tetrahedron', detail: 0, color: P.fire,   label: 'fire',   radius: 2.8, speed: 0.4,  size: 0.3,  yOffset: 0.5  },
  { geo: 'box',         detail: 0, color: P.earth,  label: 'earth',  radius: 3.4, speed: 0.28, size: 0.28, yOffset: 0.0  },
  { geo: 'octahedron',  detail: 0, color: P.air,    label: 'air',    radius: 2.2, speed: 0.55, size: 0.26, yOffset: 1.0  },
  { geo: 'dodecahedron',detail: 0, color: P.aether, label: 'aether', radius: 4.0, speed: 0.18, size: 0.35, yOffset: -0.5 },
  { geo: 'icosahedron', detail: 0, color: P.water,  label: 'water',  radius: 3.0, speed: 0.35, size: 0.32, yOffset: 0.3  },
]

function SolidMesh({ solid, time, heat }) {
  const angle = time * solid.speed
  const x     = Math.cos(angle) * solid.radius
  const z     = Math.sin(angle) * solid.radius
  const y     = solid.yOffset + Math.sin(time * 0.3 + solid.radius) * 0.2

  const glow = Math.min(heat / 3000, 1)

  return (
    <mesh position={[x, y, z]} rotation={[time * 0.3, time * 0.4, 0]}>
      {solid.geo === 'tetrahedron'  && <tetrahedronGeometry  args={[solid.size]} />}
      {solid.geo === 'box'          && <boxGeometry           args={[solid.size, solid.size, solid.size]} />}
      {solid.geo === 'octahedron'   && <octahedronGeometry    args={[solid.size]} />}
      {solid.geo === 'dodecahedron' && <dodecahedronGeometry  args={[solid.size]} />}
      {solid.geo === 'icosahedron'  && <icosahedronGeometry   args={[solid.size]} />}
      <meshStandardMaterial
        color={solid.color}
        emissive={solid.color}
        emissiveIntensity={0.4 + glow * 0.6}
        roughness={0.15}
        metalness={0.7}
        wireframe={false}
      />
    </mesh>
  )
}

export function PlatonicSolids({ heat = 2980 }) {
  const timeRef = useRef(0)
  const [time, setTime] = [timeRef.current, (t) => { timeRef.current = t }]

  // Use a group ref to avoid re-render on every frame
  const solidsRef = useRef()
  useFrame(({ clock }) => {
    timeRef.current = clock.elapsedTime
  })

  return (
    <group ref={solidsRef}>
      {SOLIDS.map((solid, i) => (
        <AnimatedSolid key={i} solid={solid} heat={heat} offset={i * 1.25} />
      ))}
    </group>
  )
}

function AnimatedSolid({ solid, heat, offset }) {
  const meshRef  = useRef()
  const glow     = Math.min(heat / 3000, 1)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime + offset
    const angle = t * solid.speed
    meshRef.current.position.x = Math.cos(angle) * solid.radius
    meshRef.current.position.z = Math.sin(angle) * solid.radius
    meshRef.current.position.y = solid.yOffset + Math.sin(t * 0.3) * 0.25
    meshRef.current.rotation.x = t * 0.35
    meshRef.current.rotation.y = t * 0.45
  })

  return (
    <mesh ref={meshRef}>
      {solid.geo === 'tetrahedron'  && <tetrahedronGeometry  args={[solid.size]} />}
      {solid.geo === 'box'          && <boxGeometry           args={[solid.size, solid.size, solid.size]} />}
      {solid.geo === 'octahedron'   && <octahedronGeometry    args={[solid.size]} />}
      {solid.geo === 'dodecahedron' && <dodecahedronGeometry  args={[solid.size]} />}
      {solid.geo === 'icosahedron'  && <icosahedronGeometry   args={[solid.size]} />}
      <meshStandardMaterial
        color={solid.color}
        emissive={solid.color}
        emissiveIntensity={0.4 + glow * 0.6}
        roughness={0.15}
        metalness={0.7}
      />
    </mesh>
  )
}

// ── Golden Spiral ─────────────────────────────────────────────────
// Logarithmic spiral — φ = 1.618

export function GoldenSpiral({
  position = [0, 0.1, 0],
  turns    = 3,
  scale    = 1,
}) {
  const PHI = 1.6180339887

  const tubeRef = useRef()

  const curve = useMemo(() => {
    const points = []
    const steps  = 200
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * Math.PI * 2
      const r = Math.pow(PHI, t / (Math.PI / 2)) * 0.1
      points.push(new THREE.Vector3(
        Math.cos(t) * r,
        0,
        Math.sin(t) * r,
      ))
    }
    return new THREE.CatmullRomCurve3(points)
  }, [turns])

  useFrame(({ clock }) => {
    if (tubeRef.current) {
      tubeRef.current.rotation.y = clock.elapsedTime * 0.08
    }
  })

  return (
    <group position={position} scale={scale} ref={tubeRef}>
      <mesh>
        <tubeGeometry args={[curve, 200, 0.015, 6, false]} />
        <meshStandardMaterial
          color={P.gold}
          emissive={P.gold}
          emissiveIntensity={0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </group>
  )
}

// ── Sacred Particles ──────────────────────────────────────────────
// Particles streaming along the torus surface

export function SacredParticles({ count = 400, radius = 3, heat = 2980 }) {
  const glow = Math.min(heat / 5000, 1)

  return (
    <Sparkles
      count={count}
      scale={radius * 2}
      size={1.5 + glow}
      speed={0.3 + glow * 0.4}
      color={P.aether}
      opacity={0.4}
    />
  )
}
