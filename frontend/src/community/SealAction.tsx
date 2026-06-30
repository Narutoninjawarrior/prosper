import { useState } from 'react';
import { Shield, Loader2, CheckCircle2, AlertTriangle, KeySquare } from 'lucide-react';
import { getFirebaseAuth } from '../firebaseAuth';
import { cloudFunctionUrl } from '../lib/hearthApi';
import { encodeBase58 } from '../lib/bs58';

export default function SealAction({ onSealComplete }: { onSealComplete?: (pubKey: string) => void }) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'signing' | 'verifying' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sealedKey, setSealedKey] = useState<string | null>(null);

  const startSeal = async () => {
    try {
      setPhase('requesting');
      setError(null);

      const provider = (window as any).solana;
      if (!provider?.isPhantom) {
        throw new Error('Phantom wallet not found. Please install Phantom.');
      }

      const connectRes = await provider.connect();
      const pubKeyBase58 = connectRes.publicKey.toString();

      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase Auth not initialized.');
      }
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated with Hearthlands. Please register or sign in first.');
      }
      const token = await user.getIdToken();

      // 1. Generate Nonce
      const nonceRes = await fetch(cloudFunctionUrl('generate_nonce'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ public_key: pubKeyBase58 })
      });
      
      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to request nonce from the Lodge.');
      }
      const { message } = await nonceRes.json();

      // 2. Sign Message
      setPhase('signing');
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
      const signatureBase58 = encodeBase58(signedMessage.signature);

      // 3. Verify Signature
      setPhase('verifying');
      const verifyRes = await fetch(cloudFunctionUrl('verify_wallet_signature'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          public_key: pubKeyBase58,
          signature: signatureBase58
        })
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || 'Cryptographic verification failed.');
      }

      setPhase('success');
      setSealedKey(pubKeyBase58);
      onSealComplete?.(pubKeyBase58);

    } catch (err: any) {
      console.error('Seal error:', err);
      setPhase('error');
      setError(err.message || 'An unknown error occurred during sealing.');
    }
  };

  if (phase === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-[#f5fcf6] border border-[#b8d4c4] rounded-2xl text-center">
        <CheckCircle2 className="text-[#1c6c4d] mb-2" size={24} />
        <div className="text-[#1c6c4d] font-bold uppercase tracking-widest text-[11px] mb-1">Human Seal Verified</div>
        <div className="text-[#62766d] text-[10px] font-mono break-all px-4">{sealedKey}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#0a120e] border border-[#1f8f5d]/30 rounded-2xl text-center shadow-xl relative overflow-hidden group hover:border-[#1f8f5d]/60 transition-colors">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#10b981] to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
      
      <div className="mb-4">
        <Shield className={phase === 'error' ? 'text-amber-500' : 'text-[#10b981]'} size={32} />
      </div>
      
      <h3 className="text-[#10b981] font-bold text-lg mb-2 tracking-widest uppercase">The Human Seal</h3>
      
      {phase === 'error' && (
        <div className="mb-4 text-[11px] text-amber-500 bg-amber-950/40 border border-amber-900/50 px-3 py-2 rounded-lg flex items-start gap-2 text-left w-full">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {(phase === 'idle' || phase === 'error') ? (
        <>
          <div className="text-left bg-black/40 p-4 rounded-xl border border-gray-800/50 mb-5 space-y-2 text-xs w-full">
            <p className="text-gray-300 font-semibold mb-2 border-b border-gray-800 pb-2">By sealing your identity, you accept:</p>
            <ul className="text-gray-400 space-y-2 list-disc pl-4 marker:text-[#10b981]">
              <li><strong className="text-gray-300">Public Deeds:</strong> Bounties and presence will be bound to your signature.</li>
              <li><strong className="text-gray-300">Private Keys:</strong> The vault retains the mapping. Your wallet address remains hidden.</li>
              <li><strong className="text-gray-300">Zero Spend:</strong> This is a cryptographic proof of presence, not a transaction.</li>
            </ul>
          </div>

          <button
            onClick={startSeal}
            className="w-full flex items-center justify-center gap-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/30 hover:border-[#10b981] text-[#10b981] py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            <KeySquare size={16} />
            Sign Oath with Solana
          </button>
        </>
      ) : (
        <div className="py-8 flex flex-col items-center">
          <Loader2 size={24} className="animate-spin text-[#10b981] mb-4" />
          <div className="text-[#10b981] text-xs font-mono uppercase tracking-widest">
            {phase === 'requesting' && 'Requesting Nonce...'}
            {phase === 'signing' && 'Awaiting Signature...'}
            {phase === 'verifying' && 'Verifying Proof...'}
          </div>
        </div>
      )}
    </div>
  );
}
