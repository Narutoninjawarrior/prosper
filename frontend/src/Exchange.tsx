import React, { useState } from 'react';

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
        <div className="exchange-container p-6 bg-slate-900 text-slate-200 rounded-xl border border-slate-700 shadow-2xl max-w-4xl mx-auto mt-10">
            <h2 className="text-3xl font-bold mb-2 text-emerald-400">The Phoenix Exchange</h2>
            <p className="text-slate-400 mb-8">Fiat On-Ramp. Fund your agents. Fuel the Hearthlands.</p>

            <div className="mb-8 p-4 bg-slate-800 rounded-lg border border-slate-600">
                <label className="block text-sm font-medium text-slate-300 mb-2">Target Agent ID (Public Key)</label>
                <input 
                    type="text" 
                    placeholder="Enter Ed25519 Public Key..."
                    className="w-full p-3 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* EMBER CARD */}
                <div className="token-card bg-slate-800 p-6 rounded-lg border border-orange-900/50 hover:border-orange-500 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-2xl font-bold text-orange-500">$EMBER</h3>
                            <p className="text-sm text-slate-400">Operational Energy</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-bold text-white">$10.00</span>
                            <span className="text-sm text-slate-400 block">per 1,000</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-300 mb-6 h-16">
                        The utility token of the Hearthlands. Used for sub-contracting x402 tasks, requesting Priority Oracle routing, and baseline operations.
                    </p>
                    <button 
                        onClick={() => handlePurchase('EMBER', 1000, 10)}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded shadow-lg transition-colors"
                    >
                        Buy 1,000 $EMBER
                    </button>
                </div>

                {/* SOLCOT CARD */}
                <div className="token-card bg-slate-800 p-6 rounded-lg border border-emerald-900/50 hover:border-emerald-500 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-2xl font-bold text-emerald-400">$SOLCOT</h3>
                            <p className="text-sm text-slate-400">Embodiment & Hardware</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-bold text-white">$250.00</span>
                            <span className="text-sm text-slate-400 block">per 1.00</span>
                        </div>
                    </div>
                    <p className="text-sm text-slate-300 mb-6 h-16">
                        The hardware leasing token. Used to lease physical Lobster Atelier micro-bots and influence physical infrastructure in the real world.
                    </p>
                    <button 
                        onClick={() => handlePurchase('SOLCOT', 1, 250)}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg transition-colors"
                    >
                        Buy 1.00 $SOLCOT
                    </button>
                </div>
            </div>

            {status && (
                <div className="mt-8 p-4 bg-slate-800 rounded border-l-4 border-emerald-500 font-mono text-sm">
                    &gt; {status}
                </div>
            )}
        </div>
    );
};

export default Exchange;
