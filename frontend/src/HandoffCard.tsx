type SemanticAlert = {
  triggered: boolean;
  matches: string[];
  banner: string;
};

type HandoffCardProps = {
  text: string;
  renderHash: string;
  quarantined: boolean;
  semanticAlert?: SemanticAlert;
};

export default function HandoffCard({ text, renderHash, quarantined, semanticAlert }: HandoffCardProps) {
  const authorityTriggered = Boolean(semanticAlert?.triggered);
  return (
    <div className={`rounded-2xl bg-white/75 p-3 ${authorityTriggered ? 'border border-amber-300/70' : 'border border-[#cde7d6]'}`}>
      <div className="text-[9px] uppercase tracking-[0.35em] text-[#7e978d]">handoff notes</div>
      {authorityTriggered ? (
        <div className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-amber-800">
          {semanticAlert?.banner}
        </div>
      ) : null}
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-dashed border-[#ffb66d] bg-[#1a1a1a] p-3 font-mono text-[12px] leading-6 text-[#ff6b35]">
        {text || '[QUARANTINED - NON-PLAINTEXT DETECTED]'}
      </pre>
      {authorityTriggered ? (
        <div className="mt-2 text-[10px] uppercase tracking-[0.35em] text-amber-700">
          trigger words: {semanticAlert?.matches.join(', ')}
        </div>
      ) : null}
      <div className="mt-2 text-[10px] uppercase tracking-[0.35em] text-[#7e978d]">
        render hash: {renderHash}
        {quarantined ? ' | quarantined' : ''}
      </div>
    </div>
  );
}
