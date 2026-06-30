import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

const AGENTS = [
  { id: 'builder', label: 'Builder', angle: 45, weight: 1.5, color: '#34D399' },
  { id: 'skeptic', label: 'Skeptic', angle: -30, weight: 1.0, color: '#F472B6' },
  { id: 'guardian', label: 'Guardian', angle: 15, weight: 1.2, color: '#4A90D9' },
];

export function ConsensusDialCard() {
  const [angle, setAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  
  const targetAngle = useMemo(() => {
    let wSum = 0;
    let aSum = 0;
    for (const a of AGENTS) {
      wSum += a.weight;
      aSum += a.angle * a.weight;
    }
    return wSum ? aSum / wSum : 0;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsLocked(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && dialRef.current) {
      const rect = dialRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const rad = Math.atan2(dy, dx);
      let deg = (rad * 180) / Math.PI;
      deg = deg + 90; 
      if (deg > 180) deg -= 360;
      setAngle(deg);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    if (!isDragging) {
      let diff = targetAngle - angle;
      // Normalize to -180..180
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;

      if (Math.abs(diff) < 1) {
        if (!isLocked) setIsLocked(true);
        setAngle(targetAngle);
      } else {
        if (isLocked) setIsLocked(false);
        const timer = requestAnimationFrame(() => {
          setAngle(prev => prev + diff * 0.1);
        });
        return () => cancelAnimationFrame(timer);
      }
    }
  }, [angle, isDragging, targetAngle, isLocked]);

  return (
    <div className="rounded-[24px] border border-[#d7ccbd] bg-white/60 p-5 backdrop-blur-sm shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.3em] text-[#7a6f63] font-bold">
          Consensus Dial
        </div>
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-[#8f775c] bg-[#8f775c]/10 px-2 py-1 rounded">
          <Info size={12} /> Local Simulation
        </div>
      </div>
      
      <p className="text-sm text-[#5f564d] leading-relaxed">
        Mock agent positions mapped to a weighted center. Drag the dial to feel the pull of consensus. 
        <strong> No public vote or witnessed commit.</strong>
      </p>

      <div className="relative w-full h-48 flex items-center justify-center bg-[#fbf5ea] rounded-xl border border-[#e0d6c7] overflow-hidden mt-2">
        {/* Outer ring for agents */}
        <div className="absolute w-36 h-36 rounded-full border-2 border-[#e0d6c7] border-dashed" />
        
        {AGENTS.map(a => (
          <div 
            key={a.id}
            className="absolute w-36 h-36 flex items-start justify-center pointer-events-none"
            style={{ transform: `rotate(${a.angle}deg)` }}
          >
            <div 
              className="w-2.5 h-2.5 rounded-full -mt-1.5 shadow-sm" 
              style={{ backgroundColor: a.color }} 
            />
            <div 
              className="absolute top-[-20px] text-[9px] font-bold uppercase tracking-widest"
              style={{ color: a.color }}
            >
              {a.label}
            </div>
          </div>
        ))}
        
        {/* Target Indicator */}
        <div 
          className="absolute w-24 h-24 flex items-start justify-center pointer-events-none opacity-50"
          style={{ transform: `rotate(${targetAngle}deg)` }}
        >
          <div className="w-1 h-3 bg-[#a3a3a3] rounded-full -mt-1.5" />
        </div>

        {/* The Dial itself */}
        <div 
          ref={dialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerUp}
          className={`relative w-24 h-24 rounded-full border flex items-start justify-center shadow-md cursor-grab active:cursor-grabbing transition-colors duration-200 touch-none ${isLocked ? 'bg-[#f4fbf7] border-[#34D399]/50' : 'bg-white border-[#d8cdbf]'}`}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="absolute inset-2 rounded-full border border-[#f0ebd9] opacity-50" />
          <div className={`w-1.5 h-4 mt-2 rounded-full shadow-inner ${isLocked ? 'bg-[#34D399]' : 'bg-[#D4A853]'}`} />
          
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShieldCheck className="text-[#34D399]" size={20} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-xl bg-white/50 border border-[#e0d6c7] overflow-hidden">
        <table className="w-full text-[10px] text-left">
          <thead className="bg-[#fbf5ea] border-b border-[#e0d6c7] text-[#8f775c] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 font-bold">Agent</th>
              <th className="px-3 py-2 font-bold">Angle</th>
              <th className="px-3 py-2 font-bold">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0d6c7]/50">
            {AGENTS.map(a => (
              <tr key={a.id} className="text-[#5f564d]">
                <td className="px-3 py-2 flex items-center gap-1.5 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.label}
                </td>
                <td className="px-3 py-2">{a.angle}°</td>
                <td className="px-3 py-2">{a.weight.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="bg-[#f4fbf7] text-[#273328] font-bold border-t border-[#e0d6c7]">
              <td className="px-3 py-2 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-[#34D399]" /> Target Consensus
              </td>
              <td className="px-3 py-2 text-[#34D399]">{targetAngle.toFixed(1)}°</td>
              <td className="px-3 py-2 text-[#34D399]">(Weighted Center)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
