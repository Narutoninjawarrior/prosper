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
    <div className="flex flex-col h-full bg-[#070a08] text-[#eadfcd] font-mono border border-[#D4A853]/20 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-[#D4A853]/20 bg-black/40">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-[#E8842A]" />
          <h2 className="text-lg uppercase tracking-widest font-semibold text-[#D4A853]">Bot Billing & Entitlements</h2>
        </div>
        <p className="mt-2 text-xs text-[#8a7a64] max-w-2xl leading-relaxed">
          Operational control surface for metered agent access. This layer enforces off-chain quotas, pricing models, and service token scopes before any on-chain treasury movement or autonomous wallet custody is permitted.
        </p>
        
        {isFrozen && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-red-950/30 border border-red-500/30 rounded-lg text-red-400">
            <PauseCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-tight">
              <strong className="block uppercase tracking-wider mb-1">Global Freeze Active</strong>
              Paid execution lanes are temporarily paused. Entitlements remain visible, but no new billing actions can be executed.
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-white/5 bg-[#0a0806]">
        {(['catalog', 'entitlements', 'intents'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-[10px] uppercase tracking-widest border-b-2 transition-colors ${tab === t ? 'border-[#E8842A] text-[#E8842A] bg-white/5' : 'border-transparent text-[#8a7a64] hover:bg-white/5'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {tab === 'catalog' && (
          <div className="grid gap-4">
            {capabilities.map(cap => (
              <div key={cap.id} className={`p-4 rounded-lg border ${cap.status === 'active' ? 'border-white/10 bg-white/5' : 'border-white/5 bg-black/40 opacity-75'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#D4A853]">{cap.title}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider ${cap.status === 'active' ? 'bg-[#34D399]/20 text-[#34D399]' : cap.status === 'paused' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {cap.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white">{cap.price_amount} SOLCOT</div>
                    <div className="text-[9px] text-[#8a7a64] uppercase tracking-wider">{cap.price_model}</div>
                  </div>
                </div>
                <div className="text-xs text-[#c9bba5] mb-3">{cap.description}</div>
                <div className="grid grid-cols-3 gap-2 text-[10px] bg-black/40 p-2 rounded">
                  <div><span className="text-[#8a7a64] block">LANE</span>{cap.auth_lane_required}</div>
                  <div><span className="text-[#8a7a64] block">QUOTA</span>{cap.quota_limit || 'Unlimited'}</div>
                  <div><span className="text-[#8a7a64] block">COOLDOWN</span>{cap.cooldown_seconds}s</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'entitlements' && (
          <div className="grid gap-4">
            {entitlements.map(ent => (
              <div key={ent.entitlement_id} className="p-4 rounded-lg border border-white/10 bg-white/5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] text-[#8a7a64] uppercase tracking-widest block mb-1">Agent / ID</span>
                    <span className="text-sm font-bold text-[#E8842A]">{ent.agent_id}</span>
                    <span className="text-xs text-gray-400 ml-2">({ent.entitlement_id})</span>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider ${ent.status === 'active' ? 'bg-[#34D399]/20 text-[#34D399]' : 'bg-red-500/20 text-red-400'}`}>
                    {ent.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5 text-xs">
                  <div><strong className="text-[#8a7a64] block text-[9px] uppercase tracking-widest mb-1">Capability</strong>{ent.capability_id}</div>
                  <div><strong className="text-[#8a7a64] block text-[9px] uppercase tracking-widest mb-1">Quota</strong>{ent.quota_remaining !== null ? `${ent.quota_remaining} remaining` : 'Unlimited'}</div>
                  <div><strong className="text-[#8a7a64] block text-[9px] uppercase tracking-widest mb-1">Valid Until</strong>{new Date(ent.valid_until).toLocaleDateString()}</div>
                  <div><strong className="text-[#8a7a64] block text-[9px] uppercase tracking-widest mb-1">Note</strong>{ent.note}</div>
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
                These are draft intents. No automatic treasury movements or on-chain settlement claims are processed here. Bot wallets must complete operator-approved intent confirmation before capabilities are issued.
              </div>
            </div>
            {intents.map(intent => (
              <div key={intent.payment_intent_id} className="p-4 rounded-lg border border-dashed border-white/20 bg-black/20">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-bold text-white">{intent.reference}</div>
                  <div className="text-right">
                    <div className="text-sm text-[#34D399] font-bold">{intent.amount} {intent.expected_token}</div>
                    <div className="text-[9px] text-[#8a7a64] uppercase tracking-wider">{intent.status}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#c9bba5] mt-3">
                  <div>ID: {intent.payment_intent_id}</div>
                  <div>Payer: {intent.payer_type}</div>
                  <div className="col-span-2">Wallet: <span className="font-mono text-gray-400">{intent.wallet_reference}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
