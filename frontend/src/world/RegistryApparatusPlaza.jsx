/**
 * Registry-driven apparatus meshes for /world — positions from apparatus_registry.json.
 */
import { useCallback, useEffect, useState } from 'react'
import { Html, Text } from '@react-three/drei'
import InspectRail from '../inspect/InspectRail'
import { useContract, sanctuaryBridge } from '../lib/sanctuaryBridge'
import { appendAgentMemoryEvent } from '../lib/agentMemory'

const PLAZA_POSITIONS = {
  automation_beacon: [-3, 0, 2],
  reagent_alembic: [4, 0, 2],
  creativity_forge: [-2, 0, 3],
  duel_pit: [6, 0, 0],
  registry_compass: [3, 0, -3],
  world_pulse_sensor: [-8, 0, -4],
  treasury_atm: [8, 0, 10],
  validator_bench: [-9, 0, -5],
  blueprint_diffoscope: [-7, 0, -5],
  art_reserve_kiosk: [10, 0, -2],
}

const PRESET_COLORS = {
  'clock-tower': '#E8842A',
  'glass-still': '#4A90D9',
  'wire-octahedron': '#7A9E7E',
  'arena-platform': '#AA88FF',
  'brass-compass': '#C27C5A',
  'weather-rod': '#60A5FA',
  'solarpunk-kiosk': '#D4A853',
  'stone-lectern': '#9CA3AF',
  'twin-lens': '#F472B6',
  'art-frame': '#A78BFA',
}

function ApparatusMesh({ preset }) {
  switch (preset) {
    case 'clock-tower':
      return (
        <group>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.22, 2.2, 8]} />
            <meshStandardMaterial color="#5C3D1E" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.45, 0]}>
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshStandardMaterial color="#E8842A" emissive="#FF6600" emissiveIntensity={0.55} />
          </mesh>
        </group>
      )
    case 'wire-octahedron':
      return (
        <mesh position={[0, 0.9, 0]}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color="#7A9E7E" emissive="#D4A853" emissiveIntensity={0.35} wireframe />
        </mesh>
      )
    case 'arena-platform':
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[1.4, 1.5, 0.08, 24]} />
          <meshStandardMaterial color="#AA88FF" emissive="#AA88FF" emissiveIntensity={0.2} />
        </mesh>
      )
    case 'glass-still':
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.35, 0.45, 0.25, 12]} />
            <meshStandardMaterial color="#888" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#B8D4E8" transparent opacity={0.55} roughness={0.1} />
          </mesh>
        </group>
      )
    default:
      return (
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.7, 1.1, 0.7]} />
          <meshStandardMaterial color="#C27C5A" emissive="#E8842A" emissiveIntensity={0.15} roughness={0.75} />
        </mesh>
      )
  }
}

function RegistryApparatusNode({ record }) {
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState(null)
  const [state, setState] = useState('idle')
  const position = PLAZA_POSITIONS[record.apparatus_id] ?? [0, 0, 0]
  const preset = record.mesh?.preset ?? 'default'
  const color = PRESET_COLORS[preset] ?? '#E8842A'

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/inspect/record?ref=apparatus:${record.apparatus_id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`inspect ${res.status}`)
      setPayload(await res.json())
      setState('ready')
    } catch (err) {
      console.error('[Apparatus]', record.apparatus_id, err)
      setState('error')
    }
  }, [record.apparatus_id])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <>
      <group
        position={position}
        onClick={(e) => {
          e.stopPropagation()
          void appendAgentMemoryEvent({
            eventType: 'inspect_apparatus',
            summary: `Inspected ${record.name} in the world`,
            metadata: {
              ref: `apparatus:${record.apparatus_id}`,
              scene: 'world',
              status: record.status,
            },
          })
          setOpen(true)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => { document.body.style.cursor = 'default' }}
      >
        <ApparatusMesh preset={preset} />
        <Text position={[0, 1.8, 0]} fontSize={0.14} color={color} anchorX="center">
          {record.name}
        </Text>
      </group>
      {open && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <InspectRail
              visible
              draggable
              accent={payload?.accent ?? color}
              eyebrow={payload?.eyebrow ?? `apparatus · ${record.status}`}
              title={payload?.title ?? record.name}
              summary={state === 'loading'
                ? 'Loading contract inspect…'
                : state === 'error'
                  ? 'Inspect API unavailable — showing seed metadata'
                  : payload?.summary ?? record.summary ?? record.capabilities?.join(' · ')}
              details={payload?.details ?? [
                { label: 'status', value: record.status },
                { label: 'write', value: record.write_policy },
                { label: 'mcp', value: (record.mcp_tools ?? []).join(', ') || '—' },
              ]}
              code={payload?.code}
              footer={payload?.footer ?? record.monetization_note}
              actions={[
                ...(payload?.actions ?? []).map((action) => ({
                  label: action.label,
                  tone: action.tone,
                  onClick: () => { if (action.href) window.open(action.href, '_blank') },
                })),
                { label: 'Registry', tone: 'warm', onClick: () => window.open(`/registry?kind=apparatus&id=${record.apparatus_id}`, '_blank') },
                { label: 'Close', tone: 'primary', onClick: () => setOpen(false) },
              ]}
              onClose={() => setOpen(false)}
            />
          </div>
        </Html>
      )}
    </>
  )
}

export default function RegistryApparatusPlaza() {
  const envelope = useContract('/apparatus_registry.json', sanctuaryBridge.normalizeApparatus, [])
  const worldApparatus = envelope.data.filter(
    (row) => row.mesh?.scene === 'world' && row.apparatus_id !== 'ceremony_hearth',
  )

  return worldApparatus.map((record) => (
    <RegistryApparatusNode key={record.apparatus_id} record={record} />
  ))
}
