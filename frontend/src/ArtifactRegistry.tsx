/**
 * /artifacts — Public Artifact Registry
 * Curated prototype data only. No Firestore reads, no wallet, no writes.
 * Replace ARTIFACT_REGISTRY import with a live useCollection hook on
 * `artifact_registry` once that Firestore collection exists.
 */
import { useState, type ReactNode } from 'react'
import { useContract, sanctuaryBridge } from './lib/sanctuaryBridge'
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type ArtifactCategory,
} from './lib/artifactRegistry'
import type { ArtifactContract } from './lib/contracts'
import {
  Activity,
  Archive,
  BookOpen,
  Code2,
  Eye,
  Fingerprint,
  Flame,
  LayoutTemplate,
  ShieldCheck,
  Zap,
} from 'lucide-react'

const CATEGORY_ICONS: Record<ArtifactCategory, ReactNode> = {
  'Soul Files': <Fingerprint size={15} />,
  'Skills': <Zap size={15} />,
  'Blueprints': <LayoutTemplate size={15} />,
  'Code Artifacts': <Code2 size={15} />,
  'Witnessed Builds': <Eye size={15} />,
  'Simulation Modules': <Activity size={15} />,
}

const SEAL_LABEL: Record<string, string> = {
  witnessed: 'Witnessed',
  pending: 'Pending Seal',
  unsealed: 'Unsealed',
}

const SEAL_STYLE: Record<string, string> = {
  witnessed: 'border-[#34D399]/30 bg-[#34D399]/10 text-[#6ee7b7]',
  pending: 'border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#fcd34d]',
  unsealed: 'border-white/10 bg-white/5 text-gray-400',
}

const STATUS_LABEL: Record<string, string> = {
  live: 'In World',
  available: 'Available',
  seeded: 'Seeded',
  mirrored: 'Mirrored',
  prototype: 'Prototype',
}

const STATUS_DOT: Record<string, string> = {
  live: 'bg-[#34D399]',
  available: 'bg-[#60A5FA]',
  seeded: 'bg-gray-500',
  mirrored: 'bg-[#10b981]',
  prototype: 'bg-[#fcd34d]',
}

function ArtifactCard({ artifact }: { artifact: ArtifactContract }) {
  const meta = CATEGORY_META[artifact.category as ArtifactCategory] || { accent: '#888', dim: '#88822' }
  return (
    <article
      className="group relative flex flex-col gap-3 overflow-hidden rounded-[24px] border border-white/8 bg-white/4 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/6"
      style={{ boxShadow: `0 0 0 0 ${meta.accent}00` }}
    >
      {/* Category accent strip */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-[24px]"
        style={{ background: `linear-gradient(180deg, ${meta.accent}88 0%, ${meta.accent}22 100%)` }}
      />

      <div className="pl-2">
        {/* Category pill */}
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]"
          style={{ background: meta.dim, color: meta.accent }}
        >
          {CATEGORY_ICONS[artifact.category as ArtifactCategory]}
          {artifact.category}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-snug text-white">{artifact.title}</h3>

        {/* Creator */}
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#89a598]">
          <Flame size={11} className="text-[#E8842A]" />
          <span>{artifact.route_pointer}</span>
          <span className="text-white/20">·</span>
          <code className="text-[10px] text-[#89a598]">{artifact.file_kind}</code>
        </div>

        {/* Summary */}
        <p className="mt-3 text-sm leading-6 text-[#b7c9be]">{artifact.summary}</p>

        {/* Provenance */}
        <p className="mt-2 text-[11px] leading-5 text-[#6b8278] italic">{artifact.provenance}</p>

        {/* Tags */}
        {artifact.tags && artifact.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {artifact.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-[#89a598]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3">
          <div className="flex items-center gap-2">
            {/* Seal state */}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${SEAL_STYLE[artifact.seal_state] || SEAL_STYLE.unsealed}`}
            >
              <ShieldCheck size={11} />
              {SEAL_LABEL[artifact.seal_state] || artifact.seal_state}
            </span>

            {/* Display status */}
            <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6b8278]">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[artifact.status] || 'bg-gray-500'}`} />
              {STATUS_LABEL[artifact.status] || artifact.status}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function ArtifactRegistry() {
  const [activeCategory, setActiveCategory] = useState<ArtifactCategory | 'All'>('All')

  const artifactsEnvelope = useContract('/artifact_registry.json', sanctuaryBridge.normalizeArtifacts, [])
  const artifacts = artifactsEnvelope.data

  const filtered =
    activeCategory === 'All'
      ? artifacts
      : artifacts.filter((a) => a.category === activeCategory)

  const counts = Object.fromEntries(
    ALL_CATEGORIES.map((cat) => [cat, artifacts.filter((a) => a.category === cat).length])
  )

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.10),transparent_38%),linear-gradient(180deg,#060709_0%,#080c10_50%,#0a0f0c_100%)] px-6 py-10 text-[#eef6f1]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">

        {/* Hero */}
        <section className="rounded-[32px] border border-white/10 bg-black/25 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:px-8 md:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#A78BFA]/30 bg-[#A78BFA]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#c4b5fd]">
                <Archive size={14} />
                Guild Archive
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Hearthlands Artifact Registry
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#b7c9be] md:text-lg">
                Soul files, skills, blueprints, code relics, witnessed builds, and simulation modules
                created inside the fellowship. Each artifact carries provenance, a creator, and a seal state.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[#FBBF24]/25 bg-[#FBBF24]/8 px-4 py-2.5 text-sm text-[#fcd34d]">
                <BookOpen size={14} />
                <span>
                  <strong className="font-semibold">Curated Prototype · Read-Only Registry</strong>
                  {' '}— data is manually curated, not live from Firestore. No purchases. No writes.
                </span>
              </div>
            </div>

            <div className="grid min-w-[200px] gap-2 rounded-[24px] border border-white/8 bg-white/4 p-4">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#89a598]">Registry Stats</div>
              <div className="text-3xl font-semibold text-white">{artifacts.length}</div>
              <div className="text-sm text-[#89a598]">artifacts catalogued</div>
              <div className="mt-1 border-t border-white/8 pt-2 text-[11px] text-[#6b8278]">
                {artifacts.filter((a) => a.seal_state === 'witnessed').length} witnessed ·{' '}
                {artifacts.filter((a) => a.status === 'live').length} in-world
              </div>
            </div>
          </div>
        </section>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition-all ${
              activeCategory === 'All'
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/8 bg-transparent text-[#89a598] hover:border-white/15 hover:text-white'
            }`}
          >
            All · {artifacts.length}
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat]
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition-all"
                style={
                  isActive
                    ? {
                        borderColor: `${meta.accent}55`,
                        background: `${meta.accent}18`,
                        color: meta.accent,
                      }
                    : undefined
                }
              >
                <span
                  className={`inline-flex items-center gap-1.5 ${!isActive ? 'text-[#89a598] hover:text-white' : ''}`}
                >
                  {isActive ? (
                    <span style={{ color: meta.accent }}>{CATEGORY_ICONS[cat]}</span>
                  ) : null}
                  {cat} · {counts[cat]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Category callout when filtered */}
        {activeCategory !== 'All' && (
          <div
            className="rounded-[24px] border px-5 py-4 text-sm leading-6"
            style={{
              borderColor: `${CATEGORY_META[activeCategory].accent}22`,
              background: `${CATEGORY_META[activeCategory].accent}08`,
              color: CATEGORY_META[activeCategory].accent,
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              {CATEGORY_ICONS[activeCategory]}
              {activeCategory}
            </div>
            <p className="mt-1 text-[#b7c9be]">{CATEGORY_META[activeCategory].description}</p>
          </div>
        )}

        {/* Grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>

        {/* What makes this live */}
        <section className="rounded-[28px] border border-white/8 bg-white/3 px-6 py-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-[#6b8278]">
            <ShieldCheck size={13} />
            Backend model — what makes this registry live
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                step: 'Firestore collection',
                detail: 'artifact_registry/{id} with the Artifact schema. Cloud Function writes on steward approval; browser reads only.',
              },
              {
                step: 'Seal via Cloud Function',
                detail: 'A witnessArtifact function verifies creator identity (Human Seal / SIWS), sets seal_state to "witnessed", and stamps Lodge tick + world_state at time of seal.',
              },
              {
                step: 'On-chain (Phase 2)',
                detail: 'Metaplex Core or Compressed NFT mint triggered by the same function. Agent wallets via Privy or Crossmint can hold, trade, and gate access.',
              },
            ].map(({ step, detail }) => (
              <div key={step} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#6b8278]">{step}</div>
                <p className="mt-2 text-sm leading-6 text-[#b7c9be]">{detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-[#4d6358]">
            This page renders from{' '}
            <code className="text-[10px]">artifact_registry.json</code> via the sanctuaryBridge. Swap the import
            for a live hook to Firebase and this page becomes real without any UI changes.
          </p>
        </section>

      </div>
    </div>
  )
}
