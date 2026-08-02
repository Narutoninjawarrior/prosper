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
  listenToProjectFeedback,
  listenToProjectRoomMembers,
  permissionsForRole,
  reviewProjectRoomProposalBundleRemote,
  reviewProjectRoomProposalRemote,
  submitProjectRoomProposalBundleRemote,
  updateProjectFeedbackStatus,
  type CloudProjectRoom,
  type ProjectFeedback,
  type ProjectRoomMember,
  type ProjectRoomRole,
} from './projects/cloud';
import type { ProjectProposalRecord, ProjectProposalReviewState, ProjectProposalType } from './ProjectsPage';

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
  fullyClosed: boolean;
}

type TriageMode = 'all' | 'agent' | 'feedback' | 'high' | 'ready' | 'followup';
type TriagePriorityLevel = 'high' | 'medium' | 'low';
interface LocalReviewClaim {
  roomId: string;
  bundleId: string;
  reviewerUid: string;
  reviewerLabel: string;
  claimedAt: string;
}

interface TriageInsight {
  level: TriagePriorityLevel;
  score: number;
  reason: string;
  consequence: string;
  readyToAccept: boolean;
  needsFollowUp: boolean;
  touchesPublishedUpdate: boolean;
}

type TriageItem =
  | {
      type: 'bundle';
      id: string;
      bundle: DerivedProposalBundle;
      timestamp: string;
      priority: TriageInsight;
      sourceKind: 'agent';
    }
  | {
      type: 'feedback';
      id: string;
      feedback: ProjectFeedback;
      timestamp: string;
      priority: TriageInsight;
      sourceKind: 'external_feedback';
    };

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
        fullyClosed: waitingCount === 0,
      };
    })
    .sort((left, right) => compareDesc(left.submittedAt, right.submittedAt));
}

function getProposalTypeWeight(type: ProjectProposalType) {
  switch (type) {
    case 'decision':
      return 26;
    case 'open_action':
      return 24;
    case 'run':
      return 22;
    case 'run_step':
      return 18;
    case 'source':
      return 14;
    case 'scope_note':
      return 12;
    default:
      return 10;
  }
}

function getProposalImpactLabel(type: ProjectProposalType) {
  switch (type) {
    case 'decision':
      return 'Decision';
    case 'open_action':
      return 'Open Action';
    case 'run':
      return 'Run';
    case 'run_step':
      return 'Run Step';
    case 'source':
      return 'Source';
    case 'scope_note':
      return 'Scope Note';
    default:
      return 'Packet Item';
  }
}

function summarizeProposalImpact(proposals: ProjectProposalRecord[]) {
  const counts = new Map<ProjectProposalType, number>();
  proposals
    .filter((proposal) => proposal.review_state === 'proposed')
    .forEach((proposal) => {
      counts.set(proposal.proposal_type, (counts.get(proposal.proposal_type) || 0) + 1);
    });

  const parts = Array.from(counts.entries()).map(([type, count]) => `${count} ${getProposalImpactLabel(type)}${count === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'No waiting packet changes remain in this bundle.';
  return `If accepted: ${parts.join(', ')} become packet truth.`;
}

function deriveBundleTriageInsight(bundle: DerivedProposalBundle, activePacketVersion: number): TriageInsight {
  const waitingProposals = bundle.proposals.filter((proposal) => proposal.review_state === 'proposed');
  const waitingTypes = waitingProposals.map((proposal) => proposal.proposal_type);
  const hasRunStep = waitingTypes.includes('run_step');
  const hasRun = waitingTypes.includes('run');
  const stalePacket = typeof bundle.packetVersionSeen === 'number' && bundle.packetVersionSeen < activePacketVersion;
  const touchesPublishedUpdate = waitingTypes.some((type) =>
    type === 'decision' || type === 'open_action' || type === 'scope_note' || type === 'source',
  );

  let score = 0;
  waitingTypes.forEach((type) => {
    score += getProposalTypeWeight(type);
  });
  if (bundle.waitingCount >= 3) score += 10;
  if (bundle.deferredCount > 0) score += 12;
  if (bundle.rejectedCount > 0) score += 6;
  if (stalePacket) score += 40;

  const readyToAccept = !stalePacket && bundle.waitingCount > 0 && bundle.waitingCount <= 2 && !hasRunStep;
  const needsFollowUp = stalePacket || bundle.deferredCount > 0 || (hasRunStep && !hasRun) || bundle.waitingCount >= 4;

  const reason = stalePacket
    ? `Submitted against packet v${bundle.packetVersionSeen}; active packet is v${activePacketVersion}. Review this first to avoid stale truth.`
    : bundle.deferredCount > 0
      ? 'This bundle already has deferred work tied to it and needs a fresh call.'
      : readyToAccept
        ? 'Current packet version matches and the proposed change is small enough for a clean judgment pass.'
        : waitingTypes.includes('decision') || waitingTypes.includes('open_action')
          ? 'This bundle can directly change packet decisions or open actions.'
          : 'This bundle changes packet context and should be judged before the next publish cycle.';

  const level: TriagePriorityLevel = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';

  return {
    level,
    score,
    reason,
    consequence: summarizeProposalImpact(waitingProposals),
    readyToAccept,
    needsFollowUp,
    touchesPublishedUpdate,
  };
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clipText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function deriveFeedbackTitle(feedback: ProjectFeedback) {
  const compact = compactWhitespace(feedback.content);
  if (!compact) return `Follow up with ${feedback.author_name || 'reviewer'}`;
  const firstSentence = compact.split(/(?<=[.!?])\s+/)[0] || compact;
  const cleaned = firstSentence
    .replace(/^(please|can you|could you|would you|i think|we think)\s+/i, '')
    .replace(/[!?]+$/g, '')
    .trim();
  const title = cleaned || compact;
  return clipText(title.charAt(0).toUpperCase() + title.slice(1), 72);
}

function deriveFeedbackInsight(feedback: ProjectFeedback): TriageInsight {
  const text = compactWhitespace(feedback.content).toLowerCase();
  const mentionsUrgency = /(urgent|asap|blocked|blocking|broken|failing|failure|missing|wrong|regression|security|outage)/i.test(
    text,
  );
  const asksQuestion = text.includes('?');
  const asksForChange = /(please|can you|could you|would you|need to|should|follow up|fix|change|update|add|remove|clarify|confirm|review)/i.test(
    text,
  );
  const longOrDense = compactWhitespace(feedback.content).length > 220 || feedback.content.includes('\n');

  let score = 18;
  if (mentionsUrgency) score += 42;
  if (asksQuestion) score += 18;
  if (asksForChange) score += 24;
  if (longOrDense) score += 8;

  const level: TriagePriorityLevel = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  const readyToAccept = asksForChange || asksQuestion;
  const needsFollowUp = asksQuestion || longOrDense || mentionsUrgency;

  const reason = mentionsUrgency
    ? 'External feedback points to a likely blocker or high-stakes issue.'
    : asksQuestion
      ? 'External feedback is asking for a response that should route back into packet work.'
      : asksForChange
        ? 'External feedback is specific enough to turn into a proposed open action.'
        : 'External feedback should be triaged before the next published update.';

  return {
    level,
    score,
    reason,
    consequence:
      'If converted: creates a Proposed Open Action linked back to this feedback and sends it to Waiting for Judgment.',
    readyToAccept,
    needsFollowUp,
    touchesPublishedUpdate: true,
  };
}

function getPriorityClasses(level: TriagePriorityLevel) {
  switch (level) {
    case 'high':
      return 'border-rose-900/40 bg-rose-950/20 text-rose-100';
    case 'medium':
      return 'border-amber-900/40 bg-amber-950/20 text-amber-100';
    default:
      return 'border-slate-800 bg-slate-950/40 text-slate-200';
  }
}

function getPriorityLabel(level: TriagePriorityLevel) {
  switch (level) {
    case 'high':
      return 'High Priority';
    case 'medium':
      return 'Needs Judgment';
    default:
      return 'Can Wait';
  }
}

function triageModeLabel(mode: TriageMode) {
  switch (mode) {
    case 'agent':
      return 'Agent proposals';
    case 'feedback':
      return 'External feedback';
    case 'high':
      return 'High priority';
    case 'ready':
      return 'Ready to accept';
    case 'followup':
      return 'Needs follow-up';
    default:
      return 'All incoming work';
  }
}

const REVIEW_NOTE_TEMPLATES = [
  'Needs a narrower proposal.',
  'Packet version is stale. Reload the latest brief and resubmit.',
  'Missing the packet impact needed for a clean judgment.',
  'Needs stronger source support before acceptance.',
];
const REVIEW_CLAIMS_STORAGE_KEY = 'prosper_review_claims';
const REVIEW_LAST_SEEN_STORAGE_KEY = 'prosper_review_last_seen';

function summarizeBundleClosure(bundle: DerivedProposalBundle) {
  const parts: string[] = [];
  if (bundle.acceptedCount > 0) parts.push(`${bundle.acceptedCount} accepted`);
  if (bundle.rejectedCount > 0) parts.push(`${bundle.rejectedCount} rejected`);
  if (bundle.deferredCount > 0) parts.push(`${bundle.deferredCount} deferred`);
  if (bundle.waitingCount > 0) parts.push(`${bundle.waitingCount} still waiting`);
  return parts.length > 0 ? parts.join(' • ') : 'No review outcome recorded yet.';
}

function summarizeBundlePacketChanges(bundle: DerivedProposalBundle) {
  const accepted = bundle.proposals.filter((proposal) => proposal.review_state === 'accepted');
  if (accepted.length === 0) {
    return 'No packet truth was accepted from this bundle yet.';
  }
  return accepted
    .map((proposal) => proposal.promoted_target?.label || proposal.target_title || getProposalTypeLabel(proposal.proposal_type))
    .slice(0, 3)
    .join(' • ');
}

function summarizeBundleFollowUp(bundle: DerivedProposalBundle) {
  if (bundle.waitingCount > 0) return `${bundle.waitingCount} proposal${bundle.waitingCount === 1 ? '' : 's'} still need judgment.`;
  if (bundle.deferredCount > 0) return 'Deferred work remains. This bundle is closed for now, but not fully resolved.';
  if (bundle.rejectedCount > 0 && bundle.acceptedCount === 0) return 'No packet truth changed. Resubmit only if the proposal should come back with tighter scope.';
  return 'Bundle is fully closed. Re-open only if a new proposal bundle is needed.';
}

function loadReviewClaims() {
  if (typeof window === 'undefined') return [] as LocalReviewClaim[];
  try {
    const raw = window.localStorage.getItem(REVIEW_CLAIMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LocalReviewClaim =>
        item &&
        typeof item.roomId === 'string' &&
        typeof item.bundleId === 'string' &&
        typeof item.reviewerUid === 'string' &&
        typeof item.reviewerLabel === 'string' &&
        typeof item.claimedAt === 'string',
    );
  } catch {
    return [];
  }
}

function saveReviewClaims(claims: LocalReviewClaim[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REVIEW_CLAIMS_STORAGE_KEY, JSON.stringify(claims));
}

function getLastSeenForRoom(roomId: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REVIEW_LAST_SEEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const value = parsed?.[roomId];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function setLastSeenForRoom(roomId: string, timestamp: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(REVIEW_LAST_SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[roomId] = timestamp;
    window.localStorage.setItem(REVIEW_LAST_SEEN_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    window.localStorage.setItem(REVIEW_LAST_SEEN_STORAGE_KEY, JSON.stringify({ [roomId]: timestamp }));
  }
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
  const [projectFeedback, setProjectFeedback] = useState<ProjectFeedback[]>([]);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [proposalNotesById, setProposalNotesById] = useState<Record<string, string>>({});
  const [bundleNotesById, setBundleNotesById] = useState<Record<string, string>>({});
  const [focusedQueueItemId, setFocusedQueueItemId] = useState<string | null>(null);
  const [reviewClaims, setReviewClaims] = useState<LocalReviewClaim[]>(() => loadReviewClaims());
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [busyBundleId, setBusyBundleId] = useState<string | null>(null);
  const [busyFeedbackId, setBusyFeedbackId] = useState<string | null>(null);
  const [triageMode, setTriageMode] = useState<TriageMode>('all');
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);

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

  useEffect(() => {
    if (authState.status !== 'signed_in' || !selectedRoomId) {
      setProjectFeedback([]);
      return;
    }
    const unsubscribe = listenToProjectFeedback(
      selectedRoomId,
      setProjectFeedback,
      (message) => setReviewMessage(message),
    );
    return () => {
      unsubscribe?.();
    };
  }, [authState.status, selectedRoomId]);

  useEffect(() => {
    saveReviewClaims(reviewClaims);
  }, [reviewClaims]);

  const currentUser: User | null = authState.status === 'signed_in' ? authState.user : null;
  const selectedRoom = useMemo(
    () => hostedRooms.find((room) => room.id === selectedRoomId) || null,
    [hostedRooms, selectedRoomId],
  );
  const currentRole = roomRoleForUser(roomMembers, currentUser);
  const currentPermissions = permissionsForRole(currentRole);

  useEffect(() => {
    if (!selectedRoomId) {
      setLastOpenedAt(null);
      return;
    }
    setLastOpenedAt(getLastSeenForRoom(selectedRoomId));
    return () => {
      setLastSeenForRoom(selectedRoomId, nowIso());
    };
  }, [selectedRoomId]);

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
  const pendingFeedback = useMemo(
    () => projectFeedback.filter((item) => item.status === 'new'),
    [projectFeedback],
  );

  const liveTriageQueue = useMemo<TriageItem[]>(() => {
    const items: TriageItem[] = [
      ...pendingBundles.map((bundle) => ({
        type: 'bundle' as const,
        id: `bundle-${bundle.id}`,
        bundle,
        timestamp: bundle.submittedAt,
        priority: deriveBundleTriageInsight(bundle, selectedRoom?.project.packet_version || 1),
        sourceKind: 'agent' as const,
      })),
      ...pendingFeedback.map((feedback) => ({
        type: 'feedback' as const,
        id: `feedback-${feedback.id}`,
        feedback,
        timestamp: feedback.created_at,
        priority: deriveFeedbackInsight(feedback),
        sourceKind: 'external_feedback' as const,
      })),
    ];
    return items.sort((left, right) => {
      if (right.priority.score !== left.priority.score) {
        return right.priority.score - left.priority.score;
      }
      return compareDesc(left.timestamp, right.timestamp);
    });
  }, [pendingBundles, pendingFeedback, selectedRoom?.project.packet_version]);

  const triageModeCounts = useMemo(
    () => ({
      all: liveTriageQueue.length,
      agent: liveTriageQueue.filter((item) => item.type === 'bundle').length,
      feedback: liveTriageQueue.filter((item) => item.type === 'feedback').length,
      high: liveTriageQueue.filter((item) => item.priority.level === 'high').length,
      ready: liveTriageQueue.filter((item) => item.priority.readyToAccept).length,
      followup: liveTriageQueue.filter((item) => item.priority.needsFollowUp).length,
    }),
    [liveTriageQueue],
  );

  const filteredTriageQueue = useMemo(() => {
    switch (triageMode) {
      case 'agent':
        return liveTriageQueue.filter((item) => item.type === 'bundle');
      case 'feedback':
        return liveTriageQueue.filter((item) => item.type === 'feedback');
      case 'high':
        return liveTriageQueue.filter((item) => item.priority.level === 'high');
      case 'ready':
        return liveTriageQueue.filter((item) => item.priority.readyToAccept);
      case 'followup':
        return liveTriageQueue.filter((item) => item.priority.needsFollowUp);
      default:
        return liveTriageQueue;
    }
  }, [liveTriageQueue, triageMode]);

  useEffect(() => {
    if (filteredTriageQueue.length === 0) {
      setFocusedQueueItemId(null);
      return;
    }
    if (!focusedQueueItemId || !filteredTriageQueue.some((item) => item.id === focusedQueueItemId)) {
      setFocusedQueueItemId(filteredTriageQueue[0].id);
    }
  }, [filteredTriageQueue, focusedQueueItemId]);

  const highestPriorityItem = useMemo(() => filteredTriageQueue[0] || liveTriageQueue[0] || null, [filteredTriageQueue, liveTriageQueue]);

  const focusedQueueItem = useMemo(
    () => filteredTriageQueue.find((item) => item.id === focusedQueueItemId) || filteredTriageQueue[0] || null,
    [filteredTriageQueue, focusedQueueItemId],
  );

  const bundleClaimsById = useMemo(() => {
    const map = new Map<string, LocalReviewClaim>();
    reviewClaims
      .filter((claim) => claim.roomId === selectedRoomId)
      .forEach((claim) => {
        map.set(claim.bundleId, claim);
      });
    return map;
  }, [reviewClaims, selectedRoomId]);

  const resolvedFeedback = useMemo(
    () =>
      [...projectFeedback]
        .filter((item) => item.status !== 'new')
        .sort((left, right) => compareDesc(left.created_at, right.created_at))
        .slice(0, 12),
    [projectFeedback],
  );

  const recentChangeSummary = useMemo(() => {
    const lastJudged = recentJudgedItems[0];
    const lastResolvedFeedback = resolvedFeedback[0];
    if (!lastJudged && !lastResolvedFeedback) return null;
    if (lastJudged && (!lastResolvedFeedback || compareDesc(lastJudged.reviewed_at || lastJudged.proposed_at, lastResolvedFeedback.created_at) < 0)) {
      return `${getReviewStateLabel(lastJudged.review_state)}: ${lastJudged.proposal_summary}`;
    }
    if (lastResolvedFeedback) {
      return `${lastResolvedFeedback.status === 'processed' ? 'Processed feedback' : 'Dismissed feedback'} from ${lastResolvedFeedback.author_name || 'reviewer'}`;
    }
    return null;
  }, [recentJudgedItems, resolvedFeedback]);

  const judgeNextSummary = useMemo(() => {
    if (!focusedQueueItem) return 'No waiting work.';
    return focusedQueueItem.priority.reason;
  }, [focusedQueueItem]);

  const changedSinceLastOpened = useMemo(() => {
    if (!lastOpenedAt) return [];
    const sinceTime = Date.parse(lastOpenedAt);
    if (!Number.isFinite(sinceTime)) return [];

    const changes: string[] = [];
    const recentAccepted = proposalHistory
      .filter((proposal) => {
        const timestamp = proposal.reviewed_at || proposal.proposed_at;
        return proposal.review_state === 'accepted' && Date.parse(timestamp) > sinceTime;
      })
      .slice(0, 3)
      .map((proposal) => `Accepted: ${proposal.promoted_target?.label || proposal.target_title || proposal.proposal_summary}`);
    const recentPending = proposalBundles
      .filter((bundle) => Date.parse(bundle.submittedAt) > sinceTime && bundle.waitingCount > 0)
      .slice(0, 2)
      .map((bundle) => `Waiting: ${bundle.label}`);
    const recentFeedbackChanges = projectFeedback
      .filter((feedback) => Date.parse(feedback.created_at) > sinceTime)
      .slice(0, 2)
      .map((feedback) => `Feedback: ${feedback.author_name || 'Reviewer'}`);

    changes.push(...recentAccepted, ...recentPending, ...recentFeedbackChanges);
    return changes.slice(0, 5);
  }, [lastOpenedAt, projectFeedback, proposalBundles, proposalHistory]);

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

  const handleFeedbackStatus = useCallback(
    async (feedbackId: string, status: 'processed' | 'dismissed') => {
      if (!selectedRoom) return;
      setBusyFeedbackId(feedbackId);
      setReviewMessage(null);
      try {
        const result = await updateProjectFeedbackStatus(selectedRoom.id, feedbackId, status);
        if (!result.ok) {
          setReviewMessage(result.error || 'Feedback update failed.');
          return;
        }
        setReviewMessage(status === 'processed' ? 'Feedback marked processed.' : 'Feedback dismissed.');
      } finally {
        setBusyFeedbackId(null);
      }
    },
    [selectedRoom],
  );

  const handleConvertFeedbackToOpenAction = useCallback(
    async (feedback: ProjectFeedback) => {
      if (!selectedRoom || !currentUser) return;
      setBusyFeedbackId(feedback.id);
      setReviewMessage(null);
      try {
        const bundleId = `feedback-${feedback.id.slice(0, 8)}`;
        const title = deriveFeedbackTitle(feedback);
        const author = feedback.author_name || 'External reviewer';
        const payloadSummary = clipText(compactWhitespace(feedback.content), 160);
        const feedbackSummary = clipText(compactWhitespace(feedback.content), 220);
        const submitResult = await submitProjectRoomProposalBundleRemote(
          {
            room_id: selectedRoom.id,
            bundle_id: bundleId,
            packet_version_seen: selectedRoom.project.packet_version || 1,
            client_request_id: `feedback-${feedback.id}`,
            agent_id: 'published-update-feedback',
            submitted_at: feedback.created_at || nowIso(),
            human_summary: `External feedback from ${author} converted into a proposed open action.`,
            proposals: [
              {
                type: 'open_action',
                payload: {
                  title,
                  rationale: `External feedback from ${author} on published update ${feedback.handoff_token}. ${payloadSummary}`,
                  next_action: `Respond to ${author} feedback on published update ${feedback.handoff_token}.`,
                  done_when: `The packet reflects the requested change or the next published update explains the decision back to ${author}.`,
                  context: feedback.content,
                  owner_uid: null,
                  source_reference: {
                    kind: 'published_update_feedback',
                    feedback_id: feedback.id,
                    handoff_token: feedback.handoff_token,
                    author_name: author,
                    summary: feedbackSummary,
                  },
                },
              },
            ],
          },
          currentUser,
        );
        if (!submitResult.ok) {
          setReviewMessage(submitResult.error || 'Failed to create proposal from feedback.');
          return;
        }
        await updateProjectFeedbackStatus(
          selectedRoom.id,
          feedback.id,
          'processed',
          'proposal_bundle',
          submitResult.value?.bundle_id || bundleId,
        );
        setReviewMessage('Feedback converted into a Proposal Bundle and sent to the triage queue.');
      } finally {
        setBusyFeedbackId(null);
      }
    },
    [currentUser, selectedRoom],
  );

  useEffect(() => {
    const canUseShortcuts = currentPermissions.canReview && filteredTriageQueue.length > 0;
    if (!canUseShortcuts) return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const currentIndex = filteredTriageQueue.findIndex((item) => item.id === (focusedQueueItem?.id || ''));
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;

      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        const nextItem = filteredTriageQueue[Math.min(filteredTriageQueue.length - 1, safeIndex + 1)];
        if (nextItem) setFocusedQueueItemId(nextItem.id);
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const nextItem = filteredTriageQueue[Math.min(filteredTriageQueue.length - 1, safeIndex + 1)];
        if (nextItem) setFocusedQueueItemId(nextItem.id);
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const previousItem = filteredTriageQueue[Math.max(0, safeIndex - 1)];
        if (previousItem) setFocusedQueueItemId(previousItem.id);
        return;
      }

      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        const previousItem = filteredTriageQueue[Math.max(0, safeIndex - 1)];
        if (previousItem) setFocusedQueueItemId(previousItem.id);
        return;
      }

      if (!focusedQueueItem) return;

      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (focusedQueueItem.type === 'bundle') {
          void handleReviewBundle(focusedQueueItem.bundle.id, 'accepted');
        } else {
          void handleConvertFeedbackToOpenAction(focusedQueueItem.feedback);
        }
        return;
      }

      if (focusedQueueItem.type === 'bundle' && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void handleReviewBundle(focusedQueueItem.bundle.id, 'rejected');
        return;
      }

      if (focusedQueueItem.type === 'bundle' && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        void handleReviewBundle(focusedQueueItem.bundle.id, 'deferred');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    currentPermissions.canReview,
    filteredTriageQueue,
    focusedQueueItem,
    handleConvertFeedbackToOpenAction,
    handleReviewBundle,
  ]);

  const applyNoteTemplate = useCallback((proposalId: string, template: string) => {
    setProposalNotesById((current) => ({ ...current, [proposalId]: template }));
  }, []);

  const applyBundleNoteTemplate = useCallback((bundleId: string, template: string) => {
    setBundleNotesById((current) => ({ ...current, [bundleId]: template }));
  }, []);

  const handleClaimBundle = useCallback(
    (bundle: DerivedProposalBundle) => {
      if (!currentUser || !selectedRoomId) return;
      const reviewerLabel = currentUser.displayName || currentUser.email || currentUser.uid;
      setReviewClaims((current) => {
        const next = current.filter((claim) => !(claim.roomId === selectedRoomId && claim.bundleId === bundle.id));
        next.push({
          roomId: selectedRoomId,
          bundleId: bundle.id,
          reviewerUid: currentUser.uid,
          reviewerLabel,
          claimedAt: nowIso(),
        });
        return next;
      });
      setReviewMessage(`Local review owner set to ${reviewerLabel} for ${bundle.label}.`);
    },
    [currentUser, selectedRoomId],
  );

  return (
    <div className="min-h-screen bg-[#071013] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-[#0b1418] px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
                <Shield className="h-3.5 w-3.5" />
                Review Queue
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Review is where accepted truth changes.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Open a shared packet room, inspect incoming proposal bundles, and judge them into accepted truth, deferred work, or rejected history without leaving the packet workflow.
              </p>
            </div>
            <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="uppercase tracking-[0.2em] text-slate-500">Feedback</div>
                <div className="mt-2 text-2xl font-semibold text-fuchsia-200">{pendingFeedback.length}</div>
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
              <div className="text-sm font-semibold text-white">Sign in to open the live review queue</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review becomes useful once you are inside a shared packet room with reviewer authority. Sign in, select the room, then judge waiting proposal bundles directly.
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
              title="How the queue works"
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
                    <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/8 p-4 text-sm text-slate-300">
                      <div className="font-medium text-white">Official agent path</div>
                      <p className="mt-2 leading-6">
                        Agent Brief {'->'} valid Proposal Bundle {'->'} remote submit {'->'} Waiting for Judgment {'->'} Accepted Truth.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        If packet_version_seen is stale, export a fresh Agent Brief from Projects, rebuild the bundle, and resubmit with a new client_request_id.
                      </p>
                      <div className="mt-3">
                        <a
                          href="/projects"
                          className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/15"
                        >
                          Open Agent Brief
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Review re-entry</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Highest priority</div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {highestPriorityItem
                              ? highestPriorityItem.type === 'bundle'
                                ? highestPriorityItem.bundle.label
                                : `Feedback from ${highestPriorityItem.feedback.author_name || 'reviewer'}`
                              : 'Inbox is clear'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">What changed</div>
                          <div className="mt-2 text-sm font-semibold text-white">{recentChangeSummary || 'No recent judgment yet'}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Judge next</div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {highestPriorityItem ? highestPriorityItem.priority.reason : 'No waiting work'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Changed since you last opened</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-300">
                          {changedSinceLastOpened.length > 0 ? (
                            changedSinceLastOpened.map((line) => <div key={line}>- {line}</div>)
                          ) : (
                            <div className="text-slate-500">No new judgment or incoming work since the last local review session.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </aside>

              <section className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Live review queue</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Incoming Work & Feedback</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      This is the unified stream of remote agent proposals and public feedback on published updates. Everything must be judged or processed here before it becomes accepted packet truth.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{triageModeLabel(triageMode)}</div>
                    <div className="mt-2 text-2xl font-semibold text-amber-200">
                      {filteredTriageQueue.length}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {(['all', 'agent', 'feedback', 'high', 'ready', 'followup'] as TriageMode[]).map((mode) => {
                    const active = triageMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTriageMode(mode)}
                        className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                          active
                            ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        {triageModeLabel(mode)} ({triageModeCounts[mode]})
                      </button>
                    );
                  })}
                </div>

                {focusedQueueItem ? (
                  <div className="mt-5 rounded-3xl border border-sky-500/20 bg-sky-500/8 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-3xl">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">Judge Next</div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          {focusedQueueItem.type === 'bundle'
                            ? focusedQueueItem.bundle.label
                            : deriveFeedbackTitle(focusedQueueItem.feedback)}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{judgeNextSummary}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                          <span className={`rounded-full border px-3 py-1 font-semibold uppercase tracking-[0.2em] ${getPriorityClasses(focusedQueueItem.priority.level)}`}>
                            {getPriorityLabel(focusedQueueItem.priority.level)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold uppercase tracking-[0.2em] text-slate-300">
                            {focusedQueueItem.type === 'bundle' ? 'Agent proposal bundle' : 'External feedback'}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold uppercase tracking-[0.2em] text-slate-300">
                            Shortcuts: A accept, R reject, D defer, J/K or N/P move
                          </span>
                        </div>
                      </div>
                      <div className="min-w-[240px] rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                        <div className="font-medium text-white">If judged now</div>
                        <div className="mt-2">
                          {focusedQueueItem.type === 'bundle'
                            ? focusedQueueItem.priority.consequence
                            : 'Convert the feedback into a Proposed Open Action, then judge it through the same packet authority loop.'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {focusedQueueItem.type === 'bundle' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleReviewBundle(focusedQueueItem.bundle.id, 'accepted')}
                            disabled={!currentPermissions.canReview || busyBundleId === focusedQueueItem.bundle.id}
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Accept bundle
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReviewBundle(focusedQueueItem.bundle.id, 'deferred')}
                            disabled={!currentPermissions.canReview || busyBundleId === focusedQueueItem.bundle.id}
                            className="rounded-full border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-400/60 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Defer bundle
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReviewBundle(focusedQueueItem.bundle.id, 'rejected')}
                            disabled={!currentPermissions.canReview || busyBundleId === focusedQueueItem.bundle.id}
                            className="rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject bundle
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleConvertFeedbackToOpenAction(focusedQueueItem.feedback)}
                            disabled={!currentPermissions.canReview || busyFeedbackId === focusedQueueItem.feedback.id}
                            className="rounded-full border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Convert to Proposed Open Action
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleFeedbackStatus(focusedQueueItem.feedback.id, 'processed')}
                            disabled={!currentPermissions.canEditContent || busyFeedbackId === focusedQueueItem.feedback.id}
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Mark processed
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                {!selectedRoom ? (
                  <div className="mt-6">
                    <EmptyCard
                      title="Select Shared Packet Room"
                      body="Pick a shared packet room to load its live triage queue. Review only becomes actionable once a room is selected."
                    />
                  </div>
                ) : filteredTriageQueue.length === 0 ? (
                  <div className="mt-6">
                    <EmptyCard
                      title={liveTriageQueue.length === 0 ? 'No incoming work' : `No items in ${triageModeLabel(triageMode)}`}
                      body={
                        liveTriageQueue.length === 0
                          ? 'The triage inbox is clear. Agent Brief -> validated Proposal Bundle -> remote submit or local intake -> Waiting for Judgment. Published update feedback lands here too.'
                          : 'Try another triage mode or return to All incoming work to see the full queue.'
                      }
                      ctaLabel="Open Projects"
                      ctaHref="/projects"
                    />
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {filteredTriageQueue.map((item) => {
                      if (item.type === 'bundle') {
                        const bundle = item.bundle;
                        const bundleBusy = busyBundleId === bundle.id;
                        const ownerClaim = bundleClaimsById.get(bundle.id);
                        const ownerLabel = ownerClaim?.reviewerLabel || null;
                        const claimedByCurrentUser = ownerClaim?.reviewerUid === currentUser?.uid;
                        return (
                          <details
                            key={item.id}
                            open={focusedQueueItem?.id === item.id}
                            className={`rounded-3xl border p-5 ${focusedQueueItem?.id === item.id ? 'border-sky-500/25 bg-sky-500/6' : 'border-amber-900/30 bg-amber-950/10'}`}
                          >
                            <summary className="cursor-pointer list-none">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-amber-800/50 bg-amber-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                                      {bundle.waitingCount} proposal{bundle.waitingCount !== 1 ? 's' : ''}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                                      {bundle.source}
                                    </span>
                                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getPriorityClasses(item.priority.level)}`}>
                                      {getPriorityLabel(item.priority.level)}
                                    </span>
                                    {item.priority.readyToAccept ? (
                                      <span className="rounded-full border border-emerald-900/40 bg-emerald-950/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                        Ready to Accept
                                      </span>
                                    ) : null}
                                    {item.priority.needsFollowUp ? (
                                      <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                                        Needs Follow-up
                                      </span>
                                    ) : null}
                                    {bundle.fullyClosed ? (
                                      <span className="rounded-full border border-emerald-900/40 bg-emerald-950/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                        Closed
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 text-lg font-semibold text-white">{bundle.label}</div>
                                  <p className="mt-2 text-sm leading-6 text-slate-300">
                                    {bundle.summary || 'No bundle summary was supplied.'}
                                  </p>
                                  <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-200">
                                    <div className="font-medium text-white">Triage consequence</div>
                                    <div className="mt-2">{item.priority.consequence}</div>
                                    <div className="mt-2 text-xs text-slate-400">{item.priority.reason}</div>
                                    <div className="mt-2 text-xs text-slate-500">
                                      {item.priority.touchesPublishedUpdate
                                        ? 'Touches the next published update if accepted.'
                                        : 'Changes room execution state without directly touching the published update.'}
                                    </div>
                                    <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3">
                                      <div>Closure: {summarizeBundleClosure(bundle)}</div>
                                      <div>Changed truth: {summarizeBundlePacketChanges(bundle)}</div>
                                      <div>Follow-up: {summarizeBundleFollowUp(bundle)}</div>
                                    </div>
                                  </div>
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
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                    <div className="uppercase tracking-[0.18em] text-slate-500">Review owner</div>
                                    <div className="mt-1 text-slate-100">{ownerLabel || 'Needs owner'}</div>
                                    <div className="mt-1 text-[11px] text-slate-500">
                                      {ownerLabel ? 'Local claim for this signed-in reviewer.' : 'Claim locally to make the next pass clearer.'}
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                    <div className="uppercase tracking-[0.18em] text-slate-500">Version result</div>
                                    <div className="mt-1 text-slate-100">
                                      {bundle.waitingCount > 0 ? `Accept bumps packet to v${(selectedRoom.project.packet_version || 1) + 1}` : 'No waiting changes left'}
                                    </div>
                                  </div>
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
                                          <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                                            <div>Packet impact: {getProposalImpactLabel(proposal.proposal_type)}</div>
                                            <div>
                                              Outcome if accepted:{' '}
                                              {proposal.promoted_target?.label || proposal.target_title || getProposalTypeLabel(proposal.proposal_type)}
                                            </div>
                                          </div>
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
                                            {REVIEW_NOTE_TEMPLATES.map((template) => (
                                              <button
                                                key={template}
                                                type="button"
                                                onClick={() => applyNoteTemplate(proposal.id, template)}
                                                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05]"
                                              >
                                                {template}
                                              </button>
                                            ))}
                                          </div>
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                              disabled={!currentPermissions.canReview || proposalBusy}
                                              onClick={() => void handleReviewProposal(proposal.id, 'accepted')}
                                              className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Accept
                                            </button>
                                            <button
                                              disabled={!currentPermissions.canReview || proposalBusy}
                                              onClick={() => void handleReviewProposal(proposal.id, 'deferred')}
                                              className="rounded-full border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-400/60 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Defer
                                            </button>
                                            <button
                                              disabled={!currentPermissions.canReview || proposalBusy}
                                              onClick={() => void handleReviewProposal(proposal.id, 'rejected')}
                                              className="rounded-full border border-rose-500/30 bg-rose-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
                                          <div className="font-medium text-white">
                                            {getReviewStateLabel(proposal.review_state)}
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
                                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                                  <div className="font-medium text-white">Ownership</div>
                                  <div className="mt-2">
                                    {ownerLabel ? `Current local owner: ${ownerLabel}.` : 'No local owner has claimed this bundle yet.'}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleClaimBundle(bundle)}
                                      disabled={!currentPermissions.canReview || !currentUser}
                                      className="rounded-full border border-sky-500/30 bg-sky-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {claimedByCurrentUser ? 'Claimed by you' : 'Claim review'}
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={bundleNotesById[bundle.id] || ''}
                                  onChange={(event) =>
                                    setBundleNotesById((current) => ({ ...current, [bundle.id]: event.target.value }))
                                  }
                                  placeholder="Why accept, reject, or defer this bundle?"
                                  className="mt-4 min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/50"
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {REVIEW_NOTE_TEMPLATES.map((template) => (
                                    <button
                                      key={template}
                                      type="button"
                                      onClick={() => applyBundleNoteTemplate(bundle.id, template)}
                                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05]"
                                    >
                                      {template}
                                    </button>
                                  ))}
                                </div>
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
                      } else {
                        const feedback = item.feedback;
                        const feedbackBusy = busyFeedbackId === feedback.id;
                        return (
                          <article key={item.id} className={`rounded-3xl border p-5 ${focusedQueueItem?.id === item.id ? 'border-sky-500/25 bg-sky-500/6' : 'border-fuchsia-900/30 bg-fuchsia-950/10'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-fuchsia-800/40 bg-fuchsia-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
                                    Published Update Feedback
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                                    {feedback.author_name || 'Anonymous reviewer'}
                                  </span>
                                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${getPriorityClasses(item.priority.level)}`}>
                                    {getPriorityLabel(item.priority.level)}
                                  </span>
                                  {item.priority.readyToAccept ? (
                                    <span className="rounded-full border border-emerald-900/40 bg-emerald-950/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                      Ready to Accept
                                    </span>
                                  ) : null}
                                  {item.priority.needsFollowUp ? (
                                    <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                                      Needs Follow-up
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-3 text-xs text-slate-400">{formatDateTime(feedback.created_at)}</div>
                              </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-200">{feedback.content}</p>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-200">
                              <div className="font-medium text-white">Triage consequence</div>
                              <div className="mt-2">{item.priority.consequence}</div>
                              <div className="mt-2 text-xs text-slate-400">{item.priority.reason}</div>
                              <div className="mt-2 text-xs text-slate-500">Touches the published update loop and can become a Proposed Open Action with source linkage back to this feedback.</div>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <button
                                disabled={!currentPermissions.canReview || feedbackBusy}
                                onClick={() => void handleConvertFeedbackToOpenAction(feedback)}
                                className="rounded-full border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                title={!currentPermissions.canReview ? 'Requires Reviewer role' : undefined}
                              >
                                Convert to Open Action Proposal
                              </button>
                              <button
                                disabled={!currentPermissions.canEditContent || feedbackBusy}
                                onClick={() => void handleFeedbackStatus(feedback.id, 'processed')}
                                className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                title={!currentPermissions.canEditContent ? 'Requires Editor role' : undefined}
                              >
                                Mark processed
                              </button>
                              <button
                                disabled={!currentPermissions.canEditContent || feedbackBusy}
                                onClick={() => void handleFeedbackStatus(feedback.id, 'dismissed')}
                                className="rounded-full border border-slate-500/30 bg-slate-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-slate-400/60 hover:bg-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                                title={!currentPermissions.canEditContent ? 'Requires Editor role' : undefined}
                              >
                                Dismiss
                              </button>
                            </div>
                          </article>
                        );
                      }
                    })}
                  </div>
                )}
              </section>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#0b1418] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Recently closed feedback</div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Processed & Dismissed Feedback</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Once feedback is converted to a proposal or dismissed, it moves here so the room has a visible closure trail.
                  </p>
                </div>
              </div>

              {resolvedFeedback.length === 0 ? (
                <div className="mt-6">
                  <EmptyCard
                    title="No resolved feedback yet"
                    body="When external feedback is processed from the triage inbox, it will appear here."
                  />
                </div>
              ) : (
                <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {resolvedFeedback.map((feedback) => (
                    <article key={feedback.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                            feedback.status === 'processed'
                              ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-200'
                              : 'border-slate-800 bg-slate-950/40 text-slate-300'
                          }`}
                        >
                          {feedback.status === 'processed' ? 'Processed' : 'Dismissed'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                          {feedback.author_name || 'Anonymous reviewer'}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">{formatDateTime(feedback.created_at)}</div>
                      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{feedback.content}</p>
                      {feedback.converted_to_type ? (
                        <div className="mt-3 text-xs text-slate-400">
                          Converted to {feedback.converted_to_type}
                          {feedback.converted_to_id ? ` (${feedback.converted_to_id})` : ''}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
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
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                        <div className="font-medium text-white">Traceable acceptance</div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="uppercase tracking-[0.18em] text-slate-500">Before</div>
                            <div className="mt-1">{proposal.payload_summary || 'No proposal payload summary recorded.'}</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-[0.18em] text-slate-500">After</div>
                            <div className="mt-1">
                              {proposal.promoted_target?.label || proposal.target_title || 'No packet object was created.'}
                            </div>
                          </div>
                        </div>
                      </div>
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
                        <div className="flex items-start justify-between gap-3">
                          <dt>Bundle</dt>
                          <dd className="text-right text-slate-200">
                            {proposal.proposal_bundle_label || proposal.proposal_bundle_id || 'Single proposal'}
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <dt>Packet version</dt>
                          <dd className="text-right text-slate-200">
                            {proposal.review_state === 'accepted' && proposal.packet_version_seen
                              ? `v${proposal.packet_version_seen} -> v${proposal.packet_version_seen + 1}`
                              : proposal.packet_version_seen
                                ? `Seen at v${proposal.packet_version_seen}`
                                : 'Not recorded'}
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
