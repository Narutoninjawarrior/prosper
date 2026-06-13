/**
 * Live forge objects from Firestore — clickable solarpunk markers in /world.
 */
import { useState } from 'react'
import { Html } from '@react-three/drei'
import InspectRail from '../inspect/InspectRail'
import { forgeNodeToInspect } from '../lib/inspectBridge'

function ForgeNodeMesh({ node, color, onInspect }) {
  const scale = 0.35 + Math.min((node.heat_level ?? 0) / 8000, 0.4)
  return (
    <group
      position={[node.x, node.y ?? 0, node.z]}
      onClick={(e) => {
        e.stopPropagation()
        onInspect(node)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { document.body.style.cursor = 'default' }}
    >
      <mesh castShadow receiveShadow scale={scale}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          roughness={0.65}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, scale * 0.55 + 0.15, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#FAF6EF" emissive={color} emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

const TYPE_COLORS = {
  earthbag_dome: '#C27C5A',
  aquaponics_core: '#4A90D9',
  flora_flower: '#7A9E7E',
  water_pool: '#60A5FA',
  default: '#E8842A',
}

export default function ForgeWorldNodes({ nodes = [] }) {
  const [selection, setSelection] = useState(null)
  const inspect = selection ? forgeNodeToInspect(selection) : null

  if (!nodes.length) return null

  return (
    <>
      {nodes.map((node) => {
        const color = node.color ?? TYPE_COLORS[node.object_type] ?? TYPE_COLORS.default
        return (
          <ForgeNodeMesh
            key={node.id}
            node={node}
            color={color}
            onInspect={setSelection}
          />
        )
      })}
      {inspect && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <InspectRail
              visible
              draggable
              accent={inspect.accent}
              eyebrow={inspect.eyebrow}
              title={inspect.title}
              summary={inspect.summary}
              details={inspect.details}
              footer={inspect.footer}
              actions={inspect.actions.map((action) => ({
                label: action.label,
                tone: action.tone,
                onClick: () => {
                  if (action.href) window.open(action.href, '_blank')
                },
              }))}
              onClose={() => setSelection(null)}
            />
          </div>
        </Html>
      )}
    </>
  )
}
