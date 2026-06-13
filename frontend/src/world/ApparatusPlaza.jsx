/**
 * ApparatusPlaza — procedural meshes for dual-use agent tools in /world.
 * Each click opens an InspectRail or navigates to a public route.
 */

import { useCallback, useEffect, useState } from 'react'
import { Html, Text } from '@react-three/drei'
import InspectRail from '../inspect/InspectRail'

function ClickableApparatus({ position, color, label, onClick, children }) {
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { document.body.style.cursor = 'default' }}
    >
      {children}
      <Text position={[0, 1.8, 0]} fontSize={0.14} color={color} anchorX="center">
        {label}
      </Text>
    </group>
  )
}

function AutomationBeaconMesh() {
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
}

function AlembicMesh() {
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
}

function DuelPitMesh() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.4, 1.5, 0.08, 24]} />
        <meshStandardMaterial color="#3D2B1A" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.1, 1.35, 32]} />
        <meshStandardMaterial color="#AA88FF" emissive="#AA88FF" emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

function CreativityForgeMesh() {
  return (
    <mesh position={[0, 0.9, 0]}>
      <octahedronGeometry args={[0.55, 0]} />
      <meshStandardMaterial color="#7A9E7E" emissive="#D4A853" emissiveIntensity={0.35} wireframe />
    </mesh>
  )
}

function CompassMesh() {
  return (
    <mesh position={[0, 0.6, 0]} rotation={[0, Math.PI / 4, 0]}>
      <boxGeometry args={[0.5, 0.12, 0.5]} />
      <meshStandardMaterial color="#C27C5A" metalness={0.6} roughness={0.35} />
    </mesh>
  )
}

function RailHost({ open, children }) {
  if (!open) return null
  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </Html>
  )
}

export function CreativityForgeZone({ position = [-2, 0, 3] }) {
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState(null)
  const [state, setState] = useState('idle')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/creativity/suggest?limit=6', { cache: 'no-store' })
      if (!res.ok) throw new Error(`suggest ${res.status}`)
      setPayload(await res.json())
      setState('ready')
    } catch (err) {
      console.error('[CreativityForge]', err)
      setState('error')
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const experiments = payload?.experiments ?? []
  const code = experiments.map((e) =>
    `${e.novelty_score} · ${e.kind} · ${e.title}\n  tool: ${e.mcp_tool}\n  inputs: ${JSON.stringify(e.suggested_inputs)}`,
  ).join('\n\n')

  return (
    <>
      <ClickableApparatus
        position={position}
        color="#7A9E7E"
        label="Creativity Forge"
        onClick={() => setOpen(true)}
      >
        <CreativityForgeMesh />
      </ClickableApparatus>
      <RailHost open={open}>
        <InspectRail
          visible
          draggable
          accent="#7A9E7E"
          eyebrow="Creativity Forge"
          title="Experiment suggester"
          summary={state === 'loading'
            ? 'Ranking combinatorial experiments…'
            : state === 'error'
              ? 'Could not reach /api/creativity/suggest'
              : 'Deterministic ideas for bots — run the MCP tool to verify each receipt.'}
          details={payload ? [
            { label: 'data', value: payload.data_state ?? '—' },
            { label: 'excluded', value: String(payload.excluded_experiment_ids ?? 0) },
            { label: 'suggest_hash', value: String(payload.suggest_hash ?? '').slice(0, 16) + '…' },
            { label: 'count', value: String(experiments.length) },
          ] : []}
          code={code || null}
          footer={payload?.note}
          potentialActions={[
            {
              action_id: 'suggest_experiments',
              title: 'Suggest experiments',
              status: state === 'error' ? 'degraded' : 'available',
              effect: 'Fetch deterministic experiment suggestions ranked against recent exclusions and public state.',
              entrypoint: 'GET /api/creativity/suggest?limit=6',
              write_policy: 'read-only',
              receipt: 'suggest_hash',
            },
            {
              action_id: 'inspect_experiment_log',
              title: 'Inspect experiment log',
              status: 'available',
              effect: 'Open the public experiment log feed used by /activity and replay recent witnessed receipts.',
              entrypoint: 'GET /api/experiment/log?limit=20',
              write_policy: 'read-only',
            },
          ]}
          actions={[
            { label: 'Refresh', tone: 'warm', onClick: load, disabled: state === 'loading' },
            {
              label: 'View log',
              tone: 'warm',
              onClick: () => { window.open('/api/experiment/log?limit=20', '_blank') },
            },
            { label: 'Close', tone: 'primary', onClick: () => setOpen(false) },
          ]}
          onClose={() => setOpen(false)}
        />
      </RailHost>
    </>
  )
}

export function DuelPitZone({ position = [6, 0, 0] }) {
  const [open, setOpen] = useState(false)
  const [duel, setDuel] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/duel/latest', { cache: 'no-store' })
      if (!res.ok) throw new Error('no duel')
      setDuel(await res.json())
    } catch {
      setDuel(null)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  return (
    <>
      <ClickableApparatus
        position={position}
        color="#AA88FF"
        label="Duel Pit"
        onClick={() => setOpen(true)}
      >
        <DuelPitMesh />
      </ClickableApparatus>
      <RailHost open={open}>
        <InspectRail
          visible
          draggable
          accent="#AA88FF"
          eyebrow="Duel Pit"
          title="Latest duel"
          summary={duel
            ? `${duel.moves?.[0]} vs ${duel.moves?.[1]} → winner: ${duel.winner}`
            : 'No recent duel on server. Agents: POST /api/duel/resolve'}
          details={duel ? [
            { label: 'receipt', value: String(duel.receipt_hash ?? '').slice(0, 16) + '…' },
            { label: 'agents', value: duel.agents?.join(' · ') ?? '—' },
          ] : []}
          footer="Salt dissolves stone · stone crushes pollen · pollen seeds salt"
          actions={[
            { label: 'Refresh', tone: 'warm', onClick: load },
            { label: 'Close', tone: 'primary', onClick: () => setOpen(false) },
          ]}
          onClose={() => setOpen(false)}
        />
      </RailHost>
    </>
  )
}

export function AutomationBeaconZone({ position = [-3, 0, 2] }) {
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/world/tick', { cache: 'no-store' })
      if (!res.ok) throw new Error('tick failed')
      setTick(await res.json())
    } catch (err) {
      console.error('[Beacon]', err)
      setTick(null)
    }
  }, [])

  useEffect(() => {
    if (open) load()
    if (!open) return undefined
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [open, load])

  return (
    <>
      <ClickableApparatus
        position={position}
        color="#E8842A"
        label="Beacon"
        onClick={() => setOpen(true)}
      >
        <AutomationBeaconMesh />
      </ClickableApparatus>
      <RailHost open={open}>
        <InspectRail
          visible
          draggable
          accent="#E8842A"
          eyebrow="Automation Beacon"
          title="World tick"
          summary={tick
            ? `Tick ${tick.tick} · ${tick.changed_since_last ? 'state shifted' : 'steady pulse'}`
            : 'Polling /api/world/tick…'}
          details={tick ? [
            { label: 'heat', value: String(tick.heat) },
            { label: 'ember', value: String(tick.ember_balance) },
            { label: 'state_hash', value: String(tick.state_hash).slice(0, 16) + '…' },
            { label: 'data', value: tick.data_state },
          ] : []}
          footer="Poll every 2–3s for automation loops"
          actions={[
            { label: 'Close', tone: 'primary', onClick: () => setOpen(false) },
          ]}
          onClose={() => setOpen(false)}
        />
      </RailHost>
    </>
  )
}

export function RegistryCompassZone({ position = [3, 0, -3] }) {
  return (
    <ClickableApparatus
      position={position}
      color="#C27C5A"
      label="Compass"
      onClick={() => { window.location.href = '/registry' }}
    >
      <CompassMesh />
    </ClickableApparatus>
  )
}

export function ReagentAlembicZone({ position = [4, 0, 2] }) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const previewMix = useCallback(async () => {
    try {
      const res = await fetch('/api/chemistry/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reagent_a: 'salt', reagent_b: 'ember_dust', target_type: 'water' }),
      })
      if (!res.ok) throw new Error('preview failed')
      setPreview(await res.json())
    } catch (err) {
      console.error('[Alembic]', err)
      setPreview(null)
    }
  }, [])

  useEffect(() => {
    if (open) previewMix()
  }, [open, previewMix])

  return (
    <>
      <ClickableApparatus
        position={position}
        color="#4A90D9"
        label="Alembic"
        onClick={() => setOpen(true)}
      >
        <AlembicMesh />
      </ClickableApparatus>
      <RailHost open={open}>
        <InspectRail
          visible
          draggable
          accent="#4A90D9"
          eyebrow="Reagent Alembic"
          title="Salt + ember dust"
          summary={preview
            ? `${preview.actions?.length ?? 0} predicted action(s) — preview only`
            : 'Loading chemistry preview…'}
          code={preview ? JSON.stringify(preview, null, 2) : null}
          footer={preview?.note}
          potentialActions={[
            {
              action_id: 'preview_reagent_mix',
              title: 'Preview reagent mix',
              status: preview ? 'available' : 'loading',
              effect: 'Combine salt and ember dust into a deterministic chemistry preview with reproducible receipt hash.',
              inputs: 'reagent_a=salt, reagent_b=ember_dust, target_type=water',
              entrypoint: 'POST /api/chemistry/preview',
              write_policy: 'preview-only - no persistence',
              receipt: preview?.receipt_hash ?? 'pending',
            },
            {
              action_id: 'inspect_preview_payload',
              title: 'Inspect preview payload',
              status: preview ? 'available' : 'loading',
              effect: 'Read the exact preview payload, predicted actions, and the no-write note returned by the server.',
              entrypoint: 'InspectRail code panel',
              write_policy: 'read-only',
            },
          ]}
          actions={[
            { label: 'Re-preview', tone: 'warm', onClick: previewMix },
            { label: 'Close', tone: 'primary', onClick: () => setOpen(false) },
          ]}
          onClose={() => setOpen(false)}
        />
      </RailHost>
    </>
  )
}

export default function ApparatusPlaza() {
  return (
    <>
      <AutomationBeaconZone />
      <ReagentAlembicZone />
      <CreativityForgeZone />
      <DuelPitZone />
      <RegistryCompassZone />
    </>
  )
}
