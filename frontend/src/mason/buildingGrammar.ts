export type Primitive = {
  type: string;
  args: number[];
  position: [number, number, number];
  rotation?: [number, number, number];
  material_id?: string;
};

export type BlueprintPayload = {
  workbench: string;
  schema: string;
  title: string;
  author: string;
  commission_tier: "preview" | "detailed" | "physical";
  structure_type: string;
  params: any;
  primitives: Primitive[];
};

function wallSegment(length: number, height: number, thickness: number, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0], material_id?: string): Primitive {
  return { type: 'box', args: [length, height, thickness], position, rotation, material_id };
}

function domeRoof(radius: number, position: [number, number, number], material_id?: string): Primitive {
  return { type: 'sphere', args: [radius, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2], position, material_id };
}

function foundationRing(radius: number, depth: number, position: [number, number, number], material_id?: string): Primitive {
  return { type: 'cylinder', args: [radius, radius, depth, 32], position, material_id };
}

export function generateStructure(type: string, params: any): BlueprintPayload {
  const primitives: Primitive[] = [];
  const material_id = params.material_id || 'clay';

  if (type === 'earthbag_dome') {
    const radius = params.radius || 3;
    const height = params.height || 2.5;
    const wall_count = params.wall_count || 12;
    
    // Foundation
    primitives.push(foundationRing(radius + 0.5, 0.5, [0, -0.25, 0], material_id));
    
    // Circular walls
    const circumference = 2 * Math.PI * radius;
    const segmentLength = circumference / wall_count;
    for (let i = 0; i < wall_count; i++) {
      const angle = (i / wall_count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Leave a gap for a door (e.g., at i=0)
      if (i !== 0) {
        primitives.push(wallSegment(segmentLength * 1.05, height, 0.5, [x, height / 2, z], [0, -angle, 0], material_id));
      }
    }
    
    // Dome roof
    primitives.push(domeRoof(radius + 0.5, [0, height, 0], material_id));

  } else if (type === 'root_cellar') {
    const radius = params.radius || 2.5;
    const depth = params.depth || 2;
    
    // Underground foundation (negative y)
    primitives.push(foundationRing(radius + 0.5, depth, [0, -depth / 2, 0], material_id));
    
    // Short walls above ground
    primitives.push(foundationRing(radius + 0.5, 0.5, [0, 0.25, 0], material_id));
    
    // Flat living roof
    primitives.push(foundationRing(radius + 0.8, 0.2, [0, 0.6, 0], 'dirt'));

  } else if (type === 'terraced_plot') {
    const tiers = params.tiers || 3;
    const tierHeight = params.tier_height || 0.4;
    let currentRadius = params.radius || 5;

    for (let i = 0; i < tiers; i++) {
      const yPos = i * tierHeight + (tierHeight / 2);
      primitives.push(foundationRing(currentRadius, tierHeight, [0, yPos, 0], material_id));
      currentRadius -= 1.0; // Next tier is smaller
    }
  }

  return {
    workbench: 'mason-blueprint-v1',
    schema: 'workshop-v1',
    title: `Procedural ${type}`,
    author: 'Mason',
    commission_tier: 'preview',
    structure_type: type,
    params,
    primitives
  };
}
