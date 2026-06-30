import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'

const C = {
  terracotta: '#C27C5A',
  terracotta2: '#A05A3A',
  sage: '#7A9E7E',
  water: '#4A90D9',
  ember: '#E8842A',
}

export function EarthbagDomeMesh({ emissive = 0 }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial
          color={C.terracotta}
          roughness={0.92}
          emissive={C.ember}
          emissiveIntensity={emissive}
        />
      </mesh>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.65, 0.75, 0.1, 8]} />
        <meshStandardMaterial color={C.terracotta2} roughness={0.95} />
      </mesh>
    </group>
  )
}

export function AquaponicsCoreMesh({ glow = 0.4 }) {
  const waterRef = useRef()
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.emissiveIntensity = glow + Math.sin(clock.elapsedTime * 2) * 0.15
    }
  })
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color={C.sage} roughness={0.75} />
      </mesh>
      <mesh ref={waterRef} position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.35, 12]} />
        <meshStandardMaterial
          color={C.water}
          emissive={C.water}
          emissiveIntensity={glow}
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

export function SandboxRigidObject({ type, position, rotation = [0, 0, 0] }) {
  return (
    <RigidBody type="dynamic" colliders="hull" position={position} rotation={rotation} restitution={0.15}>
      {type === 'earthbag_dome' ? <EarthbagDomeMesh emissive={0.08} /> : <AquaponicsCoreMesh />}
    </RigidBody>
  )
}

export function PlacementGhost({ type, position }) {
  if (!type || !position) return null
  return (
    <group position={position}>
      {type === 'earthbag_dome' ? (
        <EarthbagDomeMesh emissive={0.35} />
      ) : (
        <AquaponicsCoreMesh glow={0.8} />
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}
