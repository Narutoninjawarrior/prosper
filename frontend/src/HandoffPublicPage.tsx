import { useEffect, useMemo, useState } from 'react';
import { fetchPublishedHandoff, type PublishedHandoff } from './projects/cloud';

type JsonRecord = Record<string, unknown>;

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

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function summarizeOpenItems(commitments: unknown[], blockers: unknown[]) {
  const openCommitments = commitments.filter((item) => {
    const record = asRecord(item);
    const state = asString(record?.commitment_state);
    return state && state !== 'completed';
  });

  if (blockers.length > 0) {
    return `${blockers.length} item${blockers.length === 1 ? '' : 's'} still need attention before the next published update.`;
  }

  if (openCommitments.length > 0) {
    return `${openCommitments.length} open action${openCommitments.length === 1 ? '' : 's'} are still being carried forward.`;
  }

  return 'No open blockers are highlighted in this milestone snapshot.';
}

function acceptedCompletedCount(run: any) {
  const counts = asRecord(run?.action_counts);
  return Number(counts?.accepted || 0) + Number(counts?.completed || 0);
}

export default function HandoffPublicPage() {
  const token = useMemo(() => tokenFromPath(), []);
  const [handoff, setHandoff] = useState<PublishedHandoff | null>(null);
  const [error, setError] = useState<string | null>(() => (token ? null : 'This published update link is missing its share token.'));
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
          setError(result.error || 'This published update is unavailable.');
        }
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : 'This published update is unavailable.');
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
        <div className="mx-auto max-w-3xl rounded border border-slate-800 bg-slate-900/50 p-6">Loading published update...</div>
      </main>
    );
  }

  if (error || !handoff) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded border border-amber-900/50 bg-amber-950/20 p-6">
          <h1 className="text-xl font-bold">Published update unavailable</h1>
          <p className="mt-3 text-sm text-amber-100/80">{error}</p>
          <p className="mt-4 text-xs text-slate-400">Ask the project owner for a fresh link if this published update was revoked or replaced.</p>
        </div>
      </main>
    );
  }

  const exportJson = asRecord(handoff.json);
  const provenance = asRecord(exportJson?.provenance);
  const currentDirection = asRecord(provenance?.current_direction);
  const nextAction = asRecord(provenance?.next_action);
  const sinceLastPacket = asRecord(provenance?.since_last_packet);
  const checkpoint = asRecord(exportJson?.checkpoint);
  const checkpointMetadata = asRecord(handoff.checkpoint_metadata);
  const projectRecord = asRecord(provenance?.project);
  const operationLayer = asRecord(provenance?.operation_layer);
  const readiness = asString(currentDirection?.readiness);
  const readinessBlockers = asArray(currentDirection?.readiness_blockers);
  const nextStep = asString(currentDirection?.next_step);
  const nextActionLabel = asString(nextAction?.action_label);
  const nextActionExplanation = asString(nextAction?.explanation);
  const changeSummary = asString(sinceLastPacket?.summary) || 'No summary of changes was included.';
  const carryForwardCue = asString(sinceLastPacket?.carry_forward_cue);
  const checkpointTitle = asString(checkpoint?.title);
  const checkpointTimestamp = asString(checkpoint?.timestamp);
  const packetVersion = asString(projectRecord?.packet_version) || asString(checkpointMetadata?.packet_version) || String(checkpointMetadata?.packet_version || projectRecord?.packet_version || 1);
  const acceptedContext = handoff.accepted_context || [];
  const approvedEvidence = handoff.approved_evidence || [];
  const decisions = handoff.decisions || [];
  const commitments = handoff.commitments || [];
  const runs = handoff.runs || [];
  const openItemsSummary = summarizeOpenItems(commitments, readinessBlockers);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-slate-300 pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Published Update</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{handoff.project_title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{handoff.project_summary || 'No project summary was included.'}</p>
          <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
            This page is a shared engineering packet snapshot. It gives a teammate or reviewer the current project state, what changed, what still needs attention, and what should happen next.
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Published {formatDateTime(handoff.published_at)}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Milestone {handoff.handoff_version}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Packet v{packetVersion}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">Prepared by {handoff.published_by.label}</span>
            {handoff.audience && <span className="rounded border border-slate-300 bg-white px-2 py-1">{handoff.audience}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => downloadText(`${handoff.project_id}-published-update.md`, handoff.markdown, 'text/markdown;charset=utf-8')}
              className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              Download Markdown
            </button>
            <button
              onClick={() => downloadText(`${handoff.project_id}-published-update.json`, JSON.stringify(handoff.json, null, 2), 'application/json;charset=utf-8')}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Download JSON
            </button>
          </div>
        </header>

        <div className="mt-8 space-y-8">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Current Status</div>
              <div className="mt-3 text-lg font-semibold text-slate-900">
                {readiness === 'ready' ? 'Ready to carry forward' : 'Needs review'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{openItemsSummary}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>{approvedEvidence.length} reviewed source{approvedEvidence.length === 1 ? '' : 's'}</span>
                <span>{decisions.length} decision{decisions.length === 1 ? '' : 's'}</span>
                <span>{commitments.length} open action{commitments.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">What Changed</div>
              <div className="mt-3 text-sm leading-6 text-slate-700">{changeSummary}</div>
              {checkpointTitle && (
                <div className="mt-3 text-xs text-slate-500">
                  Last saved checkpoint: {checkpointTitle}
                  {checkpointTimestamp ? ` on ${formatDateTime(checkpointTimestamp)}` : ''}
                </div>
              )}
            </div>
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">What Happens Next</div>
              <div className="mt-3 text-sm font-semibold text-slate-900">{nextStep || nextActionLabel || 'No next step was included.'}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {nextActionExplanation || carryForwardCue || 'Use this update to confirm the next engineering move with the project owner.'}
              </p>
            </div>
          </section>

          {operationLayer && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-slate-900">Operation Layer</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                This update includes the current operating objective and review checks attached to the packet.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Objective</div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">{asString(operationLayer.objective) || 'No operation objective was included.'}</div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Operation Type</div>
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {asString(operationLayer.operation_type)?.replace(/_/g, ' ') || 'general project'}
                  </div>
                </div>
              </div>
              {asArray(operationLayer.success_checks).length > 0 && (
                <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Success Checks</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {asArray(operationLayer.success_checks).map((check, index) => (
                      <li key={`success-check-${index}`} className="flex gap-2">
                        <span className="text-slate-400">•</span>
                        <span>{String(check)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {asString(operationLayer.failure_notes) && (
                <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Failure Notes</div>
                  <div className="mt-2 text-sm leading-6 text-amber-900">{asString(operationLayer.failure_notes)}</div>
                </div>
              )}
            </section>
          )}

          {acceptedContext.length > 0 && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-slate-900">Accepted Notes and Constraints</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                The project owner marked these items as safe to carry into review and the next engineering update.
              </p>
              <ul className="space-y-4">
                {(acceptedContext as any[]).map((item: any, index: number) => (
                  <li key={`accepted-context-${index}`} className="border-l-2 border-emerald-500 pl-4">
                    <h3 className="font-semibold text-slate-800">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
                    {Array.isArray(item.assets) && item.assets.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.assets.map((asset: any, assetIndex: number) => (
                          <a
                            key={`accepted-context-asset-${assetIndex}`}
                            href={asset.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            Attached asset: {asset.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {approvedEvidence.length > 0 && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-slate-900">Reviewed Sources</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                These sources were reviewed and are being used to support the current update.
              </p>
              <div className="space-y-3">
                {(approvedEvidence as any[]).map((item: any, index: number) => (
                  <div key={`approved-evidence-${index}`} className="rounded border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.title || 'Untitled source'}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {item.type || 'Source'}
                          {item.timestamp ? ` | ${formatDateTime(item.timestamp)}` : ''}
                        </div>
                      </div>
                      {item.review_state && (
                        <span className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                          {String(item.review_state).replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {item.summary && <div className="mt-3 text-sm leading-6 text-slate-700">{item.summary}</div>}
                    {item.review_note && (
                      <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        {item.review_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {decisions.length > 0 && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Decision Log</h2>
              <ul className="space-y-3 text-sm text-slate-700">
                {(decisions as any[]).map((item: any, index: number) => (
                  <li key={`decision-${index}`} className="flex gap-3">
                    <span className="text-slate-400">•</span>
                    <div>
                      <strong>{item.title}</strong>: {item.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {commitments.length > 0 && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-lg font-bold text-slate-900">Open Actions Carried Forward</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                These are the active or still-relevant actions a teammate should understand before work continues.
              </p>
              <ul className="space-y-3 text-sm text-slate-700">
                {(commitments as any[]).map((item: any, index: number) => (
                  <li key={`commitment-${index}`} className="flex gap-3">
                    <span className="text-emerald-500">→</span>
                    <div>
                      <strong>{item.title}</strong>: {item.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {runs.length > 0 && (
            <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-slate-900">Run Trace</h2>
              <p className="mb-4 text-sm leading-6 text-slate-600">
                These supervised runs show how work moved through proposal, review, and accepted packet truth.
              </p>
              <div className="space-y-4">
                {(runs as any[]).map((run: any, index: number) => (
                  <div key={`run-${index}`} className="rounded border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{run.title || 'Untitled run'}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {String(run.run_state || 'draft').replace(/_/g, ' ')}
                          {run.updated_at ? ` | ${formatDateTime(run.updated_at)}` : ''}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                        <span className="rounded border border-slate-300 bg-white px-2 py-1">
                          {acceptedCompletedCount(run)} accepted
                        </span>
                        <span className="rounded border border-slate-300 bg-white px-2 py-1">
                          {Number(asRecord(run.action_counts)?.rejected || 0)} rejected
                        </span>
                      </div>
                    </div>
                    {run.objective && <div className="mt-3 text-sm leading-6 text-slate-700">{run.objective}</div>}
                    {asRecord(run.playbook_definition) && (
                      <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        Linked playbook: {asString(asRecord(run.playbook_definition)?.title) || 'Reusable playbook attached'}
                      </div>
                    )}
                    {run.outcome_summary && (
                      <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        Outcome: {run.outcome_summary}
                      </div>
                    )}
                    {Array.isArray(run.actions) && run.actions.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Accepted Steps</div>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {run.actions.slice(0, 5).map((action: any, actionIndex: number) => (
                            <li key={`run-action-${index}-${actionIndex}`} className="flex gap-2">
                              <span className="text-slate-400">•</span>
                              <span>
                                {action.description} <span className="text-slate-500">({String(action.state || 'proposed').replace(/_/g, ' ')})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {(!acceptedContext.length && !approvedEvidence.length && !decisions.length && !commitments.length && !runs.length) && (
            <article className="prose prose-slate max-w-none whitespace-pre-wrap rounded border border-slate-200 bg-white p-6 text-sm leading-7 shadow-sm">
              {handoff.markdown}
            </article>
          )}

          <FeedbackSection handoff={handoff} />
        </div>

        <footer className="mt-8 rounded border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
          This public page contains only the packet snapshot the project owner published. Private comments, rejected proposals, member emails, and internal activity are not included.
        </footer>
      </div>
    </main>
  );
}

function FeedbackSection({ handoff }: { handoff: PublishedHandoff }) {
  const [feedback, setFeedback] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const { submitHandoffFeedback } = await import('./projects/cloud');
      const result = await submitHandoffFeedback(handoff.project_id, handoff.token, feedback, author);
      if (result.ok) {
        setSubmitted(true);
        setFeedback('');
      } else {
        setError(result.error || 'Failed to submit feedback.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="rounded border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-bold text-emerald-900">Feedback Submitted</h2>
        <p className="text-sm leading-6 text-emerald-800">
          Your feedback has been sent directly to the review queue. The team will judge it and carry it forward.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm font-semibold text-emerald-700 underline"
        >
          Submit more feedback
        </button>
      </section>
    );
  }

  return (
    <section className="rounded border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-bold text-slate-900">Leave Feedback</h2>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        Reviewing this update? Leave notes, questions, or corrections here. They will drop directly into the team&apos;s review inbox so the next packet decision can happen in the same judged workflow.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
            Your Notes
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[100px] w-full rounded border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="What should be updated or addressed next?"
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">
            Your Name (Optional)
          </label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded border border-slate-300 p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            placeholder="Anonymous Reviewer"
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !feedback.trim()}
          className="rounded bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send to Review Queue'}
        </button>
      </form>
    </section>
  );
}
