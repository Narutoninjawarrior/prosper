import React, { useEffect, useState } from 'react';
import { HACP } from '../lib/audioProtocol';

export const AudioInspector: React.FC = () => {
  const [currentSound, setCurrentSound] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState('#333');

  useEffect(() => {
    const handleSoundPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ soundId: string }>;
      const soundId = customEvent.detail?.soundId;
      if (!soundId) return;

      setCurrentSound(soundId);

      // Map sound category to visual flash color
      if (['COMPLETED', 'CONSENSUS_HIGH', 'SYSTEM_HEALTHY'].includes(soundId)) {
        setFlashColor('#00ff88'); // Green
      } else if (['STALLED', 'CONSENSUS_LOW', 'SYSTEM_DISTRESS'].includes(soundId)) {
        setFlashColor('#ffaa00'); // Orange/Amber
      } else if (['DEADLOCK', 'WICK_FROZEN'].includes(soundId)) {
        setFlashColor('#ff0044'); // Red
      } else {
        setFlashColor('#4A90D9'); // Blue (Proposed, Claimed, Working)
      }

      // Reset after a delay matching the sound duration
      const soundDef = HACP[soundId];
      const duration = soundDef ? soundDef.duration || 300 : 300;
      const timeout = setTimeout(() => {
        setCurrentSound(prev => prev === soundId ? null : prev);
      }, duration);

      return () => clearTimeout(timeout);
    };

    window.addEventListener('hacp-play-sound', handleSoundPlay);
    return () => {
      window.removeEventListener('hacp-play-sound', handleSoundPlay);
    };
  }, []);

  return (
    <div 
      className="audio-inspector bg-[#0A0604] border border-[#2A1F16] rounded p-4 font-mono text-[11px] text-[#8A7A64] space-y-3 shadow-2xl animate-fade-in"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        width: '320px',
        zIndex: 1000,
      }}
    >
      <div className="flex justify-between items-center border-b border-[#1A1410] pb-2">
        <h3 className="text-[#00ff88] font-bold uppercase tracking-wider m-0 flex items-center gap-1.5">
          🔊 Audio Protocol (HACP)
        </h3>
        <span className="text-[9px] text-[#4A90D9] bg-[#4A90D9]/10 px-1.5 py-0.5 rounded border border-[#4A90D9]/20 uppercase">
          Public Broadcast
        </span>
      </div>

      <p className="text-gray-400 leading-normal">
        Learn to hear the coordination layer. The audio hums state updates transparently:
      </p>

      {/* Visual Flash Indicator for Deaf/Hard-of-Hearing Accessibility */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] text-gray-500 uppercase tracking-widest">
          <span>Telemetry Stream</span>
          <span className="font-bold">{currentSound ? `PLAYING: ${currentSound}` : 'IDLE'}</span>
        </div>
        <div 
          className="visual-indicator rounded-sm" 
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: currentSound ? flashColor : '#1A1410',
            boxShadow: currentSound ? `0 0 10px ${flashColor}` : 'none',
            transition: 'background-color 0.1s, box-shadow 0.1s',
          }} 
        />
      </div>

      <ul className="space-y-1.5 pl-0 list-none leading-relaxed text-gray-400">
        <li className="flex items-start gap-2">
          <span className="text-[#4A90D9] font-bold">♪</span>
          <div>
            <span className="text-gray-200 font-bold uppercase block text-[10px]">Proposed</span>
            <span className="text-[10px] text-gray-500">Single A4 tone (200ms)</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#4A90D9] font-bold">♪♪</span>
          <div>
            <span className="text-gray-200 font-bold uppercase block text-[10px]">Claimed</span>
            <span className="text-[10px] text-gray-500">Staggered A4 + C#5 dyad (300ms)</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#00ff88] font-bold">♪♪♪</span>
          <div>
            <span className="text-gray-200 font-bold uppercase block text-[10px]">Completed</span>
            <span className="text-[10px] text-gray-500">A major triad (400ms)</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#ffaa00] font-bold">♪♯</span>
          <div>
            <span className="text-gray-200 font-bold uppercase block text-[10px]">Stalled / Low Consensus</span>
            <span className="text-[10px] text-gray-500">Dissonant interval / sawtooth pulse</span>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#ff0044] font-bold">♪♯♯</span>
          <div>
            <span className="text-gray-200 font-bold uppercase block text-[10px]">Deadlock</span>
            <span className="text-[10px] text-gray-500">Dual-oscillator square wave clash</span>
          </div>
        </li>
      </ul>

      <div className="border-t border-[#1A1410] pt-2 text-[9px] text-gray-500 leading-normal">
        All telemetry sounds are public broadcasts. Accessibility mode enabled.
      </div>
    </div>
  );
};
