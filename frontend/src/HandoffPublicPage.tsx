import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedHandoff, type PublishedHandoff } from './projects/cloud';

function tokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'handoff' && parts[1] ? decodeURIComponent(parts[1]) : '';
}

function downloadText(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function HandoffPublicPage() {
  const token = useMemo(() => tokenFromPath(), []);
  const [handoff, setHandoff] = useState<PublishedHandoff | null>(null);
  const [error, setError] = useState<string | null>(() => (token ? null : 'This handoff link is missing its share token.'));
  const [loading, setLoading] = useState(() => Boolean(token));

  useEffect(() => {
    let cancelled = false;
    if (!token) return;

    fetchPublishedHandoff(token)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.value) {
          setHandoff(result.value);
          setError(null);
        } else {
          setError(result.error || 'This handoff is unavailable.');
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'This handoff is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded border border-slate-800 bg-slate-900/50 p-6">Loading handoff...</div>
      </main>
    );
  }

  if (error || !handoff) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded border border-amber-900/50 bg-amber-950/20 p-6">
          <h1 className="text-xl font-bold">Handoff unavailable</h1>
          <p className="mt-3 text-sm text-amber-100/80">{error}</p>
          <p className="mt-4 text-xs text-slate-400">Ask the project owner for a fresh link if this handoff was revoked or replaced.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-300 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Prosper Handoff</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{handoff.project_title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{handoff.project_summary || 'No project summary was included.'}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Published {new Date(handoff.published_at).toLocaleString()}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Version {handoff.handoff_version}</span>
            {handoff.audience && <span className="rounded border border-slate-300 bg-white px-2 py-1">{handoff.audience}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => downloadText(`${handoff.project_id}-handoff.md`, handoff.markdown, 'text/markdown;charset=utf-8')}
              className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Download Markdown
            </button>
            <button
              onClick={() => downloadText(`${handoff.project_id}-handoff.json`, JSON.stringify(handoff.json, null, 2), 'application/json;charset=utf-8')}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Download JSON
            </button>
          </div>
        </header>

        <article className="prose prose-slate mt-8 max-w-none whitespace-pre-wrap rounded border border-slate-200 bg-white p-6 text-sm leading-7 shadow-sm">
          {handoff.markdown}
        </article>

        <footer className="mt-8 rounded border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          This public page contains only the handoff snapshot the project owner published. Private comments, rejected proposals, member emails, and internal activity are not included.
        </footer>
      </div>
    </main>
  );
}
