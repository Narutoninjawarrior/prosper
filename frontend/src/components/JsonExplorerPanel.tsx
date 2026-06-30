/**
 * @file JsonExplorerPanel.tsx
 * @version 2026.10.7
 * @description Glassmorphic file inspector panel. Fetches and formats 
 * active JSON seed states with smooth framer-motion disclosure animations.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassHUDFrame } from './GlassHUDFrame';

interface TargetFileMatrix {
  name: string;
  url: string;
  expectedHash: string;
}

export const JsonExplorerPanel: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Production-grade contract registry configurations
  const fileRegistry: TargetFileMatrix[] = [
    { name: 'vessel_members.json', url: '/vessel_members.json', expectedHash: '5bea12...' },
    { name: 'quest_board.json', url: '/quest_board.json', expectedHash: '8a9c3d...' }
  ];

  const inspectFileContent = async (file: TargetFileMatrix) => {
    if (activeFile === file.name) {
      setActiveFile(null);
      return;
    }
    
    setIsLoading(true);
    setActiveFile(file.name);
    
    try {
      const response = await fetch(file.url);
      const data = await response.json();
      // Format cleanly with indents for technical readability inside the console view
      setFileContent(JSON.stringify(data, null, 2));
    } catch (error) {
      setFileContent('// Failed to rehydrate target file data from repository partition.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassHUDFrame 
      title="COGNITIVE_FILE_EXPLORER // CODE_WITNESS" 
      subtitle="Inspect contract-first database data seeds and signed anchors in real-time."
    >
      <div className="space-y-2 font-mono text-xs">
        {fileRegistry.map((file) => (
          <div key={file.name} className="border border-slate-900 rounded-xl overflow-hidden bg-slate-950/40">
            {/* Interactive File Accordion Label */}
            <div 
              onClick={() => inspectFileContent(file)}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-300">
                <span>📁</span>
                <span className="font-bold">{file.name}</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {activeFile === file.name ? '[ COLLAPSE ]' : '[ INSPECT ]'}
              </span>
            </div>

            {/* Expandable JSON Terminal Interface Pane */}
            <AnimatePresence>
              {activeFile === file.name && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 25 }}
                  className="overflow-hidden bg-black/40 border-t border-slate-900"
                >
                  <div className="p-3">
                    <div className="text-[9px] text-slate-500 mb-2 uppercase tracking-wider">
                      EXPECTED_SCITT_HASH: {file.expectedHash}
                    </div>
                    {isLoading ? (
                      <div className="text-slate-600 animate-pulse">[STREAMING ASSET STRINGS...]</div>
                    ) : (
                      <pre className="text-[11px] text-emerald-400 overflow-x-auto p-2.5 bg-slate-950 border border-slate-900 rounded custom-hud-scroll whitespace-pre-wrap font-mono leading-tight max-h-60 select-text">
                        {fileContent}
                      </pre>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </GlassHUDFrame>
  );
};
