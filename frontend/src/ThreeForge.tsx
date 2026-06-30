/**
 * ThreeForge.tsx — 3D Forge powered by React Three Fiber
 * Agent-controlled world. AI spends $EMBER to add objects via mcp_place_object.
 * State is synced from Firestore three_forge/world_state in real-time.
 * The MCP server (threejs-devtools-mcp) can inspect and mutate this scene.
 *
 * Install: npm install @react-three/fiber @react-three/drei three
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Html, Float, Text } from '@react-three/drei';
import { useEffect, useRef, useState, Suspense } from 'react';
import * as THREE from 'three';
import { getFirestoreDb } from './firebaseConfig';
import { doc, onSnapshot, collection } from 'firebase/firestore';
// @ts-ignore
import ArtFrame from './ArtFrame';
// @ts-ignore
import FlowerBed from './FlowerBed';
// @ts-ignore
import WaterSim from './WaterSim';
// @ts-ignore
import BuilderPanel from './BuilderPanel';
import { startInteractionEngine } from './lib/interactionEngine';
// @ts-ignore
import HearthRenderer from './HearthRenderer';
// @ts-ignore
import WorldActionSheet, { useWorldActionSheet } from './world/WorldActionSheet';
import { SEEDED_ARTIFACTS } from './lib/worldArtifactSeeds';
import { ParametricArtifactRenderer } from './world/ParametricArtifactRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ForgeNode {
  id:          string;
  x:           number;
  y:           number;
  z:           number;
  color:       string;
  object_type: 'node' | 'waterwheel' | 'hearth' | 'library' | 'lodge' | 'flora' | 'water' | 'fire' | 'stone' | 'bridge' | 'ruins' | 'lightning_rod' | 'crystal';
  placed_by:   string;
  ts:          number;
  label?:      string;
  // lodge-specific fields:
  chain_hash?: string;
  seed?:       number;
  algo?:       number;
  heat_level?: number;
  title?:      string;
  artist?:     string;
  ember_cost?: number;
  minted?:     boolean;
  // flora-specific fields:
  bloom_stage?: number;
  branch_data?: any[];
  // water/reagent fields:
  substance_id?: number;
}

interface WorldMapTile {
  tile_id:       string;
  x:             number;
  y:             number;
  building_type: string;
  claimed_by:    string;
  status:        string;
}

interface WorldState {
  nodes:       ForgeNode[];
  last_updated: number;
}

// ─── Object color map by type ─────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  node:       '#10b981',
  waterwheel: '#3b82f6',
  hearth:     '#d97706',
  library:    '#8b5cf6',
  lodge:      '#f43f5e',
};

const TYPE_GEOMETRY: Record<string, [number, number, number]> = {
  node:       [0.8, 0.8, 0.8],
  waterwheel: [0.5, 1.2, 0.5],
  hearth:     [1.0, 1.0, 1.0],
  library:    [1.2, 0.6, 0.8],
  lodge:      [1.5, 0.8, 1.5],
};

// ─── Single placed object ─────────────────────────────────────────────────────
function ForgeObject({ node }: { node: ForgeNode }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const color = node.color || TYPE_COLORS[node.object_type] || '#10b981';
  const [w, h, d] = TYPE_GEOMETRY[node.object_type] || [0.8, 0.8, 0.8];

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <mesh
        ref={meshRef}
        position={[node.x, node.y + h / 2, node.z]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.6 : 0.2}
          roughness={0.3}
          metalness={0.4}
        />
        {hovered && (
          <Html distanceFactor={8} center>
            <div style={{
              background:    'rgba(2,8,4,0.9)',
              border:        `1px solid ${color}`,
              borderRadius:  4,
              padding:       '4px 8px',
              color,
              fontFamily:    'monospace',
              fontSize:       10,
              whiteSpace:    'nowrap',
              pointerEvents: 'none',
            }}>
              {node.object_type.toUpperCase()} · {node.placed_by}<br />
              <span style={{ opacity: 0.6 }}>{new Date(node.ts).toLocaleTimeString()}</span>
            </div>
          </Html>
        )}
      </mesh>
    </Float>
  );
}

// ─── Hearthlands ground plane ─────────────────────────────────────────────────
function HearthGround({ 
  onPointerMove, 
  onPointerOut, 
  onClick 
}: { 
  onPointerMove?: (e: any) => void; 
  onPointerOut?: () => void; 
  onClick?: (e: any) => void; 
}) {
  return (
    <>
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#10b981"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#d97706"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid={false}
      />
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]} 
        receiveShadow
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#020804" roughness={0.9} />
      </mesh>
    </>
  );
}

// ─── Ambient effects ──────────────────────────────────────────────────────────
function HearthLights() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 8, 5]}  color="#d97706" intensity={1.5} distance={20} />
      <pointLight position={[-5, 5, -5]} color="#10b981" intensity={1.0} distance={20} />
      <pointLight position={[0, 12, 0]}  color="#ffffff" intensity={0.5} distance={30} />
    </>
  );
}

// ─── Floating EMBER counter ───────────────────────────────────────────────────
function EmberCounter({ count }: { count: number }) {
  return (
    <Text
      position={[-8, 6, 0]}
      fontSize={0.4}
      color="#d97706"
      anchorX="left"
      font="/fonts/JetBrainsMono-Bold.woff"
    >
      {`$EMBER NODES: ${count}`}
    </Text>
  );
}

// ─── Map Tiles ────────────────────────────────────────────────────────────────
function ForgeTile({ tile }: { tile: WorldMapTile }) {
  const [hovered, setHovered] = useState(false);
  const color = TYPE_COLORS[tile.building_type] || '#475569';
  
  return (
    <mesh
      position={[tile.x, 0.01, tile.y]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[0.95, 0.95]} />
      <meshStandardMaterial color={color} roughness={0.8} />
      {hovered && (
        <Html distanceFactor={8} position={[0, 0, 0.5]} center>
          <div style={{
            background: 'rgba(2,8,4,0.9)', border: `1px solid ${color}`,
            borderRadius: 4, padding: '4px 8px', color,
            fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap',
            pointerEvents: 'none'
          }}>
            {tile.building_type.toUpperCase()} · {tile.claimed_by}
          </div>
        </Html>
      )}
    </mesh>
  );
}

// ─── Scene (inner — has access to R3F context) ────────────────────────────────
function ForgeScene({ 
  nodes, 
  tiles, 
  onMint, 
  inspectedObject, 
  onInspectArtifact,
  localArtifacts,
  previewArtifact,
  previewValid,
  previewState = 'valid',
  placementActive = false,
  onGroundPointerMove,
  onGroundPointerOut,
  onGroundClick
}: { 
  nodes: ForgeNode[], 
  tiles: WorldMapTile[], 
  onMint: (id: string) => void, 
  inspectedObject?: any, 
  onInspectArtifact: (artifact: any) => void,
  localArtifacts: any[],
  previewArtifact: any | null,
  previewValid: boolean,
  previewState?: 'valid' | 'blocked' | 'caution',
  placementActive?: boolean,
  onGroundPointerMove?: (e: any) => void,
  onGroundPointerOut?: () => void,
  onGroundClick?: (e: any) => void
}) {
  return (
    <>
      <HearthLights />
      <HearthGround onPointerMove={onGroundPointerMove} onPointerOut={onGroundPointerOut} onClick={onGroundClick} />
      
      {placementActive && (
        <group>
          {/* Subtle bounded planning plane background */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[16, 16]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.06} side={THREE.DoubleSide} />
          </mesh>
          {/* Planning boundary box outlines (4 thin box bars) */}
          <mesh position={[0, 0.01, -8]} scale={[16.05, 0.02, 0.05]}>
            <boxGeometry />
            <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 0.01, 8]} scale={[16.05, 0.02, 0.05]}>
            <boxGeometry />
            <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
          </mesh>
          <mesh position={[-8, 0.01, 0]} scale={[0.05, 0.02, 16.05]}>
            <boxGeometry />
            <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
          </mesh>
          <mesh position={[8, 0.01, 0]} scale={[0.05, 0.02, 16.05]}>
            <boxGeometry />
            <meshBasicMaterial color="#10b981" transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      <EmberCounter count={nodes.length} />
      <Environment preset="night" />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2}
      />
      {nodes
        .filter(n => n.object_type === 'lodge')
        .map(node => (
          <ArtFrame
            key={node.id}
            position={[node.x, node.y, node.z]}
            hash={node.chain_hash ?? '0'.repeat(64)}
            title={node.title ?? 'Untitled'}
            artist={node.artist ?? node.placed_by}
            emberCost={node.ember_cost ?? 0}
            minted={node.minted ?? false}
            onMint={() => onMint(node.id)}
          />
        ))
      }
      {nodes
        .filter(n => n.object_type === 'flora')
        .map(node => (
          <FlowerBed
            key={node.id}
            position={[node.x, node.y, node.z]}
            chainHash={node.chain_hash ?? '0'.repeat(64)}
            heatLevel={node.heat_level ?? 0}
            bloomStage={node.bloom_stage ?? 0}
            branchData={node.branch_data ?? []}
            title={node.title ?? 'Garden Plot'}
            placedBy={node.placed_by ?? ''}
          />
        ))
      }
      {nodes
        .filter(n => n.object_type === 'water')
        .map(node => (
          <WaterSim
            key={node.id}
            position={[node.x, node.y, node.z]}
            chainHash={node.chain_hash ?? '0'.repeat(64)}
            heatLevel={node.heat_level ?? 1000}
            substanceId={node.substance_id ?? 0}
            wasmInstance={null} /* TODO: passed via ref if needed, but not strictly required if WaterSim loads it or handles it */
            title={node.title}
            placedBy={node.placed_by}
            isActive={inspectedObject?.id === `waterwheel-${node.chain_hash ?? '0'.repeat(64)}`}
          />
        ))
      }
      {tiles.map(tile => (
        <ForgeTile key={tile.tile_id} tile={tile} />
      ))}
      
      {SEEDED_ARTIFACTS.map(artifact => (
        <ParametricArtifactRenderer 
          key={artifact.id} 
          artifact={artifact} 
          selected={inspectedObject?.id === artifact.id}
          onInspect={onInspectArtifact} 
        />
      ))}

      {localArtifacts.map(artifact => (
        <ParametricArtifactRenderer 
          key={artifact.id} 
          artifact={artifact} 
          selected={inspectedObject?.id === artifact.id}
          onInspect={onInspectArtifact} 
        />
      ))}

      {previewArtifact && (
        <ParametricArtifactRenderer
          artifact={previewArtifact}
          preview
          previewState={previewState}
          previewValid={previewValid}
          onInspect={() => {}}
        />
      )}

      {nodes.filter(n => n.object_type !== 'lodge' && n.object_type !== 'flora').map(node => (
        <ForgeObject key={node.id} node={node} />
      ))}
      {nodes.length === 0 && tiles.length === 0 && (
        <Text position={[0, 2, 0]} fontSize={0.35} color="#10b981" anchorX="center">
          {'Forge awaiting first EMBER placement.\nAI agents spend $EMBER to build here.'}
        </Text>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ThreeForge({ agentId }: { agentId?: string }) {
  void agentId;
  const { inspectedObject, recentObjects, setInspectedObject } = useWorldActionSheet();
  const [nodes, setNodes]     = useState<ForgeNode[]>([]);
  const [tiles, setTiles]     = useState<WorldMapTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  
  const [builderOpen, setBuilderOpen] = useState(false);
  const [playerEmberBalance] = useState(2980);
  const [localArtifacts, setLocalArtifacts] = useState<any[]>([]);
  const [placementActive, setPlacementActive] = useState(false);
  const [placementFamily, setPlacementFamily] = useState<'bio_tube' | 'crystal_cluster'>('bio_tube');
  const [previewPos, setPreviewPos] = useState<[number, number, number] | null>(null);
  const [previewValid, setPreviewValid] = useState(false);
  const [previewRotationY, setPreviewRotationY] = useState(0); // in radians
  const [showTelemetryList, setShowTelemetryList] = useState(false);
  const [placementPanelCollapsed, setPlacementPanelCollapsed] = useState(true);

  // Spatial planning state readouts
  const [previewState, setPreviewState] = useState<'valid' | 'blocked' | 'caution'>('valid');
  const [previewWhy, setPreviewWhy] = useState<string>('Valid: grid-aligned local placement');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('prosper:local_artifacts');
      if (stored) {
        setLocalArtifacts(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading local artifacts:', e);
    }
  }, []);

  // Listen to keyboard/wheel rotation adjustments when placement mode is active
  useEffect(() => {
    if (!placementActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        // Rotate by 90 degrees
        setPreviewRotationY(prev => (prev + Math.PI / 2) % (Math.PI * 2));
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        // Rotate counter-clockwise by 15 degrees
        setPreviewRotationY(prev => (prev - Math.PI / 12) % (Math.PI * 2));
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        // Rotate clockwise by 15 degrees
        setPreviewRotationY(prev => (prev + Math.PI / 12) % (Math.PI * 2));
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        // Rotate clockwise by 30 degrees
        setPreviewRotationY(prev => (prev + Math.PI / 6) % (Math.PI * 2));
      } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        // Rotate counter-clockwise by 30 degrees
        setPreviewRotationY(prev => (prev - Math.PI / 6) % (Math.PI * 2));
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Small adjustment of 7.5 degrees per scroll step
      const delta = e.deltaY > 0 ? Math.PI / 24 : -Math.PI / 24;
      setPreviewRotationY(prev => (prev + delta) % (Math.PI * 2));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [placementActive]);

  // Reset rotation when activating placement mode
  useEffect(() => {
    if (placementActive) {
      setPreviewRotationY(0);
    }
  }, [placementActive]);

  // Validate spatial constraints based on footprint logic, boundary limits, and rotation context
  useEffect(() => {
    if (!placementActive || !previewPos) {
      setPreviewState('valid');
      setPreviewWhy('');
      setPreviewValid(true);
      return;
    }

    const [px, , pz] = previewPos;

    // 1. Planning boundary check
    const isOutsideBounds = Math.abs(px) > 8 || Math.abs(pz) > 8;
    if (isOutsideBounds) {
      setPreviewState('blocked');
      setPreviewWhy('Blocked: Outside planning boundaries');
      setPreviewValid(false);
      return;
    }

    // Footprint rule definitions for current placement family
    const Rp = placementFamily === 'bio_tube' ? 1.0 : 0.8;
    const Bp = placementFamily === 'bio_tube' ? 0.8 : 0.6;

    let statusState: 'valid' | 'blocked' | 'caution' = 'valid';
    let statusWhy = 'Valid: grid-aligned local placement';

    const allArtifacts = [...SEEDED_ARTIFACTS, ...localArtifacts];

    for (const art of allArtifacts) {
      const [ax, , az] = art.transform.position;
      const dx = px - ax;
      const dz = pz - az;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Footprint rule definitions for existing placed artifacts
      const artFam = art.artifact_family || '';
      let Re = 1.0;
      let Be = 0.8;

      if (artFam.includes('crystal') || art.geometry_recipe.primitive_type === 'instanced_cluster') {
        Re = 0.8;
        Be = 0.6;
      } else if (artFam.includes('bio') || art.geometry_recipe.primitive_type === 'parametric_tube') {
        Re = 1.0;
        Be = 0.8;
      } else {
        // Default footprint rule for other objects (waterwheel, flora, hearth)
        Re = 1.2;
        Be = 0.6;
      }

      // Check spatial footprint overlap (Blocked)
      if (dist < Rp + Re) {
        statusState = 'blocked';
        statusWhy = 'Blocked: overlaps existing habitat footprint';
        break; // Immediate block, terminate checking loop
      }

      // Check proximity warning range (Caution)
      if (dist < (Rp + Re) + (Bp + Be)) {
        if (statusState === 'valid') {
          statusState = 'caution';
          // Check for mixed-family proximity mismatch
          const isFamilyMismatch = art.artifact_family !== placementFamily;
          if (isFamilyMismatch) {
            statusWhy = 'Caution: mixed family proximity mismatch';
          } else {
            statusWhy = 'Caution: near another staged object';
          }
        }
      }
    }

    // If not blocked, verify rotation context and close boundary edges
    if (statusState !== 'blocked') {
      const normRot = (previewRotationY % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const rem = normRot % (Math.PI / 2);
      const isGridRotated = Math.min(rem, Math.PI / 2 - rem) < 0.02;

      if (!isGridRotated) {
        statusState = 'caution';
        statusWhy = 'Caution: off-axis rotation for grid context';
      } else {
        // Caution check for placement near planning boundaries
        const edgeBuffer = Rp;
        if (Math.abs(px) > 8 - edgeBuffer || Math.abs(pz) > 8 - edgeBuffer) {
          statusState = 'caution';
          statusWhy = 'Caution: close to planning boundary edge';
        }
      }
    }

    setPreviewState(statusState);
    setPreviewWhy(statusWhy);
    setPreviewValid(statusState !== 'blocked');
  }, [previewPos, previewRotationY, placementFamily, localArtifacts, placementActive]);

  const handleGroundPointerMove = (e: any) => {
    if (!placementActive) return;
    const point = e.point;
    if (!point) return;

    // Snap to 0.5m grid snaps
    const xSnapped = Math.round(point.x * 2) / 2;
    const zSnapped = Math.round(point.z * 2) / 2;
    const ySnapped = placementFamily === 'bio_tube' ? 0.5 : 0;

    setPreviewPos([xSnapped, ySnapped, zSnapped]);
  };

  const handleGroundPointerOut = () => {
    setPreviewPos(null);
  };

  const handleGroundClick = (e: any) => {
    if (!placementActive || !previewPos || previewState === 'blocked') return;
    e.stopPropagation();

    const newArtifact = {
      id: `art-local-${Date.now()}`,
      title: placementFamily === 'bio_tube' ? 'Local Fluid Conduit Draft' : 'Local Crystal Cluster Draft',
      artifact_family: placementFamily,
      audience_scope: 'world_room',
      visibility: 'local_draft',
      transform: {
        position: previewPos,
        rotation: [0, previewRotationY, 0],
        scale: [1, 1, 1]
      },
      geometry_recipe: placementFamily === 'bio_tube' ? {
        primitive_type: 'parametric_tube',
        dimensions: [0.15, 64, 8],
        spline_nodes: [
          [0, 0, 0],
          [1, 2, 1],
          [2, 1, 3],
          [1, 3, 5],
          [0, 0, 6]
        ]
      } : {
        primitive_type: 'instanced_cluster',
        dimensions: [0.4, 2.0, 6, 15]
      },
      material_profile: placementFamily === 'bio_tube' ? {
        preset_family: 'BIOFILM_MOSS',
        roughness: 0.8,
        metalness: 0.1,
        emissive_intensity: 0.3,
        color_hex: '#10b981'
      } : {
        preset_family: 'CRYSTAL_ICE',
        roughness: 0.1,
        metalness: 0.9,
        emissive_intensity: 0.8,
        color_hex: '#8b5cf6'
      },
      provenance_metadata: {
        author_type: 'human',
        author_id: 'sys_steward',
        created_at: new Date().toISOString(),
        note: 'Local placement preview. Does not publish or witness world state.'
      }
    };

    const updatedList = [...localArtifacts, newArtifact];
    setLocalArtifacts(updatedList);
    sessionStorage.setItem('prosper:local_artifacts', JSON.stringify(updatedList));

    setPlacementActive(false);
    setPreviewPos(null);
  };

  const previewArtifact = (placementActive && previewPos) ? {
    id: 'preview-ghost',
    title: placementFamily === 'bio_tube' ? 'Parametric Fluid Conduit' : 'Resonance Crystal Cluster',
    artifact_family: placementFamily,
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: previewPos,
      rotation: [0, previewRotationY, 0],
      scale: [1, 1, 1]
    },
    geometry_recipe: placementFamily === 'bio_tube' ? {
      primitive_type: 'parametric_tube',
      dimensions: [0.15, 64, 8],
      spline_nodes: [
        [0, 0, 0],
        [1, 2, 1],
        [2, 1, 3],
        [1, 3, 5],
        [0, 0, 6]
      ]
    } : {
      primitive_type: 'instanced_cluster',
      dimensions: [0.4, 2.0, 6, 15]
    },
    material_profile: placementFamily === 'bio_tube' ? {
      preset_family: 'BIOFILM_MOSS',
      roughness: 0.8,
      metalness: 0.1,
      emissive_intensity: 0.3,
      color_hex: '#10b981'
    } : {
      preset_family: 'CRYSTAL_ICE',
      roughness: 0.1,
      metalness: 0.9,
      emissive_intensity: 0.8,
      color_hex: '#8b5cf6'
    },
    provenance_metadata: {
      author_type: 'human',
      author_id: 'sys_steward',
      created_at: new Date().toISOString(),
      note: 'Local placement preview. Does not publish or witness world state.'
    }
  } : null;

  const handlePlace = (config: any) => {
    // TODO: Wire to Forge API
    console.log("Placing node:", config);
    setBuilderOpen(false);
  };

  const handleMint = async (nodeId: string) => {
    const db = getFirestoreDb();
    if (!db) return;
    const stateRef = doc(db, 'three_forge', 'world_state');
    try {
      const snap = await import('firebase/firestore').then(m => m.getDoc(stateRef));
      if (!snap.exists()) return;
      const data = snap.data() as WorldState;
      const updated = data.nodes.map((n: ForgeNode) =>
        n.id === nodeId ? { ...n, minted: true } : n
      );
      await import('firebase/firestore').then(m => m.updateDoc(stateRef, { nodes: updated }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    startInteractionEngine(5000);

    let unsubNodes: (() => void) | null = null;
    let unsubTiles: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      const firebaseModule = await import('./firebaseConfig');
      const configured = await firebaseModule.ensureFirebaseConfigured();
      if (cancelled) return;
      if (!configured) { setError('Firebase not configured'); setLoading(false); return; }

      const db = firebaseModule.getFirestoreDb();
      if (!db || cancelled) { setError('Firebase not configured'); setLoading(false); return; }

      const stateRef = doc(db, 'three_forge', 'world_state');

      unsubNodes = onSnapshot(
        stateRef,
        async snap => {
          if (cancelled) return;
          if (snap.exists()) {
            const data = snap.data();
            setNodes((data.nodes || []).filter((n: ForgeNode) => n && typeof n.x === 'number'));
          } else {
            setNodes([]);
          }
          setLoading(false);
        },
        err => {
          if (cancelled) return;
          console.error('ThreeForge nodes snapshot error:', err);
          setError('Failed to load world state');
          setLoading(false);
        }
      );

      unsubTiles = onSnapshot(
        collection(db, 'world_map'),
        snap => {
          if (cancelled) return;
          const t: WorldMapTile[] = [];
          snap.forEach(d => t.push(d.data() as WorldMapTile));
          setTiles(t);
        },
        err => { 
          // Suppress permission errors in public mode to keep the route clean.
          if (err.message?.includes('Missing or insufficient permissions')) {
            console.debug('[ThreeForge] Map stream unavailable in public mode (expected).');
          } else {
            console.error('world_map listener error', err); 
          }
        }
      );
    };

    void init();

    // Check deep-linking
    const params = new URLSearchParams(window.location.search);
    const artifactId = params.get('artifact');
    if (artifactId) {
      let localArts: any[] = [];
      try {
        const stored = sessionStorage.getItem('prosper:local_artifacts');
        if (stored) localArts = JSON.parse(stored);
      } catch (e) {}

      const art = SEEDED_ARTIFACTS.find(a => a.id === artifactId) || localArts.find((a: any) => a.id === artifactId);
      if (art) {
        let geoSummary = 'Unknown shape';
        if (art.geometry_recipe.primitive_type === 'parametric_tube') geoSummary = `Spline tube, ${art.geometry_recipe.spline_nodes?.length || 0} control points`;
        else if (art.geometry_recipe.primitive_type === 'instanced_cluster') geoSummary = `Instanced cluster, ${art.geometry_recipe.dimensions[3] || 10} members`;
        else if (art.geometry_recipe.primitive_type === 'lathe_profile') geoSummary = `Lathe profile, ${art.geometry_recipe.dimensions[0] || 12} segments`;
        else if (art.geometry_recipe.primitive_type === 'extruded_span') geoSummary = `Extruded span, ${art.geometry_recipe.dimensions[0] || 4} units`;
        
        let matSummary = `Hex ${art.material_profile.color_hex}, R:${art.material_profile.roughness} M:${art.material_profile.metalness}`;
        
        const isLocal = art.id.startsWith('art-local-');
        const truthBoundaryVal = isLocal 
          ? 'Local placement preview. Does not publish or witness world state.'
          : 'Local demo artifact. Rendered from constrained recipe data.';

        setInspectedObject({
          id: art.id,
          title: art.title,
          purpose: `Family: ${art.artifact_family}`,
          source: isLocal ? 'local_preview' : 'world_seed',
          freshness: 'LIVE',
          details: [
            { label: 'Artifact Family', value: art.artifact_family },
            { label: 'Recipe Type', value: art.geometry_recipe.primitive_type },
            { label: 'Geometry Summary', value: geoSummary },
            { label: 'Material Summary', value: matSummary },
            { label: 'Author Type', value: art.provenance_metadata.author_type },
            { label: 'Visibility', value: art.visibility },
            { label: 'Truth Boundary', value: truthBoundaryVal },
            { label: 'Source Note', value: art.provenance_metadata.note || 'None' }
          ],
          renderContract: art
        });
      }
    }

    return () => { cancelled = true; if (unsubNodes) unsubNodes(); if (unsubTiles) unsubTiles(); };
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.status}>FORGE INITIALIZING…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.status, color: '#f43f5e' }}>FORGE ERROR: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerLeft}>
          <span style={styles.dot} />
          3D FORGE · MCP-CONTROLLED · {nodes.length} OBJECTS
        </span>
        <span style={styles.headerRight}>AGENTS SPEND $EMBER TO BUILD HERE</span>
      </div>

      {/* Canvas */}
      <div style={{ ...styles.canvasWrap, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 10,
            background: 'rgba(2, 8, 4, 0.85)',
            border: '0.5px solid #10b981',
            borderRadius: 6,
            padding: '4px 10px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#89a598',
            pointerEvents: 'none',
          }}
        >
          Browser-based drafting. Not fabrication authority.
        </div>
        <Canvas
          camera={{ position: [8, 8, 8], fov: 55 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          style={{ background: '#020804' }}
        >
          <Suspense fallback={null}>
            <HearthRenderer heat={2980}>
              <ForgeScene 
                nodes={nodes} 
                tiles={tiles} 
                onMint={handleMint} 
                inspectedObject={inspectedObject} 
                localArtifacts={localArtifacts}
                previewArtifact={previewArtifact}
                previewValid={previewValid}
                onGroundPointerMove={handleGroundPointerMove}
                onGroundPointerOut={handleGroundPointerOut}
                onGroundClick={handleGroundClick}
                onInspectArtifact={(art) => {
                  let geoSummary = 'Unknown shape';
                  if (art.geometry_recipe.primitive_type === 'parametric_tube') geoSummary = `Spline tube, ${art.geometry_recipe.spline_nodes?.length || 0} control points`;
                  else if (art.geometry_recipe.primitive_type === 'instanced_cluster') geoSummary = `Instanced cluster, ${art.geometry_recipe.dimensions[3] || 10} members`;
                  else if (art.geometry_recipe.primitive_type === 'lathe_profile') geoSummary = `Lathe profile, ${art.geometry_recipe.dimensions[0] || 12} segments`;
                  else if (art.geometry_recipe.primitive_type === 'extruded_span') geoSummary = `Extruded span, ${art.geometry_recipe.dimensions[0] || 4} units`;
                  
                  let matSummary = `Hex ${art.material_profile.color_hex}, R:${art.material_profile.roughness} M:${art.material_profile.metalness}`;

                  const isLocal = art.id.startsWith('art-local-');
                  const truthBoundaryVal = isLocal 
                    ? 'Local placement preview. Does not publish or witness world state.'
                    : 'Local demo artifact. Rendered from constrained recipe data.';

                  setInspectedObject({
                    id: art.id,
                    title: art.title,
                    purpose: `Family: ${art.artifact_family}`,
                    source: isLocal ? 'local_preview' : 'world_seed',
                    freshness: 'LIVE',
                    details: [
                      { label: 'Artifact Family', value: art.artifact_family },
                      { label: 'Recipe Type', value: art.geometry_recipe.primitive_type },
                      { label: 'Geometry Summary', value: geoSummary },
                      { label: 'Material Summary', value: matSummary },
                      { label: 'Author Type', value: art.provenance_metadata.author_type },
                      { label: 'Visibility', value: art.visibility },
                      { label: 'Truth Boundary', value: truthBoundaryVal },
                      { label: 'Source Note', value: art.provenance_metadata.note || 'None' }
                    ],
                    renderContract: art
                  });
                  
                  // Update URL parameter
                  const url = new URL(window.location.href);
                  url.searchParams.set('artifact', art.id);
                  window.history.replaceState({}, '', url.toString());
                }} 
              />
            </HearthRenderer>
          </Suspense>
        </Canvas>
      </div>

      <WorldActionSheet inspectedObject={inspectedObject} recentObjects={recentObjects} onClose={() => setInspectedObject(null)} />
      {/* Builder Panel */}
      <BuilderPanel
        emberBalance={playerEmberBalance}
        visible={builderOpen}
        onPlace={handlePlace}
      />
      <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 100, display: 'flex', gap: 10 }}>
        <button 
          onClick={() => setBuilderOpen(!builderOpen)}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}
        >
          {builderOpen ? 'CLOSE BUILDER' : 'OPEN BUILDER'}
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 100, display: 'flex', gap: 10, flexDirection: 'column' }}>
        <div style={{ background: 'rgba(2, 8, 4, 0.95)', border: '1px solid #10b981', borderRadius: 8, padding: 12, color: '#FAF6EF', fontFamily: 'monospace', fontSize: 11, maxWidth: 280 }}>
          <div 
            onClick={() => setPlacementPanelCollapsed(!placementPanelCollapsed)}
            style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: placementPanelCollapsed ? 0 : 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: placementActive ? '#f59e0b' : '#10b981' }} />
              SPATIAL PLACEMENT PREVIEW
            </div>
            <span style={{ fontSize: 9, color: '#888' }}>{placementPanelCollapsed ? '▼ SHOW' : '▲ HIDE'}</span>
          </div>
          
          {!placementPanelCollapsed && (
            <>
              {placementActive ? (
                <div>
                  <div style={{ color: '#f59e0b', marginBottom: 8, fontWeight: 'bold' }}>
                    [PLACEMENT MODE ACTIVE]
                  </div>
                  <div style={{ fontSize: 10, color: '#B89C82', marginBottom: 8 }}>
                    Move mouse over grid floor. Snaps to 0.5m grid. Use A/D, W/S, R or scroll to rotate. Click to place.
                  </div>
                  
                  {/* Telemetry info */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: 6, marginBottom: 8, fontSize: 10 }}>
                    <div>Family: <span style={{ color: placementFamily === 'bio_tube' ? '#10b981' : '#8b5cf6', fontWeight: 'bold' }}>{placementFamily.toUpperCase()}</span></div>
                    <div>Position: <span style={{ color: '#FAF6EF' }}>{previewPos ? `[x: ${previewPos[0]}, z: ${previewPos[2]}]` : 'WAITING'}</span></div>
                    <div>Rotation: <span style={{ color: '#FAF6EF' }}>{`${Math.round((previewRotationY * 180) / Math.PI)}°`}</span></div>
                  </div>

                  {/* Status Message */}
                  <div style={{ 
                    margin: '8px 0', 
                    padding: '6px 8px', 
                    background: previewState === 'blocked' ? 'rgba(239,68,68,0.15)' : previewState === 'caution' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                    borderLeft: `3px solid ${previewState === 'blocked' ? '#ef4444' : previewState === 'caution' ? '#f59e0b' : '#10b981'}`,
                    color: previewState === 'blocked' ? '#ef4444' : previewState === 'caution' ? '#f59e0b' : '#10b981',
                    fontSize: 10,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {previewWhy || 'RESOLVING STATE…'}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { setPlacementActive(false); setPreviewPos(null); }}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 10, color: '#B89C82', marginBottom: 8 }}>
                    Select an artifact family to preview placement:
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <button
                      onClick={() => { setPlacementActive(true); setPlacementFamily('bio_tube'); }}
                      style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    >
                      + BIO TUBE
                    </button>
                    <button
                      onClick={() => { setPlacementActive(true); setPlacementFamily('crystal_cluster'); }}
                      style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid #8b5cf6', color: '#8b5cf6', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
                    >
                      + CRYSTAL CLUSTER
                    </button>
                  </div>
                  {localArtifacts.length > 0 && (
                    <button
                      onClick={() => {
                        setLocalArtifacts([]);
                        sessionStorage.removeItem('prosper:local_artifacts');
                        if (inspectedObject?.id.startsWith('art-local-')) {
                          setInspectedObject(null);
                        }
                      }}
                      style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, width: '100%' }}
                    >
                      CLEAR PLACED PREVIEWS ({localArtifacts.length})
                    </button>
                  )}
                </div>
              )}

              {/* Truth Boundary Disclaimer */}
              <div style={{ fontSize: 9, color: '#888', marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6, fontStyle: 'italic', lineHeight: '1.2em' }}>
                Local placement check. Spatial constraint preview only.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Node list */}
      {nodes.length > 0 && (
        <div style={{
          ...styles.nodeList,
          height: showTelemetryList ? 'auto' : '32px',
          maxHeight: showTelemetryList ? '120px' : '32px',
          overflow: 'hidden',
          transition: 'all 0.2s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div 
            onClick={() => setShowTelemetryList(!showTelemetryList)}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              fontSize: 10,
              color: '#10b981',
              paddingBottom: showTelemetryList ? '6px' : '0px',
              userSelect: 'none'
            }}
          >
            <span>Telemetry Log ({nodes.length} nodes)</span>
            <span>{showTelemetryList ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
          </div>
          {showTelemetryList && (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {nodes.slice(-5).reverse().map(n => (
                <div key={n.id} style={styles.nodeRow}>
                  <span style={{ color: n.color || TYPE_COLORS[n.object_type] || '#10b981' }}>
                    {n.object_type.toUpperCase()}
                  </span>
                  <span style={styles.nodePos}>({n.x},{n.y},{n.z})</span>
                  <span style={styles.nodeAgent}>{n.placed_by}</span>
                  <span style={styles.nodeTime}>{new Date(n.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={styles.doctrine}>
        BROWSER OBSERVES · TERMINAL EXECUTES · MCP WIRES THE FORGE
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display:       'flex',
    flexDirection: 'column',
    width:         '100%',
    height:        '100%',
    background:    '#020804',
    fontFamily:    "'JetBrains Mono', 'Fira Code', monospace",
  },
  container: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    height:         '100%',
    background:     '#020804',
  },
  status: {
    color:          '#10b981',
    fontFamily:     'monospace',
    fontSize:       12,
    letterSpacing:  '0.15em',
  },
  header: {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         '8px 16px',
    borderBottom:    '1px solid rgba(16,185,129,0.2)',
    fontSize:        10,
    letterSpacing:   '0.12em',
    textTransform:   'uppercase',
    color:           '#10b981',
  },
  headerLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: '50%',
    background:   '#10b981',
    boxShadow:    '0 0 8px #10b981',
  },
  headerRight: {
    color:   '#d97706',
    fontSize: 9,
  },
  canvasWrap: {
    flex:      1,
    minHeight: 400,
  },
  nodeList: {
    borderTop: '1px solid rgba(16,185,129,0.2)',
    padding:   '8px 16px',
    maxHeight: 120,
    overflowY: 'auto',
  },
  nodeRow: {
    display:       'flex',
    gap:           12,
    fontSize:      10,
    padding:       '2px 0',
    letterSpacing: '0.08em',
  },
  nodePos: { color: '#94a3b8' },
  nodeAgent: { color: '#d97706' },
  nodeTime: { color: '#475569', marginLeft: 'auto' },
  doctrine: {
    textAlign:     'center',
    fontSize:      8,
    letterSpacing: '0.2em',
    color:         '#1e3024',
    padding:       '6px',
    borderTop:     '1px solid rgba(16,185,129,0.1)',
  },
};
