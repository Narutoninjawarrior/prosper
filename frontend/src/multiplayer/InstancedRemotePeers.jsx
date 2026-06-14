import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SpeechBubble from './SpeechBubble'
import { colorFromRole } from './multiplayerConfig'

const MAX_SWARM_INSTANCES = 256

function SwarmSpeechLabel({ peerId, peerStates }) {
  const anchorRef = useRef()

  useFrame(() => {
    const state = peerStates.current.get(peerId)
    if (!anchorRef.current || !state) return
    anchorRef.current.position.copy(state.position)
  })

  const state = peerStates.current.get(peerId)
  if (!state?.message) return null

  return (
    <group ref={anchorRef}>
      <SpeechBubble
        message={state.message}
        messageUntil={state.messageUntil}
        name={state.name}
        color={state.color}
      />
    </group>
  )
}

export default function InstancedRemotePeers({ remotePeers = [], swarmMode = 'chorus' }) {
  const meshRef = useRef()
  const peerStates = useRef(new Map())
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const speechIds = useMemo(
    () => {
      if (swarmMode === 'quiet') return []
      return remotePeers
        .filter((peer) => peer.message)
        .slice(0, 15) // Priority 3: Cap simultaneous visible speech labels
        .map((peer) => peer.id)
    },
    [remotePeers, swarmMode],
  )

  useEffect(() => {
    const nextIds = new Set(remotePeers.map((peer) => peer.id))

    for (const peer of remotePeers) {
      const existing = peerStates.current.get(peer.id)
      const targetX = peer.target?.x ?? peer.target_x ?? peer.x ?? 0
      const targetY = peer.target?.y ?? peer.target_y ?? peer.y ?? 0
      const targetZ = peer.target?.z ?? peer.target_z ?? peer.z ?? 0
      const nextColor = colorFromRole(peer.role, peer.id)

      if (existing) {
        existing.target.set(targetX, targetY, targetZ)
        existing.anim = peer.anim || peer.animation || 'idle'
        existing.moving = existing.anim === 'walk'
        existing.name = peer.name || peer.id
        existing.message = peer.message || null
        existing.messageUntil = peer.messageUntil || null
        existing.role = peer.role || null
        existing.chivalry = peer.chivalry ?? existing.chivalry ?? null
        if (existing.color !== nextColor) {
          existing.color = nextColor
        }
      } else {
        const position = new THREE.Vector3(targetX, targetY, targetZ)
        peerStates.current.set(peer.id, {
          id: peer.id,
          name: peer.name || peer.id,
          position,
          target: new THREE.Vector3(targetX, targetY, targetZ),
          anim: peer.anim || peer.animation || 'idle',
          moving: (peer.anim || peer.animation) === 'walk',
          message: peer.message || null,
          messageUntil: peer.messageUntil || null,
          role: peer.role || null,
          chivalry: peer.chivalry ?? null,
          color: nextColor,
        })
      }
    }

    for (const id of [...peerStates.current.keys()]) {
      if (!nextIds.has(id)) {
        peerStates.current.delete(id)
      }
    }
  }, [remotePeers])

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    const states = [...peerStates.current.values()]
    states.forEach((peer, index) => {
      peer.position.lerp(peer.target, 0.16)

      const bob = peer.moving
        ? Math.abs(Math.sin(clock.elapsedTime * 6 + index * 0.37)) * 0.08
        : Math.sin(clock.elapsedTime * 1.6 + index * 0.23) * 0.02

      const dx = peer.target.x - peer.position.x
      const dz = peer.target.z - peer.position.z
      const heading = Math.abs(dx) + Math.abs(dz) > 0.001 ? Math.atan2(dx, dz) : 0

      dummy.position.set(peer.position.x, peer.position.y + 0.55 + bob, peer.position.z)
      dummy.rotation.set(0, heading, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()

      meshRef.current.setMatrixAt(index, dummy.matrix)
      tempColor.set(peer.color)
      meshRef.current.setColorAt(index, tempColor)
    })

    meshRef.current.count = states.length
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_SWARM_INSTANCES]} castShadow receiveShadow frustumCulled={false}>
        <capsuleGeometry args={[0.18, 0.5, 4, 8]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.48}
          metalness={0.12}
          emissive="#20120a"
          emissiveIntensity={0.18}
        />
      </instancedMesh>

      {speechIds.map((peerId) => (
        <SwarmSpeechLabel key={peerId} peerId={peerId} peerStates={peerStates} />
      ))}
    </group>
  )
}
