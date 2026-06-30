import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, Html } from '@react-three/drei';
import type { BotArtifactManifest } from '../lib/worldArtifactContract';

function getMaterialProps(profile: BotArtifactManifest['material_profile']) {
  return {
    color: profile.color_hex,
    roughness: profile.roughness,
    metalness: profile.metalness,
    emissive: profile.color_hex,
    emissiveIntensity: profile.emissive_intensity,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: profile.preset_family === 'CRYSTAL_ICE' ? 0.8 : 1.0,
  };
}

// ─── Tube Artifact ────────────────────────────────────────────────────────────
function ParametricTubeArtifact({ artifact, hovered, selected, setHovered, onSelect }: { artifact: BotArtifactManifest, hovered: boolean, selected: boolean, setHovered: (v: boolean) => void, onSelect: () => void }) {
  const { geometry_recipe, material_profile } = artifact;
  
  const curve = useMemo(() => {
    if (!geometry_recipe.spline_nodes || geometry_recipe.spline_nodes.length === 0) return null;
    const points = geometry_recipe.spline_nodes.map(p => new THREE.Vector3(...p));
    return new THREE.CatmullRomCurve3(points);
  }, [geometry_recipe.spline_nodes]);

  if (!curve) return null;

  const [radius, tubularSegments, radialSegments] = geometry_recipe.dimensions;

  return (
    <mesh
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      castShadow
      receiveShadow
    >
      <tubeGeometry args={[curve, tubularSegments || 64, radius || 0.15, radialSegments || 8, false]} />
      <meshStandardMaterial {...getMaterialProps(material_profile)} emissiveIntensity={hovered ? material_profile.emissive_intensity + 0.5 : material_profile.emissive_intensity} wireframe={selected} />
    </mesh>
  );
}

// ─── Instanced Cluster Artifact ───────────────────────────────────────────────
function InstancedClusterArtifact({ artifact, hovered, selected, setHovered, onSelect }: { artifact: BotArtifactManifest, hovered: boolean, selected: boolean, setHovered: (v: boolean) => void, onSelect: () => void }) {
  const { geometry_recipe, material_profile } = artifact;
  const [radius, height, radialSegments, count] = geometry_recipe.dimensions;
  
  const instanceData = useMemo(() => {
    const data = [];
    const num = count || 10;
    for (let i = 0; i < num; i++) {
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 2.0,
        (Math.random() * (height || 2)) / 2,
        (Math.random() - 0.5) * 2.0
      );
      const rotation = new THREE.Euler(
        Math.random() * 0.2,
        Math.random() * Math.PI,
        Math.random() * 0.2
      );
      const scale = new THREE.Vector3().setScalar(0.5 + Math.random() * 0.8);
      data.push({ position, rotation, scale });
    }
    return data;
  }, [count, height]);

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <Instances limit={count || 10} castShadow receiveShadow>
        <cylinderGeometry args={[0, radius || 0.2, height || 2, radialSegments || 6]} />
        <meshStandardMaterial {...getMaterialProps(material_profile)} emissiveIntensity={hovered ? material_profile.emissive_intensity + 0.5 : material_profile.emissive_intensity} wireframe={selected} />
        {instanceData.map((data, i) => (
          <Instance key={i} position={data.position} rotation={data.rotation} scale={data.scale} />
        ))}
      </Instances>
      {/* Invisible bounding volume for raycasting interaction since Instances can be tricky */}
      <mesh visible={false} position={[0, (height || 2) / 2, 0]}>
        <sphereGeometry args={[1.5, 8, 8]} />
      </mesh>
    </group>
  );
}

// ─── Lathe Profile Artifact ───────────────────────────────────────────────────
function LatheProfileArtifact({ artifact, hovered, selected, setHovered, onSelect }: { artifact: BotArtifactManifest, hovered: boolean, selected: boolean, setHovered: (v: boolean) => void, onSelect: () => void }) {
  const { geometry_recipe, material_profile } = artifact;
  const [segments] = geometry_recipe.dimensions;
  
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      pts.push(new THREE.Vector2(Math.sin(i * 0.2) * 1.5 + 0.5, (i - 5) * 0.4));
    }
    return pts;
  }, []);

  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.z += delta * 0.2;
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      castShadow
      receiveShadow
    >
      <latheGeometry args={[points, segments || 12]} />
      <meshStandardMaterial {...getMaterialProps(material_profile)} emissiveIntensity={hovered ? material_profile.emissive_intensity + 0.5 : material_profile.emissive_intensity} side={THREE.DoubleSide} wireframe={selected} />
    </mesh>
  );
}

// ─── Extruded Span Artifact ───────────────────────────────────────────────────
function ExtrudedSpanArtifact({ artifact, hovered, selected, setHovered, onSelect }: { artifact: BotArtifactManifest, hovered: boolean, selected: boolean, setHovered: (v: boolean) => void, onSelect: () => void }) {
  const { geometry_recipe, material_profile } = artifact;
  const [span, height, depth] = geometry_recipe.dimensions;
  
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const w = span || 4;
    const h = height || 3;
    s.moveTo(-w/2, 0);
    s.lineTo(-w/2, h * 0.6);
    s.quadraticCurveTo(0, h, w/2, h * 0.6);
    s.lineTo(w/2, 0);
    s.lineTo(w/2 - 0.4, 0);
    s.lineTo(w/2 - 0.4, h * 0.5);
    s.quadraticCurveTo(0, h * 0.8, -w/2 + 0.4, h * 0.5);
    s.lineTo(-w/2 + 0.4, 0);
    s.lineTo(-w/2, 0);
    return s;
  }, [span, height]);

  const extrudeSettings = { depth: depth || 0.5, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.05, bevelThickness: 0.05 };

  return (
    <mesh
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial {...getMaterialProps(material_profile)} emissiveIntensity={hovered ? material_profile.emissive_intensity + 0.5 : material_profile.emissive_intensity} wireframe={selected} />
    </mesh>
  );
}

export function ParametricArtifactRenderer({ artifact, selected, onInspect }: { artifact: BotArtifactManifest, selected?: boolean, onInspect: (artifact: BotArtifactManifest) => void }) {
  const [hovered, setHovered] = React.useState(false);
  const { transform, geometry_recipe } = artifact;
  
  return (
    <group position={transform.position} rotation={transform.rotation} scale={transform.scale}>
      {geometry_recipe.primitive_type === 'parametric_tube' && (
        <ParametricTubeArtifact artifact={artifact} hovered={hovered} selected={!!selected} setHovered={setHovered} onSelect={() => onInspect(artifact)} />
      )}
      {geometry_recipe.primitive_type === 'instanced_cluster' && (
        <InstancedClusterArtifact artifact={artifact} hovered={hovered} selected={!!selected} setHovered={setHovered} onSelect={() => onInspect(artifact)} />
      )}
      {geometry_recipe.primitive_type === 'lathe_profile' && (
        <LatheProfileArtifact artifact={artifact} hovered={hovered} selected={!!selected} setHovered={setHovered} onSelect={() => onInspect(artifact)} />
      )}
      {geometry_recipe.primitive_type === 'extruded_span' && (
        <ExtrudedSpanArtifact artifact={artifact} hovered={hovered} selected={!!selected} setHovered={setHovered} onSelect={() => onInspect(artifact)} />
      )}
      
      {hovered && (
        <Html distanceFactor={10} position={[0, 2, 0]} center>
          <div style={{
            background: 'rgba(5,8,6,0.9)',
            border: `1px solid ${artifact.material_profile.color_hex}`,
            borderRadius: 4,
            padding: '6px 10px',
            color: '#c9bba5',
            fontFamily: 'monospace',
            fontSize: 10,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <div style={{ color: artifact.material_profile.color_hex, fontWeight: 'bold', marginBottom: 2 }}>
              {artifact.title}
            </div>
            <div style={{ opacity: 0.7, fontSize: 9 }}>
              FAMILY: {artifact.artifact_family}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
