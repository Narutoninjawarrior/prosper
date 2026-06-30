const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'CommonsRoute.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update Section definition
code = code.replace(
  /function Section\(\{\s*title,\s*icon:\s*Icon,\s*color,\s*description,\s*children\s*\}\s*:\s*\{\s*title:\s*string,\s*icon:\s*any,\s*color:\s*string,\s*description:\s*string,\s*children:\s*React\.ReactNode\s*\}\)\s*\{[\s\S]*?(?=function Lane)/m,
  `function Section({ title, icon: Icon, color, description, children, defaultExpanded = true }: { title: string, icon: any, color: string, description: string, children: React.ReactNode, defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = require('react').useState(defaultExpanded);
  return (
    <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
      <div 
        className="p-4 border-b border-[#1A1410] flex items-center justify-between bg-black/20 cursor-pointer hover:bg-black/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" style={{ color }} />
          <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color }}>{title}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 uppercase tracking-widest">{description}</div>
          <ChevronRight className={\`w-4 h-4 text-gray-500 transition-transform \${expanded ? 'rotate-90' : ''}\`} />
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

// 2. Add defaultExpanded={false} to specific sections
code = code.replace(
  /<Section title="Local Artifacts"/g,
  '<Section defaultExpanded={false} title="Local Artifacts"'
);
code = code.replace(
  /<Section title="Local Drafts"/g,
  '<Section defaultExpanded={false} title="Local Drafts"'
);
code = code.replace(
  /<Section title="Seed Demonstrations"/g,
  '<Section defaultExpanded={false} title="Seed Demonstrations"'
);

// 3. Remove Audio completely from header
const audioHeaderRegex = /<div className="flex items-center gap-3">[\s\S]*?<div className="text-xs bg-\[#1A1410\] text-\[#D4A853\] px-3 py-1\.5 rounded border border-\[#3D2C1E\] flex flex-col items-end">/m;
code = code.replace(audioHeaderRegex, `<div className="flex items-center gap-3">\n            <div className="text-xs bg-[#1A1410] text-[#D4A853] px-3 py-1.5 rounded border border-[#3D2C1E] flex flex-col items-end">`);

fs.writeFileSync(filePath, code);
console.log('CommonsRoute.tsx updated');
