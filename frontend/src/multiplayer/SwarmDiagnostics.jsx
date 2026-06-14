import React, { useState, useEffect } from 'react';
import { Activity, Users, MessageSquare, Cpu, Radio, Eye, Hammer, Search, VolumeX } from 'lucide-react';

export default function SwarmDiagnostics({ remotePeers = [], swarmMode = 'chorus', onModeChange }) {
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
  // Fallback to p.message if p.chat isn't there, depending on how useMultiplayerPresence merged it.
  // Actually, useMultiplayerPresence sets peer.message
  const speakingCount = remotePeers.filter(p => p.message && p.message.trim() !== '').length;
  
  // Basic frame budget heuristics
  const fpsColor = fps >= 55 ? '#34D399' : fps >= 30 ? '#D4A853' : '#ef4444';
  const statusLabel = fps >= 55 ? 'OPTIMAL' : fps >= 30 ? 'DEGRADED' : 'CRITICAL';

  // Group chorus by role
  const speakingPeers = remotePeers.filter(p => p.message && p.message.trim() !== '');
  const chorusByRole = speakingPeers.reduce((acc, peer) => {
    const role = peer.role || 'citizen';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const MODES = [
    { id: 'chorus', icon: <Radio size={10} />, label: 'Chorus' },
    { id: 'observe', icon: <Eye size={10} />, label: 'Observe' },
    { id: 'build-preview', icon: <Hammer size={10} />, label: 'Build' },
    { id: 'inspect', icon: <Search size={10} />, label: 'Inspect' },
    { id: 'quiet', icon: <VolumeX size={10} />, label: 'Quiet' },
  ];

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-50 w-64 rounded-xl border border-white/10 bg-black/80 p-4 text-[11px] font-mono text-[#c9bba5] shadow-lg backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="uppercase tracking-[0.2em] text-white flex items-center gap-2">
          <Activity size={12} className="text-[#34D399]" />
          Swarm Command
        </span>
      </div>
      
      {/* Mode Selector */}
      <div className="mb-4 flex flex-wrap gap-1">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => onModeChange?.(m.id)}
            className={`flex items-center gap-1 rounded px-1.5 py-1 text-[9px] uppercase tracking-wider transition-colors ${
              swarmMode === m.id 
                ? 'bg-white/20 text-white' 
                : 'bg-white/5 text-[#8a7a64] hover:bg-white/10 hover:text-white'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
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

      {/* Chorus Aggregation */}
      {Object.keys(chorusByRole).length > 0 && swarmMode !== 'quiet' && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <span className="text-[#8a7a64] uppercase tracking-widest text-[9px] mb-2 block">Swarm Activity</span>
          <div className="flex flex-col gap-1.5">
            {Object.entries(chorusByRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between text-[10px]">
                <span className="text-white capitalize">{role}s</span>
                <span className="text-[#D4A853]">{count} active</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
