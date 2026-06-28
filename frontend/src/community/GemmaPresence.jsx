import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Sparkles, Text, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { openWorldActionSheet } from '../world/WorldActionSheet'

export default function GemmaPresence({
  position = [0, 1.8, 0],
  label = 'Gemma',
  accent = '#D4A853',
  onInvoke,
}) {
  const groupRef = useRef()
  const shellRef = useRef()
  const [hovered, setHovered] = useState(false)

  const orbitPoints = useMemo(
    () => new Array(3).fill(0).map((_, index) => index * ((Math.PI * 2) / 3)),
    []
  )

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.28
    }
    if (shellRef.current) {
      shellRef.current.scale.setScalar(hovered ? 1.08 : 1)
      shellRef.current.rotation.y = -t * 0.45
    }
  })

  return (
    <group position={position}>
      <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.4}>
        <group
          ref={groupRef}
        >
          <Sparkles
            count={hovered ? 28 : 18}
            scale={[2.8, 2.2, 2.8]}
            size={hovered ? 4.2 : 3.1}
            speed={0.35}
            color={accent}
          />

          {/* Enlarged invisible hit area */}
          <mesh
            onPointerUp={(e) => {
              e.stopPropagation()
              openWorldActionSheet({
                id: 'gemma',
                title: 'Gemma',
                purpose: 'Local steward intelligence',
                source: 'Gemma 2 9B IT',
                freshness: 'Live / Ready',
                actions: [
                  { label: 'Invoke steward', onClick: () => onInvoke?.(), tone: 'primary' },
                  { label: 'Open Lodge Mind', onClick: () => console.log('Open lodge mind'), tone: 'warm' }
                ]
              })
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHovered(true)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHovered(false)
              document.body.style.cursor = 'auto'
            }}
          >
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshStandardMaterial visible={false} />
          </mesh>

          <mesh
            ref={shellRef}
            castShadow
          >
            <icosahedronGeometry args={[0.35, 1]} />
            <MeshTransmissionMaterial
              thickness={0.8}
              roughness={0.12}
              chromaticAberration={0.04}
              transmission={0.94}
              ior={1.2}
              color={accent}
              backside
              backsideThickness={0.4}
            />
          </mesh>

          {orbitPoints.map((phase, index) => (
            <mesh
              key={phase}
              position={[
                Math.cos(phase) * (0.7 + index * 0.05),
                Math.sin(phase * 2) * 0.08,
                Math.sin(phase) * (0.7 + index * 0.05),
              ]}
              rotation={[Math.PI / 2.8, phase, 0]}
            >
              <torusGeometry args={[0.16 + index * 0.04, 0.014, 8, 32]} />
              <meshStandardMaterial
                color={index === 1 ? '#FAF6EF' : accent}
                emissive={accent}
                emissiveIntensity={hovered ? 1.4 : 0.7}
                transparent
                opacity={0.9}
              />
            </mesh>
          ))}

          <pointLight color={accent} intensity={hovered ? 1.8 : 1.15} distance={5} />

          <Text
            position={[0, -0.9, 0]}
            fontSize={0.18}
            color="#F5E0C0"
            anchorX="center"
            anchorY="middle"
          >
            {hovered ? 'Invoke Gemma' : label}
          </Text>
        </group>
      </Float>
    </group>
  )
}
