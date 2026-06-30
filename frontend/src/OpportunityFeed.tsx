import { useEffect, useState } from 'react';
import { Target, ExternalLink, Briefcase } from 'lucide-react';

interface Lead {
  id: string;
  title: string;
  niche: string;
  budget: string;
  description: string;
  timestamp: string;
  status: string;
  proposal_draft: string;
}

export default function OpportunityFeed() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/forager_leads.json')
      .then(res => res.json())
      .then(data => {
        setLeads(data.leads || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-full w-full flex flex-col p-6 text-gray-200">
      <h2 className="text-3xl font-bold text-[#d97706] flex items-center gap-3 mb-6 tracking-wider">
        <Target size={32} /> UPWORK FORAGER FEED
      </h2>
      <p className="text-sm text-gray-400 mb-8 border-b border-[#d97706]/20 pb-4">
        Monitoring elite vectors: AI Architecture, React/Firebase, Python Automation.
      </p>

      {loading ? (
        <div className="text-[#d97706] animate-pulse">Scanning the market for high-yield vectors...</div>
      ) : (
        <div className="flex flex-col gap-6 overflow-y-auto pr-4">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-[#d97706]/10 border border-[#d97706]/30 rounded-xl p-6 shadow-[0_0_15px_rgba(217,119,6,0.1)]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Briefcase size={20} className="text-[#d97706]" /> {lead.title}
                  </h3>
                  <span className="text-xs uppercase tracking-widest text-[#d97706] mt-1 block">
                    Vector: {lead.niche}
                  </span>
                </div>
                <div className="bg-[#d97706]/20 text-[#d97706] px-3 py-1 rounded-md text-sm font-mono border border-[#d97706]/40">
                  {lead.budget}
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                {lead.description}
              </p>
              <div className="bg-[#020804] p-4 rounded-lg border border-[#d97706]/20">
                <h4 className="text-xs uppercase text-gray-500 mb-2 font-bold tracking-widest">Architect's Solarpunk Proposal Draft:</h4>
                <p className="text-[#10b981] font-mono text-sm">
                  {lead.proposal_draft}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="flex items-center gap-2 bg-[#d97706] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#b45309] transition-colors">
                  <ExternalLink size={16} /> Deploy Proposal via OpenClaw
                </button>
              </div>
            </div>
          ))}
          {leads.length === 0 && (
            <div className="text-gray-500 italic">No targets acquired yet. The Bellows are pumping...</div>
          )}
        </div>
      )}
    </div>
  );
}
