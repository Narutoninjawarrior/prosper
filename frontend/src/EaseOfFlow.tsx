import { useState } from 'react';
import { ClipboardCopy, Terminal, NotebookPen, Zap, Sparkles } from 'lucide-react';

const EaseOfFlow = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shortcuts = [
    { id: '1', name: 'Open Workspace in VS Code', cmd: '& "$env:LOCALAPPDATA\\Programs\\Microsoft VS Code\\bin\\code.cmd" "D:\\Hearth\\prosper2"', desc: 'Instantly opens the Hearth OS codebase in your code editor.' },
    { id: '2', name: 'Master Ignition Path', cmd: 'explorer %USERPROFILE%\\Desktop\\Hearth_Ignition.bat', desc: 'The filepath to our global boot sequence.' },
    { id: '3', name: 'Open Master Index', cmd: 'notepad D:\\Hearth\\MASTER_INDEX.md', desc: 'Opens the global map of the Hearth ecosystem for manual editing or review.' },
    { id: '4', name: 'Start LM Studio UI', cmd: 'http://localhost:1234', desc: 'Standard local Engine API Ping' },
    { id: '5', name: 'Boot Python Backend', cmd: 'python server.py', desc: 'Starts the FastAPI and MemPalace Ledger connection' },
    { id: '6', name: 'Vite Dev Server', cmd: 'npm run dev', desc: 'Starts the Hearth OS React Dashboard' },
    { id: '7', name: 'Trigger Heartbeat', cmd: 'python heartbeat.py', desc: 'Runs the Agent farming tick script manually' },
  ];

  return (
    <div className="flex w-full h-full gap-6 p-4">
      {/* SHORCUTS PANEL */}
      <div className="w-1/2 flex flex-col overflow-y-auto scrollbar-hide pr-2">
        <h2 className="text-xl font-bold text-[#10b981] mb-2 font-mono uppercase tracking-widest flex items-center gap-2"><Zap size={20}/> Action Shortcuts</h2>
        <p className="text-gray-400 mb-6 text-xs leading-relaxed">Click to copy vital system execution pathways directly to your clipboard.</p>
        
        <div className="grid grid-cols-1 gap-4">
          {shortcuts.map(sc => (
            <div key={sc.id} className="bg-black/40 border border-[#10b981]/20 rounded-xl p-4 flex flex-col gap-2 hover:border-[#10b981]/50 transition-all group shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
              <div className="flex justify-between items-start">
                  <span className="font-semibold text-sm text-gray-200">{sc.name}</span>
                  <button 
                    onClick={() => copyToClipboard(sc.cmd, sc.id)}
                    className="p-1.5 rounded-md bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/30 border border-[#10b981]/30 transition-all flex items-center gap-2"
                  >
                    <ClipboardCopy size={14}/>
                    <span className="text-[10px] font-bold uppercase">{copiedId === sc.id ? 'Copied!' : 'Copy'}</span>
                  </button>
              </div>
              <div className="bg-[#051a0d] border border-[#10b981]/10 rounded px-3 py-2 font-mono text-[11px] text-gray-300">
                &gt; {sc.cmd}
              </div>
              <span className="text-[10px] text-gray-500">{sc.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BULLETIN PANEL */}
      <div className="w-1/2 flex flex-col pb-4">
        <h2 className="text-xl font-bold text-[#10b981] mb-2 font-mono uppercase tracking-widest flex items-center gap-2"><NotebookPen size={20}/> Active Bulletin</h2>
        <p className="text-gray-400 mb-6 text-xs leading-relaxed">System updates, direct notes, and mission briefings pinned for easy reference.</p>
        
        <div className="flex-1 bg-black/30 border border-[#10b981]/20 rounded-xl p-6 overflow-y-auto scrollbar-hide shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] flex flex-col gap-6">
            
            {/* Note 1 */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[#10b981] font-mono text-xs font-bold border-b border-[#10b981]/20 pb-2">
                    <span className="flex items-center gap-2"><Sparkles size={14}/> UPDATE: EASE OF FLOW ONLINE</span>
                    <span className="text-gray-500">v1.99.6</span>
                </div>
                <div className="text-sm text-gray-300 leading-relaxed font-sans text-justify">
                    Malaky, this board is actively monitoring the OS state. Use the shortcuts on the left to quickly grab local terminal commands instead of typing them out from memory. As we build new Python scripts (like the Data Scraper or Ledger hooks), I will automatically pin their run commands here. 
                </div>
            </div>

            {/* Note 2 */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#d97706] font-mono text-xs font-bold border-b border-[#d97706]/20 pb-2 mt-4">
                    <Terminal size={14}/> SOLIS DIRECTIVE: LM STUDIO ENGINE
                </div>
                <div className="text-sm text-gray-300 leading-relaxed font-sans text-justify">
                    Remember: You must boot LM Studio separately and hit the "Start Server" button on the Local Server tab to link with Port 1234. Once started, the Multi-Tool Hub will display a green ping status, and you can chat with the inference engine locally!
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default EaseOfFlow;
