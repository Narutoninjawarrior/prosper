import React from 'react';
import { Shield, CheckCircle } from 'lucide-react';
import type { Receipt } from '../lib/agentSimulation';

interface ReceiptCardProps {
  receipt: Receipt;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({ receipt }) => {
  return (
    <div className="bg-[#0D1612] border border-[#23583C] p-4 rounded font-mono text-[11px] text-gray-300 relative overflow-hidden space-y-2.5 transition-all hover:border-[#388D61]">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff88]/5 blur-xl rounded-full -mr-6 -mt-6 pointer-events-none" />
      
      <div className="flex justify-between items-center text-[#46D38B] font-bold tracking-wider">
        <span className="flex items-center gap-1.5 uppercase">
          <Shield className="w-3.5 h-3.5" /> Output Receipt
        </span>
        <span className="bg-[#1A3326] px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> VERIFIED
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>COORDINATOR:</span>
          <span className="text-gray-300 font-bold">{receipt.agentName}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>COMPLETED:</span>
          <span className="text-gray-300">{new Date(receipt.completedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="bg-black/40 p-2.5 rounded border border-[#1E2E25] text-gray-400 leading-relaxed">
        {receipt.output}
      </div>

      <details className="text-[10px] text-gray-500 cursor-pointer select-none group">
        <summary className="hover:text-gray-300 transition-colors uppercase tracking-widest font-bold flex items-center gap-1">
          <span>Inspect Hash Chain</span>
        </summary>
        <div className="mt-2 bg-[#060B08] p-2 rounded border border-[#16271F] text-gray-500 break-all select-all font-mono leading-normal">
          {receipt.hash}
        </div>
      </details>
    </div>
  );
};
