import { useRef, useCallback, useState } from 'react';
import { HACP } from '../lib/audioProtocol';

interface RoomAudioParams {
  baseFreq: number;
  activeAgents: number;
  taskStatus: 'proposed' | 'claimed' | 'stalled' | 'completed';
  consensusLevel: number;
  pan: number; // 0.0 = left, 0.5 = center, 1.0 = right
}

interface RoomAudioState {
  initAudio: () => Promise<void>;
  updateRoom: (roomId: string, params: RoomAudioParams) => void;
  updateGlobal: (theta: number, wickState: string) => void;
  setMasterGain: (gain: number) => void;
  playChime: (chimeType: 'proposed' | 'claimed' | 'completed' | 'stalled') => void;
  playHACPSound: (soundId: string) => void;
  enabled: boolean;
}

export function useRoomAudio(): RoomAudioState {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [enabled, setEnabled] = useState(false);

  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;
    
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await ctx.audioWorklet.addModule('/audio/telemetry-processor.js');
      
      const worklet = new AudioWorkletNode(ctx, 'room-audio-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2] // stereo output!
      });
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3;
      
      worklet.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      workletRef.current = worklet;
      gainNodeRef.current = gainNode;
      setEnabled(true);
    } catch (err) {
      console.error('[useRoomAudio] Failed to initialize audio worklet:', err);
    }
  }, []);

  const updateRoom = useCallback((roomId: string, params: RoomAudioParams) => {
    if (!workletRef.current || !audioContextRef.current) return;
    
    workletRef.current.port.postMessage({
      type: 'roomUpdate',
      roomId,
      params
    });
  }, []);

  const updateGlobal = useCallback((theta: number, wickState: string) => {
    if (!workletRef.current || !audioContextRef.current) return;
    
    workletRef.current.port.postMessage({
      type: 'globalTelemetry',
      theta,
      wickState
    });
  }, []);

  const setMasterGain = useCallback((gain: number) => {
    if (!gainNodeRef.current || !audioContextRef.current) return;
    gainNodeRef.current.gain.setValueAtTime(gain, audioContextRef.current.currentTime);
  }, []);

  const playHACPSound = useCallback((soundId: string) => {
    // Dispatch custom DOM event for the UI Visual Indicator
    const event = new CustomEvent('hacp-play-sound', { detail: { soundId } });
    window.dispatchEvent(event);

    if (!audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const sound = HACP[soundId];
    if (!sound) return;

    const freqs = Array.isArray(sound.freq) ? sound.freq : [sound.freq];
    const duration = sound.duration > 0 ? sound.duration / 1000 : 0.5; // default if 0
    const type = sound.type;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.type = type;
      
      const gain = ctx.createGain();
      const initialGain = type === 'sine' ? 0.08 : (type === 'sawtooth' ? 0.03 : 0.02);
      
      gain.gain.setValueAtTime(initialGain, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + i * 0.05); // staggered start
      osc.stop(ctx.currentTime + duration + 0.1);
    });
  }, []);

  const playChime = useCallback((chimeType: 'proposed' | 'claimed' | 'completed' | 'stalled') => {
    const mapping: Record<string, string> = {
      proposed: 'PROPOSED',
      claimed: 'CLAIMED',
      completed: 'COMPLETED',
      stalled: 'STALLED',
    };
    const soundId = mapping[chimeType] || 'PROPOSED';
    playHACPSound(soundId);
  }, [playHACPSound]);

  return {
    initAudio,
    updateRoom,
    updateGlobal,
    setMasterGain,
    playChime,
    playHACPSound,
    enabled
  };
}
