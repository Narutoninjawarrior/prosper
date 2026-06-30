import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KineticResonanceTerminal } from './KineticResonanceTerminal';
import { TelemetryAudio } from './audio/TelemetryAudio';
import { useSomaticContext } from './context/SomaticContext';

export const SomaticConsoleDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { theta, isPaused, setPaused } = useSomaticContext();

  const isSystemDissonant = theta < -0.2;
  const signalColor = isSystemDissonant ? 'bg-red-500 shadow-red-500/50' : 'bg-emerald-500 shadow-emerald-500/50';

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-50 px-4 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold bg-[linear-gradient(180deg,rgba(255,251,244,0.9),rgba(248,241,231,0.85))] hover:bg-white backdrop-blur-sm text-[#8a6743] border border-[#a17b54]/50 rounded-xl shadow-[0_10px_30px_rgba(80,55,20,0.1)] transition-all duration-300 flex items-center gap-3"
      >
        <span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_8px_var(--tw-shadow-color)] transition-colors duration-500 ${signalColor}`} />
        {isOpen ? '[ HIDE CONSOLE ]' : '[ SHOW DIAGNOSTICS ]'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-[#020804] z-40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed top-0 right-0 h-full w-full max-w-md p-6 bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(248,241,231,0.95))] backdrop-blur-xl border-l border-[#d8cdbf] z-40 shadow-[-20px_0_60px_rgba(80,55,20,0.15)] overflow-y-auto pt-24 custom-drawer-scroll"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(161,123,84,0.3) transparent'
              }}
            >
              <style>{`
                .custom-drawer-scroll::-webkit-scrollbar {
                  width: 4px;
                }
                .custom-drawer-scroll::-webkit-scrollbar-track {
                  background: transparent;
                }
                .custom-drawer-scroll::-webkit-scrollbar-thumb {
                  background: rgba(161, 123, 84, 0.25);
                  border-radius: 10px;
                }
                .custom-drawer-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgba(161, 123, 84, 0.4);
                }
              `}</style>

              <div className="space-y-8 relative z-10">
                <div>
                  <h2 className="text-[11px] font-semibold tracking-[0.2em] text-[#8a6743] uppercase">Lodge System Console</h2>
                  <p className="text-sm text-[#61584f] font-sans mt-2">
                    Interact directly with diagnostic telemetry states and overlay values.
                  </p>
                </div>
                
                <div className="p-4 bg-[#020804]/40 border border-[#d8cdbf]/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-slate-300">GPU ROTATION CORE</div>
                    <div className="text-xs text-slate-500 mt-1">Halt octahedron rotation on global state</div>
                  </div>
                  <button
                    onClick={() => setPaused(!isPaused)}
                    className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase tracking-wider font-bold transition-colors ${
                      isPaused 
                        ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                        : 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    }`}
                  >
                    {isPaused ? 'HALTED' : 'ACTIVE'}
                  </button>
                </div>
                
                <TelemetryAudio />

                <KineticResonanceTerminal />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
