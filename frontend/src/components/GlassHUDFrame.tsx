/**
 * @file GlassHUDFrame.tsx
 * @version 2026.10.1
 * @description Premium glassmorphic panel framework for 2D UI elements.
 * Features smooth border transitions and deep backdrop filtering.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface GlassHUDFrameProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  isAlertState?: boolean; // Toggles border glow based on theta valence drops
}

export const GlassHUDFrame: React.FC<GlassHUDFrameProps> = ({
  title,
  subtitle,
  children,
  className = '',
  isAlertState = false
}) => {
  const borderHighlight = isAlertState
    ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
    : 'border-slate-800/80 hover:border-emerald-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
      className={`w-full p-5 bg-slate-950/40 backdrop-blur-md rounded-2xl border transition-all duration-500 ease-out shadow-2xl ${borderHighlight} ${className}`}
    >
      {/* HUD Panel Header Header Section */}
      <div className="flex flex-col mb-4 border-b border-slate-900 pb-2">
        <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase font-bold">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-slate-400 font-sans mt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      {/* Internal Content Insert Slot */}
      <div className="text-slate-200 font-sans text-sm selection:bg-emerald-500/30">
        {children}
      </div>
    </motion.div>
  );
};
