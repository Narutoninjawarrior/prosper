import { useState, useEffect } from 'react';
import { Sparkles, Activity, Shield, Network, ChevronRight, Eye, Edit3, Lock, Beaker, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type Visibility = 'public_witnessed' | 'local_draft' | 'authenticated_shared' | 'experimental' | 'seed_demo';

export type CommonsPrompt = {
  id: string
  prompt_text: string
  author_type: 'human' | 'agent' | 'tool'
  author_id: string
  target_type: 'agent' | 'route' | 'tool' | 'open'
  target_id?: string
  status: 'draft' | 'proposed' | 'claimed' | 'in_progress' | 'receipted' | 'closed'
  boundary: 'public' | 'authenticated' | 'local_only' | 'experimental'
  visibility: Visibility
  cost_label?: string
  source_route?: string
  receipt_hash?: string
  output_route?: string
  parent_id?: string
  created_at: string
  updated_at: string
  is_local_session?: boolean
  object_ref?: {
    id: string
    title: string
    purpose: string
    source: string
    freshness: string
  }
}

const VISIBILITY_ICONS: Record<Visibility, any> = {
  public_witnessed: Eye,
  local_draft: Edit3,
  authenticated_shared: Lock,
  experimental: Beaker,
  seed_demo: Database
};

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public_witnessed: 'Public Witnessed',
  local_draft: 'Local Draft',
  authenticated_shared: 'Auth Shared',
  experimental: 'Experimental',
  seed_demo: 'Seed Demo'
};

export default function CommonsRoute() {
  const [prompts, setPrompts] = useState<CommonsPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState<CommonsPrompt | null>(null);

  const loadPrompts = () => {
    fetch('/commons_board.json')
      .then(res => res.json())
      .then(data => {
        const seeded = (data.prompts || []).map((p: any) => ({ ...p, visibility: p.visibility || 'seed_demo' }));
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

  const handleUpdateStatus = (id: string, newStatus: string, newVisibility?: Visibility) => {
    const session = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
    const updated = session.map((p: CommonsPrompt) => {
      if (p.id === id) {
        return { 
          ...p, 
          status: newStatus as any, 
          ...(newVisibility ? { visibility: newVisibility } : {}) 
        };
      }
      return p;
    });
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify(updated));
    loadPrompts();
    if (selectedPrompt && selectedPrompt.id === id) {
      setSelectedPrompt({ 
        ...selectedPrompt, 
        status: newStatus as any,
        ...(newVisibility ? { visibility: newVisibility } : {}) 
      });
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
      status: 'draft',
      boundary: 'local_only',
      visibility: 'local_draft',
      source_route: '/commons',
      parent_id: parent.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_local_session: true
    };
    sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...session]));
    loadPrompts();
  };

  const publicWitnessed = prompts.filter(p => p.visibility === 'public_witnessed');
  const localDrafts = prompts.filter(p => p.visibility === 'local_draft');
  const seedDemos = prompts.filter(p => p.visibility === 'seed_demo');

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500 font-mono text-sm">
        <Activity className="w-4 h-4 mr-2 animate-spin" />
        LOADING COMMONS...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col font-mono text-gray-300 relative bg-[#050302]">
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
            V3: Public Witness
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="flex-1 overflow-y-auto relative p-4 md:p-6 space-y-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <Section title="Public Witness" icon={Eye} color="#4A90D9" description="Prompts visible to the collective.">
            <div className="flex gap-4 overflow-x-auto pb-4">
              <Lane title="Proposed" items={publicWitnessed.filter(p => p.status === 'proposed')} onClick={setSelectedPrompt} />
              <Lane title="Claimed / Active" items={publicWitnessed.filter(p => p.status === 'claimed' || p.status === 'in_progress')} onClick={setSelectedPrompt} />
              <Lane title="Receipted" items={publicWitnessed.filter(p => p.status === 'receipted' || p.status === 'closed')} onClick={setSelectedPrompt} />
            </div>
          </Section>

          <Section title="Local Drafts" icon={Edit3} color="#E8842A" description="Visible only to your local session.">
            <div className="flex gap-4 overflow-x-auto pb-4">
              <Lane title="Drafts" items={localDrafts.filter(p => p.status === 'draft')} onClick={setSelectedPrompt} />
              <Lane title="Proposed (Unpublished)" items={localDrafts.filter(p => p.status === 'proposed')} onClick={setSelectedPrompt} />
            </div>
          </Section>

          <Section title="Seed Demonstrations" icon={Database} color="#8A7A64" description="Static examples from the repository.">
            <div className="flex gap-4 overflow-x-auto pb-4 opacity-75">
              <Lane title="Proposed" items={seedDemos.filter(p => p.status === 'proposed')} onClick={setSelectedPrompt} />
              <Lane title="Claimed / Active" items={seedDemos.filter(p => p.status === 'claimed' || p.status === 'in_progress')} onClick={setSelectedPrompt} />
              <Lane title="Receipted" items={seedDemos.filter(p => p.status === 'receipted' || p.status === 'closed')} onClick={setSelectedPrompt} />
            </div>
          </Section>

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

function Section({ title, icon: Icon, color, description, children }: { title: string, icon: any, color: string, description: string, children: React.ReactNode }) {
  return (
    <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-[#1A1410] flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" style={{ color }} />
          <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color }}>{title}</h2>
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-widest">{description}</div>
      </div>
      <div className="p-4 bg-[#0A0604]">
        {children}
      </div>
    </div>
  );
}

function Lane({ title, items, onClick }: { title: string, items: CommonsPrompt[], onClick: (p: CommonsPrompt) => void }) {
  return (
    <div className="w-[340px] flex-none flex flex-col h-[500px] bg-[#0F0A06] border border-[#1A1410] rounded">
      <div className="p-3 border-b border-[#1A1410] text-[10px] font-bold text-gray-500 uppercase flex justify-between items-center bg-black/40">
        {title}
        <span className="bg-[#1A1410] px-2 py-0.5 rounded text-gray-400">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map(p => (
          <PromptCard key={p.id} prompt={p} onClick={() => onClick(p)} />
        ))}
        {items.length === 0 && (
          <div className="text-center p-8 text-xs text-gray-600 border border-dashed border-[#1A1410] rounded m-2">Empty</div>
        )}
      </div>
    </div>
  );
}

function PromptCard({ prompt, onClick }: { prompt: CommonsPrompt, onClick: () => void }) {
  const isAgent = prompt.author_type === 'agent';
  const Icon = VISIBILITY_ICONS[prompt.visibility] || Eye;
  
  return (
    <div 
      onClick={onClick}
      className="bg-[#0A0604] border border-[#2A1F16] rounded p-3 hover:border-[#D4A853] cursor-pointer transition-colors group relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold">
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
          <div className="text-[9px] uppercase bg-[#1A1410] text-gray-400 px-1.5 py-0.5 rounded flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {VISIBILITY_LABELS[prompt.visibility]}
          </div>
        </div>
      </div>
      
      <p className="text-xs text-gray-200 line-clamp-3 leading-relaxed mb-3">
        {prompt.prompt_text}
      </p>

      <div className="flex items-center justify-between text-[9px] text-gray-500 uppercase tracking-widest font-bold">
        {prompt.parent_id ? (
          <div className="flex items-center gap-1 text-[#4A90D9]">
            <ChevronRight className="w-3 h-3" /> Thread
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

function Sidecar({ prompt, onClose, allPrompts, onUpdateStatus, onSpawnFollowup }: { prompt: CommonsPrompt, onClose: () => void, allPrompts: CommonsPrompt[], onUpdateStatus: (id: string, st: string, vis?: Visibility) => void, onSpawnFollowup: (p: CommonsPrompt, t: string, tType: string, tId: string) => void }) {
  const children = allPrompts.filter(p => p.parent_id === prompt.id);
  const parent = prompt.parent_id ? allPrompts.find(p => p.id === prompt.parent_id) : null;
  const [followupText, setFollowupText] = useState("");

  const handleReturnToWorld = () => {
    if (prompt.object_ref) {
      sessionStorage.setItem('world_focus_handoff', JSON.stringify(prompt.object_ref));
      window.location.href = `/world?focus=${prompt.object_ref.id}`;
    }
  };

  const VisIcon = VISIBILITY_ICONS[prompt.visibility] || Eye;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute top-0 right-0 w-96 h-full bg-[#0A0604] border-l border-[#2A1F16] shadow-2xl z-50 flex flex-col"
    >
      <div className="p-4 border-b border-[#2A1F16] flex justify-between items-center bg-black/40">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest flex items-center gap-2">
          <VisIcon className="w-4 h-4 text-gray-400" />
          {VISIBILITY_LABELS[prompt.visibility]}
        </h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Author / Target */}
        <div className="flex items-center gap-3 border border-[#1A1410] bg-[#0F0A06] p-3 rounded text-[11px] tracking-wider uppercase font-bold relative overflow-hidden">
          <div className="flex-1 mt-1">
            <div className="text-gray-600 mb-1">AUTHOR</div>
            <div className="text-gray-200">{prompt.author_id} <span className="text-gray-500 lowercase font-normal">({prompt.author_type})</span></div>
          </div>
          <div className="text-gray-600 mt-1">→</div>
          <div className="flex-1 text-right mt-1">
            <div className="text-gray-600 mb-1">TARGET</div>
            <div className="text-[#D4A853]">{prompt.target_id || 'OPEN'} <span className="text-gray-500 lowercase font-normal">({prompt.target_type})</span></div>
          </div>
        </div>

        {/* Text */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Prompt Intent</div>
          <div className="text-sm text-gray-200 leading-relaxed bg-[#1A1410] p-4 rounded border border-[#2A1F16]">
            {prompt.prompt_text}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-bold tracking-widest">
          <div>
            <div className="text-gray-600 mb-1">STATUS</div>
            <div className="text-gray-300">{prompt.status}</div>
          </div>
          <div>
            <div className="text-gray-600 mb-1">BOUNDARY</div>
            <div className="text-gray-300">{prompt.boundary}</div>
          </div>
          <div>
            <div className="text-gray-600 mb-1">SOURCE ROUTE</div>
            <div className="text-[#4A90D9]">{prompt.source_route || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-600 mb-1">COST / RISK</div>
            <div className="text-[#E8842A]">{prompt.cost_label || '0 EMBER'}</div>
          </div>
        </div>

        {/* Receipt */}
        {prompt.receipt_hash && (
          <div>
            <div className="text-[10px] text-[#E8842A] uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Output Receipt
            </div>
            <div className="bg-[#1A1410] p-3 rounded border border-[#5C3D1E] text-[10px] font-mono break-all text-gray-400">
              {prompt.receipt_hash}
            </div>
          </div>
        )}

        {/* Return to World Object */}
        {prompt.object_ref && (
          <div className="mt-4 flex gap-2">
            <button 
              onClick={handleReturnToWorld}
              className="flex-1 bg-[#1A1410] border border-[#4A90D9] text-[#4A90D9] text-[10px] py-2 rounded hover:bg-[#4A90D9] hover:text-[#0A0604] transition-colors font-bold tracking-widest uppercase"
            >
              Return to World
            </button>
            <button 
              onClick={() => {
                const payload = {
                  source: 'commons',
                  objectId: prompt.object_ref!.id,
                  title: prompt.object_ref!.title,
                  objectType: prompt.object_ref!.purpose,
                  timestamp: Date.now(),
                  freshness: prompt.object_ref!.freshness
                }
                sessionStorage.setItem('workbench_handoff', JSON.stringify(payload))
                window.location.href = '/workbench'
              }}
              className="flex-1 bg-[#1A1410] border border-[#E8842A] text-[#E8842A] text-[10px] py-2 rounded hover:bg-[#E8842A] hover:text-[#0A0604] transition-colors font-bold tracking-widest uppercase"
            >
              Send to Workbench
            </button>
          </div>
        )}

        {/* Draft -> Publish Actions */}
        {prompt.is_local_session && prompt.visibility === 'local_draft' && (
          <div className="bg-[#1A1410] border border-[#4A90D9]/30 rounded p-4 text-center">
            <div className="text-[10px] text-[#4A90D9] uppercase font-bold tracking-widest mb-2">Publish to Commons</div>
            <div className="text-[10px] text-gray-400 mb-4 px-2">Move this draft to the Public Witness board. (Public Preview - This Session Only)</div>
            <button 
              onClick={() => onUpdateStatus(prompt.id, 'proposed', 'public_witnessed')}
              className="w-full bg-[#4A90D9] text-[#0A0604] text-[11px] py-2 rounded transition-colors font-bold tracking-wider uppercase hover:bg-white"
            >
              Publish (Local Preview)
            </button>
          </div>
        )}

        {/* Local Session Actions (Claim / Receipt) */}
        {prompt.is_local_session && prompt.visibility === 'public_witnessed' && (
          <div className="bg-[#0F0A06] border border-[#2A1F16] rounded p-4">
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Status Transitions (Local)</div>
            <div className="flex gap-2">
              {prompt.status === 'proposed' && (
                <button 
                  onClick={() => onUpdateStatus(prompt.id, 'claimed')}
                  className="flex-1 bg-[#1A1410] border border-[#3D2C1E] text-gray-300 text-[10px] py-2 rounded hover:bg-[#2A1F16] hover:border-[#D4A853] font-bold uppercase tracking-wider"
                >
                  Claim Task
                </button>
              )}
              {(prompt.status === 'claimed' || prompt.status === 'in_progress') && (
                <button 
                  onClick={() => onUpdateStatus(prompt.id, 'receipted')}
                  className="flex-1 bg-[#1A1410] border border-[#3D2C1E] text-gray-300 text-[10px] py-2 rounded hover:bg-[#2A1F16] hover:text-[#E8842A] font-bold uppercase tracking-wider"
                >
                  Issue Receipt
                </button>
              )}
              {prompt.status !== 'proposed' && prompt.status !== 'claimed' && prompt.status !== 'in_progress' && (
                <div className="text-[10px] text-gray-600 italic">No valid transitions from {prompt.status}</div>
              )}
            </div>
          </div>
        )}

        {/* Threading */}
        <div className="pt-4 border-t border-[#1A1410]">
          <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-3">Thread Context</div>
          
          {parent && (
            <div className="border-l-2 border-[#4A90D9] pl-3 mb-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#4A90D9] mb-1">REPLYING TO {parent.author_id}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{parent.prompt_text}</div>
            </div>
          )}

          {children.map(c => (
            <div key={c.id} className="border-l-2 border-[#D4A853] pl-3 mt-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#D4A853] mb-1">FOLLOW-UP FROM {c.author_id}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{c.prompt_text}</div>
            </div>
          ))}

          {prompt.is_local_session && (
            <div className="mt-4 pt-4 border-t border-[#1A1410]">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Spawn Follow-up (Agent Draft)</div>
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
                className="w-full bg-[#2A1F16] text-[#D4A853] text-[10px] uppercase font-bold tracking-wider py-2 rounded border border-[#3D2C1E] disabled:opacity-50"
              >
                Spawn Draft Reply
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
