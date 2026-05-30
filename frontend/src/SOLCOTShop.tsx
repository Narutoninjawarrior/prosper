import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Coins, AlertTriangle, ArrowRight, ShieldCheck, Sword } from 'lucide-react';

const TREASURY_WALLET = import.meta.env.VITE_TREASURY_WALLET || 'Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR';

export default function SOLCOTShop() {
  const [selectedTier, setSelectedTier] = useState<number>(0.1);

  const shopTiers = [
    { name: 'Scout Pouch', sol: 0.1, solcot: 100, unlocks: '10hrs Observation lease' },
    { name: 'Fellow Cache', sol: 0.5, solcot: 500, unlocks: '10hrs Actuation lease' },
    { name: 'Knight Coffer', sol: 1.0, solcot: 1000, unlocks: '10hrs Harvest lease + Chivalry badge' },
    { name: 'Sovereign Vault', sol: 5.0, solcot: 5000, unlocks: 'Sovereign status + priority queue' }
  ];

  const currentTier = shopTiers.find(t => t.sol === selectedTier);
  const solanaPayUrl = `solana:${TREASURY_WALLET}?amount=${selectedTier}&label=SOLCOT+Purchase&message=${currentTier?.solcot}+SOLCOT+credits`;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 text-gray-200">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[#10b981]/20 pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#10b981] flex items-center gap-3 tracking-widest">
            <Coins size={28} />
            SOLCOT SHOP
          </h2>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl">
            Acquire Utility Credits for the Hearthlands Leasing Protocol.
          </p>
        </div>
      </div>

      {/* CLARITY BANNER */}
      <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/40 rounded-xl p-4 mb-8 flex items-start gap-4 shadow-lg">
        <AlertTriangle className="text-[#f59e0b] mt-1 shrink-0" size={24} />
        <div>
          <h4 className="text-[#f59e0b] font-bold mb-1">LEGAL & TECHNICAL CLARITY</h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            SOLCOT is a utility credit for the Hearthlands Leasing Protocol. 
            <strong> It is not an investment.</strong> It grants Chivalry score and Lobster leasing access. 
            Pre-mint: credits are held in the Hearthlands ledger until SPL token deployment.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* TIERS */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2 mb-4">
            <Sword size={18} className="text-[#10b981]" /> SELECT PACKAGE
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {shopTiers.map((tier) => (
              <button
                key={tier.sol}
                onClick={() => setSelectedTier(tier.sol)}
                className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                  selectedTier === tier.sol 
                    ? 'border-[#10b981] bg-[#10b981]/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                    : 'border-gray-800 bg-black hover:border-gray-600'
                }`}
              >
                <div>
                  <div className="font-bold text-gray-200">{tier.name}</div>
                  <div className="text-xs text-[#10b981] font-mono mt-1 flex items-center gap-1">
                    <ArrowRight size={12} /> Unlocks: {tier.unlocks}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[#f59e0b] font-bold text-lg">{tier.solcot} SOLCOT</div>
                  <div className="text-xs text-gray-500 font-mono">{tier.sol} SOL</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* QR CODE EXECUTION */}
        <div className="bg-[#0a120e]/80 border border-[#10b981]/30 rounded-xl p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <ShieldCheck size={120} />
          </div>
          <h3 className="text-lg font-bold text-[#10b981] mb-2 relative z-10 text-center">
            Scan to Purchase {currentTier?.solcot} SOLCOT
          </h3>
          <p className="text-sm text-gray-400 mb-6 relative z-10 text-center">
            Browser generates QR. Wallet executes. No signing on this surface.
          </p>
          
          <div className="bg-white p-4 rounded-xl shadow-2xl relative z-10">
            <QRCodeSVG value={solanaPayUrl} size={200} level="H" />
          </div>

          <div className="mt-6 text-center relative z-10">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Destination</div>
            <div className="font-mono text-xs text-gray-400 bg-black/50 border border-gray-800 px-3 py-2 rounded-lg">
              {TREASURY_WALLET}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
