import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSomaticContext } from './context/SomaticContext';

interface EventLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'resonance' | 'dissonance' | 'system';
}

export const KineticResonanceTerminal: React.FC = () => {
  const [logs, setLogs] = useState<EventLog[]>([
    { id: '1', timestamp: '04:08:02', message: 'System state synced with Firestore listener.', type: 'system' },
    { id: '2', timestamp: '04:08:15', message: 'Resonance node phase-lock nominal (θ: +0.84)', type: 'resonance' }
  ]);

  const { dispatchGlobalPulse, setTheta } = useSomaticContext();

  const addSimulatedImpulse = (type: 'resonance' | 'dissonance') => {
    const time = new Date().toTimeString().split(' ')[0];
    const newLog: EventLog = {
      id: Math.random().toString(),
      timestamp: time,
      message: type === 'resonance' 
        ? 'Manual resonance surge injected into frontend context.' 
        : 'Minor structural friction simulated in Council view.',
      type
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 4)]);
    
    // Trigger the global WebGL shockwave
    dispatchGlobalPulse();
    // Shift theta temporarily to show color response
    setTheta(type === 'resonance' ? 0.9 : -0.5);
    setTimeout(() => setTheta(0.82), 2000); // Return to nominal
  };

  return (
    <div className="w-full p-6 bg-[#020804]/90 backdrop-blur-xl rounded-[24px] border border-[#10b981]/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#10b981] font-semibold">Kinetic Feedback Console</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => addSimulatedImpulse('resonance')}
            className="px-4 py-1.5 text-[10px] uppercase tracking-wider font-semibold bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] rounded-lg border border-[#10b981]/30 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5"
          >
            + Pulse
          </button>
          <button 
            onClick={() => addSimulatedImpulse('dissonance')}
            className="px-4 py-1.5 text-[10px] uppercase tracking-wider font-semibold bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] rounded-lg border border-[#ef4444]/30 transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:-translate-y-0.5"
          >
            - Jitter
          </button>
        </div>
      </div>

      <div className="space-y-3 h-[180px] overflow-hidden relative">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`p-3 rounded-xl border text-[11px] font-mono flex items-center justify-between ${
                log.type === 'resonance' ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' :
                log.type === 'dissonance' ? 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]' :
                'bg-white/5 border-white/10 text-slate-300'
              }`}
            >
              <span className="tracking-wide leading-relaxed">{log.message}</span>
              <span className="text-[10px] opacity-60 ml-4 tabular-nums shrink-0">{log.timestamp}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#020804] to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
