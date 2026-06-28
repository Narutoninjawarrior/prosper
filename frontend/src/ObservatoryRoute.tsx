import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, Text } from '@react-three/drei';
// @ts-ignore
import HearthRenderer from './HearthRenderer';
import WorldObject from './world/WorldObject';
import { SomaticParticleBackground } from './SomaticParticleBackground';

const ORACLES: Array<{
  id: 'rain-barrel' | 'tide-pool' | 'compost-heap' | 'seismograph' | 'star-lantern' | 'sundial' | 'seed-vault' | 'steward-log' | 'inspiration-forge' | 'somatic-sensor';
  label: string;
  subtitle: string;
  position: [number, number, number];
  labelOffset: [number, number, number];
}> = [
  {
    id: 'rain-barrel',
    label: 'Rain Barrel',
    subtitle: 'Treasury telemetry',
    position: [-7, 0, -1],
    labelOffset: [0, 2.1, 0],
  },
  {
    id: 'tide-pool',
    label: 'Tide Pool',
    subtitle: 'Git activity pulse',
    position: [-2.5, 0, 1.8],
    labelOffset: [0, 1.8, 0],
  },
  {
    id: 'sundial',
    label: 'Solar Sundial',
    subtitle: 'Weather and solar yield',
    position: [2.6, 0, 1.8],
    labelOffset: [0, 1.9, 0],
  },
  {
    id: 'seismograph',
    label: 'Seismograph Stone',
    subtitle: 'Earth pulse',
    position: [7, 0, -1],
    labelOffset: [0, 1.9, 0],
  },
  {
    id: 'compost-heap',
    label: 'Compost Heap',
    subtitle: 'Retired code, witnessed',
    position: [-4.5, 0, -5.8],
    labelOffset: [0, 1.8, 0],
  },
  {
    id: 'star-lantern',
    label: 'Star Lantern',
    subtitle: 'Daily cosmic wonder',
    position: [0, 2.8, -7.4],
    labelOffset: [0, 1.4, 0],
  },
  {
    id: 'seed-vault',
    label: 'Seed Vault',
    subtitle: 'Living skills registry',
    position: [4.5, 0, -5.8],
    labelOffset: [0, 1.8, 0],
  },
  {
    id: 'steward-log',
    label: 'Steward Log',
    subtitle: 'Nightly automation pulse',
    position: [0, 1.2, -3.5],
    labelOffset: [0, 1.6, 0],
  },
  {
    id: 'inspiration-forge',
    label: 'The Forge',
    subtitle: 'Inspiration context packet',
    position: [0, 0, 0],
    labelOffset: [0, 1.6, 0],
  },
  {
    id: 'somatic-sensor',
    label: 'Somatic Sensor',
    subtitle: 'Collective valence emotensor',
    position: [-3.5, 1.0, 4.5],
    labelOffset: [0, 1.8, 0],
  }
];

function ObservatoryLabels() {
  return (
    <>
      {ORACLES.map((oracle) => (
        <group key={`label-${oracle.id}`} position={oracle.position}>
          <Text
            position={oracle.labelOffset}
            fontSize={0.24}
            color="#EADFCB"
            anchorX="center"
            anchorY="middle"
          >
            {oracle.label}
          </Text>
          <Text
            position={[oracle.labelOffset[0], oracle.labelOffset[1] - 0.38, oracle.labelOffset[2]]}
            fontSize={0.12}
            color="#9B8A76"
            anchorX="center"
            anchorY="middle"
          >
            {oracle.subtitle}
          </Text>
        </group>
      ))}
    </>
  );
}

export default function ObservatoryRoute() {
  const [selectedOracle, setSelectedOracle] = useState<string | null>(null);
  const [compactUi, setCompactUi] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showDirectory, setShowDirectory] = useState(true);

  useEffect(() => {
    const syncLayout = () => {
      setCompactUi(window.innerWidth < 960);
    };

    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  return (
    <div className="relative h-full w-full bg-[#050806] overflow-hidden">
      <SomaticParticleBackground theta={0.82} />
      <Canvas camera={{ position: [0, 6.5, 15], fov: 42, near: 0.1, far: 120 }} shadows>
        <HearthRenderer heat={2980}>
          <ObservatoryLabels />
          {ORACLES.map((oracle, i) => (
            <WorldObject
              key={oracle.id}
              objectId={oracle.id}
              position={oracle.position}
              autoOpen={selectedOracle === oracle.id}
              onClose={() => setSelectedOracle((current) => (current === oracle.id ? null : current))}
              onPrev={() => setSelectedOracle(ORACLES[(i - 1 + ORACLES.length) % ORACLES.length].id)}
              onNext={() => setSelectedOracle(ORACLES[(i + 1) % ORACLES.length].id)}
            />
          ))}
        </HearthRenderer>

        <OrbitControls
          makeDefault
          target={[0, 1.6, -1.8]}
          enablePan={false}
          minDistance={8}
          maxDistance={24}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.15}
        />

        <Html fullscreen>
          <div className="absolute inset-x-0 top-4 z-20 px-3 sm:top-6 sm:px-6">
            <div className="pointer-events-auto mb-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowIntro((current) => !current)}
                className="rounded-full border border-[#D4A853]/30 bg-black/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#EADFCB] backdrop-blur-md"
              >
                {showIntro ? 'Hide Brief' : 'Show Brief'}
              </button>
              <button
                type="button"
                onClick={() => setShowDirectory((current) => !current)}
                className="rounded-full border border-[#34D399]/30 bg-black/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#CFF7E4] backdrop-blur-md"
              >
                {showDirectory ? 'Hide Directory' : 'Open Directory'}
              </button>
            </div>

            <div className={`pointer-events-none mx-auto flex max-w-6xl gap-4 ${compactUi ? 'flex-col' : 'justify-between gap-6'}`}>
              {showIntro && (
                <div className="pointer-events-auto max-w-md rounded-[20px] border border-[#D4A853]/20 bg-black/55 px-5 py-4 text-[#EADFCB] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D4A853]">
                    Hearth Observatory
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold text-white">
                    The {ORACLES.length} data oracles, without the portal traffic
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-[#C9BBA5]">
                    This is the calmer instrument deck for live world telemetry. Click an oracle in the scene, or use the direct inspect list to open its panel without hunting.
                  </p>
                </div>
              )}

              {showDirectory && (
                <div className="pointer-events-auto w-full max-w-[320px] self-end rounded-[20px] border border-[#34D399]/20 bg-black/55 p-4 text-[#EADFCB] shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#34D399]">
                    Oracle Directory
                  </div>
                  <div className={`mt-3 grid gap-2 ${compactUi ? 'max-h-[44vh] overflow-y-auto pr-1' : ''}`}>
                    {ORACLES.map((oracle) => (
                      <button
                        key={`inspect-${oracle.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedOracle(oracle.id);
                          if (compactUi) setShowDirectory(false);
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          selectedOracle === oracle.id
                            ? 'border-[#34D399]/40 bg-[#34D399]/12'
                            : 'border-white/10 bg-white/5 hover:border-[#34D399]/25 hover:bg-white/8'
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{oracle.label}</div>
                        <div className="mt-1 text-xs text-[#9B8A76]">{oracle.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Html>
      </Canvas>
    </div>
  );
}
