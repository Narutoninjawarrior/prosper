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

import { useRef, useState, useCallback, Suspense, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
import StewardMount   from './steward/StewardMount'
import CommunityPulse from './community/CommunityPulse'
import CommunityFeed  from './community/CommunityFeed'
import GemmaPresence  from './community/GemmaPresence'
import { useMultiplayerPresence } from './multiplayer/useMultiplayerPresence'
import MultiplayerPresence from './multiplayer/MultiplayerPresence'
import PresenceHud from './multiplayer/PresenceHud'
import WorldActionSheet, { useWorldActionSheet, openWorldActionSheet } from './world/WorldActionSheet'

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
        onPointerOver={() => {
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          openWorldActionSheet({
            id: `portal-${label}`,
            title: `${label} Portal`,
            purpose: 'Zone transition matrix',
            source: 'WorldScene',
            freshness: 'Live',
            actions: [
              { label: 'Enter route', onClick: onEnter, tone: 'primary' },
              { label: 'Preview destination', onClick: () => console.log('Preview', label), tone: 'warm' }
            ]
          })
        }}
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
  const { inspectedObject, recentObjects, setInspectedObject } = useWorldActionSheet()
  const [builderOpen, setBuilder]   = useState(false)
  const [stewardSignal, setStewardSignal] = useState(0)
  const [compactUi, setCompactUi] = useState(false)
  const [showPulse, setShowPulse] = useState(true)
  const [showPresence, setShowPresence] = useState(false)
  const [showFeed, setShowFeed] = useState(false)
  const playerRef = useRef(new THREE.Vector3(0, 0, 2))
  const movementKeysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  })

  const getMovementKey = useCallback((key) => {
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        return 'up'
      case 'ArrowDown':
      case 's':
      case 'S':
        return 'down'
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return 'left'
      case 'ArrowRight':
      case 'd':
      case 'D':
        return 'right'
      default:
        return null
    }
  }, [])

  const {
    localId,
    localName,
    localMessage,
    localMessageUntil,
    remotePeers,
    sendChat,
    setDisplayName,
    status,
    lastChatError,
    chatCooldownLeft,
    canChat,
  } = useMultiplayerPresence({
    enabled: true,
    agentKey: 'human',
    getPose: () => ({
      x: playerRef.current.x,
      y: playerRef.current.y,
      z: playerRef.current.z,
      anim: moving ? 'walk' : 'idle',
    }),
  })

  // Click-to-move
  const handleMove = useCallback((point) => {
    const destination = point.clone()
    destination.x = THREE.MathUtils.clamp(destination.x, -28, 28)
    destination.z = THREE.MathUtils.clamp(destination.z, -28, 28)
    destination.y = 0
    setTargetPos(destination)
    setMoving(true)
  }, [])

  // Player movement toward target
  useFrame((_, delta) => {
    const current = playerRef.current
    const keyDirection = new THREE.Vector3(
      (movementKeysRef.current.right ? 1 : 0) - (movementKeysRef.current.left ? 1 : 0),
      0,
      (movementKeysRef.current.down ? 1 : 0) - (movementKeysRef.current.up ? 1 : 0),
    )

    if (keyDirection.lengthSq() > 0) {
      keyDirection.normalize()
      current.addScaledVector(keyDirection, delta * 5)
      current.x = THREE.MathUtils.clamp(current.x, -28, 28)
      current.z = THREE.MathUtils.clamp(current.z, -28, 28)
      current.y = 0
      setPlayerPos(current.clone())
      if (!moving) setMoving(true)
      return
    }

    if (moving && !targetPos) {
      setMoving(false)
      return
    }

    if (!targetPos || !moving) return
    const dir = targetPos.clone().sub(current)
    dir.y = 0
    const dist = dir.length()

    if (dist < 0.15) {
      setMoving(false)
      setTargetPos(null)
      setPlayerPos(current.clone())
      return
    }

    dir.normalize()
    current.addScaledVector(dir, Math.min(delta * 5, dist))
    current.x = THREE.MathUtils.clamp(current.x, -28, 28)
    current.z = THREE.MathUtils.clamp(current.z, -28, 28)
    current.y = 0
    setPlayerPos(current.clone())
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const movementKey = getMovementKey(e.key)
      if (movementKey) {
        e.preventDefault()
        movementKeysRef.current[movementKey] = true
        setTargetPos(null)
        setMoving(true)
        return
      }
      if (e.key === 'b' || e.key === 'B') setBuilder(v => !v)
      if (e.key === 't' || e.key === 'T') setActiveZone('tesseract')
      if (e.key === 'Escape') setActiveZone(null)
    }

    const handleKeyUp = (e) => {
      const movementKey = getMovementKey(e.key)
      if (movementKey) {
        movementKeysRef.current[movementKey] = false
      }
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [getMovementKey, setActiveZone])

  useEffect(() => {
    const syncLayout = () => {
      setCompactUi(window.innerWidth < 1100)
    }

    syncLayout()
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  return (
    <>

      <HearthRenderer heat={heat}>
        {/* Click-to-move ground */}
        <ClickGround onMove={handleMove} />

        {/* Multiplayer Avatars (Local + Remote) */}
        <MultiplayerPresence
          localId={localId}
          localName={localName}
          localTarget={playerPos}
          localAnim={moving ? 'walk' : 'idle'}
          localMoving={moving}
          localMessage={localMessage}
          localMessageUntil={localMessageUntil}
          remotePeers={remotePeers}
        />

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

        <GemmaPresence
          position={[1.8, 1.5, -1.2]}
          label="Gemma"
          accent="#D4A853"
          onInvoke={() => setStewardSignal((value) => value + 1)}
        />
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
      <Html>
        {typeof document !== 'undefined' && createPortal(
          <>
        {showPresence && (
          <PresenceHud
            status={status}
            displayName={localName}
            onNameChange={setDisplayName}
            onSend={sendChat}
            lastChatError={lastChatError}
            chatCooldownLeft={chatCooldownLeft}
            canChat={canChat}
            remotePeers={remotePeers}
          />
        )}

        <BuilderPanel
          visible={builderOpen}
          emberBalance={emberBalance}
          onPlace={(type, config) => {
            console.log('[WorldScene] Place:', type, config)
            setBuilder(false)
          }}
        />

        {showPulse && (
          <CommunityPulse
            realm="world"
            heat={heat}
            emberBalance={emberBalance}
            nodeCount={forgeNodes.length}
            onOpenBuilder={() => setBuilder(true)}
            onOpenSteward={() => setStewardSignal((value) => value + 1)}
          />
        )}

        {showFeed && (
          <CommunityFeed
            realm="world"
            heat={heat}
            emberBalance={emberBalance}
            nodeCount={forgeNodes.length}
          />
        )}

        <StewardMount
          emberBalance={emberBalance}
          realm="world"
          anchor="right"
          openSignal={stewardSignal}
        />

        <div
          style={{
            position: 'fixed',
            top: compactUi ? 64 : 72,
            right: 16,
            display: 'flex',
            gap: 8,
            zIndex: 26,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            maxWidth: compactUi ? 'calc(100vw - 32px)' : 420,
          }}
        >
            <button
              type="button"
              onClick={() => setShowPulse((value) => !value)}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(212,168,83,0.32)',
                background: 'rgba(10,6,4,0.82)',
                color: '#FAF6EF',
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {showPulse ? 'Hide pulse' : 'Show pulse'}
            </button>
            <button
              type="button"
              onClick={() => setShowPresence((value) => !value)}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(122,158,126,0.32)',
                background: 'rgba(10,6,4,0.82)',
                color: '#FAF6EF',
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {showPresence ? 'Hide presence' : 'Show presence'}
            </button>
            <button
              type="button"
              onClick={() => setShowFeed((value) => !value)}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(170,136,255,0.32)',
                background: 'rgba(10,6,4,0.82)',
                color: '#FAF6EF',
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {showFeed ? 'Hide feed' : 'Show feed'}
            </button>
        </div>

        {/* HUD — bottom left */}
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          maxWidth: compactUi ? 'calc(100vw - 32px)' : 280,
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
          <div style={{ color: '#888', fontSize: 9, marginTop: 6, lineHeight: '1.4' }}>
            [WASD / Arrows] move<br/>
            [Click] walk<br/>
            [B] build · [T] tesseract · [Esc] close
          </div>
        </div>
          </>,
          document.body
        )}
      </Html>
      <WorldActionSheet inspectedObject={inspectedObject} recentObjects={recentObjects} onClose={() => setInspectedObject(null)} />
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
        camera={{ position: [0, 10, 18], fov: 55, near: 0.1, far: 200 }}
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
