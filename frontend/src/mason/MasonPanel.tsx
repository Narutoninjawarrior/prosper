import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, Loader2 } from 'lucide-react';
import { sha256Hex, stableStringify } from '../lib/grace';
import { generateStructure, type Primitive, type BlueprintPayload } from './buildingGrammar';

function ProceduralMesh({ primitives }: { primitives: Primitive[] }) {
  return (
    <group>
      {primitives.map((prim, idx) => {
        const key = `prim-${idx}`;
        const geomArgs = prim.args as any;
        
        let color = '#a38a6a'; // default earthbag/clay
        if (prim.material_id === 'stone') color = '#7a7d80';
        if (prim.material_id === 'lime') color = '#d9d5cd';
        if (prim.material_id === 'dirt') color = '#574837';

        if (prim.type === 'box') {
          return (
            <mesh key={key} position={prim.position} rotation={prim.rotation as [number,number,number]}>
              <boxGeometry args={geomArgs} />
              <meshStandardMaterial color={color} wireframe />
            </mesh>
          );
        } else if (prim.type === 'cylinder') {
          return (
            <mesh key={key} position={prim.position} rotation={prim.rotation as [number,number,number]}>
              <cylinderGeometry args={geomArgs} />
              <meshStandardMaterial color={color} wireframe />
            </mesh>
          );
        } else if (prim.type === 'sphere') {
          return (
            <mesh key={key} position={prim.position} rotation={prim.rotation as [number,number,number]}>
              <sphereGeometry args={geomArgs} />
              <meshStandardMaterial color={color} wireframe />
            </mesh>
          );
        }
        return null;
      })}
    </group>
  );
}

export default function MasonPanel({
  onStamp
}: {
  onStamp: (json: string, hash: string, payload: any) => void;
}) {
  const [prompt, setPrompt] = useState('a small earthbag dome for two people');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ blueprint: BlueprintPayload, reasoning: string } | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-7b-instruct',
          messages: [
            {
              role: 'system',
              content: 'MASON_PROMPT'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
      const data = await res.json();
      const text = data.choices[0].message.content;
      
      // parse JSON safely if model outputs prose around it
      let parsed;
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          parsed = JSON.parse(text);
        }
      } catch (e) {
        console.error("Failed to parse Mason JSON", text);
        return;
      }

      const blueprint = generateStructure(parsed.structure_type, parsed.params);
      setResult({ blueprint, reasoning: parsed.reasoning || 'No reasoning provided.' });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stamp = async () => {
    if (!result) return;
    const json = JSON.stringify(result.blueprint, null, 2);
    const hash = await sha256Hex(stableStringify(result.blueprint));
    onStamp(json, hash, result.blueprint);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 font-mono text-sm">
        <textarea 
          className="min-h-[80px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[#FAF6EF]" 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)} 
          placeholder="Describe what you want to build..." 
        />
        <button 
          type="button" 
          disabled={loading}
          onClick={handleSubmit} 
          className="flex items-center justify-center gap-2 rounded-lg bg-[#34D399] px-4 py-2 font-mono text-[11px] font-semibold text-black disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : null}
          Generate Blueprint
        </button>
      </div>
      
      {result && (
        <div className="grid gap-3 font-mono text-sm">
          <div className="h-64 rounded-xl border border-white/8 bg-[#0a0604]">
            <Canvas camera={{ position: [0, 4, 8], fov: 45 }}>
              <ambientLight intensity={0.6} />
              <pointLight position={[5, 5, 5]} intensity={1.2} />
              <ProceduralMesh primitives={result.blueprint.primitives} />
              <OrbitControls enablePan={true} target={[0, 1, 0]} />
            </Canvas>
          </div>
          <div className="rounded-lg border border-[#D4A853]/20 bg-[#D4A853]/5 p-3 text-[11px] text-[#c9bba5]">
            <strong className="text-[#D4A853]">Mason's reasoning:</strong> {result.reasoning}
          </div>
          
          <button type="button" onClick={stamp} className="inline-flex items-center gap-2 rounded-lg bg-[#E8842A] px-4 py-2 font-mono text-[11px] font-semibold text-[#0A0402] w-fit">
            <Box size={14} />
            Stamp & Save Blueprint
          </button>
        </div>
      )}
    </div>
  );
}
