export interface BotArtifactManifest {
  id: string; // Globally unique identifier matching UUID formatting standards
  title: string;
  artifact_family: 'crystal_cluster' | 'ice_spire' | 'bio_tube' | 'solar_bloom' | 'habitat_arch';
  audience_scope: 'commons_public' | 'builders_room' | 'world_room';
  visibility: 'local_draft' | 'public_witnessed';
  
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };

  geometry_recipe: {
    primitive_type: 'instanced_cluster' | 'parametric_tube' | 'lathe_profile' | 'extruded_span';
    dimensions: number[]; // e.g. [radiusTop, radiusBottom, height, radialSegments]
    spline_nodes?: [number, number, number][]; // Required only if primitive_type is PARAMETRIC_TUBE
  };

  material_profile: {
    preset_family: 'LIQUID_MERCURY' | 'BIOFILM_MOSS' | 'CRYSTAL_ICE' | 'SOLARPUNK_CHROME';
    roughness: number; // Enforced boundary clamp: [0.0, 1.0]
    metalness: number;   // Enforced boundary clamp: [0.0, 1.0]
    emissive_intensity: number; // Enforced boundary clamp: [0.0, 2.0]
    color_hex: string;
  };

  provenance_metadata: {
    author_type: 'human' | 'agent';
    author_id: string;
    source_ref?: string;
    created_at: string;
    note?: string;
  };
}
