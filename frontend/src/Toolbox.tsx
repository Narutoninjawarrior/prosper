import { useEffect, useMemo, useState } from 'react';
import { Wrench, CodeSquare, ExternalLink, SlidersHorizontal, Save } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { useLMStudioStore } from './store';

const tools = [
  { name: 'Data Scraper Python Hook', status: 'Pending Config', icon: <CodeSquare size={20}/> },
  { name: 'Community Mutual-Aid Sync', status: 'Firebase Configured', icon: <ExternalLink size={20}/> },
  { name: 'MemPalace Ingestion Override', status: 'Active', icon: <Wrench size={20}/> }
];

const Toolbox = () => {
  const { temperature, maxTokens, systemPromptOverride, setParameters, soulfile, loadSoulfile, saveSoulfile } =
    useLMStudioStore();
  
  const [localTemp, setLocalTemp] = useState(temperature);
  const [localTokens, setLocalTokens] = useState(maxTokens);
  const [localPrompt, setLocalPrompt] = useState(systemPromptOverride);
  const [localName, setLocalName] = useState('');
  const [localType, setLocalType] = useState('');

  const derivedPersonaPrompt = useMemo(() => {
    if (!soulfile) return '';
    const parts = [
      `You are ${soulfile.name} (${soulfile.type}).`,
      soulfile.physical_state?.current_action
        ? `Current action: ${soulfile.physical_state.current_action}.`
        : null,
      soulfile.mempalace_wing_ref ? `MemPalace wing: ${soulfile.mempalace_wing_ref}.` : null,
      `You are running inside Hearth OS. Be concise, solarpunk, and ethical.`,
    ].filter(Boolean);
    return parts.join('\n');
  }, [soulfile]);

  useEffect(() => {
    loadSoulfile().catch(() => {});
  }, [loadSoulfile]);

  useEffect(() => {
    if (!soulfile) return;
    setLocalName(soulfile.name ?? '');
    setLocalType(soulfile.type ?? '');
    const nextPrompt =
      (typeof soulfile.persona_prompt === 'string' && soulfile.persona_prompt.trim().length > 0
        ? soulfile.persona_prompt
        : derivedPersonaPrompt) || '';
    setLocalPrompt(nextPrompt);
  }, [soulfile, derivedPersonaPrompt]);

  const handleSave = () => {
    setParameters(localTemp, localTokens, localPrompt);
    if (!soulfile) return;
    saveSoulfile({
      ...soulfile,
      name: localName || soulfile.name,
      type: localType || soulfile.type,
      persona_prompt: localPrompt,
    }).catch(() => {});
  };

  return (
    <div className="flex w-full h-full gap-4">
        {/* Left Column: Tools */}
        <div className="w-1/3 flex flex-col border-r border-[#10b981]/10 pr-6 overflow-y-auto scrollbar-hide">
            <h2 className="text-xl font-bold text-[#10b981] mb-2 font-mono uppercase tracking-widest flex items-center gap-2 mt-2"><Wrench size={20}/> Multi-Tool Hub</h2>
            <p className="text-gray-400 mb-6 text-xs leading-relaxed text-justify">Mount local Python automation scripts and tune the offline inference parameters.</p>
            
            {/* PARAMETER TUNER */}
            <div className="bg-black/40 border border-[#10b981]/30 rounded-xl p-4 mb-6 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                <h3 className="text-[#10b981] font-mono font-bold text-[11px] uppercase mb-4 flex items-center gap-2"><SlidersHorizontal size={14}/> Local Parameter Tuner</h3>
                
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-400 font-mono">Agent Name</span>
                            <input
                              value={localName}
                              onChange={(e) => setLocalName(e.target.value)}
                              className="w-full bg-[#0a120e] border border-[#10b981]/20 rounded-lg px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-[#10b981] transition-all font-mono"
                              placeholder="Prosper2"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-400 font-mono">Agent Type</span>
                            <input
                              value={localType}
                              onChange={(e) => setLocalType(e.target.value)}
                              className="w-full bg-[#0a120e] border border-[#10b981]/20 rounded-lg px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-[#10b981] transition-all font-mono"
                              placeholder="Lead Developer AI"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Temperature (Logic vs Creativity)</span>
                            <span className="text-[#10b981]">{localTemp}</span>
                        </div>
                        <input type="range" min="0" max="2" step="0.1" value={localTemp} onChange={(e) => setLocalTemp(parseFloat(e.target.value))} className="w-full accent-[#10b981]" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                            <span>Max Tokens (-1 is Infinite)</span>
                            <span className="text-[#10b981]">{localTokens}</span>
                        </div>
                        <input type="range" min="-1" max="4096" step="1" value={localTokens} onChange={(e) => setLocalTokens(parseInt(e.target.value))} className="w-full accent-[#10b981]" />
                    </div>

                    <div className="flex flex-col gap-1 mt-2">
                        <span className="text-[10px] text-gray-400 font-mono mb-1">System Prompt (Soulfile Payload)</span>
                        <textarea value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} className="w-full h-24 bg-[#0a120e] border border-[#10b981]/20 rounded-lg p-2 text-[10px] text-gray-300 outline-none focus:border-[#10b981] transition-all resize-none font-mono"></textarea>
                    </div>

                    <button onClick={handleSave} className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-[#10b981]/10 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/50 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all">
                        <Save size={14}/> Inject Paramaters to Port 1234
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {tools.map((tool, i) => (
                <div key={i} className="bg-black/20 p-4 rounded-xl border border-[#10b981]/20 hover:border-[#10b981]/40 shadow-[0_4px_10px_rgba(0,0,0,0.2)] transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center group-hover:scale-110 transition-transform">
                            {tool.icon}
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-gray-200 text-sm font-semibold">{tool.name}</h3>
                            <span className={`text-[10px] mt-1 uppercase w-fit px-2 py-0.5 rounded border font-mono ${tool.status === 'Active' ? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10' : 'text-gray-400 border-gray-600 bg-gray-800/50'}`}>
                                {tool.status}
                            </span>
                        </div>
                    </div>
                </div>
                ))}
            </div>
        </div>

        {/* Right Column: Inference Chat */}
        <div className="w-2/3 h-full flex flex-col p-2">
            <ChatInterface />
        </div>
    </div>
  );
};

export default Toolbox;
