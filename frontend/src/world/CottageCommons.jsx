/**
 * CottageCommons.jsx — First facility of Cottage Commons Co.
 * Procedural solarpunk cottage at The Lodge. Warm terracotta, living hearth glow.
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Text } from '@react-three/drei'

const C = {
  terracotta: '#C27C5A',
  terracotta2: '#A05A3A',
  sand: '#F5E6C8',
  sage: '#7A9E7E',
  ember: '#E8842A',
  deep: '#3D2B1A',
  gold: '#D4A853',
}

export default function CottageCommons({ position = [0, 0, 0], heat = 2980, scale = 1 }) {
  const windowRef = useRef()
  const chimneyRef = useRef()
  const warmth = Math.min((heat ?? 2980) / 5000, 1)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 0.6 + Math.sin(t * 3.1) * 0.15 + Math.sin(t * 7.3) * 0.08
    if (windowRef.current) {
      windowRef.current.emissiveIntensity = (0.4 + warmth * 0.8) * flicker
    }
    if (chimneyRef.current) {
      chimneyRef.current.emissiveIntensity = (0.8 + warmth * 1.2) * flicker
    }
  })

  const s = scale

  return (
    <group position={position}>
      {/* Stone foundation */}
      <mesh position={[0, 0.08 * s, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.4 * s, 0.16 * s, 2.0 * s]} />
        <meshStandardMaterial color={C.deep} roughness={0.95} />
      </mesh>

      {/* Main walls */}
      <mesh position={[0, 0.85 * s, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0 * s, 1.5 * s, 1.6 * s]} />
        <meshStandardMaterial color={C.terracotta} roughness={0.88} />
      </mesh>

      {/* Organic curved roof — stacked segments */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, (1.55 + i * 0.22) * s, 0]}
          rotation={[0, (i * Math.PI) / 6, 0]}
          castShadow
        >
          <coneGeometry args={[1.35 * s - i * 0.12 * s, 0.35 * s, 6]} />
          <meshStandardMaterial color={i === 0 ? C.sage : C.terracotta2} roughness={0.82} />
        </mesh>
      ))}

      {/* Door arch */}
      <mesh position={[0, 0.55 * s, 0.81 * s]}>
        <boxGeometry args={[0.45 * s, 0.75 * s, 0.06 * s]} />
        <meshStandardMaterial color={C.deep} roughness={0.9} />
      </mesh>

      {/* Warm windows */}
      {[[-0.55, 0.9], [0.55, 0.9]].map(([x, y], i) => (
        <mesh key={i} position={[x * s, y * s, 0.82 * s]}>
          <boxGeometry args={[0.32 * s, 0.28 * s, 0.04 * s]} />
          <meshStandardMaterial
            ref={i === 0 ? windowRef : undefined}
            color={C.sand}
            emissive={C.ember}
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Hearth chimney */}
      <mesh position={[0.65 * s, 1.85 * s, -0.35 * s]} castShadow>
        <cylinderGeometry args={[0.12 * s, 0.14 * s, 0.55 * s, 6]} />
        <meshStandardMaterial
          ref={chimneyRef}
          color={C.terracotta2}
          emissive={C.ember}
          emissiveIntensity={0.8}
          roughness={0.85}
        />
      </mesh>

      {/* Porch step */}
      <mesh position={[0, 0.04 * s, 1.05 * s]} receiveShadow>
        <boxGeometry args={[0.9 * s, 0.08 * s, 0.35 * s]} />
        <meshStandardMaterial color={C.sand} roughness={0.92} />
      </mesh>

      {/* Lodge uplight */}
      <pointLight
        position={[0, 0.4 * s, 1.2 * s]}
        color={C.ember}
        intensity={0.5 + warmth * 1.2}
        distance={6 * s}
      />

      <Float speed={1.2} floatIntensity={0.06}>
        <Text
          position={[0, 2.55 * s, 0]}
          fontSize={0.14 * s}
          color={C.gold}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor={C.deep}
        >
          Cottage Commons
        </Text>
      </Float>
    </group>
  )
}
