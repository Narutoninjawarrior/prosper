/**
 * Ceremony hearth in the world — CottageCommons mesh + click to cook a meal.
 * Reads GET /api/hearth/ceremony (live Firestore or seeded fallback).
 */

import { useCallback, useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import CottageCommons from './CottageCommons'
import InspectRail from '../inspect/InspectRail'
import { appendAgentMemoryEvent } from '../lib/agentMemory'

export default function CeremonyHearthZone({
  position = [-4, 0, -2],
  heat = 2980,
  scale = 0.85,
}) {
  const [open, setOpen] = useState(false)
  const [hum, setHum] = useState(0.5)
  const [mealPayload, setMealPayload] = useState(null)
  const [loadState, setLoadState] = useState('idle')

  const fetchMeal = useCallback(async (humValue) => {
    setLoadState('loading')
    try {
      const res = await fetch(`/api/hearth/ceremony?hum=${humValue.toFixed(4)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`ceremony ${res.status}`)
      const data = await res.json()
      setMealPayload(data)
      setLoadState('ready')
    } catch (err) {
      console.error('[CeremonyHearth]', err)
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchMeal(hum)
  }, [open, hum, fetchMeal])

  const meal = mealPayload?.meal
  const courses = meal?.courses ?? []
  const courseText = courses.map((c) => `[${c.name}] ${c.text}`).join('\n\n')

  return (
    <>
      <group
        position={position}
        onClick={(e) => {
          e.stopPropagation()
          void appendAgentMemoryEvent({
            eventType: 'inspect_hearth_ceremony',
            summary: 'Opened the ceremony hearth',
            metadata: {
              ref: 'hearth:ceremony',
              heat,
            },
          })
          setOpen(true)
        }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { document.body.style.cursor = 'default' }}
      >
        <CottageCommons heat={heat} scale={scale} />
        {/* Click target — slightly larger than cottage footprint */}
        <mesh position={[0, 0.5 * scale, 0]}>
          <boxGeometry args={[2.6 * scale, 2.2 * scale, 2.2 * scale]} />
          <meshStandardMaterial visible={false} />
        </mesh>
      </group>

      <Html fullscreen style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <InspectRail
            visible={open}
            draggable
            accent="#E8842A"
            eyebrow="Ceremony Hearth · brain food"
            title="State meal"
            summary={loadState === 'loading'
              ? 'Cooking from live hearth state…'
              : loadState === 'error'
                ? 'Ceremony unavailable. Try again when /api/hearth/ceremony is reachable.'
                : 'Deterministic contemplative sequence from real world state. Same tick + hum → same meal_hash.'}
            details={meal ? [
              { label: 'data', value: mealPayload.data_state ?? '—' },
              { label: 'tick', value: String(meal.tick) },
              { label: 'hum', value: meal.hum.toFixed(4) },
              { label: 'meal_hash', value: meal.meal_hash.slice(0, 16) + '…' },
            ] : []}
            code={courseText || null}
            footer={meal?.note}
            actions={[
              {
                label: 'Re-cook meal',
                tone: 'warm',
                onClick: () => fetchMeal(hum),
                disabled: loadState === 'loading',
              },
              {
                label: 'Close hearth',
                tone: 'primary',
                onClick: () => setOpen(false),
              },
            ]}
            onClose={() => setOpen(false)}
          />

          {open && (
            <div style={{
              position: 'fixed',
              bottom: 88,
              right: 16,
              zIndex: 26,
              width: 'min(280px, calc(100vw - 32px))',
              background: 'rgba(10,6,4,0.92)',
              border: '0.5px solid #E8842A',
              borderRadius: 12,
              padding: 12,
              fontFamily: 'monospace',
              color: '#FAF6EF',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontSize: 10, color: '#E8842A', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Hum frequency
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={hum}
                onChange={(e) => setHum(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8 }}
              />
              <div style={{ fontSize: 10, color: '#8E7E6B', marginTop: 6 }}>
                Slide to change the meal recipe. Agents: GET /api/hearth/ceremony?hum={hum}
              </div>
            </div>
          )}
        </div>
      </Html>
    </>
  )
}
