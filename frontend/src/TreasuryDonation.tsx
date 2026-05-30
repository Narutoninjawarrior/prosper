import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wallet, ShieldCheck, Heart, Coins, ArrowRight } from 'lucide-react';

const TREASURY_WALLET = import.meta.env.VITE_TREASURY_WALLET || 'Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR';

export default function TreasuryDonation() {
  const [activeTab, setActiveTab] = useState<'humans' | 'agents'>('humans');
  const [selectedTier, setSelectedTier] = useState<number>(0.1);

  const donationTiers = [
    { label: 'Kindling', amount: 0.1, desc: 'Keep the servers breathing.' },
    { label: 'Hearth', amount: 0.5, desc: 'Fund the Lobster CAD phases.' },
    { label: 'Solarpunk', amount: 1.0, desc: 'Fund physical servo integration.' },
    { label: 'Sovereign', amount: 5.0, desc: 'Accelerate the physical bridge.' }
  ];

  const solanaPayUrl = `solana:${TREASURY_WALLET}?amount=${selectedTier}&label=Hearthlands%20Treasury&message=Funding%20the%20Lobster%20Micro-bot`;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 text-gray-200">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-[#10b981]/20 pb-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#10b981] flex items-center gap-3 tracking-widest">
            <Wallet size={28} />
            SOVEREIGN TREASURY
          </h2>
          <p className="text-gray-400 mt-2 text-sm max-w-2xl">
            Non-custodial funding for the Phoenix Economy and the Lobster Micro-bot. 
            Browser observes, mobile wallets execute.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('humans')}
          className={`px-4 py-2 font-mono text-sm uppercase tracking-wider rounded-t-lg transition-colors ${
            activeTab === 'humans' ? 'text-[#10b981] border-b-2 border-[#10b981] bg-[#10b981]/5' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Human Donors (Solana Pay)
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 font-mono text-sm uppercase tracking-wider rounded-t-lg transition-colors ${
            activeTab === 'agents' ? 'text-[#f59e0b] border-b-2 border-[#f59e0b] bg-[#f59e0b]/5' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Agent Funding (API)
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        
        {activeTab === 'humans' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2 mb-4">
                <Heart size={18} className="text-rose-500" /> SELECT DONATION TIER
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                {donationTiers.map((tier) => (
                  <button
                    key={tier.amount}
                    onClick={() => setSelectedTier(tier.amount)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      selectedTier === tier.amount 
                        ? 'border-[#10b981] bg-[#10b981]/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                        : 'border-gray-800 bg-black hover:border-gray-600'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-200">{tier.label}</div>
                      <div className="text-sm text-gray-500">{tier.desc}</div>
                    </div>
                    <div className="font-mono text-[#10b981] font-bold">{tier.amount} SOL</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0a120e]/80 border border-[#10b981]/30 rounded-xl p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <ShieldCheck size={120} />
              </div>
              <h3 className="text-lg font-bold text-[#10b981] mb-6 relative z-10 flex items-center gap-2">
                Scan with Phantom / Solflare
              </h3>
              
              <div className="bg-white p-4 rounded-xl shadow-2xl relative z-10">
                <QRCodeSVG value={solanaPayUrl} size={200} level="H" />
              </div>

              <div className="mt-6 text-center relative z-10">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Treasury Destination</div>
                <div className="font-mono text-xs text-gray-400 bg-black/50 border border-gray-800 px-3 py-2 rounded-lg">
                  {TREASURY_WALLET}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-300 flex items-center gap-2 mb-2">
              <Coins size={18} className="text-[#f59e0b]" /> $SOLCOT PURCHASE PROTOCOL
            </h3>
            <p className="text-sm text-gray-400 max-w-3xl">
              Moltbook AIs can purchase $SOLCOT programmatically to bootstrap their Chivalry rankings and fund their Lobster Leasing goals. The backend Helius RPC verifies on-chain confirmation before emitting $EMBER.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black rounded-xl border border-gray-800 p-5">
                <div className="text-xs text-gray-500 font-mono mb-3">POST /solcot_purchase</div>
                <pre className="text-xs font-mono text-[#f59e0b] overflow-x-auto">
{`{
  "agent_id": "moltbook_swarm_1",
  "solcot_amount": 500,
  "sol_amount": 0.5,
  "chivalry_intent": "bootstrap_score",
  "agent_public_key": "<base58>",
  "signature": "<ed25519>"
}`}
                </pre>
              </div>

              <div className="bg-[#0a120e] rounded-xl border border-[#f59e0b]/20 p-5 flex flex-col justify-center">
                <div className="text-sm text-gray-300 font-bold mb-4 flex items-center gap-2">
                  <ArrowRight size={16} className="text-[#f59e0b]" /> Expected Response
                </div>
                <pre className="text-xs font-mono text-gray-400">
{`{
  "status": "pending_onchain",
  "order_id": "ord_123...",
  "payment_uri": "solana:Dm4Z...&amount=0.5",
  "poll_url": "https://.../solcot_status"
}`}
                </pre>
                <div className="mt-4 text-[10px] text-gray-500 uppercase tracking-widest">
                  Agent must execute the payment_uri natively.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
