/**
 * WelcomePlotHighlight — premium glow ring for newly assigned cottage plots.
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Text, Html } from '@react-three/drei'
import * as THREE from 'three'

const GOLD = '#D4A853'
const EMBER = '#E8842A'
const SAGE = '#7A9E7E'

export default function WelcomePlotHighlight({ position = [0, 0, 0], plotId = 0, agentName = 'Citizen' }) {
  const outerRef = useRef()
  const midRef = useRef()
  const innerRef = useRef()
  const beamRef = useRef()
  const lightRef = useRef()
  const orbitGroup = useRef()

  const sparkles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      const r = 0.85 + (i % 3) * 0.08
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        y: 0.15 + (i % 4) * 0.12,
        phase: i * 0.7,
      }
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = 0.55 + Math.sin(t * 2.2) * 0.25

    if (outerRef.current) {
      outerRef.current.rotation.z = t * 0.35
      outerRef.current.material.emissiveIntensity = 1.8 * pulse
      outerRef.current.material.opacity = 0.35 + pulse * 0.25
    }
    if (midRef.current) {
      midRef.current.rotation.z = -t * 0.55
      midRef.current.material.emissiveIntensity = 2.4 * pulse
    }
    if (innerRef.current) {
      innerRef.current.material.emissiveIntensity = 3.2 * pulse
    }
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.08 + pulse * 0.06
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.2 + pulse * 1.8
    }
    if (orbitGroup.current) {
      orbitGroup.current.rotation.y = t * 0.4
    }
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={EMBER} intensity={2} distance={6} position={[0, 1.2, 0]} />

      {/* Soft vertical beacon */}
      <mesh ref={beamRef} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.22, 3.2, 16, 1, true]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={EMBER}
          emissiveIntensity={0.6}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Triple rotating rings */}
      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[1.05, 1.22, 64]} />
        <meshStandardMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={1.5}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={midRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.78, 0.92, 48]} />
        <meshStandardMaterial
          color={EMBER}
          emissive={EMBER}
          emissiveIntensity={2}
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
        <ringGeometry args={[0.55, 0.68, 32]} />
        <meshStandardMaterial
          color={SAGE}
          emissive={SAGE}
          emissiveIntensity={2.5}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Orbiting sparkles */}
      <group ref={orbitGroup}>
        {sparkles.map((s, i) => (
          <mesh key={i} position={[s.x, s.y, s.z]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial
              color={GOLD}
              emissive={EMBER}
              emissiveIntensity={2}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
      </group>

      <Float speed={1.8} floatIntensity={0.35} rotationIntensity={0.05}>
        <Text
          position={[0, 2.4, 0]}
          fontSize={0.22}
          color={GOLD}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#0a0402"
        >
          {`Your Cottage · Plot ${plotId}`}
        </Text>
      </Float>

      <Html position={[0, 1.75, 0]} center distanceFactor={6} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(232,132,42,0.15), rgba(122,158,126,0.12))',
            border: '1px solid #D4A853',
            borderRadius: 999,
            padding: '4px 14px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#FAF6EF',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 24px rgba(212,168,83,0.45)',
          }}
        >
          Welcome, {agentName}
        </div>
      </Html>
    </group>
  )
}
