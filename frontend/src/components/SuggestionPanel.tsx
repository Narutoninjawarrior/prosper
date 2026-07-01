import { useState } from 'react';
import type { BiosystemSuggestion } from '../lib/biosystemSuggestionEngine';

interface SuggestionPanelProps {
  suggestions: BiosystemSuggestion[];
  onAccept: (suggestion: BiosystemSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
}

export default function SuggestionPanel({ suggestions, onAccept, onDismiss }: SuggestionPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-4 top-20 w-64 bg-black/90 border border-[#2A1F16] rounded-lg shadow-xl z-20 overflow-hidden backdrop-blur-sm">
      <div className="bg-[#1A1410] px-3 py-2 border-b border-[#2A1F16] flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-widest text-[#a9bfd6] font-bold">AI Thinking Partner</span>
        <button className="text-[9px] uppercase tracking-widest text-gray-500 hover:text-gray-300" onClick={() => suggestions.forEach(s => onDismiss(s.id))}>Dismiss All</button>
      </div>
      <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
        {suggestions.map(suggestion => (
          <div key={suggestion.id} className="border border-white/5 bg-black/40 rounded p-3 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#4A90D9] font-bold flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${suggestion.confidence === 'high' ? 'bg-[#34D399]' : suggestion.confidence === 'medium' ? 'bg-[#FBBF24]' : 'bg-gray-500'}`} />
                {suggestion.title}
              </span>
              <button 
                onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
                className="text-[9px] text-gray-500 hover:text-white uppercase tracking-widest"
              >
                {expandedId === suggestion.id ? 'Hide' : 'Why?'}
              </button>
            </div>
            
            {expandedId === suggestion.id && (
              <div className="text-gray-400 text-[10px] leading-relaxed mt-1 mb-1">
                {suggestion.reasoning}
              </div>
            )}
            
            <div className="flex gap-2 mt-1">
              <button onClick={() => onAccept(suggestion)} className="bg-[#4A90D9]/10 text-[#4A90D9] border border-[#4A90D9]/30 hover:bg-[#4A90D9]/20 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-widest">
                Accept
              </button>
              <button onClick={() => onDismiss(suggestion.id)} className="bg-white/5 text-gray-400 hover:bg-white/10 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-widest">
                Dismiss
              </button>
            </div>
            <div className="text-[8px] text-gray-500 uppercase tracking-widest mt-1">
              or modify manually on canvas
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#2A1F16] text-[8px] uppercase tracking-widest text-gray-600">
        Suggestions based on constraint analysis.
      </div>
    </div>
  );
}
