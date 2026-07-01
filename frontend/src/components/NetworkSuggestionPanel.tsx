

interface NetworkSuggestionPanelProps {
  onClose: () => void;
}

export default function NetworkSuggestionPanel({ onClose }: NetworkSuggestionPanelProps) {
  return (
    <div className="absolute right-4 top-20 w-72 bg-[#0A0604]/95 border border-[#4A90D9]/40 rounded-lg p-4 shadow-2xl backdrop-blur-md z-30 font-mono transition-opacity duration-500">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#4A90D9]/20">
        <div className="text-[11px] uppercase tracking-widest text-[#4A90D9] font-bold">Cottage Network Vision</div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
      </div>
      
      <p className="text-[10px] text-gray-300 leading-relaxed mb-4">
        One loop is a garden. Multiple loops are a community. This is how cottage facilities could share resources through the Hearthlands.
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-[#4A90D9]/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[#4A90D9] text-[8px]">💧</span>
          </div>
          <div>
            <div className="text-[10px] text-[#4A90D9] font-bold">Water</div>
            <div className="text-[9px] text-gray-400">Reservoir to reservoir balancing</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-[#34D399]/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[#34D399] text-[8px]">🌱</span>
          </div>
          <div>
            <div className="text-[10px] text-[#34D399] font-bold">Nutrients</div>
            <div className="text-[9px] text-gray-400">Grow bed to grow bed surplus sharing</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-[#FBBF24]/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[#FBBF24] text-[8px]">📡</span>
          </div>
          <div>
            <div className="text-[10px] text-[#FBBF24] font-bold">Sensor Data</div>
            <div className="text-[9px] text-gray-400">Monitoring array to planning hub</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded-full bg-[#E8842A]/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[#E8842A] text-[8px]">🤝</span>
          </div>
          <div>
            <div className="text-[10px] text-[#E8842A] font-bold">Labor</div>
            <div className="text-[9px] text-gray-400">Facility to facility during peak seasons</div>
          </div>
        </div>
      </div>

      <div className="text-[8px] uppercase tracking-widest text-gray-500 pt-2 border-t border-[#2A1F16]">
        VISION ONLY. Not implemented. Not scheduled. The Hearthlands does not yet connect multiple facilities.
      </div>
    </div>
  );
}
