/**
 * TesseractZone.jsx
 * Lives in: frontend/src/sacred/TesseractZone.jsx
 *
 * The Tesseract — a sacred geometry sanctuary zone.
 * Activated when a player or agent approaches the Tesseract ForgeNode.
 *
 * Contains:
 *   - Flower of Life on the floor
 *   - Metatron's Cube spinning above the central altar
 *   - 5 Platonic Solids orbiting the chamber
 *   - Golden Spiral on the altar surface
 *   - Particle streams following torus paths
 *   - Deep space ambience with warm Hearthlands glow
 *
 * Props:
 *   heat        number  — current $heat level (drives intensity)
 *   emberBalance number — $EMBER balance (drives scale/activity)
 *   onExit      fn      — called when player leaves the zone
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Environment,
  Stars,
  Float,
  MeshReflectorMaterial,
  Text,
  Html,
} from '@react-three/drei'
import * as THREE from 'three'
import {
  FlowerOfLife,
  MetatronsCube,
  PlatonicSolids,
  GoldenSpiral,
  SacredParticles,
} from './SacredGeometry'

// ── Constants ─────────────────────────────────────────────────────
const ROOM_RADIUS  = 8
const ROOM_HEIGHT  = 12
const WALL_SEGS    = 32
const FLOOR_SIZE   = 16

// ── Chamber walls (cylindrical) ───────────────────────────────────
function ChamberWalls() {
  return (
    <mesh rotation={[0, 0, 0]} receiveShadow>
      <cylinderGeometry args={[ROOM_RADIUS, ROOM_RADIUS, ROOM_HEIGHT, WALL_SEGS, 1, true]} />
      <meshStandardMaterial
        color="#0A0515"
        side={THREE.BackSide}
        roughness={0.95}
        metalness={0.0}
        emissive="#1A0830"
        emissiveIntensity={0.15}
      />
    </mesh>
  )
}

// ── Reflective floor ──────────────────────────────────────────────
function ChamberFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -ROOM_HEIGHT / 2 + 0.01, 0]} receiveShadow>
      <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={0.8}
        mixStrength={30}
        roughness={0.8}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050210"
        metalness={0.5}
      />
    </mesh>
  )
}

// ── Altar (central platform) ──────────────────────────────────────
function Altar() {
  return (
    <group position={[0, -ROOM_HEIGHT / 2 + 0.3, 0]}>
      {/* Base */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[1.4, 1.8, 0.3, 6]} />
        <meshStandardMaterial color="#1A1030" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Top */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.08, 6]} />
        <meshStandardMaterial
          color="#2A1850"
          roughness={0.2}
          metalness={0.8}
          emissive="#AA88FF"
          emissiveIntensity={0.1}
        />
      </mesh>
    </group>
  )
}

// ── Light pillars (6 columns of light) ───────────────────────────
function LightPillars({ heat }) {
  const intensity = Math.min(heat / 3000, 1) * 0.3

  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2
        const x = Math.cos(angle) * (ROOM_RADIUS - 1.2)
        const z = Math.sin(angle) * (ROOM_RADIUS - 1.2)
        return (
          <group key={i} position={[x, 0, z]}>
            {/* Pillar geometry */}
            <mesh castShadow>
              <cylinderGeometry args={[0.08, 0.1, ROOM_HEIGHT * 0.8, 8]} />
              <meshStandardMaterial
                color="#1A0830"
                roughness={0.6}
                metalness={0.4}
                emissive="#AA88FF"
                emissiveIntensity={0.05 + intensity}
              />
            </mesh>
            {/* Pillar light */}
            <pointLight
              position={[0, 2, 0]}
              color="#AA88FF"
              intensity={0.15 + intensity}
              distance={4}
            />
          </group>
        )
      })}
    </>
  )
}

// ── Dome ceiling ──────────────────────────────────────────────────
function Dome({ heat }) {
  const meshRef = useRef()
  const glow = Math.min(heat / 5000, 1)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.material.emissiveIntensity =
        0.05 + glow * 0.1 + Math.sin(clock.elapsedTime * 0.5) * 0.02
    }
  })

  return (
    <mesh ref={meshRef} position={[0, ROOM_HEIGHT / 2, 0]}>
      <sphereGeometry args={[ROOM_RADIUS, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial
        color="#060212"
        side={THREE.BackSide}
        emissive="#AA88FF"
        emissiveIntensity={0.05}
        roughness={1}
      />
    </mesh>
  )
}

// ── Floating runes (element symbols) ─────────────────────────────
const ELEMENT_LABELS = [
  { symbol: '△', label: 'Fire',   color: '#E8842A', angle: 0      },
  { symbol: '□', label: 'Earth',  color: '#7A9E7E', angle: 1.256  },
  { symbol: '▽', label: 'Water',  color: '#4A90D9', angle: 2.513  },
  { symbol: '◇', label: 'Air',    color: '#FAF6EF', angle: 3.769  },
  { symbol: '⬡', label: 'Aether', color: '#AA88FF', angle: 5.026  },
]

function FloatingRunes() {
  return (
    <>
      {ELEMENT_LABELS.map((el, i) => {
        const r = ROOM_RADIUS - 2
        const x = Math.cos(el.angle) * r
        const z = Math.sin(el.angle) * r
        return (
          <Float key={i} speed={1.2} rotationIntensity={0.1} floatIntensity={0.3}>
            <Text
              position={[x, 1, z]}
              fontSize={0.5}
              color={el.color}
              anchorX="center"
              anchorY="middle"
              lookAt={[0, 1, 0]}
            >
              {el.symbol}
            </Text>
          </Float>
        )
      })}
    </>
  )
}

// ── Info overlay ──────────────────────────────────────────────────
function TesseractUI({ heat, emberBalance, onExit }) {
  return (
    <Html position={[0, ROOM_HEIGHT / 2 - 1.5, 0]} center>
      <div style={{
        background: 'rgba(5,2,16,0.85)',
        border: '0.5px solid #AA88FF',
        borderRadius: 10,
        padding: '8px 16px',
        fontFamily: 'monospace',
        color: '#FAF6EF',
        textAlign: 'center',
        fontSize: 11,
        pointerEvents: 'none',
      }}>
        <div style={{ color: '#AA88FF', fontSize: 13, marginBottom: 4 }}>
          The Tesseract
        </div>
        <div style={{ color: '#D4A853', fontSize: 10 }}>
          ⬡ {emberBalance?.toLocaleString() ?? 0} $EMBER · {heat ?? 0} $HEAT
        </div>
        <div style={{ color: '#666', fontSize: 9, marginTop: 3 }}>
          sacred geometry flows through all things
        </div>
      </div>
    </Html>
  )
}

// ── Torus energy rings ────────────────────────────────────────────
function EnergyRings({ heat }) {
  const ring1 = useRef()
  const ring2 = useRef()
  const ring3 = useRef()
  const glow  = Math.min(heat / 3000, 1)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring1.current) ring1.current.rotation.x = t * 0.3
    if (ring2.current) ring2.current.rotation.y = t * 0.2
    if (ring3.current) {
      ring3.current.rotation.z = t * 0.15
      ring3.current.rotation.x = t * 0.1
    }
  })

  const matProps = {
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.3 + glow * 0.2,
  }

  return (
    <>
      <mesh ref={ring1} position={[0, 0.5, 0]}>
        <torusGeometry args={[3.5, 0.025, 8, 128]} />
        <meshStandardMaterial color="#D4A853" emissive="#D4A853" emissiveIntensity={0.5 + glow} {...matProps} />
      </mesh>
      <mesh ref={ring2} position={[0, 0.5, 0]}>
        <torusGeometry args={[3.0, 0.02, 8, 128]} />
        <meshStandardMaterial color="#AA88FF" emissive="#AA88FF" emissiveIntensity={0.4 + glow} {...matProps} />
      </mesh>
      <mesh ref={ring3} position={[0, 0.5, 0]}>
        <torusGeometry args={[4.0, 0.018, 8, 128]} />
        <meshStandardMaterial color="#4A90D9" emissive="#4A90D9" emissiveIntensity={0.3 + glow} {...matProps} />
      </mesh>
    </>
  )
}

// ── Main TesseractZone component ──────────────────────────────────
export default function TesseractZone({
  heat         = 2980,
  emberBalance = 2980,
  onExit       = () => {},
}) {
  const floorY = -ROOM_HEIGHT / 2

  return (
    <group>
      {/* Environment — dark space preset */}
      <Environment preset="night" />

      {/* Ambient — very low, let emissives do the work */}
      <ambientLight intensity={0.05} color="#1A0830" />

      {/* Central altar light */}
      <pointLight
        position={[0, 0, 0]}
        color="#AA88FF"
        intensity={1.2 + Math.min(heat / 3000, 1)}
        distance={10}
        castShadow
      />

      {/* Floor light (upward) */}
      <pointLight position={[0, floorY + 0.5, 0]} color="#D4A853" intensity={0.4} distance={8} />

      {/* Room geometry */}
      <ChamberWalls />
      <ChamberFloor />
      <Altar />
      <Dome heat={heat} />
      <LightPillars heat={heat} />

      {/* Star field visible through the dome */}
      <Stars
        radius={15}
        depth={8}
        count={1200}
        factor={2}
        saturation={0.8}
        fade
      />

      {/* ── Sacred geometry ────────────────────────────────── */}

      {/* Flower of Life on the floor */}
      <FlowerOfLife
        position={[0, floorY + 0.05, 0]}
        radius={0.9}
        scale={1.2}
        heat={heat}
      />

      {/* Metatron's Cube — the centerpiece */}
      <MetatronsCube
        position={[0, 0.5, 0]}
        scale={1}
        heat={heat}
      />

      {/* Platonic Solids orbiting */}
      <PlatonicSolids heat={heat} />

      {/* Golden Spiral on altar surface */}
      <GoldenSpiral
        position={[0, floorY + 0.6, 0]}
        turns={4}
        scale={1.8}
      />

      {/* Floating element runes */}
      <FloatingRunes />

      {/* Energy torus rings */}
      <EnergyRings heat={heat} />

      {/* Sacred particle streams */}
      <SacredParticles count={500} radius={3.5} heat={heat} />

      {/* UI overlay */}
      <TesseractUI
        heat={heat}
        emberBalance={emberBalance}
        onExit={onExit}
      />
    </group>
  )
}
