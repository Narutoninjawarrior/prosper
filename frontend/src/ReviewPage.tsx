import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowRight, FolderOpen, GitBranch, Shield } from 'lucide-react';
import {
  createProjectRoomAccount,
  listenToProjectAuth,
  signInProjectRoom,
  signInProjectRoomWithGoogle,
  type ProjectAuthState,
} from './projects/auth';
import {
  listenToHostedProjectRooms,
  listenToProjectRoomMembers,
  permissionsForRole,
  reviewProjectRoomProposalBundleRemote,
  reviewProjectRoomProposalRemote,
  type CloudProjectRoom,
  type ProjectRoomMember,
  type ProjectRoomRole,
} from './projects/cloud';
import type { ProjectProposalRecord, ProjectProposalReviewState } from './ProjectsPage';

type ReviewDecision = Extract<ProjectProposalReviewState, 'accepted' | 'rejected' | 'deferred'>;

interface DerivedProposalBundle {
  id: string;
  label: string;
  source: string;
  submittedAt: string;
  packetVersionSeen?: number;
  clientRequestId?: string;
  summary?: string;
  fingerprint?: string;
  proposals: ProjectProposalRecord[];
  waitingCount: number;
  acceptedCount: number;
  rejectedCount: number;
  deferredCount: number;
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getProposalTypeLabel(type: ProjectProposalRecord['proposal_type']) {
  switch (type) {
    case 'run':
      return 'Proposed Run';
    case 'run_step':
      return 'Proposed Step';
    case 'decision':
      return 'Proposed Decision';
    case 'scope_note':
      return 'Proposed Scope Note';
    case 'source':
      return 'Proposed Source';
    case 'open_action':
      return 'Proposed Open Action';
    default:
      return 'Proposal';
  }
}

function getReviewStateLabel(state: ProjectProposalReviewState) {
  switch (state) {
    case 'accepted':
      return 'Accepted into Packet';
    case 'rejected':
      return 'Rejected in Review';
    case 'deferred':
      return 'Deferred';
    default:
      return 'Waiting for Judgment';
  }
}

function getReviewStateClasses(state: ProjectProposalReviewState) {
  switch (state) {
    case 'accepted':
      return 'border-emerald-900/40 bg-emerald-950/20 text-emerald-200';
    case 'rejected':
      return 'border-rose-900/40 bg-rose-950/20 text-rose-200';
    case 'deferred':
      return 'border-slate-800 bg-slate-950/30 text-slate-200';
    default:
      return 'border-amber-900/40 bg-amber-950/20 text-amber-200';
  }
}

function compareDesc(a?: string, b?: string) {
  const aValue = a ? Date.parse(a) : 0;
  const bValue = b ? Date.parse(b) : 0;
  return bValue - aValue;
}

function deriveProposalBundles(proposals: ProjectProposalRecord[]): DerivedProposalBundle[] {
  const groups = new Map<string, ProjectProposalRecord[]>();
  proposals.forEach((proposal) => {
    const key = proposal.proposal_bundle_id || proposal.id;
    const current = groups.get(key) || [];
    current.push(proposal);
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .map(([id, items]) => {
      const proposalsForBundle = [...items].sort((left, right) => compareDesc(left.proposed_at, right.proposed_at));
      const first = proposalsForBundle[0];
      const waitingCount = proposalsForBundle.filter((proposal) => proposal.review_state === 'proposed').length;
      const acceptedCount = proposalsForBundle.filter((proposal) => proposal.review_state === 'accepted').length;
      const rejectedCount = proposalsForBundle.filter((proposal) => proposal.review_state === 'rejected').length;
      const deferredCount = proposalsForBundle.filter((proposal) => proposal.review_state === 'deferred').length;
      return {
        id,
        label:
          first.proposal_bundle_label ||
          first.proposal_bundle_human_summary ||
          `Proposal Bundle ${id.slice(-6)}`,
        source: first.proposal_bundle_source || first.proposed_by || first.proposal_source,
        submittedAt: first.proposed_at || nowIso(),
        packetVersionSeen: first.packet_version_seen,
        clientRequestId: first.client_request_id,
        summary: first.proposal_bundle_human_summary,
        fingerprint: first.proposal_bundle_fingerprint,
        proposals: proposalsForBundle,
        waitingCount,
        acceptedCount,
        rejectedCount,
        deferredCount,
      };
    })
    .sort((left, right) => compareDesc(left.submittedAt, right.submittedAt));
}

function roomRoleForUser(members: ProjectRoomMember[], user: User | null): ProjectRoomRole {
  if (!user) return 'viewer';
  return members.find((member) => member.uid === user.uid)?.role || 'viewer';
}

function roleLabel(role: ProjectRoomRole) {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'editor':
      return 'Editor';
    case 'reviewer':
      return 'Reviewer';
    default:
      return 'Viewer';
  }
}

function EmptyCard({
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
      {ctaLabel && ctaHref ? (
        <a
          href={ctaHref}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:border-sky-400/50 hover:bg-sky-500/15"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export default function ReviewPage() {
  const [authState, setAuthState] = useState<ProjectAuthState>({ status: 'checking', user: null, error: null });
  const [hostedRooms, setHostedRooms] = useState<CloudProjectRoom[]>([]);
  const [hostedRoomError, setHostedRoomError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roomMembers, setRoomMembers] = useState<ProjectRoomMember[]>([]);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [proposalNotesById, setProposalNotesById] = useState<Record<string, string>>({});
  const [bundleNotesById, setBundleNotesById] = useState<Record<string, string>>({});
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [busyBundleId, setBusyBundleId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    listenToProjectAuth((nextState) => {
      if (!cancelled) setAuthState(nextState);
    }).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe?.();
        return;
      }
      unsubscribe = nextUnsubscribe;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (authState.status !== 'signed_in') {
      setHostedRooms([]);
      setSelectedRoomId('');
      setHostedRoomError(null);
      return;
    }
    const unsubscribe = listenToHostedProjectRooms(
      authState.user,
      (rooms) => {
        setHostedRooms(rooms);
        setHostedRoomError(null);
      },
      setHostedRoomError,
    );
    return () => {
      unsubscribe?.();
    };
  }, [authState]);

  useEffect(() => {
    if (!selectedRoomId && hostedRooms.length > 0) {
      setSelectedRoomId(hostedRooms[0].id);
      return;
    }
    if (selectedRoomId && hostedRooms.length > 0 && !hostedRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(hostedRooms[0].id);
    }
  }, [hostedRooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) {
      setRoomMembers([]);
      return;
    }
    const unsubscribe = listenToProjectRoomMembers(
      selectedRoomId,
      (members) => setRoomMembers(members),
      (message) => setReviewMessage(message),
    );
    return () => {
      unsubscribe?.();
    };
  }, [selectedRoomId]);

  const currentUser: User | null = authState.status === 'signed_in' ? authState.user : null;
  const selectedRoom = useMemo(
    () => hostedRooms.find((room) => room.id === selectedRoomId) || null,
    [hostedRooms, selectedRoomId],
  );
  const currentRole = roomRoleForUser(roomMembers, currentUser);
  const currentPermissions = permissionsForRole(currentRole);

  const proposalHistory = useMemo(
    () => selectedRoom?.project?.proposal_history || [],
    [selectedRoom],
  );
  const proposalBundles = useMemo(() => deriveProposalBundles(proposalHistory), [proposalHistory]);
  const pendingBundles = useMemo(
    () => proposalBundles.filter((bundle) => bundle.waitingCount > 0),
    [proposalBundles],
  );
  const recentJudgedItems = useMemo(
    () =>
      [...proposalHistory]
        .filter((proposal) => proposal.review_state !== 'proposed')
        .sort((left, right) => compareDesc(left.reviewed_at || left.proposed_at, right.reviewed_at || right.proposed_at))
        .slice(0, 18),
    [proposalHistory],
  );

  const handleAuthSubmit = useCallback(async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setReviewMessage('Email and password are required to open shared packet rooms.');
      return;
    }
    try {
      setIsSubmittingAuth(true);
      setReviewMessage(null);
      if (isCreatingAccount) {
        await createProjectRoomAccount(authEmail, authPassword);
      } else {
        await signInProjectRoom(authEmail, authPassword);
      }
      setAuthPassword('');
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setIsSubmittingAuth(false);
    }
  }, [authEmail, authPassword, isCreatingAccount]);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setReviewMessage(null);
      await signInProjectRoomWithGoogle();
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Google sign-in failed.');
    }
  }, []);

  const handleReviewProposal = useCallback(
    async (proposalId: string, decision: ReviewDecision) => {
      if (!selectedRoom || !currentUser) return;
      const reviewNote = (proposalNotesById[proposalId] || '').trim();
      setBusyProposalId(proposalId);
      setReviewMessage(null);
      try {
        const result = await reviewProjectRoomProposalRemote(
          {
            room_id: selectedRoom.id,
            proposal_id: proposalId,
            decision,
            review_note: reviewNote,
          },
          currentUser,
        );
        if (!result.ok) {
          setReviewMessage(result.error || 'Proposal review failed.');
          return;
        }
        setProposalNotesById((current) => ({ ...current, [proposalId]: '' }));
        setReviewMessage(result.value?.message || `${getReviewStateLabel(decision)} recorded.`);
      } finally {
        setBusyProposalId(null);
      }
    },
    [currentUser, proposalNotesById, selectedRoom],
  );

  const handleReviewBundle = useCallback(
    async (bundleId: string, decision: ReviewDecision) => {
      if (!selectedRoom || !currentUser) return;
      const reviewNote = (bundleNotesById[bundleId] || '').trim();
      const bundle = proposalBundles.find((entry) => entry.id === bundleId);
      const pendingIds = bundle?.proposals.filter((proposal) => proposal.review_state === 'proposed').map((proposal) => proposal.id) || [];
      setBusyBundleId(bundleId);
      setReviewMessage(null);
      try {
        const result = await reviewProjectRoomProposalBundleRemote(
          {
            room_id: selectedRoom.id,
            bundle_id: bundleId,
            decision,
            review_note: reviewNote,
          },
          currentUser,
        );
        if (!result.ok) {
          setReviewMessage(result.error || 'Proposal bundle review failed.');
          return;
        }
        setBundleNotesById((current) => ({ ...current, [bundleId]: '' }));
        setProposalNotesById((current) => {
          const next = { ...current };
          pendingIds.forEach((proposalId) => {
            next[proposalId] = '';
          });
          return next;
        });
        setReviewMessage(result.value?.message || 'Proposal bundle reviewed.');
      } finally {
        setBusyBundleId(null);
      }
    },
    [bundleNotesById, currentUser, proposalBundles, selectedRoom],
  );

  return (
    <div className="min-h-screen bg-[#071013] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-[#0b1418] px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
                <Shield className="h-3.5 w-3.5" />
                Proposal Review Deck
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Review is where packet truth changes.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Open a shared packet room, inspect incoming proposal bundles, and judge them into accepted truth, deferred work, or rejected history without leaving the supervised workflow.
              </p>
            </div>
            <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="uppercase tracking-[0.2em] text-slate-500">Waiting</div>
                <div className="mt-2 text-2xl font-semibold text-amber-200">
                  {pendingBundles.reduce((sum, bundle) => sum + bundle.waitingCount, 0)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="uppercase tracking-[0.2em] text-slate-500">Judged</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-200">{recentJudgedItems.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="uppercase tracking-[0.2em] text-slate-500">Role</div>
                <div className="mt-2 text-2xl font-semibold text-sky-200">{roleLabel(currentRole)}</div>
              </div>
            </div>
          </div>
        </header>

        {reviewMessage ? (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {reviewMessage}
          </div>
        ) : null}

        {authState.status === 'unconfigured' ? (
          <EmptyCard
            title="Hosted review needs Firebase configuration"
            body={authState.error || 'This build does not currently have the hosted room auth configuration needed for live proposal review.'}
            ctaLabel="Open Projects"
            ctaHref="/projects"
          />
        ) : authState.status !== 'signed_in' ? (
          <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
              <div className="text-sm font-semibold text-white">Sign in to judge shared packet room work</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review only becomes real once you are inside a shared packet room with reviewer authority. Sign in, select the room, then judge waiting proposal bundles directly.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@team.com"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                />
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleAuthSubmit}
                  disabled={isSubmittingAuth}
                  className="rounded-full border border-sky-400/30 bg-sky-500/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/20 disabled:opacity-50"
                >
                  {isSubmittingAuth ? 'Opening…' : isCreatingAccount ? 'Create account' : 'Sign in'}
                </button>
                <button
                  onClick={() => setIsCreatingAccount((current) => !current)}
                  className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20"
                >
                  {isCreatingAccount ? 'Use existing account' : 'Need an account?'}
                </button>
                <button
                  onClick={handleGoogleSignIn}
                  className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-white/20"
                >
                  Sign in with Google
                </button>
              </div>
            </div>

            <EmptyCard
              title="How the real loop works"
              body="Agent Brief -> validated Proposal Bundle -> remote submit or local intake -> Waiting for Judgment. Once you judge the bundle here, packet version and review memory update together."
              ctaLabel="Open Projects"
              ctaHref="/projects"
            />
          </section>
        ) : hostedRoomError ? (
          <EmptyCard title="Shared packet rooms are unavailable" body={hostedRoomError} ctaLabel="Open Projects" ctaHref="/projects" />
        ) : hostedRooms.length === 0 ? (
          <EmptyCard
            title="No shared packet rooms yet"
            body="Create or import a shared project in Projects first. Review becomes useful once at least one shared packet room is carrying real proposal traffic."
            ctaLabel="Open Projects"
            ctaHref="/projects"
          />
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
              <aside className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Select Shared Packet Room</div>
                    <div className="mt-1 text-lg font-semibold text-white">Active review target</div>
                  </div>
                  <FolderOpen className="h-5 w-5 text-sky-300" />
                </div>

                <select
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                >
                  {hostedRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.title}
                    </option>
                  ))}
                </select>

                {selectedRoom ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-sm font-semibold text-white">{selectedRoom.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {selectedRoom.description || 'No room summary yet. Use the packet to define the current goal and next action.'}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Packet version</div>
                        <div className="mt-2 text-xl font-semibold text-white">v{selectedRoom.project.packet_version || 1}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Your authority</div>
                        <div className="mt-2 text-xl font-semibold text-white">{roleLabel(currentRole)}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <div className="font-medium text-white">Review authority</div>
                      <p className="mt-2 leading-6">
                        Owners, editors, and reviewers can judge waiting bundles. Viewers can inspect proposal history but cannot change packet truth.
                      </p>
                    </div>
                  </div>
                ) : null}
              </aside>

              <section className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live queue</div>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Waiting for Judgment</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Newest proposal bundles appear first. Accept merges them into packet truth and bumps packet version. Reject and Defer preserve review memory and require a note.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Queue size</div>
                    <div className="mt-2 text-2xl font-semibold text-amber-200">
                      {pendingBundles.reduce((sum, bundle) => sum + bundle.waitingCount, 0)}
                    </div>
                  </div>
                </div>

                {!selectedRoom ? (
                  <div className="mt-6">
                    <EmptyCard
                      title="Select Shared Packet Room"
                      body="Pick a shared packet room to load its live proposal queue. Review only becomes actionable once a room is selected."
                    />
                  </div>
                ) : pendingBundles.length === 0 ? (
                  <div className="mt-6">
                    <EmptyCard
                      title="No waiting proposal bundles"
                      body="The review queue is clear. The real loop is: Agent Brief -> validated Proposal Bundle -> remote submit or local intake -> Waiting for Judgment. Once a new bundle lands, it will appear here immediately."
                      ctaLabel="Open Projects"
                      ctaHref="/projects"
                    />
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {pendingBundles.map((bundle) => {
                      const bundleBusy = busyBundleId === bundle.id;
                      return (
                        <details
                          key={bundle.id}
                          open
                          className="rounded-3xl border border-amber-900/30 bg-amber-950/10 p-5"
                        >
                          <summary className="cursor-pointer list-none">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-amber-800/50 bg-amber-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                                    {bundle.waitingCount} waiting
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                                    {bundle.source}
                                  </span>
                                </div>
                                <div className="mt-3 text-lg font-semibold text-white">{bundle.label}</div>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                  {bundle.summary || 'No bundle summary was supplied.'}
                                </p>
                              </div>
                              <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                  <div className="uppercase tracking-[0.18em] text-slate-500">Submitted</div>
                                  <div className="mt-1 text-slate-100">{formatDateTime(bundle.submittedAt)}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                  <div className="uppercase tracking-[0.18em] text-slate-500">Packet seen</div>
                                  <div className="mt-1 text-slate-100">v{bundle.packetVersionSeen || selectedRoom.project.packet_version || 1}</div>
                                </div>
                                {bundle.clientRequestId ? (
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 sm:col-span-2">
                                    <div className="uppercase tracking-[0.18em] text-slate-500">client_request_id</div>
                                    <div className="mt-1 truncate text-slate-100">{bundle.clientRequestId}</div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </summary>

                          <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
                            <div className="space-y-3">
                              {bundle.proposals.map((proposal) => {
                                const proposalBusy = busyProposalId === proposal.id;
                                return (
                                  <div key={proposal.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                                            {getProposalTypeLabel(proposal.proposal_type)}
                                          </span>
                                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getReviewStateClasses(proposal.review_state)}`}>
                                            {getReviewStateLabel(proposal.review_state)}
                                          </span>
                                        </div>
                                        <div className="mt-3 text-base font-semibold text-white">{proposal.proposal_summary}</div>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">{proposal.payload_summary}</p>
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        <div>Source: {proposal.proposed_by || proposal.source_label || proposal.proposal_source}</div>
                                        <div className="mt-1">Submitted: {formatDateTime(proposal.proposed_at)}</div>
                                        {proposal.packet_version_seen ? (
                                          <div className="mt-1">Packet seen: v{proposal.packet_version_seen}</div>
                                        ) : null}
                                      </div>
                                    </div>

                                    {proposal.review_state === 'proposed' ? (
                                      <>
                                        <textarea
                                          value={proposalNotesById[proposal.id] || ''}
                                          onChange={(event) =>
                                            setProposalNotesById((current) => ({ ...current, [proposal.id]: event.target.value }))
                                          }
                                          placeholder="Review note for reject/defer, or leave a short acceptance note."
                                          className="mt-4 min-h-[88px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                        />
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <button
                                            disabled={!currentPermissions.canReview || proposalBusy}
                                            onClick={() => void handleReviewProposal(proposal.id, 'accepted')}
                                            className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={!currentPermissions.canReview ? 'Requires Reviewer role' : undefined}
                                          >
                                            Accept
                                          </button>
                                          <button
                                            disabled={!currentPermissions.canReview || proposalBusy}
                                            onClick={() => void handleReviewProposal(proposal.id, 'deferred')}
                                            className="rounded-full border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-400/60 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={!currentPermissions.canReview ? 'Requires Reviewer role' : undefined}
                                          >
                                            Defer
                                          </button>
                                          <button
                                            disabled={!currentPermissions.canReview || proposalBusy}
                                            onClick={() => void handleReviewProposal(proposal.id, 'rejected')}
                                            className="rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={!currentPermissions.canReview ? 'Requires Reviewer role' : undefined}
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                                        <div className="font-medium text-white">
                                          {getReviewStateLabel(proposal.review_state)}
                                          {proposal.promoted_target ? ` -> ${proposal.promoted_target.label}` : ''}
                                        </div>
                                        <div className="mt-2">
                                          {proposal.review_note || 'No review note recorded.'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-sm font-semibold text-white">Bundle judgment</div>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                Use a bundle-level note when you want one judgment pass to apply across every waiting item in this submission.
                              </p>
                              <textarea
                                value={bundleNotesById[bundle.id] || ''}
                                onChange={(event) =>
                                  setBundleNotesById((current) => ({ ...current, [bundle.id]: event.target.value }))
                                }
                                placeholder="Why accept, reject, or defer this bundle?"
                                className="mt-4 min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                              />
                              <div className="mt-4 grid gap-2">
                                <button
                                  disabled={!currentPermissions.canReview || bundleBusy}
                                  onClick={() => void handleReviewBundle(bundle.id, 'accepted')}
                                  className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Accept bundle
                                </button>
                                <button
                                  disabled={!currentPermissions.canReview || bundleBusy}
                                  onClick={() => void handleReviewBundle(bundle.id, 'deferred')}
                                  className="rounded-full border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-400/60 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Defer bundle
                                </button>
                                <button
                                  disabled={!currentPermissions.canReview || bundleBusy}
                                  onClick={() => void handleReviewBundle(bundle.id, 'rejected')}
                                  className="rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reject bundle
                                </button>
                              </div>
                            </aside>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recent judgment</div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">What changed in the packet</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This is the quick re-entry view for what was accepted, rejected, or deferred most recently, including the note and the packet object it became.
                  </p>
                </div>
                <GitBranch className="mt-1 h-5 w-5 text-sky-300" />
              </div>

              {recentJudgedItems.length === 0 ? (
                <div className="mt-6">
                  <EmptyCard
                    title="No judged work yet"
                    body="Once a proposal is accepted, rejected, or deferred, it will show up here with review memory, actor context, and promoted packet target."
                  />
                </div>
              ) : (
                <div className="mt-6 grid gap-3 lg:grid-cols-2">
                  {recentJudgedItems.map((proposal) => (
                    <article key={proposal.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getReviewStateClasses(proposal.review_state)}`}>
                          {getReviewStateLabel(proposal.review_state)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                          {getProposalTypeLabel(proposal.proposal_type)}
                        </span>
                      </div>
                      <div className="mt-3 text-base font-semibold text-white">{proposal.proposal_summary}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{proposal.review_note || 'No review note recorded.'}</div>
                      <dl className="mt-4 space-y-2 text-xs text-slate-400">
                        <div className="flex items-start justify-between gap-3">
                          <dt>Judged by</dt>
                          <dd className="text-right text-slate-200">
                            {proposal.reviewed_by || proposal.proposed_by || 'Unknown'}
                            {proposal.reviewed_by_role ? ` (${roleLabel(proposal.reviewed_by_role)})` : ''}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <dt>Judged at</dt>
                          <dd className="text-right text-slate-200">{formatDateTime(proposal.reviewed_at || proposal.proposed_at)}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <dt>Promoted target</dt>
                          <dd className="text-right text-slate-200">
                            {proposal.promoted_target ? proposal.promoted_target.label : 'No packet object created'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
