/**
 * /workbench — Browser-safe creative JSON + SHA-256 receipts (no backend writes).
 */
import { useMemo, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Box, Copy, Download, Sparkles, FileText, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react'
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
  const [masonBlueprint, setMasonBlueprint] = useState<any>(null)
  
  // Handoff & Drafting state
  const [handoff, setHandoff] = useState<any>(null)
  const [draftTitle, setDraftTitle] = useState('Untitled Artifact')
  const [draftContent, setDraftContent] = useState('')
  const [draftStage, setDraftStage] = useState<'Rough Cut' | 'Smoothed' | 'Sealed'>('Rough Cut')
  const [draftMetadata, setDraftMetadata] = useState<any>(null)

  // Save draft state to sessionStorage
  const saveDraft = (title: string, content: string, stage: 'Rough Cut' | 'Smoothed' | 'Sealed', metadata: any) => {
    sessionStorage.setItem('hearth_workbench_draft', JSON.stringify({ title, content, stage, metadata }))
  }

  // Load handoff and active draft on mount
  useEffect(() => {
    // 1. Check for incoming handoff
    const rawHandoff = sessionStorage.getItem('workbench_handoff')
    if (rawHandoff) {
      try {
        setHandoff(JSON.parse(rawHandoff))
      } catch (err) {}
    }

    // 2. Check for active draft
    const savedDraft = sessionStorage.getItem('hearth_workbench_draft')
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft)
        setDraftTitle(parsed.title || 'Untitled Artifact')
        setDraftContent(parsed.content || '')
        setDraftStage(parsed.stage || 'Rough Cut')
        setDraftMetadata(parsed.metadata || null)
      } catch (e) {}
    }
  }, [])

  // Auto-initialize or manually import handoff to draft console
  const importHandoff = () => {
    if (handoff) {
      const initialContent = `### Artifact Draft: ${handoff.title}\n\n` +
        `*   **Provenance:** ${handoff.source === 'commons' ? 'Commons Prompt' : 'World Object'}\n` +
        `*   **Identity:** ${handoff.objectId}\n` +
        `*   **Classification:** ${handoff.objectType || 'Generic'}\n` +
        `*   **Freshness:** ${handoff.freshness || 'N/A'}\n\n` +
        `<!-- Define specification guidelines, behavioral rules, or schema details below -->\n\n` +
        `#### 1. Core Specification\n\n` +
        `#### 2. Runtime Behavior\n\n` +
        `#### 3. Verification Details\n`;
      
      setDraftTitle(handoff.title)
      setDraftContent(initialContent)
      setDraftStage('Rough Cut')
      setDraftMetadata(handoff)
      saveDraft(handoff.title, initialContent, 'Rough Cut', handoff)
      
      // Clear handoff from sessionStorage so it doesn't trigger preloading
      sessionStorage.removeItem('workbench_handoff')
      setHandoff(null)
    }
  }

  const returnToCommons = () => {
    // Generate new local CommonsPrompt card
    const newPrompt = {
      id: `local-artifact-${Date.now()}`,
      prompt_text: `### Artifact: ${draftTitle}\n\n${draftContent}`,
      author_type: 'human',
      author_id: 'local_user',
      target_type: 'route',
      target_id: 'commons',
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_artifact',
      scope: 'local_artifact',
      cost_label: 'EXPORT ONLY',
      source_route: '/workbench',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true,
      ...(draftMetadata?.objectId ? {
        object_ref: {
          id: draftMetadata.objectId,
          title: draftMetadata.title,
          purpose: draftMetadata.objectType || 'Artifact',
          source: draftMetadata.source,
          freshness: draftMetadata.freshness || 'N/A'
        }
      } : {})
    };

    // Add to session prompts
    const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...sessionPrompts]));
    
    // Clear draft from sessionStorage
    sessionStorage.removeItem('hearth_workbench_draft');
    
    // Reset local state
    setDraftTitle('Untitled Artifact')
    setDraftContent('')
    setDraftStage('Rough Cut')
    setDraftMetadata(null)

    // Route back to commons
    window.location.href = '/commons';
  };

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
    : tab === 'mason' ? (masonBlueprint || { workbench: 'mason-blueprint-v1', note: 'Generate or select a template to preview JSON.' })
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
        <header className="rounded-[24px] border border-[#7A9E7E]/25 bg-black/35 px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7A9E7E]/35 bg-[#7A9E7E]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9fd4a8]">
              <Sparkles size={12} />
              Generative workbench
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Build artifacts in the browser</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b7c9be]">
              Export JSON + SHA-256 digest only. No Firestore writes, no wallet signing. Copy or download for steward review.
            </p>
          </div>

          {handoff && (
            <div className="flex-none inline-flex flex-col gap-2 rounded-lg border border-[#4A90D9]/30 bg-[#4A90D9]/10 px-4 py-3 font-mono text-[11px] max-w-sm">
              <div className="text-[#4A90D9] font-bold uppercase tracking-widest flex justify-between">
                <span>INTAKE FROM {handoff.source === 'commons' ? 'COMMONS' : 'WORLD'}</span>
                <span className="opacity-50 ml-4">LOCAL SESSION</span>
              </div>
              <div className="text-gray-300 leading-normal">
                Target: <span className="text-[#FAF6EF] font-bold">{handoff.title}</span> ({handoff.objectId})
                <br />
                Context: {handoff.objectType || 'Generic Object'}
              </div>
              <button 
                onClick={importHandoff}
                className="w-full mt-1 bg-[#4A90D9] text-[#0A0604] hover:bg-white transition-colors text-[9px] uppercase tracking-wider font-bold py-1.5 rounded"
              >
                Import Intake to Draft Console
              </button>
            </div>
          )}
        </header>

        {/* Sequential Drafting Console */}
        <section className="rounded-[24px] border border-[#7A9E7E]/20 bg-black/45 p-6 shadow-xl relative overflow-hidden font-mono">
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#7A9E7E]/40" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#7A9E7E]/40" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-[#E8842A]" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FAF6EF]">Local Sequential Drafting Console</h2>
            </div>
            
            {/* Stage indicators */}
            <div className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-wider">
              <span className={`px-2.5 py-1 rounded border ${draftStage === 'Rough Cut' ? 'bg-[#E8842A]/20 text-[#E8842A] border-[#E8842A]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Rough Cut</span>
              <span className="text-gray-600">➔</span>
              <span className={`px-2.5 py-1 rounded border ${draftStage === 'Smoothed' ? 'bg-[#D4A853]/20 text-[#D4A853] border-[#D4A853]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Smoothed</span>
              <span className="text-gray-600">➔</span>
              <span className={`px-2.5 py-1 rounded border ${draftStage === 'Sealed' ? 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40' : 'bg-white/5 text-gray-500 border-transparent'}`}>Sealed</span>
            </div>
          </div>

          {/* Draft Metadata Intake Header (if imported) */}
          {draftMetadata && (
            <div className="mb-4 bg-[#1A1410] border border-[#3D2C1E] rounded-lg px-3 py-2 text-[10px] text-gray-400 flex items-center justify-between">
              <div>
                <span className="text-[#D4A853] font-bold">Provenance Intake:</span> {draftMetadata.title} ({draftMetadata.objectId}) • Source: {draftMetadata.source}
              </div>
              <div className="text-[9px] bg-[#E8842A]/10 text-[#E8842A] border border-[#E8842A]/20 px-1.5 py-0.5 rounded uppercase font-bold">
                Linked Context
              </div>
            </div>
          )}

          {/* Draft Title Input */}
          <div className="mb-4">
            <label className="text-[9px] uppercase tracking-widest text-gray-500 block mb-1.5 font-bold">Artifact Name</label>
            <input 
              type="text" 
              value={draftTitle} 
              onChange={(e) => {
                setDraftTitle(e.target.value);
                saveDraft(e.target.value, draftContent, draftStage, draftMetadata);
              }}
              disabled={draftStage === 'Sealed'}
              className="w-full bg-[#0A0604] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#FAF6EF] focus:outline-none focus:border-[#7A9E7E] disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              placeholder="E.g., Waterwheel Flow Regulator Spec"
            />
          </div>

          {/* Text Area */}
          <div className="mb-4">
            <label className="text-[9px] uppercase tracking-widest text-gray-500 block mb-1.5 font-bold">Draft Content (Markdown Supported)</label>
            <textarea
              value={draftContent}
              onChange={(e) => {
                setDraftContent(e.target.value);
                saveDraft(draftTitle, e.target.value, draftStage, draftMetadata);
              }}
              disabled={draftStage === 'Sealed'}
              rows={6}
              className="w-full bg-[#0A0604] border border-white/10 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-[#7A9E7E] disabled:opacity-50 disabled:cursor-not-allowed font-mono leading-relaxed resize-y"
              placeholder="Write design notes, specifications, or paste playground configurations..."
            />
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            {/* Manual Progression */}
            <div className="flex gap-2">
              {draftStage === 'Rough Cut' && (
                <button
                  onClick={() => {
                    setDraftStage('Smoothed');
                    saveDraft(draftTitle, draftContent, 'Smoothed', draftMetadata);
                  }}
                  className="bg-[#D4A853]/20 border border-[#D4A853]/40 text-[#D4A853] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-[#D4A853]/30 transition-colors"
                >
                  Advance to Smoothed
                </button>
              )}
              {draftStage === 'Smoothed' && (
                <>
                  <button
                    onClick={() => {
                      setDraftStage('Rough Cut');
                      saveDraft(draftTitle, draftContent, 'Rough Cut', draftMetadata);
                    }}
                    className="bg-white/5 border border-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                  >
                    Revert to Rough
                  </button>
                  <button
                    onClick={() => {
                      setDraftStage('Sealed');
                      saveDraft(draftTitle, draftContent, 'Sealed', draftMetadata);
                    }}
                    className="bg-[#34D399]/20 border border-[#34D399]/40 text-[#34D399] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-[#34D399]/30 transition-colors"
                  >
                    Seal Artifact
                  </button>
                </>
              )}
              {draftStage === 'Sealed' && (
                <button
                  onClick={() => {
                    setDraftStage('Smoothed');
                    saveDraft(draftTitle, draftContent, 'Smoothed', draftMetadata);
                  }}
                  className="bg-white/5 border border-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
                >
                  Unseal Draft
                </button>
              )}
            </div>

            {/* Export Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(draftContent);
                  alert("Draft copied!");
                }}
                className="bg-white/5 border border-white/10 text-gray-300 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
              >
                Copy Text
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([`# ${draftTitle}\n\n${draftContent}`], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${draftTitle.toLowerCase().replace(/\s+/g, '-')}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-white/5 border border-white/10 text-gray-300 text-[9px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-white/10 transition-colors"
              >
                Download MD
              </button>
              {draftStage === 'Sealed' && (
                <button
                  onClick={returnToCommons}
                  className="bg-[#E8842A] text-[#0A0402] text-[9px] uppercase font-bold tracking-wider px-4 py-2 rounded hover:bg-white transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3 h-3" /> Export Local Artifact
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500 uppercase tracking-widest font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
              Status: Stage {draftStage} • Local Session Draft
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#E8842A]" />
              No Multi-user Sync • Export != Cryptographic Receipt
            </div>
          </div>
        </section>

        {/* Playground Editors */}
        <div className="border-t border-white/5 pt-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8a7a64] mb-3 font-bold">Playground Toolset</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="rounded-full px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] transition"
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
                  onUpdate={(payload) => {
                    setMasonBlueprint(payload);
                    setExportJson(''); // Clear stamped JSON to show live preview
                    setDigest('');
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
                    Download JSON
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
    </div>
  )
}
