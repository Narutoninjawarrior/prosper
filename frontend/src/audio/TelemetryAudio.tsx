import React, { useEffect, useRef, useState } from 'react';
import { useSomaticContext } from '../context/SomaticContext';

// Helper to generate a quick impulse response for a small room (0.3s decay)
function createImpulseResponse(audioContext: AudioContext, duration: number = 0.3) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  
  for (let c = 0; c < 2; c++) {
    const channelData = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      // White noise exponentially decayed
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return impulse;
}

export const TelemetryAudio: React.FC = () => {
  const { theta, isPaused } = useSomaticContext();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // wickState mapping based on whether the GPU is paused
  const wickState = isPaused ? 0 : 1; 

  useEffect(() => {
    if (!audioEnabled) {
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend();
      }
      return;
    }

    let isSubscribed = true;

    const initAudio = async () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      try {
        await ctx.audioWorklet.addModule('/telemetry-processor.js');
        if (!isSubscribed) return;

        const workletNode = new AudioWorkletNode(ctx, 'telemetry-processor');
        workletNodeRef.current = workletNode;

        // Stereo Pan
        const panner = ctx.createStereoPanner();
        panner.pan.value = 0; // Centered by default (could be mapped to focus ID later)

        // Reverb using generated IR
        const convolver = ctx.createConvolver();
        convolver.buffer = createImpulseResponse(ctx, 0.3);

        // Dry/Wet mixing for Reverb
        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.7;
        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.3;

        // Routing
        workletNode.connect(dryGain);
        workletNode.connect(convolver);
        convolver.connect(wetGain);
        
        dryGain.connect(panner);
        wetGain.connect(panner);
        
        panner.connect(ctx.destination);

        // Initial params
        const thetaParam = workletNode.parameters.get('theta');
        const wickParam = workletNode.parameters.get('wick');
        if (thetaParam) thetaParam.setValueAtTime(theta, ctx.currentTime);
        if (wickParam) wickParam.setValueAtTime(wickState, ctx.currentTime);
      } catch (err) {
        console.error('Failed to initialize AudioWorklet:', err);
      }
    };

    initAudio();

    return () => {
      isSubscribed = false;
      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
      }
    };
  }, [audioEnabled]);

  // Update worklet parameters in real-time when global state changes
  useEffect(() => {
    if (audioCtxRef.current && workletNodeRef.current && audioEnabled) {
      const ctx = audioCtxRef.current;
      const node = workletNodeRef.current;
      
      const thetaParam = node.parameters.get('theta');
      const wickParam = node.parameters.get('wick');
      
      // Linear ramp over 10ms to prevent clicking
      if (thetaParam) {
        thetaParam.linearRampToValueAtTime(theta, ctx.currentTime + 0.01);
      }
      if (wickParam) {
        wickParam.linearRampToValueAtTime(wickState, ctx.currentTime + 0.01);
      }
    }
  }, [theta, wickState, audioEnabled]);

  return (
    <div className="p-4 bg-[#020804]/40 border border-[#d8cdbf]/20 rounded-2xl flex items-center justify-between mt-4">
      <div>
        <div className="text-[10px] font-mono tracking-widest text-slate-300">POLYPHONIC TELEMETRY</div>
        <div className="text-xs text-slate-500 mt-1">AudioWorklet stream mapping state to sound</div>
      </div>
      <button
        onClick={() => setAudioEnabled(!audioEnabled)}
        className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase tracking-wider font-bold transition-colors ${
          audioEnabled 
            ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
            : 'bg-slate-800/50 border-slate-700 text-slate-400'
        }`}
      >
        {audioEnabled ? 'MUTING...' : 'ENABLE AUDIO'}
        {audioEnabled && <span className="ml-2">ACTIVE</span>}
      </button>
    </div>
  );
};
