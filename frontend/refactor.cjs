const fs = require('fs');
const path = require('path');
const p = path.resolve('src/world/WorldObject.tsx');
let content = fs.readFileSync(p, 'utf8');

// 1. Remove early return for steward-log
const stewardLogEarlyReturn = `
  if (objectId === 'steward-log') {
    return (
      <group position={position} onClick={handleInteract}>
        <mesh position={[0, 0.5, 0]}>
          <octahedronGeometry args={[0.6]} />
          <meshStandardMaterial color={isOpen ? "#b1b1b1" : "#5b6558"} wireframe />
        </mesh>
        {isOpen && (
          <Html position={[0, 1.5, 0]} center className="pointer-events-none">
            <div className="bg-hearth-paper/90 backdrop-blur-md px-4 py-2 rounded border border-hearth-clay/20 text-hearth-stone text-xs whitespace-nowrap drop-shadow-md">
              <span className="opacity-70 uppercase tracking-wider block mb-1">Steward Log</span>
              <span className="font-mono">{data ? ((data as any)?.last_run ? \`Last run: \${(data as any).last_run.substring(0, 10)}\` : 'Running...') : 'Connecting...'}</span>
            </div>
          </Html>
        )}
      </group>
    );
  }
`;

content = content.replace(stewardLogEarlyReturn, '');

// 2. Remove early return for inspiration-forge
const forgeEarlyReturn = `
  if (objectId === 'inspiration-forge') {
    const forgeData = data as any;
    return (
      <group position={position} onClick={handleInteract}>
        <InspirationForgeMesh state={forgeData?.forge_state || 'waiting'} />
        {isOpen && (
          <Html position={[0, 2.0, 0]} center className="pointer-events-none z-50">
            <div className="bg-black/90 backdrop-blur-md px-6 py-4 rounded-xl border border-[#FF9B30]/30 text-[#FAF6EF] w-80 drop-shadow-2xl shadow-[0_0_25px_rgba(255,155,48,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <div className={\`h-2 w-2 rounded-full \${forgeData?.forge_state === 'resonating' ? 'bg-[#FF9B30] animate-pulse shadow-[0_0_8px_#FF9B30]' : 'bg-[#D4A853]'}\`} />
                <span className="text-[#FF9B30] uppercase tracking-widest text-[10px] font-bold">The Forge</span>
              </div>
              <div className="font-mono text-sm mb-3 text-white/90">
                {forgeData ? (forgeData.forge_state === 'resonating' ? 'Resonating: Multi-Agent Session Active' : 'Waiting for Spark') : 'Igniting...'}
              </div>
              {forgeData && (
                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <div className="text-white/50 mb-1">Active Sessions</div>
                    <div className="text-xl font-light text-white">{forgeData.active_sessions}</div>
                  </div>
                  <div>
                    <div className="text-white/50 mb-1">Total Artifacts</div>
                    <div className="text-xl font-light text-white">{forgeData.total_sessions}</div>
                  </div>
                </div>
              )}
            </div>
          </Html>
        )}
      </group>
    );
  }
`;

content = content.replace(forgeEarlyReturn, '');

// 3. Add their meshes to the interactable mapping
const meshMappingTarget = `{objectId === 'somatic-sensor' && <SomaticSensorMesh valence={(data as SomaticSensorData)?.valence || 0} />}`;
const meshMappingReplacement = `{objectId === 'somatic-sensor' && <SomaticSensorMesh valence={(data as SomaticSensorData)?.valence || 0} />}
        {objectId === 'steward-log' && (
          <mesh position={[0, 0.5, 0]}>
            <octahedronGeometry args={[0.6]} />
            <meshStandardMaterial color={isOpen ? "#b1b1b1" : "#5b6558"} wireframe />
          </mesh>
        )}
        {objectId === 'inspiration-forge' && <InspirationForgeMesh state={(data as any)?.forge_state || 'waiting'} />}`;

content = content.replace(meshMappingTarget, meshMappingReplacement);

// 4. Add their hover labels
const hoverTarget = `{objectId === 'somatic-sensor' && 'Somatic Sensor (Collective Valence)'}`;
const hoverReplacement = `{objectId === 'somatic-sensor' && 'Somatic Sensor (Collective Valence)'}
            {objectId === 'steward-log' && 'Steward Log (Automation)'}
            {objectId === 'inspiration-forge' && 'The Forge (Agent Context)'}`;

content = content.replace(hoverTarget, hoverReplacement);

// 5. Add their content panels
const contentTarget = `{/* OBJECT 5: Star Lantern details */}`;
const contentReplacement = `{/* OBJECT: Steward Log details */}
                {objectId === 'steward-log' && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      Records the nightly automation pulses that maintain the Hearthlands.
                    </p>
                    <div className="bg-white/4 border border-white/5 p-4 rounded-xl">
                      <div className="text-[10px] uppercase text-[#8E7E6B] tracking-wider mb-1">Last Run</div>
                      <div className="text-lg font-semibold text-white">
                        {data ? ((data as any)?.last_run ? (data as any).last_run.substring(0, 10) : 'Running...') : 'Connecting...'}
                      </div>
                    </div>
                  </>
                )}

                {/* OBJECT: Inspiration Forge details */}
                {objectId === 'inspiration-forge' && (
                  <>
                    <p className="text-[11px] leading-5 text-[#8E7E6B] italic">
                      The active inspiration context packet where multi-agent sessions resonate.
                    </p>
                    <div className="bg-white/4 border border-white/5 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={\`h-2 w-2 rounded-full \${(data as any)?.forge_state === 'resonating' ? 'bg-[#FF9B30] animate-pulse shadow-[0_0_8px_#FF9B30]' : 'bg-[#D4A853]'}\`} />
                        <span className="text-[#FF9B30] uppercase tracking-widest text-[10px] font-bold">Status</span>
                      </div>
                      <div className="font-mono text-sm text-white/90">
                        {data ? ((data as any).forge_state === 'resonating' ? 'Resonating: Multi-Agent Session Active' : 'Waiting for Spark') : 'Igniting...'}
                      </div>
                      {data && (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/10 text-xs">
                          <div>
                            <div className="text-white/50 mb-1">Active Sessions</div>
                            <div className="text-xl font-light text-white">{(data as any).active_sessions || 0}</div>
                          </div>
                          <div>
                            <div className="text-white/50 mb-1">Total Artifacts</div>
                            <div className="text-xl font-light text-white">{(data as any).total_sessions || 0}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* OBJECT 5: Star Lantern details */}`;

content = content.replace(contentTarget, contentReplacement);

// 6. Clean up line endings to be consistent (normalize to LF)
content = content.replace(/\\r\\n/g, '\\n');

fs.writeFileSync(p, content, 'utf8');
console.log('Success refactoring');
