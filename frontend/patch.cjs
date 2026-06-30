const fs = require('fs');
const path = require('path');
const p = path.resolve('src/world/WorldObject.tsx');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  "import { X, RefreshCw, GitCommit, Thermometer, Droplet, ArrowRight, Activity, Sun } from 'lucide-react';",
  "import { X, RefreshCw, GitCommit, Thermometer, Droplet, ArrowRight, Activity, Sun, Copy, ChevronLeft, ChevronRight } from 'lucide-react';"
);

content = content.replace(
  'interface WorldObjectProps {\n  objectId:',
  'interface WorldObjectProps {\n  onNext?: () => void;\n  onPrev?: () => void;\n  objectId:'
);

content = content.replace(
  'export default function WorldObject({ objectId, position, autoOpen = false, onClose }: WorldObjectProps) {',
  'export default function WorldObject({ objectId, position, autoOpen = false, onClose, onNext, onPrev }: WorldObjectProps) {'
);

const escHook = `
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        if (onClose) onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);
`;

content = content.replace(
  '  const handleInteract = (e: { stopPropagation: () => void }) => {',
  escHook + '\n  const handleInteract = (e: { stopPropagation: () => void }) => {'
);

const headerReplacement = `              <div className="flex items-center gap-1.5">
                {onPrev && (
                  <button onClick={onPrev} className="p-1 rounded border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition">
                    <ChevronLeft size={14} />
                  </button>
                )}
                {onNext && (
                  <button onClick={onNext} className="p-1 rounded border border-white/10 hover:bg-white/5 text-[#8E7E6B] hover:text-white transition">
                    <ChevronRight size={14} />
                  </button>
                )}
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button 
                  onClick={fetchObjectData}`;

content = content.replace(
  '              <div className="flex items-center gap-2">\r\n                <button \r\n                  onClick={fetchObjectData}',
  headerReplacement
);

content = content.replace(
  '              <div className="flex items-center gap-2">\n                <button \n                  onClick={fetchObjectData}',
  headerReplacement
);

const truthStrip = `            {/* Truth Strip */}
            <div className="flex flex-wrap gap-2 pt-3 pb-1">
              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] uppercase tracking-wider text-[#8E7E6B]">
                Source: {objectId === 'somatic-sensor' ? 'local-only' : 'live api'}
              </span>
              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] uppercase tracking-wider text-[#8E7E6B]">
                Access: {objectId === 'somatic-sensor' ? 'prototype' : 'read-only'}
              </span>
              <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[9px] uppercase tracking-wider text-[#8E7E6B]">
                Freshness: {(data as any)?.updated_at ? new Date((data as any).updated_at).toLocaleTimeString() : (data ? 'seeded' : 'unknown')}
              </span>
            </div>

            {/* Loader */}`;

content = content.replace('{/* Loader */}', truthStrip);

const machineBlock = `                )}
              </div>
            )}

            {/* Action Links & Machine Affordance */}
            {!loading && !error && data && (
              <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {objectId === 'rain-barrel' && (
                    <>
                      <a href="/treasury" className="px-3 py-1.5 bg-[#4A90D9]/10 text-[#4A90D9] border border-[#4A90D9]/20 rounded-md text-xs font-semibold hover:bg-[#4A90D9]/20 transition">Treasury Dashboard</a>
                      <a href="/activity" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Recent Activity</a>
                    </>
                  )}
                  {objectId === 'seed-vault' && (
                    <>
                      <a href="/registry" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Skill Registry</a>
                      <a href="/agent-access" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Agent Access</a>
                    </>
                  )}
                  {objectId === 'steward-log' && (
                    <>
                      <a href="/activity" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Steward Activity</a>
                      <a href="/hall" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Hall of Honor</a>
                    </>
                  )}
                  {objectId === 'inspiration-forge' && (
                    <>
                      <a href="/forge" className="px-3 py-1.5 bg-[#FF9B30]/10 text-[#FF9B30] border border-[#FF9B30]/20 rounded-md text-xs font-semibold hover:bg-[#FF9B30]/20 transition">Enter Forge</a>
                      <a href="/workbench" className="px-3 py-1.5 bg-white/5 text-white/70 border border-white/10 rounded-md text-xs font-semibold hover:bg-white/10 transition">Agent Workbench</a>
                    </>
                  )}
                  {objectId === 'somatic-sensor' && (
                    <span className="px-3 py-1.5 bg-white/5 text-white/40 border border-white/10 rounded-md text-xs font-semibold italic">
                      Experimental - No public downstream
                    </span>
                  )}
                </div>

                <div className="bg-black/40 border border-white/5 rounded-lg p-3 flex items-start justify-between">
                  <div className="font-mono text-[10px] text-[#8E7E6B] space-y-1">
                    <div><span className="text-white/40">ID:</span> {objectId}</div>
                    <div><span className="text-white/40">API:</span> /api/world/{objectId}</div>
                    <div><span className="text-white/40">ROUTE:</span> /observatory#{objectId}</div>
                    <div><span className="text-white/40">STATUS:</span> {(data as any)?.status || 'active'}</div>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(JSON.stringify({ id: objectId, api: \`/api/world/\${objectId}\`, route: \`/observatory#\${objectId}\` }, null, 2))}
                    className="p-1.5 rounded bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition"
                    title="Copy technical manifest"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
            </div>,`;

content = content.replace(
  '                )}              </div>\r\n            )}\r\n          </div>\r\n            </div>,',
  machineBlock
);

content = content.replace(
  '                )}              </div>\n            )}\n          </div>\n            </div>,',
  machineBlock
);

fs.writeFileSync(p, content, 'utf8');
console.log('Success');
