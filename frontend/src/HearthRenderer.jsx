/**
 * HearthRenderer.jsx
 * Lives in: frontend/src/HearthRenderer.jsx
 *
 * Drop-in visual upgrade wrapper for ThreeForge.
 * Adds: Sky, Environment, Water shader, and full postprocessing.
 *
 * USAGE — wrap your existing ThreeForge scene content:
 *
 *   import HearthRenderer from './HearthRenderer'
 *
 *   // In your Canvas:
 *   <HearthRenderer heat={2980}>
 *     <YourExistingWorldObjects />
 *   </HearthRenderer>
 *
 * DEPENDENCIES (npm install these two):
 *   npm install @react-three/postprocessing
 *
 * Already installed (no action needed):
 *   @react-three/drei  →  Sky, Environment, Water, Stars, Float
 *   three              →  everything else
 */

import { useRef, Suspense } from 'react'
import { useFrame }  from '@react-three/fiber'
import {
  Sky,
  Environment,
  Stars,
  Float,
  MeshReflectorMaterial,
} from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  Vignette,
  SSAO,
  DepthOfField,
  ToneMapping,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'

// ── Hearthlands palette constants ─────────────────────────────────
const HEARTH_FOG_COLOR   = new THREE.Color('#2A1A10')
const HEARTH_AMBIENT     = '#F5E0C0'

// ── Terrain ground ────────────────────────────────────────────────
// Replaces the flat black floor with a warm reflective surface

function HearthGround() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      receiveShadow
    >
      <planeGeometry args={[60, 60, 1, 1]} />
      <MeshReflectorMaterial
        blur={[400, 100]}
        resolution={512}
        mixBlur={0.6}
        mixStrength={15}
        roughness={0.9}
        depthScale={1.0}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#2A1A10"
        metalness={0.2}
      />
    </mesh>
  )
}

// ── Hearthlands sky ───────────────────────────────────────────────
// Late-afternoon golden-hour sky that matches the palette

function HearthSky() {
  return (
    <Sky
      distance={450000}
      sunPosition={[8, 1.5, -10]}   // low sun = golden hour
      inclination={0.55}
      azimuth={0.25}
      turbidity={8}
      rayleigh={2}
      mieCoefficient={0.005}
      mieDirectionalG={0.85}
    />
  )
}

// ── Floating ember particles ──────────────────────────────────────
function EmberParticles({ heat }) {
  const count = Math.floor((heat / 3000) * 60)
  const groupRef = useRef()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = clock.elapsedTime * 0.02
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle  = (i / count) * Math.PI * 2 + i * 0.618
        const radius = 3 + Math.random() * 6
        const height = Math.random() * 4
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        return (
          <Float key={i} speed={1 + Math.random()} floatIntensity={0.5} rotationIntensity={0}>
            <mesh position={[x, height, z]}>
              <sphereGeometry args={[0.025, 4, 4]} />
              <meshStandardMaterial
                color="#E8842A"
                emissive="#E8842A"
                emissiveIntensity={3}
              />
            </mesh>
          </Float>
        )
      })}
    </group>
  )
}

// ── Scene fog ─────────────────────────────────────────────────────
function HearthFog() {
  return <fog attach="fog" args={['#5C3020', 18, 60]} />
}

// ── Lighting setup ────────────────────────────────────────────────
function HearthLighting({ heat }) {
  const warmth = Math.min(heat / 3000, 1)

  return (
    <>
      {/* Warm ambient — the glow of the Hearth fills the space */}
      <ambientLight intensity={0.4 + warmth * 0.2} color={HEARTH_AMBIENT} />

      {/* Sun direction — golden hour from the right */}
      <directionalLight
        position={[8, 6, -5]}
        intensity={1.2}
        color="#FFD0A0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Hearth glow from below — the fire center */}
      <pointLight
        position={[0, 0.5, 0]}
        color="#E8842A"
        intensity={1.5 + warmth * 2}
        distance={12}
        castShadow
      />

      {/* Fill light — prevents full black shadows */}
      <hemisphereLight
        args={['#C27C5A', '#3D2B1A', 0.4]}
      />
    </>
  )
}

// ── Postprocessing stack ──────────────────────────────────────────
// Bloom on emissive objects only (threshold = 1.0)
// SSAO for depth and ground contact shadow
// Vignette for cinematic framing
// Depth of Field at far distance for dreamlike quality

function HearthPostProcessing({ heat }) {
  const warmth = Math.min(heat / 5000, 1)

  return (
    <EffectComposer multisampling={4}>
      {/* Bloom — ONLY on materials with emissiveIntensity > 1 */}
      <Bloom
        luminanceThreshold={0.9}
        luminanceSmoothing={0.9}
        mipmapBlur
        intensity={0.8 + warmth * 0.8}
        radius={0.4}
      />

      {/* SSAO — subtle ambient occlusion for depth */}
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={16}
        rings={4}
        distanceThreshold={1.0}
        distanceFalloff={0.0}
        rangeThreshold={0.5}
        rangeFalloff={0.1}
        luminanceInfluence={0.9}
        radius={20}
        scale={0.5}
        bias={0.5}
      />

      {/* Depth of Field — subtle, far focus */}
      <DepthOfField
        focusDistance={0.01}
        focalLength={0.05}
        bokehScale={1.5}
        height={480}
      />

      {/* Vignette — warm, not dark */}
      <Vignette
        eskil={false}
        offset={0.25}
        darkness={0.4}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Tone mapping */}
      <ToneMapping
        blendFunction={BlendFunction.NORMAL}
        adaptive={true}
        resolution={256}
        middleGrey={0.5}
        maxLuminance={16.0}
        averageLuminance={1.0}
        adaptationRate={1.0}
        mode={ToneMappingMode.REINHARD2_ADAPTIVE}
      />
    </EffectComposer>
  )
}

// ── Main HearthRenderer ───────────────────────────────────────────

export default function HearthRenderer({ children, heat = 2980 }) {
  return (
    <>
      {/* Scene-level fog */}
      <HearthFog />

      {/* Sky */}
      <HearthSky />

      {/* Stars (visible at night / through fog) */}
      <Stars
        radius={80}
        depth={40}
        count={1000}
        factor={2}
        saturation={0.6}
        fade
      />

      {/* Environment — sunset HDRI for PBR reflections */}
      <Suspense fallback={null}>
        <Environment preset="sunset" background={false} />
      </Suspense>

      {/* Lighting */}
      <HearthLighting heat={heat} />

      {/* Ground */}
      <HearthGround />

      {/* Floating ember particles */}
      <EmberParticles heat={heat} />

      {/* Your world objects go here */}
      {children}

      {/* Postprocessing — last so it applies to everything */}
      <HearthPostProcessing heat={heat} />
    </>
  )
}
