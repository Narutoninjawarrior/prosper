/**
 * BiosphereScene.jsx
 * Lives in: frontend/src/BiosphereScene.jsx
 *
 * The Sovereign Biosphere — a sacred geometry farming world.
 * Route: /biosphere
 *
 * A farm arranged on the Flower of Life. 19 cultivation nodes.
 * Bioluminescent mycelium spreads between active plots.
 * Solarpunk structures: terracotta water towers, wind catchers.
 * Geometric resonance amplifies physics when sacred patterns form.
 *
 * Connected to the same Firestore as ThreeForge and WorldScene.
 * Keyboard:
 *   B → Builder Panel
 *   Escape → deselect
 *   W/S → zoom in/out (camera)
 *
 * Future upgrade path:
 *   Change Canvas gl prop to WebGPURenderer (one line)
 *   and mycelium upgrades to GPU compute shaders automatically.
 */

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  Sky,
  Stars,
  Html,
} from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, SSAO } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import BiosphereGrid from './biosphere/BiosphereGrid'
import BuilderPanel  from './BuilderPanel'
import StewardMount from './steward/StewardMount'
import CommunityPulse from './community/CommunityPulse'
import GemmaPresence from './community/GemmaPresence'

// ── Scene lighting for the Biosphere ─────────────────────────────
// Warmer and earthier than the WorldScene — we're in a garden,
// not on an adventure. The light comes from the Hearth Fire
// and the late afternoon sky.

function BiosphereLighting({ heat }) {
  const warmth = Math.min((heat ?? 2980) / 5000, 1)

  return (
    <>
      {/* Warm ambient — feels like a garden at 4pm */}
      <ambientLight intensity={0.35} color="#F5DFC0" />

      {/* Sun — low angle, casting long shadows across the grid */}
      <directionalLight
        position={[10, 6, -8]}
        intensity={1.1}
        color="#FFD08A"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />

      {/* Hearth uplight — the fire below the grid */}
      <pointLight
        position={[0, 0.5, 0]}
        color="#E8842A"
        intensity={1.2 + warmth * 1.5}
        distance={14}
        castShadow
      />

      {/* Sky fill — blue from above */}
      <hemisphereLight args={['#87CEEB', '#3D2B1A', 0.3]} />
    </>
  )
}

// ── Ground mist ───────────────────────────────────────────────────
// Low-lying amber mist rolls across the garden floor,
// catching the light from the Hearth and the mycelium below.

function GroundMist() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial
        color="#3D1A08"
        transparent
        opacity={0.18}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

// ── HUD ───────────────────────────────────────────────────────────

function BiosphereHUD({ heat, emberBalance, resonance }) {
  return (
    <Html fullscreen>
      <div style={{
        position:   'fixed',
        bottom:     16,
        left:       16,
        background: 'rgba(10,6,4,0.88)',
        border:     '0.5px solid #5C3D1E',
        borderRadius: 10,
        padding:    '10px 14px',
        fontFamily: 'monospace',
        fontSize:   11,
        color:      '#FAF6EF',
        zIndex:     10,
        minWidth:   160,
      }}>
        <div style={{ color: '#E8842A', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
          ⬡ {(emberBalance ?? 0).toLocaleString()} $EMBER
        </div>
        <div style={{ color: '#C27C5A', marginBottom: 4 }}>
          {heat ?? 0} $HEAT
        </div>
        {resonance && (
          <div style={{ color: resonance.color, marginBottom: 4, fontSize: 10 }}>
            ✦ {resonance.label}
          </div>
        )}
        <div style={{ color: '#444', fontSize: 9, marginTop: 6 }}>
          Click nodes to plant · [B] build · [Esc] deselect
        </div>
      </div>

      {/* Top-right legend */}
      <div style={{
        position:   'fixed',
        top:        16,
        right:      16,
        background: 'rgba(10,6,4,0.75)',
        border:     '0.5px solid #3D2B1A',
        borderRadius: 8,
        padding:    '8px 12px',
        fontFamily: 'monospace',
        fontSize:   10,
        color:      '#777',
        zIndex:     10,
      }}>
        <div style={{ color: '#D4A853', marginBottom: 3 }}>Sovereign Biosphere</div>
        <div>19 nodes · Flower of Life</div>
        <div style={{ color: '#444', marginTop: 3, fontSize: 9 }}>
          Form sacred patterns for resonance
        </div>
      </div>
    </Html>
  )
}

// ── Postprocessing ────────────────────────────────────────────────
// Bloom is the key effect here — it makes the mycelium glow
// and the Metatron's Cube paths shimmer.

function BiospherePostProcessing({ heat }) {
  const warmth = Math.min((heat ?? 2980) / 5000, 1)

  return (
    <EffectComposer multisampling={4} enableNormalPass>
      {/* Bloom — selective on emissive materials */}
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        mipmapBlur
        intensity={1.5 + warmth * 0.5}
        radius={0.45}
      />

      {/* SSAO — light touch; heavy multiply crushes emissive glow on dark soil */}
      <SSAO
        blendFunction={BlendFunction.NORMAL}
        samples={8}
        rings={2}
        distanceThreshold={1.0}
        rangeThreshold={0.5}
        rangeFalloff={0.1}
        luminanceInfluence={0.2}
        radius={8}
        scale={0.35}
        bias={0.65}
      />

      {/* Vignette — warm, draws eye to center */}
      <Vignette
        eskil={false}
        offset={0.3}
        darkness={0.5}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

// ── Main BiosphereScene ───────────────────────────────────────────

export default function BiosphereScene({
  heat          = 2980,
  emberBalance  = 2980,
  forgeNodes    = [],       // from Firestore
  biospherePlots = [],
  onPlant       = () => {}, // notify parent of plant events
  onHarvest     = () => {}, // notify parent of harvest events
  onEmberSpend  = () => {}, // notify parent of $EMBER spend
}) {
  const [builderOpen, setBuilder]   = useState(false)
  const [resonance,   setResonance] = useState(null)
  const [stewardSignal, setStewardSignal] = useState(0)
  const activePlots = biospherePlots.filter((plot) => plot.active).length

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'b' || e.key === 'B') setBuilder(v => !v)
      if (e.key === 'Escape') setBuilder(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0A0402' }}>
      <Canvas
        camera={{
          position: [0, 16, 14],   // slightly top-down, farm overview
          fov:      50,
          near:     0.1,
          far:      200,
        }}
        shadows
        gl={{
          antialias:            true,
          toneMapping:          THREE.ACESFilmicToneMapping,
          toneMappingExposure:  1.1,
        }}
        // ── Future WebGPU upgrade — uncomment when ready: ─────────
        // gl={async (canvas) => {
        //   const { WebGPURenderer } = await import('three/webgpu')
        //   const r = new WebGPURenderer({ canvas, antialias: true })
        //   await r.init()
        //   return r
        // }}
      >
        <Suspense fallback={null}>

          {/* Scene fog — warm amber haze */}
          <fog attach="fog" args={['#3D1A08', 20, 55]} />

          {/* Sky */}
          <Sky
            distance={450000}
            sunPosition={[5, 1.2, -8]}
            turbidity={12}
            rayleigh={0.5}
            mieCoefficient={0.01}
            mieDirectionalG={0.95}
          />

          {/* Stars visible through warm haze */}
          <Stars radius={80} depth={40} count={800} factor={2} saturation={0.5} fade />

          {/* Environment — sunset HDR for PBR reflections */}
          <Environment preset="sunset" background={false} />

          {/* Lighting */}
          <BiosphereLighting heat={heat} />

          {/* Ground mist */}
          <GroundMist />

          {/* The Sovereign Biosphere grid */}
          <BiosphereGrid
            heat={heat}
            emberBalance={emberBalance}
            onPlant={onPlant}
            onHarvest={onHarvest}
            onEmberSpend={onEmberSpend}
            externalNodes={forgeNodes}
          />

          <GemmaPresence
            position={[0, 1.8, 0.6]}
            label="Gemma"
            accent="#D4A853"
            onInvoke={() => setStewardSignal((value) => value + 1)}
          />

          {/* Camera — RuneScape-style orbit locked to farm view */}
          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            maxPolarAngle={Math.PI / 2.1}
            minPolarAngle={Math.PI / 5}
            minDistance={8}
            maxDistance={35}
            enablePan={false}
          />

          {/* Postprocessing */}
          <BiospherePostProcessing heat={heat} />

        </Suspense>

        {/* HUD outside Suspense so it shows immediately */}
        <BiosphereHUD
          heat={heat}
          emberBalance={emberBalance}
          resonance={resonance}
        />
      </Canvas>

      {/* Builder panel */}
      <BuilderPanel
        visible={builderOpen}
        emberBalance={emberBalance}
        onPlace={(type, config) => {
          console.log('[Biosphere] Place:', type, config)
          setBuilder(false)
        }}
      />

      <CommunityPulse
        realm="biosphere"
        heat={heat}
        emberBalance={emberBalance}
        nodeCount={forgeNodes.length}
        activePlots={activePlots}
        onOpenBuilder={() => setBuilder(true)}
        onOpenSteward={() => setStewardSignal((value) => value + 1)}
      />

      <StewardMount
        emberBalance={emberBalance}
        realm="biosphere"
        anchor="right"
        openSignal={stewardSignal}
      />
    </div>
  )
}
