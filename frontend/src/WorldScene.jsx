/**
 * WorldScene.jsx
 * Lives in: frontend/src/WorldScene.jsx
 *
 * The interactive RuneScape-style world.
 * Click the ground to move. Approach objects to interact.
 * Walk between zones: Lodge, Farm, Tesseract, Forge, Exchange.
 *
 * Uses the same Firestore ForgeNodes as ThreeForge — same data, richer interaction.
 *
 * CONTROLS:
 *   Left-click ground   → walk there
 *   Right-drag / scroll → orbit camera (RuneScape style)
 *   Left-click object   → interact
 *   B key               → toggle Builder Panel
 *   T key               → teleport to Tesseract
 *   Escape              → deselect
 *
 * REQUIRES:
 *   @react-three/postprocessing  (npm install)
 *   All other deps already in package.json
 */

import { useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Html,
  Text,
  Float,
  Sphere,
} from '@react-three/drei'
import * as THREE from 'three'
import HearthRenderer from './HearthRenderer'
import TesseractZone  from './sacred/TesseractZone'
import BuilderPanel   from './BuilderPanel'

// ── Zone definitions ──────────────────────────────────────────────
const ZONES = {
  lodge:     { position: [0, 0, 0],     color: '#C27C5A', label: 'The Lodge'     },
  farm:      { position: [12, 0, -4],   color: '#7A9E7E', label: 'The Farm'      },
  forge:     { position: [-10, 0, -6],  color: '#E8842A', label: 'The Forge'     },
  exchange:  { position: [8, 0, 10],    color: '#D4A853', label: 'The Exchange'  },
  tesseract: { position: [-6, 0, 10],   color: '#AA88FF', label: 'The Tesseract' },
  waterwheel:{ position: [-14, 0, 4],   color: '#4A90D9', label: 'Waterwheel'    },
}

// ── Zone portal marker ────────────────────────────────────────────
function ZonePortal({ position, color, label, onEnter }) {
  const ringRef = useRef()
  const [hovered, setHovered] = useState(false)

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = clock.elapsedTime * 0.5
      ringRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.1
    }
  })

  return (
    <group position={position}>
      {/* Portal ring */}
      <mesh
        ref={ringRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onEnter}
      >
        <torusGeometry args={[0.8, 0.06, 8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.2 : 0.4}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Ground glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.15}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Label */}
      <Float speed={1.5} floatIntensity={0.15}>
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.22}
          color={color}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {label}
        </Text>
      </Float>

      {/* Interaction hint */}
      {hovered && (
        <Html position={[0, 2.2, 0]} center>
          <div style={{
            background: 'rgba(10,6,4,0.9)',
            border: `0.5px solid ${color}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#FAF6EF',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            Click to enter {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ── Player character ──────────────────────────────────────────────
function PlayerCharacter({ position, moving }) {
  const groupRef = useRef()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    // Gentle bob when moving
    if (moving) {
      groupRef.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.08
    } else {
      groupRef.current.position.y = 0
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
        <meshStandardMaterial color="#C27C5A" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#F5E0C0" roughness={0.9} />
      </mesh>
      {/* Ember glow */}
      <pointLight position={[0, 0.8, 0]} color="#E8842A" intensity={0.3} distance={2} />
    </group>
  )
}

// ── Ground plane with click-to-move ──────────────────────────────
function ClickGround({ onMove }) {
  const mesh = useRef()

  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        onMove(e.point)
      }}
    >
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial visible={false} />
    </mesh>
  )
}

// ── Walk target indicator ─────────────────────────────────────────
function WalkTarget({ position }) {
  if (!position) return null
  return (
    <mesh position={[position.x, 0.05, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.2, 0.3, 16]} />
      <meshStandardMaterial color="#E8842A" emissive="#E8842A" emissiveIntensity={1} transparent opacity={0.8} />
    </mesh>
  )
}

// ── Path lines (optional visual aid) ──────────────────────────────
function PathLine({ from, to }) {
  if (!from || !to) return null
  const points = [
    new THREE.Vector3(from.x, 0.08, from.z),
    new THREE.Vector3(to.x, 0.08, to.z),
  ]
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#E8842A" transparent opacity={0.3} />
    </line>
  )
}

// ── Main world scene ──────────────────────────────────────────────
function WorldContent({
  heat,
  emberBalance,
  forgeNodes,
  activeZone,
  setActiveZone,
}) {
  const [playerPos, setPlayerPos]   = useState(new THREE.Vector3(0, 0, 2))
  const [targetPos, setTargetPos]   = useState(null)
  const [moving, setMoving]         = useState(false)
  const [builderOpen, setBuilder]   = useState(false)
  const playerRef = useRef(new THREE.Vector3(0, 0, 2))

  // Click-to-move
  const handleMove = useCallback((point) => {
    setTargetPos(point.clone())
    setMoving(true)
  }, [])

  // Player movement toward target
  useFrame((_, delta) => {
    if (!targetPos || !moving) return
    const current = playerRef.current
    const dir     = targetPos.clone().sub(current)
    dir.y = 0
    const dist    = dir.length()

    if (dist < 0.15) {
      setMoving(false)
      setTargetPos(null)
      setPlayerPos(current.clone())
      return
    }

    dir.normalize()
    current.addScaledVector(dir, Math.min(delta * 5, dist))
    current.y = 0
    setPlayerPos(current.clone())
  })

  // Keyboard shortcuts
  const handleKeyboard = useCallback((e) => {
    if (e.key === 'b' || e.key === 'B') setBuilder(v => !v)
    if (e.key === 't' || e.key === 'T') setActiveZone('tesseract')
    if (e.key === 'Escape') setActiveZone(null)
  }, [setActiveZone])

  return (
    <>
      {/* Keyboard listener */}
      <Html>
        <div
          style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
          tabIndex={0}
          onKeyDown={handleKeyboard}
        />
      </Html>

      <HearthRenderer heat={heat}>
        {/* Click-to-move ground */}
        <ClickGround onMove={handleMove} />

        {/* Player */}
        <PlayerCharacter position={playerPos} moving={moving} />

        {/* Walk target */}
        <WalkTarget position={targetPos} />

        {/* Path visualization */}
        <PathLine from={playerPos} to={targetPos} />

        {/* Zone portals */}
        {Object.entries(ZONES).map(([key, zone]) => (
          <ZonePortal
            key={key}
            position={zone.position}
            color={zone.color}
            label={zone.label}
            onEnter={() => setActiveZone(key)}
          />
        ))}

        {/* Tesseract zone — renders in place when active */}
        {activeZone === 'tesseract' && (
          <group position={ZONES.tesseract.position}>
            <TesseractZone
              heat={heat}
              emberBalance={emberBalance}
              onExit={() => setActiveZone(null)}
            />
          </group>
        )}
      </HearthRenderer>

      {/* RuneScape-style orbit camera */}
      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI / 2.2}   // can't go below ground
        minPolarAngle={Math.PI / 6}      // can't go too overhead
        minDistance={4}
        maxDistance={25}
        target={playerPos}
        enablePan={false}
      />

      {/* Builder panel overlay */}
      <Html fullscreen>
        <BuilderPanel
          visible={builderOpen}
          emberBalance={emberBalance}
          onPlace={(type, config) => {
            console.log('[WorldScene] Place:', type, config)
            setBuilder(false)
          }}
        />

        {/* HUD — bottom left */}
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          background: 'rgba(10,6,4,0.85)',
          border: '0.5px solid #5C3D1E',
          borderRadius: 8,
          padding: '8px 12px',
          fontFamily: 'monospace',
          fontSize: 11,
          color: '#FAF6EF',
          zIndex: 10,
        }}>
          <div style={{ color: '#E8842A', marginBottom: 4 }}>
            ⬡ {emberBalance?.toLocaleString() ?? 0} $EMBER
          </div>
          <div style={{ color: '#7A9E7E', marginBottom: 4 }}>
            {heat ?? 0} $HEAT
          </div>
          {activeZone && (
            <div style={{ color: '#AA88FF' }}>
              → {ZONES[activeZone]?.label}
            </div>
          )}
          <div style={{ color: '#444', fontSize: 9, marginTop: 6 }}>
            [B] build · [T] tesseract · [Esc] exit
          </div>
        </div>
      </Html>
    </>
  )
}

// ── Canvas wrapper ────────────────────────────────────────────────
export default function WorldScene({
  heat         = 2980,
  emberBalance = 2980,
  forgeNodes   = [],
}) {
  const [activeZone, setActiveZone] = useState(null)

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0A0604' }}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 55, near: 0.1, far: 200 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <Suspense fallback={null}>
          <WorldContent
            heat={heat}
            emberBalance={emberBalance}
            forgeNodes={forgeNodes}
            activeZone={activeZone}
            setActiveZone={setActiveZone}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
