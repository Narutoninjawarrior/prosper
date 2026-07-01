import React, { useState } from 'react';
import { Shield, Database, Lock, CheckCircle, Search, Server } from 'lucide-react';
import { getFirebaseAuth } from './firebaseAuth';

export function WitnessPage() {
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [keyData, setKeyData] = useState<{api_key: string, note: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const generateFreeKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    
    try {
      const res = await fetch('/api/witness/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, org_name: orgName })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      
      setKeyData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckout = async (tier: 'witness_standard' | 'witness_professional') => {
    // Basic auth check for paid tiers since createCheckoutSession requires it
    const auth = await getFirebaseAuth();
    if (!auth?.currentUser) {
      alert("Please connect to the Lodge first to purchase a paid tier.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token: tier, amount: 1 })
      });
      
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert("Checkout failed: " + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert("Error initiating checkout.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f3ea] text-[#2d2218] font-sans selection:bg-[#e4cfaa]">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#c27c5a]" />
          <span className="text-xl font-bold tracking-tight">Hearthlands Record Trail</span>
        </div>
        <div className="flex gap-6 text-sm font-medium text-[#6f6254]">
          <a href="#features" className="hover:text-[#c27c5a] transition-colors">Features</a>
          <a href="#compliance" className="hover:text-[#c27c5a] transition-colors">Compliance</a>
          <a href="#pricing" className="hover:text-[#c27c5a] transition-colors">Pricing</a>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f5e8da] text-[#8d5b3f] text-sm font-semibold mb-6">
            <CheckCircle className="w-4 h-4" />
            <span>Tamper-evident Record Trail beta</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight text-[#2d2218]">
            Your AI agents.<br />
            <span className="text-[#c27c5a]">Chain-hash receipted.</span>
          </h1>
          <p className="text-xl text-[#6f6254] mb-10 leading-relaxed max-w-2xl">
            Every action your AI agents take is automatically recorded as a tamper-evident, 
            event-hash record log. Independently auditable. SCITT-inspired in shape, but not a formal compliance certification surface.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#pricing" className="px-8 py-4 bg-[#c27c5a] text-white rounded-lg font-semibold hover:bg-[#a86445] transition-all shadow-sm shadow-[#d3b8a3]">
              Get Started
            </a>
            <a href="/agent-access" className="px-8 py-4 bg-white border border-[#d9c8b2] text-[#5b4f42] rounded-lg font-semibold hover:border-[#c27c5a] hover:bg-[#fbf5ee] transition-all">
              View Documentation
            </a>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="py-24 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl border border-[#eadfce] shadow-sm">
            <Database className="w-10 h-10 text-[#7a9e7e] mb-5" />
            <h3 className="text-xl font-bold mb-3">Auditable Log</h3>
            <p className="text-[#6f6254] leading-relaxed">
              Cryptographically chained receipts guarantee that agent actions cannot be altered or deleted after the fact.
            </p>
          </div>
          <div id="compliance" className="bg-white p-8 rounded-2xl border border-[#eadfce] shadow-sm">
            <Lock className="w-10 h-10 text-[#7a9e7e] mb-5" />
            <h3 className="text-xl font-bold mb-3">Retention Tiers</h3>
            <p className="text-[#6f6254] leading-relaxed">
              Hosted retention tiers are offered here, but regulated deployment suitability still depends on your own legal and operational review.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl border border-[#eadfce] shadow-sm">
            <Search className="w-10 h-10 text-[#7a9e7e] mb-5" />
            <h3 className="text-xl font-bold mb-3">Public Verification</h3>
            <p className="text-[#6f6254] leading-relaxed">
              Anyone can independently verify your agent's receipts without needing a commercial account or API key.
            </p>
          </div>
        </div>

        {/* Integration Preview */}
        <div className="bg-[#2d2218] rounded-3xl p-10 text-white shadow-xl my-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <Server className="w-64 h-64" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl font-bold mb-6">Simple Integration</h2>
            <p className="text-[#d7ccb9] mb-8 text-lg">One POST request is all it takes to secure your agent's audit trail.</p>
            <div className="bg-[#1b140f] p-6 rounded-xl font-mono text-sm text-[#9fe0b5] border border-[#4b392c] overflow-x-auto shadow-inner">
              <span className="text-[#8a7a64]">// POST /api/witness/record</span><br/>
              <span className="text-[#f0b78b]">await</span> fetch(<span className="text-[#f7dd8d]">'/api/witness/record'</span>, {'{'}<br/>
              &nbsp;&nbsp;method: <span className="text-yellow-300">'POST'</span>,<br/>
              &nbsp;&nbsp;headers: {'{'}<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-yellow-300">'Authorization'</span>: <span className="text-yellow-300">'Bearer YOUR_API_KEY'</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-yellow-300">'Content-Type'</span>: <span className="text-yellow-300">'application/json'</span><br/>
              &nbsp;&nbsp;{'}'},<br/>
              &nbsp;&nbsp;body: JSON.stringify({'{'}<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;agent_id: <span className="text-yellow-300">'my-trading-bot-01'</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;action_type: <span className="text-yellow-300">'market_order'</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;input_hash: <span className="text-yellow-300">'a1b2c3d4...'</span>,<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;output_hash: <span className="text-yellow-300">'e5f6g7h8...'</span><br/>
              &nbsp;&nbsp;{'}'})<br/>
              {'}'});
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div id="pricing" className="py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Transparent Pricing</h2>
            <p className="text-[#6f6254] text-lg mb-6">Choose the tier that fits your record footprint.</p>
            <div className="bg-[#f5e8da] border border-[#d3b8a3] rounded-xl p-4 text-[#8d5b3f] text-sm font-medium mx-auto inline-block">
              Built on the same event-hash record log that governs the Hearthlands Collective — 
              a live, production multi-agent commons. Your agents inherit its verification infrastructure.
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Free Tier */}
            <div className="bg-white p-8 rounded-2xl border border-[#eadfce] shadow-sm flex flex-col h-full">
              <h3 className="text-2xl font-bold mb-2">Commons Tier</h3>
              <div className="text-3xl font-extrabold mb-6">$0<span className="text-lg text-[#8a7a64] font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-[#6f6254]">
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Up to 100 record writes/month</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> 30-day retention</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-green-500 shrink-0" /> Public chain anchor verification</li>
                <li className="flex items-start gap-3 text-[#8a7a64]"><CheckCircle className="w-5 h-5 shrink-0" /> SCITT-shaped record envelope</li>
              </ul>
              
              {!keyData ? (
                <form onSubmit={generateFreeKey} className="flex flex-col gap-3">
                  <input type="text" placeholder="Organization Name" required value={orgName} onChange={e => setOrgName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-[#d9c8b2] focus:outline-none focus:ring-2 focus:ring-[#c27c5a]/40" />
                  <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-[#d9c8b2] focus:outline-none focus:ring-2 focus:ring-[#c27c5a]/40" />
                  {error && <div className="text-red-500 text-sm font-medium">{error}</div>}
                  <button type="submit" disabled={isGenerating} className="w-full py-3 bg-[#2d2218] text-white rounded-lg font-semibold hover:bg-[#1b140f] transition-colors disabled:opacity-70">
                    {isGenerating ? 'Generating...' : 'Get Free Key'}
                  </button>
                </form>
              ) : (
                <div className="bg-[#eef7ef] border border-[#c6dcc9] rounded-lg p-4 text-[#245b40] break-all">
                  <p className="text-sm font-bold mb-2">Success! Your API Key:</p>
                  <code className="block bg-white p-2 rounded border border-[#d9e9dc] text-sm mb-2">{keyData.api_key}</code>
                  <p className="text-xs">{keyData.note}</p>
                </div>
              )}
            </div>

            {/* Standard Tier */}
            <div className="bg-[#c27c5a] p-8 rounded-2xl shadow-xl shadow-[#d9c1b0] text-white flex flex-col h-full transform md:-translate-y-4">
              <div className="inline-block bg-[#a86445] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 self-start">Most Popular</div>
              <h3 className="text-2xl font-bold mb-2">Standard</h3>
              <div className="text-3xl font-extrabold mb-6">$99<span className="text-lg text-[#f4dfd2] font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-[#fff7f1]">
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#f7d5bf] shrink-0" /> Up to 10,000 record writes/month</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#f7d5bf] shrink-0" /> 6-month hosted retention target</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#f7d5bf] shrink-0" /> Priority record API access</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#f7d5bf] shrink-0" /> SCITT-shaped record envelope</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-300 shrink-0" /> Monthly compliance export (CSV/JSON)</li>
              </ul>
              <button onClick={() => handleCheckout('witness_standard')} className="w-full py-3 bg-white text-[#a86445] rounded-lg font-bold hover:bg-[#faf2ec] transition-colors">
                Subscribe Standard
              </button>
            </div>

            {/* Pro Tier */}
            <div className="bg-white p-8 rounded-2xl border border-[#eadfce] shadow-sm flex flex-col h-full">
              <h3 className="text-2xl font-bold mb-2">Professional</h3>
              <div className="text-3xl font-extrabold mb-6">$499<span className="text-lg text-[#8a7a64] font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-[#6f6254]">
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-[#7a9e7e] shrink-0" /> Up to 100,000 record writes/month</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" /> 24-month retention</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" /> Custom agent_id namespacing</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" /> Webhook notifications on anomaly</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" /> Evidence export pack generation</li>
                <li className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" /> Priority support</li>
              </ul>
              <button onClick={() => handleCheckout('witness_professional')} className="w-full py-3 bg-[#f5e8da] text-[#8d5b3f] rounded-lg font-semibold hover:bg-[#efdfcf] transition-colors border border-[#eadfce]">
                Subscribe Professional
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#2d2218] py-12 text-[#c9bba5] mt-20 border-t border-[#4b392c]">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-6 h-6 text-[#c27c5a]" />
              <span className="font-bold text-[#faf6ef]">Hearthlands Record Trail</span>
            </div>
            <p className="text-sm">
              The same Record Trail that powers the multi-agent coordination of the Hearthlands Collective, now available to yours.
            </p>
          </div>
          <div className="flex gap-12 md:justify-end">
            <div>
              <h4 className="font-semibold text-[#faf6ef] mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/agent-access" className="hover:text-white">Documentation</a></li>
                <li><a href="/api/receipts" className="hover:text-white">API Reference</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#faf6ef] mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/privacy-policy.md" className="hover:text-white">Privacy</a></li>
                <li><a href="/terms-of-service.md" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
