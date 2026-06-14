/**
 * BiosphereGrid.jsx
 * Lives in: frontend/src/biosphere/BiosphereGrid.jsx
 *
 * The Sovereign Biosphere — a sacred geometry farming grid.
 *
 * Visual layout: 19 cultivation nodes arranged on the Flower of Life
 * (1 center + 6 inner + 6 middle + 6 outer). Metatron's Cube paths
 * connect all nodes. Geometric resonance amplifies physics when
 * sacred patterns are formed by active plants.
 *
 * Gameplay:
 *   1. Click a node to plant a seed (costs $EMBER)
 *   2. Water the plot — a Water ForgeNode placed nearby helps
 *   3. The heartbeat.py tick grows the plant stage by stage
 *   4. When adjacent nodes form sacred geometry, physics amplifies
 *   5. Full bloom + resonance → mints a chain-hash RWA NFT
 *
 * Props:
 *   heat         number        — current $heat from heartbeat
 *   emberBalance number        — player's $EMBER balance
 *   onPlant      fn(nodeId)    — called when player plants a node
 *   onHarvest    fn(nodeId)    — called when player harvests
 *   onEmberSpend fn(amount)    — called when $EMBER is spent
 *   externalNodes array        — ForgeNode data from Firestore
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text, Float, Line } from '@react-three/drei'
import * as THREE from 'three'
import {
  flowerOfLifeNodes,
  checkGeometricResonance,
  metatronConnections,
  describeResonance,
} from './resonance'
import MyceliumNetwork    from './MyceliumNetwork'
import { createFBMDisplacementTexture } from './terrainNoise'
import {
  WaterCatchmentTower,
  WindCatcher,
  BiosphereHearth,
} from './SolarpunkStructures'
import InspectRail from '../inspect/InspectRail'
import { appendAgentMemoryEvent } from '../lib/agentMemory'

// ── Constants ─────────────────────────────────────────────────────
const PLANT_COST   = 5     // $EMBER to plant
const HARVEST_MIN  = 4     // minimum bloomStage to harvest
const NODE_RADIUS  = 3.5   // radius of the grid

// ── Ring visual config ────────────────────────────────────────────
const RING_STYLES = {
  center: { platformR: 0.9, rimColor: '#D4A853', platformColor: '#3D2B1A', label: 'Hearth Node' },
  inner:  { platformR: 0.7, rimColor: '#C27C5A', platformColor: '#2A1A10', label: 'Seed Node'  },
  middle: { platformR: 0.6, rimColor: '#7A9E7E', platformColor: '#1A2A10', label: 'Growth Node' },
  outer:  { platformR: 0.5, rimColor: '#4A90D9', platformColor: '#0A1A2A', label: 'Edge Node'  },
}

// ── Cultivation platform ──────────────────────────────────────────
function CultivationNode({
  node,
  resonanceNodeIds,
  resonanceColor,
  onInspect,
  emberBalance,
}) {
  const [hovered, setHovered] = useState(false)
  const rimRef    = useRef()
  const plantRef  = useRef()

  const style      = RING_STYLES[node.ring]
  const isResonant = resonanceNodeIds.includes(node.id)
  const canPlant   = !node.active && emberBalance >= PLANT_COST
  const canHarvest = node.active && node.bloomStage >= HARVEST_MIN

  // Rim pulse
  useFrame(({ clock }) => {
    if (!rimRef.current) return
    const t = clock.elapsedTime
    const base = isResonant ? 0.5 : (hovered ? 0.3 : 0.1)
    rimRef.current.material.emissiveIntensity = base + Math.sin(t * 2.5) * 0.1

    // Plant sway
    if (plantRef.current && node.active) {
      plantRef.current.rotation.z = Math.sin(t * 0.8 + node.id) * 0.04
    }
  })

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    onInspect(node.id)
  }, [node.id, onInspect])

  const rimColor = isResonant ? resonanceColor : style.rimColor

  return (
    <group position={[node.x, 0, node.z]}>
      {/* Soil platform */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[style.platformR, style.platformR * 1.1, 0.1, 16]} />
        <meshPhysicalMaterial
          color={node.active ? '#21140A' : style.platformColor}
          roughness={1.0}
          clearcoat={node.active ? 0.1 : 0.0}
        />
      </mesh>

      {/* Glowing rim */}
      <mesh
        ref={rimRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      >
        <ringGeometry args={[style.platformR * 0.92, style.platformR * 1.0, 32]} />
        <meshStandardMaterial
          color={rimColor}
          emissive={rimColor}
          emissiveIntensity={isResonant ? 2.0 : 0.15}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Plant visual — simple growth indicator */}
      {node.active && (
        <group ref={plantRef} position={[0, 0.08, 0]}>
          {/* Stem */}
          <mesh position={[0, node.bloomStage * 0.08, 0]}>
            <cylinderGeometry args={[0.02, 0.04, node.bloomStage * 0.18 + 0.1, 6]} />
            <meshStandardMaterial color="#5C8A3A" roughness={0.8} />
          </mesh>

          {/* Leaves at stage 2+ */}
          {node.bloomStage >= 2 && (
            <mesh position={[0.1, node.bloomStage * 0.14, 0]} rotation={[0, 0, 0.5]}>
              <ellipseGeometry args={[0.08, 0.14, 8]} />
              <meshStandardMaterial color="#7A9E7E" roughness={0.7} side={THREE.DoubleSide} />
            </mesh>
          )}

          {/* Bloom at stage 4+ */}
          {node.bloomStage >= 4 && (
            <mesh position={[0, node.bloomStage * 0.18, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                color={isResonant ? resonanceColor : '#E8842A'}
                emissive={isResonant ? resonanceColor : '#E8842A'}
                emissiveIntensity={0.8}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <Html position={[0, 1.2, 0]} center distanceFactor={5}>
          <div style={{
            background: 'rgba(10,6,4,0.92)',
            border: `0.5px solid ${rimColor}`,
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#FAF6EF',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textAlign: 'center',
          }}>
            <div style={{ color: rimColor, fontWeight: 500 }}>
              {style.label} #{node.id}
            </div>
            {node.active
              ? <div>Stage {node.bloomStage}/6 · Click to inspect</div>
              : canPlant
                ? <div>Click to inspect · Plant costs {PLANT_COST} $EMBER</div>
                : <div style={{ color: '#777' }}>
                    {emberBalance < PLANT_COST ? `Need ${PLANT_COST} $EMBER` : 'Empty plot'}
                  </div>
            }
          </div>
        </Html>
      )}
    </group>
  )
}

// ── Metatron's Cube path lines ────────────────────────────────────

function MetatronPaths({ nodes, resonanceNodeIds, resonanceColor }) {
  const connections = useMemo(() => metatronConnections(), [])
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])

  return (
    <>
      {connections.map(([aId, bId]) => {
        const a = nodeMap.get(aId)
        const b = nodeMap.get(bId)
        if (!a || !b) return null

        const isResonant = resonanceNodeIds.includes(aId) && resonanceNodeIds.includes(bId)
        const isBothActive = a.active && b.active
        const opacity = isResonant ? 0.7 : isBothActive ? 0.25 : 0.06
        const color   = isResonant ? resonanceColor : '#D4A853'

        return (
          <Line
            key={`m-${aId}-${bId}`}
            points={[
              new THREE.Vector3(a.x, 0.03, a.z),
              new THREE.Vector3(b.x, 0.03, b.z),
            ]}
            color={color}
            lineWidth={isResonant ? 1.2 : 0.5}
            transparent
            opacity={opacity}
          />
        )
      })}
    </>
  )
}

// ── Flower of Life floor pattern ──────────────────────────────────

function FlowerOfLifeFloor({ nodes, resonanceColor, resonanceNodeIds }) {
  const ringsRef = useRef()

  useFrame(({ clock }) => {
    if (!ringsRef.current) return
    ringsRef.current.rotation.y = clock.elapsedTime * 0.015
  })

  return (
    <group ref={ringsRef} position={[0, 0.01, 0]}>
      {nodes.map(node => (
        <mesh
          key={node.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[node.x, 0, node.z]}
        >
          <ringGeometry args={[
            NODE_RADIUS * 0.95 / (node.ring === 'center' ? 1 : node.ring === 'inner' ? 1.2 : node.ring === 'middle' ? 2 : 3),
            NODE_RADIUS / (node.ring === 'center' ? 1 : node.ring === 'inner' ? 1.2 : node.ring === 'middle' ? 2 : 3),
            32,
          ]} />
          <meshStandardMaterial
            color={resonanceNodeIds.includes(node.id) ? resonanceColor : '#D4A853'}
            emissive={resonanceNodeIds.includes(node.id) ? resonanceColor : '#D4A853'}
            emissiveIntensity={resonanceNodeIds.includes(node.id) ? 0.4 : 0.06}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Resonance banner ──────────────────────────────────────────────

function ResonanceBanner({ resonance }) {
  if (!resonance) return null
  return (
    <Float speed={1.5} floatIntensity={0.2}>
      <Html position={[0, 6, 0]} center>
        <div style={{
          background: 'rgba(5,2,16,0.92)',
          border: `1px solid ${resonance.color}`,
          borderRadius: 12,
          padding: '8px 20px',
          fontFamily: 'monospace',
          color: '#FAF6EF',
          textAlign: 'center',
          fontSize: 12,
          boxShadow: `0 0 20px ${resonance.color}44`,
        }}>
          <div style={{ color: resonance.color, fontSize: 16, marginBottom: 3, fontWeight: 500 }}>
            ✦ {resonance.label} ✦
          </div>
          <div style={{ fontSize: 10, color: '#AAA', marginBottom: 4 }}>
            {resonance.description}
          </div>
          <div style={{ color: resonance.color }}>
            {resonance.multiplier}× amplification · +{resonance.emberBonus} $EMBER/tick
          </div>
        </div>
      </Html>
    </Float>
  )
}

// ── Main BiosphereGrid ────────────────────────────────────────────

export default function BiosphereGrid({
  heat         = 2980,
  emberBalance = 2980,
  onPlant      = () => {},
  onHarvest    = () => {},
  onEmberSpend = () => {},
  externalNodes = [],  // ForgeNode data from Firestore
  externalPlots = [],
  sim2real     = null,
}) {
  // Initialize 19-node grid
  const [nodes, setNodes] = useState(() => flowerOfLifeNodes(NODE_RADIUS))
  const [inspectNodeId, setInspectNodeId] = useState(null)

  // Sync with Firestore ForgeNodes
  useEffect(() => {
    if (!externalNodes.length) return
    setNodes(prev => prev.map(n => {
      const external = externalNodes.find(e => e.biosphere_node_id === n.id)
      if (!external) return n
      return { ...n, active: true, bloomStage: external.bloom_stage ?? n.bloomStage }
    }))
  }, [externalNodes])

  // Resonance detection
  const resonance = useMemo(
    () => checkGeometricResonance(nodes),
    [nodes.map(n => `${n.id}:${n.active}:${n.bloomStage}`).join('|')]
  )

  const resonanceNodeIds = resonance?.nodeIds ?? []
  const resonanceColor   = resonance?.color ?? '#D4A853'
  const inspectNode = nodes.find((node) => node.id === inspectNodeId) ?? null

  // Plant handler
  const handlePlant = useCallback((nodeId) => {
    if (emberBalance < PLANT_COST) return
    void appendAgentMemoryEvent({
      eventType: 'task_cultivation_preview',
      summary: `Preview planted cultivation node ${nodeId}`,
      metadata: {
        ref: `plot:${nodeId}`,
        action: 'plant',
      },
    })
    onEmberSpend(PLANT_COST)
    onPlant(nodeId)
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, active: true, bloomStage: 1 } : n
    ))
  }, [emberBalance, onPlant, onEmberSpend])

  // Harvest handler
  const handleHarvest = useCallback((nodeId) => {
    void appendAgentMemoryEvent({
      eventType: 'task_cultivation_witnessed',
      summary: `Preview harvested cultivation node ${nodeId}`,
      metadata: {
        ref: `plot:${nodeId}`,
        action: 'harvest',
      },
    })
    onHarvest(nodeId)
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, active: false, bloomStage: 0 } : n
    ))
  }, [onHarvest])

  const handleInspectNode = useCallback((nodeId) => {
    void appendAgentMemoryEvent({
      eventType: 'inspect_plot',
      summary: `Inspected cultivation node ${nodeId}`,
      metadata: {
        ref: `plot:${nodeId}`,
        surface: 'biosphere',
      },
    })
    setInspectNodeId(nodeId)
  }, [])

  // Solarpunk structure placement (fixed locations)
  const outerNodes = nodes.filter(n => n.ring === 'outer')

  const groundDisplacement = useMemo(() => createFBMDisplacementTexture(), [])

  return (
    <group>
      {/* Ground plane — FBM displacement for living soil bowl */}
      <mesh rotation={[-Math.PI / 2, 0, -0.0001]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30, 64, 64]} />
        <meshStandardMaterial
          color="#1A0E06"
          roughness={0.98}
          metalness={0}
          displacementMap={groundDisplacement}
          displacementScale={0.2}
          displacementBias={-0.05}
        />
      </mesh>

      {/* Flower of Life floor rings */}
      <FlowerOfLifeFloor
        nodes={nodes}
        resonanceColor={resonanceColor}
        resonanceNodeIds={resonanceNodeIds}
      />

      {/* Metatron's Cube path lines */}
      <MetatronPaths
        nodes={nodes}
        resonanceNodeIds={resonanceNodeIds}
        resonanceColor={resonanceColor}
      />

      {/* Mycelium network */}
      <MyceliumNetwork
        nodes={nodes}
        resonanceType={resonance?.type ?? 'none'}
        resonanceNodeIds={resonanceNodeIds}
      />

      {/* Central Hearth altar */}
      <BiosphereHearth
        position={[0, 0, 0]}
        heat={heat}
        emberBalance={emberBalance}
      />

      {/* 19 cultivation nodes */}
      {nodes.map(node => (
        <CultivationNode
          key={node.id}
          node={node}
          resonanceNodeIds={resonanceNodeIds}
          resonanceColor={resonanceColor}
          onInspect={handleInspectNode}
          emberBalance={emberBalance}
        />
      ))}

      {/* Solarpunk structures at outer nodes */}
      {outerNodes.map((node, i) => (
        i % 2 === 0
          ? <WaterCatchmentTower
              key={`tower-${node.id}`}
              position={[node.x * 1.15, 0, node.z * 1.15]}
              scale={0.7}
              waterNearby={sim2real?.is_raining || nodes.some(n =>
                n.active && n.bloomStage >= 2 &&
                Math.sqrt((n.x - node.x)**2 + (n.z - node.z)**2) < 5
              )}
              heat={heat}
            />
          : <WindCatcher
              key={`wind-${node.id}`}
              position={[node.x * 1.15, 0, node.z * 1.15]}
              scale={0.7}
              windAngle={sim2real?.wind_angle ?? ((i / outerNodes.length) * Math.PI * 2)}
              heat={heat}
            />
      ))}

      {/* Resonance banner */}
      <ResonanceBanner resonance={resonance} />

      {/* Info: no resonance yet */}
      {!resonance && (
        <Html position={[0, 4, 0]} center>
          <div style={{
            background: 'rgba(10,6,4,0.7)',
            border: '0.5px solid #3D2B1A',
            borderRadius: 8,
            padding: '5px 12px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#777',
            pointerEvents: 'none',
          }}>
            Plant nodes to discover geometric resonance
          </div>
        </Html>
      )}

      {inspectNode && (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <InspectRail
              visible
              draggable
              accent="#7A9E7E"
              eyebrow={`plot ${inspectNode.id} · ${inspectNode.ring}`}
              title={inspectNode.active ? 'Cultivation node' : 'Empty plot'}
              summary={inspectNode.active
                ? `Bloom stage ${inspectNode.bloomStage}. Plant and harvest actions remain session-local on this public surface.`
                : `Planting costs ${PLANT_COST} $EMBER in the local scene preview.`}
              details={[
                { label: 'ring', value: inspectNode.ring },
                { label: 'active', value: inspectNode.active ? 'yes' : 'no' },
                { label: 'bloom', value: String(inspectNode.bloomStage) },
                { label: 'ember', value: String(emberBalance) },
                {
                  label: 'plot sync',
                  value: externalPlots.find((plot) => plot.id === inspectNode.id)?.substance ?? 'none',
                },
              ]}
              footer="Inspect-first cultivation. No Firestore write is performed by these actions."
              potentialActions={[
                {
                  action_id: 'plant_preview',
                  title: 'Plant seed',
                  status: inspectNode.active ? 'blocked' : emberBalance >= PLANT_COST ? 'available' : 'insufficient ember',
                  effect: `Spend ${PLANT_COST} $EMBER in this session-local preview and set bloom stage to 1.`,
                  inputs: 'plot id',
                  entrypoint: 'InspectRail local action',
                  write_policy: 'preview-only - no Firestore write',
                  receipt: 'local cultivation preview',
                },
                {
                  action_id: 'harvest_preview',
                  title: 'Harvest bloom',
                  status: inspectNode.active && inspectNode.bloomStage >= HARVEST_MIN ? 'available' : 'not ready',
                  effect: `Harvest clears the local bloom state when bloom stage is at least ${HARVEST_MIN}.`,
                  inputs: 'plot id',
                  entrypoint: 'InspectRail local action',
                  write_policy: 'preview-only - no Firestore write',
                  receipt: 'local harvest preview',
                },
                {
                  action_id: 'inspect_plot_sync',
                  title: 'Inspect plot sync',
                  status: 'available',
                  effect: 'Reveal any linked plot substance or external sync hint attached to this node.',
                  inputs: 'plot id',
                  entrypoint: 'InspectRail details panel',
                  write_policy: 'read-only',
                },
              ]}
              actions={[
                {
                  label: 'Plant',
                  tone: 'warm',
                  disabled: inspectNode.active || emberBalance < PLANT_COST,
                  onClick: () => handlePlant(inspectNode.id),
                },
                {
                  label: 'Harvest',
                  tone: 'primary',
                  disabled: !inspectNode.active || inspectNode.bloomStage < HARVEST_MIN,
                  onClick: () => handleHarvest(inspectNode.id),
                },
                {
                  label: 'Close',
                  onClick: () => setInspectNodeId(null),
                },
              ]}
              onClose={() => setInspectNodeId(null)}
            />
          </div>
        </Html>
      )}
    </group>
  )
}
