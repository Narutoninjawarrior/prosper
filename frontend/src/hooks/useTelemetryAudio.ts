import { useRef, useCallback, useState } from 'react';

interface TelemetryAudio {
  initAudio: () => Promise<void>;
  updateTelemetry: (theta: number, wickState: string) => void;
  enabled: boolean;
}

export function useTelemetryAudio(): TelemetryAudio {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const [enabled, setEnabled] = useState(false);

  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;
    
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await ctx.audioWorklet.addModule('/audio/telemetry-processor.js');
      
      const worklet = new AudioWorkletNode(ctx, 'telemetry-processor', {
        processorOptions: { baseFreq: 220 }
      });
      
      worklet.connect(ctx.destination);
      audioContextRef.current = ctx;
      workletRef.current = worklet;
      setEnabled(true);
    } catch (e) {
      console.error('Failed to initialize telemetry audio:', e);
    }
  }, []);

  const updateTelemetry = useCallback((theta: number, wickState: string) => {
    if (!workletRef.current || !audioContextRef.current) return;
    
    const ws = (wickState || '').toUpperCase();
    workletRef.current.port.postMessage({
      theta,
      amplitude: ws === 'LIVE' ? 0.3 : 0.05
    });
  }, []);

  return {
    initAudio,
    updateTelemetry,
    enabled
  };
}
