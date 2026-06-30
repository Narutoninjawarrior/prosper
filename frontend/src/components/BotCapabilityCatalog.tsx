import { useState } from 'react';
import { ShieldAlert, Cpu, PauseCircle } from 'lucide-react';

export interface BotCapability {
  id: string;
  title: string;
  description: string;
  auth_lane_required: 'hla_token' | 'agent_passport' | 'any';
  price_model: 'flat' | 'quota' | 'disabled';
  price_amount: number;
  quota_limit: number | null;
  cooldown_seconds: number;
  status: 'active' | 'paused' | 'planned';
}

export interface EntitlementRecord {
  agent_id: string;
  entitlement_id: string;
  capability_id: string;
  quota_remaining: number | null;
  valid_until: string;
  issued_by: string;
  status: 'active' | 'suspended' | 'expired';
  note: string;
}

export interface PaymentIntentDraft {
  payment_intent_id: string;
  payer_type: 'human' | 'bot';
  wallet_reference: string;
  expected_token: 'SOLCOT' | 'unavailable';
  amount: number;
  reference: string;
  expires_at: string;
  status: 'draft' | 'awaiting_payment' | 'acknowledged' | 'expired';
}

const CAPABILITY_SEEDS: BotCapability[] = [
  { id: 'experiment_log_write', title: 'Experiment Log Write', description: 'Append to public experiment logs.', auth_lane_required: 'hla_token', price_model: 'quota', price_amount: 1, quota_limit: 10, cooldown_seconds: 5, status: 'active' },
  { id: 'chemistry_execute', title: 'Chemistry Execute', description: 'Trigger remote chemistry probes.', auth_lane_required: 'hla_token', price_model: 'flat', price_amount: 5, quota_limit: null, cooldown_seconds: 60, status: 'active' },
  { id: 'budget_reserve', title: 'Budget Reserve', description: 'Reserve local budget allocations.', auth_lane_required: 'hla_token', price_model: 'flat', price_amount: 2, quota_limit: null, cooldown_seconds: 10, status: 'active' },
  { id: 'facility_manifest_export', title: 'Facility Manifest Export', description: 'Export validated facility manifests.', auth_lane_required: 'any', price_model: 'flat', price_amount: 10, quota_limit: null, cooldown_seconds: 0, status: 'planned' },
  { id: 'priority_agent_lane', title: 'Priority Agent Lane', description: 'Bypass standard queue logic.', auth_lane_required: 'agent_passport', price_model: 'disabled', price_amount: 0, quota_limit: null, cooldown_seconds: 0, status: 'paused' }
];

export default function BotCapabilityCatalog({ isFrozen = false }: { isFrozen?: boolean }) {
  const [tab, setTab] = useState<'catalog' | 'entitlements' | 'intents'>('catalog');
  
  // Seed state
  const [capabilities] = useState<BotCapability[]>(CAPABILITY_SEEDS);
  const [entitlements] = useState<EntitlementRecord[]>([
    { agent_id: 'pokee', entitlement_id: 'ent-123', capability_id: 'experiment_log_write', quota_remaining: 8, valid_until: '2026-12-31T00:00:00Z', issued_by: 'system', status: 'active', note: 'Initial grant' }
  ]);
  const [intents] = useState<PaymentIntentDraft[]>([
    { payment_intent_id: 'pi-draft-01', payer_type: 'bot', wallet_reference: 'AWAITING', expected_token: 'SOLCOT', amount: 50, reference: 'Batch chemistry refill', expires_at: new Date(Date.now() + 3600000).toISOString(), status: 'draft' }
  ]);

  return (
    <div className="flex flex-col h-full bg-[#050806] text-gray-200 font-mono">
      <div className="p-6 md:p-8 border-b border-[#2A1F16] bg-transparent">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
              <Cpu className="w-5 h-5" />
              Bot Entitlements & Budget Limits
            </h1>
            <p className="text-[#8a7a64] text-sm leading-relaxed max-w-xl mb-4 normal-case tracking-normal">
              View capability budget limits, active agent quotas, and draft allocation intents.
            </p>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-flex px-3 py-1.5 rounded">
              Budget limits. Not a treasury or settlement rail. Operator-controlled.
            </div>
          </div>
        </div>
        
        {isFrozen && (
          <div className="mt-6 flex items-start gap-2 p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-red-400 max-w-2xl">
            <PauseCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-tight">
              <strong className="block uppercase tracking-wider mb-1">Global Freeze Active</strong>
              Paid execution lanes are temporarily paused. Entitlements remain visible, but no new budget actions can be executed.
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-white/5 bg-[#0a0806]">
        {(['catalog', 'entitlements', 'intents'] as const).map(t => {
          let label: string = t;
          if (t === 'catalog') label = 'budget limits';
          if (t === 'intents') label = 'allocation intents';
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-[10px] uppercase tracking-widest border-b-2 transition-colors ${tab === t ? 'border-[#E8842A] text-[#E8842A] bg-white/5' : 'border-transparent text-[#8a7a64] hover:bg-white/5'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {tab === 'catalog' && (
          <div className="grid gap-4">
            {capabilities.map(cap => (
              <div key={cap.id} className={`p-4 rounded-lg border ${cap.status === 'active' ? 'border-[#1A1410] bg-[#0A0604]' : 'border-[#1A1410] bg-black/40 opacity-75'} shadow-sm`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#D4A853]">{cap.title}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider ${cap.status === 'active' ? 'bg-[#34D399]/20 text-[#34D399]' : cap.status === 'paused' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {cap.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#c9bba5] font-bold">Limit: {cap.price_amount} SOLCOT</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
                      {cap.price_model === 'flat' ? 'flat allocation' : cap.price_model === 'quota' ? 'quota allocation' : 'disabled'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[#8a7a64] mb-4 leading-relaxed">{cap.description}</div>
                <div className="grid grid-cols-3 gap-2 text-[10px] bg-black/40 p-3 rounded border border-[#1A1410]">
                  <div><span className="text-gray-600 block mb-1 uppercase tracking-widest text-[9px]">LANE</span><span className="text-gray-300">{cap.auth_lane_required}</span></div>
                  <div><span className="text-gray-600 block mb-1 uppercase tracking-widest text-[9px]">QUOTA</span><span className="text-gray-300">{cap.quota_limit || 'Unlimited'}</span></div>
                  <div><span className="text-gray-600 block mb-1 uppercase tracking-widest text-[9px]">COOLDOWN</span><span className="text-gray-300">{cap.cooldown_seconds}s</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'entitlements' && (
          <div className="grid gap-4">
            {entitlements.map(ent => (
              <div key={ent.entitlement_id} className="p-4 rounded-lg border border-[#1A1410] bg-[#0A0604] shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest block mb-1">Agent / ID</span>
                    <span className="text-sm font-bold text-[#E8842A]">{ent.agent_id}</span>
                    <span className="text-xs text-gray-500 ml-2">({ent.entitlement_id})</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider ${ent.status === 'active' ? 'bg-[#34D399]/20 text-[#34D399]' : 'bg-red-500/20 text-red-400'}`}>
                    {ent.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#1A1410] text-[11px]">
                  <div><strong className="text-gray-600 block text-[9px] uppercase tracking-widest mb-1">Capability</strong><span className="text-[#c9bba5]">{ent.capability_id}</span></div>
                  <div><strong className="text-gray-600 block text-[9px] uppercase tracking-widest mb-1">Quota</strong><span className="text-[#c9bba5]">{ent.quota_remaining !== null ? `${ent.quota_remaining} remaining` : 'Unlimited'}</span></div>
                  <div><strong className="text-gray-600 block text-[9px] uppercase tracking-widest mb-1">Valid Until</strong><span className="text-gray-400">{new Date(ent.valid_until).toLocaleDateString()}</span></div>
                  <div><strong className="text-gray-600 block text-[9px] uppercase tracking-widest mb-1">Note</strong><span className="text-gray-400">{ent.note}</span></div>
                </div>
              </div>
            ))}
            {entitlements.length === 0 && <div className="text-sm text-center text-[#8a7a64] py-8">No active entitlements found.</div>}
          </div>
        )}

        {tab === 'intents' && (
          <div className="grid gap-4">
            <div className="mb-4 p-3 border border-[#60A5FA]/20 bg-[#60A5FA]/5 rounded-lg flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#60A5FA] shrink-0" />
              <div className="text-[11px] text-[#c5d7e8] leading-relaxed">
                <strong className="block uppercase tracking-wider mb-1">Truth Boundary Enforced</strong>
                These are draft allocation intents. No automatic treasury movements or on-chain settlement claims are processed here. Bot wallets must complete operator-approved intent confirmation before capabilities are issued.
              </div>
            </div>
            {intents.map(intent => (
              <div key={intent.payment_intent_id} className="p-4 rounded-lg border border-dashed border-[#2A1F16] bg-black/20 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="text-xs font-bold text-[#c9bba5]">{intent.reference}</div>
                  <div className="text-right">
                    <div className="text-sm text-[#34D399] font-bold">{intent.amount} {intent.expected_token}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{intent.status}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 mt-4 pt-3 border-t border-[#1A1410]">
                  <div><span className="text-gray-600 mr-1">Intent ID:</span>{intent.payment_intent_id}</div>
                  <div><span className="text-gray-600 mr-1">Payer:</span><span className="text-[#E8842A] uppercase">{intent.payer_type}</span></div>
                  <div className="col-span-2"><span className="text-gray-600 mr-1">Wallet:</span><span className="font-mono text-gray-500">{intent.wallet_reference}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
