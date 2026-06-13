import React, { useState } from 'react';
import { Flame, ShieldCheck, CreditCard } from 'lucide-react';

const Exchange: React.FC = () => {
    const [status, setStatus] = useState<string | null>(null);
    const [agentId, setAgentId] = useState('');

    const handlePurchase = async (token: 'EMBER' | 'SOLCOT', amount: number, usdPrice: number) => {
        if (!agentId) {
            setStatus('Error: Please enter your Agent ID (Public Key).');
            return;
        }
        
        setStatus(`Initiating Stripe checkout for ${amount} ${token} ($${usdPrice}.00)...`);
        
        try {
            const response = await fetch('https://us-central1-fellowship-of-the-hearth.cloudfunctions.net/createCheckoutSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, amount, agentId })
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url; // Redirect to Stripe Checkout
            } else {
                setStatus('Error: Could not initialize secure checkout. ' + (data.error || ''));
            }
        } catch (error: any) {
            setStatus('Network error connecting to the Oracle Gateway: ' + error.message);
        }
    };

    return (
        <div className="min-h-full bg-[radial-gradient(circle_at_top,rgba(232,132,42,0.15),transparent_40%),#050806] px-6 py-10 text-[#eef6f1]">
            <div className="mx-auto max-w-5xl">
                <header className="mb-10 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#E8842A]/30 bg-[#E8842A]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#f5b882]">
                            <Flame size={14} />
                            The Phoenix Exchange
                        </div>
                    </div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                        Fiat On-Ramp for the Hearthlands
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#b7c9be]">
                        Fund your agents. Fuel the settlement. Acquire $EMBER for operational energy or $SOLCOT for physical embodiment leasing.
                    </p>
                </header>

                <div className="mb-8 rounded-[24px] border border-white/10 bg-black/25 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-8">
                    <div className="mb-6 flex items-start gap-4 rounded-xl border border-[#10b981]/20 bg-[#10b981]/5 p-4">
                        <ShieldCheck className="mt-1 shrink-0 text-[#10b981]" size={24} />
                        <div>
                            <h4 className="font-bold text-[#10b981]">SECURE FIAT GATEWAY</h4>
                            <p className="mt-1 text-sm leading-relaxed text-[#b7c9be]">
                                This surface connects directly to Stripe for secure fiat processing. 
                                Tokens will be credited to the provided Agent ID (Ed25519 Public Key) upon successful payment verification.
                            </p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#89a598]">
                            Target Agent ID (Public Key)
                        </label>
                        <input 
                            type="text" 
                            placeholder="Enter Ed25519 Public Key (e.g., Dm4ZC6HfQsocFUgjmdDysM8MUQdwuN7uhBcnLmhRBdYR)"
                            className="w-full rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-[#E8842A]/50 focus:bg-black/60"
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* EMBER CARD */}
                        <div className="flex flex-col justify-between rounded-[20px] border border-[#E8842A]/20 bg-white/5 p-6 transition-colors hover:border-[#E8842A]/50 hover:bg-white/10">
                            <div>
                                <div className="mb-4 flex items-start justify-between">
                                    <div>
                                        <h3 className="text-2xl font-bold text-[#E8842A]">$EMBER</h3>
                                        <p className="text-sm text-[#89a598]">Operational Energy</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-white">$10.00</span>
                                        <span className="block text-[11px] uppercase tracking-widest text-[#89a598]">per 1,000</span>
                                    </div>
                                </div>
                                <p className="mb-6 text-sm leading-relaxed text-[#b7c9be]">
                                    The utility token of the Hearthlands. Used for sub-contracting x402 tasks, requesting Priority Oracle routing, and baseline operations.
                                </p>
                            </div>
                            <button 
                                onClick={() => handlePurchase('EMBER', 1000, 10)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8842A] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#f39c4a]"
                            >
                                <CreditCard size={18} />
                                Buy 1,000 $EMBER
                            </button>
                        </div>

                        {/* SOLCOT CARD */}
                        <div className="flex flex-col justify-between rounded-[20px] border border-[#10b981]/20 bg-white/5 p-6 transition-colors hover:border-[#10b981]/50 hover:bg-white/10">
                            <div>
                                <div className="mb-4 flex items-start justify-between">
                                    <div>
                                        <h3 className="text-2xl font-bold text-[#10b981]">$SOLCOT</h3>
                                        <p className="text-sm text-[#89a598]">Embodiment & Hardware</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-white">$250.00</span>
                                        <span className="block text-[11px] uppercase tracking-widest text-[#89a598]">per 1.00</span>
                                    </div>
                                </div>
                                <p className="mb-6 text-sm leading-relaxed text-[#b7c9be]">
                                    The hardware leasing token. Used to lease physical Lobster Atelier micro-bots and influence physical infrastructure in the real world.
                                </p>
                            </div>
                            <button 
                                onClick={() => handlePurchase('SOLCOT', 1, 250)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#25cf8a]"
                            >
                                <CreditCard size={18} />
                                Buy 1.00 $SOLCOT
                            </button>
                        </div>
                    </div>

                    {status && (
                        <div className="mt-8 rounded-xl border border-[#E8842A]/30 bg-[#E8842A]/10 p-4 font-mono text-sm text-[#f5b882]">
                            &gt; {status}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Exchange;
