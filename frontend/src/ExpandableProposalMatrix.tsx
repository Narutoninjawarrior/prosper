import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSomaticContext } from './context/SomaticContext';

export const ExpandableProposalMatrix: React.FC<{ proposals?: any[] }> = ({ proposals }) => {
  const { dispatchGlobalPulse, setTheta } = useSomaticContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const displayProposals = proposals && proposals.length > 0 
    ? proposals.map(p => ({
        id: p.id || p.proposal_id,
        title: p.title,
        summary: p.description || p.synthesis || 'No summary available.',
        hash: p.action?.type || 'governance',
        stake: p.total_staked || 0
      }))
    : [
        { id: 'prop_01', title: 'Initialize Hearthlands Seed Vault', summary: 'Establishes the decentralized encrypted storage arrays for village agent schemas.', hash: 'e3b0c44298fc1c149afbf4c...', stake: 750 },
        { id: 'prop_02', title: 'Activate Lodge Steward Loop', summary: 'Deploys automated NREM background memory pruning routines to maintain ledger efficiency.', hash: '8f9a2c3b4e5f6a7b8c9d0e...', stake: 420 },
      ];

  const handleCardSelect = (id: string, stake: number) => {
    setSelectedId(id);
    // Send a shockwave to the 3D Octahedron core on selection
    dispatchGlobalPulse();
    // Temporarily adjust the theta matrix scale based on proposal weight
    setTheta(stake > 500 ? 0.95 : 0.45);
  };

  const currentProp = displayProposals.find(p => p.id === selectedId);


  return (
    <div className="w-full space-y-4 p-2 relative z-10">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-[#8a6743] uppercase mb-4">Active Governance Matrix</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        <AnimatePresence>
          {displayProposals.map((prop) => (
            <motion.div
              layoutId={`card_${prop.id}`}
              key={prop.id}
              onClick={() => handleCardSelect(prop.id, prop.stake)}
              className="p-5 rounded-[22px] border border-[#d9d0c2]/70 bg-[linear-gradient(180deg,rgba(255,251,244,0.9),rgba(248,241,231,0.85))] backdrop-blur-md cursor-pointer hover:border-[#a17b54]/50 transition-colors duration-300 shadow-[0_18px_60px_rgba(56,39,20,0.06)] flex flex-col justify-between"
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              <div>
                <motion.span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-0.5 rounded-md">
                  STAKE: {prop.stake}
                </motion.span>
                <motion.h4 className="text-sm font-sans font-semibold text-[#273328] mt-3">{prop.title}</motion.h4>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a6743] mt-5 block">Click to view receipt →</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* The Floating Overlaid Modal View - Smoothly morphs from the clicked card */}
      <AnimatePresence>
        {selectedId && currentProp && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 bg-[#020804]/90 z-40 pointer-events-auto backdrop-blur-md"
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
              <motion.div
                layoutId={`card_${selectedId}`}
                className="w-full max-w-lg p-6 bg-[linear-gradient(180deg,rgba(255,251,244,1),rgba(248,241,231,1))] border border-[#d9d0c2] rounded-[28px] shadow-[0_28px_90px_rgba(80,55,20,0.15)] pointer-events-auto text-left relative overflow-hidden"
              >
                <div className="flex justify-between items-start relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#8a6743]">ID: {currentProp.id}</span>
                  <button 
                    onClick={() => setSelectedId(null)}
                    className="text-[#8a6743] hover:text-[#503a24] font-semibold uppercase tracking-[0.2em] text-[10px] transition-colors"
                  >
                    [CLOSE]
                  </button>
                </div>
                <h3 className="text-xl font-sans font-semibold text-[#273328] mt-4 relative z-10 tracking-tight">{currentProp.title}</h3>
                <p className="text-sm text-[#61584f] font-sans mt-3 leading-relaxed relative z-10">{currentProp.summary}</p>
                
                <div className="mt-6 p-4 bg-[#fffaf0] rounded-[18px] border border-[#e2d7c7] relative z-10">
                  <span className="text-[10px] font-semibold text-[#847a6f] block uppercase tracking-[0.2em] mb-2">SCITT Receipts Cryptographic Hash</span>
                  <code className="text-[11px] font-mono text-[#10b981] break-all select-all block bg-[#10b981]/5 p-2 rounded-lg border border-[#10b981]/10">{currentProp.hash}</code>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
