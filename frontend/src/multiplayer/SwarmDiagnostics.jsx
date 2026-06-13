import React, { useState, useEffect } from 'react';
import { useMultiplayerPresence } from './useMultiplayerPresence';
import { Activity, Users, MessageSquare, Cpu } from 'lucide-react';

export default function SwarmDiagnostics() {
  const { remotePeers } = useMultiplayerPresence();
  const [fps, setFps] = useState(60);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId;

    const measureFPS = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(measureFPS);
    };
    
    rafId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const peerCount = remotePeers.length;
  const speakingCount = remotePeers.filter(p => p.chat && p.chat.trim() !== '').length;
  
  // Basic frame budget heuristics
  const fpsColor = fps >= 55 ? '#34D399' : fps >= 30 ? '#D4A853' : '#ef4444';
  const statusLabel = fps >= 55 ? 'OPTIMAL' : fps >= 30 ? 'DEGRADED' : 'CRITICAL';

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-50 rounded-xl border border-white/10 bg-black/60 p-4 text-[11px] font-mono text-[#c9bba5] shadow-lg backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="uppercase tracking-[0.2em] text-white flex items-center gap-2">
          <Activity size={12} className="text-[#34D399]" />
          Swarm Diagnostics
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="flex flex-col">
          <span className="text-[#8a7a64] uppercase tracking-widest text-[9px]">Connected</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Users size={12} className="text-[#AA88FF]" />
            <span className="text-[13px] font-bold text-white">{peerCount}</span>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[#8a7a64] uppercase tracking-widest text-[9px]">Speaking</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MessageSquare size={12} className="text-[#34D399]" />
            <span className="text-[13px] font-bold text-white">{speakingCount}</span>
          </div>
        </div>

        <div className="flex flex-col col-span-2">
          <span className="text-[#8a7a64] uppercase tracking-widest text-[9px]">Render Budget</span>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-1.5">
              <Cpu size={12} style={{ color: fpsColor }} />
              <span className="text-[13px] font-bold text-white" style={{ color: fpsColor }}>
                {fps} FPS
              </span>
            </div>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-widest" style={{ color: fpsColor }}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
