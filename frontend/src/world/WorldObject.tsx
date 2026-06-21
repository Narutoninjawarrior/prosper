import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFrame } from '@react-three/fiber';
import { Html, Float, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { cloudFunctionUrl } from '../lib/hearthApi';
import { X, RefreshCw, GitCommit, Thermometer, Droplet, ArrowRight, Activity, Sun } from 'lucide-react';

// ── DATA INTERFACES ────────────────────────────────────────────────
interface RainBarrelData {
  treasury_balance: number;
  inflow_24h: number;
  outflow_24h: number;
  water_level_pct: number;
  sustainability_ratio: number;
  lowest_ever: { balance: number; date: string };
}

interface GitCommitInfo {
  repo: string;
  author: string;
  message: string;
  additions: number;
  deletions: number;
  timestamp: string;
  ponytail_score: number;
}

interface TidePoolData {
  tide_level: string;
  recent_commits: GitCommitInfo[];
  ponytail_ratio: number;
  last_activity: string;
}

interface CompostItem {
  item: string;
  type: string;
  retired_date: string;
  reason: string;
  what_grew: string;
  upgrade_path?: string;
}

interface CompostHeapData {
  compost_temperature: number;
  items: CompostItem[];
}

interface QuakeInfo {
  place: string;
  magnitude: number;
  depth_km: number;
  time: string;
  tsunami_flag: boolean;
  felt_reports: number;
}

interface SeismographData {
  recent_quakes: QuakeInfo[];
  strongest_24h: { place: string; magnitude: number };
  stability_index: string;
  quake_count_24h: number;
}

interface StarLanternData {
  title: string;
  explanation: string;
  image_url: string;
  media_type: string;
  date: string;
  copyright: string | null;
}

interface SundialData {
  cloud_cover_pct: number;
  solar_estimate: string;
  sunrise: string;
  sunset: string;
  daylight_hours: number;
  temperature_c: number;
  weather_desc: string;
  ember_generation_modifier: number;
}

type WorldObjectData = RainBarrelData | TidePoolData | CompostHeapData | SeismographData | StarLanternData | SundialData;


// ── SUB-MESH: Rain Barrel ──────────────────────────────────────────
function RainBarrelMesh({ waterLevel = 50 }: { waterLevel?: number }) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      const wave = Math.sin(clock.elapsedTime * 1.5) * 0.015;
      waterRef.current.scale.y = (waterLevel / 100) + wave;
    }
  });

  return (
    <group>
      {/* Outer wooden barrel */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 1.2, 16]} />
        <meshStandardMaterial color="#5C3D1E" roughness={0.8} />
      </mesh>
      {/* Metal bands */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.57, 0.57, 0.06, 16]} />
        <meshStandardMaterial color="#8E7E6B" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.06, 16]} />
        <meshStandardMaterial color="#8E7E6B" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Blue water inside */}
      <mesh ref={waterRef} position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 16]} />
        <meshStandardMaterial color="#4A90D9" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Spout */}
      <mesh position={[0, 0.4, 0.65]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
        <meshStandardMaterial color="#D4A853" metalness={0.8} />
      </mesh>
    </group>
  );
}

// ── SUB-MESH: Tide Pool ────────────────────────────────────────────
function TidePoolMesh() {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      waterRef.current.position.y = 0.06 + Math.sin(clock.elapsedTime * 0.7) * 0.008;
    }
  });

  return (
    <group>
      {/* Rock rim */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[1.3, 1.5, 0.1, 16]} />
        <meshStandardMaterial color="#4E4E4E" roughness={0.9} />
      </mesh>
      {/* Pool water */}
      <mesh ref={waterRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 16]} />
        <meshStandardMaterial color="#34D399" emissive="#1A3F33" emissiveIntensity={0.4} roughness={0.1} transparent opacity={0.8} />
      </mesh>
      {/* Floating particles */}
      <Float speed={2} floatIntensity={0.4} floatingRange={[0.1, 0.25]}>
        <Sphere args={[0.08, 8, 8]} position={[-0.3, 0.15, -0.3]}>
          <meshBasicMaterial color="#34D399" />
        </Sphere>
      </Float>
      <Float speed={1.5} floatIntensity={0.5} floatingRange={[0.12, 0.3]}>
        <Sphere args={[0.06, 8, 8]} position={[0.4, 0.2, 0.2]}>
          <meshBasicMaterial color="#D4A853" />
        </Sphere>
      </Float>
      <Float speed={2.5} floatIntensity={0.3} floatingRange={[0.08, 0.22]}>
        <Sphere args={[0.09, 8, 8]} position={[-0.1, 0.12, 0.4]}>
          <meshBasicMaterial color="#4A90D9" />
        </Sphere>
      </Float>
    </group>
  );
}

// ── SUB-MESH: Compost Heap ─────────────────────────────────────────
function CompostHeapMesh() {
  return (
    <group>
      {/* Mound */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.1, 0.6, 12]} />
        <meshStandardMaterial color="#3D2314" roughness={0.9} />
      </mesh>
      {/* Fungi */}
      <Sphere args={[0.12, 6, 6]} position={[0.3, 0.4, 0.3]}>
        <meshStandardMaterial color="#8E7E6B" roughness={0.2} />
      </Sphere>
      <Sphere args={[0.08, 6, 6]} position={[-0.4, 0.28, -0.2]}>
        <meshStandardMaterial color="#E8842A" roughness={0.2} />
      </Sphere>
      {/* Rising steam */}
      <Float speed={3} floatIntensity={0.6} floatingRange={[0.15, 0.45]}>
        <Sphere args={[0.04, 4, 4]} position={[0, 0.45, 0]}>
          <meshBasicMaterial color="#AA88FF" transparent opacity={0.5} />
        </Sphere>
      </Float>
      <Float speed={2} floatIntensity={0.4} floatingRange={[0.2, 0.5]}>
        <Sphere args={[0.03, 4, 4]} position={[0.15, 0.4, -0.15]}>
          <meshBasicMaterial color="#86efac" transparent opacity={0.4} />
        </Sphere>
      </Float>
    </group>
  );
}

// ── SUB-MESH: Seismograph Stone ────────────────────────────────────
function SeismographStoneMesh({ strongestMag = 4.0 }: { strongestMag?: number }) {
  const meshRef = useRef<THREE.Group>(null);
  const isViolent = strongestMag >= 5.0;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      if (isViolent) {
        // Jitter vibrating motion
        const t = clock.getElapsedTime() * 45;
        meshRef.current.position.x = Math.sin(t) * 0.002;
        meshRef.current.position.z = Math.cos(t * 0.8) * 0.002;
      } else {
        meshRef.current.position.x = 0;
        meshRef.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={meshRef}>
      {/* Base Tablet */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.1, 0.1]} />
        <meshStandardMaterial color="#333330" roughness={0.9} />
      </mesh>
      {/* Inlaid metallic runes / cracks */}
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshStandardMaterial 
          color={isViolent ? "#EF4444" : "#D4A853"} 
          emissive={isViolent ? "#EF4444" : "#D4A853"} 
          emissiveIntensity={isViolent ? 1.5 : 0.4} 
          roughness={0.2} 
        />
      </mesh>
    </group>
  );
}

// ── SUB-MESH: Star Lantern ─────────────────────────────────────────
function StarLanternMesh() {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(t * (2 * Math.PI / 3)) * 0.05; // period 3s
      meshRef.current.rotation.y = t * 0.1; // 0.1 rad/sec
    }
  });

  return (
    <group ref={meshRef}>
      {/* Floating Dodecahedron */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial 
          color="#FBBF24" 
          emissive="#D4A853" 
          emissiveIntensity={1.0} 
          roughness={0.1} 
          metalness={0.9}
        />
      </mesh>
      {/* Sparkles */}
      <Float speed={2.5} floatIntensity={0.6} floatingRange={[0.2, 0.8]}>
        <Sphere args={[0.03, 4, 4]} position={[-0.2, 0.6, 0.2]}>
          <meshBasicMaterial color="#FAF6EF" />
        </Sphere>
      </Float>
      <Float speed={1.8} floatIntensity={0.4} floatingRange={[0.1, 0.7]}>
        <Sphere args={[0.02, 4, 4]} position={[0.25, 0.4, -0.2]}>
          <meshBasicMaterial color="#FBBF24" />
        </Sphere>
      </Float>
    </group>
  );
}

// ── SUB-MESH: Solar Sundial ────────────────────────────────────────
function SolarSundialMesh({ estimate = 'moderate' }: { estimate?: string }) {
  const getSundialColor = () => {
    if (estimate === 'high') return { color: '#FBBF24', emissive: '#FBBF24', intensity: 1.2 };
    if (estimate === 'low') return { color: '#6B7280', emissive: '#374151', intensity: 0.2 };
    if (estimate === 'night') return { color: '#1F2937', emissive: '#111827', intensity: 0.05 };
    return { color: '#F59E0B', emissive: '#D97706', intensity: 0.6 }; // moderate
  };

  const current = getSundialColor();

  return (
    <group>
      {/* Base ring */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.1, 16]} />
        <meshStandardMaterial color="#8E7E6B" roughness={0.7} />
      </mesh>
      {/* Crystalline Gnomon */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <coneGeometry args={[0.18, 1.0, 6]} />
        <meshStandardMaterial 
          color={current.color} 
          emissive={current.emissive} 
          emissiveIntensity={current.intensity} 
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </group>
  );
}


// ── MAIN EXPORT COMPONENT ──────────────────────────────────────────
interface WorldObjectProps {
  objectId: 'rain-barrel' | 'tide-pool' | 'compost-heap' | 'seismograph' | 'star-lantern' | 'sundial';
  position: [number, number, number];
  autoOpen?: boolean;
  onClose?: () => void;
}

export default function WorldObject({ objectId, position, autoOpen = false, onClose }: WorldObjectProps) {
  const [hovered, setHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<WorldObjectData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanationExpanded, setExplanationExpanded] = useState(false);

  const fetchObjectData = async () => {
    setLoading(true);
    setError(null);

    const urls = [
      `/api/world/${objectId}`,
      `${cloudFunctionUrl('worldObject')}?object_id=${objectId}`
    ];
    let lastError = 'Failed to load';

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setData(json.data as WorldObjectData);
          setLoading(false);
          return;
        }
        lastError = `Status ${res.status}`;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Network error';
      }
    }
    setError(lastError);
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setExplanationExpanded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoOpen && !isOpen) {
      setIsOpen(true);
      fetchObjectData();
    }
  }, [autoOpen, isOpen]);

  const handleInteract = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setIsOpen(true);
    fetchObjectData();
  };

  // Set visual theme colors based on object type
  const getThemeColor = () => {
    if (objectId === 'rain-barrel') return '#4A90D9';
    if (objectId === 'tide-pool') return '#34D399';
    if (objectId === 'compost-heap') return '#86EFAC';
    if (objectId === 'seismograph') return '#EF4444';
    if (objectId === 'star-lantern') return '#FBBF24';
    return '#F59E0B'; // sundial
  };

  const color = getThemeColor();

  const barrelData = data as RainBarrelData;
  const poolData = data as TidePoolData;
  const heapData = data as CompostHeapData;
  const seismographData = data as SeismographData;
  const lanternData = data as StarLanternData;
  const sundialData = data as SundialData;

  return (
    <group position={position}>
      {/* Interactable mesh mapping */}
      <group
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        onClick={handleInteract}
      >
        {objectId === 'rain-barrel' && <RainBarrelMesh waterLevel={barrelData?.water_level_pct || 68} />}
        {objectId === 'tide-pool' && <TidePoolMesh />}
        {objectId === 'compost-heap' && <CompostHeapMesh />}
        {objectId === 'seismograph' && <SeismographStoneMesh strongestMag={seismographData?.strongest_24h?.magnitude || 4.0} />}
        {objectId === 'star-lantern' && <StarLanternMesh />}
        {objectId === 'sundial' && <SolarSundialMesh estimate={sundialData?.solar_estimate || 'moderate'} />}
      </group>

      {/* Floating hover label */}
      {hovered && (
        <Html position={[0, 1.4, 0]} center>
          <div style={{
            background: 'rgba(10,6,4,0.95)',
            border: `1px solid ${color}55`,
            boxShadow: `0 0 10px ${color}22`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#FAF6EF',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {objectId === 'rain-barrel' && 'Rain Barrel (Treasury)'}
            {objectId === 'tide-pool' && 'Tide Pool (Git Activity)'}
            {objectId === 'compost-heap' && 'Compost Heap (Retired Code)'}
            {objectId === 'seismograph' && 'Seismograph Stone (Earth Pulse)'}
            {objectId === 'star-lantern' && 'Star Lantern (APOD)'}
            {objectId === 'sundial' && 'Solar Sundial (Solar Oracle)'}
          </div>
        </Html>
      )}

      {/* Slider / Modal Card InfoPanel */}
      {isOpen && (
        <Html>
          {createPortal(
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm z-50">
          <div className="relative w-full max-w-lg bg-black/75 border border-white/10 backdrop-blur-xl p-6 rounded-[24px] text-[#FAF6EF] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <h2 className="text-lg font-semibold tracking-wide text-white capitalize">
                  {objectId.replace('-', ' ')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchObjectData}
                  className="p-1.5 rounded-full border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition"
                  title="Refresh Data"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    onClose?.();
                  }}
                  className="p-1.5 rounded-full border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Loader */}
            {loading && (
              <div className="py-12 text-center text-xs text-[#8E7E6B] font-mono">
                Querying planetary API...
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="py-8 text-center">
                <div className="text-xs text-red-400 font-mono">Failed to fetch object status:</div>
                <div className="mt-1 text-[11px] text-[#8E7E6B] font-mono">{error}</div>
                <button
                  onClick={fetchObjectData}
                  className="mt-4 px-4 py-1.5 border border-red-500/30 bg-red-500/5 rounded-xl text-xs font-mono text-red-300 hover:bg-red-500/10 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Content Panel */}
            {!loading && !error && data && (
              <div className="mt-4 font-mono text-xs text-[#c9bba5] space-y-4">

                {/* Object 1: Rain Barrel details */}
                {objectId === 'rain-barrel' && barrelData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      A wooden barrel with a glass window showing the EMBER water level. Rain falls in during active work. Water drains when EMBER is spent.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl">
                        <div className="text-[10px] uppercase text-[#8E7E6B] tracking-wider flex items-center gap-1.5">
                          <Droplet size={11} className="text-[#4A90D9]" />
                          Ember Level
                        </div>
                        <div className="text-xl font-semibold text-white mt-1">
                          {barrelData.water_level_pct}%
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl">
                        <div className="text-[10px] uppercase text-[#8E7E6B] tracking-wider">Treasury Balance</div>
                        <div className="text-xl font-semibold text-white mt-1">
                          ⬡ {barrelData.treasury_balance} EMBER
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/3 border border-white/5 p-4 rounded-xl space-y-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#8E7E6B]">Inflow (24h)</span>
                        <span className="text-[#34D399] font-medium">+{barrelData.inflow_24h} EMBER</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E7E6B]">Outflow (24h)</span>
                        <span className="text-red-400 font-medium">-{barrelData.outflow_24h} EMBER</span>
                      </div>
                      <div className="border-t border-white/5 pt-2 flex justify-between">
                        <span className="text-[#8E7E6B]">Sustainability Ratio</span>
                        <span className="text-white font-medium">{barrelData.sustainability_ratio}x</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Object 2: Tide Pool details */}
                {objectId === 'tide-pool' && poolData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Bioluminescent ripples driven by Git commit flows across prosperity repos. Tide level represents activity depth.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Tide Level</div>
                        <div className="text-sm font-semibold text-white mt-1 uppercase" style={{ color }}>
                          {poolData.tide_level}
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Ponytail Ratio</div>
                        <div className="text-sm font-semibold text-white mt-1">
                          {poolData.ponytail_ratio}
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Last Signal</div>
                        <div className="text-sm font-semibold text-[#8E7E6B] mt-1 capitalize">
                          {poolData.last_activity}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/3 border border-white/5 p-3 rounded-xl space-y-2">
                      <div className="text-[10px] uppercase text-[#8E7E6B] tracking-wider mb-2 flex items-center gap-1.5">
                        <GitCommit size={11} className="text-[#34D399]" />
                        Recent Commits
                      </div>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {poolData.recent_commits?.map((commit, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between text-[10px]">
                              <span className="font-semibold text-[#34D399]">{commit.repo}</span>
                              <span className="text-[#8E7E6B]">{new Date(commit.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="text-white text-[11px] truncate">{commit.message}</div>
                            <div className="text-[9px] text-[#8E7E6B]">
                              by {commit.author} · +{commit.additions}/-{commit.deletions} · ponytail: {commit.ponytail_score}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Object 3: Compost Heap details */}
                {objectId === 'compost-heap' && heapData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Steaming mulch covered in mushrooms near the edge. Contains retired endpoints, deprecated functions, and deleted features.
                    </p>
                    <div className="bg-white/4 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-[#8E7E6B] flex items-center gap-1.5">
                        <Thermometer size={12} className="text-[#86EFAC]" />
                        Compost Temperature
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {heapData.compost_temperature}°C (Steaming)
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {heapData.items?.map((item, idx) => (
                        <div key={idx} className="bg-white/3 border border-white/5 p-3 rounded-xl flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-white">{item.item}</span>
                            <span className="text-[10px] text-[#8E7E6B] bg-[#86EFAC]/10 px-1.5 py-0.5 rounded border border-[#86EFAC]/20 uppercase">
                              {item.type}
                            </span>
                          </div>
                          <div className="text-[10px] text-red-400/80 mt-0.5">Retired: {item.retired_date} · {item.reason}</div>
                          <div className="text-[11px] text-[#c9bba5] mt-1">🌱 What grew: {item.what_grew}</div>
                          {item.upgrade_path && (
                            <div className="text-[10px] text-[#8eefac] flex items-center gap-1 mt-0.5">
                              <ArrowRight size={10} />
                              Upgrade: {item.upgrade_path}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* OBJECT 4: Seismograph details */}
                {objectId === 'seismograph' && seismographData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Connected to the USGS Earthquake Hazards API. The stone resonates with real-time global tectonic shifts.
                    </p>
                    
                    <div className="bg-white/3 border border-white/5 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[#8E7E6B] flex items-center gap-1.5">
                          <Activity size={12} className="text-[#EF4444]" />
                          Tectonic Index
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded uppercase border"
                              style={{ 
                                color, 
                                borderColor: `${color}40`, 
                                backgroundColor: `${color}10` 
                              }}>
                          {seismographData.stability_index}
                        </span>
                      </div>
                      <div className="text-[11px] text-white italic">
                        {seismographData.stability_index === 'steady' && `The earth beneath the Hearthlands is steady today (${seismographData.quake_count_24h} minor tremors).`}
                        {seismographData.stability_index === 'restless' && `The earth is restless — ${seismographData.quake_count_24h} tremors witnessed in the last 24 hours.`}
                        {seismographData.stability_index === 'turbulent' && `The earth is turbulent! ${seismographData.quake_count_24h} significant tremors recorded.`}
                        {seismographData.stability_index === 'unknown' && "Signals from the seismograph stone are fading."}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Strongest (24h)</div>
                        <div className="text-xs font-semibold text-white mt-1 truncate">
                          M{seismographData.strongest_24h?.magnitude} · {seismographData.strongest_24h?.place}
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Total Tremors (24h)</div>
                        <div className="text-xs font-semibold text-white mt-1">
                          {seismographData.quake_count_24h} events (M &gt;= 4.0)
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/3 border border-white/5 p-3 rounded-xl space-y-2">
                      <div className="text-[10px] uppercase text-[#8E7E6B] tracking-wider mb-1">Recent Tremors</div>
                      <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1 text-[11px]">
                        {seismographData.recent_quakes?.map((quake, idx) => (
                          <div key={idx} className="flex justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-white truncate max-w-[240px]">{quake.place}</span>
                              <span className="text-[9px] text-[#8E7E6B]">Depth: {quake.depth_km}km · {new Date(quake.time).toLocaleTimeString()}</span>
                            </div>
                            <span className="font-semibold text-right" style={{ color: quake.magnitude >= 5.0 ? '#EF4444' : '#FAF6EF' }}>
                              M{quake.magnitude}
                            </span>
                          </div>
                        ))}
                        {(!seismographData.recent_quakes || seismographData.recent_quakes.length === 0) && (
                          <div className="text-center py-4 text-[#8E7E6B] italic">No tectonic events recorded.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* OBJECT 5: Star Lantern details */}
                {objectId === 'star-lantern' && lanternData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Connected to the NASA Astronomy Picture of the Day. Renders a window into the wider universe.
                    </p>

                    {lanternData.image_url && lanternData.media_type === 'image' && (
                      <div className="flex justify-center border border-white/10 rounded-xl overflow-hidden bg-black/40">
                        <img 
                          src={lanternData.image_url} 
                          alt={lanternData.title} 
                          className="max-w-full max-h-[180px] object-contain"
                        />
                      </div>
                    )}

                    <div className="bg-white/3 border border-white/5 p-3 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-[#8E7E6B]">
                        <span>NASA APOD · {lanternData.date}</span>
                        {lanternData.copyright && <span className="max-w-[150px] truncate">© {lanternData.copyright}</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-white mt-1">{lanternData.title}</h3>
                      
                      <p className="text-[11px] leading-relaxed mt-2 text-[#c9bba5]">
                        {explanationExpanded 
                          ? lanternData.explanation 
                          : `${lanternData.explanation?.slice(0, 200) || ''}...`}
                        {lanternData.explanation && lanternData.explanation.length > 200 && (
                          <button 
                            onClick={() => setExplanationExpanded(!explanationExpanded)}
                            className="ml-1 text-[#FBBF24] hover:underline"
                          >
                            {explanationExpanded ? 'Read less' : 'Read more'}
                          </button>
                        )}
                      </p>
                    </div>
                  </>
                )}

                {/* OBJECT 6: Sundial details */}
                {objectId === 'sundial' && sundialData && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Connects to local OpenWeather telemetry. Monitors atmospheric cloud cover and solar output.
                    </p>

                    <div className="bg-white/3 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                      <span className="text-[#8E7E6B] flex items-center gap-1.5">
                        <Sun size={12} className="text-[#F59E0B]" />
                        Solar Harvest Modifier
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Solar Harvest: {sundialData.ember_generation_modifier >= 1.0 ? `+${Math.round((sundialData.ember_generation_modifier - 1.0) * 100)}%` : `-${Math.round((1.0 - sundialData.ember_generation_modifier) * 100)}%`}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Solar Oracle</div>
                        <div className="text-xs font-semibold text-white mt-1 uppercase" style={{ color }}>
                          {sundialData.solar_estimate}
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Cloud Cover</div>
                        <div className="text-xs font-semibold text-white mt-1">
                          {sundialData.cloud_cover_pct}%
                        </div>
                      </div>
                      <div className="bg-white/4 border border-white/5 p-3 rounded-xl text-center">
                        <div className="text-[9px] uppercase text-[#8E7E6B]">Temperature</div>
                        <div className="text-xs font-semibold text-white mt-1">
                          {sundialData.temperature_c}°C
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/3 border border-white/5 p-4 rounded-xl space-y-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#8E7E6B]">Sunrise</span>
                        <span className="text-white font-medium">{sundialData.sunrise}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E7E6B]">Sunset</span>
                        <span className="text-white font-medium">{sundialData.sunset}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E7E6B]">Daylight Hours</span>
                        <span className="text-white font-medium">{sundialData.daylight_hours}h</span>
                      </div>
                      <div className="border-t border-white/5 pt-2 flex justify-between">
                        <span className="text-[#8E7E6B]">Conditions</span>
                        <span className="text-white font-medium capitalize">{sundialData.weather_desc}</span>
                      </div>
                    </div>

                    <div className="text-[11px] italic text-[#8E7E6B] text-center mt-2">
                      {sundialData.solar_estimate === 'high' && "The sun pours gold onto the Hearthlands today."}
                      {sundialData.solar_estimate === 'moderate' && "Ambient daylight filters through steady skies."}
                      {sundialData.solar_estimate === 'low' && "Grey skies dampen the harvest."}
                      {sundialData.solar_estimate === 'night' && "The sundial rests under the stars."}
                    </div>
                  </>
                )}

              </div>
            )}
          </div>
            </div>,
            document.body
          )}
        </Html>
      )}
    </group>
  );
}
