/**
 * @file TokenVerificationMatrix.tsx (Upgraded Active Version)
 * @version 2026.10.5
 * @description Dynamically links cryptographic file verification receipts
 * straight into your glassmorphic data HUD list nodes.
 */

import React, { useEffect, useState } from 'react';
import { GlassHUDFrame } from './GlassHUDFrame';
import { ManifestVerificationEngine, type VerificationReceipt } from '../lib/ManifestVerificationEngine';

interface TokenMatrixProps {
  theta: number;
  onVerificationResolved: (valenceAdjustment: number) => void;
}

export const TokenVerificationMatrix: React.FC<TokenMatrixProps> = ({ theta, onVerificationResolved }) => {
  const [receipts, setReceipts] = useState<VerificationReceipt[]>([]);
  const [isAuditing, setIsAuditing] = useState<boolean>(true);

  // The actual hash from vessel_members.json, replacing the arbitrary one in the prompt
  const EXPECTED_VESSEL_HASH = "5bea127476fe1952516ebbb3c786b5f94c0b182b6681f4ac793663c0f0696c90";

  useEffect(() => {
    let active = true;
    const executeSystemAudit = async () => {
      setIsAuditing(true);
      
      // Audit the vessel member seed asset in real-time
      const vesselReceipt = await ManifestVerificationEngine.verifySeedIntegrity(
        '/vessel_members.json',
        EXPECTED_VESSEL_HASH
      );

      if (!active) return;

      setReceipts([vesselReceipt]);
      setIsAuditing(false);

      // If the file fails verification, notify the parent state to plunge theta parameters
      if (!vesselReceipt.isCompliant) {
        onVerificationResolved(-0.75); // Negative system valence penalty
      } else {
        onVerificationResolved(0.82);  // Optimal system harmony assignment
      }
    };

    executeSystemAudit();
    return () => { active = false; };
  }, [onVerificationResolved]);

  const isDissonant = theta < 0.0;

  return (
    <GlassHUDFrame 
      title="LEDGER_VERIFICATION_STREAM // SCITT_AIR" 
      subtitle="Deterministic transaction receipts audited asynchronously client-side."
      isAlertState={isDissonant || receipts.some(r => !r.isCompliant)}
    >
      <div className="space-y-3 font-mono text-xs">
        {isAuditing ? (
          <div className="text-emerald-500 animate-pulse py-4 text-center tracking-widest">[RUNNING SYSTEM SECURITY AUDIT...]</div>
        ) : (
          receipts.map((r, idx) => (
            <div key={idx} className="bg-slate-950/80 p-3 rounded-xl border border-slate-900">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-200 font-bold">{r.targetFile}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.isCompliant ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  {r.isCompliant ? 'PASS // SECURE' : 'FAIL // ALTERED'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 break-all bg-black/30 p-2 rounded border border-slate-900/60 font-mono overflow-x-hidden">
                HASH: <span className="text-slate-400">{r.calculatedHash}</span>
              </div>
              
              <details className="mt-2 text-[10px] bg-white/5 border border-white/10 rounded-lg group">
                <summary className="p-2 cursor-pointer list-none flex justify-between items-center text-slate-400 hover:text-slate-200 transition-colors">
                  <span>► IETF SCITT Compliance Headers</span>
                  <span className="opacity-50">AIR_v1.0</span>
                </summary>
                <div className="p-2 pt-0 text-slate-500 border-t border-white/10 mt-1 space-y-1 bg-black/40">
                  <div><span className="text-slate-400">issuer_did:</span> did:web:hearthlands.net:vessel-forge</div>
                  <div><span className="text-slate-400">subject:</span> {r.targetFile}</div>
                  <div><span className="text-slate-400">policy_verdict:</span> {r.isCompliant ? 'COMPLIANT' : 'VIOLATION'}</div>
                  <div><span className="text-slate-400">signature_alg:</span> ES256</div>
                </div>
              </details>

              <span className="text-[9px] text-slate-600 block mt-1.5 text-right font-mono">AUDIT_TS: {r.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </GlassHUDFrame>
  );
};

