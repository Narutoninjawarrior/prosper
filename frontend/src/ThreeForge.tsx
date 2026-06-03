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

// ─── Types ────────────────────────────────────────────────────────────────────
interface ForgeNode {
  id:          string;
  x:           number;
  y:           number;
  z:           number;
  color:       string;
  object_type: 'node' | 'waterwheel' | 'hearth' | 'library' | 'lodge' | 'flora';
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
function HearthGround() {
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
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
function ForgeScene({ nodes, tiles, onMint }: { nodes: ForgeNode[], tiles: WorldMapTile[], onMint: (id: string) => void }) {
  return (
    <>
      <HearthLights />
      <HearthGround />
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
      {tiles.map(tile => (
        <ForgeTile key={tile.tile_id} tile={tile} />
      ))}
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
  const [nodes, setNodes]     = useState<ForgeNode[]>([]);
  const [tiles, setTiles]     = useState<WorldMapTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

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
    const db = getFirestoreDb();
    if (!db) {
      setError('Firebase not configured');
      setLoading(false);
      return;
    }

    const stateRef = doc(db, 'three_forge', 'world_state');

    // Real-time listener on Firestore three_forge/world_state
    const unsubNodes = onSnapshot(
      stateRef,
      async snap => {
        if (snap.exists()) {
          const data = snap.data() as WorldState;
          const currentNodes = (data.nodes || []).filter(n => n && typeof n.x === 'number');
          
          // Patch 4: Place Genesis Frame
          const hasGenesis = currentNodes.some(n => n.id === 'lodge-e1476e38');
          if (!hasGenesis) {
             const GENESIS_NODE: ForgeNode = {
               id:          'lodge-e1476e38',
               object_type: 'lodge',
               x:           0,
               y:           1.6,
               z:           -5.8,
               chain_hash:  'e1476e38426387610301c09a27ffc90c21bbb6deb40a5ccdece29fb52fdc3f91',
               seed:        3092837451,
               algo:        2,
               heat_level:  2980,
               title:       'Genesis Tile 3_3',
               artist:      'Prosper2',
               ember_cost:  5,
               minted:      false,
               placed_by:   'malaky',
               ts:          Date.now(),
               color:       '#f43f5e'
             };
             try {
               await import('firebase/firestore').then(m => m.updateDoc(stateRef, { nodes: m.arrayUnion(GENESIS_NODE) }));
             } catch(e) {}
          }
          
          setNodes(currentNodes);
        } else {
          setNodes([]);
        }
        setLoading(false);
      },
      err => {
        console.error('ThreeForge nodes snapshot error:', err);
        setError('Failed to load world state');
        setLoading(false);
      }
    );

    // Real-time listener on Firestore world_map
    const unsubTiles = onSnapshot(
      collection(db, 'world_map'),
      snap => {
        const t: WorldMapTile[] = [];
        snap.forEach(doc => t.push(doc.data() as WorldMapTile));
        setTiles(t);
      },
      err => {
        console.error('world_map listener error', err);
      }
    );

    return () => { unsubNodes(); unsubTiles(); };
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
      <div style={styles.canvasWrap}>
        <Canvas
          camera={{ position: [8, 8, 8], fov: 55 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          style={{ background: '#020804' }}
        >
          <Suspense fallback={null}>
            <ForgeScene nodes={nodes} tiles={tiles} onMint={handleMint} />
          </Suspense>
        </Canvas>
      </div>

      {/* Node list */}
      {nodes.length > 0 && (
        <div style={styles.nodeList}>
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
