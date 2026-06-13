/**
 * /workbench — Browser-safe creative JSON + SHA-256 receipts (no backend writes).
 */
import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Box, Copy, Download, Sparkles } from 'lucide-react'
import { sha256Hex, stableStringify } from './lib/grace'
import MasonPanel from './mason/MasonPanel'

type TabId = 'graphics' | 'soulfile' | 'memory' | 'blueprint' | 'mason'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'graphics', label: 'Graphics' },
  { id: 'soulfile', label: 'Soulfile' },
  { id: 'memory', label: 'Memory' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'mason', label: 'Mason' },
]

function PreviewMesh({ scale, twist, hue }: { scale: number; twist: number; hue: number }) {
  return (
    <mesh rotation={[0, twist, 0]} scale={scale}>
      <icosahedronGeometry args={[0.6, 1]} />
      <meshStandardMaterial color={`hsl(${hue}, 65%, 55%)`} emissive={`hsl(${hue}, 80%, 35%)`} emissiveIntensity={0.35} wireframe />
    </mesh>
  )
}

async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(stableStringify(payload))
}

export default function GenerativeWorkbench() {
  const [tab, setTab] = useState<TabId>('graphics')
  const [geoScale, setGeoScale] = useState(1)
  const [geoTwist, setGeoTwist] = useState(0)
  const [geoHue, setGeoHue] = useState(28)
  const [soulName, setSoulName] = useState('Traveler')
  const [soulVoice, setSoulVoice] = useState('Warm solarpunk steward')
  const [soulRules, setSoulRules] = useState('Never claim financial advice. Encourage witnessed work.')
  const [memKey, setMemKey] = useState('plot_assignment')
  const [memValue, setMemValue] = useState('inner ring node 3')
  const [memTag, setMemTag] = useState('cottage')
  const [bpTitle, setBpTitle] = useState('Cottage Garden')
  const [bpPart, setBpPart] = useState('flora_flower')
  const [bpX, setBpX] = useState(0)
  const [bpZ, setBpZ] = useState(0)
  const [digest, setDigest] = useState('')
  const [exportJson, setExportJson] = useState('')

  const graphicsPayload = useMemo(() => ({
    workbench: 'graphics-seed-v1',
    geometry: 'icosahedron',
    scale: geoScale,
    twist: geoTwist,
    hue: geoHue,
  }), [geoScale, geoTwist, geoHue])

  const soulPayload = useMemo(() => ({
    workbench: 'soulfile-v1',
    name: soulName,
    voice: soulVoice,
    rules: soulRules.split('\n').filter(Boolean),
  }), [soulName, soulVoice, soulRules])

  const memoryPayload = useMemo(() => ({
    workbench: 'memory-crystal-v1',
    entries: [{ key: memKey, value: memValue, tags: [memTag] }],
  }), [memKey, memValue, memTag])

  const blueprintPayload = useMemo(() => ({
    schema: 'workshop-v1',
    title: bpTitle,
    author: 'workbench',
    parts: [{ part_id: bpPart, position: { x: bpX, z: bpZ }, rotation_deg: 0, config: {} }],
    tags: ['workbench'],
  }), [bpTitle, bpPart, bpX, bpZ])

  const activePayload = tab === 'graphics' ? graphicsPayload
    : tab === 'soulfile' ? soulPayload
    : tab === 'memory' ? memoryPayload
    : blueprintPayload

  const stamp = async () => {
    const json = JSON.stringify(activePayload, null, 2)
    const hash = await hashPayload(activePayload)
    setExportJson(json)
    setDigest(hash)
  }

  const copyAll = async () => {
    await stamp()
    await navigator.clipboard.writeText(`${exportJson}\n\nreceipt_hash: ${digest}`)
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,rgba(122,158,126,0.12),transparent_42%),#070a08] px-6 py-10 text-[#eadfcd]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-[24px] border border-[#7A9E7E]/25 bg-black/35 px-6 py-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7A9E7E]/35 bg-[#7A9E7E]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9fd4a8]">
            <Sparkles size={12} />
            Generative workbench
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white">Build artifacts in the browser</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b7c9be]">
            Export JSON + SHA-256 digest only. No Firestore writes, no wallet signing. Copy or download for steward review.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition"
              style={{
                border: tab === t.id ? '1px solid rgba(212,168,83,0.45)' : '1px solid rgba(255,255,255,0.08)',
                background: tab === t.id ? 'rgba(212,168,83,0.14)' : 'rgba(255,255,255,0.04)',
                color: tab === t.id ? '#FAF6EF' : '#8E7E6B',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[20px] border border-white/8 bg-black/30 p-5">
            {tab === 'graphics' && (
              <div className="grid gap-4 font-mono text-sm">
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Scale</span>
                  <input type="range" min={0.4} max={2} step={0.05} value={geoScale} onChange={(e) => setGeoScale(Number(e.target.value))} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Twist</span>
                  <input type="range" min={0} max={6.28} step={0.05} value={geoTwist} onChange={(e) => setGeoTwist(Number(e.target.value))} />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-[#8a7a64]">Hue</span>
                  <input type="range" min={0} max={360} value={geoHue} onChange={(e) => setGeoHue(Number(e.target.value))} />
                </label>
                <div className="h-56 rounded-xl border border-white/8 bg-[#0a0604]">
                  <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
                    <ambientLight intensity={0.6} />
                    <pointLight position={[2, 2, 2]} intensity={1.2} />
                    <PreviewMesh scale={geoScale} twist={geoTwist} hue={geoHue} />
                    <OrbitControls enablePan={false} />
                  </Canvas>
                </div>
              </div>
            )}

            {tab === 'soulfile' && (
              <div className="grid gap-3 font-mono text-sm">
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulName} onChange={(e) => setSoulName(e.target.value)} placeholder="Agent name" />
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulVoice} onChange={(e) => setSoulVoice(e.target.value)} placeholder="Voice" />
                <textarea className="min-h-[120px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" value={soulRules} onChange={(e) => setSoulRules(e.target.value)} placeholder="Rules (one per line)" />
              </div>
            )}

            {tab === 'memory' && (
              <div className="grid gap-3 font-mono text-sm">
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memKey} onChange={(e) => setMemKey(e.target.value)} placeholder="Key" />
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memValue} onChange={(e) => setMemValue(e.target.value)} placeholder="Value" />
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={memTag} onChange={(e) => setMemTag(e.target.value)} placeholder="Tag" />
              </div>
            )}

            {tab === 'blueprint' && (
              <div className="grid gap-3 font-mono text-sm">
                <input className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpTitle} onChange={(e) => setBpTitle(e.target.value)} placeholder="Blueprint title" />
                <select className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpPart} onChange={(e) => setBpPart(e.target.value)}>
                  <option value="flora_flower">flora_flower</option>
                  <option value="water_pool">water_pool</option>
                  <option value="art_frame">art_frame</option>
                  <option value="earthbag_dome">earthbag_dome</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpX} onChange={(e) => setBpX(Number(e.target.value))} placeholder="x" />
                  <input type="number" className="rounded-lg border border-white/10 bg-black/40 px-3 py-2" value={bpZ} onChange={(e) => setBpZ(Number(e.target.value))} placeholder="z" />
                </div>
              </div>
            )}

            {tab === 'mason' && (
              <MasonPanel 
                onStamp={(json, hash) => {
                  setExportJson(json);
                  setDigest(hash);
                }} 
              />
            )}

            {tab !== 'mason' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={stamp} className="inline-flex items-center gap-2 rounded-lg bg-[#E8842A] px-4 py-2 font-mono text-[11px] font-semibold text-[#0A0402]">
                  <Box size={14} />
                  Stamp hash
                </button>
                <button type="button" onClick={copyAll} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] text-[#c9bba5]">
                  <Copy size={14} />
                  Copy JSON + hash
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await stamp()
                    const blob = new Blob([`${exportJson}\n\nreceipt_hash: ${digest}`], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `hearth-workbench-${tab}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] text-[#c9bba5]"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            )}
          </section>

          <section className="rounded-[20px] border border-[#D4A853]/15 bg-[#0a0806]/90 p-5 font-mono text-[11px]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#8a7a64]">Export preview</div>
            {digest && (
              <div className="mt-2 rounded-lg border border-[#34D399]/25 bg-[#34D399]/8 px-3 py-2 text-[#86efac]">
                receipt_hash: {digest}
              </div>
            )}
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-white/8 bg-black/40 p-3 text-[#b89c82] leading-relaxed">
              {exportJson || JSON.stringify(activePayload, null, 2)}
            </pre>
            <p className="mt-3 text-[10px] text-[#5E5143]">
              Validate blueprints via POST /api/workshop/validate. Witness experiments via /api/experiment/log.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
