import type { BotArtifactManifest } from './worldArtifactContract';

export const SEEDED_ARTIFACTS: BotArtifactManifest[] = [
  {
    id: 'art-seed-001',
    title: 'Parametric Fluid Conduit',
    artifact_family: 'bio_tube',
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: [4, 0.5, 4],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    geometry_recipe: {
      primitive_type: 'parametric_tube',
      dimensions: [0.15, 64, 8],
      spline_nodes: [
        [0, 0, 0],
        [1, 2, 1],
        [2, 1, 3],
        [1, 3, 5],
        [0, 0, 6]
      ]
    },
    material_profile: {
      preset_family: 'BIOFILM_MOSS',
      roughness: 0.8,
      metalness: 0.1,
      emissive_intensity: 0.3,
      color_hex: '#10b981'
    },
    provenance_metadata: {
      author_type: 'human',
      author_id: 'sys_steward',
      created_at: new Date().toISOString(),
      note: 'Local test demo artifact. Not written to live chain.'
    }
  },
  {
    id: 'art-seed-002',
    title: 'Resonance Crystal Cluster',
    artifact_family: 'crystal_cluster',
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: [-5, 0, 3],
      rotation: [0, Math.PI / 4, 0],
      scale: [1, 1, 1]
    },
    geometry_recipe: {
      primitive_type: 'instanced_cluster',
      dimensions: [0.4, 2.0, 6, 15] // radius, height, radialSegments, count
    },
    material_profile: {
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
      note: 'Local test demo artifact. Not written to live chain.'
    }
  },
  {
    id: 'art-seed-003',
    title: 'Solarpunk Heat Exchange',
    artifact_family: 'solar_bloom',
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: [0, 2, -6],
      rotation: [Math.PI / 2, 0, 0],
      scale: [1.5, 1.5, 1.5]
    },
    geometry_recipe: {
      primitive_type: 'lathe_profile',
      dimensions: [12] // segments
    },
    material_profile: {
      preset_family: 'SOLARPUNK_CHROME',
      roughness: 0.3,
      metalness: 0.8,
      emissive_intensity: 0.5,
      color_hex: '#d97706'
    },
    provenance_metadata: {
      author_type: 'agent',
      author_id: 'bot_architect_01',
      created_at: new Date().toISOString(),
      note: 'Local test demo artifact. Generated layout bounds.'
    }
  },
  {
    id: 'art-seed-004',
    title: 'Habitat Arch',
    artifact_family: 'habitat_arch',
    audience_scope: 'world_room',
    visibility: 'local_draft',
    transform: {
      position: [-3, 0, -3],
      rotation: [0, -Math.PI / 6, 0],
      scale: [1, 1, 1]
    },
    geometry_recipe: {
      primitive_type: 'extruded_span',
      dimensions: [4, 3, 0.5] // span, height, depth
    },
    material_profile: {
      preset_family: 'LIQUID_MERCURY',
      roughness: 0.5,
      metalness: 0.6,
      emissive_intensity: 0.1,
      color_hex: '#94a3b8'
    },
    provenance_metadata: {
      author_type: 'agent',
      author_id: 'bot_architect_02',
      created_at: new Date().toISOString(),
      note: 'Local test demo artifact. Generated layout bounds.'
    }
  }
];
