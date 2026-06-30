import { useCallback, useMemo, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Line } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, SSAO } from '@react-three/postprocessing'
import { Physics, RigidBody } from '@react-three/rapier'
import { flowerOfLifeNodes, metatronConnections } from './biosphere/resonance'
import {
  loadLocalSandboxObjects,
  saveLocalSandboxObjects,
} from './lib/sandboxObjects'
import { useSandboxFirestore } from './lib/useSandboxFirestore'
import { SandboxRigidObject, PlacementGhost } from './sandbox/SandboxMeshes'
import ArtFrame from './ArtFrame'
import RealmPortal from './RealmPortal'
import { HEARTH_REALMS } from './lib/hearthRealms'
import { useMultiplayerPresence } from './multiplayer/useMultiplayerPresence'
import MultiplayerPresence from './multiplayer/MultiplayerPresence'
import PresenceHud from './multiplayer/PresenceHud'

const NODE_RADIUS = 3.5
const SANDBOX_TYPES = {
  earthbag_dome: { label: 'Earthbag Dome', color: '#10b981' },
  aquaponics_core: { label: 'Aquaponics Core', color: '#3b82f6' },
}

function SacredGeometryFoundation({ warmth }) {
  const nodes = useMemo(() => flowerOfLifeNodes(NODE_RADIUS), [])
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const connections = useMemo(
    () =>
      metatronConnections()
        .map(([a, b]) => [nodeById[a], nodeById[b]])
        .filter(([a, b]) => a && b),
    [nodeById]
  )

  return (
    <group>
      {nodes.map((node) => (
        <group key={node.id} position={[node.x, 0, node.z]}>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <cylinderGeometry args={[0.42, 0.48, 0.16, 6]} />
            <meshStandardMaterial
              color={node.id === 0 ? '#D4A853' : '#C27C5A'}
              emissive={node.id === 0 ? '#E8842A' : '#10b981'}
              emissiveIntensity={0.15 + warmth * 0.25}
              roughness={0.88}
            />
          </mesh>
          <pointLight
            color={node.id === 0 ? '#E8842A' : '#10b981'}
            intensity={0.25 + warmth * 0.35}
            distance={4}
          />
        </group>
      ))}

      {connections.map(([a, b], i) => (
        <Line
          key={`m-${i}`}
          points={[
            [a.x, 0.12, a.z],
            [b.x, 0.12, b.z],
          ]}
          color="#d97706"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </group>
  )
}

function SandboxScene({
  heat,
  buildTool,
  objects,
  onPlace,
  ghostPos,
  onGhostMove,
  warmth,
  isHot,
  sunColor,
  localId,
  localName,
  localTarget,
  remotePeers,
}) {
  return (
    <>
      <color attach="background" args={[isHot ? '#3D2B1A' : '#020617']} />
      <fog attach="fog" args={[isHot ? '#C27C5A' : '#0a1628', 25, 90]} />

      <ambientLight intensity={0.25 + warmth * 0.2} color={sunColor} />
      <directionalLight
        position={[15, 30, 15]}
        castShadow
        intensity={1.2 + warmth * 0.5}
        color={sunColor}
        shadow-mapSize={[2048, 2048]}
      />

      <Sky
        sunPosition={[15, isHot ? 8 : 20, 15]}
        turbidity={isHot ? 10 : 2}
        rayleigh={isHot ? 2.5 : 0.8}
        mieCoefficient={0.005}
      />

      <Physics gravity={[0, -12, 0]}>
        <RigidBody type="fixed" colliders="cuboid" position={[0, -0.25, 0]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onPointerMove={(e) => {
              if (!buildTool) return
              e.stopPropagation()
              onGhostMove([e.point.x, 0, e.point.z])
            }}
            onClick={(e) => {
              if (!buildTool) return
              e.stopPropagation()
              onPlace(e.point.x, e.point.z)
            }}
          >
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial color="#0a120e" roughness={0.95} />
          </mesh>
        </RigidBody>

        <SacredGeometryFoundation warmth={warmth} />

        {objects.map((obj) => (
          <SandboxRigidObject
            key={obj.id}
            type={obj.type}
            position={[obj.x, obj.y + 0.5, obj.z]}
          />
        ))}

        <ArtFrame 
          position={[0, 2.5, -12]} 
          imagePath="/earthship_greenhouse.png" 
          title="Earthship Greenhouse (Concept v0.1)"
          artist="AI Masonry Unit"
          emberCost={150}
        />

        <RealmPortal realm={HEARTH_REALMS.lodge} position={[0, 1.5, 15]} />

        {/* Sandbox Multiplayer Avatars */}
        <MultiplayerPresence
          localId={localId}
          localName={localName}
          localTarget={localTarget}
          localAnim="idle"
          localMoving={false}
          localMessage={localMessage}
          localMessageUntil={localMessageUntil}
          remotePeers={remotePeers}
        />
      </Physics>

      <PlacementGhost type={buildTool} position={ghostPos} />

      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} minDistance={8} maxDistance={55} />

      <EffectComposer disableNormalPass multisampling={0}>
        <SSAO samples={8} radius={0.04} intensity={18} />
        <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.0 + warmth * 0.4} />
        <Vignette eskil={false} offset={0.12} darkness={1.1} />
      </EffectComposer>
    </>
  )
}

function mergeObjects(local, remote) {
  const byId = new Map()
  for (const o of remote) byId.set(o.id, o)
  for (const o of local) byId.set(o.id, o)
  return Array.from(byId.values())
}

export default function Sandbox({
  heat = 3000,
  emberBalance = 0,
  walletAddress = null,
}) {
  const [buildTool, setBuildTool] = useState(null)
  const [localObjects, setLocalObjects] = useState(() => loadLocalSandboxObjects())
  const [ghostPos, setGhostPos] = useState(null)
  const { remoteObjects, status: syncStatus } = useSandboxFirestore()

  const warmth = Math.min((heat ?? 2980) / 5000, 1)
  const isHot = heat > 3100
  const sunColor = isHot ? '#d97706' : '#FFD08A' // Terracotta gold or cooler gold

  const [localTarget, setLocalTarget] = useState({ x: 0, y: 0, z: 0 });

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
      x: localTarget.x,
      y: 0,
      z: localTarget.z,
      anim: 'idle',
    }),
  })

  const objects = useMemo(
    () => mergeObjects(localObjects, remoteObjects),
    [localObjects, remoteObjects]
  )

  useEffect(() => {
    saveLocalSandboxObjects(localObjects)
  }, [localObjects])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setBuildTool(null)
        setGhostPos(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleTool = (type) => {
    setBuildTool((prev) => (prev === type ? null : type))
    setGhostPos(null)
  }

  const handlePlace = useCallback(
    (x, z) => {
      if (!buildTool) return
      const obj = {
        id: `local-${buildTool}-${Date.now()}`,
        type: buildTool,
        x,
        y: 0,
        z,
        ownerWallet: walletAddress,
        createdAt: Date.now(),
      }
      setLocalObjects((prev) => [...prev, obj])
      setBuildTool(null)
      setGhostPos(null)
    },
    [buildTool, walletAddress]
  )

  const statusLabel = {
    local: 'Local-only saves · Firebase unconfigured',
    syncing: 'Syncing world_state…',
    live: `Live · ${remoteObjects.length} remote object(s)`,
    error: 'Firestore read failed · local saves only',
  }

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas 
        shadows 
        camera={{ position: [0, 18, 32], fov: 48 }}
        onPointerMove={(e) => {
          // If hovering ground, move local target so others see where we point
          if (e.point) {
            setLocalTarget({ x: e.point.x, y: 0, z: e.point.z });
          }
        }}
      >
        <SandboxScene
          heat={heat}
          localId={localId}
          localName={localName}
          localTarget={localTarget}
          remotePeers={remotePeers}
          buildTool={buildTool}
          objects={objects}
          onPlace={handlePlace}
          ghostPos={ghostPos}
          onGhostMove={setGhostPos}
          warmth={warmth}
          isHot={isHot}
          sunColor={sunColor}
        />
      </Canvas>

      <div className="absolute top-6 left-6 pointer-events-none text-white font-mono z-10 max-w-md">
        <div className="pointer-events-auto mb-4">
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
        </div>
        <h1 className="text-2xl font-bold text-[#C27C5A] drop-shadow-[0_0_15px_rgba(194,124,90,0.6)] tracking-widest uppercase">
          Sanctuary Sandbox
        </h1>
        <p className="text-xs text-[#F5E6C8] mt-1 uppercase tracking-wide">
          19-node Flower of Life · Rapier physics
        </p>
        <p className="text-[10px] text-[#7A9E7E] mt-2">{statusLabel[syncStatus]}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="bg-black/50 backdrop-blur border border-[#f59e0b]/30 px-3 py-2 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase">Heat</p>
            <p className="text-lg text-[#f59e0b] font-bold">{heat.toFixed(0)}</p>
          </div>
          <div className="bg-black/50 backdrop-blur border border-[#3b82f6]/30 px-3 py-2 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase">$EMBER</p>
            <p className="text-lg text-[#3b82f6] font-bold">{emberBalance.toFixed(1)}</p>
          </div>
          <div className="bg-black/50 backdrop-blur border border-[#10b981]/30 px-3 py-2 rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase">Placed</p>
            <p className="text-lg text-[#10b981] font-bold">{objects.length}</p>
          </div>
        </div>
        {walletAddress && (
          <p className="text-[9px] text-gray-500 mt-2 truncate max-w-xs">
            Builder: {walletAddress.slice(0, 8)}…{walletAddress.slice(-4)}
          </p>
        )}
        {!walletAddress && (
          <p className="text-[9px] text-amber-600/80 mt-2">Connect Privy to stamp ownership on builds</p>
        )}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 p-3 rounded-2xl bg-[#020804]/90 backdrop-blur-xl border border-[#10b981]/20 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {(Object.entries(SANDBOX_TYPES)).map(([type, cfg]) => (
          <button
            key={type}
            type="button"
            onClick={() => toggleTool(type)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
              buildTool === type
                ? 'bg-[#10b981]/25 border-[#10b981] text-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                : 'bg-black/40 border-gray-700 text-gray-300 hover:border-[#10b981]/50'
            }`}
            style={buildTool === type ? { borderColor: cfg.color, color: cfg.color } : undefined}
          >
            <span>+</span> {cfg.label}
          </button>
        ))}
        {buildTool && (
          <span className="text-[10px] text-gray-400 self-center px-2">
            Click ground to place · Esc cancels
          </span>
        )}
      </div>
    </div>
  )
}
