/**
 * @file TokenStreamer.tsx
 * @version 2026.8.0
 * @description A high-density, real-time token activity log. 
 * Simulates active OpenClaw Architect execution logs with smooth fade transitions.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogLine {
  id: string;
  timestamp: string;
  stream: string;
}

export const TokenStreamer: React.FC = () => {
  const [logs, setLogs] = useState<LogLine[]>([]);

  const operations = [
    "[ARCHITECT] Scanning Upwork API for tags: #AI-Agents #Web3 #React",
    "[FORAGER] High-yield opportunity discovered: 'Enterprise Agent Integration'",
    "[SCITT_LEDGER] Generating cryptographic interaction receipt...",
    "[POLICY_ENGINE] Verifying compliance matrix against DID protocol",
    "[OPENCLAW] Autoregressive proposal draft compiled successfully.",
    "[SYSTEM] Token velocity: 1420 tokens/sec. System state: NOMINAL"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString();
      const randomOp = operations[Math.floor(Math.random() * operations.length)];
      
      const newLog: LogLine = {
        id: Math.random().toString(),
        timestamp: time,
        stream: randomOp
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 5)]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-sm p-4 bg-slate-950/40 border border-slate-900 backdrop-blur-sm rounded-xl relative overflow-hidden h-64 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
      <div className="text-[10px] font-mono tracking-widest text-emerald-500 mb-2 font-bold uppercase">
        🤖 NATIVE_OPENCLAW_LOGS // REALTIME_STREAM
      </div>
      
      {/* Dynamic Token Feed Stack */}
      <div className="space-y-1.5 h-full overflow-hidden relative">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-[11px] font-mono text-emerald-400/90 leading-tight"
            >
              <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
              {log.stream}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Deep bottom gradient mask to smoothly fade old logs into the background */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#020804] via-[#020804]/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
