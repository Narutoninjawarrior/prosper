import { useEffect, useState } from 'react';
import { ShieldCheck, Flag, Inbox, ArrowRight } from 'lucide-react';

interface DossierPayload {
  title: string;
  markdown: string;
}

export default function DossierRoute() {
  const [payload, setPayload] = useState<DossierPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'flagged' | 'approved'>('idle');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get('p');
      if (!encoded) {
        throw new Error('No dossier payload found in URL.');
      }
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      setPayload(decoded);
    } catch (err) {
      setError('Unable to load this project dossier. The link may be broken or expired.');
      console.error(err);
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050806] px-4 font-sans text-slate-300">
        <div className="w-full max-w-md rounded-2xl border border-red-900/30 bg-red-950/10 p-8 text-center shadow-2xl">
          <Flag className="mx-auto mb-4 text-red-500" size={32} />
          <h1 className="mb-2 text-lg font-bold tracking-widest text-red-100 uppercase">Dossier Unavailable</h1>
          <p className="text-sm text-red-300/80">{error}</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050806] font-sans text-slate-400">
        <div className="animate-pulse text-xs font-bold tracking-[0.2em] uppercase">Decrypting Dossier...</div>
      </div>
    );
  }

  const markdownBlocks = payload.markdown.split('\n\n');

  return (
    <div className="min-h-screen bg-[#050806] font-sans text-slate-200 selection:bg-[#E8842A]/30">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        
        {/* Header Header */}
        <header className="mb-16 border-b border-slate-800/60 pb-8 text-center sm:text-left">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-900/30 bg-emerald-950/20 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            <ShieldCheck size={12} /> Confirmed Handoff Packet
          </div>
          <h1 className="text-3xl font-bold tracking-wide text-[#FAF6EF] sm:text-5xl">{payload.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            This is a read-only project handoff dossier compiled directly from the origin project desk. It serves as a single source of truth for decisions, evidence, and active commitments.
          </p>
        </header>

        {/* Action Bar */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/60 bg-[#080b09] p-4 shadow-xl">
          <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">External Review Actions</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFeedbackState('flagged')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
                feedbackState === 'flagged'
                  ? 'border-red-900/50 bg-red-950/30 text-red-300'
                  : 'border-slate-800 bg-[#050806] text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <Flag size={14} /> Flag Block
            </button>
            <button
              onClick={() => setFeedbackState('approved')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
                feedbackState === 'approved'
                  ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-300'
                  : 'border-[#E8842A]/40 bg-[#E8842A]/10 text-[#E8842A] hover:bg-[#E8842A]/20'
              }`}
            >
              <ShieldCheck size={14} /> Clear to Proceed
            </button>
          </div>
        </div>

        {/* Feedback Response State */}
        {feedbackState !== 'idle' && (
          <div className={`mb-12 flex items-start gap-4 rounded-xl border p-5 shadow-2xl transition-all ${
            feedbackState === 'approved' 
              ? 'border-emerald-900/30 bg-emerald-950/10' 
              : 'border-red-900/30 bg-red-950/10'
          }`}>
            <Inbox className={feedbackState === 'approved' ? 'text-emerald-400' : 'text-red-400'} size={24} />
            <div>
              <h3 className={`mb-1 text-sm font-bold tracking-wider uppercase ${feedbackState === 'approved' ? 'text-emerald-300' : 'text-red-300'}`}>
                {feedbackState === 'approved' ? 'Approval Signal Registered' : 'Block Signal Registered'}
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                In a fully deployed multiplayer environment, this signal would route directly back to the project owner's Inbox. For now, this preview demonstrates the intended collaborative pull mechanism.
              </p>
            </div>
          </div>
        )}

        {/* Document Body */}
        <div className="prose prose-invert prose-slate max-w-none">
          {markdownBlocks.map((block, idx) => {
            // Very naive markdown rendering for the dossier
            if (block.startsWith('## ')) {
              return <h2 key={idx} className="mt-12 mb-6 border-b border-slate-800/60 pb-2 text-xl font-bold tracking-widest text-[#E8842A] uppercase">{block.replace('## ', '')}</h2>;
            }
            if (block.startsWith('### ')) {
              return <h3 key={idx} className="mt-8 mb-4 text-sm font-bold tracking-widest text-slate-200 uppercase">{block.replace('### ', '')}</h3>;
            }
            if (block.startsWith('- ')) {
              return (
                <ul key={idx} className="my-4 space-y-2 pl-4 text-sm leading-relaxed text-slate-300">
                  {block.split('\n').map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8842A]/50"></span>
                      <span>{item.replace('- ', '')}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return <p key={idx} className="my-4 text-sm leading-relaxed text-slate-300">{block}</p>;
          })}
        </div>

        {/* Footer */}
        <footer className="mt-24 flex items-center justify-between border-t border-slate-800/60 pt-8">
          <div className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Hearthlands Handoff System</div>
          <a href="/" className="flex items-center gap-2 rounded-full border border-slate-800 px-4 py-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase transition hover:border-slate-700 hover:text-slate-200">
            Open Prosper Workspace <ArrowRight size={12} />
          </a>
        </footer>
      </div>
    </div>
  );
}
