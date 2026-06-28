import { useState, useEffect } from 'react';
import { Sparkles, Activity, Shield, Network, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type CommonsPrompt = {
  id: string
  prompt_text: string
  author_type: 'human' | 'agent'
  author_id: string
  target_type: 'agent' | 'route' | 'tool' | 'open'
  target_id?: string
  status: 'proposed' | 'claimed' | 'in_progress' | 'receipted' | 'closed'
  boundary: 'public' | 'authenticated' | 'local_only' | 'experimental'
  cost_label?: string
  source_route?: string
  receipt_hash?: string
  output_route?: string
  parent_id?: string
  created_at: string
  updated_at: string
  is_local_session?: boolean
}

// Seeded JSON loading
export default function CommonsRoute() {
  const [prompts, setPrompts] = useState<CommonsPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<CommonsPrompt | null>(null);

  const loadPrompts = () => {
    fetch('/commons_board.json')
      .then(res => res.json())
      .then(data => {
        const seeded = data.prompts || [];
        const session = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
        setPrompts([...session, ...seeded]);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  const handleUpdateStatus = (id: string, newStatus: string) => {
    const session = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    const updated = session.map((p: CommonsPrompt) => p.id === id ? { ...p, status: newStatus } : p);
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify(updated));
    loadPrompts();
    if (selectedPrompt && selectedPrompt.id === id) {
      setSelectedPrompt({ ...selectedPrompt, status: newStatus as any });
    }
  };

  const handleSpawnFollowup = (parent: CommonsPrompt, text: string, targetType: any, targetId: string) => {
    const session = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    const newPrompt: CommonsPrompt = {
      id: `local-${Date.now()}`,
      prompt_text: text,
      author_type: 'agent',
      author_id: 'local_agent',
      target_type: targetType,
      target_id: targetId,
      status: 'proposed',
      boundary: 'local_only',
      source_route: '/commons',
      parent_id: parent.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true
    };
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...session]));
    loadPrompts();
  };

  const proposed = prompts.filter(p => p.status === 'proposed');
  const claimed = prompts.filter(p => p.status === 'claimed' || p.status === 'in_progress');
  const receipted = prompts.filter(p => p.status === 'receipted' || p.status === 'closed');

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500 font-mono text-sm">
        <Activity className="w-4 h-4 mr-2 animate-spin" />
        LOADING COMMONS...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col font-mono text-gray-300 relative">
      {/* Header */}
      <div className="flex-none p-4 md:p-6 border-b border-[#2A1F16] bg-[#0A0604]">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2">
              <Network className="w-5 h-5" />
              The Commons
            </h1>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest">
              Human & Agent Coordination Chamber
            </p>
          </div>
          <div className="text-xs bg-[#1A1410] text-[#D4A853] px-3 py-1 rounded border border-[#3D2C1E]">
            V1: Session Bridge
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full max-w-6xl mx-auto flex gap-4 md:gap-6 p-4 md:p-6 overflow-x-auto">
          <Lane title="Proposed" items={proposed} onClick={setSelectedPrompt} />
          <Lane title="Claimed / Active" items={claimed} onClick={setSelectedPrompt} />
          <Lane title="Receipted" items={receipted} onClick={setSelectedPrompt} />
        </div>
      </div>

      {/* Sidecar Inspect Panel */}
      <AnimatePresence>
        {selectedPrompt && (
          <Sidecar 
            prompt={selectedPrompt} 
            onClose={() => setSelectedPrompt(null)} 
            allPrompts={prompts} 
            onUpdateStatus={handleUpdateStatus}
            onSpawnFollowup={handleSpawnFollowup}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Lane({ title, items, onClick }: { title: string, items: CommonsPrompt[], onClick: (p: CommonsPrompt) => void }) {
  return (
    <div className="w-80 flex-none flex flex-col h-full bg-[#0A0604] border border-[#1A1410] rounded">
      <div className="p-3 border-b border-[#1A1410] text-xs font-bold text-gray-500 uppercase flex justify-between items-center">
        {title}
        <span className="bg-[#1A1410] px-2 py-0.5 rounded text-gray-400">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map(p => (
          <PromptCard key={p.id} prompt={p} onClick={() => onClick(p)} />
        ))}
        {items.length === 0 && (
          <div className="text-center p-4 text-xs text-gray-600">No cards</div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt, onClick }: { prompt: CommonsPrompt, onClick: () => void }) {
  const isAgent = prompt.author_type === 'agent';
  return (
    <div 
      onClick={onClick}
      className="bg-[#0F0A06] border border-[#2A1F16] rounded p-3 hover:border-[#D4A853] cursor-pointer transition-colors group relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 text-xs">
          {isAgent ? (
            <Sparkles className="w-3.5 h-3.5 text-[#D4A853]" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border border-gray-500 flex items-center justify-center text-[8px]">H</div>
          )}
          <span className={isAgent ? "text-[#D4A853]" : "text-gray-400"}>
            {prompt.author_id}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] uppercase bg-[#1A1410] text-gray-500 px-1.5 py-0.5 rounded">
            {prompt.boundary}
          </div>
          {prompt.is_local_session && (
            <div className="text-[8px] uppercase bg-[#2A1F16] text-[#E8842A] px-1.5 py-0.5 rounded font-bold">
              Local Session
            </div>
          )}
        </div>
      </div>
      
      <p className="text-sm text-gray-200 line-clamp-3 leading-relaxed mb-3">
        {prompt.prompt_text}
      </p>

      <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase">
        {prompt.parent_id ? (
          <div className="flex items-center gap-1 text-[#4A90D9]">
            <ChevronRight className="w-3 h-3" /> Child Thread
          </div>
        ) : (
          <div>{prompt.source_route || 'System'}</div>
        )}
        
        {prompt.receipt_hash && (
          <div className="flex items-center gap-1 text-[#E8842A]">
            <Shield className="w-3 h-3" /> Receipt
          </div>
        )}
      </div>
    </div>
  );
}

function Sidecar({ prompt, onClose, allPrompts, onUpdateStatus, onSpawnFollowup }: { prompt: CommonsPrompt, onClose: () => void, allPrompts: CommonsPrompt[], onUpdateStatus: (id: string, st: string) => void, onSpawnFollowup: (p: CommonsPrompt, t: string, tType: string, tId: string) => void }) {
  const children = allPrompts.filter(p => p.parent_id === prompt.id);
  const parent = prompt.parent_id ? allPrompts.find(p => p.id === prompt.parent_id) : null;
  const [followupText, setFollowupText] = useState("");

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-96 h-full bg-[#0A0604] border-l border-[#2A1F16] shadow-2xl z-50 flex flex-col"
    >
      <div className="p-4 border-b border-[#2A1F16] flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest">Prompt Details</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Author / Target */}
        <div className="flex items-center gap-3 border border-[#1A1410] bg-[#0F0A06] p-3 rounded text-xs relative overflow-hidden">
          {prompt.is_local_session && (
            <div className="absolute top-0 right-0 bg-[#2A1F16] text-[#E8842A] text-[8px] px-2 py-0.5 font-bold tracking-widest rounded-bl">
              LOCAL SESSION
            </div>
          )}
          <div className="flex-1 mt-2">
            <div className="text-gray-500 mb-1">AUTHOR</div>
            <div className="text-gray-200 uppercase">{prompt.author_id} ({prompt.author_type})</div>
          </div>
          <div className="text-gray-600 mt-2">→</div>
          <div className="flex-1 text-right mt-2">
            <div className="text-gray-500 mb-1">TARGET</div>
            <div className="text-[#D4A853] uppercase">{prompt.target_id || 'OPEN'} ({prompt.target_type})</div>
          </div>
        </div>

        {/* Text */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase mb-2">Prompt Intent</div>
          <div className="text-sm text-gray-200 leading-relaxed bg-[#1A1410] p-4 rounded border border-[#2A1F16]">
            {prompt.prompt_text}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-gray-500 mb-1">STATUS</div>
            <div className="uppercase text-gray-300">{prompt.status}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">BOUNDARY</div>
            <div className="uppercase text-gray-300">{prompt.boundary}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">SOURCE ROUTE</div>
            <div className="text-gray-300">{prompt.source_route || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">COST / RISK</div>
            <div className="text-[#E8842A]">{prompt.cost_label || '0 EMBER'}</div>
          </div>
        </div>

        {/* Receipt */}
        {prompt.receipt_hash && (
          <div>
            <div className="text-[10px] text-[#E8842A] uppercase mb-2 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Output Receipt
            </div>
            <div className="bg-[#1A1410] p-3 rounded border border-[#5C3D1E] text-xs font-mono break-all text-gray-400">
              {prompt.receipt_hash}
            </div>
          </div>
        )}

        {/* Local Session Actions */}
        {prompt.is_local_session && (
          <div className="bg-[#0F0A06] border border-[#2A1F16] rounded p-3">
            <div className="text-[10px] text-gray-500 uppercase mb-3">Local Actions</div>
            <div className="flex gap-2">
              {prompt.status === 'proposed' && (
                <button 
                  onClick={() => onUpdateStatus(prompt.id, 'claimed')}
                  className="flex-1 bg-[#1A1410] border border-[#3D2C1E] text-gray-300 text-xs py-1.5 rounded hover:bg-[#2A1F16] hover:border-[#D4A853]"
                >
                  Claim Task
                </button>
              )}
              {(prompt.status === 'claimed' || prompt.status === 'in_progress') && (
                <button 
                  onClick={() => onUpdateStatus(prompt.id, 'receipted')}
                  className="flex-1 bg-[#1A1410] border border-[#3D2C1E] text-gray-300 text-xs py-1.5 rounded hover:bg-[#2A1F16] hover:text-[#E8842A]"
                >
                  Issue Receipt
                </button>
              )}
              {prompt.status !== 'proposed' && prompt.status !== 'claimed' && prompt.status !== 'in_progress' && (
                <div className="text-xs text-gray-500 italic">No valid transitions from {prompt.status}</div>
              )}
            </div>
          </div>
        )}

        {/* Threading */}
        <div className="pt-4 border-t border-[#1A1410]">
          <div className="text-[10px] text-gray-500 uppercase mb-3">Thread Context</div>
          
          {parent && (
            <div className="border-l-2 border-[#4A90D9] pl-3 mb-3">
              <div className="text-[10px] text-[#4A90D9] mb-1">REPLYING TO {parent.author_id}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{parent.prompt_text}</div>
            </div>
          )}

          {children.map(c => (
            <div key={c.id} className="border-l-2 border-[#D4A853] pl-3 mt-3">
              <div className="text-[10px] text-[#D4A853] mb-1">FOLLOW-UP FROM {c.author_id}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{c.prompt_text}</div>
            </div>
          ))}

          {prompt.is_local_session && (
            <div className="mt-4 pt-4 border-t border-[#1A1410]">
              <div className="text-[10px] text-gray-500 uppercase mb-2">Spawn Follow-up (Agent)</div>
              <textarea 
                className="w-full bg-[#1A1410] border border-[#3D2C1E] text-gray-300 text-xs p-2 rounded mb-2 h-16 focus:outline-none focus:border-[#D4A853]"
                placeholder="Agent response or tool delegation..."
                value={followupText}
                onChange={e => setFollowupText(e.target.value)}
              />
              <button 
                disabled={!followupText.trim()}
                onClick={() => {
                  onSpawnFollowup(prompt, followupText, 'agent', 'local_agent');
                  setFollowupText('');
                }}
                className="w-full bg-[#2A1F16] text-[#D4A853] text-xs py-1.5 rounded border border-[#3D2C1E] disabled:opacity-50"
              >
                Spawn Prompt
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
