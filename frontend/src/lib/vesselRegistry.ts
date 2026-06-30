/**
 * prosper2 canonical registry records — source of truth for public vessel surfaces.
 * Exported as stamped JSON seeds in frontend/public/*.json for mirror/export.
 */

export type RegistryStatus = 'live' | 'seeded' | 'mirrored' | 'prototype'

export type RegistryRecordBase = {
  id: string
  title: string
  summary: string
  provenance: string
  status: RegistryStatus
  route_pointer: string
  source_pointer: string
  tags: string[]
  featured: boolean
  updated_at: string
}

export type ArtifactRegistryRecord = RegistryRecordBase & {
  category: string
  seal_state: 'witnessed' | 'pending' | 'unsealed'
  file_kind: string
}

export type ToolRegistryRecord = RegistryRecordBase & {
  tool_kind: 'mcp' | 'script' | 'skill' | 'adapter'
  realm: 'world' | 'biosphere' | 'forge' | 'lodge'
}

export type InterfaceModuleRecord = RegistryRecordBase & {
  module_kind: 'route' | 'overlay' | 'inspect' | 'shell'
  realm: 'world' | 'biosphere' | 'public' | 'forge'
}

export type LodgeAppRecord = RegistryRecordBase & {
  app_kind: 'surface' | 'engine' | 'steward' | 'council'
  public_route: string
}

export const REGISTRY_VESSEL = 'hearthlands-doctrine-forge-v1'
export const REGISTRY_SOURCE = 'D:\\Hearth\\prosper2'

export const ARTIFACT_REGISTRY_RECORDS: ArtifactRegistryRecord[] = [
  {
    id: 'solis-soul-v1',
    title: 'Solis Agent Soul File v1',
    summary: 'Founding identity seed for Solis — steward persona, memory scaffolding, and initial directive.',
    provenance: 'Created at Lodge tick 0. Witnessed by the Architect at world genesis.',
    status: 'seeded',
    route_pointer: '/artifacts',
    source_pointer: 'frontend/src/lib/vesselRegistry.ts',
    tags: ['agent', 'genesis', 'founder'],
    featured: true,
    updated_at: '2026-06-08T12:00:00Z',
    category: 'Soul Files',
    seal_state: 'witnessed',
    file_kind: 'json',
  },
  {
    id: 'bellows-harvest-skill',
    title: 'Bellows Heartbeat Skill',
    summary: 'Core Bellows tick: weather, biosphere plots, EMBER balance, Firestore world_state writes.',
    provenance: 'Extracted from heartbeat.py at tick 144.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'bellows.py',
    tags: ['bellows', 'biosphere', 'ember'],
    featured: true,
    updated_at: '2026-06-09T08:00:00Z',
    category: 'Skills',
    seal_state: 'witnessed',
    file_kind: 'py',
  },
  {
    id: 'earthship-greenhouse-blueprint',
    title: 'Earthship Greenhouse Blueprint',
    summary: '19-plot biosphere layout on the Flower of Life grid — canonical sacred farming geometry.',
    provenance: 'In-world at /biosphere as the founding plot layout.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'frontend/src/biosphere/BiosphereGrid.jsx',
    tags: ['biosphere', 'earthship', 'plots'],
    featured: true,
    updated_at: '2026-06-09T08:00:00Z',
    category: 'Blueprints',
    seal_state: 'witnessed',
    file_kind: '3d',
  },
  {
    id: 'ember-flame-statue',
    title: "Founder's Ember Flame Statue",
    summary: 'First 3D object placed in the Hearthlands world — permanent origin monument.',
    provenance: 'Placed at three_forge/world_state tick 1.',
    status: 'live',
    route_pointer: '/world',
    source_pointer: 'three_forge/world_state',
    tags: ['genesis', 'monument', 'ember'],
    featured: false,
    updated_at: '2026-06-08T12:00:00Z',
    category: 'Witnessed Builds',
    seal_state: 'witnessed',
    file_kind: '3d',
  },
  {
    id: 'lodge-firestore-sync',
    title: 'Lodge Firestore Sync Script',
    summary: 'Admin SDK merge-upsert from stamped JSON seeds with manifest hash verification.',
    provenance: 'Phase C steward bridge — npm run sync:firestore.',
    status: 'seeded',
    route_pointer: '/forge',
    source_pointer: 'scripts/sync-firestore-from-seed.mjs',
    tags: ['firestore', 'steward', 'sync'],
    featured: false,
    updated_at: '2026-06-08T12:00:00Z',
    category: 'Code Artifacts',
    seal_state: 'witnessed',
    file_kind: 'ts',
  },
  {
    id: 'open-meteo-sim-module',
    title: 'Open-Meteo Simulation Module',
    summary: 'Live weather from Open-Meteo drives bloom_stage and biosphere mood each Bellows tick.',
    provenance: 'sim2real.ts + bellows.py — feeds all 19 plots.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'frontend/src/biosphere/sim2real.ts',
    tags: ['weather', 'sim2real', 'bellows'],
    featured: false,
    updated_at: '2026-06-09T08:00:00Z',
    category: 'Simulation Modules',
    seal_state: 'witnessed',
    file_kind: 'py',
  },
]

export const TOOL_REGISTRY_RECORDS: ToolRegistryRecord[] = [
  {
    id: 'inspect-rail',
    title: 'Inspect Rail',
    summary: 'Unified inspect-first panel for world objects, biosphere plots, and realm portals.',
    provenance: 'Shared between WorldScene and BiosphereScene.',
    status: 'live',
    route_pointer: '/world',
    source_pointer: 'frontend/src/inspect/InspectRail.jsx',
    tags: ['inspect', 'ui', 'interaction'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    tool_kind: 'skill',
    realm: 'world',
  },
  {
    id: 'interaction-shell',
    title: 'Interaction Shell',
    summary: 'Bottom action dock and builder drawer — civic shell for world and biosphere.',
    provenance: 'prosper2 interface coherence pass.',
    status: 'live',
    route_pointer: '/world',
    source_pointer: 'frontend/src/shell/InteractionShell.jsx',
    tags: ['shell', 'dock', 'builder'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    tool_kind: 'adapter',
    realm: 'world',
  },
  {
    id: 'world-click-system',
    title: 'World Click System',
    summary: 'Empty ground walks; object clicks inspect-first without accidental movement.',
    provenance: 'WorldScene click semantics layer.',
    status: 'live',
    route_pointer: '/world',
    source_pointer: 'frontend/src/WorldClickSystem.jsx',
    tags: ['movement', 'inspect', 'world'],
    featured: false,
    updated_at: '2026-06-09T18:00:00Z',
    tool_kind: 'skill',
    realm: 'world',
  },
  {
    id: 'bellows-tick',
    title: 'Bellows Tick Engine',
    summary: 'Python heartbeat that advances biosphere state and writes world_state.',
    provenance: 'Local-first economic and simulation engine.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'bellows.py',
    tags: ['bellows', 'tick', 'ember'],
    featured: true,
    updated_at: '2026-06-09T08:00:00Z',
    tool_kind: 'script',
    realm: 'biosphere',
  },
  {
    id: 'steward-mount',
    title: 'Steward Mount (Gemma)',
    summary: 'Read-only steward chat surface mounted in world and biosphere scenes.',
    provenance: 'Community steward overlay — no client writes.',
    status: 'prototype',
    route_pointer: '/world',
    source_pointer: 'frontend/src/steward/StewardMount.jsx',
    tags: ['steward', 'gemma', 'chat'],
    featured: false,
    updated_at: '2026-06-08T12:00:00Z',
    tool_kind: 'mcp',
    realm: 'lodge',
  },
]

export const INTERFACE_MODULE_RECORDS: InterfaceModuleRecord[] = [
  {
    id: 'world-scene',
    title: 'World Scene',
    summary: 'Public RuneScape-style 3D world with forge nodes, portals, and keyboard movement.',
    provenance: 'Primary public vessel route at /world.',
    status: 'live',
    route_pointer: '/world',
    source_pointer: 'frontend/src/WorldScene.jsx',
    tags: ['3d', 'world', 'public'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    module_kind: 'route',
    realm: 'world',
  },
  {
    id: 'biosphere-scene',
    title: 'Biosphere Scene',
    summary: 'Sacred geometry farming world — 19 plots, mycelium, plant/harvest inspect rail.',
    provenance: 'Primary public vessel route at /biosphere.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'frontend/src/BiosphereScene.jsx',
    tags: ['3d', 'biosphere', 'farming'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    module_kind: 'route',
    realm: 'biosphere',
  },
  {
    id: 'builder-panel',
    title: 'Builder Panel',
    summary: 'Catalogue preview for placing forge objects — preview-only until steward write path.',
    provenance: 'Shared builder overlay; placement logs to console only.',
    status: 'prototype',
    route_pointer: '/3dforge',
    source_pointer: 'frontend/src/BuilderPanel.jsx',
    tags: ['builder', 'forge', 'preview'],
    featured: false,
    updated_at: '2026-06-09T18:00:00Z',
    module_kind: 'overlay',
    realm: 'forge',
  },
  {
    id: 'council-board',
    title: 'Council Board',
    summary: 'Public council proposal board — seeded proposals with steward/planner voices.',
    provenance: 'local_council_proposals.json + councilProposals.ts.',
    status: 'seeded',
    route_pointer: '/council',
    source_pointer: 'frontend/src/CouncilBoard.tsx',
    tags: ['council', 'governance', 'proposals'],
    featured: true,
    updated_at: '2026-06-08T19:41:00Z',
    module_kind: 'route',
    realm: 'public',
  },
  {
    id: 'artifact-registry-page',
    title: 'Artifact Registry',
    summary: 'Public archive of witnessed capabilities — read-only, no marketplace writes.',
    provenance: 'artifact_registry.json seed + ArtifactRegistry.tsx.',
    status: 'seeded',
    route_pointer: '/artifacts',
    source_pointer: 'frontend/src/ArtifactRegistry.tsx',
    tags: ['artifacts', 'archive', 'registry'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    module_kind: 'route',
    realm: 'public',
  },
]

export const LODGE_APP_RECORDS: LodgeAppRecord[] = [
  {
    id: 'public-vessel',
    title: 'Hearthlands Public Vessel',
    summary: 'Firebase-hosted fellowship site — world, biosphere, forge, hall, council, artifacts.',
    provenance: 'prosper2 canonical deployment at fellowship-of-the-hearth.web.app.',
    status: 'live',
    route_pointer: '/',
    source_pointer: 'frontend/src/App.tsx',
    tags: ['vessel', 'public', 'firebase'],
    featured: true,
    updated_at: '2026-06-10T00:00:00Z',
    app_kind: 'surface',
    public_route: 'https://fellowship-of-the-hearth.web.app',
  },
  {
    id: 'three-forge',
    title: 'Three Forge',
    summary: '3D forge surface for world_state objects — mirrored into /world forge nodes.',
    provenance: 'Shared Firestore three_forge/world_state collection.',
    status: 'live',
    route_pointer: '/3dforge',
    source_pointer: 'frontend/src/ThreeForge.tsx',
    tags: ['forge', '3d', 'world_state'],
    featured: true,
    updated_at: '2026-06-09T18:00:00Z',
    app_kind: 'surface',
    public_route: '/3dforge',
  },
  {
    id: 'hall-of-honor',
    title: 'Hall of Honor',
    summary: 'Manifest-verified member ledger with Firestore supplemental reads.',
    provenance: 'vessel_members.json + lodgeFirestore.ts.',
    status: 'live',
    route_pointer: '/hall',
    source_pointer: 'frontend/src/HallOfHonor.tsx',
    tags: ['hall', 'members', 'honor'],
    featured: false,
    updated_at: '2026-06-08T12:00:00Z',
    app_kind: 'surface',
    public_route: '/hall',
  },
  {
    id: 'lodge-mind',
    title: 'Lodge Mind',
    summary: 'Public lodge-mind surface — registry summaries and hive context (read-only).',
    provenance: 'LodgeMindRoute.tsx prototype bridge.',
    status: 'prototype',
    route_pointer: '/lodge-mind',
    source_pointer: 'frontend/src/LodgeMindRoute.tsx',
    tags: ['lodge-mind', 'hive', 'context'],
    featured: false,
    updated_at: '2026-06-09T08:00:00Z',
    app_kind: 'engine',
    public_route: '/lodge-mind',
  },
  {
    id: 'bellows-engine',
    title: 'Bellows Engine',
    summary: 'Local Python tick engine — weather, plots, EMBER mining loop.',
    provenance: 'bellows.py + ignite_hearth.py — expects reboot via JSON ledger.',
    status: 'live',
    route_pointer: '/biosphere',
    source_pointer: 'bellows.py',
    tags: ['bellows', 'ember', 'simulation'],
    featured: true,
    updated_at: '2026-06-09T08:00:00Z',
    app_kind: 'engine',
    public_route: '/biosphere',
  },
]

export function latestCouncilProposalPulse() {
  return {
    id: 'artifact-chamber-opening',
    title: 'Open the Artifact Chamber',
    state: 'witnessed',
    domain: 'artifacts',
    synthesis: 'Treat the archive as a chamber of witnessed capabilities, not a shop shelf.',
    status_label: 'seeded',
  }
}

export const VESSEL_REGISTRY_META = {
  vessel_id: REGISTRY_VESSEL,
  source_repo: REGISTRY_SOURCE,
  emitted_at: '2026-06-10T00:00:00Z',
  policy: 'prosper2 is source of truth; Emergent may mirror read-only seeds',
}
