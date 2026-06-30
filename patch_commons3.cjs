const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'CommonsRoute.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update Section definition to support itemCount and Show/Hide button
code = code.replace(
  /function Section\(\{\s*title,\s*icon:\s*Icon,\s*color,\s*description,\s*children,\s*defaultExpanded\s*=\s*true\s*\}\s*:\s*\{\s*title:\s*string,\s*icon:\s*any,\s*color:\s*string,\s*description:\s*string,\s*children:\s*React\.ReactNode,\s*defaultExpanded\?:\s*boolean\s*\}\)\s*\{[\s\S]*?(?=function Lane)/m,
  `function Section({ title, icon: Icon, color, description, children, defaultExpanded = true, itemCount }: { title: string, icon: any, color: string, description: string, children: React.ReactNode, defaultExpanded?: boolean, itemCount?: number }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
      <div 
        className="p-4 border-b border-[#1A1410] flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" style={{ color }} />
          <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color }}>{title}</h2>
          {!expanded && itemCount !== undefined && (
            <span className="text-xs text-gray-500 bg-[#1A1410] px-2 py-0.5 rounded border border-[#2A1F16]">
              {itemCount} items
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 uppercase tracking-widest">{description}</div>
          <button className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded bg-[#1A1410] text-gray-400 border border-[#2A1F16] hover:text-white transition-colors">
            {expanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="p-4 bg-[#0A0604]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

`
);

// 2. Add itemCount to calls
code = code.replace(
  /<Section defaultExpanded=\{false\} title="Local Artifacts"/g,
  '<Section defaultExpanded={false} title="Local Artifacts" itemCount={localArtifacts.length}'
);
code = code.replace(
  /<Section defaultExpanded=\{false\} title="Local Drafts"/g,
  '<Section defaultExpanded={false} title="Local Drafts" itemCount={localDrafts.length}'
);
code = code.replace(
  /<Section defaultExpanded=\{false\} title="Seed Demonstrations"/g,
  '<Section defaultExpanded={false} title="Seed Demonstrations" itemCount={seedDemos.length}'
);

fs.writeFileSync(filePath, code);
console.log('CommonsRoute.tsx updated for show/hide logic');
