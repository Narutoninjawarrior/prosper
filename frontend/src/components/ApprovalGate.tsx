import React, { useState } from 'react';
import { Eye, ShieldAlert } from 'lucide-react';
import type { Receipt } from '../lib/agentSimulation';

interface ApprovalGateProps {
  receipt: Receipt;
  onApprove: (receipt: Receipt) => void;
  onReject: (receipt: Receipt) => void;
}

export const ApprovalGate: React.FC<ApprovalGateProps> = ({ receipt, onApprove, onReject }) => {
  const [quarantined, setQuarantined] = useState(false);

  if (quarantined) {
    return (
      <div className="bg-[#1C0D0D] border border-[#582323] p-4 rounded font-mono text-[11px] text-gray-300 relative overflow-hidden space-y-2 transition-all">
        <div className="flex justify-between items-center text-[#D34646] font-bold tracking-wider uppercase">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Quarantined Output
          </span>
        </div>
        <div className="text-gray-400">
          Receipt from <span className="text-white font-bold">{receipt.agentName}</span> was rejected and isolated from the main ledger.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#19140E] border border-[#6B4B21] p-4 rounded font-mono text-[11px] text-gray-300 relative overflow-hidden space-y-3 transition-all hover:border-[#96692E]">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#E8842A]/5 blur-xl rounded-full -mr-6 -mt-6 pointer-events-none" />
      
      <div className="flex justify-between items-center text-[#E8842A] font-bold tracking-wider">
        <span className="flex items-center gap-1.5 uppercase">
          <Eye className="w-3.5 h-3.5" /> Pending Operator Audit
        </span>
        <span className="bg-[#3D2C1E] px-1.5 py-0.5 rounded text-[10px]">
          AWAITING APPROVAL
        </span>
      </div>

      <div className="text-gray-400">
        Receipt issued by <span className="text-[#D4A853] font-bold">{receipt.agentName}</span> requires manual sovereign authorization before ledger committing.
      </div>

      <div className="bg-black/30 p-2.5 rounded border border-[#302113] text-gray-400 leading-normal max-h-20 overflow-y-auto">
        {receipt.output}
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => onApprove(receipt)}
          className="flex-1 bg-[#D4A853] text-[#0A0604] py-1.5 rounded transition-all font-bold uppercase tracking-wider text-[10px] hover:bg-white hover:shadow-lg"
        >
          ✓ Approve & Commit
        </button>
        <button 
          onClick={() => {
            setQuarantined(true);
            onReject(receipt);
          }}
          className="bg-transparent border border-[#582323] text-[#D34646] px-3 py-1.5 rounded transition-all font-bold uppercase tracking-wider text-[10px] hover:bg-[#582323]/20"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
};
