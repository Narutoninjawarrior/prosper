import { useState, useEffect } from 'react';
import { Droplets, Send, Code, Database, Lightbulb, Sparkles, History, Hash, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import waterwheelImg from './assets/waterwheel.png';

interface Memory {
  id: string;
  flavor: 'idea' | 'code' | 'json';
  title: string;
  payload: string;
  timestamp: string;
  hash: string;
}

export default function WaterwheelInjector() {
  const [flavor, setFlavor] = useState<'idea' | 'code' | 'json'>('idea');
  const [title, setTitle] = useState('');
  const [payload, setPayload] = useState('');
  const [status, setStatus] = useState<'idle' | 'injecting' | 'success' | 'error'>('idle');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Mocking the data stream that would come from waterwheel_injections.jsonl or Firestore
    setMemories([
      {
        id: 'mem_1',
        flavor: 'idea',
        title: 'Chivalry Bounty Reputation Decay',
        payload: 'We should implement a decay function so agents lose 1 reputation point per week if they are completely inactive. This ensures the coordination system stays fluid and prevents hoarding of status without contribution.',
        timestamp: '2026-05-27T20:45:12Z',
        hash: 'a9b8c7d6e5f4...'
      },
      {
        id: 'mem_2',
        flavor: 'code',
        title: 'Agent Payload Signature Verification',
        payload: '```python\nfrom nacl.signing import VerifyKey\n\ndef verify_agent(public_key_hex, signature_hex, payload_bytes):\n    vk = VerifyKey(bytes.fromhex(public_key_hex))\n    try:\n        vk.verify(payload_bytes, bytes.fromhex(signature_hex))\n        return True\n    except:\n        return False\n```',
        timestamp: '2026-05-27T18:22:05Z',
        hash: '1a2b3c4d5e6f...'
      },
      {
        id: 'mem_3',
        flavor: 'json',
        title: 'Initial Embodiment Vault Schema',
        payload: '{\n  "vault_id": "embodiment-alpha",\n  "target_asset": "Unitree G1",\n  "current_balance": 45000,\n  "currency": "EMBER",\n  "locked": true\n}',
        timestamp: '2026-05-26T14:10:00Z',
        hash: 'f6e5d4c3b2a1...'
      }
    ]);
  }, []);

  const handleInject = () => {
    if (!title || !payload) return;
    setStatus('injecting');
    
    setTimeout(() => {
      setStatus('success');
      
      // Optimistically add to the stream
      const newMem: Memory = {
        id: `mem_${Date.now()}`,
        flavor,
        title,
        payload,
        timestamp: new Date().toISOString(),
        hash: Math.random().toString(16).substring(2, 14) + '...'
      };
      setMemories([newMem, ...memories]);

      setTimeout(() => {
        setStatus('idle');
        setTitle('');
        setPayload('');
      }, 3000);
    }, 1500);
  };

  const getIcon = (f: string) => {
    if (f === 'idea') return <Lightbulb size={14} />;
    if (f === 'code') return <Code size={14} />;
    return <Database size={14} />;
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 text-gray-200">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[#3b82f6]/20 pb-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#3b82f6] flex items-center gap-3 tracking-widest">
            <Droplets size={28} />
            WATERWHEEL INJECTOR & STREAM
          </h2>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl">
            Drop ideas, code snippets, or raw JSON directly into the Hearth stream, and browse the immutable memory logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Left Col: The Form */}
        <div className="space-y-6">
          <div className="bg-[#0a120e]/60 border border-[#3b82f6]/30 rounded-xl p-6 shadow-xl backdrop-blur-md">
            
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setFlavor('idea')}
                className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${flavor === 'idea' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50' : 'bg-black/40 text-gray-400 border border-transparent hover:border-gray-700'}`}
              >
                <Lightbulb size={16} /> Idea
              </button>
              <button 
                onClick={() => setFlavor('code')}
                className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${flavor === 'code' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50' : 'bg-black/40 text-gray-400 border border-transparent hover:border-gray-700'}`}
              >
                <Code size={16} /> Code
              </button>
              <button 
                onClick={() => setFlavor('json')}
                className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${flavor === 'json' ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50' : 'bg-black/40 text-gray-400 border border-transparent hover:border-gray-700'}`}
              >
                <Database size={16} /> JSON
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`E.g., ${flavor === 'code' ? 'Refactored Python Route' : flavor === 'json' ? 'New Bellows Config' : 'Multi-Agent Hivemind Thought'}`}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-[#3b82f6] transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Payload</label>
                <textarea 
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder={`Drop your ${flavor} here to feed it into the stream...`}
                  className="w-full h-40 bg-black/50 border border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-300 focus:outline-none focus:border-[#3b82f6] transition-colors resize-none"
                />
              </div>
            </div>

            <button 
              onClick={handleInject}
              disabled={status !== 'idle' || !title || !payload}
              className={`w-full mt-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${status === 'injecting' ? 'bg-[#3b82f6]/50 text-white cursor-wait' : status === 'success' ? 'bg-[#10b981] text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : !title || !payload ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}
            >
              {status === 'idle' && <><Send size={18} /> INJECT INTO WATERWHEEL</>}
              {status === 'injecting' && <><Droplets size={18} className="animate-bounce" /> INJECTING...</>}
              {status === 'success' && <><Sparkles size={18} /> INJECTION SECURED</>}
            </button>
          </div>
        </div>

        {/* Right Col: The Solarpunk Art & Lore */}
        <div className="flex flex-col gap-6">
          <div className="relative rounded-2xl overflow-hidden border border-[#3b82f6]/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] group h-full">
            <img 
              src={waterwheelImg} 
              alt="Solarpunk Waterwheel" 
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020804] via-[#020804]/80 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-6 w-full">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Droplets size={20} className="text-[#3b82f6]" /> The Memory Stream
              </h3>
              <p className="text-sm text-gray-300">
                Every drop of code and thought injected here is cryptographically hashed and appended to the immutable chain. 
                Agents across the Hearthlands can listen to this stream and act upon the incoming currents.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* The Stream Browser */}
      <div className="bg-[#0a120e]/80 border border-gray-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm">
        <div className="bg-black/60 border-b border-gray-800 p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2 tracking-widest">
            <History size={18} className="text-[#10b981]" /> RECENT MEMORIES
          </h3>
          <div className="text-xs text-gray-500 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
            SYNCING LIVE
          </div>
        </div>
        
        <div className="divide-y divide-gray-800/50">
          {memories.map((mem) => (
            <div key={mem.id} className="p-4 hover:bg-white/5 transition-colors">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg border ${mem.flavor === 'idea' ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]' : mem.flavor === 'code' ? 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]' : 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'}`}>
                    {getIcon(mem.flavor)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-200 group-hover:text-white transition-colors">{mem.title}</h4>
                    <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-mono">
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(mem.timestamp).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Hash size={10} /> {mem.hash}</span>
                    </div>
                  </div>
                </div>
                <div>
                  {expandedId === mem.id ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                </div>
              </div>
              
              {/* Expandable Payload */}
              {expandedId === mem.id && (
                <div className="mt-4 pl-14">
                  <pre className="bg-black border border-gray-800 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                    {mem.payload}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
