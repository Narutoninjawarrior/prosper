/**
 * Avatar — GLTF via drei Clone (shared geometry safe) + procedural fallback.
 */
import { Suspense, useRef, Component } from 'react'
import { useFrame } from '@react-three/fiber'
import { Clone, useGLTF, Float, Text } from '@react-three/drei'
import * as THREE from 'three'
import SpeechBubble from './SpeechBubble'
import { colorFromRole, colorFromId } from './multiplayerConfig'

function ProceduralAvatar({ color, moving, anim }) {
  const groupRef = useRef()
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const bob = moving || anim === 'walk'
      ? Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.08
      : Math.sin(clock.elapsedTime * 1.2) * 0.02
    groupRef.current.position.y = bob
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.65, 6, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#FFF4E0" roughness={0.55} />
      </mesh>
      <pointLight position={[0, 0.9, 0]} color={color} intensity={0.55} distance={3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.35, 0.42, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

function GltfAvatar({ url, color, moving, anim }) {
  const { scene } = useGLTF(url)
  const root = useRef()

  useFrame(({ clock }) => {
    if (!root.current) return
    const bob = moving || anim === 'walk'
      ? Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.05
      : 0
    root.current.position.y = bob
  })

  return (
    <group ref={root} scale={0.45}>
      <Clone object={scene} castShadow receiveShadow />
      <pointLight position={[0, 1, 0]} color={color} intensity={0.4} distance={2.5} />
    </group>
  )
}

/** Missing GLB (SPA 404 HTML) must not tear down the whole Canvas. */
class GltfAvatarBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[Avatar] GLTF fallback:', this.props.url, error?.message)
  }

  render() {
    if (this.state.failed) {
      return (
        <ProceduralAvatar
          color={this.props.color}
          moving={this.props.moving}
          anim={this.props.anim}
        />
      )
    }
    return this.props.children
  }
}

function isLoadableModelUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('http://') || url.startsWith('https://')) return true
  // Local assets under /models/ are optional — skip until uploaded to hosting
  if (url.startsWith('/models/')) return false
  return true
}

function AvatarBody({
  modelUrl,
  color,
  displayName,
  isLocal,
  moving,
  anim,
  message,
  messageUntil,
}) {
  return (
    <group>
      {isLoadableModelUrl(modelUrl) ? (
        <Suspense fallback={<ProceduralAvatar color={color} moving={moving} anim={anim} />}>
          <GltfAvatarBoundary color={color} moving={moving} anim={anim} url={modelUrl}>
            <GltfAvatar url={modelUrl} color={color} moving={moving} anim={anim} />
          </GltfAvatarBoundary>
        </Suspense>
      ) : (
        <ProceduralAvatar color={color} moving={moving} anim={anim} />
      )}
      <Float speed={2} floatIntensity={0.08}>
        <Text
          position={[0, 1.65, 0]}
          fontSize={0.14}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0a0402"
        >
          {displayName}{isLocal ? ' (you)' : ''}
        </Text>
      </Float>
      <SpeechBubble
        message={message}
        messageUntil={messageUntil}
        name={displayName}
        color={color}
      />
    </group>
  )
}

/**
 * Interpolated avatar root — lerps to server target each frame.
 */
export default function Avatar({
  id,
  displayName = 'Traveler',
  modelUrl = null,
  target = { x: 0, y: 0, z: 0 },
  role = null,
  anim = 'idle',
  moving = false,
  message = null,
  messageUntil = null,
  isLocal = false,
}) {
  const group = useRef()
  const current = useRef(new THREE.Vector3(target.x, target.y, target.z))
  const goal = useRef(new THREE.Vector3(target.x, target.y, target.z))
  const color = role ? colorFromRole(role, id) : colorFromId(id)

  goal.current.set(target.x, target.y, target.z)

  useFrame(() => {
    if (!group.current) return
    current.current.lerp(goal.current, 0.14)
    group.current.position.copy(current.current)
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      Math.atan2(
        goal.current.x - current.current.x,
        goal.current.z - current.current.z
      ),
      0.08
    )
  })

  return (
    <group ref={group}>
      <AvatarBody
        modelUrl={modelUrl}
        color={color}
        displayName={displayName}
        isLocal={isLocal}
        moving={moving}
        anim={anim}
        message={message}
        messageUntil={messageUntil}
      />
    </group>
  )
}
