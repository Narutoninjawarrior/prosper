const fs = require('fs');

const agentAccessPath = 'src/AgentAccess.tsx';
let content = fs.readFileSync(agentAccessPath, 'utf8');

const physicalPackSection = `
        <section className="rounded-[24px] border border-[#60A5FA]/16 bg-[#60A5FA]/4 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#60A5FA]">
              <Database size={14} />
              Physical Systems Pack
            </div>
            <Pill color="#60A5FA">Machine Discoverable</Pill>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9bba5]">
            One public bundle for the physical coordination surfaces: node map, module registry, explicit handoffs, blueprint archive, and the three local planners. Public seeds are read-only. Planner routes remain local-session drafting surfaces.
          </p>
          <div className="mt-5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#60A5FA] mb-3">Public Seeded Manifests</h4>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mb-6">
              {physicalSystems.filter(r => r.state !== 'local_only').map((record) => (
                <div key={record.id} className="rounded-xl border border-white/6 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{record.label}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#8a7a64]">
                        {record.kind} · Seeded Public
                      </div>
                    </div>
                    <Pill color="#60A5FA">Read Only</Pill>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-[#b7c9be]">{record.notes}</p>
                  <div className="mt-3 rounded-lg border border-white/6 bg-black/20 px-2.5 py-2 text-[10px] text-[#a08c72]">
                    <div>route: <code className="text-[#eadfcd]">{record.route}</code></div>
                    {record.seed_url ? <div className="mt-1">seed: <code className="text-[#93C5FD]">{record.seed_url}</code></div> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={record.route}
                      className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#eadfcd] no-underline hover:bg-white/10 transition-colors"
                    >
                      Open Surface
                    </a>
                    {record.seed_url ? (
                      <a
                        href={record.seed_url}
                        className="rounded-full border border-[#60A5FA]/25 bg-[#60A5FA]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BFDBFE] no-underline hover:bg-[#60A5FA]/20 transition-colors"
                      >
                        Open Seed
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#D4A853] mb-3">Local Planners</h4>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {physicalSystems.filter(r => r.state === 'local_only').map((record) => (
                <div key={record.id} className="rounded-xl border border-white/6 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{record.label}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#8a7a64]">
                        {record.kind} · Local Only
                      </div>
                    </div>
                    <Pill color="#D4A853">Local</Pill>
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-[#b7c9be]">{record.notes}</p>
                  <div className="mt-3 rounded-lg border border-white/6 bg-black/20 px-2.5 py-2 text-[10px] text-[#a08c72]">
                    <div>route: <code className="text-[#eadfcd]">{record.route}</code></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={record.route}
                      className="rounded-full border border-[#D4A853]/25 bg-[#D4A853]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fcd34d] no-underline hover:bg-[#D4A853]/20 transition-colors"
                    >
                      Open Planner
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
`;

if (!content.includes('Physical Systems Pack')) {
  const insertIndex = content.indexOf('        {/* Technical API & Verification Matrix */}');
  content = content.slice(0, insertIndex) + physicalPackSection + '\n' + content.slice(insertIndex);
  
  if (!content.includes('type PhysicalSystemsIndexRecord')) {
      const typeStr = `type PhysicalSystemsIndexRecord = {
  id: string
  label: string
  kind: 'surface' | 'registry' | 'routing' | 'archive' | 'planner'
  state: 'seeded' | 'local_only' | 'live'
  route: string
  seed_url: string | null
  notes: string
}
`;
      const typeIndex = content.indexOf('const REMOTE_ENDPOINTS = [');
      content = content.slice(0, typeIndex) + typeStr + '\n' + content.slice(typeIndex);
  }
  
  if (!content.includes('const [physicalSystems')) {
      const stateStr = `  const [physicalSystems, setPhysicalSystems] = useState<PhysicalSystemsIndexRecord[]>([])\n`;
      const stateIndex = content.indexOf('const { taskEvents, receipts }');
      content = content.slice(0, stateIndex) + stateStr + content.slice(stateIndex);
  }
  
  if (!content.includes('physical_systems_index.json')) {
      const fetchStr = `    fetch('/physical_systems_index.json').then(r => r.json()).then((seed) => {
      if (Array.isArray(seed?.records)) setPhysicalSystems(seed.records)
    }).catch(console.error)\n`;
      const fetchIndex = content.indexOf('  }, [])');
      content = content.slice(0, fetchIndex) + fetchStr + content.slice(fetchIndex);
  }
  
  // also inject index link in hero
  const heroIndexStr = `        <section className="rounded-[28px] border border-[#34D399]/16 bg-black/30 px-6 py-8 backdrop-blur-sm md:px-8 relative">
          <div className="absolute top-6 right-6 md:top-8 md:right-8 hidden sm:block">
            <a href="/physical_systems_index.json" className="inline-flex items-center gap-1.5 rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#93C5FD] no-underline hover:bg-[#60A5FA]/20 transition-colors">
              <Database size={12} />
              Machine Index: Physical Pack
            </a>
          </div>`;
  content = content.replace('        <section className="rounded-[28px] border border-[#34D399]/16 bg-black/30 px-6 py-8 backdrop-blur-sm md:px-8">', heroIndexStr);
  
  fs.writeFileSync(agentAccessPath, content);
}
