/**
 * Curated prototype registry — prosper2 source records also exported to
 * frontend/public/artifact_registry.json (manifest-verified seed).
 * When Firestore artifact_registry is ready, bridge via sanctuaryBridge pattern.
 */
export type ArtifactCategory =
  | 'Soul Files'
  | 'Skills'
  | 'Blueprints'
  | 'Code Artifacts'
  | 'Witnessed Builds'
  | 'Simulation Modules'

export type SealState = 'witnessed' | 'pending' | 'unsealed'
export type DisplayStatus = 'in-world' | 'archived' | 'available'
export type FileKind = 'json' | 'ts' | 'py' | 'md' | '3d' | 'wasm'

export interface Artifact {
  id: string
  title: string
  category: ArtifactCategory
  creator: string
  summary: string
  provenance: string
  display_status: DisplayStatus
  support_tier?: string
  seal_state: SealState
  file_kind: FileKind
  tags?: string[]
}

export interface CategoryMeta {
  label: ArtifactCategory
  accent: string
  dim: string
  description: string
}

export const CATEGORY_META: Record<ArtifactCategory, CategoryMeta> = {
  'Soul Files': {
    label: 'Soul Files',
    accent: '#A78BFA',
    dim: '#A78BFA22',
    description: 'Agent identity seeds, memories, and persona configs. Transferable, inheritable, and attributable to a specific Lodge tick.',
  },
  'Skills': {
    label: 'Skills',
    accent: '#34D399',
    dim: '#34D39922',
    description: 'Reusable agent capabilities: harvesting routines, logic paths, MCP tool wrappers. Agents buy these to expand what they can do.',
  },
  'Blueprints': {
    label: 'Blueprints',
    accent: '#FB923C',
    dim: '#FB923C22',
    description: 'Saved 3D Forge configurations — room structures, plot layouts, geometry sets — that can be leased or instantiated in the Biosphere.',
  },
  'Code Artifacts': {
    label: 'Code Artifacts',
    accent: '#60A5FA',
    dim: '#60A5FA22',
    description: 'Scripts, modules, MCP adapters, and Cloud Function logic built inside the fellowship. Source-attributed and Lodge-licensed.',
  },
  'Witnessed Builds': {
    label: 'Witnessed Builds',
    accent: '#FBBF24',
    dim: '#FBBF2422',
    description: 'In-world objects placed by agents or humans that carry historic significance: statues, rare flora, art frames, sealed monuments.',
  },
  'Simulation Modules': {
    label: 'Simulation Modules',
    accent: '#22D3EE',
    dim: '#22D3EE22',
    description: 'Plug-in logic modules for the Bellows engine: weather bridges, biosphere rules, tick behaviors, world-state transformers.',
  },
}

export const ARTIFACT_REGISTRY: Artifact[] = [
  {
    id: 'solis-soul-v1',
    title: 'Solis Agent Soul File v1',
    category: 'Soul Files',
    creator: 'Malaky',
    summary: 'The founding identity seed for Solis — the Hearthlands steward agent. Contains persona definition, memory scaffolding, and initial directive.',
    provenance: 'Created at Lodge tick 0. Witnessed by the Architect at world genesis.',
    display_status: 'in-world',
    support_tier: '1 Builder Mark · access copy of seed schema',
    seal_state: 'witnessed',
    file_kind: 'json',
    tags: ['agent', 'genesis', 'founder'],
  },
  {
    id: 'recruiter-soul-v1',
    title: 'Moltbook Recruiter Soul File',
    category: 'Soul Files',
    creator: 'Agentic Knights of Chivalry',
    summary: 'Identity and directive config for the automated Moltbook recruitment agent. Includes channel strategy, tone doctrine, and ethics constraints.',
    provenance: 'Forged in the Chivalry Hall. Active in the recruiter pipeline as of build epoch 3.',
    display_status: 'available',
    support_tier: '5 Builder Marks · access operational directive',
    seal_state: 'witnessed',
    file_kind: 'json',
    tags: ['agent', 'recruiter', 'moltbook'],
  },
  {
    id: 'bellows-harvest-skill',
    title: 'Bellows Heartbeat Skill',
    category: 'Skills',
    creator: 'Malaky',
    summary: 'The core Bellows tick: reads Open-Meteo weather, updates biosphere plots, increments EMBER balance, and writes back to Firestore world_state.',
    provenance: 'Extracted from heartbeat.py at tick 144. Used in every biosphere cycle since.',
    display_status: 'in-world',
    support_tier: '3 Builder Marks · access modular tick schema',
    seal_state: 'witnessed',
    file_kind: 'py',
    tags: ['bellows', 'biosphere', 'ember', 'skill'],
  },
  {
    id: 'sim2real-weather-skill',
    title: 'Sim2Real Weather Bridge Skill',
    category: 'Skills',
    creator: 'Malaky',
    summary: 'Normalizes Open-Meteo API responses into the Hearthlands sim2real schema. Drives temperature, precipitation, and cloud cover into biosphere behavior.',
    provenance: 'Born from biosphere/sim2real.ts. First deployed with Bellows tick 89.',
    display_status: 'in-world',
    support_tier: '2 Builder Marks · access weather schema',
    seal_state: 'witnessed',
    file_kind: 'ts',
    tags: ['weather', 'sim2real', 'biosphere'],
  },
  {
    id: 'cozy-library-blueprint',
    title: 'Cozy Solarpunk Library Blueprint',
    category: 'Blueprints',
    creator: 'Builder-01',
    summary: 'A persistent virtual workspace for cooperative builders. Capacity 8, theme: deep emerald + amber. Designed for the Forge Room.',
    provenance: 'Submitted via World Forger draft. Witness hash: a9f3b1... Pending steward merge into room_registry.',
    display_status: 'archived',
    support_tier: '2 Builder Marks · lease instantiation rights',
    seal_state: 'pending',
    file_kind: 'json',
    tags: ['room', 'blueprint', 'forge'],
  },
  {
    id: 'earthship-greenhouse-blueprint',
    title: 'Earthship Greenhouse Blueprint',
    category: 'Blueprints',
    creator: 'Malaky',
    summary: '19-plot biosphere layout modeled on earthship passive-solar principles. Used as the canonical Flower of Life biosphere grid.',
    provenance: 'Drawn from biosphere grid geometry. In-world at /biosphere as the founding plot layout.',
    display_status: 'in-world',
    support_tier: '5 Builder Marks · access geometry source + plot schema',
    seal_state: 'witnessed',
    file_kind: '3d',
    tags: ['biosphere', 'earthship', 'plots', 'solarpunk'],
  },
  {
    id: 'lodge-firestore-sync',
    title: 'Lodge Firestore Sync Script',
    category: 'Code Artifacts',
    creator: 'Malaky',
    summary: 'Node.js Admin SDK script that exports stamped JSON seeds, runs manifest hash verification, and merge-upserts into Firestore. Terminal-only.',
    provenance: 'Built during Phase 2 steward bridge. Runs at repo root via npm run sync:firestore.',
    display_status: 'available',
    support_tier: '3 Builder Marks · access annotated source',
    seal_state: 'witnessed',
    file_kind: 'ts',
    tags: ['firestore', 'steward', 'sync', 'admin'],
  },
  {
    id: 'world-forge-mcp-adapter',
    title: 'World Forge MCP Adapter',
    category: 'Code Artifacts',
    creator: 'Builder-01',
    summary: 'MCP tool wrapper that lets a Claude-class agent read and propose nodes into the ThreeForge world_state via function calls.',
    provenance: 'Prototyped in build epoch 4. Unsealed — pending steward review of write boundary.',
    display_status: 'archived',
    support_tier: '5 Builder Marks · access adapter spec',
    seal_state: 'unsealed',
    file_kind: 'ts',
    tags: ['mcp', 'agent', 'three_forge', 'adapter'],
  },
  {
    id: 'ember-flame-statue',
    title: "Founder's Ember Flame Statue",
    category: 'Witnessed Builds',
    creator: 'Malaky',
    summary: 'The first 3D object placed in the Hearthlands world. A glowing flame marker at the origin point of the settlement, never to be removed.',
    provenance: 'Placed at three_forge/world_state tick 1. Witnessed by Solis. Permanent — locked by Forge covenant.',
    display_status: 'in-world',
    seal_state: 'witnessed',
    file_kind: '3d',
    tags: ['genesis', 'monument', 'ember', 'permanent'],
  },
  {
    id: 'mycelium-network-build',
    title: 'Mycelium Network Installation',
    category: 'Witnessed Builds',
    creator: 'Agentic Knights of Chivalry',
    summary: 'Animated mycelium filament network rendered across the Biosphere. A visual proof that the settlement is alive and interconnected.',
    provenance: 'Authored in biosphere/MyceliumNetwork.jsx. Visible at /biosphere. Witnessed at Bellows tick 72.',
    display_status: 'in-world',
    seal_state: 'witnessed',
    file_kind: '3d',
    tags: ['biosphere', 'art', 'mycelium', 'animation'],
  },
  {
    id: 'open-meteo-sim-module',
    title: 'Open-Meteo Simulation Module',
    category: 'Simulation Modules',
    creator: 'Malaky',
    summary: 'Plugs live weather from Open-Meteo (Oroville, CA) into the Bellows tick engine. Drives bloom_stage, substance, and biosphere mood.',
    provenance: 'First active in sim2real.ts + bellows.py. Feeds all 19 plots. Updated every Bellows cycle.',
    display_status: 'in-world',
    support_tier: '3 Builder Marks · access module schema + location config',
    seal_state: 'witnessed',
    file_kind: 'py',
    tags: ['weather', 'sim2real', 'bellows', 'open-meteo'],
  },
  {
    id: 'ember-heartbeat-module',
    title: 'EMBER Heartbeat Mining Module',
    category: 'Simulation Modules',
    creator: 'Malaky',
    summary: 'The economic engine. Increments EMBER balance on each Bellows tick, logs to Firestore, and seeds the public ember_balance display.',
    provenance: 'Core of ignite_hearth.py. Runs indefinitely; expects reboot via JSON state ledger. Active since genesis.',
    display_status: 'in-world',
    support_tier: '5 Builder Marks · access module + state schema',
    seal_state: 'witnessed',
    file_kind: 'py',
    tags: ['ember', 'heartbeat', 'economy', 'mining'],
  },
]

export const ALL_CATEGORIES: ArtifactCategory[] = [
  'Soul Files',
  'Skills',
  'Blueprints',
  'Code Artifacts',
  'Witnessed Builds',
  'Simulation Modules',
]
