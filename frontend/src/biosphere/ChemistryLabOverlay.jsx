import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getFirebaseAuth } from '../firebaseAuth';

const REAGENTS = [
  { id: 'ember_dust', name: 'Ember Dust', icon: '✨', color: '#E8842A' },
  { id: 'salt', name: 'Salt Crystals', icon: '🧂', color: '#B8D4E8' },
  { id: 'ash', name: 'Wood Ash', icon: '🌑', color: '#6B7280' },
  { id: 'pollen', name: 'Golden Pollen', icon: '🌼', color: '#FCD34D' },
  { id: 'moonstone', name: 'Moonstone', icon: '🌙', color: '#C4B5FD' },
  { id: 'chain_dust', name: 'Chain Dust', icon: '⛓️', color: '#AA88FF' },
  { id: 'brine', name: 'Superheated Brine', icon: '🧪', color: '#38BDF8' },
  { id: 'soil', name: 'Fertile Soil', icon: '🌱', color: '#78350F' }
];

export default function ChemistryLabOverlay({ onClose }) {
  const [reagentA, setReagentA] = useState('ember_dust');
  const [reagentB, setReagentB] = useState('salt');
  const [targetType, setTargetType] = useState('flora');
  
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  const handleMix = async () => {
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      // In local dev this hits the Vite proxy, in prod it hits the rewrite
      const res = await fetch('/api/chemistry/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reagent_a: reagentA,
          reagent_b: reagentB,
          target_type: targetType
        })
      });
      if (!res.ok) {
        throw new Error(`Oracle rejected combination: ${res.statusText}`);
      }
      const data = await res.json();
      setReceipt(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
      <div className="relative w-full max-w-2xl bg-slate-900/90 border border-[#D4A853]/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-[#D4A853]/20 to-transparent">
          <div>
            <div className="text-[#D4A853] text-xs font-mono uppercase tracking-widest mb-1">Apparatus · Reagent Alembic</div>
            <h2 className="text-2xl font-bold text-[#FAF6EF]">Alchemical Workbench</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center font-mono"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono text-[#8E7E6B] uppercase mb-2">Reagent A</label>
              <select 
                value={reagentA}
                onChange={(e) => setReagentA(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[#4A90D9] focus:outline-none focus:ring-1 focus:ring-[#4A90D9] transition-all"
              >
                {REAGENTS.map(r => (
                  <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-white/50 text-xs font-mono">
                +
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8E7E6B] uppercase mb-2">Reagent B</label>
              <select 
                value={reagentB}
                onChange={(e) => setReagentB(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[#4A90D9] focus:outline-none focus:ring-1 focus:ring-[#4A90D9] transition-all"
              >
                {REAGENTS.map(r => (
                  <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#8E7E6B] uppercase mb-2">Target Canvas</label>
              <select 
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[#7A9E7E] focus:outline-none focus:ring-1 focus:ring-[#7A9E7E] transition-all"
              >
                <option value="flora">Flora (Biosphere Plot)</option>
                <option value="water">Water (Pools &amp; Systems)</option>
                <option value="lodge">Lodge (Art Frames &amp; Architecture)</option>
                <option value="any">Any General Surface</option>
              </select>
            </div>

            <button 
              onClick={handleMix}
              disabled={loading}
              className="w-full py-3 mt-4 bg-gradient-to-r from-[#4A90D9] to-[#7A9E7E] hover:from-[#5A9FE9] hover:to-[#8AAEAE] text-black font-bold uppercase tracking-wider rounded-lg shadow-[0_0_20px_rgba(74,144,217,0.3)] hover:shadow-[0_0_30px_rgba(74,144,217,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? 'Synthesizing...' : 'Preview Synthesis'}
            </button>
          </div>

          {/* Receipt / Output Panel */}
          <div className="bg-black/50 rounded-xl border border-white/5 p-5 relative overflow-hidden flex flex-col">
            <h3 className="text-[#B89C82] text-sm font-mono uppercase tracking-widest mb-4">Action Receipt</h3>
            
            {!receipt && !error && !loading && (
              <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-[#8E7E6B] text-sm italic font-mono max-w-[200px]">
                  Combine reagents to generate a deterministic synthesis receipt.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#4A90D9] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm font-mono">
                {error}
              </div>
            )}

            {receipt && !loading && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8E7E6B]">INPUT A:</span>
                    <span className="text-white">{receipt.reagent_a}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8E7E6B]">INPUT B:</span>
                    <span className="text-white">{receipt.reagent_b}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8E7E6B]">TARGET:</span>
                    <span className="text-white">{receipt.target_type}</span>
                  </div>
                </div>

                <div className="w-full h-px bg-white/10 my-2"></div>

                <div className="space-y-3">
                  <div className="text-xs font-mono text-[#D4A853]">DETERMINISTIC EFFECTS:</div>
                  {receipt.actions.length === 0 ? (
                    <div className="text-[#8E7E6B] text-xs font-mono bg-white/5 p-3 rounded">
                      Inert mixture. No active effects generated.
                    </div>
                  ) : (
                    receipt.actions.map((act, i) => (
                      <div key={i} className="p-3 rounded bg-[#4A90D9]/10 border border-[#4A90D9]/30 text-sm">
                        <div className="text-[#4A90D9] font-mono text-xs mb-1 uppercase">{act.type}</div>
                        <div className="text-white/90 leading-snug">{act.effect}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <div className="bg-black/60 border border-white/10 p-3 rounded text-[10px] font-mono break-all text-[#8E7E6B]">
                    <span className="text-white/40 block mb-1">RECEIPT_HASH</span>
                    {receipt.receipt_hash}
                  </div>
                  <div className="text-[#D4A853] text-[10px] mt-2 text-center uppercase tracking-widest font-mono opacity-80">
                    {receipt.note}
                  </div>
                  
                  {receipt.actions.length > 0 && (
                    <button 
                      onClick={async () => {
                        try {
                          const auth = getFirebaseAuth();
                          const user = auth?.currentUser;
                          if (!user) {
                            throw new Error('Sign in with Hearthlands before executing a synthesis.');
                          }
                          const token = await user.getIdToken();
                          const res = await fetch('/api/chemistry/execute', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              receipt_hash: receipt.receipt_hash,
                              payload: {
                                reagent_a: receipt.reagent_a,
                                reagent_b: receipt.reagent_b,
                                target_type: receipt.target_type,
                                actions: receipt.actions
                              }
                            })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Execution failed');
                          alert(`Synthesis executed! Chain hash: ${data.chain_hash}`);
                        } catch (err) {
                          alert(`Execution failed: ${err.message}`);
                        }
                      }}
                      className="w-full mt-4 py-2 bg-transparent border border-[#D4A853] text-[#D4A853] hover:bg-[#D4A853]/10 font-mono text-xs uppercase tracking-widest rounded transition-colors"
                    >
                      Execute Synthesis (Sign)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
