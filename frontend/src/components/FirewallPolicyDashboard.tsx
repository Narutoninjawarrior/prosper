import React from 'react';
import { Shield, Lock, Network, Key } from 'lucide-react';
import { GlassHUDFrame } from './GlassHUDFrame';

export const FirewallPolicyDashboard: React.FC = () => {
  return (
    <GlassHUDFrame 
      title="CLIENT_SECURITY_POLICY // ZERO_TRUST" 
      subtitle="Active client-side firewall configurations tracking decentralized signatures."
    >
      <div className="space-y-3 font-mono text-xs">
        <div className="border border-emerald-500/30 rounded-xl overflow-hidden bg-slate-950/40 p-3 relative">
          <div className="absolute top-0 right-0 p-2 text-emerald-500/20">
            <Shield size={48} />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Lock size={14} className="text-emerald-400" />
            <span className="font-bold text-slate-200">ACTIVE IMMUTABLE RULES</span>
          </div>
          <ul className="space-y-2 text-slate-400 z-10 relative">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">■</span>
              <span><strong>DROP</strong> all incoming data frames without a matching SCITT signature manifest.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">■</span>
              <span><strong>REJECT</strong> modifications to `vessel_members.json` lacking steward multi-sig authorization.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">■</span>
              <span><strong>ISOLATE</strong> unverified UI states into ephemeral buffer (`theta` projection sandboxing).</span>
            </li>
          </ul>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-black/30 p-2 rounded border border-slate-900 flex flex-col gap-1 items-center justify-center text-center py-3">
            <Network size={14} className="text-slate-500 mb-1" />
            <span className="text-[10px] text-slate-400">WRITE ACCESS</span>
            <span className="font-bold text-red-400 text-xs tracking-widest">BLOCKED</span>
          </div>
          <div className="bg-black/30 p-2 rounded border border-slate-900 flex flex-col gap-1 items-center justify-center text-center py-3">
            <Key size={14} className="text-slate-500 mb-1" />
            <span className="text-[10px] text-slate-400">VALIDATOR</span>
            <span className="font-bold text-emerald-400 text-xs tracking-widest">ENFORCED</span>
          </div>
        </div>
      </div>
    </GlassHUDFrame>
  );
};
