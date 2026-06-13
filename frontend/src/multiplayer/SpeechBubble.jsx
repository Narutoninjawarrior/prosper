/**
 * SpeechBubble - GPU text for avatar speech, no DOM overlay.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { SPEECH_FADE_MS } from './multiplayerConfig'

const MAX_DISTANCE = 10
const FADE_DISTANCE = 6

export default function SpeechBubble({ message, messageUntil, name, color = '#D4A853' }) {
  const groupRef = useRef()
  const textRef = useRef()
  const nameRef = useRef()
  const panelRef = useRef()
  const colorObj = useMemo(() => new THREE.Color(color), [color])
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    if (!groupRef.current || !textRef.current || !panelRef.current) return

    const now = Date.now()
    const until = messageUntil || now + SPEECH_FADE_MS
    const lifetimeFadeStart = until - 2000
    let opacity = 1

    if (!message || now >= until) {
      opacity = 0
    } else if (now >= lifetimeFadeStart) {
      opacity = Math.max(0, (until - now) / 2000)
    }

    const distance = camera.position.distanceTo(groupRef.current.getWorldPosition(worldPos))
    if (distance > MAX_DISTANCE) {
      opacity = 0
    } else if (distance > FADE_DISTANCE) {
      opacity *= 1 - (distance - FADE_DISTANCE) / (MAX_DISTANCE - FADE_DISTANCE)
    }

    textRef.current.fillOpacity = opacity
    textRef.current.strokeOpacity = opacity
    if (nameRef.current) {
      nameRef.current.fillOpacity = opacity
      nameRef.current.strokeOpacity = opacity
    }
    panelRef.current.material.opacity = opacity * 0.18
    groupRef.current.visible = opacity > 0.01
  })

  if (!message) return null

  return (
    <group ref={groupRef} position={[0, 2.05, 0]}>
      <Billboard follow>
        <mesh ref={panelRef} position={[0, 0.14, -0.01]}>
          <planeGeometry args={[2.1, 0.8]} />
          <meshBasicMaterial color="#0c1c16" transparent opacity={0.18} depthWrite={false} />
        </mesh>
        {name && (
          <Text
            ref={nameRef}
            position={[0, 0.36, 0]}
            fontSize={0.08}
            color={colorObj}
            anchorX="center"
            anchorY="middle"
            maxWidth={1.8}
            outlineWidth={0.01}
            outlineColor="#0a0402"
          >
            {name}
          </Text>
        )}
        <Text
          ref={textRef}
          position={[0, name ? 0.12 : 0.2, 0]}
          fontSize={0.12}
          color="#FAF6EF"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.8}
          textAlign="center"
          outlineWidth={0.014}
          outlineColor="#0a0402"
        >
          {message}
        </Text>
      </Billboard>
    </group>
  )
}
