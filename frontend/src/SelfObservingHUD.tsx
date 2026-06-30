import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSomaticContext } from './context/SomaticContext';

export const SelfObservingHUD: React.FC = () => {
  const { theta } = useSomaticContext();
  const [fps, setFps] = useState(60);
  const [interactionWeight, setInteractionWeight] = useState(0.0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const calculateFps = () => {
      const now = performance.now();
      frameCount++;
      
      if (now >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
        
        // Simulate organic internal self-evaluation metrics
        setInteractionWeight(Math.random() * 0.15 + (theta < 0 ? 0.65 : 0.05));
      }
      animationId = requestAnimationFrame(calculateFps);
    };

    animationId = requestAnimationFrame(calculateFps);
    return () => cancelAnimationFrame(animationId);
  }, [theta]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.5 }}
      className="fixed bottom-4 left-4 right-4 z-30 h-10 px-6 bg-[#020804]/60 backdrop-blur-md border border-[#10b981]/20 rounded-[14px] flex items-center justify-between shadow-[0_10px_30px_rgba(16,185,129,0.05)]"
    >
      <div className="flex items-center gap-4">
        <span className="flex h-2 w-2 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theta < 0 ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${theta < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
        </span>
        <span className="text-[10px] font-mono tracking-widest text-[#10b981]/80 uppercase font-bold">
          SELF_OBSERVATION_CORE // ACTIVE
        </span>
      </div>

      <div className="flex gap-6 text-[10px] font-mono text-slate-400">
        <div>RENDER_LATENCY: <span className="text-slate-200">{(1000 / (fps || 60)).toFixed(1)}ms</span></div>
        <div>GPU_THREAD: <span className="text-[#10b981]">{fps} FPS</span></div>
        <div>COGNITIVE_LOAD: <span className={theta < 0 ? 'text-red-400' : 'text-slate-200'}>{(interactionWeight * 100).toFixed(1)}%</span></div>
      </div>
    </motion.div>
  );
};
