/**
 * Registry-driven apparatus meshes for /biosphere — positions from apparatus_registry.json.
 */
import { useCallback, useEffect, useState } from 'react'
import { Html, Text } from '@react-three/drei'
import InspectRail from '../inspect/InspectRail'
import { useContract, sanctuaryBridge } from '../lib/sanctuaryBridge'
import ChemistryLabOverlay from './ChemistryLabOverlay'

const BIOSPHERE_POSITIONS = {
  reagent_alembic: [5.5, 0, 3.5],
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
    case 'glass-still':
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow>
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
          <meshStandardMaterial color="#7A9E7E" emissive="#4A90D9" emissiveIntensity={0.15} roughness={0.75} />
        </mesh>
      )
  }
}

function BiosphereApparatusNode({ record }) {
  const [open, setOpen] = useState(false)
  const [showChemistryLab, setShowChemistryLab] = useState(false)
  const [payload, setPayload] = useState(null)
  const [state, setState] = useState('idle')
  const position = BIOSPHERE_POSITIONS[record.apparatus_id] ?? [5, 0, 5]
  const preset = record.mesh?.preset ?? 'default'
  const color = PRESET_COLORS[preset] ?? '#4A90D9'

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch(`/api/inspect/record?ref=apparatus:${record.apparatus_id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`inspect ${res.status}`)
      setPayload(await res.json())
      setState('ready')
    } catch (err) {
      console.error('[BiosphereApparatus]', record.apparatus_id, err)
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
                ...(record.apparatus_id === 'reagent_alembic' ? [{
                  label: 'Open Workbench',
                  tone: 'warm',
                  onClick: () => setShowChemistryLab(true),
                }] : []),
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
          {showChemistryLab && (
            <div style={{ pointerEvents: 'auto' }}>
              <ChemistryLabOverlay onClose={() => setShowChemistryLab(false)} />
            </div>
          )}
        </Html>
      )}
    </>
  )
}

export default function BiosphereApparatusPlaza() {
  const envelope = useContract('/apparatus_registry.json', sanctuaryBridge.normalizeApparatus, [])
  const biosphereApparatus = envelope.data.filter(
    (row) => row.mesh?.scene === 'biosphere'
  )

  return biosphereApparatus.map((record) => (
    <BiosphereApparatusNode key={record.apparatus_id} record={record} />
  ))
}
