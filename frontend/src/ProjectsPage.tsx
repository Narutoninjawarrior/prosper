import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  createProjectRoomAccount,
  listenToProjectAuth,
  signInProjectRoom,
  signInProjectRoomWithGoogle,
  signOutProjectRoom,
  type ProjectAuthState,
} from './projects/auth';
import {
  addProjectRoomComment,
  acceptProjectRoomInvite,
  createProjectRoomInvite,
  fetchProjectInviteByToken,
  importLocalProjectRoom,
  listenToHostedProjectRooms,
  listenToProjectRoomEvents,
  listenToProjectRoomComments,
  listProjectRoomInvites,
  permissionsForRole,
  publishProjectHandoff,
  revokeProjectRoomInvite,
  revokePublishedHandoff,
  syncProjectRoom,
  type CloudProjectRoom,
  type ProjectInvitePreview,
  type ProjectRoomComment,
  type ProjectRoomEvent,
  type ProjectRoomInvite,
  type ProjectRoomRole,
} from './projects/cloud';

export type MessageTag = 'useful' | 'question' | 'warning' | 'none';
export type ProjectActivityKind = 
  | 'project_created' 
  | 'handoff' 
  | 'artifact_added' 
  | 'status'
  | 'status_update'
  | 'review_note'
  | 'artifact_update'
  | 'decision'
  | 'question'
  | 'warning'
  | 'artifact_flagged'
  | 'artifact_blocked'
  | 'artifact_review_note_updated'
  | 'decision_proposed'
  | 'decision_accepted'
  | 'decision_deferred'
  | 'commitment_proposed'
  | 'commitment_activated'
  | 'commitment_blocked'
  | 'commitment_completed';
export type ArtifactReviewState = 'unreviewed' | 'in_review' | 'reviewed';
export type ArtifactReviewSignal = 'clear' | 'needs_attention' | 'blocked';
export type StructuredUpdateType = 'status_update' | 'review_note' | 'artifact_update' | 'decision' | 'question' | 'warning';
export type DecisionState = 'proposed' | 'accepted' | 'deferred';
export type CommitmentState = 'proposed' | 'active' | 'blocked' | 'completed';
export type ProjectCaptureType = 'text_note' | 'link' | 'file_reference' | 'raw_snippet';
export type ProjectCaptureState = 'inbox' | 'promoted' | 'dismissed';

export interface PeerReflection {
  agent: string;
  content: string;
  timestamp: string;
}

export interface BellowsStateSnapshot {
  network_health?: string;
  active_agents?: string[];
  current_pulse?: string;
  system_status?: string;
  last_update?: string;
  reflections?: PeerReflection[];
  embodiment_goal?: {
    target?: string;
    symbolic_cost_ember?: number;
    status?: string;
  };
  wallet_balance?: number;
  total_mined?: number;
  total_ticks?: number;
  latest_receipt_note?: string;
}

export interface ProjectMessage {
  id: string;
  content: string;
  tag: MessageTag;
  timestamp: string;
}

export interface ProjectArtifact {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  summary?: string;
  source_lane?: string;
  review_state?: ArtifactReviewState;
  review_signal?: ArtifactReviewSignal;
  review_note?: string;
  signed_by?: string;
  signature?: string;
}

export interface ProjectDecision {
  id: string;
  timestamp: string;
  title: string;
  rationale: string;
  decision_state: DecisionState;
  artifact_id?: string;
  impact_note?: string;
  signed_by?: string;
  signature?: string;
}

export interface ProjectCommitment {
  id: string;
  title: string;
  timestamp: string;
  commitment_state: CommitmentState;
  rationale: string;
  next_action: string;
  blocker_note?: string;
  done_when: string;
  artifact_id?: string;
  decision_id?: string;
  confidence?: 'high' | 'medium' | 'low';
  work_package?: string;
  constraints?: string;
  signed_by?: string;
  signature?: string;
}

export interface ProjectCaptureItem {
  id: string;
  capture_type: ProjectCaptureType;
  title: string;
  content: string;
  created_at: string;
  note?: string;
  capture_state: ProjectCaptureState;
}

export interface ProjectActivity {
  id: string;
  kind: ProjectActivityKind;
  title: string;
  detail?: string;
  timestamp: string;
}

export interface ProjectReviewPacketSnapshot {
  next_step: string | null;
  readiness_ready: boolean;
  readiness_blockers: string[];
  approved_evidence_ids: string[];
  flagged_evidence_ids: string[];
  pending_evidence_ids: string[];
  accepted_decision_ids: string[];
  deferred_decision_ids: string[];
  active_commitment_ids: string[];
  completed_commitment_ids: string[];
  blocked_commitment_ids: string[];
  today_entry_ids: string[];
  summary_line: string;
}

export interface ProjectReviewPacket {
  id: string;
  timestamp: string;
  title: string;
  markdown: string;
  snapshot: ProjectReviewPacketSnapshot;
  why_it_changed?: string;
  signer_handle?: string;
  signer_signature?: string;
}

export interface ProjectContext {
  asset_id?: string;
  preset_template?: string;
  morphology_class?: string;
  actuator_joint_count?: number;
  footprint?: string;
  maximum_reach_m?: number;
  validation_status?: string;
}

export type ProjectContextType = 'constraint' | 'decision' | 'assumption' | 'requirement' | 'warning' | 'working_note';
export type ProjectContextState = 'proposed' | 'accepted' | 'rejected' | 'superseded';

export interface ProjectContextItem {
  id: string;
  project_id: string;
  title: string;
  body: string;
  context_type: ProjectContextType;
  context_state: ProjectContextState;
  created_at: string;
  updated_at: string;
  actor_type: 'user' | 'agent' | 'system' | string;
  actor_name?: string;
  source_type: 'evidence' | 'decision' | 'commitment' | 'capture' | 'feedback' | 'working_change' | string;
  source_id?: string;
  evidence_ids?: string[];
  supersedes_id?: string;
  review_note?: string;
  reviewed_at?: string;
  signed_by?: string;
  signature?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  updated_at: string;
  pinned_note: string;
  messages: ProjectMessage[];
  artifacts?: ProjectArtifact[];
  activity?: ProjectActivity[];
  decisions?: ProjectDecision[];
  commitments?: ProjectCommitment[];
  capture_items?: ProjectCaptureItem[];
  review_packets?: ProjectReviewPacket[];
  context?: ProjectContext;
  context_items?: ProjectContextItem[];
  next_step?: string;
}

interface DerivedAgentSummary {
  currentState: string[];
  openAttention: string[];
  suggestedReviewFocus: string[];
}

interface DerivedProjectRelevance {
  topSignal: string;
  unresolvedSignal: string;
  latestArtifact: string;
  returnFocus: string;
}

interface DerivedProjectMemory {
  rememberedContext: string;
  currentDirection: string;
  openQuestion: string;
  criticalReviewSignal: string;
  recentDecision: string;
}

interface DerivedRuntimeCommitmentAdvisory {
  label: string;
  message: string;
  detail: string;
  classes: string;
}

interface DerivedProjectBrief {
  currentBrief: string[];
  carryForward: string[];
  reviewPressure: string[];
  artifactReadiness: string[];
}

type ProjectViewMode = 'desk' | 'overview' | 'frames' | 'room' | 'review' | 'handoff' | 'context';

interface ProjectRoomObject {
  id: string;
  kind: 'brief' | 'memory' | 'runtime' | 'artifact' | 'decision' | 'commitment' | 'reflection';
  title: string;
  summary: string;
  status: string;
  accent: string;
  detail: string[];
  timestamp?: string;
  linkedArtifactId?: string;
}

interface ProjectReviewItem {
  id: string;
  title: string;
  status: string;
  summary: string;
  stage: 'needs_call' | 'ready_to_convert' | 'ready_to_carry' | 'operational_cue';
  priority: 'high' | 'medium' | 'steady';
  action: string;
  actionType?: 'seed_decision' | 'open_artifact' | 'none';
  linkedArtifactId?: string;
  linkedDecisionId?: string;
}

interface ProjectContinuityLink {
  id: string;
  label: string;
  reason: string;
  targetRoomObjectId?: string;
  targetArtifactId?: string;
}

interface ProjectRoomFrame {
  id: 'evidence' | 'decisions' | 'commitments' | 'runtime_risk' | 'next_moves';
  title: string;
  summary: string;
  status: string;
  accent: string;
  objectIds: string[];
  signals: string[];
  operatorCue: string;
}

interface ProjectDailyWorkItem {
  id: string;
  projectId: string;
  projectTitle: string;
  category: string;
  reason: string;
  detail: string;
  actionLabel: string;
  targetView: ProjectViewMode;
  priority: number;
  updatedAt: string;
  accentClasses: string;
  artifactId?: string;
}

interface StewardshipJournalEntry {
  id: string;
  label: string;
  title: string;
  detail: string;
  timestamp: string;
  toneClasses: string;
}

interface DerivedStewardshipJournal {
  todaySummary: string[];
  todayEntries: StewardshipJournalEntry[];
  recentEntries: StewardshipJournalEntry[];
  carryForward: string[];
  lastMeaningfulMovement: string;
}

interface DerivedReviewDelta {
  status: 'first_packet' | 'steady' | 'changed';
  summary: string;
  readinessImpact: string;
  changeLines: string[];
  checkpointLabel: string;
  carryForwardCue: string;
}

interface DeskNextAction {
  title: string;
  explanation: string;
  actionLabel: string;
  secondaryActionLabel?: string;
  targetView: ProjectViewMode;
  targetElementId?: string;
  artifactId?: string;
  actionKind:
    | 'save_checkpoint'
    | 'open_handoff'
    | 'review_evidence'
    | 'resolve_decision'
    | 'define_next_step'
    | 'resume_commitment'
    | 'open_inbox'
    | 'start_project';
}

type ProjectTemplateKey = 'indie_build' | 'client_deliverable' | 'research_sprint';

interface ProjectTemplateDefinition {
  key: ProjectTemplateKey;
  label: string;
  description: string;
  category: string;
  evidenceTitle: string;
  evidenceSummary: string;
  decisionTitle: string;
  decisionRationale: string;
  commitmentTitle: string;
  commitmentRationale: string;
  commitmentNextAction: string;
  commitmentDoneWhen: string;
  nextStep: string;
}

function formatHeartbeatFreshness(lastUpdate?: string) {
  if (!lastUpdate) return 'No recent Bellows state available.';
  const parsed = new Date(lastUpdate);
  if (Number.isNaN(parsed.getTime())) return 'No recent Bellows state available.';
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 0) return `Heartbeat timestamp: ${formatTimestamp(lastUpdate)}`;
  if (diffMinutes < 5) return `Updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago.`;
  if (diffMinutes < 60) return `Stale by ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}.`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Stale by ${diffHours} hour${diffHours === 1 ? '' : 's'}.`;
  const diffDays = Math.floor(diffHours / 24);
  return `Stale by ${diffDays} day${diffDays === 1 ? '' : 's'}.`;
}

function getRuntimeCondition(data: BellowsStateSnapshot | null) {
  if (!data) {
    return {
      label: 'Unavailable',
      detail: 'Bellows details are unavailable right now.',
      classes: 'border-slate-800 bg-slate-950/40 text-slate-400'
    };
  }

  const freshness = formatHeartbeatFreshness(data.last_update);
  const stale = freshness.startsWith('Stale');
  const systemStatus = (data.system_status || '').toLowerCase();
  const pulse = (data.current_pulse || '').toLowerCase();

  if (stale) {
    return {
      label: 'Stale',
      detail: freshness,
      classes: 'border-amber-900/40 bg-amber-950/10 text-amber-300'
    };
  }

  if (systemStatus.includes('hardened') || pulse.includes('active')) {
    return {
      label: 'Calm',
      detail: freshness,
      classes: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-300'
    };
  }

  return {
    label: 'Degraded',
    detail: freshness,
      classes: 'border-red-900/40 bg-red-950/10 text-red-300'
  };
}

function deriveRuntimeCommitmentAdvisory(
  project: Project | null,
  runtime: ReturnType<typeof getRuntimeCondition>
): DerivedRuntimeCommitmentAdvisory | null {
  if (!project) return null;

  const degradedRuntime =
    runtime.label === 'Stale' || runtime.label === 'Degraded' || runtime.label === 'Unavailable';

  if (!degradedRuntime) return null;

  const commitments = project.commitments || [];
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const lowConfidenceCommitments = commitments.filter(
    (commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low'
  );

  if (activeCommitments.length === 0 && lowConfidenceCommitments.length === 0) {
    return null;
  }

  const impactedCommitments = lowConfidenceCommitments.length > 0 ? lowConfidenceCommitments : activeCommitments;
  const impactedTitles = impactedCommitments.slice(0, 2).map((commitment) => commitment.title);
  const overflowCount = impactedCommitments.length - impactedTitles.length;
  const impactedSummary =
    impactedTitles.length > 0
      ? `${impactedTitles.join(', ')}${overflowCount > 0 ? ` +${overflowCount} more` : ''}`
      : 'Current active commitments';

  if (runtime.label === 'Unavailable') {
    return {
      label: 'Operational Advisory',
      message:
        lowConfidenceCommitments.length > 0
          ? 'Bellows details are unavailable. Low-confidence commitments should be reviewed against current Bellows state.'
          : 'Bellows details are unavailable. Active commitments may need manual verification.',
      detail: `Commitment impact: ${impactedSummary}.`,
      classes: 'border-slate-800 bg-slate-950/30 text-slate-300'
    };
  }

  if (runtime.label === 'Stale') {
    return {
      label: 'Runtime Risk',
      message:
        lowConfidenceCommitments.length > 0
          ? 'Bellows state is stale; low-confidence commitments should be reviewed against current Bellows state.'
          : 'Bellows state is stale; active commitments may need manual verification.',
      detail: `Commitment impact: ${impactedSummary}.`,
      classes: 'border-amber-900/40 bg-amber-950/10 text-amber-200'
    };
  }

  return {
    label: 'Commitment Impact',
    message:
      lowConfidenceCommitments.length > 0
        ? 'Runtime risk may affect low-confidence commitments. Review constraints against current Bellows state.'
        : 'Runtime risk may affect active commitments. Review current commitments against Bellows state.',
    detail: `Commitment impact: ${impactedSummary}.`,
    classes: 'border-red-900/40 bg-red-950/10 text-red-200'
  };
}

function getDaysSinceTimestamp(timestamp?: string) {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((Date.now() - parsed.getTime()) / 86400000);
}

function deriveProjectDailyWorkItem(project: Project): ProjectDailyWorkItem | null {
  const captureInbox = (project.capture_items || []).filter((item) => item.capture_state === 'inbox');
  const evidence = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const flaggedEvidence = evidence.filter((artifact) => isArtifactFlagged(artifact));
  const pendingEvidence = evidence.filter(
    (artifact) => !isArtifactApproved(artifact) && !isArtifactFlagged(artifact)
  );
  const blockedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'blocked');
  const lowConfidenceActiveCommitments = commitments.filter(
    (commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low'
  );
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const unresolvedDecisions = decisions.filter(
    (decision) => decision.decision_state === 'proposed' || decision.decision_state === 'deferred'
  );
  const staleDays = getDaysSinceTimestamp(project.updated_at);
  const hasAnyProjectObjects =
    captureInbox.length > 0 ||
    evidence.length > 0 ||
    decisions.length > 0 ||
    commitments.length > 0 ||
    Boolean(project.next_step?.trim());

  if (blockedCommitments.length > 0) {
    return {
      id: `daily_${project.id}_blocked`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Blocked commitment',
      detail: `${blockedCommitments[0].title}${blockedCommitments.length > 1 ? ` +${blockedCommitments.length - 1} more` : ''} is stalled and needs a next move.`,
      actionLabel: 'Unblock commitment',
      targetView: 'overview',
      priority: 0,
      updatedAt: project.updated_at,
      accentClasses: 'border-red-900/40 bg-red-950/15 text-red-200'
    };
  }

  if (flaggedEvidence.length > 0) {
    return {
      id: `daily_${project.id}_flagged`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Evidence needs review',
      detail: `${flaggedEvidence[0].title}${flaggedEvidence.length > 1 ? ` +${flaggedEvidence.length - 1} more` : ''} is flagged before it can support downstream work.`,
      actionLabel: 'Review evidence',
      targetView: 'overview',
      priority: 1,
      updatedAt: project.updated_at,
      accentClasses: 'border-amber-900/40 bg-amber-950/15 text-amber-200',
      artifactId: flaggedEvidence[0].id
    };
  }

  if (captureInbox.length > 0) {
    return {
      id: `daily_${project.id}_inbox`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Inbox waiting',
      detail: `${captureInbox.length} captured item${captureInbox.length === 1 ? '' : 's'} still need to be sorted into evidence, decisions, or commitments.`,
      actionLabel: 'Process inbox',
      targetView: 'overview',
      priority: 2,
      updatedAt: project.updated_at,
      accentClasses: 'border-sky-900/40 bg-sky-950/15 text-sky-200'
    };
  }

  if (pendingEvidence.length > 0) {
    return {
      id: `daily_${project.id}_pending_evidence`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Evidence still open',
      detail: `${pendingEvidence[0].title}${pendingEvidence.length > 1 ? ` +${pendingEvidence.length - 1} more` : ''} still needs a review outcome before handoff.`,
      actionLabel: 'Finish evidence review',
      targetView: 'overview',
      priority: 3,
      updatedAt: project.updated_at,
      accentClasses: 'border-cyan-900/40 bg-cyan-950/15 text-cyan-200',
      artifactId: pendingEvidence[0].id
    };
  }

  if (unresolvedDecisions.length > 0) {
    return {
      id: `daily_${project.id}_decision`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Decision still open',
      detail: `${unresolvedDecisions[0].title}${unresolvedDecisions.length > 1 ? ` +${unresolvedDecisions.length - 1} more` : ''} still needs a clear outcome.`,
      actionLabel: 'Resolve decision',
      targetView: 'overview',
      priority: 4,
      updatedAt: project.updated_at,
      accentClasses: 'border-indigo-900/40 bg-indigo-950/15 text-indigo-200'
    };
  }

  if (lowConfidenceActiveCommitments.length > 0) {
    return {
      id: `daily_${project.id}_risk`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Low-confidence commitment',
      detail: `${lowConfidenceActiveCommitments[0].title}${lowConfidenceActiveCommitments.length > 1 ? ` +${lowConfidenceActiveCommitments.length - 1} more` : ''} is moving forward without enough confidence yet.`,
      actionLabel: 'Review commitment',
      targetView: 'overview',
      priority: 5,
      updatedAt: project.updated_at,
      accentClasses: 'border-amber-900/40 bg-amber-950/10 text-amber-200'
    };
  }

  if (activeCommitments.length > 0 && !project.next_step?.trim()) {
    return {
      id: `daily_${project.id}_next_step`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Next step missing',
      detail: `${activeCommitments.length} active commitment${activeCommitments.length === 1 ? '' : 's'} exist, but the project does not yet say what moves next.`,
      actionLabel: 'Set next step',
      targetView: 'overview',
      priority: 6,
      updatedAt: project.updated_at,
      accentClasses: 'border-emerald-900/40 bg-emerald-950/15 text-emerald-200'
    };
  }

  if (activeCommitments.length > 0) {
    return {
      id: `daily_${project.id}_active`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Active work in motion',
      detail: `${activeCommitments[0].title}${activeCommitments.length > 1 ? ` +${activeCommitments.length - 1} more` : ''} is active and ready to resume.`,
      actionLabel: 'Resume project',
      targetView: 'overview',
      priority: 7,
      updatedAt: project.updated_at,
      accentClasses: 'border-slate-700 bg-slate-950/40 text-slate-200'
    };
  }

  if (staleDays !== null && staleDays >= 7 && hasAnyProjectObjects) {
    return {
      id: `daily_${project.id}_stale`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Needs re-entry',
      detail: `This project has been quiet for ${staleDays} day${staleDays === 1 ? '' : 's'}. Reconfirm the next step before it drifts.`,
      actionLabel: 'Re-enter project',
      targetView: 'overview',
      priority: 8,
      updatedAt: project.updated_at,
      accentClasses: 'border-slate-800 bg-slate-950/30 text-slate-300'
    };
  }

  if (!hasAnyProjectObjects) {
    return {
      id: `daily_${project.id}_start`,
      projectId: project.id,
      projectTitle: project.title,
      category: project.category,
      reason: 'Project still empty',
      detail: 'Start by dropping raw inputs into the inbox so the project can begin to accumulate evidence.',
      actionLabel: 'Start project',
      targetView: 'overview',
      priority: 9,
      updatedAt: project.updated_at,
      accentClasses: 'border-slate-800 bg-slate-950/30 text-slate-300'
    };
  }

  return null;
}

function deriveStewardshipEntry(activity: ProjectActivity): StewardshipJournalEntry | null {
  const lowerTitle = activity.title.toLowerCase();

  if (lowerTitle.includes('inbox item promoted')) {
    return {
      id: activity.id,
      label: 'Capture Promoted',
      title: activity.title,
      detail: activity.detail || 'Captured input moved forward into the project record.',
      timestamp: activity.timestamp,
      toneClasses: 'border-sky-900/30 bg-sky-950/10 text-sky-200'
    };
  }

  if (
    lowerTitle.includes('artifact marked reviewed') ||
    lowerTitle.includes('artifact review started') ||
    activity.kind === 'artifact_flagged' ||
    activity.kind === 'artifact_blocked' ||
    activity.kind === 'artifact_review_note_updated'
  ) {
    return {
      id: activity.id,
      label: 'Evidence Review',
      title: activity.title,
      detail: activity.detail || 'Evidence review changed today.',
      timestamp: activity.timestamp,
      toneClasses: 'border-amber-900/30 bg-amber-950/10 text-amber-200'
    };
  }

  if (
    activity.kind === 'decision' ||
    activity.kind === 'decision_proposed' ||
    activity.kind === 'decision_accepted' ||
    activity.kind === 'decision_deferred'
  ) {
    return {
      id: activity.id,
      label: 'Decision',
      title: activity.title,
      detail: activity.detail || 'Decision state changed.',
      timestamp: activity.timestamp,
      toneClasses: 'border-indigo-900/30 bg-indigo-950/10 text-indigo-200'
    };
  }

  if (
    activity.kind === 'commitment_proposed' ||
    activity.kind === 'commitment_activated' ||
    activity.kind === 'commitment_blocked' ||
    activity.kind === 'commitment_completed'
  ) {
    return {
      id: activity.id,
      label: 'Commitment',
      title: activity.title,
      detail: activity.detail || 'Commitment state changed.',
      timestamp: activity.timestamp,
      toneClasses: 'border-emerald-900/30 bg-emerald-950/10 text-emerald-200'
    };
  }

  if (lowerTitle.includes('next step updated')) {
    return {
      id: activity.id,
      label: 'Direction',
      title: activity.title,
      detail: activity.detail || 'Project direction was updated.',
      timestamp: activity.timestamp,
      toneClasses: 'border-cyan-900/30 bg-cyan-950/10 text-cyan-200'
    };
  }

  if (activity.kind === 'artifact_added' || lowerTitle.includes('artifact added')) {
    return {
      id: activity.id,
      label: 'Evidence Added',
      title: activity.title,
      detail: activity.detail || 'A new evidence item entered the project record.',
      timestamp: activity.timestamp,
      toneClasses: 'border-slate-800 bg-slate-950/50 text-slate-200'
    };
  }

  if (activity.kind === 'status_update' || activity.kind === 'status') {
    return {
      id: activity.id,
      label: 'Project Update',
      title: activity.title,
      detail: activity.detail || 'Project activity moved forward.',
      timestamp: activity.timestamp,
      toneClasses: 'border-slate-800 bg-slate-950/40 text-slate-300'
    };
  }

  return null;
}

function isSameLocalDay(timestamp: string, referenceTime: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date(referenceTime).toDateString();
}

function deriveStewardshipJournal(
  project: Project | null,
  dailyWorkItem: ProjectDailyWorkItem | null,
  projectMemory: DerivedProjectMemory
): DerivedStewardshipJournal {
  if (!project) {
    return {
      todaySummary: [],
      todayEntries: [],
      recentEntries: [],
      carryForward: [],
      lastMeaningfulMovement: 'No project movement recorded yet.'
    };
  }

  const meaningfulEntries = (project.activity || [])
    .map(deriveStewardshipEntry)
    .filter((entry): entry is StewardshipJournalEntry => Boolean(entry))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const now = Date.now();
  const todayEntries = meaningfulEntries.filter((entry) => isSameLocalDay(entry.timestamp, now));
  const recentEntries = meaningfulEntries.slice(0, 6);

  const promotedToday = todayEntries.filter((entry) => entry.label === 'Capture Promoted').length;
  const evidenceReviewedToday = todayEntries.filter((entry) => entry.label === 'Evidence Review').length;
  const decisionsMovedToday = todayEntries.filter((entry) => entry.label === 'Decision').length;
  const commitmentsMovedToday = todayEntries.filter((entry) => entry.label === 'Commitment').length;

  const todaySummary = [
    promotedToday > 0 ? `${promotedToday} capture${promotedToday === 1 ? '' : 's'} promoted` : '',
    evidenceReviewedToday > 0 ? `${evidenceReviewedToday} evidence review update${evidenceReviewedToday === 1 ? '' : 's'}` : '',
    decisionsMovedToday > 0 ? `${decisionsMovedToday} decision change${decisionsMovedToday === 1 ? '' : 's'}` : '',
    commitmentsMovedToday > 0 ? `${commitmentsMovedToday} commitment change${commitmentsMovedToday === 1 ? '' : 's'}` : ''
  ].filter(Boolean);

  const carryForward: string[] = [];
  if (dailyWorkItem) {
    carryForward.push(`${dailyWorkItem.reason}: ${dailyWorkItem.detail}`);
  }
  if (project.next_step?.trim()) {
    carryForward.push(`Next step: ${project.next_step.trim()}`);
  }
  if (projectMemory.openQuestion && projectMemory.openQuestion !== 'No unresolved question is currently elevated.') {
    carryForward.push(projectMemory.openQuestion);
  }
  if (carryForward.length === 0) {
    carryForward.push('No urgent carry-forward cue is active. Capture new evidence or refresh the handoff when work resumes.');
  }

  return {
    todaySummary,
    todayEntries,
    recentEntries,
    carryForward,
    lastMeaningfulMovement: recentEntries[0]
      ? `${recentEntries[0].title} (${formatTimestamp(recentEntries[0].timestamp)})`
      : 'No meaningful project movement recorded yet.'
  };
}

function diffNewIds(previousIds: string[], currentIds: string[]) {
  const previous = new Set(previousIds);
  return currentIds.filter((id) => !previous.has(id));
}

function labelsForIds<T extends { id: string; title: string }>(items: T[], ids: string[]) {
  const byId = new Map(items.map((item) => [item.id, item.title]));
  return ids.map((id) => byId.get(id)).filter((value): value is string => Boolean(value));
}

function formatDeltaLine(prefix: string, labels: string[]) {
  if (labels.length === 0) return '';
  const visible = labels.slice(0, 2);
  const overflow = labels.length - visible.length;
  return `${prefix}: ${visible.join(', ')}${overflow > 0 ? ` +${overflow} more` : ''}`;
}

function deriveReviewPacketDelta(
  project: Project | null,
  latestPacket: ProjectReviewPacket | null,
  handoffReadiness: { ready: boolean; blockers: string[] },
  stewardshipJournal: DerivedStewardshipJournal
): DerivedReviewDelta {
  if (!project) {
    return {
      status: 'steady',
      summary: 'No project selected.',
      readinessImpact: 'No continuity checkpoint available.',
      changeLines: [],
      checkpointLabel: 'No checkpoint saved yet.',
      carryForwardCue: 'Select a project to review continuity.'
    };
  }

  if (!latestPacket) {
    return {
      status: 'first_packet',
      summary: 'No saved handoff checkpoint yet.',
      readinessImpact: handoffReadiness.ready
        ? 'Current handoff is ready, but there is no earlier checkpoint to compare against.'
        : 'Current handoff still has blockers, and there is no earlier checkpoint to compare against.',
      changeLines: [],
      checkpointLabel: 'First checkpoint still needs to be saved.',
      carryForwardCue: stewardshipJournal.carryForward[0] || 'Save the first handoff checkpoint once this project is in a useful state.'
    };
  }

  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const approvedArtifacts = artifacts.filter((artifact) => isArtifactApproved(artifact));
  const flaggedArtifacts = artifacts.filter((artifact) => isArtifactFlagged(artifact));
  const acceptedDecisions = decisions.filter((decision) => decision.decision_state === 'accepted');
  const deferredDecisions = decisions.filter((decision) => decision.decision_state === 'deferred');
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const completedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'completed');
  const blockedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'blocked');

  const snapshot = latestPacket.snapshot;
  const changeLines = [
    formatDeltaLine(
      'Newly approved evidence',
      labelsForIds(artifacts, diffNewIds(snapshot.approved_evidence_ids, approvedArtifacts.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Newly flagged or blocked evidence',
      labelsForIds(artifacts, diffNewIds(snapshot.flagged_evidence_ids, flaggedArtifacts.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Decisions accepted since last packet',
      labelsForIds(decisions, diffNewIds(snapshot.accepted_decision_ids, acceptedDecisions.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Decisions deferred since last packet',
      labelsForIds(decisions, diffNewIds(snapshot.deferred_decision_ids, deferredDecisions.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Commitments activated since last packet',
      labelsForIds(commitments, diffNewIds(snapshot.active_commitment_ids, activeCommitments.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Commitments completed since last packet',
      labelsForIds(commitments, diffNewIds(snapshot.completed_commitment_ids, completedCommitments.map((item) => item.id)))
    ),
    formatDeltaLine(
      'Commitments blocked since last packet',
      labelsForIds(commitments, diffNewIds(snapshot.blocked_commitment_ids, blockedCommitments.map((item) => item.id)))
    )
  ].filter(Boolean);

  const nextStepChanged =
    (snapshot.next_step || '') !== (project.next_step?.trim() || '');
  if (nextStepChanged) {
    changeLines.push(
      `Next step changed: ${snapshot.next_step || 'No next step recorded'} -> ${project.next_step?.trim() || 'No next step recorded yet.'}`
    );
  }

  const readinessImpact =
    snapshot.readiness_ready === handoffReadiness.ready
      ? handoffReadiness.ready
        ? 'Handoff readiness is still clear since the last checkpoint.'
        : 'Handoff blockers remain active since the last checkpoint.'
      : handoffReadiness.ready
        ? 'Handoff moved from blocked to ready since the last checkpoint.'
        : 'Handoff became less ready since the last checkpoint.';

  if (!handoffReadiness.ready && handoffReadiness.blockers.length > 0 && snapshot.readiness_blockers.join('|') !== handoffReadiness.blockers.join('|')) {
    changeLines.push(`Readiness blockers changed: ${handoffReadiness.blockers.join(' | ')}`);
  }

  const todayMovementImpact =
    stewardshipJournal.todayEntries.length === 0
      ? 'No project movement recorded today.'
      : stewardshipJournal.todaySummary.length > 0
        ? `Today materially moved the handoff through ${stewardshipJournal.todaySummary.join(', ')}.`
        : 'Today changed the project record, but no major handoff movement was derived.';

  return {
    status: changeLines.length > 0 || nextStepChanged || snapshot.readiness_ready !== handoffReadiness.ready ? 'changed' : 'steady',
    summary:
      changeLines.length > 0
        ? `${changeLines.length} continuity change${changeLines.length === 1 ? '' : 's'} since the last checkpoint.`
        : 'No material handoff change since the last saved checkpoint.',
    readinessImpact,
    changeLines,
    checkpointLabel: `Last checkpoint saved ${formatTimestamp(latestPacket.timestamp)}`,
    carryForwardCue: stewardshipJournal.carryForward[0] || todayMovementImpact
  };
}

function deriveDeskNextAction(
  project: Project | null,
  latestReviewPacket: ProjectReviewPacket | null,
  handoffReadiness: { ready: boolean; blockers: string[] }
): DeskNextAction | null {
  if (!project) return null;

  const captures = (project.capture_items || []).filter((item) => item.capture_state === 'inbox');
  const artifacts = project.artifacts || [];
  const flaggedArtifacts = artifacts.filter((artifact) => isArtifactFlagged(artifact));
  const pendingArtifacts = artifacts.filter((artifact) => !isArtifactApproved(artifact) && !isArtifactFlagged(artifact));
  const openDecisions = (project.decisions || []).filter(
    (decision) => decision.decision_state === 'proposed' || decision.decision_state === 'deferred'
  );
  const blockedCommitments = (project.commitments || []).filter((commitment) => commitment.commitment_state === 'blocked');
  const activeCommitments = (project.commitments || []).filter((commitment) => commitment.commitment_state === 'active');
  const hasCoreObjects =
    captures.length > 0 ||
    artifacts.length > 0 ||
    openDecisions.length > 0 ||
    (project.commitments || []).length > 0 ||
    Boolean(project.next_step?.trim());

  if (!hasCoreObjects) {
    return {
      title: 'Start the project loop',
      explanation: 'This project is still empty. Add one captured input so the evidence, decision, and handoff flow has something real to work with.',
      actionLabel: 'Open Inbox',
      targetView: 'overview',
      targetElementId: 'project-capture-inbox',
      actionKind: 'start_project'
    };
  }

  if (blockedCommitments.length > 0) {
    return {
      title: blockedCommitments[0].title,
      explanation: blockedCommitments[0].blocker_note || 'A blocked commitment is the strongest thing holding the project back right now.',
      actionLabel: 'Resume Commitment',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'overview',
      targetElementId: 'project-commitments',
      actionKind: 'resume_commitment'
    };
  }

  if (flaggedArtifacts.length > 0 || pendingArtifacts.length > 0) {
    const artifact = flaggedArtifacts[0] || pendingArtifacts[0];
    return {
      title: artifact.title,
      explanation:
        artifact.review_note ||
        artifact.summary ||
        'This evidence still needs a review call before the project can move cleanly forward.',
      actionLabel: 'Review Evidence',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'overview',
      targetElementId: 'project-evidence-review',
      artifactId: artifact.id,
      actionKind: 'review_evidence'
    };
  }

  if (openDecisions.length > 0) {
    return {
      title: openDecisions[0].title,
      explanation: 'A decision is still open. Resolving it will tighten the next move and reduce drift in the project record.',
      actionLabel: 'Resolve Decision',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'overview',
      targetElementId: 'project-decisions',
      actionKind: 'resolve_decision'
    };
  }

  if (captures.length > 0) {
    return {
      title: captures[0].title,
      explanation: `${captures.length} inbox item${captures.length === 1 ? '' : 's'} are waiting to be turned into usable project evidence or a decision draft.`,
      actionLabel: 'Open Inbox',
      targetView: 'overview',
      targetElementId: 'project-capture-inbox',
      actionKind: 'open_inbox'
    };
  }

  if (!project.next_step?.trim()) {
    return {
      title: 'Define the next step',
      explanation: 'The project has useful material, but it still does not say what should happen next.',
      actionLabel: 'Define Next Step',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'overview',
      targetElementId: 'project-next-step',
      actionKind: 'define_next_step'
    };
  }

  if (activeCommitments.length > 0) {
    return {
      title: activeCommitments[0].title,
      explanation: 'There is an active commitment in force. Re-enter there first so the project keeps moving without reconstruction.',
      actionLabel: 'Resume Commitment',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'overview',
      targetElementId: 'project-commitments',
      actionKind: 'resume_commitment'
    };
  }

  if (handoffReadiness.ready && !latestReviewPacket) {
    return {
      title: 'Save the first checkpoint',
      explanation: 'The handoff is in good shape, but there is no saved checkpoint yet. Save one now so future deltas have a real baseline.',
      actionLabel: 'Save Checkpoint',
      secondaryActionLabel: 'Open Handoff',
      targetView: 'handoff',
      targetElementId: 'project-handoff-root',
      actionKind: 'save_checkpoint'
    };
  }

  return {
    title: 'Open the latest handoff',
    explanation: 'The project is stable enough to review or carry forward. Open the latest handoff and decide whether to save a new checkpoint.',
    actionLabel: 'Open Handoff',
    targetView: 'handoff',
    targetElementId: 'project-handoff-root',
    actionKind: 'open_handoff'
  };
}

function deriveProjectBrief(
  project: Project | null,
  projectMemory: DerivedProjectMemory,
  projectRelevance: DerivedProjectRelevance,
  agentSummary: DerivedAgentSummary,
  runtime: ReturnType<typeof getRuntimeCondition>,
  runtimeAdvisory: DerivedRuntimeCommitmentAdvisory | null,
  latestReflection: PeerReflection | null
): DerivedProjectBrief {
  if (!project) {
    return {
      currentBrief: ['No project selected.'],
      carryForward: ['Select a project to generate a brief.'],
      reviewPressure: ['No active review pressure available.'],
      artifactReadiness: ['No project artifact package is available.']
    };
  }

  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const acceptedDecision = [...decisions].reverse().find((decision) => decision.decision_state === 'accepted');
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const blockedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'blocked');
  const lowConfidenceCommitments = commitments.filter(
    (commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low'
  );
  const reviewedArtifacts = artifacts.filter((artifact) => artifact.review_state === 'reviewed');
  const blockedArtifacts = artifacts.filter((artifact) => artifact.review_signal === 'blocked');
  const attentionArtifacts = artifacts.filter((artifact) => artifact.review_signal === 'needs_attention');

  const currentBrief = [
    `Status: ${project.status}`,
    `Current direction: ${projectMemory.currentDirection}`,
    `Return focus: ${projectRelevance.returnFocus}`
  ];

  if (project.context?.validation_status) {
    currentBrief.push(`Validation context: ${project.context.validation_status}`);
  }
  if (runtime.label !== 'Calm') {
    currentBrief.push(`Bellows condition: ${runtime.label} (${runtime.detail})`);
  }

  const carryForward = [
    project.next_step?.trim() ? `Next step: ${project.next_step.trim()}` : 'Next step: not yet defined.',
    activeCommitments.length > 0
      ? `Active commitments in force: ${activeCommitments.map((commitment) => commitment.title).slice(0, 2).join(', ')}${activeCommitments.length > 2 ? ` +${activeCommitments.length - 2} more` : ''}.`
      : 'No active commitments are currently carrying the project forward.'
  ];

  if (acceptedDecision) {
    carryForward.push(`Accepted decision: ${acceptedDecision.title}`);
  }
  if (latestReflection) {
    carryForward.push(`Latest reflection cue: ${latestReflection.agent} reflected on current conditions.`);
  }

  const reviewPressure = [
    projectMemory.openQuestion,
    projectMemory.criticalReviewSignal,
    runtimeAdvisory ? runtimeAdvisory.message : 'No runtime-to-commitment advisory is currently active.'
  ];

  if (blockedCommitments.length > 0) {
    reviewPressure.push(`Blocked commitments: ${blockedCommitments.map((commitment) => commitment.title).join(', ')}.`);
  }
  if (lowConfidenceCommitments.length > 0) {
    reviewPressure.push(`Low-confidence commitments: ${lowConfidenceCommitments.map((commitment) => commitment.title).join(', ')}.`);
  }

  const artifactReadiness = [
    artifacts.length > 0
      ? `Evidence items attached: ${artifacts.length} total, ${reviewedArtifacts.length} reviewed.`
      : 'No evidence items attached yet.',
    blockedArtifacts.length > 0
      ? `Blocked evidence: ${blockedArtifacts.map((artifact) => artifact.title).join(', ')}.`
      : attentionArtifacts.length > 0
        ? `Evidence needing attention: ${attentionArtifacts.map((artifact) => artifact.title).join(', ')}.`
        : 'No evidence block or attention signal is currently active.',
    agentSummary.suggestedReviewFocus[0] || 'No suggested review focus is currently derived.'
  ];

  return {
    currentBrief,
    carryForward,
    reviewPressure,
    artifactReadiness
  };
}

function deriveProjectRoomObjects(
  project: Project | null,
  projectBrief: DerivedProjectBrief,
  projectMemory: DerivedProjectMemory,
  projectRelevance: DerivedProjectRelevance,
  runtime: ReturnType<typeof getRuntimeCondition>,
  runtimeAdvisory: DerivedRuntimeCommitmentAdvisory | null,
  latestReflection: PeerReflection | null
): ProjectRoomObject[] {
  if (!project) return [];

  const objects: ProjectRoomObject[] = [];
  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];

  objects.push({
    id: 'room-brief',
    kind: 'brief',
    title: 'Project Brief',
    summary: projectBrief.currentBrief[0] || projectRelevance.returnFocus,
    status: 'Derived',
    accent: 'border-fuchsia-900/40 bg-fuchsia-950/10 text-fuchsia-200',
    detail: [...projectBrief.currentBrief, ...projectBrief.carryForward.slice(0, 2)]
  });

  objects.push({
    id: 'room-memory',
    kind: 'memory',
    title: 'Project Memory',
    summary: projectMemory.currentDirection,
    status: 'Return Context',
    accent: 'border-teal-900/40 bg-teal-950/10 text-teal-200',
    detail: [
      `Remembered Context: ${projectMemory.rememberedContext}`,
      `Open Question: ${projectMemory.openQuestion}`,
      `Critical Review Signal: ${projectMemory.criticalReviewSignal}`,
      `Recent Decision: ${projectMemory.recentDecision}`
    ]
  });

  objects.push({
    id: 'room-runtime',
    kind: 'runtime',
    title: 'Bellows Runtime',
    summary: `${runtime.label} — ${runtime.detail}`,
    status: runtime.label,
    accent: runtime.classes,
    detail: [
      `Top Signal: ${projectRelevance.topSignal}`,
      `Return Focus: ${projectRelevance.returnFocus}`,
      runtimeAdvisory ? runtimeAdvisory.message : 'No runtime-to-commitment advisory is currently active.'
    ]
  });

  artifacts.forEach((artifact) => {
    objects.push({
      id: `room-artifact-${artifact.id}`,
      kind: 'artifact',
      title: artifact.title,
      summary: artifact.summary || 'No artifact summary recorded yet.',
      status: `${artifact.review_state || 'unreviewed'} / ${artifact.review_signal || 'clear'}`,
      accent: 'border-indigo-900/40 bg-indigo-950/10 text-indigo-100',
      timestamp: artifact.timestamp,
      linkedArtifactId: artifact.id,
      detail: [
        `Type: ${artifact.type}`,
        `Source Lane: ${artifact.source_lane || project.category}`,
        `Review State: ${artifact.review_state || 'unreviewed'}`,
        `Review Signal: ${artifact.review_signal || 'clear'}`,
        artifact.review_note ? `Review Note: ${artifact.review_note}` : 'No review note recorded.'
      ]
    });
  });

  decisions.forEach((decision) => {
    objects.push({
      id: `room-decision-${decision.id}`,
      kind: 'decision',
      title: decision.title,
      summary: decision.rationale,
      status: decision.decision_state,
      accent: 'border-amber-900/40 bg-amber-950/10 text-amber-100',
      timestamp: decision.timestamp,
      linkedArtifactId: decision.artifact_id,
      detail: [
        `Decision State: ${decision.decision_state}`,
        decision.impact_note ? `Impact: ${decision.impact_note}` : 'No impact note recorded.',
        decision.artifact_id ? `Linked Artifact: ${decision.artifact_id}` : 'No artifact link recorded.'
      ]
    });
  });

  commitments.forEach((commitment) => {
    objects.push({
      id: `room-commitment-${commitment.id}`,
      kind: 'commitment',
      title: commitment.title,
      summary: commitment.next_action,
      status: commitment.commitment_state,
      accent: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-100',
      timestamp: commitment.timestamp,
      linkedArtifactId: commitment.artifact_id,
      detail: [
        `Rationale: ${commitment.rationale}`,
        `Done When: ${commitment.done_when}`,
        `Confidence: ${commitment.confidence || 'medium'}`,
        commitment.work_package ? `Work Package: ${commitment.work_package}` : 'No work package recorded.',
        commitment.constraints ? `Constraints: ${commitment.constraints}` : 'No constraint boundary recorded.'
      ]
    });
  });

  if (latestReflection) {
    objects.push({
      id: 'room-reflection-latest',
      kind: 'reflection',
      title: `Peer Reflection — ${latestReflection.agent}`,
      summary: latestReflection.content,
      status: 'Supporting Cue',
      accent: 'border-slate-800 bg-slate-950/40 text-slate-200',
      timestamp: latestReflection.timestamp,
      detail: [
        `Agent: ${latestReflection.agent}`,
        `Timestamp: ${latestReflection.timestamp}`,
        'Reflection supports continuity but does not override human project state.'
      ]
    });
  }

  return objects;
}

function deriveProjectReviewQueue(
  project: Project | null,
  _projectMemory: DerivedProjectMemory,
  runtimeAdvisory: DerivedRuntimeCommitmentAdvisory | null
): ProjectReviewItem[] {
  if (!project) return [];

  const reviewItems: ProjectReviewItem[] = [];
  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];

  if (runtimeAdvisory) {
    reviewItems.push({
      id: 'review-runtime-advisory',
      title: runtimeAdvisory.label,
      status: 'Runtime Advisory',
      summary: runtimeAdvisory.message,
      stage: 'operational_cue',
      priority: 'medium',
      action: runtimeAdvisory.detail,
      actionType: 'none'
    });
  }

  commitments
    .filter((commitment) => commitment.commitment_state === 'blocked')
    .forEach((commitment) => {
      reviewItems.push({
        id: `review-blocked-${commitment.id}`,
        title: commitment.title,
        status: 'Blocked Commitment',
        summary: commitment.blocker_note || commitment.rationale,
        stage: 'operational_cue',
        priority: 'high',
        action: `Unblock and reassess next action: ${commitment.next_action}`,
        actionType: 'none',
        linkedArtifactId: commitment.artifact_id
      });
    });

  commitments
    .filter((commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low')
    .forEach((commitment) => {
      reviewItems.push({
        id: `review-risk-${commitment.id}`,
        title: commitment.title,
        status: 'Low-Confidence Exposure',
        summary: commitment.constraints || commitment.rationale,
        stage: 'operational_cue',
        priority: 'high',
        action: 'Review against current Bellows state and project constraints.',
        actionType: 'none',
        linkedArtifactId: commitment.artifact_id
      });
    });

  decisions
    .filter((decision) => decision.decision_state === 'proposed' || decision.decision_state === 'deferred')
    .forEach((decision) => {
      reviewItems.push({
        id: `review-decision-${decision.id}`,
        title: decision.title,
        status: decision.decision_state === 'proposed' ? 'Pending Decision' : 'Deferred Decision',
        summary: decision.rationale,
        stage: 'needs_call',
        priority: 'high',
        action: 'Resolve decision state or promote consequence into a commitment.',
        actionType: 'none',
        linkedDecisionId: decision.id
      });
    });

  artifacts
    .filter((artifact) => artifact.review_signal === 'blocked' || artifact.review_signal === 'needs_attention')
    .forEach((artifact) => {
      reviewItems.push({
        id: `review-artifact-${artifact.id}`,
        title: artifact.title,
        status: artifact.review_signal === 'blocked' ? 'Blocked Artifact' : 'Needs Attention',
        summary: artifact.review_note || artifact.summary || 'Artifact needs operator review.',
        stage: 'needs_call',
        priority: artifact.review_signal === 'blocked' ? 'high' : 'medium',
        action: 'Open the artifact, review the note, and decide whether to promote or revise it.',
        actionType: 'open_artifact',
        linkedArtifactId: artifact.id
      });
    });

  artifacts
    .filter((artifact) => artifact.review_state === 'unreviewed' && artifact.review_signal === 'clear' && artifact.source_lane !== 'projects')
    .forEach((artifact) => {
      reviewItems.push({
        id: `review-convert-${artifact.id}`,
        title: artifact.title,
        status: 'Unreviewed Evidence',
        summary: artifact.summary || 'Captured evidence ready to support a decision.',
        stage: 'ready_to_convert',
        priority: 'medium',
        action: 'Convert to a decision or commitment.',
        actionType: 'seed_decision',
        linkedArtifactId: artifact.id
      });
    });

  artifacts
    .filter((artifact) => artifact.review_state === 'reviewed' && artifact.review_signal === 'clear')
    .forEach((artifact) => {
      reviewItems.push({
        id: `review-carry-${artifact.id}`,
        title: artifact.title,
        status: 'Reviewed Evidence',
        summary: 'This evidence is reviewed and ready to carry forward into the handoff packet.',
        stage: 'ready_to_carry',
        priority: 'steady',
        action: 'Ready for handoff.',
        actionType: 'none',
        linkedArtifactId: artifact.id
      });
    });

  const priorityOrder: Record<ProjectReviewItem['priority'], number> = {
    high: 0,
    medium: 1,
    steady: 2
  };

  return reviewItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function deriveProjectContinuityLinks(
  project: Project | null,
  focusedObject: ProjectRoomObject | null,
  roomObjects: ProjectRoomObject[],
  runtime: ReturnType<typeof getRuntimeCondition>,
  projectBrief: DerivedProjectBrief,
  projectMemory: DerivedProjectMemory
): ProjectContinuityLink[] {
  if (!project || !focusedObject) return [];

  const links: ProjectContinuityLink[] = [];
  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const roomObjectById = new Map(roomObjects.map((object) => [object.id, object]));
  const artifactObjectByArtifactId = new Map(
    roomObjects.filter((object) => object.kind === 'artifact' && object.linkedArtifactId).map((object) => [object.linkedArtifactId as string, object])
  );
  const degradedRuntime = ['Stale', 'Degraded', 'Unavailable'].includes(runtime.label);

  const pushLink = (link: ProjectContinuityLink) => {
    const duplicate = links.some(
      (existing) =>
        existing.label === link.label &&
        existing.reason === link.reason &&
        existing.targetRoomObjectId === link.targetRoomObjectId &&
        existing.targetArtifactId === link.targetArtifactId
    );

    if (!duplicate) {
      links.push(link);
    }
  };

  const pushObjectLink = (label: string, reason: string, targetRoomObjectId: string) => {
    const target = roomObjectById.get(targetRoomObjectId);
    if (!target || targetRoomObjectId === focusedObject.id) return;
    pushLink({
      id: `${focusedObject.id}-${label}-${targetRoomObjectId}`,
      label,
      reason,
      targetRoomObjectId
    });
  };

  const pushArtifactLink = (label: string, reason: string, artifactId?: string) => {
    if (!artifactId) return;
    const target = artifactObjectByArtifactId.get(artifactId);
    if (target) {
      pushObjectLink(label, reason, target.id);
      return;
    }

    pushLink({
      id: `${focusedObject.id}-${label}-${artifactId}`,
      label,
      reason,
      targetArtifactId: artifactId
    });
  };

  if (focusedObject.kind === 'brief') {
    pushObjectLink('Derived From', 'Project brief rolls up remembered context for return.', 'room-memory');
    pushObjectLink('Feeds Brief', 'Runtime condition contributes to current continuity pressure.', 'room-runtime');

    commitments
      .filter((commitment) => commitment.commitment_state === 'active')
      .slice(0, 3)
      .forEach((commitment) =>
        pushObjectLink(
          'Feeds Brief',
          `Active commitment carried forward: ${commitment.title}`,
          `room-commitment-${commitment.id}`
        )
      );

    artifacts
      .slice(0, 2)
      .forEach((artifact) =>
        pushObjectLink('Supports Review', `Artifact context available for review: ${artifact.title}`, `room-artifact-${artifact.id}`)
      );

    if (roomObjectById.has('room-reflection-latest')) {
      pushObjectLink('Derived From', 'Latest peer reflection supports continuity, but does not override it.', 'room-reflection-latest');
    }
  }

  if (focusedObject.kind === 'memory') {
    pushObjectLink('Current Direction', 'Project memory anchors the brief for returnability.', 'room-brief');

    const acceptedDecision = decisions.find((decision) => decision.decision_state === 'accepted');
    if (acceptedDecision) {
      pushObjectLink(
        'Recent Decision',
        `Accepted decision remembered in context: ${acceptedDecision.title}`,
        `room-decision-${acceptedDecision.id}`
      );
    }

    const flaggedArtifact = artifacts.find(
      (artifact) => artifact.review_signal === 'blocked' || artifact.review_signal === 'needs_attention' || artifact.review_state === 'in_review'
    );
    if (flaggedArtifact) {
      pushObjectLink(
        'Critical Review Signal',
        `Artifact under review remains part of remembered context: ${flaggedArtifact.title}`,
        `room-artifact-${flaggedArtifact.id}`
      );
    }

    if (roomObjectById.has('room-reflection-latest')) {
      pushObjectLink('Supporting Cue', 'Latest reflection supplements remembered context.', 'room-reflection-latest');
    }
  }

  if (focusedObject.kind === 'runtime') {
    pushObjectLink('Feeds Brief', 'Runtime condition contributes to the current project brief.', 'room-brief');

    commitments
      .filter((commitment) => commitment.commitment_state === 'active')
      .slice(0, 4)
      .forEach((commitment) =>
        pushObjectLink(
          degradedRuntime ? 'Affected Commitment' : 'Linked Commitment',
          degradedRuntime
            ? `Active commitment should be reviewed against Bellows state: ${commitment.title}`
            : `Active commitment monitored alongside runtime state: ${commitment.title}`,
          `room-commitment-${commitment.id}`
        )
      );
  }

  if (focusedObject.kind === 'artifact') {
    const artifactId = focusedObject.linkedArtifactId;
    pushObjectLink('Supports Review', 'Artifact contributes to the current brief and review posture.', 'room-brief');

    decisions
      .filter((decision) => decision.artifact_id === artifactId)
      .forEach((decision) =>
        pushObjectLink(
          'Linked Decision',
          `Decision references this artifact: ${decision.title}`,
          `room-decision-${decision.id}`
        )
      );

    commitments
      .filter((commitment) => commitment.artifact_id === artifactId)
      .forEach((commitment) =>
        pushObjectLink(
          'Affected Commitment',
          `Commitment carries this artifact forward: ${commitment.title}`,
          `room-commitment-${commitment.id}`
        )
      );
  }

  if (focusedObject.kind === 'decision') {
    const decisionId = focusedObject.id.replace('room-decision-', '');
    const decision = decisions.find((entry) => entry.id === decisionId);

    pushObjectLink('Feeds Brief', 'Decision state contributes to project continuity.', 'room-brief');
    pushArtifactLink('Linked Artifact', 'Decision references supporting artifact evidence.', decision?.artifact_id);

    commitments
      .filter((commitment) => commitment.decision_id === decisionId)
      .forEach((commitment) =>
        pushObjectLink(
          'Promoted Commitment',
          `Decision is carried forward by commitment: ${commitment.title}`,
          `room-commitment-${commitment.id}`
        )
      );
  }

  if (focusedObject.kind === 'commitment') {
    const commitmentId = focusedObject.id.replace('room-commitment-', '');
    const commitment = commitments.find((entry) => entry.id === commitmentId);

    pushObjectLink('Feeds Brief', 'Commitment contributes to the active continuity spine.', 'room-brief');
    pushArtifactLink('Linked Artifact', 'Commitment is anchored to supporting artifact context.', commitment?.artifact_id);

    if (commitment?.decision_id) {
      pushObjectLink(
        'Linked Decision',
        'Commitment carries forward an explicit project decision.',
        `room-decision-${commitment.decision_id}`
      );
    }

    if (degradedRuntime && commitment?.commitment_state === 'active') {
      pushObjectLink(
        'Runtime Cue',
        `Bellows state may affect execution confidence for ${commitment.title}.`,
        'room-runtime'
      );
    }
  }

  if (focusedObject.kind === 'reflection') {
    pushObjectLink('Supports Review', 'Reflection supports remembered context on return.', 'room-memory');
    pushObjectLink('Feeds Brief', 'Reflection can inform the current project brief.', 'room-brief');
  }

  if (!links.length) {
    const fallbackLine = projectBrief.currentBrief[0] || projectMemory.currentDirection;
    pushLink({
      id: `${focusedObject.id}-continuity-fallback`,
      label: 'Derived From',
      reason: fallbackLine
    });
  }

  return links;
}

function deriveProjectRoomFrames(
  project: Project | null,
  roomObjects: ProjectRoomObject[],
  reviewQueue: ProjectReviewItem[],
  projectBrief: DerivedProjectBrief,
  projectMemory: DerivedProjectMemory,
  runtime: ReturnType<typeof getRuntimeCondition>,
  runtimeAdvisory: DerivedRuntimeCommitmentAdvisory | null
): ProjectRoomFrame[] {
  if (!project) return [];

  const artifacts = project.artifacts || [];
  const captureItems = project.capture_items || [];
  const inboxCaptures = captureItems.filter((item) => item.capture_state === 'inbox');
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const reflectionObject = roomObjects.find((object) => object.kind === 'reflection');
  const flaggedArtifacts = artifacts.filter(
    (artifact) => artifact.review_signal === 'blocked' || artifact.review_signal === 'needs_attention' || artifact.review_state === 'in_review'
  );
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const blockedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'blocked');
  const lowConfidenceActive = commitments.filter(
    (commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low'
  );
  const proposedDecisions = decisions.filter((decision) => decision.decision_state === 'proposed');
  const acceptedDecisions = decisions.filter((decision) => decision.decision_state === 'accepted');
  const deferredDecisions = decisions.filter((decision) => decision.decision_state === 'deferred');

  const frames: ProjectRoomFrame[] = [
    {
      id: 'evidence',
      title: 'Evidence',
      summary:
        artifacts.length > 0 || inboxCaptures.length > 0
          ? `${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'} and ${inboxCaptures.length} inbox item${inboxCaptures.length === 1 ? '' : 's'} ready for review.`
          : 'No project artifacts or inbox captures are attached yet.',
      status:
        flaggedArtifacts.length > 0
          ? `${flaggedArtifacts.length} evidence item${flaggedArtifacts.length === 1 ? '' : 's'} need review`
          : inboxCaptures.length > 0
            ? `${inboxCaptures.length} item${inboxCaptures.length === 1 ? '' : 's'} waiting in inbox`
          : artifacts.length > 0
            ? 'Evidence is reviewable'
            : 'Evidence is thin',
      accent: 'border-violet-900/40 bg-violet-950/10 text-violet-100',
      objectIds: [
        ...artifacts.map((artifact) => `room-artifact-${artifact.id}`),
        ...(reflectionObject ? [reflectionObject.id] : [])
      ],
      signals: [
        inboxCaptures.length > 0
          ? `${inboxCaptures.length} captured item${inboxCaptures.length === 1 ? '' : 's'} are waiting to be promoted.`
          : 'Inbox is clear right now.',
        flaggedArtifacts.length > 0
          ? `${flaggedArtifacts.length} artifact signal${flaggedArtifacts.length === 1 ? '' : 's'} need attention before promotion.`
          : 'Artifact review is currently calm.',
        reflectionObject ? 'Latest peer reflection is available as supporting context.' : 'No peer reflection is attached to this room yet.'
      ],
      operatorCue: 'Gather proof, sharpen summaries, and promote only evidence that can support a decision or commitment.'
    },
    {
      id: 'decisions',
      title: 'Decisions',
      summary:
        decisions.length > 0
          ? `${decisions.length} decision${decisions.length === 1 ? '' : 's'} recorded across proposal, acceptance, and deferral states.`
          : 'No formal decisions have been recorded yet.',
      status:
        proposedDecisions.length > 0
          ? `${proposedDecisions.length} decision${proposedDecisions.length === 1 ? '' : 's'} still proposed`
          : acceptedDecisions.length > 0
            ? `${acceptedDecisions.length} accepted decision${acceptedDecisions.length === 1 ? '' : 's'}`
            : 'Decision layer is quiet',
      accent: 'border-amber-900/40 bg-amber-950/10 text-amber-100',
      objectIds: decisions.map((decision) => `room-decision-${decision.id}`),
      signals: [
        acceptedDecisions.length > 0
          ? `${acceptedDecisions.length} accepted decision${acceptedDecisions.length === 1 ? '' : 's'} can anchor execution.`
          : 'No accepted decision currently anchors the room.',
        deferredDecisions.length > 0
          ? `${deferredDecisions.length} decision${deferredDecisions.length === 1 ? '' : 's'} remain deferred.`
          : 'No deferred decisions are slowing the room.'
      ],
      operatorCue: 'Use this frame to stabilize choices before they dissolve back into discussion or drift into half-commitments.'
    },
    {
      id: 'commitments',
      title: 'Commitments',
      summary:
        commitments.length > 0
          ? `${commitments.length} commitment${commitments.length === 1 ? '' : 's'} define what the room is actually carrying forward.`
          : 'No active consequence layer exists yet.',
      status:
        blockedCommitments.length > 0
          ? `${blockedCommitments.length} blocked commitment${blockedCommitments.length === 1 ? '' : 's'}`
          : activeCommitments.length > 0
            ? `${activeCommitments.length} active commitment${activeCommitments.length === 1 ? '' : 's'}`
            : 'Commitment layer is empty',
      accent: 'border-emerald-900/40 bg-emerald-950/10 text-emerald-100',
      objectIds: commitments.map((commitment) => `room-commitment-${commitment.id}`),
      signals: [
        activeCommitments.length > 0
          ? `${activeCommitments.length} commitment${activeCommitments.length === 1 ? '' : 's'} are currently in force.`
          : 'No commitment is currently active.',
        lowConfidenceActive.length > 0
          ? `${lowConfidenceActive.length} active commitment${lowConfidenceActive.length === 1 ? '' : 's'} are low confidence.`
          : 'No active commitments are marked low confidence.'
      ],
      operatorCue: 'This is the room spine: keep commitments concrete, linked, and reviewable enough that someone else can pick them up.'
    },
    {
      id: 'runtime_risk',
      title: 'Runtime / Risk',
      summary: `Bellows condition is ${runtime.label.toLowerCase()} and review pressure is visible against current project state.`,
      status: runtimeAdvisory ? runtimeAdvisory.label : runtime.label,
      accent: 'border-rose-900/40 bg-rose-950/10 text-rose-100',
      objectIds: [
        'room-runtime',
        'room-memory',
        ...blockedCommitments.slice(0, 2).map((commitment) => `room-commitment-${commitment.id}`),
        ...lowConfidenceActive.slice(0, 2).map((commitment) => `room-commitment-${commitment.id}`)
      ],
      signals: [
        runtime.detail,
        runtimeAdvisory ? runtimeAdvisory.message : 'No runtime-to-commitment advisory is currently active.',
        reviewQueue.length > 0
          ? `${reviewQueue.filter((item) => item.priority === 'high').length} high-priority review item${reviewQueue.filter((item) => item.priority === 'high').length === 1 ? '' : 's'} are visible.`
          : 'No review pressure is currently derived.'
      ],
      operatorCue: 'Check this frame before advancing work when runtime freshness, blocked commitments, or risk signals start to drift.'
    },
    {
      id: 'next_moves',
      title: 'Next Moves',
      summary: project.next_step?.trim() || projectMemory.currentDirection,
      status: project.next_step?.trim() ? 'Next step defined' : 'Direction needs tightening',
      accent: 'border-fuchsia-900/40 bg-fuchsia-950/10 text-fuchsia-100',
      objectIds: [
        'room-brief',
        ...activeCommitments.slice(0, 3).map((commitment) => `room-commitment-${commitment.id}`),
        ...proposedDecisions.slice(0, 1).map((decision) => `room-decision-${decision.id}`)
      ],
      signals: [
        project.next_step?.trim() || 'No explicit next step has been set yet.',
        projectBrief.currentBrief[0] || 'No current brief line is available.',
        projectBrief.reviewPressure[0] || 'No review pressure line is currently active.'
      ],
      operatorCue: 'Use this frame to orient a returning collaborator quickly: what matters now, what is ready, and what still needs a call.'
    }
  ];

  return frames.map((frame) => ({
    ...frame,
    objectIds: frame.objectIds.filter((id, index, all) => all.indexOf(id) === index && roomObjects.some((object) => object.id === id))
  }));
}

function downloadJsonArtifact(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function downloadTextArtifact(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const nowIso = () => new Date().toISOString();

const PROJECT_TEMPLATES: Record<ProjectTemplateKey, ProjectTemplateDefinition> = {
  indie_build: {
    key: 'indie_build',
    label: 'Indie Build',
    description: 'A fast product loop for a solo builder shipping and refining one practical idea.',
    category: 'workbench',
    evidenceTitle: 'Initial product signal',
    evidenceSummary: 'Collected early demand notes, workflow friction, and one concrete user scenario worth testing.',
    decisionTitle: 'Narrow the first release',
    decisionRationale: 'Keep the first release focused on one repeatable pain point so the project can ship before it sprawls.',
    commitmentTitle: 'Ship one usable first cut',
    commitmentRationale: 'Turn the strongest evidence into a small but real release that can be shown, tested, and revised quickly.',
    commitmentNextAction: 'Review the evidence and turn it into one concrete shipping slice.',
    commitmentDoneWhen: 'A first usable release is captured in evidence and the next test is clearly defined.',
    nextStep: 'Review the starting evidence and lock the first shipping slice.'
  },
  client_deliverable: {
    key: 'client_deliverable',
    label: 'Client Deliverable',
    description: 'A clearer handoff loop for client work that needs evidence, decisions, and a ready-to-share brief.',
    category: 'operations',
    evidenceTitle: 'Client request summary',
    evidenceSummary: 'Captured the requested outcome, constraints, and the most important review criteria for the deliverable.',
    decisionTitle: 'Confirm delivery shape',
    decisionRationale: 'Agree on what will actually be delivered so review and handoff stay grounded in the same scope.',
    commitmentTitle: 'Prepare the delivery package',
    commitmentRationale: 'Move from request capture into a reviewable package that can be approved and carried forward without re-explaining it.',
    commitmentNextAction: 'Review the request summary and define the first draft that should be assembled.',
    commitmentDoneWhen: 'The delivery package is reviewable, scoped, and ready for a clean client handoff.',
    nextStep: 'Confirm the first delivery draft and the review criteria.'
  },
  research_sprint: {
    key: 'research_sprint',
    label: 'Research Sprint',
    description: 'A compact structure for gathering signals, making a call, and packaging the result into a useful brief.',
    category: 'stewardship',
    evidenceTitle: 'Research starting signal',
    evidenceSummary: 'Stored the primary question, a few initial findings, and the evidence that should shape the sprint decision.',
    decisionTitle: 'Choose the research direction',
    decisionRationale: 'Pick the most useful thread to pursue so the sprint accumulates knowledge instead of drifting into collection.',
    commitmentTitle: 'Complete the first review pass',
    commitmentRationale: 'Convert raw findings into reviewed evidence and a clear next question worth carrying forward.',
    commitmentNextAction: 'Review the current findings and decide which thread deserves the next pass.',
    commitmentDoneWhen: 'The sprint has a reviewable brief, a clear decision, and the next research move is defined.',
    nextStep: 'Review the evidence and choose the next research thread to pursue.'
  }
};

function createProjectTemplateSeed(templateKey: ProjectTemplateKey) {
  const template = PROJECT_TEMPLATES[templateKey];
  const timestamp = nowIso();
  const seedId = `${templateKey}_${Date.now()}`;

  return {
    category: template.category,
    next_step: template.nextStep,
    artifacts: [
      {
        id: `artifact_${seedId}`,
        type: 'seed_evidence',
        title: template.evidenceTitle,
        timestamp,
        summary: template.evidenceSummary,
        source_lane: 'projects',
        review_state: 'unreviewed' as const,
        review_signal: 'clear' as const,
        review_note: 'Seeded from a guided project template.'
      }
    ],
    decisions: [
      {
        id: `decision_${seedId}`,
        timestamp,
        title: template.decisionTitle,
        rationale: template.decisionRationale,
        decision_state: 'proposed' as const,
        impact_note: 'Template starting point. Adjust once evidence becomes specific.'
      }
    ],
    commitments: [
      {
        id: `commitment_${seedId}`,
        timestamp,
        title: template.commitmentTitle,
        commitment_state: 'active' as const,
        rationale: template.commitmentRationale,
        next_action: template.commitmentNextAction,
        done_when: template.commitmentDoneWhen,
        confidence: 'medium' as const,
        work_package: `${template.label} Setup`,
        constraints: 'Template starter content should be replaced with project-specific evidence as work begins.'
      }
    ]
  };
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    title: 'Solis Arm Fabrication',
    description: 'First physical assembly of the 3-DOF arm.',
    category: 'morphology',
    status: 'ACTIVE',
    updated_at: nowIso(),
    pinned_note: 'Ensure we check the torque on the elbow servo.',
    messages: [
      { id: 'm1', content: 'Base print finished without warping.', tag: 'useful', timestamp: nowIso() }
    ],
    artifacts: [
      {
        id: 'a1',
        type: 'build_packet',
        title: 'Initial Fabrication Summary',
        summary: 'Bench build packet exported from morphology.',
        timestamp: nowIso(),
        review_state: 'unreviewed'
      }
    ],
    capture_items: [
      {
        id: 'c1',
        capture_type: 'text_note',
        title: 'Check elbow cable slack',
        content: 'Observed slight slack near the elbow joint during bench setup.',
        created_at: nowIso(),
        note: 'Promote if the next bench test confirms drift.',
        capture_state: 'inbox'
      }
    ],
    activity: [
      {
        id: 'act1',
        kind: 'project_created',
        title: 'Project created',
        detail: 'Initial fabrication workstream opened for bench planning.',
        timestamp: nowIso()
      },
      {
        id: 'act2',
        kind: 'artifact_added',
        title: 'Artifact attached',
        detail: 'Initial Fabrication Summary added to the project record.',
        timestamp: nowIso()
      }
    ],
    context: {
      asset_id: 'SOLIS-ARM-01',
      preset_template: 'CUSTOM',
      morphology_class: '3_DOF_ARM',
      actuator_joint_count: 3,
      footprint: '0.8m x 0.4m',
      maximum_reach_m: 0.9,
      validation_status: 'VALID FOR BENCH REVIEW'
    }
  }
];

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function normalizeArtifacts(value: unknown): ProjectArtifact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((artifact, index) => {
      const item = artifact as Partial<ProjectArtifact>;
      const reviewState: ArtifactReviewState =
        item.review_state === 'in_review' || item.review_state === 'reviewed' || item.review_state === 'unreviewed'
          ? item.review_state
          : 'unreviewed';
      const reviewSignal: ArtifactReviewSignal =
        item.review_signal === 'clear' || item.review_signal === 'needs_attention' || item.review_signal === 'blocked'
          ? item.review_signal
          : 'clear';
      return {
        id: item.id || `artifact_${index}`,
        type: item.type || 'artifact',
        title: item.title || 'Untitled artifact',
        summary: item.summary,
        timestamp: item.timestamp || nowIso(),
        source_lane: typeof item.source_lane === 'string' ? item.source_lane : undefined,
        review_state: reviewState,
        review_signal: reviewSignal,
        review_note: typeof item.review_note === 'string' ? item.review_note : undefined
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeMessages(value: unknown): ProjectMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message, index) => {
      const item = message as Partial<ProjectMessage>;
      const tag: MessageTag =
        item.tag === 'useful' || item.tag === 'question' || item.tag === 'warning' || item.tag === 'none'
          ? item.tag
          : 'none';
      return {
        id: item.id || `message_${index}`,
        content: typeof item.content === 'string' ? item.content : '',
        tag,
        timestamp: item.timestamp || nowIso()
      };
    })
    .filter((message) => message.content.trim().length > 0)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeDecisions(value: unknown): ProjectDecision[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((decision, index) => {
      const item = decision as Partial<ProjectDecision>;
      const state: DecisionState =
        item.decision_state === 'proposed' || item.decision_state === 'accepted' || item.decision_state === 'deferred'
          ? item.decision_state
          : 'proposed';
      return {
        id: item.id || `decision_${index}`,
        timestamp: item.timestamp || nowIso(),
        title: typeof item.title === 'string' ? item.title : 'Untitled Decision',
        rationale: typeof item.rationale === 'string' ? item.rationale : '',
        decision_state: state,
        artifact_id: typeof item.artifact_id === 'string' ? item.artifact_id : undefined,
        impact_note: typeof item.impact_note === 'string' ? item.impact_note : undefined
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeCommitments(value: unknown): ProjectCommitment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((commitment, index) => {
      const item = commitment as Partial<ProjectCommitment>;
      const state: CommitmentState =
        item.commitment_state === 'proposed' ||
        item.commitment_state === 'active' ||
        item.commitment_state === 'blocked' ||
        item.commitment_state === 'completed'
          ? item.commitment_state
          : 'proposed';
      const confidence =
        item.confidence === 'high' || item.confidence === 'medium' || item.confidence === 'low'
          ? item.confidence
          : 'medium';
      return {
        id: item.id || `commitment_${index}`,
        title: typeof item.title === 'string' ? item.title : 'Untitled Commitment',
        timestamp: item.timestamp || nowIso(),
        commitment_state: state,
        rationale: typeof item.rationale === 'string' ? item.rationale : '',
        next_action: typeof item.next_action === 'string' ? item.next_action : '',
        blocker_note: typeof item.blocker_note === 'string' ? item.blocker_note : undefined,
        done_when: typeof item.done_when === 'string' ? item.done_when : '',
        artifact_id: typeof item.artifact_id === 'string' ? item.artifact_id : undefined,
        decision_id: typeof item.decision_id === 'string' ? item.decision_id : undefined,
        confidence,
        work_package: typeof item.work_package === 'string' ? item.work_package : undefined,
        constraints: typeof item.constraints === 'string' ? item.constraints : undefined
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeCaptureItems(value: unknown): ProjectCaptureItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((capture, index) => {
      const item = capture as Partial<ProjectCaptureItem>;
      const captureType: ProjectCaptureType =
        item.capture_type === 'text_note' ||
        item.capture_type === 'link' ||
        item.capture_type === 'file_reference' ||
        item.capture_type === 'raw_snippet'
          ? item.capture_type
          : 'text_note';
      const captureState: ProjectCaptureState =
        item.capture_state === 'inbox' || item.capture_state === 'promoted' || item.capture_state === 'dismissed'
          ? item.capture_state
          : 'inbox';

      return {
        id: item.id || `capture_${index}`,
        capture_type: captureType,
        title: typeof item.title === 'string' ? item.title : 'Untitled capture',
        content: typeof item.content === 'string' ? item.content : '',
        created_at: typeof item.created_at === 'string' ? item.created_at : nowIso(),
        note: typeof item.note === 'string' ? item.note : undefined,
        capture_state: captureState
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function normalizeReviewPackets(value: unknown): ProjectReviewPacket[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((packet, index) => {
      const item = packet as Partial<ProjectReviewPacket>;
      const snapshot = item.snapshot as Partial<ProjectReviewPacketSnapshot> | undefined;
      return {
        id: typeof item.id === 'string' ? item.id : `review_packet_${index}`,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : nowIso(),
        title: typeof item.title === 'string' ? item.title : 'Saved Handoff Checkpoint',
        markdown: typeof item.markdown === 'string' ? item.markdown : '',
        snapshot: {
          next_step: typeof snapshot?.next_step === 'string' ? snapshot.next_step : null,
          readiness_ready: Boolean(snapshot?.readiness_ready),
          readiness_blockers: Array.isArray(snapshot?.readiness_blockers)
            ? snapshot.readiness_blockers.filter((value): value is string => typeof value === 'string')
            : [],
          approved_evidence_ids: Array.isArray(snapshot?.approved_evidence_ids)
            ? snapshot.approved_evidence_ids.filter((value): value is string => typeof value === 'string')
            : [],
          flagged_evidence_ids: Array.isArray(snapshot?.flagged_evidence_ids)
            ? snapshot.flagged_evidence_ids.filter((value): value is string => typeof value === 'string')
            : [],
          pending_evidence_ids: Array.isArray(snapshot?.pending_evidence_ids)
            ? snapshot.pending_evidence_ids.filter((value): value is string => typeof value === 'string')
            : [],
          accepted_decision_ids: Array.isArray(snapshot?.accepted_decision_ids)
            ? snapshot.accepted_decision_ids.filter((value): value is string => typeof value === 'string')
            : [],
          deferred_decision_ids: Array.isArray(snapshot?.deferred_decision_ids)
            ? snapshot.deferred_decision_ids.filter((value): value is string => typeof value === 'string')
            : [],
          active_commitment_ids: Array.isArray(snapshot?.active_commitment_ids)
            ? snapshot.active_commitment_ids.filter((value): value is string => typeof value === 'string')
            : [],
          completed_commitment_ids: Array.isArray(snapshot?.completed_commitment_ids)
            ? snapshot.completed_commitment_ids.filter((value): value is string => typeof value === 'string')
            : [],
          blocked_commitment_ids: Array.isArray(snapshot?.blocked_commitment_ids)
            ? snapshot.blocked_commitment_ids.filter((value): value is string => typeof value === 'string')
            : [],
          today_entry_ids: Array.isArray(snapshot?.today_entry_ids)
            ? snapshot.today_entry_ids.filter((value): value is string => typeof value === 'string')
            : [],
          summary_line: typeof snapshot?.summary_line === 'string' ? snapshot.summary_line : ''
        }
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function deriveActivity(
  rawActivity: unknown,
  messages: ProjectMessage[],
  artifacts: ProjectArtifact[],
  updatedAt: string,
  category: string
): ProjectActivity[] {
  if (Array.isArray(rawActivity) && rawActivity.length > 0) {
    return rawActivity
      .map((activity, index) => {
        const item = activity as Partial<ProjectActivity>;
        return {
          id: item.id || `activity_${index}`,
          kind: typeof item.kind === 'string' ? (item.kind as ProjectActivityKind) : 'status',
          title: item.title || 'Project update',
          detail: item.detail,
          timestamp: item.timestamp || updatedAt
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const derived: ProjectActivity[] = [
    {
      id: 'activity_created',
      kind: 'project_created',
      title: 'Project registered',
      detail: `Project entered the ${category} lane.`,
      timestamp: updatedAt
    }
  ];

  if (messages[0]) {
    derived.push({
      id: 'activity_handoff',
      kind: 'handoff',
      title: 'Initial handoff recorded',
      detail: messages[0].content,
      timestamp: messages[0].timestamp
    });
  }

  artifacts.forEach((artifact) => {
    derived.push({
      id: `activity_${artifact.id}`,
      kind: 'artifact_added',
      title: artifact.title,
      detail: artifact.summary || `${artifact.type} attached to project record.`,
      timestamp: artifact.timestamp
    });
  });

  return derived.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeContextItems(contextItems: unknown): ProjectContextItem[] {
  if (!Array.isArray(contextItems)) return [];
  return contextItems.map((item: any, idx: number) => {
    return {
      id: item.id || `context_${idx}_${Date.now()}`,
      project_id: item.project_id || '',
      title: item.title || '',
      body: item.body || '',
      context_type: item.context_type || 'working_note',
      context_state: item.context_state || 'proposed',
      created_at: item.created_at || nowIso(),
      updated_at: item.updated_at || nowIso(),
      actor_type: item.actor_type || 'system',
      actor_name: item.actor_name,
      source_type: item.source_type || 'capture',
      source_id: item.source_id,
      evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids : [],
      supersedes_id: item.supersedes_id,
      review_note: item.review_note,
      reviewed_at: item.reviewed_at,
      signed_by: item.signed_by,
      signature: item.signature
    };
  });
}

function normalizeProject(project: unknown, index: number): Project {
  const item = project as Partial<Project>;
  const artifacts = normalizeArtifacts(item.artifacts);
  const messages = normalizeMessages(item.messages);
  const decisions = normalizeDecisions(item.decisions);
  const commitments = normalizeCommitments(item.commitments);
  const captureItems = normalizeCaptureItems(item.capture_items);
  const reviewPackets = normalizeReviewPackets(item.review_packets);
  const contextItems = normalizeContextItems(item.context_items);
  const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : nowIso();
  return {
    id: item.id || `project_${index}`,
    title: typeof item.title === 'string' ? item.title : 'Untitled Project',
    description: typeof item.description === 'string' ? item.description : '',
    category: typeof item.category === 'string' ? item.category : 'workbench',
    status: typeof item.status === 'string' ? item.status : 'PLANNING',
    updated_at: updatedAt,
    pinned_note: typeof item.pinned_note === 'string' ? item.pinned_note : '',
    messages,
    artifacts,
    decisions,
    commitments,
    capture_items: captureItems,
    review_packets: reviewPackets,
    context_items: contextItems,
    activity: deriveActivity(item.activity, messages, artifacts, updatedAt, typeof item.category === 'string' ? item.category : 'workbench'),
    context: item.context && typeof item.context === 'object' ? item.context : undefined,
    next_step: typeof item.next_step === 'string' ? item.next_step : ''
  };
}

function deriveAgentSummary(project: Project | null): DerivedAgentSummary {
  if (!project) {
    return {
      currentState: [],
      openAttention: [],
      suggestedReviewFocus: []
    };
  }

  const artifacts = project.artifacts || [];
  const activity = project.activity || [];
  const latestActivity = activity.length > 0 ? activity[activity.length - 1] : null;
  const warningMessages = project.messages.filter((message) => message.tag === 'warning');
  const questionMessages = project.messages.filter((message) => message.tag === 'question');
  const contextBits = getContextEntries(project);

  const lastDecisionOrStatus = [...activity]
    .reverse()
    .find((act) => act.kind === 'decision' || act.kind === 'status_update');

  const unresolvedWarnings = lastDecisionOrStatus
    ? warningMessages.filter((w) => new Date(w.timestamp) > new Date(lastDecisionOrStatus.timestamp))
    : warningMessages;

  const unresolvedQuestions = lastDecisionOrStatus
    ? questionMessages.filter((q) => new Date(q.timestamp) > new Date(lastDecisionOrStatus.timestamp))
    : questionMessages;

  const currentState = [
    `Status: ${project.status}`,
    project.next_step?.trim() ? `Next step: ${project.next_step.trim()}` : 'Next step: not yet defined.',
    `Evidence items attached: ${artifacts.length}`,
    latestActivity ? `Latest activity: ${latestActivity.title}` : 'Latest activity: no project activity recorded yet.'
  ];

  if (project.context?.validation_status) {
    currentState.push(`Validation context: ${project.context.validation_status}`);
  } else if (contextBits.length > 0) {
    currentState.push(`Context available: ${contextBits.length} structured fields attached.`);
  }

  const openAttention: string[] = [];

  // Blocked and needs_attention artifacts rise to open attention
  const blockedArtifacts = artifacts.filter((a) => a.review_signal === 'blocked');
  const attentionArtifacts = artifacts.filter((a) => a.review_signal === 'needs_attention');
  const decisions = project.decisions || [];
  const unresolvedDecisions = decisions.filter((d) => d.decision_state === 'proposed' || d.decision_state === 'deferred');
  const commitments = project.commitments || [];
  const blockedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'blocked');
  const activeCommitments = commitments.filter((commitment) => commitment.commitment_state === 'active');
  const proposedCommitments = commitments.filter((commitment) => commitment.commitment_state === 'proposed');

  blockedCommitments.forEach((commitment) => {
    openAttention.push(`Commitment BLOCKED: ${commitment.title}${commitment.blocker_note ? ` - ${commitment.blocker_note}` : ''}`);
  });

  activeCommitments.forEach((commitment) => {
    openAttention.push(`Commitment ACTIVE: ${commitment.title} -> ${commitment.next_action}`);
  });

  proposedCommitments.forEach((commitment) => {
    openAttention.push(`Commitment PROPOSED: ${commitment.title}`);
  });

  blockedArtifacts.forEach((a) => {
    openAttention.push(`Artifact BLOCKED: ${a.title}${a.review_note ? ` — ${a.review_note}` : ''}`);
  });

  attentionArtifacts.forEach((a) => {
    openAttention.push(`Artifact Needs Attention: ${a.title}${a.review_note ? ` — ${a.review_note}` : ''}`);
  });

  unresolvedDecisions.forEach((d) => {
    openAttention.push(`Decision ${d.decision_state.toUpperCase()}: ${d.title} (Rationale: ${d.rationale})`);
  });

  if (unresolvedWarnings.length > 0) {
    openAttention.push(`Warnings present: ${unresolvedWarnings[unresolvedWarnings.length - 1].content}`);
  }
  if (unresolvedQuestions.length > 0) {
    openAttention.push(`Open question: ${unresolvedQuestions[unresolvedQuestions.length - 1].content}`);
  }
  if (artifacts.length === 0) {
    openAttention.push('No evidence items attached yet.');
  }
  if (!project.next_step?.trim()) {
    openAttention.push('Project does not yet have a defined next step.');
  }
  if (openAttention.length === 0) {
    openAttention.push('No unresolved warnings or questions surfaced from current project discussion.');
  }

  const suggestedReviewFocus: string[] = [];

  if (blockedCommitments.length > 0) {
    suggestedReviewFocus.push(`Unblock active commitment: ${blockedCommitments[0].title}.`);
  }
  if (activeCommitments.length > 0) {
    suggestedReviewFocus.push(`Carry forward active commitment: ${activeCommitments[0].title}.`);
  }
  if (proposedCommitments.length > 0) {
    suggestedReviewFocus.push(`Review proposed commitment: ${proposedCommitments[0].title}.`);
  }

  if (blockedArtifacts.length > 0) {
    suggestedReviewFocus.push(`Address the block on evidence item: ${blockedArtifacts[0].title}.`);
  }
  if (attentionArtifacts.length > 0) {
    suggestedReviewFocus.push(`Review outstanding feedback on evidence item: ${attentionArtifacts[0].title}.`);
  }
  if (unresolvedDecisions.length > 0) {
    suggestedReviewFocus.push(`Resolve pending decision: "${unresolvedDecisions[0].title}" (${unresolvedDecisions[0].decision_state}).`);
  }
  if (unresolvedWarnings.length > 0) {
    suggestedReviewFocus.push('Review the latest warning before approving further handoff or bench work.');
  }
  if (unresolvedQuestions.length > 0) {
    suggestedReviewFocus.push('Resolve open discussion questions so the project thread can move forward cleanly.');
  }
  if (artifacts.length > 0 && project.messages.length <= 1) {
    suggestedReviewFocus.push('Review attached evidence; the project has more handoff material than discussion context right now.');
  }
  if (artifacts.length === 0) {
    suggestedReviewFocus.push('Attach at least one evidence item so the record has a durable review surface.');
  }
  if (project.next_step?.trim()) {
    suggestedReviewFocus.push(`Keep the next review pass aligned to the stated next step: ${project.next_step.trim()}`);
  }
  if (suggestedReviewFocus.length === 0) {
    suggestedReviewFocus.push('Project record is coherent; continue updating activity and artifacts as work progresses.');
  }

  return {
    currentState,
    openAttention,
    suggestedReviewFocus
  };
}

function deriveProjectRelevance(project: Project | null): DerivedProjectRelevance {
  if (!project) {
    return {
      topSignal: 'No project selected.',
      unresolvedSignal: 'No unresolved signal available.',
      latestArtifact: 'No artifact attached.',
      returnFocus: 'Select a project to restore context.'
    };
  }

  const artifacts = project.artifacts || [];
  const activity = project.activity || [];
  const warnings = project.messages.filter((message) => message.tag === 'warning');
  const questions = project.messages.filter((message) => message.tag === 'question');
  const latestArtifact = artifacts.length > 0 ? artifacts[artifacts.length - 1] : null;
  const latestActivity = activity.length > 0 ? activity[activity.length - 1] : null;

  const lastDecisionOrStatus = [...activity]
    .reverse()
    .find((act) => act.kind === 'decision' || act.kind === 'status_update');

  const unresolvedWarnings = lastDecisionOrStatus
    ? warnings.filter((warning) => new Date(warning.timestamp) > new Date(lastDecisionOrStatus.timestamp))
    : warnings;

  const unresolvedQuestions = lastDecisionOrStatus
    ? questions.filter((question) => new Date(question.timestamp) > new Date(lastDecisionOrStatus.timestamp))
    : questions;

  const blockedArtifact = artifacts.find((artifact) => artifact.review_signal === 'blocked');
  const attentionArtifact = artifacts.find((artifact) => artifact.review_signal === 'needs_attention');
  const decisions = project.decisions || [];
  const latestAcceptedDecision = [...decisions].reverse().find((decision) => decision.decision_state === 'accepted');
  const unresolvedDecisions = decisions.filter(
    (decision) => decision.decision_state === 'proposed' || decision.decision_state === 'deferred'
  );
  const commitments = project.commitments || [];
  const blockedCommitment = commitments.find((commitment) => commitment.commitment_state === 'blocked');
  const lowConfidenceCommitment = commitments.find((commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low');
  const activeCommitment = commitments.find((commitment) => commitment.commitment_state === 'active');
  const latestCompletedCommitment = [...commitments]
    .reverse()
    .find((commitment) => commitment.commitment_state === 'completed');

  const topSignal = blockedCommitment
    ? `Blocked Commitment: ${blockedCommitment.title}`
    : lowConfidenceCommitment
      ? `At Risk: ${lowConfidenceCommitment.title} (Low Confidence)`
      : blockedArtifact
        ? `Blocked Artifact: ${blockedArtifact.title}`
        : unresolvedWarnings.length > 0
          ? `Warning active: ${unresolvedWarnings[unresolvedWarnings.length - 1].content}`
          : unresolvedQuestions.length > 0
            ? `Open question: ${unresolvedQuestions[unresolvedQuestions.length - 1].content}`
            : latestActivity
              ? `Recent change: ${latestActivity.title}`
              : 'No recent project change recorded.';

  const unresolvedSignal = blockedCommitment
    ? `Commitment blocked: ${blockedCommitment.title}`
    : lowConfidenceCommitment
      ? `Commitment at risk: ${lowConfidenceCommitment.title} (Low Operator Confidence)`
      : blockedArtifact
        ? `Critical block on ${blockedArtifact.title}.`
        : attentionArtifact
          ? `Needs attention: ${attentionArtifact.title}`
          : unresolvedDecisions.length > 0
            ? `Pending decision: ${unresolvedDecisions[0].title} (${unresolvedDecisions[0].decision_state})`
            : unresolvedWarnings.length > 0
              ? `${unresolvedWarnings.length} warning signal${unresolvedWarnings.length === 1 ? '' : 's'} still visible.`
              : unresolvedQuestions.length > 0
                ? `${unresolvedQuestions.length} unresolved question${unresolvedQuestions.length === 1 ? '' : 's'} still visible.`
                : 'No unresolved warning or question currently surfaced.';

  const latestArtifactLabel = latestArtifact
    ? `${latestArtifact.title}${latestArtifact.review_state ? ` (${getArtifactReviewStateLabel(latestArtifact.review_state)})` : ''}`
    : 'No evidence item attached yet.';

  const returnFocus = blockedCommitment
    ? `Return focus: unblock commitment ${blockedCommitment.title}${blockedCommitment.blocker_note ? ` - ${blockedCommitment.blocker_note}` : ''}`
    : lowConfidenceCommitment
      ? `Return focus: resolve constraints on ${lowConfidenceCommitment.title}${lowConfidenceCommitment.constraints ? ` - ${lowConfidenceCommitment.constraints}` : ''}`
      : activeCommitment
        ? `Active Commitment: ${activeCommitment.title} -> ${activeCommitment.next_action}`
        : latestAcceptedDecision
          ? `Accepted Decision: ${latestAcceptedDecision.title} - ${latestAcceptedDecision.rationale}`
          : project.next_step?.trim()
            ? `Return focus: ${project.next_step.trim()}`
            : latestCompletedCommitment
              ? `Recent completion: ${latestCompletedCommitment.title}`
              : latestArtifact
                ? `Return focus: review ${latestArtifact.title}`
                : 'Return focus: define the next step for this project.';

  return {
    topSignal,
    unresolvedSignal,
    latestArtifact: latestArtifactLabel,
    returnFocus
  };
}

function deriveProjectMemory(
  project: Project | null,
  latestReflection?: PeerReflection | null,
  runtime?: ReturnType<typeof getRuntimeCondition> | null
): DerivedProjectMemory {
  if (!project) {
    return {
      rememberedContext: 'No project selected.',
      currentDirection: 'No current direction available.',
      openQuestion: 'No open question available.',
      criticalReviewSignal: 'No review signal available.',
      recentDecision: 'No recent decision available.'
    };
  }

  const artifacts = project.artifacts || [];
  const decisions = project.decisions || [];
  const commitments = project.commitments || [];
  const warningMessages = project.messages.filter((message) => message.tag === 'warning');
  const questionMessages = project.messages.filter((message) => message.tag === 'question');
  const blockedArtifact = artifacts.find((artifact) => artifact.review_signal === 'blocked');
  const attentionArtifact = artifacts.find((artifact) => artifact.review_signal === 'needs_attention');
  const blockedCommitment = commitments.find((commitment) => commitment.commitment_state === 'blocked');
  const lowConfidenceCommitment = commitments.find((commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low');
  const activeCommitment = commitments.find((commitment) => commitment.commitment_state === 'active');
  const latestAcceptedDecision = [...decisions].reverse().find((decision) => decision.decision_state === 'accepted');
  const latestMeaningfulActivity = [...(project.activity || [])]
    .reverse()
    .find((activity) => activity.kind !== 'project_created');

  let rememberedContext = project.pinned_note?.trim()
    ? project.pinned_note.trim()
    : project.description?.trim()
      ? project.description.trim()
      : `Project sits in the ${project.category} lane.`;

  if (latestReflection) {
    rememberedContext = `${rememberedContext} (Supporting cue: ${latestReflection.agent} recently reflected: "${latestReflection.content}")`;
  }

  if (runtime && (runtime.label === 'Stale' || runtime.label === 'Degraded' || runtime.label === 'Unavailable')) {
    rememberedContext = `${rememberedContext} (Bellows Runtime: ${runtime.detail})`;
  }

  const currentDirection = activeCommitment
    ? `${activeCommitment.title} -> ${activeCommitment.next_action}`
    : project.next_step?.trim()
      ? project.next_step.trim()
      : 'No current direction has been recorded yet.';

  const openQuestion = blockedCommitment
    ? `${blockedCommitment.title}${blockedCommitment.blocker_note ? ` - ${blockedCommitment.blocker_note}` : ''}`
    : lowConfidenceCommitment
      ? `At Risk: ${lowConfidenceCommitment.title} (Low Confidence)${lowConfidenceCommitment.constraints ? ` - ${lowConfidenceCommitment.constraints}` : ''}`
      : questionMessages.length > 0
        ? questionMessages[questionMessages.length - 1].content
        : warningMessages.length > 0
          ? warningMessages[warningMessages.length - 1].content
          : 'No open question or blocker is currently surfaced.';

  const criticalReviewSignal = blockedArtifact
    ? `Blocked evidence: ${blockedArtifact.title}`
    : attentionArtifact
      ? `Needs attention: ${attentionArtifact.title}`
      : blockedCommitment
        ? `Blocked commitment: ${blockedCommitment.title}`
        : lowConfidenceCommitment
          ? `Low confidence commitment: ${lowConfidenceCommitment.title}`
          : 'No critical review signal is currently active.';

  const recentDecision = latestAcceptedDecision
    ? `${latestAcceptedDecision.title} - ${latestAcceptedDecision.rationale}`
    : latestMeaningfulActivity
      ? `${latestMeaningfulActivity.title}${latestMeaningfulActivity.detail ? ` - ${latestMeaningfulActivity.detail}` : ''}`
      : 'No recent decision or meaningful project change recorded.';

  return {
    rememberedContext,
    currentDirection,
    openQuestion,
    criticalReviewSignal,
    recentDecision
  };
}
function getStatusClasses(status: string) {
  return status === 'ACTIVE'
    ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
    : 'bg-amber-900/30 text-amber-400 border-amber-800';
}

function getTagColor(tag: MessageTag) {
  switch (tag) {
    case 'useful':
      return 'bg-emerald-900/40 text-emerald-400 border-emerald-800';
    case 'question':
      return 'bg-amber-900/40 text-amber-400 border-amber-800';
    case 'warning':
      return 'bg-red-900/40 text-red-400 border-red-800';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

function getActivityClasses(kind: ProjectActivityKind) {
  switch (kind) {
    case 'project_created':
      return 'border-sky-800 bg-sky-950/20 text-sky-300';
    case 'handoff':
      return 'border-violet-800 bg-violet-950/20 text-violet-300';
    case 'artifact_added':
    case 'artifact_update':
      return 'border-violet-900/40 bg-violet-950/10 text-violet-300';
    case 'decision':
    case 'decision_accepted':
    case 'commitment_activated':
    case 'commitment_completed':
      return 'border-emerald-900/50 bg-emerald-950/20 text-emerald-300';
    case 'decision_proposed':
    case 'commitment_proposed':
      return 'border-amber-900/50 bg-amber-950/20 text-amber-200';
    case 'decision_deferred':
      return 'border-slate-800 bg-slate-900/40 text-slate-300';
    case 'warning':
    case 'artifact_blocked':
    case 'commitment_blocked':
      return 'border-red-900/50 bg-red-950/20 text-red-200';
    case 'question':
    case 'artifact_flagged':
      return 'border-amber-900/50 bg-amber-950/20 text-amber-200';
    case 'status_update':
    case 'status':
      return 'border-slate-800 bg-slate-900/40 text-slate-300';
    case 'review_note':
    case 'artifact_review_note_updated':
      return 'border-indigo-900/50 bg-indigo-950/20 text-indigo-300';
    default:
      return 'border-slate-700 bg-slate-900/70 text-slate-300';
  }
}

function getActivityDotClasses(kind: ProjectActivityKind) {
  switch (kind) {
    case 'warning':
    case 'artifact_blocked':
      return 'bg-red-500 border-red-900';
    case 'question':
    case 'artifact_flagged':
    case 'decision_proposed':
    case 'commitment_proposed':
      return 'bg-amber-500 border-amber-900';
    case 'decision':
    case 'decision_accepted':
    case 'commitment_activated':
    case 'commitment_completed':
      return 'bg-emerald-500 border-emerald-900';
    case 'decision_deferred':
      return 'bg-slate-400 border-slate-700';
    case 'commitment_blocked':
      return 'bg-red-500 border-red-900';
    case 'status_update':
    case 'status':
      return 'bg-slate-300 border-slate-600';
    case 'artifact_review_note_updated':
    case 'review_note':
      return 'bg-indigo-500 border-indigo-900';
    default:
      return 'bg-slate-700 border-slate-900';
  }
}

function getContextEntries(project: Project) {
  if (!project.context) return [];
  return Object.entries(project.context).filter(([, value]) => value !== undefined && value !== null && value !== '');
}

function humanizeKey(key: string) {
  return key.replaceAll('_', ' ');
}

function getArtifactReviewStateClasses(reviewState: ArtifactReviewState) {
  switch (reviewState) {
    case 'reviewed':
      return 'border-emerald-800 bg-emerald-950/20 text-emerald-300';
    case 'in_review':
      return 'border-amber-800 bg-amber-950/20 text-amber-300';
    default:
      return 'border-slate-700 bg-slate-950/70 text-slate-300';
  }
}

function getArtifactReviewStateLabel(reviewState: ArtifactReviewState) {
  switch (reviewState) {
    case 'in_review':
      return 'In Review';
    case 'reviewed':
      return 'Reviewed';
    default:
      return 'Unreviewed';
  }
}

function getArtifactReviewSignalClasses(reviewSignal: ArtifactReviewSignal) {
  switch (reviewSignal) {
    case 'blocked':
      return 'border-red-800 bg-red-950/20 text-red-300';
    case 'needs_attention':
      return 'border-amber-800 bg-amber-950/20 text-amber-300';
    default:
      return 'border-emerald-800 bg-emerald-950/20 text-emerald-300';
  }
}

function getArtifactReviewSignalLabel(reviewSignal: ArtifactReviewSignal) {
  switch (reviewSignal) {
    case 'blocked':
      return 'Blocked';
    case 'needs_attention':
      return 'Needs Attention';
    default:
      return 'Clear';
  }
}

function isArtifactApproved(artifact: ProjectArtifact) {
  return artifact.review_state === 'reviewed' && (artifact.review_signal || 'clear') === 'clear';
}

function isArtifactFlagged(artifact: ProjectArtifact) {
  return artifact.review_signal === 'needs_attention' || artifact.review_signal === 'blocked';
}

function getArtifactReviewOutcomeLabel(artifact: ProjectArtifact) {
  if (artifact.review_signal === 'blocked') return 'Blocked';
  if (artifact.review_signal === 'needs_attention') return 'Flagged';
  if (isArtifactApproved(artifact)) return 'Approved';
  if (artifact.review_state === 'in_review') return 'In Review';
  return 'Needs Review';
}

function getArtifactReviewOutcomeClasses(artifact: ProjectArtifact) {
  if (artifact.review_signal === 'blocked') {
    return 'border-red-800 bg-red-950/20 text-red-300';
  }
  if (artifact.review_signal === 'needs_attention') {
    return 'border-amber-800 bg-amber-950/20 text-amber-300';
  }
  if (isArtifactApproved(artifact)) {
    return 'border-emerald-800 bg-emerald-950/20 text-emerald-300';
  }
  if (artifact.review_state === 'in_review') {
    return 'border-indigo-800 bg-indigo-950/20 text-indigo-300';
  }
  return 'border-slate-700 bg-slate-950/70 text-slate-300';
}

function getArtifactReviewOutcomeDetail(artifact: ProjectArtifact) {
  if (artifact.review_signal === 'blocked') {
    return 'This evidence is blocked for downstream use until the issue is resolved.';
  }
  if (artifact.review_signal === 'needs_attention') {
    return 'This evidence needs operator attention before it should feed a handoff.';
  }
  if (isArtifactApproved(artifact)) {
    return 'This evidence is approved for downstream review and handoff.';
  }
  if (artifact.review_state === 'in_review') {
    return 'This evidence is under review and not yet ready for downstream use.';
  }
  return 'This evidence still needs a first review pass.';
}

function getCommitmentStateClasses(commitmentState: CommitmentState) {
  switch (commitmentState) {
    case 'active':
      return 'border-emerald-800 bg-emerald-950/20 text-emerald-300';
    case 'blocked':
      return 'border-red-800 bg-red-950/20 text-red-300';
    case 'completed':
      return 'border-sky-800 bg-sky-950/20 text-sky-300';
    default:
      return 'border-amber-800 bg-amber-950/20 text-amber-300';
  }
}

function getCommitmentStateLabel(commitmentState: CommitmentState) {
  switch (commitmentState) {
    case 'active':
      return 'Active';
    case 'blocked':
      return 'Blocked';
    case 'completed':
      return 'Completed';
    default:
      return 'Proposed';
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('hearth_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const normalized = Array.isArray(parsed) ? parsed.map(normalizeProject) : DEFAULT_PROJECTS;
        setProjects(normalized);
        localStorage.setItem('hearth_projects', JSON.stringify(normalized));
      } catch {
        setProjects(DEFAULT_PROJECTS);
      }
    } else {
      setProjects(DEFAULT_PROJECTS);
      localStorage.setItem('hearth_projects', JSON.stringify(DEFAULT_PROJECTS));
    }
  }, []);

  const saveProjects = (newProjects: Project[]) => {
    setProjects(newProjects);
    localStorage.setItem('hearth_projects', JSON.stringify(newProjects));
  };

  const addProject = (project: Omit<Project, 'id' | 'updated_at' | 'messages' | 'activity'>) => {
    const createdAt = nowIso();
      const newProject: Project = {
        ...project,
        id: `proj_${Date.now()}`,
        updated_at: createdAt,
        messages: [],
        artifacts: project.artifacts || [],
        decisions: project.decisions || [],
        commitments: project.commitments || [],
        capture_items: project.capture_items || [],
        review_packets: project.review_packets || [],
        activity: [
        {
          id: `activity_${Date.now()}`,
          kind: 'project_created',
          title: 'Project created',
          detail: 'Project was initialized from the community workspace.',
          timestamp: createdAt
        }
      ]
    };
    saveProjects([newProject, ...projects]);
    return newProject.id;
  };

  const addMessage = (projectId: string, content: string, tag: MessageTag) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        updated_at: timestamp,
        messages: [...project.messages, { id: `m_${Date.now()}`, content, tag, timestamp }]
      };
    });
    saveProjects(updated);
  };
  const updateNextStep = (projectId: string, nextStep: string) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        updated_at: timestamp,
        next_step: nextStep,
        activity: [
          ...project.activity || [],
          {
            id: `act_${Date.now()}`,
            kind: 'status' as const,
            title: 'Next step updated',
            detail: `Next step set to: ${nextStep}`,
            timestamp
          }
        ]
      };
    });
    saveProjects(updated);
  };

  const updateArtifactReviewState = (projectId: string, artifactId: string, reviewState: ArtifactReviewState) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentArtifact = project.artifacts?.find((artifact) => artifact.id === artifactId);
      if (!currentArtifact || currentArtifact.review_state === reviewState) {
        return project;
      }

      const activityTitle =
        reviewState === 'in_review'
          ? 'Artifact review started'
          : reviewState === 'reviewed'
            ? 'Artifact marked reviewed'
            : 'Artifact review reset';

      return {
        ...project,
        updated_at: timestamp,
        artifacts: (project.artifacts || []).map((artifact) =>
          artifact.id === artifactId ? { ...artifact, review_state: reviewState } : artifact
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status' as const,
            title: activityTitle,
            detail: `${currentArtifact.title} is now ${getArtifactReviewStateLabel(reviewState)}.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const updateArtifactReviewSignal = (projectId: string, artifactId: string, reviewSignal: ArtifactReviewSignal) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentArtifact = project.artifacts?.find((artifact) => artifact.id === artifactId);
      if (!currentArtifact || currentArtifact.review_signal === reviewSignal) {
        return project;
      }

      // Determine activity details
      let title = '';
      let kind: ProjectActivityKind = 'status';

      switch (reviewSignal) {
        case 'clear':
          title = `Artifact review signal cleared`;
          break;
        case 'needs_attention':
          title = `Artifact flagged for attention`;
          kind = 'artifact_flagged';
          break;
        case 'blocked':
          title = `Artifact marked blocked`;
          kind = 'artifact_blocked';
          break;
      }

      return {
        ...project,
        updated_at: timestamp,
        artifacts: (project.artifacts || []).map((artifact) =>
          artifact.id === artifactId ? { ...artifact, review_signal: reviewSignal } : artifact
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind,
            title,
            detail: `${currentArtifact.title} review signal set to ${reviewSignal.toUpperCase()}.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const updateArtifactReviewNote = (projectId: string, artifactId: string, reviewNote: string) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentArtifact = project.artifacts?.find((artifact) => artifact.id === artifactId);
      if (!currentArtifact || currentArtifact.review_note === reviewNote) {
        return project;
      }

      return {
        ...project,
        updated_at: timestamp,
        artifacts: (project.artifacts || []).map((artifact) =>
          artifact.id === artifactId ? { ...artifact, review_note: reviewNote } : artifact
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'artifact_review_note_updated' as const,
            title: `Artifact review note updated`,
            detail: `${currentArtifact.title}: "${reviewNote}"`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const addStructuredUpdate = (
    projectId: string,
    type: StructuredUpdateType,
    content: string,
    artifactId?: string
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const associatedArtifact = project.artifacts?.find((a) => a.id === artifactId);

      // Determine activity details
      let title = '';
      let msgTag: MessageTag = 'none';

      switch (type) {
        case 'status_update':
          title = 'Status updated';
          break;
        case 'review_note':
          title = associatedArtifact ? `Review note added for ${associatedArtifact.title}` : 'Review note added';
          break;
        case 'artifact_update':
          title = associatedArtifact ? `Artifact update: ${associatedArtifact.title}` : 'Artifact update recorded';
          break;
        case 'decision':
          title = 'Decision recorded';
          msgTag = 'useful';
          break;
        case 'question':
          title = 'Question logged';
          msgTag = 'question';
          break;
        case 'warning':
          title = 'Warning logged';
          msgTag = 'warning';
          break;
      }

      const newActivityItem: ProjectActivity = {
        id: `act_${Date.now()}`,
        kind: type as ProjectActivityKind,
        title,
        detail: content,
        timestamp
      };

      // Also preserve in messages for discussion where useful
      const shouldAddToMessages = ['decision', 'question', 'warning', 'review_note'].includes(type);
      const newMessages = shouldAddToMessages
        ? [
            ...project.messages,
            {
              id: `m_${Date.now()}`,
              content: associatedArtifact ? `[Regarding: ${associatedArtifact.title}] ${content}` : content,
              tag: msgTag,
              timestamp
            }
          ]
        : project.messages;

      return {
        ...project,
        updated_at: timestamp,
        messages: newMessages,
        activity: [...(project.activity || []), newActivityItem]
      };
    });

    saveProjects(updated);
  };

  const addProjectDecision = (
    projectId: string,
    title: string,
    rationale: string,
    decisionState: DecisionState,
    artifactId?: string,
    impactNote?: string,
    signedBy?: string,
    signature?: string
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const newDecision: ProjectDecision = {
        id: `dec_${Date.now()}`,
        timestamp,
        title,
        rationale,
        decision_state: decisionState,
        artifact_id: artifactId || undefined,
        impact_note: impactNote || undefined,
        signed_by: signedBy,
        signature: signature
      };

      // Determine activity kind
      let kind: ProjectActivityKind = 'decision';
      if (decisionState === 'proposed') kind = 'decision_proposed';
      if (decisionState === 'accepted') kind = 'decision_accepted';
      if (decisionState === 'deferred') kind = 'decision_deferred';

      const activityTitle = `Decision ${decisionState}: ${title}`;
      const associatedArtifact = project.artifacts?.find((a) => a.id === artifactId);
      const activityDetail = `${rationale}${associatedArtifact ? ` (Associated with artifact: ${associatedArtifact.title})` : ''}`;

      return {
        ...project,
        updated_at: timestamp,
        decisions: [...(project.decisions || []), newDecision],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind,
            title: activityTitle,
            detail: activityDetail,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const addProjectCommitment = (
    projectId: string,
    commitment: Omit<ProjectCommitment, 'id' | 'timestamp'>
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const newCommitment: ProjectCommitment = {
        ...commitment,
        id: `commitment_${Date.now()}`,
        timestamp
      };

      let kind: ProjectActivityKind = 'commitment_proposed';
      let title = `Commitment proposed: ${commitment.title}`;
      if (commitment.commitment_state === 'active') {
        kind = 'commitment_activated';
        title = `Commitment activated: ${commitment.title}`;
      } else if (commitment.commitment_state === 'blocked') {
        kind = 'commitment_blocked';
        title = `Commitment blocked: ${commitment.title}`;
      } else if (commitment.commitment_state === 'completed') {
        kind = 'commitment_completed';
        title = `Commitment completed: ${commitment.title}`;
      }

      const linkedArtifact = project.artifacts?.find((artifact) => artifact.id === commitment.artifact_id);
      const linkedDecision = project.decisions?.find((decision) => decision.id === commitment.decision_id);
      const detailParts = [
        commitment.rationale,
        commitment.next_action ? `Next Action: ${commitment.next_action}` : '',
        commitment.done_when ? `Done When: ${commitment.done_when}` : '',
        commitment.blocker_note ? `Blocker: ${commitment.blocker_note}` : '',
        commitment.confidence ? `Confidence: ${commitment.confidence.toUpperCase()}` : '',
        commitment.work_package ? `Package: ${commitment.work_package}` : '',
        commitment.constraints ? `Constraints: ${commitment.constraints}` : '',
        linkedArtifact ? `Artifact: ${linkedArtifact.title}` : '',
        linkedDecision ? `Decision: ${linkedDecision.title}` : ''
      ].filter(Boolean);

      return {
        ...project,
        updated_at: timestamp,
        commitments: [...(project.commitments || []), newCommitment],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind,
            title,
            detail: detailParts.join(' | '),
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const updateCommitmentState = (projectId: string, commitmentId: string, commitmentState: CommitmentState) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentCommitment = project.commitments?.find((commitment) => commitment.id === commitmentId);
      if (!currentCommitment || currentCommitment.commitment_state === commitmentState) {
        return project;
      }

      let kind: ProjectActivityKind = 'commitment_proposed';
      let title = `Commitment proposed: ${currentCommitment.title}`;
      if (commitmentState === 'active') {
        kind = 'commitment_activated';
        title = `Commitment activated: ${currentCommitment.title}`;
      } else if (commitmentState === 'blocked') {
        kind = 'commitment_blocked';
        title = `Commitment blocked: ${currentCommitment.title}`;
      } else if (commitmentState === 'completed') {
        kind = 'commitment_completed';
        title = `Commitment completed: ${currentCommitment.title}`;
      }

      return {
        ...project,
        updated_at: timestamp,
        commitments: (project.commitments || []).map((commitment) =>
          commitment.id === commitmentId
            ? { ...commitment, commitment_state: commitmentState, timestamp }
            : commitment
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind,
            title,
            detail: `${currentCommitment.title} is now ${getCommitmentStateLabel(commitmentState)}.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const addProjectArtifact = (
    projectId: string,
    artifact: Omit<ProjectArtifact, 'id' | 'timestamp'>
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const newArtifact: ProjectArtifact = {
        ...artifact,
        id: `artifact_${Date.now()}`,
        timestamp
      };

      return {
        ...project,
        updated_at: timestamp,
        artifacts: [...(project.artifacts || []), newArtifact],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'artifact_added' as const,
            title: `Artifact added`,
            detail: `${newArtifact.title} added to the project record.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const addProjectCaptureItem = (
    projectId: string,
    capture: Omit<ProjectCaptureItem, 'id' | 'created_at' | 'capture_state'>
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const newCapture: ProjectCaptureItem = {
        ...capture,
        id: `capture_${Date.now()}`,
        created_at: timestamp,
        capture_state: 'inbox'
      };

      return {
        ...project,
        updated_at: timestamp,
        capture_items: [newCapture, ...(project.capture_items || [])],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title: 'Inbox item captured',
            detail: `${newCapture.title} added to capture inbox.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const updateProjectCaptureState = (
    projectId: string,
    captureId: string,
    captureState: ProjectCaptureState,
    detail?: string
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentCapture = project.capture_items?.find((capture) => capture.id === captureId);
      if (!currentCapture || currentCapture.capture_state === captureState) {
        return project;
      }

      let title = 'Inbox item updated';
      if (captureState === 'promoted') title = 'Inbox item promoted';
      if (captureState === 'dismissed') title = 'Inbox item dismissed';

      return {
        ...project,
        updated_at: timestamp,
        capture_items: (project.capture_items || []).map((capture) =>
          capture.id === captureId ? { ...capture, capture_state: captureState } : capture
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title,
            detail: detail || `${currentCapture.title} moved to ${captureState}.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const promoteCapture = (
    projectId: string,
    captureId: string,
    targetType: 'artifact' | 'decision' | 'commitment' | 'context',
    metadata: {
      signedBy: string;
      signature: string;
      artifactType?: string;
      artifactTitle?: string;
      artifactSummary?: string;
      decisionTitle?: string;
      decisionRationale?: string;
      decisionState?: DecisionState;
      decisionImpact?: string;
      commitmentTitle?: string;
      commitmentRationale?: string;
      commitmentNextAction?: string;
      commitmentDoneWhen?: string;
      commitmentState?: CommitmentState;
      commitmentConfidence?: 'high' | 'medium' | 'low';
      commitmentBlockerNote?: string;
      commitmentWorkPackage?: string;
      commitmentConstraints?: string;
      contextTitle?: string;
      contextBody?: string;
      contextType?: ProjectContextType;
    }
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentCapture = project.capture_items?.find((capture) => capture.id === captureId);
      if (!currentCapture || currentCapture.capture_state !== 'inbox') {
        return project;
      }

      let updatedProject = { ...project };

      if (targetType === 'artifact') {
        const newArtifact: ProjectArtifact = {
          id: `artifact_${Date.now()}`,
          type: metadata.artifactType || currentCapture.capture_type,
          title: metadata.artifactTitle || currentCapture.title,
          summary: metadata.artifactSummary || currentCapture.note || currentCapture.content,
          source_lane: 'projects',
          review_state: 'unreviewed',
          review_signal: 'clear',
          review_note: currentCapture.note,
          signed_by: metadata.signedBy,
          signature: metadata.signature,
          timestamp
        };
        updatedProject.artifacts = [...(project.artifacts || []), newArtifact];
        updatedProject.activity = [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'artifact_added' as const,
            title: 'Artifact Promoted (Signed)',
            detail: `${newArtifact.title} promoted from capture, signed by ${metadata.signedBy}.`,
            timestamp
          }
        ];
      } else if (targetType === 'decision') {
        const newDecision: ProjectDecision = {
          id: `dec_${Date.now()}`,
          timestamp,
          title: metadata.decisionTitle || currentCapture.title,
          rationale: metadata.decisionRationale || currentCapture.content,
          decision_state: metadata.decisionState || 'accepted',
          impact_note: metadata.decisionImpact || undefined,
          signed_by: metadata.signedBy,
          signature: metadata.signature
        };
        updatedProject.decisions = [...(project.decisions || []), newDecision];
        updatedProject.activity = [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: (metadata.decisionState === 'accepted' ? 'decision_accepted' : 'decision_proposed') as ProjectActivityKind,
            title: `Decision Promoted & ${metadata.decisionState || 'accepted'} (Signed)`,
            detail: `${newDecision.title} promoted from capture, signed by ${metadata.signedBy}.`,
            timestamp
          }
        ];
      } else if (targetType === 'commitment') {
        const newCommitment: ProjectCommitment = {
          id: `commitment_${Date.now()}`,
          title: metadata.commitmentTitle || currentCapture.title,
          timestamp,
          commitment_state: metadata.commitmentState || 'active',
          rationale: metadata.commitmentRationale || currentCapture.content,
          next_action: metadata.commitmentNextAction || '',
          done_when: metadata.commitmentDoneWhen || '',
          confidence: metadata.commitmentConfidence || 'medium',
          blocker_note: metadata.commitmentBlockerNote || undefined,
          work_package: metadata.commitmentWorkPackage || undefined,
          constraints: metadata.commitmentConstraints || undefined,
          signed_by: metadata.signedBy,
          signature: metadata.signature
        };
        updatedProject.commitments = [...(project.commitments || []), newCommitment];
        updatedProject.activity = [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: (metadata.commitmentState === 'active' ? 'commitment_activated' : 'commitment_proposed') as ProjectActivityKind,
            title: `Commitment Promoted & ${metadata.commitmentState || 'activated'} (Signed)`,
            detail: `${newCommitment.title} promoted from capture, signed by ${metadata.signedBy}.`,
            timestamp
          }
        ];
      } else if (targetType === 'context') {
        const newContextItem: ProjectContextItem = {
          id: `context_${Date.now()}`,
          project_id: projectId,
          title: metadata.contextTitle || currentCapture.title,
          body: metadata.contextBody || currentCapture.note || currentCapture.content,
          context_type: metadata.contextType || 'working_note',
          context_state: 'proposed',
          created_at: timestamp,
          updated_at: timestamp,
          actor_type: 'operator',
          actor_name: metadata.signedBy,
          source_type: 'capture',
          source_id: captureId,
          evidence_ids: [captureId]
        };
        updatedProject.context_items = [...(project.context_items || []), newContextItem];
        updatedProject.activity = [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title: `Capture Promoted to Context Proposal`,
            detail: `"${newContextItem.title}" proposed as context item, carrying capture evidence.`,
            timestamp
          }
        ];
      }

      updatedProject.capture_items = (project.capture_items || []).map((capture) =>
        capture.id === captureId ? { ...capture, capture_state: 'promoted' as const } : capture
      );
      updatedProject.updated_at = timestamp;

      return updatedProject;
    });

    saveProjects(updated);
  };

  const promoteCaptureToArtifact = (projectId: string, captureId: string) => {
    promoteCapture(projectId, captureId, 'artifact', {
      signedBy: 'System',
      signature: 'auto-signed'
    });
  };

  const saveProjectReviewPacket = (projectId: string, packet: Omit<ProjectReviewPacket, 'id' | 'timestamp'>) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const newPacket: ProjectReviewPacket = {
        ...packet,
        id: `review_packet_${Date.now()}`,
        timestamp
      };

      const signerDetail = packet.signer_handle ? ` signed by ${packet.signer_handle}` : '';
      const whyDetail = packet.why_it_changed ? `. Context: "${packet.why_it_changed}"` : '';

      return {
        ...project,
        updated_at: timestamp,
        review_packets: [newPacket, ...(project.review_packets || [])],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'handoff' as const,
            title: 'Handoff checkpoint saved',
            detail: `${newPacket.title} saved as the latest review packet baseline${signerDetail}${whyDetail}.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  const addProjectContextItem = (
    projectId: string,
    item: Omit<ProjectContextItem, 'id' | 'created_at' | 'updated_at'>
  ) => {
    const timestamp = nowIso();
    const newItem: ProjectContextItem = {
      ...item,
      id: `context_${Date.now()}`,
      created_at: timestamp,
      updated_at: timestamp
    };
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        updated_at: timestamp,
        context_items: [...(project.context_items || []), newItem],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title: `Context Item Proposed: ${newItem.title}`,
            detail: `Type: ${newItem.context_type}, Actor: ${newItem.actor_name || newItem.actor_type}`,
            timestamp
          }
        ]
      };
    });
    saveProjects(updated);
    return newItem.id;
  };

  const updateProjectContextState = (
    projectId: string,
    itemId: string,
    newState: ProjectContextState,
    reviewNote?: string,
    signedBy?: string,
    signature?: string,
    supersedesId?: string
  ) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      let targetTitle = '';
      const updatedContextItems = (project.context_items || []).map((cItem) => {
        if (cItem.id !== itemId) return cItem;
        targetTitle = cItem.title;
        return {
          ...cItem,
          context_state: newState,
          review_note: reviewNote !== undefined ? reviewNote : cItem.review_note,
          reviewed_at: timestamp,
          updated_at: timestamp,
          signed_by: signedBy || cItem.signed_by,
          signature: signature || cItem.signature,
          supersedes_id: supersedesId || cItem.supersedes_id
        };
      });
      return {
        ...project,
        updated_at: timestamp,
        context_items: updatedContextItems,
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status' as const,
            title: `Context Item: ${targetTitle} -> ${newState}`,
            detail: `State changed to ${newState}.${reviewNote ? ` Note: "${reviewNote}"` : ''}${signedBy ? ` Signed by ${signedBy}.` : ''}`,
            timestamp
          }
        ]
      };
    });
    saveProjects(updated);
  };

  const supersedeProjectContext = (
    projectId: string,
    oldItemId: string,
    replacement: Omit<ProjectContextItem, 'id' | 'project_id' | 'context_state' | 'created_at' | 'updated_at' | 'supersedes_id'>,
    reviewNote?: string,
    signedBy?: string,
    signature?: string
  ) => {
    const timestamp = nowIso();
    const replacementId = `context_${Date.now()}`;
    const newCItem: ProjectContextItem = {
      ...replacement,
      id: replacementId,
      project_id: projectId,
      context_state: 'accepted',
      created_at: timestamp,
      updated_at: timestamp,
      supersedes_id: oldItemId,
      signed_by: signedBy,
      signature: signature
    };

    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      let oldTitle = '';
      const updatedContextItems = (project.context_items || []).map((cItem) => {
        if (cItem.id !== oldItemId) return cItem;
        oldTitle = cItem.title;
        return {
          ...cItem,
          context_state: 'superseded' as const,
          review_note: reviewNote || `Superseded by: ${replacement.title}`,
          reviewed_at: timestamp,
          updated_at: timestamp
        };
      });
      return {
        ...project,
        updated_at: timestamp,
        context_items: [...updatedContextItems, newCItem],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status' as const,
            title: `Context Superseded: ${oldTitle}`,
            detail: `Superseded by new context: "${newCItem.title}". Signed by ${signedBy || 'operator'}.`,
            timestamp
          }
        ]
      };
    });
    saveProjects(updated);
    return replacementId;
  };

  const promoteDecisionToContext = (projectId: string, decisionId: string, contextType: ProjectContextType) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;
      const decision = project.decisions?.find((d) => d.id === decisionId);
      if (!decision) return project;

      const newContextItem: ProjectContextItem = {
        id: `context_${Date.now()}`,
        project_id: projectId,
        title: `Decision: ${decision.title}`,
        body: decision.rationale,
        context_type: contextType,
        context_state: 'proposed',
        created_at: timestamp,
        updated_at: timestamp,
        actor_type: 'operator',
        actor_name: decision.signed_by || 'operator',
        source_type: 'decision',
        source_id: decisionId,
        evidence_ids: decision.artifact_id ? [decision.artifact_id] : []
      };

      return {
        ...project,
        updated_at: timestamp,
        context_items: [...(project.context_items || []), newContextItem],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title: `Decision Promoted to Context Proposal`,
            detail: `Proposed context item "${newContextItem.title}" from decision ${decision.title}.`,
            timestamp
          }
        ]
      };
    });
    saveProjects(updated);
  };

  const applyProjectTemplate = (projectId: string, templateKey: ProjectTemplateKey) => {
    const timestamp = nowIso();
    const seed = createProjectTemplateSeed(templateKey);
    const template = PROJECT_TEMPLATES[templateKey];

    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      return {
        ...project,
        updated_at: timestamp,
        category: project.category || seed.category,
        next_step: project.next_step?.trim() ? project.next_step : seed.next_step,
        artifacts: [...(project.artifacts || []), ...seed.artifacts],
        decisions: [...(project.decisions || []), ...seed.decisions],
        commitments: [...(project.commitments || []), ...seed.commitments],
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'status_update' as const,
            title: 'Project template applied',
            detail: `${template.label} seeded the project with starter evidence, a draft decision, and an active commitment.`,
            timestamp
          }
        ]
      };
    });

    saveProjects(updated);
  };

  return { 
    projects, 
    addProject, 
    addMessage, 
    updateNextStep, 
    updateArtifactReviewState, 
    updateArtifactReviewSignal,
    updateArtifactReviewNote,
    addStructuredUpdate,
    addProjectDecision,
    addProjectCommitment,
    updateCommitmentState,
    addProjectArtifact,
    addProjectCaptureItem,
    updateProjectCaptureState,
    promoteCapture,
    promoteCaptureToArtifact,
    saveProjectReviewPacket,
    applyProjectTemplate,
    addProjectContextItem,
    updateProjectContextState,
    supersedeProjectContext,
    promoteDecisionToContext
  };
}

export default function ProjectsPage() {
  const { 
    projects, 
    addProject, 
    updateNextStep, 
    updateArtifactReviewState, 
    updateArtifactReviewSignal,
    updateArtifactReviewNote,
    addStructuredUpdate,
    addProjectDecision,
    addProjectCommitment,
    updateCommitmentState,
    addProjectArtifact,
    addProjectCaptureItem,
    updateProjectCaptureState,
    promoteCapture,
    saveProjectReviewPacket,
    applyProjectTemplate,
    addProjectContextItem,
    updateProjectContextState,
    supersedeProjectContext,
    promoteDecisionToContext
  } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [commitmentFocusFilter, setCommitmentFocusFilter] = useState<'all' | 'active' | 'blocked' | 'at_risk' | 'completed'>('all');
  const [reflections, setReflections] = useState<PeerReflection[]>([]);
  const [bellowsState, setBellowsState] = useState<BellowsStateSnapshot | null>(null);
  const [bellowsStateError, setBellowsStateError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<ProjectAuthState>({ status: 'checking', user: null, error: null });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [hostedRooms, setHostedRooms] = useState<CloudProjectRoom[]>([]);
  const [hostedRoomError, setHostedRoomError] = useState<string | null>(null);
  const [cloudActionMessage, setCloudActionMessage] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRoomRole, 'owner'>>('reviewer');
  const [roomInvites, setRoomInvites] = useState<ProjectRoomInvite[]>([]);
  const [roomComments, setRoomComments] = useState<ProjectRoomComment[]>([]);
  const [roomEvents, setRoomEvents] = useState<ProjectRoomEvent[]>([]);
  const [roomCommentBody, setRoomCommentBody] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [lastPublishedHandoffUrl, setLastPublishedHandoffUrl] = useState('');
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [invitePreview, setInvitePreview] = useState<ProjectInvitePreview | null>(null);
  const [inviteStatusMessage, setInviteStatusMessage] = useState('');
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);

  useEffect(() => {
    fetch('/__hearth/hearth_data')
      .then((res) => res.json())
      .then((data) => {
        setBellowsState(data as BellowsStateSnapshot);
        if (data && Array.isArray(data.reflections)) {
          setReflections(data.reflections);
        }
        setBellowsStateError(null);
      })
      .catch(() => {
        setBellowsState(null);
        setBellowsStateError('Bellows details are unavailable right now.');
      });
  }, []);

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
      window.setTimeout(() => {
        setHostedRooms([]);
        setHostedRoomError(null);
      }, 0);
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
    if (!inviteToken) return;
    let cancelled = false;
    setInviteStatusMessage('Loading project invite...');
    fetchProjectInviteByToken(inviteToken)
      .then((result) => {
        if (cancelled) return;
        setInvitePreview(result.value || null);
        setInviteStatusMessage(result.ok ? '' : result.error || 'This project invite is unavailable.');
      })
      .catch((error) => {
        if (!cancelled) setInviteStatusMessage(error instanceof Error ? error.message : 'This project invite is unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);
  const [newMessage, setNewMessage] = useState('');
  const [updateType, setUpdateType] = useState<StructuredUpdateType>('status_update');
  const [associatedArtifactId, setAssociatedArtifactId] = useState<string>('');
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionState, setDecisionState] = useState<DecisionState>('accepted');
  const [decisionImpact, setDecisionImpact] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('desk');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('operations');
  const [newPinned, setNewPinned] = useState('');
  const [newNextStep, setNewNextStep] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState<ProjectTemplateKey | 'blank'>('blank');
  const [editingNextStep, setEditingNextStep] = useState(false);
  const [activeNextStepInput, setActiveNextStepInput] = useState('');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [localReviewNote, setLocalReviewNote] = useState('');
  const [isCreatingCommitment, setIsCreatingCommitment] = useState(false);
  const [commitmentTitle, setCommitmentTitle] = useState('');
  const [commitmentRationale, setCommitmentRationale] = useState('');
  const [commitmentNextAction, setCommitmentNextAction] = useState('');
  const [commitmentDoneWhen, setCommitmentDoneWhen] = useState('');
  const [commitmentState, setCommitmentState] = useState<CommitmentState>('active');
  const [commitmentBlockerNote, setCommitmentBlockerNote] = useState('');
  const [commitmentArtifactId, setCommitmentArtifactId] = useState('');
  const [commitmentDecisionId, setCommitmentDecisionId] = useState('');
  const [commitmentConfidence, setCommitmentConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [commitmentWorkPackage, setCommitmentWorkPackage] = useState('');
  const [commitmentConstraints, setCommitmentConstraints] = useState('');
  const [captureType, setCaptureType] = useState<ProjectCaptureType>('text_note');
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureContent, setCaptureContent] = useState('');
  const [captureNote, setCaptureNote] = useState('');
  const [selectedFrameId, setSelectedFrameId] = useState<ProjectRoomFrame['id'] | null>('next_moves');
  const [selectedRoomObjectId, setSelectedRoomObjectId] = useState<string | null>(null);
  const nextActionCardRef = useRef<HTMLDivElement | null>(null);

  // Vessel members for human-in-the-loop signing
  const [vesselMembers, setVesselMembers] = useState<string[]>(['Malaky', 'Agentic Knights of Chivalry', 'Builder-01']);
  useEffect(() => {
    fetch('/vessel_members.json')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.members)) {
          const handles = data.members.map((m: any) => m.handle);
          setVesselMembers(handles);
        }
      })
      .catch((err) => {
        console.error('Failed to load vessel members:', err);
      });
  }, []);

  // Inline Capture Promotion States
  const [promotingCaptureId, setPromotingCaptureId] = useState<string | null>(null);
  const [promotingTargetType, setPromotingTargetType] = useState<'artifact' | 'decision' | 'commitment' | 'context' | null>(null);
  const [promotingSigner, setPromotingSigner] = useState<string>('Malaky');
  const [promotingArtifactType, setPromotingArtifactType] = useState<string>('text_note');
  const [promotingArtifactTitle, setPromotingArtifactTitle] = useState<string>('');
  const [promotingArtifactSummary, setPromotingArtifactSummary] = useState<string>('');
  const [promotingDecisionTitle, setPromotingDecisionTitle] = useState<string>('');
  const [promotingDecisionRationale, setPromotingDecisionRationale] = useState<string>('');
  const [promotingDecisionState, setPromotingDecisionState] = useState<DecisionState>('accepted');
  const [promotingDecisionImpact, setPromotingDecisionImpact] = useState<string>('');
  const [promotingCommitmentTitle, setPromotingCommitmentTitle] = useState<string>('');
  const [promotingCommitmentRationale, setPromotingCommitmentRationale] = useState<string>('');
  const [promotingCommitmentNextAction, setPromotingCommitmentNextAction] = useState<string>('');
  const [promotingCommitmentDoneWhen, setPromotingCommitmentDoneWhen] = useState<string>('');
  const [promotingCommitmentState, setPromotingCommitmentState] = useState<CommitmentState>('active');
  const [promotingCommitmentConfidence, setPromotingCommitmentConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [promotingCommitmentBlockerNote, setPromotingCommitmentBlockerNote] = useState<string>('');
  const [promotingCommitmentWorkPackage, setPromotingCommitmentWorkPackage] = useState<string>('');
  const [promotingCommitmentConstraints, setPromotingCommitmentConstraints] = useState<string>('');
  const [promotingContextTitle, setPromotingContextTitle] = useState<string>('');
  const [promotingContextBody, setPromotingContextBody] = useState<string>('');
  const [promotingContextType, setPromotingContextType] = useState<ProjectContextType>('working_note');

  // Inline Decision promotion state
  const [promotingDecisionId, setPromotingDecisionId] = useState<string | null>(null);
  const [promotingDecisionContextType, setPromotingDecisionContextType] = useState<ProjectContextType>('decision');

  // Context Curation Panel States
  const [isCreatingContext, setIsCreatingContext] = useState<boolean>(false);
  const [newContextTitle, setNewContextTitle] = useState<string>('');
  const [newContextBody, setNewContextBody] = useState<string>('');
  const [newContextType, setNewContextType] = useState<ProjectContextType>('working_note');
  const [newContextSigner, setNewContextSigner] = useState<string>('Malaky');

  const [isSupersedingItemId, setIsSupersedingItemId] = useState<string | null>(null);
  const [supersedingContextTitle, setSupersedingContextTitle] = useState<string>('');
  const [supersedingContextBody, setSupersedingContextBody] = useState<string>('');
  const [supersedingContextType, setSupersedingContextType] = useState<ProjectContextType>('working_note');
  const [supersedingReviewNote, setSupersedingReviewNote] = useState<string>('');
  const [supersedingSigner, setSupersedingSigner] = useState<string>('Malaky');

  const [activeSignerForProposalId, setActiveSignerForProposalId] = useState<Record<string, string>>({});
  const [rejectReasonForProposalId, setRejectReasonForProposalId] = useState<Record<string, string>>({});
  const [isRejectingProposalId, setIsRejectingProposalId] = useState<string | null>(null);

  // Checkpointing States
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState<boolean>(false);
  const [checkpointMessage, setCheckpointMessage] = useState<string>('');
  const [checkpointWhyItChanged, setCheckpointWhyItChanged] = useState<string>('');
  const [checkpointSigner, setCheckpointSigner] = useState<string>('Malaky');

  const isProjectMatchingFilter = useCallback((project: Project) => {
    if (commitmentFocusFilter === 'all') return true;
    const c = project.commitments || [];
    if (commitmentFocusFilter === 'active') {
      return c.some(x => x.commitment_state === 'active');
    }
    if (commitmentFocusFilter === 'blocked') {
      return c.some(x => x.commitment_state === 'blocked');
    }
    if (commitmentFocusFilter === 'at_risk') {
      return c.some(x => x.commitment_state === 'active' && x.confidence === 'low');
    }
    if (commitmentFocusFilter === 'completed') {
      return c.some(x => x.commitment_state === 'completed');
    }
    return false;
  }, [commitmentFocusFilter]);

  const displayedProjects = useMemo(() => {
    if (commitmentFocusFilter === 'all') {
      return projects;
    }
    return [...projects].sort((a, b) => {
      const matchA = isProjectMatchingFilter(a) ? 1 : 0;
      const matchB = isProjectMatchingFilter(b) ? 1 : 0;
      return matchB - matchA;
    });
  }, [projects, commitmentFocusFilter, isProjectMatchingFilter]);
  const dailyWorkQueue = useMemo(
    () =>
      projects
        .map((project) => deriveProjectDailyWorkItem(project))
        .filter((item): item is ProjectDailyWorkItem => Boolean(item))
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [projects]
  );
  const effectiveSelectedProjectId = useMemo(() => {
    if (selectedProjectId) return selectedProjectId;
    if (projects.length === 0) return null;
    const params = new URLSearchParams(window.location.search);
    const projectFromUrl = params.get('project');
    const matchingProject = projectFromUrl ? projects.find((project) => project.id === projectFromUrl) : null;
    return matchingProject?.id || dailyWorkQueue[0]?.projectId || projects[0].id;
  }, [selectedProjectId, projects, dailyWorkQueue]);
  const selectedProjectDailyWork = useMemo(
    () => dailyWorkQueue.find((item) => item.projectId === effectiveSelectedProjectId) || null,
    [dailyWorkQueue, effectiveSelectedProjectId]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === effectiveSelectedProjectId) || null,
    [projects, effectiveSelectedProjectId]
  );
  const selectedHostedRoom = useMemo(
    () =>
      selectedProject
        ? hostedRooms.find((room) => room.legacy_project_id === selectedProject.id || room.project.id === selectedProject.id || room.id === `room_${selectedProject.id}`) || null
        : null,
    [hostedRooms, selectedProject]
  );
  const selectedRoomRole: ProjectRoomRole = selectedHostedRoom && authState.status === 'signed_in' && selectedHostedRoom.owner_uid === authState.user.uid ? 'owner' : 'editor';
  const selectedRoomPermissions = useMemo(() => permissionsForRole(selectedRoomRole), [selectedRoomRole]);
  const agentSummary = useMemo(() => deriveAgentSummary(selectedProject), [selectedProject]);
  const projectRelevance = useMemo(() => deriveProjectRelevance(selectedProject), [selectedProject]);
  const latestReflection = useMemo(() => reflections[reflections.length - 1] || null, [reflections]);
  const bellowsRuntime = useMemo(() => getRuntimeCondition(bellowsState), [bellowsState]);
  const projectMemory = useMemo(
    () => deriveProjectMemory(selectedProject, latestReflection, bellowsRuntime),
    [selectedProject, latestReflection, bellowsRuntime]
  );
  const runtimeCommitmentAdvisory = useMemo(
    () => deriveRuntimeCommitmentAdvisory(selectedProject, bellowsRuntime),
    [selectedProject, bellowsRuntime]
  );
  const stewardshipJournal = useMemo(
    () => deriveStewardshipJournal(selectedProject, selectedProjectDailyWork, projectMemory),
    [selectedProject, selectedProjectDailyWork, projectMemory]
  );
  const projectBrief = useMemo(
    () =>
      deriveProjectBrief(
        selectedProject,
        projectMemory,
        projectRelevance,
        agentSummary,
        bellowsRuntime,
        runtimeCommitmentAdvisory,
        latestReflection
      ),
    [selectedProject, projectMemory, projectRelevance, agentSummary, bellowsRuntime, runtimeCommitmentAdvisory, latestReflection]
  );
  const projectRoomObjects = useMemo(
    () =>
      deriveProjectRoomObjects(
        selectedProject,
        projectBrief,
        projectMemory,
        projectRelevance,
        bellowsRuntime,
        runtimeCommitmentAdvisory,
        latestReflection
      ),
    [selectedProject, projectBrief, projectMemory, projectRelevance, bellowsRuntime, runtimeCommitmentAdvisory, latestReflection]
  );
  const selectedRoomObject = useMemo(
    () => projectRoomObjects.find((object) => object.id === selectedRoomObjectId) || projectRoomObjects[0] || null,
    [projectRoomObjects, selectedRoomObjectId]
  );
  const projectReviewQueue = useMemo(
    () => deriveProjectReviewQueue(selectedProject, projectMemory, runtimeCommitmentAdvisory),
    [selectedProject, projectMemory, runtimeCommitmentAdvisory]
  );
  const projectFrames = useMemo(
    () =>
      deriveProjectRoomFrames(
        selectedProject,
        projectRoomObjects,
        projectReviewQueue,
        projectBrief,
        projectMemory,
        bellowsRuntime,
        runtimeCommitmentAdvisory
      ),
    [
      selectedProject,
      projectRoomObjects,
      projectReviewQueue,
      projectBrief,
      projectMemory,
      bellowsRuntime,
      runtimeCommitmentAdvisory
    ]
  );
  const selectedFrame = useMemo(
    () => projectFrames.find((frame) => frame.id === selectedFrameId) || projectFrames[0] || null,
    [projectFrames, selectedFrameId]
  );
  const selectedFrameObjects = useMemo(
    () =>
      selectedFrame
        ? selectedFrame.objectIds
            .map((objectId) => projectRoomObjects.find((object) => object.id === objectId))
            .filter((object): object is ProjectRoomObject => Boolean(object))
        : [],
    [selectedFrame, projectRoomObjects]
  );
  const captureInboxItems = useMemo(
    () => (selectedProject?.capture_items || []).filter((item) => item.capture_state === 'inbox'),
    [selectedProject]
  );
  const roomContinuityLinks = useMemo(
    () =>
      deriveProjectContinuityLinks(
        selectedProject,
        selectedRoomObject,
        projectRoomObjects,
        bellowsRuntime,
        projectBrief,
        projectMemory
      ),
    [selectedProject, selectedRoomObject, projectRoomObjects, bellowsRuntime, projectBrief, projectMemory]
  );
  const selectedArtifact = useMemo(() => {
    if (!selectedProject?.artifacts?.length) return null;
    return selectedProject.artifacts.find((artifact) => artifact.id === selectedArtifactId) || selectedProject.artifacts[0];
  }, [selectedArtifactId, selectedProject]);
  const approvedArtifacts = useMemo(
    () => (selectedProject?.artifacts || []).filter((artifact) => isArtifactApproved(artifact)),
    [selectedProject]
  );
  const flaggedArtifacts = useMemo(
    () => (selectedProject?.artifacts || []).filter((artifact) => isArtifactFlagged(artifact)),
    [selectedProject]
  );
  const pendingArtifacts = useMemo(
    () =>
      (selectedProject?.artifacts || []).filter(
        (artifact) => !isArtifactApproved(artifact) && !isArtifactFlagged(artifact)
      ),
    [selectedProject]
  );
  const acceptedDecisions = useMemo(
    () => (selectedProject?.decisions || []).filter((decision) => decision.decision_state === 'accepted'),
    [selectedProject]
  );
  const activeCommitments = useMemo(
    () => (selectedProject?.commitments || []).filter((commitment) => commitment.commitment_state === 'active'),
    [selectedProject]
  );
  const blockedCommitments = useMemo(
    () => (selectedProject?.commitments || []).filter((commitment) => commitment.commitment_state === 'blocked'),
    [selectedProject]
  );
  const handoffReadiness = useMemo(() => {
    const blockers: string[] = [];
    if (approvedArtifacts.length === 0) blockers.push('No evidence has been approved yet.');
    if (selectedProject && !selectedProject.next_step?.trim()) blockers.push('Next step is still undefined.');
    if (flaggedArtifacts.length > 0) blockers.push(`${flaggedArtifacts.length} evidence item${flaggedArtifacts.length === 1 ? '' : 's'} are flagged.`);
    if (pendingArtifacts.length > 0) blockers.push(`${pendingArtifacts.length} evidence item${pendingArtifacts.length === 1 ? '' : 's'} still need review.`);
    if (blockedCommitments.length > 0) blockers.push(`${blockedCommitments.length} commitment${blockedCommitments.length === 1 ? '' : 's'} are blocked.`);
    return {
      ready: blockers.length === 0 && Boolean(selectedProject),
      blockers
    };
  }, [approvedArtifacts, selectedProject, flaggedArtifacts, pendingArtifacts, blockedCommitments]);
  const latestReviewPacket = useMemo(
    () => selectedProject?.review_packets?.[0] || null,
    [selectedProject]
  );
  const reviewPacketDelta = useMemo(
    () => deriveReviewPacketDelta(selectedProject, latestReviewPacket, handoffReadiness, stewardshipJournal),
    [selectedProject, latestReviewPacket, handoffReadiness, stewardshipJournal]
  );
  const deskNextAction = useMemo(
    () => deriveDeskNextAction(selectedProject, latestReviewPacket, handoffReadiness),
    [selectedProject, latestReviewPacket, handoffReadiness]
  );
  const rootRoomComments = useMemo(
    () => roomComments.filter((comment) => !comment.parent_comment_id),
    [roomComments]
  );
  const roomRepliesByParent = useMemo(() => {
    const grouped: Record<string, ProjectRoomComment[]> = {};
    roomComments
      .filter((comment) => Boolean(comment.parent_comment_id))
      .forEach((comment) => {
        const parentId = comment.parent_comment_id as string;
        grouped[parentId] = [...(grouped[parentId] || []), comment];
      });
    Object.keys(grouped).forEach((parentId) => {
      grouped[parentId] = grouped[parentId].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    });
    return grouped;
  }, [roomComments]);
  const roomTimeline = useMemo(() => {
    const commentRows = roomComments.map((comment) => ({
      id: `comment-${comment.id}`,
      kind: 'comment' as const,
      timestamp: comment.created_at,
      title: comment.parent_comment_id ? `${comment.author_label} replied` : `${comment.author_label} commented`,
      detail: comment.body,
      accent: comment.optimistic ? 'border-indigo-900/40 bg-indigo-950/20 text-indigo-100' : 'border-slate-800 bg-slate-950/50 text-slate-300',
    }));
    const eventRows = roomEvents
      .filter((event) => event.action !== 'comment_added')
      .map((event) => ({
        id: `event-${event.id}`,
        kind: 'event' as const,
        timestamp: event.timestamp,
        title: event.action.replace(/_/g, ' '),
        detail: event.summary,
        accent: 'border-emerald-900/30 bg-emerald-950/10 text-emerald-100',
      }));
    return [...commentRows, ...eventRows].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [roomComments, roomEvents]);
  const isEarlyProject = useMemo(() => {
    if (!selectedProject) return false;
    return (
      (selectedProject.capture_items || []).length === 0 &&
      (selectedProject.artifacts || []).length === 0 &&
      (selectedProject.decisions || []).length === 0 &&
      (selectedProject.commitments || []).length === 0
    );
  }, [selectedProject]);

  const sortedCommitments = useMemo(() => {
    if (!selectedProject?.commitments?.length) return [];
    
    const isMatching = (c: ProjectCommitment) => {
      if (commitmentFocusFilter === 'all') return true;
      if (commitmentFocusFilter === 'active') return c.commitment_state === 'active';
      if (commitmentFocusFilter === 'blocked') return c.commitment_state === 'blocked';
      if (commitmentFocusFilter === 'at_risk') return c.commitment_state === 'active' && c.confidence === 'low';
      if (commitmentFocusFilter === 'completed') return c.commitment_state === 'completed';
      return false;
    };

    const stateOrder: Record<CommitmentState, number> = {
      blocked: 0,
      active: 1,
      proposed: 2,
      completed: 3
    };

    return [...selectedProject.commitments].sort((a, b) => {
      const matchA = isMatching(a) ? 1 : 0;
      const matchB = isMatching(b) ? 1 : 0;
      if (matchA !== matchB) {
        return matchB - matchA;
      }

      const stateA = stateOrder[a.commitment_state] ?? 99;
      const stateB = stateOrder[b.commitment_state] ?? 99;
      if (stateA !== stateB) {
        return stateA - stateB;
      }

      if (commitmentFocusFilter === 'at_risk') {
        const confA = a.confidence === 'low' ? 1 : 0;
        const confB = b.confidence === 'low' ? 1 : 0;
        if (confA !== confB) return confB - confA;
      }

      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [selectedProject, commitmentFocusFilter]);

  useEffect(() => {
    if (selectedArtifact) {
      setLocalReviewNote(selectedArtifact.review_note || '');
    } else {
      setLocalReviewNote('');
    }
  }, [selectedArtifact]);

  useEffect(() => {
    if (!selectedHostedRoom || authState.status !== 'signed_in') {
      window.setTimeout(() => setRoomInvites([]), 0);
      return;
    }
    listProjectRoomInvites(selectedHostedRoom.id).then((result) => {
      if (result.ok && result.value) setRoomInvites(result.value);
    });
  }, [authState.status, selectedHostedRoom]);

  useEffect(() => {
    if (!selectedHostedRoom || authState.status !== 'signed_in') {
      window.setTimeout(() => setRoomComments([]), 0);
      return;
    }
    const unsubscribe = listenToProjectRoomComments(
      selectedHostedRoom.id,
      setRoomComments,
      (message) => setCloudActionMessage(`Comments unavailable: ${message}`),
    );
    return () => {
      unsubscribe?.();
    };
  }, [authState.status, selectedHostedRoom]);

  useEffect(() => {
    if (!selectedHostedRoom || authState.status !== 'signed_in') {
      window.setTimeout(() => setRoomEvents([]), 0);
      return;
    }
    const unsubscribe = listenToProjectRoomEvents(
      selectedHostedRoom.id,
      setRoomEvents,
      (message) => setCloudActionMessage(`Timeline unavailable: ${message}`),
    );
    return () => {
      unsubscribe?.();
    };
  }, [authState.status, selectedHostedRoom]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedFrameId(null);
      setSelectedRoomObjectId(null);
      return;
    }
    if (projectFrames.length === 0) {
      setSelectedFrameId(null);
    } else {
      const frameStillExists = projectFrames.some((frame) => frame.id === selectedFrameId);
      if (!frameStillExists) {
        setSelectedFrameId(projectFrames[0].id);
      }
    }
    if (projectRoomObjects.length === 0) {
      setSelectedRoomObjectId(null);
      return;
    }
    const roomObjectStillExists = projectRoomObjects.some((object) => object.id === selectedRoomObjectId);
    if (!roomObjectStillExists) {
      setSelectedRoomObjectId(projectRoomObjects[0].id);
      return;
    }
    if (selectedFrame && selectedFrameObjects.length > 0) {
      const objectInsideFrame = selectedFrameObjects.some((object) => object.id === selectedRoomObjectId);
      if (!objectInsideFrame) {
        setSelectedRoomObjectId(selectedFrameObjects[0].id);
      }
    }
  }, [selectedProject, projectFrames, selectedFrameId, selectedFrame, selectedFrameObjects, projectRoomObjects, selectedRoomObjectId]);

  const handlePostUpdate = () => {
    if (!effectiveSelectedProjectId || !newMessage.trim()) return;
    
    if (updateType === 'decision') {
      const titleToUse = decisionTitle.trim() || 'Untitled Choice';
      addProjectDecision(
        effectiveSelectedProjectId,
        titleToUse,
        newMessage,
        decisionState,
        associatedArtifactId || undefined,
        decisionImpact.trim() || undefined
      );
      setDecisionTitle('');
      setDecisionState('accepted');
      setDecisionImpact('');
    } else {
      addStructuredUpdate(
        effectiveSelectedProjectId,
        updateType,
        newMessage,
        associatedArtifactId || undefined
      );
    }
    
    setNewMessage('');
    setAssociatedArtifactId('');
  };

  const handleOpenDailyWorkItem = useCallback((item: ProjectDailyWorkItem) => {
    setSelectedProjectId(item.projectId);
    setProjectViewMode(item.targetView);
    if (item.artifactId) {
      setSelectedArtifactId(item.artifactId);
    }
  }, []);

  const scrollToTarget = useCallback((targetElementId?: string) => {
    if (!targetElementId) return;
    window.setTimeout(() => {
      document.getElementById(targetElementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const handleDeskNextAction = useCallback(
    (action: DeskNextAction | null) => {
      if (!action || !selectedProject) return;

      if (action.artifactId) {
        setSelectedArtifactId(action.artifactId);
      }

      if (action.actionKind === 'save_checkpoint') {
        handleSaveProjectHandoffArtifact();
        setProjectViewMode('handoff');
        scrollToTarget('project-handoff-root');
        return;
      }

      setProjectViewMode(action.targetView);
      scrollToTarget(action.targetElementId);
    },
    [selectedProject, scrollToTarget]
  );

  const handleDeskSecondaryAction = useCallback(() => {
    setProjectViewMode('handoff');
    scrollToTarget('project-handoff-root');
  }, [scrollToTarget]);

  const handleResumeDesk = useCallback(() => {
    nextActionCardRef.current?.focus();
    handleDeskNextAction(deskNextAction);
  }, [deskNextAction, handleDeskNextAction]);

  const currentUser: User | null = authState.status === 'signed_in' ? authState.user : null;

  const handleEmailAuth = async (mode: 'sign_in' | 'create') => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthMessage('Enter an email and password to continue.');
      return;
    }
    try {
      setAuthMessage(mode === 'sign_in' ? 'Signing in...' : 'Creating account...');
      if (mode === 'sign_in') {
        await signInProjectRoom(authEmail, authPassword);
      } else {
        await createProjectRoomAccount(authEmail, authPassword);
      }
      setAuthPassword('');
      setAuthMessage('');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed.');
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setAuthMessage('Opening Google sign-in...');
      await signInProjectRoomWithGoogle();
      setAuthMessage('');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Google sign-in failed.');
    }
  };

  const handleImportSelectedProject = async () => {
    if (!selectedProject || !currentUser) return;
    setCloudActionMessage('Importing selected project...');
    const result = await importLocalProjectRoom(selectedProject, currentUser);
    setCloudActionMessage(result.ok ? 'Project imported into hosted rooms.' : result.error || 'Import failed.');
  };

  const handleImportAllProjects = async () => {
    if (!currentUser) return;
    setCloudActionMessage(`Importing ${projects.length} projects...`);
    const results = await Promise.all(projects.map((project) => importLocalProjectRoom(project, currentUser)));
    const imported = results.filter((result) => result.ok).length;
    const failed = results.length - imported;
    setCloudActionMessage(failed === 0 ? `Imported ${imported} projects.` : `Imported ${imported}; ${failed} need another attempt.`);
  };

  const handleSyncSelectedProject = async () => {
    if (!selectedProject || !selectedHostedRoom || !currentUser) return;
    setCloudActionMessage('Syncing selected room...');
    const result = await syncProjectRoom(selectedProject, selectedHostedRoom.id, currentUser);
    setCloudActionMessage(result.ok ? 'Hosted room updated from this Desk.' : result.error || 'Sync failed.');
  };

  const handleCreateInvite = async () => {
    if (!selectedHostedRoom || !inviteEmail.trim() || !currentUser) return;
    const result = await createProjectRoomInvite(selectedHostedRoom.id, inviteEmail, inviteRole, currentUser);
    if (result.ok && result.value) {
      setInviteEmail('');
      setRoomInvites((current) => [result.value as ProjectRoomInvite, ...current]);
      const inviteUrl = `${window.location.origin}/projects?invite=${encodeURIComponent(result.value.token)}`;
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCloudActionMessage('Invitation link copied. Email delivery is not configured yet.');
      } catch {
        setCloudActionMessage(`Invitation created. Copy this link: ${inviteUrl}`);
      }
    } else {
      setCloudActionMessage(result.error || 'Invite creation failed.');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedHostedRoom) return;
    const result = await revokeProjectRoomInvite(selectedHostedRoom.id, inviteId);
    if (result.ok) {
      setRoomInvites((current) => current.map((invite) => (invite.id === inviteId ? { ...invite, status: 'revoked' } : invite)));
      setCloudActionMessage('Invitation revoked.');
    } else {
      setCloudActionMessage(result.error || 'Invite revoke failed.');
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || !currentUser) {
      setInviteStatusMessage('Sign in to join this project room.');
      return;
    }
    setIsAcceptingInvite(true);
    setInviteStatusMessage('Joining project room...');
    const result = await acceptProjectRoomInvite(inviteToken, currentUser);
    setIsAcceptingInvite(false);
    if (result.ok && result.value) {
      setInvitePreview({ ...result.value.invite, status: 'accepted', accepted_by: currentUser.uid, accepted_at: nowIso() });
      setInviteStatusMessage('Project room joined.');
      if (result.value.room?.project?.id) {
        setSelectedProjectId(result.value.room.project.id);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      if (result.value.room?.project?.id) {
        url.searchParams.set('project', result.value.room.project.id);
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    } else {
      setInviteStatusMessage(result.error || 'Could not join this project room.');
    }
  };

  const handlePostRoomComment = async () => {
    if (!selectedHostedRoom || !currentUser || !roomCommentBody.trim()) return;
    const optimisticId = `optimistic_${Date.now()}`;
    const optimisticComment: ProjectRoomComment = {
      id: optimisticId,
      project_id: selectedHostedRoom.id,
      parent_type: 'project',
      parent_id: selectedHostedRoom.id,
      body: roomCommentBody.trim(),
      author_uid: currentUser.uid,
      author_label: currentUser.displayName || currentUser.email || currentUser.uid,
      created_at: nowIso(),
      resolved: false,
      optimistic: true,
    };
    setRoomComments((current) => [optimisticComment, ...current]);
    const submittedBody = roomCommentBody;
    setRoomCommentBody('');
    const result = await addProjectRoomComment(selectedHostedRoom.id, 'project', selectedHostedRoom.id, submittedBody, currentUser);
    if (result.ok) {
      setRoomComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setCloudActionMessage('Comment added to the hosted room.');
    } else {
      setRoomComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setRoomCommentBody(submittedBody);
      setCloudActionMessage(result.error || 'Comment failed.');
    }
  };

  const handlePostRoomReply = async (parentComment: ProjectRoomComment) => {
    if (!selectedHostedRoom || !currentUser || !replyBody.trim()) return;
    const optimisticId = `optimistic_reply_${Date.now()}`;
    const optimisticReply: ProjectRoomComment = {
      id: optimisticId,
      project_id: selectedHostedRoom.id,
      parent_type: parentComment.parent_type,
      parent_id: parentComment.parent_id,
      parent_comment_id: parentComment.id,
      body: replyBody.trim(),
      author_uid: currentUser.uid,
      author_label: currentUser.displayName || currentUser.email || currentUser.uid,
      created_at: nowIso(),
      resolved: false,
      optimistic: true,
    };
    setRoomComments((current) => [optimisticReply, ...current]);
    const submittedBody = replyBody;
    setReplyBody('');
    setReplyingToCommentId(null);
    const result = await addProjectRoomComment(
      selectedHostedRoom.id,
      parentComment.parent_type,
      parentComment.parent_id,
      submittedBody,
      currentUser,
      parentComment.id,
    );
    if (result.ok) {
      setRoomComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setCloudActionMessage('Reply added to the hosted room.');
    } else {
      setRoomComments((current) => current.filter((comment) => comment.id !== optimisticId));
      setReplyBody(submittedBody);
      setReplyingToCommentId(parentComment.id);
      setCloudActionMessage(result.error || 'Reply failed.');
    }
  };

  const handlePublishHostedHandoff = async () => {
    if (!selectedProject || !selectedHostedRoom || !currentUser) return;
    const packet = buildProjectHandoffPacket();
    if (!packet) return;
    const result = await publishProjectHandoff(
      selectedHostedRoom.id,
      selectedProject,
      buildProjectHandoffMarkdown(),
      packet,
      currentUser,
    );
    if (result.ok && result.value) {
      const url = `${window.location.origin}/handoff/${encodeURIComponent(result.value.token)}`;
      setLastPublishedHandoffUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCloudActionMessage('Published handoff link copied.');
      } catch {
        setCloudActionMessage(`Published handoff: ${url}`);
      }
    } else {
      setCloudActionMessage(result.error || 'Publish failed.');
    }
  };

  const handleRevokeHostedHandoff = async () => {
    if (!selectedHostedRoom?.current_handoff_token || !currentUser) return;
    const result = await revokePublishedHandoff(selectedHostedRoom.id, selectedHostedRoom.current_handoff_token, currentUser);
    if (result.ok) {
      setLastPublishedHandoffUrl('');
      setCloudActionMessage('Published handoff link revoked.');
    } else {
      setCloudActionMessage(result.error || 'Revoke failed.');
    }
  };

  const resetCaptureComposer = () => {
    setCaptureType('text_note');
    setCaptureTitle('');
    setCaptureContent('');
    setCaptureNote('');
  };

  const handleAddCaptureItem = () => {
    if (!effectiveSelectedProjectId) return;

    const normalizedTitle = captureTitle.trim();
    const normalizedContent = captureContent.trim();
    const normalizedNote = captureNote.trim();

    const fallbackTitle =
      captureType === 'link'
        ? 'Reference link'
        : captureType === 'file_reference'
          ? 'File reference'
          : captureType === 'raw_snippet'
            ? 'Raw snippet'
            : 'Quick note';

    if (!normalizedTitle && !normalizedContent) return;

    addProjectCaptureItem(effectiveSelectedProjectId, {
      capture_type: captureType,
      title: normalizedTitle || fallbackTitle,
      content: normalizedContent || normalizedTitle,
      note: normalizedNote || undefined
    });

    resetCaptureComposer();
  };

  const generateSimulatedSignature = (signer: string, payload: string) => {
    let hash = 0;
    const combined = `${signer}:${payload}:${Date.now()}`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hearth_sig_2026_${Math.abs(hash).toString(16)}`;
  };

  const startPromotingCapture = (capture: ProjectCaptureItem, targetType: 'artifact' | 'decision' | 'commitment' | 'context') => {
    setPromotingCaptureId(capture.id);
    setPromotingTargetType(targetType);
    setPromotingSigner(vesselMembers[0] || 'Malaky');
    
    if (targetType === 'artifact') {
      setPromotingArtifactTitle(capture.title);
      setPromotingArtifactSummary(capture.note || capture.content);
      setPromotingArtifactType(capture.capture_type);
    } else if (targetType === 'decision') {
      setPromotingDecisionTitle(capture.title);
      setPromotingDecisionRationale(capture.content);
      setPromotingDecisionState('accepted');
      setPromotingDecisionImpact('');
    } else if (targetType === 'commitment') {
      setPromotingCommitmentTitle(capture.title);
      setPromotingCommitmentRationale(capture.content);
      setPromotingCommitmentNextAction('');
      setPromotingCommitmentDoneWhen('');
      setPromotingCommitmentState('active');
      setPromotingCommitmentConfidence('medium');
      setPromotingCommitmentBlockerNote('');
      setPromotingCommitmentWorkPackage('');
      setPromotingCommitmentConstraints('');
    } else if (targetType === 'context') {
      setPromotingContextTitle(capture.title);
      setPromotingContextBody(capture.content);
      setPromotingContextType('working_note');
    }
  };

  const handlePromoteCaptureToArtifact = (capture: ProjectCaptureItem) => {
    startPromotingCapture(capture, 'artifact');
  };

  const handlePromoteCaptureToDecisionDraft = (capture: ProjectCaptureItem) => {
    startPromotingCapture(capture, 'decision');
  };

  const handlePromoteCaptureToCommitmentDraft = (capture: ProjectCaptureItem) => {
    startPromotingCapture(capture, 'commitment');
  };

  const handlePromoteCaptureToContext = (capture: ProjectCaptureItem) => {
    startPromotingCapture(capture, 'context');
  };

  const handleConfirmSignedPromotion = (captureId: string) => {
    if (!selectedProject || !promotingTargetType) return;

    const signaturePayload = `${promotingTargetType}:${Date.now()}:${captureId}`;
    const generatedSignature = generateSimulatedSignature(promotingSigner, signaturePayload);

    promoteCapture(selectedProject.id, captureId, promotingTargetType, {
      signedBy: promotingSigner,
      signature: generatedSignature,
      artifactType: promotingArtifactType,
      artifactTitle: promotingArtifactTitle,
      artifactSummary: promotingArtifactSummary,
      decisionTitle: promotingDecisionTitle,
      decisionRationale: promotingDecisionRationale,
      decisionState: promotingDecisionState,
      decisionImpact: promotingDecisionImpact,
      commitmentTitle: promotingCommitmentTitle,
      commitmentRationale: promotingCommitmentRationale,
      commitmentNextAction: promotingCommitmentNextAction,
      commitmentDoneWhen: promotingCommitmentDoneWhen,
      commitmentState: promotingCommitmentState,
      commitmentConfidence: promotingCommitmentConfidence,
      commitmentBlockerNote: promotingCommitmentBlockerNote || undefined,
      commitmentWorkPackage: promotingCommitmentWorkPackage || undefined,
      commitmentConstraints: promotingCommitmentConstraints || undefined,
      contextTitle: promotingContextTitle,
      contextBody: promotingContextBody,
      contextType: promotingContextType
    });

    setPromotingCaptureId(null);
    setPromotingTargetType(null);
  };

  const handleDismissCaptureItem = (capture: ProjectCaptureItem) => {
    if (!selectedProject) return;
    updateProjectCaptureState(selectedProject.id, capture.id, 'dismissed', `${capture.title} dismissed from the inbox.`);
  };

  const handlePromoteDecisionToContextPrompt = (decisionId: string) => {
    setPromotingDecisionId(decisionId);
    setPromotingDecisionContextType('decision');
  };

  const handleConfirmPromoteDecisionToContext = (decisionId: string) => {
    if (!selectedProject) return;
    promoteDecisionToContext(selectedProject.id, decisionId, promotingDecisionContextType);
    setPromotingDecisionId(null);
  };

  const getContextTypeBadgeStyle = (type: ProjectContextType) => {
    switch (type) {
      case 'working_note':
        return 'border-slate-800 bg-slate-950/60 text-slate-300';
      case 'constraint':
        return 'border-amber-800 bg-amber-950/30 text-amber-400';
      case 'decision':
        return 'border-emerald-800 bg-emerald-950/30 text-emerald-400';
      case 'assumption':
        return 'border-indigo-800 bg-indigo-950/30 text-indigo-400';
      case 'warning':
        return 'border-red-800 bg-red-950/30 text-red-400';
      case 'requirement':
        return 'border-fuchsia-800 bg-fuchsia-950/30 text-fuchsia-400';
      default:
        return 'border-slate-800 bg-slate-950/60 text-slate-300';
    }
  };

  const handleCreateContext = () => {
    if (!selectedProject || !newContextTitle.trim() || !newContextBody.trim()) return;
    
    const signaturePayload = `context:${Date.now()}:manual`;
    const signature = generateSimulatedSignature(newContextSigner, signaturePayload);
    
    addProjectContextItem(selectedProject.id, {
      project_id: selectedProject.id,
      title: newContextTitle,
      body: newContextBody,
      context_type: newContextType,
      context_state: 'proposed',
      actor_type: 'operator',
      actor_name: newContextSigner,
      source_type: 'manual',
      signed_by: newContextSigner,
      signature: signature
    });
    
    setNewContextTitle('');
    setNewContextBody('');
    setNewContextType('working_note');
    setIsCreatingContext(false);
  };

  const handleAcceptContextProposal = (itemId: string) => {
    if (!selectedProject) return;
    const signer = activeSignerForProposalId[itemId] || vesselMembers[0] || 'Malaky';
    const signaturePayload = `accept:${Date.now()}:${itemId}`;
    const signature = generateSimulatedSignature(signer, signaturePayload);
    
    updateProjectContextState(
      selectedProject.id,
      itemId,
      'accepted',
      'Proposal accepted by peer review',
      signer,
      signature
    );
  };

  const handleRejectContextProposal = (itemId: string) => {
    if (!selectedProject) return;
    const reason = rejectReasonForProposalId[itemId] || 'Rejected';
    updateProjectContextState(
      selectedProject.id,
      itemId,
      'rejected',
      reason
    );
    setIsRejectingProposalId(null);
  };

  const handleSupersedeContext = (oldItemId: string) => {
    if (!selectedProject || !supersedingContextTitle.trim() || !supersedingContextBody.trim()) return;
    
    const signaturePayload = `supersede:${Date.now()}:${oldItemId}`;
    const signature = generateSimulatedSignature(supersedingSigner, signaturePayload);
    
    supersedeProjectContext(
      selectedProject.id,
      oldItemId,
      {
        title: supersedingContextTitle,
        body: supersedingContextBody,
        context_type: supersedingContextType,
        actor_type: 'operator',
        actor_name: supersedingSigner,
        source_type: 'supersede',
        source_id: oldItemId
      },
      supersedingReviewNote || `Superseded by peer review: ${supersedingContextTitle}`,
      supersedingSigner,
      signature
    );
    
    setIsSupersedingItemId(null);
    setSupersedingContextTitle('');
    setSupersedingContextBody('');
    setSupersedingContextType('working_note');
    setSupersedingReviewNote('');
  };

  const handleCreateProject = () => {
    if (!newTitle.trim()) return;
    const templateSeed = newProjectTemplate === 'blank' ? null : createProjectTemplateSeed(newProjectTemplate);
    const newId = addProject({
      title: newTitle,
      description: newDesc,
      category: templateSeed?.category || newCategory,
      status: 'PLANNING',
      pinned_note: newPinned,
      next_step: newNextStep || templateSeed?.next_step || '',
      artifacts: templateSeed?.artifacts || [],
      decisions: templateSeed?.decisions || [],
      commitments: templateSeed?.commitments || []
    });
    setSelectedProjectId(newId);
    setIsCreating(false);
    setNewTitle('');
    setNewDesc('');
    setNewPinned('');
    setNewNextStep('');
    setNewProjectTemplate('blank');
  };

  const handleApplyProjectTemplate = useCallback(
    (templateKey: ProjectTemplateKey) => {
      if (!selectedProject) return;
      applyProjectTemplate(selectedProject.id, templateKey);
      setProjectViewMode('desk');
      window.setTimeout(() => {
        nextActionCardRef.current?.focus();
      }, 120);
    },
    [applyProjectTemplate, selectedProject]
  );

  const resetCommitmentComposer = () => {
    setCommitmentTitle('');
    setCommitmentRationale('');
    setCommitmentNextAction('');
    setCommitmentDoneWhen('');
    setCommitmentState('active');
    setCommitmentBlockerNote('');
    setCommitmentArtifactId('');
    setCommitmentDecisionId('');
    setCommitmentConfidence('medium');
    setCommitmentWorkPackage('');
    setCommitmentConstraints('');
    setIsCreatingCommitment(false);
  };

  const handleCreateCommitment = () => {
    if (!effectiveSelectedProjectId || !commitmentTitle.trim() || !commitmentRationale.trim() || !commitmentNextAction.trim() || !commitmentDoneWhen.trim()) {
      return;
    }

    addProjectCommitment(effectiveSelectedProjectId, {
      title: commitmentTitle.trim(),
      commitment_state: commitmentState,
      rationale: commitmentRationale.trim(),
      next_action: commitmentNextAction.trim(),
      blocker_note: commitmentBlockerNote.trim() || undefined,
      done_when: commitmentDoneWhen.trim(),
      artifact_id: commitmentArtifactId || undefined,
      decision_id: commitmentDecisionId || undefined,
      confidence: commitmentConfidence,
      work_package: commitmentWorkPackage.trim() || undefined,
      constraints: commitmentConstraints.trim() || undefined
    });

    resetCommitmentComposer();
  };

  const seedCommitmentFromArtifact = (artifact: ProjectArtifact) => {
    setCommitmentTitle(`Review ${artifact.title}`);
    setCommitmentRationale(artifact.summary || `Advance the project using the artifact ${artifact.title}.`);
    setCommitmentNextAction(`Review ${artifact.title} and decide what should move forward.`);
    setCommitmentDoneWhen(`A clear decision or review outcome is recorded for ${artifact.title}.`);
    setCommitmentState('active');
    setCommitmentBlockerNote('');
    setCommitmentArtifactId(artifact.id);
    setCommitmentDecisionId('');
    setCommitmentConfidence('medium');
    setCommitmentWorkPackage(`Artifact Review Package (${artifact.type})`);
    setCommitmentConstraints('Requires verification against active lodge contracts.');
    setIsCreatingCommitment(true);
  };

  const seedDecisionFromArtifact = (artifact: ProjectArtifact) => {
    setUpdateType('decision');
    setAssociatedArtifactId(artifact.id);
    setDecisionTitle(`Decision for ${artifact.title}`);
    setDecisionState(isArtifactApproved(artifact) ? 'accepted' : 'proposed');
    setDecisionImpact(artifact.review_note?.trim() || '');
    setNewMessage(
      artifact.summary?.trim() ||
        artifact.review_note?.trim() ||
        `Use ${artifact.title} to define the next project decision.`
    );
    setProjectViewMode('overview');
    setSelectedArtifactId(artifact.id);
  };

  const seedCommitmentFromDecision = (decision: ProjectDecision) => {
    setCommitmentTitle(decision.title);
    setCommitmentRationale(decision.rationale);
    setCommitmentNextAction(decision.impact_note?.trim() || 'Carry the accepted direction into the next concrete review pass.');
    setCommitmentDoneWhen(`The consequence of "${decision.title}" is reflected in the project artifacts or status.`);
    setCommitmentState(decision.decision_state === 'deferred' ? 'proposed' : 'active');
    setCommitmentBlockerNote('');
    setCommitmentArtifactId(decision.artifact_id || '');
    setCommitmentDecisionId(decision.id);
    setCommitmentConfidence('high');
    setCommitmentWorkPackage('Decision Implementation Work Package');
    setCommitmentConstraints('Must adhere to accepted decision rationale constraints.');
    setIsCreatingCommitment(true);
  };

  const handleApproveArtifact = (artifact: ProjectArtifact) => {
    if (!selectedProject) return;
    updateArtifactReviewState(selectedProject.id, artifact.id, 'reviewed');
    updateArtifactReviewSignal(selectedProject.id, artifact.id, 'clear');
  };

  const handleFlagArtifact = (artifact: ProjectArtifact) => {
    if (!selectedProject) return;
    updateArtifactReviewState(
      selectedProject.id,
      artifact.id,
      artifact.review_state === 'reviewed' ? 'reviewed' : 'in_review'
    );
    updateArtifactReviewSignal(selectedProject.id, artifact.id, 'needs_attention');
  };

  const handleResetArtifactReview = (artifact: ProjectArtifact) => {
    if (!selectedProject) return;
    updateArtifactReviewState(selectedProject.id, artifact.id, 'unreviewed');
    updateArtifactReviewSignal(selectedProject.id, artifact.id, 'clear');
  };

  const buildProjectBriefPacket = useCallback(() => {
    if (!selectedProject) return null;

    const artifacts = selectedProject.artifacts || [];
    const decisions = selectedProject.decisions || [];
    const commitments = selectedProject.commitments || [];

    return {
      generated_at: nowIso(),
      local_truth_boundary:
        'Built from current project data, activity, runtime context, and attached artifacts. No external model call or sync involved.',
      project: {
        id: selectedProject.id,
        title: selectedProject.title,
        description: selectedProject.description,
        category: selectedProject.category,
        status: selectedProject.status,
        updated_at: selectedProject.updated_at,
        pinned_note: selectedProject.pinned_note,
        next_step: selectedProject.next_step || null,
        context: selectedProject.context || null
      },
      runtime: {
        condition: bellowsRuntime.label,
        detail: bellowsRuntime.detail,
        network_health: bellowsState?.network_health || null,
        heartbeat: bellowsState?.current_pulse || null,
        active_agents: bellowsState?.active_agents || [],
        latest_runtime_note: bellowsState?.latest_receipt_note || bellowsState?.embodiment_goal?.status || null
      },
      memory: projectMemory,
      relevance: projectRelevance,
      agent_summary: agentSummary,
      runtime_advisory: runtimeCommitmentAdvisory
        ? {
            label: runtimeCommitmentAdvisory.label,
            message: runtimeCommitmentAdvisory.message,
            detail: runtimeCommitmentAdvisory.detail
          }
        : null,
      brief: projectBrief,
      counts: {
        artifacts: artifacts.length,
        decisions: decisions.length,
        commitments: commitments.length,
        active_commitments: commitments.filter((commitment) => commitment.commitment_state === 'active').length,
        blocked_commitments: commitments.filter((commitment) => commitment.commitment_state === 'blocked').length,
        low_confidence_active_commitments: commitments.filter(
          (commitment) => commitment.commitment_state === 'active' && commitment.confidence === 'low'
        ).length
      },
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
        timestamp: artifact.timestamp,
        source_lane: artifact.source_lane || selectedProject.category,
        summary: artifact.summary || null,
        review_state: artifact.review_state || 'unreviewed',
        review_signal: artifact.review_signal || 'clear',
        review_note: artifact.review_note || null
      })),
      decisions: decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        timestamp: decision.timestamp,
        rationale: decision.rationale,
        decision_state: decision.decision_state,
        artifact_id: decision.artifact_id || null,
        impact_note: decision.impact_note || null
      })),
      commitments: commitments.map((commitment) => ({
        id: commitment.id,
        title: commitment.title,
        timestamp: commitment.timestamp,
        commitment_state: commitment.commitment_state,
        rationale: commitment.rationale,
        next_action: commitment.next_action,
        done_when: commitment.done_when,
        blocker_note: commitment.blocker_note || null,
        confidence: commitment.confidence || 'medium',
        work_package: commitment.work_package || null,
        constraints: commitment.constraints || null,
        artifact_id: commitment.artifact_id || null,
        decision_id: commitment.decision_id || null
      })),
      latest_reflection: latestReflection
        ? {
            agent: latestReflection.agent,
            content: latestReflection.content,
            timestamp: latestReflection.timestamp
          }
        : null
    };
  }, [
    selectedProject,
    bellowsRuntime,
    bellowsState,
    projectMemory,
    projectRelevance,
    agentSummary,
    runtimeCommitmentAdvisory,
    projectBrief,
    latestReflection
  ]);

  const handleExportProjectBrief = () => {
    const packet = buildProjectBriefPacket();
    if (!packet || !selectedProject) return;
    downloadJsonArtifact(`project-brief-${selectedProject.id}.json`, packet);
  };

  const handleRecordProjectBriefArtifact = () => {
    if (!selectedProject) return;
    addProjectArtifact(selectedProject.id, {
      type: 'project_brief',
      title: `Project Brief - ${selectedProject.title}`,
      summary: `${projectMemory.currentDirection} | ${projectRelevance.returnFocus}`,
      source_lane: 'projects',
      review_state: 'unreviewed',
      review_signal: 'clear',
      review_note: 'Built from project memory, commitments, decisions, runtime context, and artifact review state.'
    });
  };

  const handlePrintProjectBrief = () => {
    if (!selectedProject) return;

    const toList = (items: string[]) =>
      items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

    const popup = window.open('', '_blank', 'width=960,height=1200');
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedProject.title)} - Project Brief</title>
          <style>
            body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #ffffff; color: #111827; margin: 0; padding: 32px; }
            h1, h2, h3 { margin: 0; }
            .meta { margin-top: 8px; color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
            .card { border: 1px solid #d1d5db; padding: 16px; border-radius: 10px; break-inside: avoid; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; font-weight: 700; }
            .value { margin-top: 10px; font-size: 14px; line-height: 1.5; }
            ul { margin: 10px 0 0 18px; padding: 0; }
            li { margin-bottom: 6px; }
            .section { margin-top: 28px; }
            .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #d1d5db; font-size: 12px; color: #6b7280; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(selectedProject.title)}</h1>
          <div class="meta">${escapeHtml(selectedProject.category)} | ${escapeHtml(selectedProject.status)} | Updated ${escapeHtml(formatTimestamp(selectedProject.updated_at))}</div>
          <div class="section">
            <div class="label">Project Description</div>
            <div class="value">${escapeHtml(selectedProject.description || 'No description recorded.')}</div>
          </div>
          <div class="grid">
            <div class="card">
              <div class="label">Current Brief</div>
              <ul>${toList(projectBrief.currentBrief)}</ul>
            </div>
            <div class="card">
              <div class="label">Carry Forward</div>
              <ul>${toList(projectBrief.carryForward)}</ul>
            </div>
            <div class="card">
              <div class="label">Review Pressure</div>
              <ul>${toList(projectBrief.reviewPressure)}</ul>
            </div>
            <div class="card">
              <div class="label">Artifact Readiness</div>
              <ul>${toList(projectBrief.artifactReadiness)}</ul>
            </div>
          </div>
          <div class="section">
            <div class="label">Project Memory</div>
            <div class="value">
              <strong>Remembered Context:</strong> ${escapeHtml(projectMemory.rememberedContext)}<br/>
              <strong>Current Direction:</strong> ${escapeHtml(projectMemory.currentDirection)}<br/>
              <strong>Open Question:</strong> ${escapeHtml(projectMemory.openQuestion)}<br/>
              <strong>Critical Review Signal:</strong> ${escapeHtml(projectMemory.criticalReviewSignal)}<br/>
              <strong>Recent Decision:</strong> ${escapeHtml(projectMemory.recentDecision)}
            </div>
          </div>
          <div class="section">
            <div class="label">Runtime and Return Context</div>
            <div class="value">
              <strong>Bellows Condition:</strong> ${escapeHtml(bellowsRuntime.label)} (${escapeHtml(bellowsRuntime.detail)})<br/>
              <strong>Top Signal:</strong> ${escapeHtml(projectRelevance.topSignal)}<br/>
              <strong>Return Focus:</strong> ${escapeHtml(projectRelevance.returnFocus)}
            </div>
          </div>
          <div class="footer">
            Built from current project data, activity, runtime context, and attached artifacts. No external model call or sync involved.
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const buildProjectRoomDossierPacket = useCallback(() => {
    if (!selectedProject) return null;

    return {
      generated_at: nowIso(),
      local_truth_boundary:
        'Built from current project data, room objects, commitments, decisions, runtime context, and attached artifacts. No external model call or sync involved.',
      project: {
        id: selectedProject.id,
        title: selectedProject.title,
        description: selectedProject.description,
        category: selectedProject.category,
        status: selectedProject.status,
        updated_at: selectedProject.updated_at,
        pinned_note: selectedProject.pinned_note,
        next_step: selectedProject.next_step || null
      },
      room_brief: projectBrief,
      room_memory: projectMemory,
      room_relevance: projectRelevance,
      room_runtime: {
        label: bellowsRuntime.label,
        detail: bellowsRuntime.detail,
        advisory: runtimeCommitmentAdvisory
          ? {
              label: runtimeCommitmentAdvisory.label,
              message: runtimeCommitmentAdvisory.message,
              detail: runtimeCommitmentAdvisory.detail
            }
          : null
      },
      frames: projectFrames.map((frame) => ({
        id: frame.id,
        title: frame.title,
        summary: frame.summary,
        status: frame.status,
        operator_cue: frame.operatorCue,
        signals: frame.signals,
        objects: frame.objectIds
          .map((objectId) => projectRoomObjects.find((object) => object.id === objectId))
          .filter((object): object is ProjectRoomObject => Boolean(object))
          .map((object) => ({
            id: object.id,
            kind: object.kind,
            title: object.title,
            summary: object.summary,
            status: object.status,
            timestamp: object.timestamp || null,
            linked_artifact_id: object.linkedArtifactId || null
          }))
      })),
      review_queue: projectReviewQueue.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        summary: item.summary,
        action: item.action,
        linked_artifact_id: item.linkedArtifactId || null
      }))
    };
  }, [
    selectedProject,
    projectBrief,
    projectMemory,
    projectRelevance,
    bellowsRuntime,
    runtimeCommitmentAdvisory,
    projectFrames,
    projectRoomObjects,
    projectReviewQueue
  ]);

  const buildProjectHandoffPacket = useCallback(() => {
    if (!selectedProject) return null;

    const contextItems = selectedProject.context_items || [];
    const canonical_context = contextItems.filter((item) => item.context_state === 'accepted');
    const open_proposals = contextItems.filter((item) => item.context_state === 'proposed');
    const superseded_context = contextItems.filter((item) => item.context_state === 'superseded' || item.context_state === 'rejected');

    const artifacts = selectedProject.artifacts || [];
    const decisions = selectedProject.decisions || [];
    const commitments = selectedProject.commitments || [];
    const approved = artifacts.filter((artifact) => isArtifactApproved(artifact));
    const flagged = artifacts.filter((artifact) => isArtifactFlagged(artifact));
    const pending = artifacts.filter((artifact) => !isArtifactApproved(artifact) && !isArtifactFlagged(artifact));

    return {
      canonical_context: canonical_context.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        context_type: item.context_type,
        actor_type: item.actor_type,
        actor_name: item.actor_name || null,
        source_type: item.source_type,
        source_id: item.source_id || null,
        evidence_ids: item.evidence_ids || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        signed_by: item.signed_by || null,
        signature: item.signature || null
      })),
      open_proposals: open_proposals.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        context_type: item.context_type,
        actor_type: item.actor_type,
        actor_name: item.actor_name || null,
        source_type: item.source_type,
        source_id: item.source_id || null,
        evidence_ids: item.evidence_ids || [],
        created_at: item.created_at,
        updated_at: item.updated_at
      })),
      superseded_context: superseded_context.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        context_type: item.context_type,
        context_state: item.context_state,
        actor_type: item.actor_type,
        actor_name: item.actor_name || null,
        source_type: item.source_type,
        source_id: item.source_id || null,
        evidence_ids: item.evidence_ids || [],
        supersedes_id: item.supersedes_id || null,
        review_note: item.review_note || null,
        reviewed_at: item.reviewed_at || null,
        created_at: item.created_at,
        updated_at: item.updated_at
      })),
      provenance: {
        generated_at: nowIso(),
        local_truth_boundary:
          'Built from current project data, evidence review, decisions, commitments, and runtime context. No external model call or sync involved.',
        project: {
          id: selectedProject.id,
          title: selectedProject.title,
          description: selectedProject.description,
          category: selectedProject.category,
          status: selectedProject.status,
          updated_at: selectedProject.updated_at,
          pinned_note: selectedProject.pinned_note,
          context: selectedProject.context || null
        },
        evidence_summary: {
          total: artifacts.length,
          approved: approved.length,
          flagged: flagged.length,
          needs_review: pending.length,
          ready_to_carry: approved.map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            type: artifact.type,
            timestamp: artifact.timestamp,
            source_lane: artifact.source_lane || selectedProject.category,
            summary: artifact.summary || null,
            review_note: artifact.review_note || null,
            review_outcome: getArtifactReviewOutcomeLabel(artifact)
          })),
          needs_review_items: [...flagged, ...pending].map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            type: artifact.type,
            timestamp: artifact.timestamp,
            source_lane: artifact.source_lane || selectedProject.category,
            summary: artifact.summary || null,
            review_note: artifact.review_note || null,
            review_outcome: getArtifactReviewOutcomeLabel(artifact)
          }))
        },
        decisions: decisions.map((decision) => ({
          id: decision.id,
          title: decision.title,
          timestamp: decision.timestamp,
          rationale: decision.rationale,
          decision_state: decision.decision_state,
          artifact_id: decision.artifact_id || null,
          impact_note: decision.impact_note || null
        })),
        commitments: commitments.map((commitment) => ({
          id: commitment.id,
          title: commitment.title,
          timestamp: commitment.timestamp,
          commitment_state: commitment.commitment_state,
          rationale: commitment.rationale,
          next_action: commitment.next_action,
          done_when: commitment.done_when,
          blocker_note: commitment.blocker_note || null,
          confidence: commitment.confidence || 'medium',
          work_package: commitment.work_package || null,
          constraints: commitment.constraints || null,
          artifact_id: commitment.artifact_id || null,
          decision_id: commitment.decision_id || null
        })),
        recent_activity: (selectedProject.activity || []).slice(-6).map((activity) => ({
          id: activity.id,
          kind: activity.kind,
          title: activity.title,
          detail: activity.detail || null,
          timestamp: activity.timestamp
        })),
        since_last_packet: {
          status: reviewPacketDelta.status,
          summary: reviewPacketDelta.summary,
          readiness_impact: reviewPacketDelta.readinessImpact,
          checkpoint_label: reviewPacketDelta.checkpointLabel,
          carry_forward_cue: reviewPacketDelta.carryForwardCue,
          changes: reviewPacketDelta.changeLines
        },
        current_direction: {
          summary: projectMemory.currentDirection,
          return_focus: projectRelevance.returnFocus,
          open_question: projectMemory.openQuestion,
          next_step: selectedProject.next_step?.trim() || null,
          readiness: handoffReadiness.ready ? 'ready' : 'needs_review',
          readiness_blockers: handoffReadiness.blockers,
          runtime_condition: bellowsRuntime.label,
          runtime_detail: bellowsRuntime.detail,
          runtime_advisory: runtimeCommitmentAdvisory
            ? {
                label: runtimeCommitmentAdvisory.label,
                message: runtimeCommitmentAdvisory.message,
                detail: runtimeCommitmentAdvisory.detail
              }
            : null,
          daily_note_summary: stewardshipJournal.carryForward[0] || stewardshipJournal.lastMeaningfulMovement
        },
        next_action: deskNextAction
          ? {
              title: deskNextAction.title,
              explanation: deskNextAction.explanation,
              action_label: deskNextAction.actionLabel,
              action_kind: deskNextAction.actionKind,
              target_view: deskNextAction.targetView,
              target_element_id: deskNextAction.targetElementId || null
            }
          : null
      },
      checkpoint: latestReviewPacket
        ? {
            id: latestReviewPacket.id,
            title: latestReviewPacket.title,
            timestamp: latestReviewPacket.timestamp,
            summary_line: latestReviewPacket.snapshot.summary_line
          }
        : null
    };
  }, [
    selectedProject,
    projectMemory,
    projectRelevance,
    bellowsRuntime,
    runtimeCommitmentAdvisory,
    reviewPacketDelta,
    latestReviewPacket,
    handoffReadiness,
    stewardshipJournal,
    deskNextAction
  ]);

  const buildProjectHandoffMarkdown = useCallback(() => {
    if (!selectedProject) return '';

    const contextItems = selectedProject.context_items || [];
    const accepted = contextItems.filter((item) => item.context_state === 'accepted');

    const currentDirectionItems = accepted.filter((item) => item.context_type === 'working_note');
    const activeConstraintsItems = accepted.filter((item) => item.context_type === 'constraint');
    const acceptedDecisionsItems = accepted.filter((item) => item.context_type === 'decision');
    const activeAssumptionsItems = accepted.filter((item) => item.context_type === 'assumption');
    const knownWarningsItems = accepted.filter((item) => item.context_type === 'warning');
    const nextStepItems = accepted.filter((item) => item.context_type === 'requirement');

    const lines: string[] = [
      `# ${selectedProject.title}`,
      '',
      `- Category: ${selectedProject.category}`,
      `- Status: ${selectedProject.status}`,
      `- Updated: ${formatTimestamp(selectedProject.updated_at)}`,
      '',
      '## Project Description',
      '',
      selectedProject.description || 'No project description recorded yet.',
      '',
      '## Current Direction',
      ''
    ];

    if (currentDirectionItems.length === 0) {
      lines.push(`- Current direction: ${projectMemory.currentDirection || 'No current direction recorded.'}`);
    } else {
      currentDirectionItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body}`);
      });
    }
    lines.push(`- Next step baseline: ${selectedProject.next_step?.trim() || 'No next step baseline recorded yet.'}`);
    lines.push(`- Return focus: ${projectRelevance.returnFocus}`);
    if (agentSummary.suggestedReviewFocus[0]) {
      lines.push(`- Suggested review focus: ${agentSummary.suggestedReviewFocus[0]}`);
    }

    lines.push('', '## Active Constraints', '');
    if (activeConstraintsItems.length === 0) {
      lines.push('- No active constraints accepted yet.');
    } else {
      activeConstraintsItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body} (Signed by ${item.signed_by || 'operator'})`);
      });
    }

    lines.push('', '## Accepted Decisions', '');
    if (acceptedDecisionsItems.length === 0) {
      lines.push('- No accepted decisions yet.');
    } else {
      acceptedDecisionsItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body} (Signed by ${item.signed_by || 'operator'})`);
      });
    }

    lines.push('', '## Active Assumptions', '');
    if (activeAssumptionsItems.length === 0) {
      lines.push('- No active assumptions accepted yet.');
    } else {
      activeAssumptionsItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body} (Signed by ${item.signed_by || 'operator'})`);
      });
    }

    lines.push('', '## Known Warnings', '');
    if (knownWarningsItems.length === 0) {
      lines.push('- No warnings accepted yet.');
    } else {
      knownWarningsItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body} (Signed by ${item.signed_by || 'operator'})`);
      });
    }

    lines.push('', '## Next Steps (Requirements)', '');
    if (nextStepItems.length === 0) {
      lines.push('- No requirements accepted yet.');
    } else {
      nextStepItems.forEach((item) => {
        lines.push(`- **${item.title}**: ${item.body} (Signed by ${item.signed_by || 'operator'})`);
      });
    }

    const approvedArtifacts = (selectedProject.artifacts || []).filter((a) => isArtifactApproved(a));
    const flaggedArtifacts = (selectedProject.artifacts || []).filter((a) => isArtifactFlagged(a));
    const pendingArtifacts = (selectedProject.artifacts || []).filter((a) => !isArtifactApproved(a) && !isArtifactFlagged(a));

    lines.push('', '## Evidence Ready to Carry Forward', '');
    if (approvedArtifacts.length === 0) {
      lines.push('- No approved evidence yet.');
    } else {
      approvedArtifacts.forEach((artifact) => {
        lines.push(`- ${artifact.title} (${artifact.type})`);
        if (artifact.summary?.trim()) lines.push(`  - Summary: ${artifact.summary.trim()}`);
        if (artifact.review_note?.trim()) lines.push(`  - Comment: ${artifact.review_note.trim()}`);
      });
    }

    lines.push('', '## Open Review Items', '');
    if (flaggedArtifacts.length + pendingArtifacts.length === 0) {
      lines.push('- No evidence is currently blocking handoff.');
    } else {
      [...flaggedArtifacts, ...pendingArtifacts].forEach((artifact) => {
        lines.push(`- ${artifact.title}: ${getArtifactReviewOutcomeLabel(artifact)}`);
        lines.push(`  - Detail: ${(artifact.review_note || getArtifactReviewOutcomeDetail(artifact)).trim()}`);
      });
    }

    lines.push('', '## Runtime Context', '');
    lines.push(`- Runtime condition: ${bellowsRuntime.label} (${bellowsRuntime.detail})`);
    if (runtimeCommitmentAdvisory) {
      lines.push(`- Advisory: ${runtimeCommitmentAdvisory.message}`);
      lines.push(`- Detail: ${runtimeCommitmentAdvisory.detail}`);
    } else {
      lines.push('- Advisory: No runtime advisory is currently changing this handoff.');
    }

    lines.push('', '## Since Last Packet', '');
    lines.push(`- ${reviewPacketDelta.checkpointLabel}`);
    lines.push(`- ${reviewPacketDelta.summary}`);
    lines.push(`- ${reviewPacketDelta.readinessImpact}`);
    if (reviewPacketDelta.changeLines.length === 0) {
      lines.push('- No material delta is currently recorded.');
    } else {
      reviewPacketDelta.changeLines.forEach((line) => lines.push(`- ${line}`));
    }

    lines.push('', '## Daily Note', '');
    if (stewardshipJournal.todayEntries.length === 0) {
      lines.push('- No movement recorded today.');
    } else {
      stewardshipJournal.todayEntries.forEach((entry) => {
        lines.push(`- ${entry.title}`);
        lines.push(`  - Detail: ${entry.detail}`);
      });
    }

    lines.push('', '## Carry Forward', '');
    stewardshipJournal.carryForward.forEach((line) => {
      lines.push(`- ${line}`);
    });

    lines.push(
      '',
      '## Truth Boundary',
      '',
      'Built from current project data, evidence review, decisions, commitments, and runtime context. No external model call or sync involved.'
    );

    return lines.join('\n');
  }, [
    selectedProject,
    projectMemory,
    projectRelevance,
    agentSummary,
    bellowsRuntime,
    runtimeCommitmentAdvisory,
    stewardshipJournal,
    reviewPacketDelta
  ]);

  const buildProjectDailyNote = useCallback(() => {
    if (!selectedProject) return '';

    const lines: string[] = [
      `# Daily Note - ${selectedProject.title}`,
      '',
      `- Date: ${new Date().toLocaleDateString()}`,
      `- Status: ${selectedProject.status}`,
      `- Last meaningful movement: ${stewardshipJournal.lastMeaningfulMovement}`,
      '',
      '## Today',
      ''
    ];

    if (stewardshipJournal.todaySummary.length > 0) {
      stewardshipJournal.todaySummary.forEach((summary) => lines.push(`- ${summary}`));
      lines.push('');
    }

    if (stewardshipJournal.todayEntries.length === 0) {
      lines.push('- No movement recorded today.');
    } else {
      stewardshipJournal.todayEntries.forEach((entry) => {
        lines.push(`- ${entry.title}`);
        lines.push(`  - ${entry.detail}`);
      });
    }

    lines.push('', '## Recent Movement', '');
    if (stewardshipJournal.recentEntries.length === 0) {
      lines.push('- No meaningful project movement recorded yet.');
    } else {
      stewardshipJournal.recentEntries.slice(0, 4).forEach((entry) => {
        lines.push(`- ${entry.title} (${formatTimestamp(entry.timestamp)})`);
        lines.push(`  - ${entry.detail}`);
      });
    }

    lines.push('', '## Carry Forward', '');
    stewardshipJournal.carryForward.forEach((line) => lines.push(`- ${line}`));

    lines.push(
      '',
      '## Note Boundary',
      '',
      'Derived from current project activity, evidence state, decisions, commitments, and next-step data already stored in this project.'
    );

    return lines.join('\n');
  }, [selectedProject, stewardshipJournal]);

  const handleExportProjectHandoff = () => {
    const packet = buildProjectHandoffPacket();
    if (!packet || !selectedProject) return;
    downloadJsonArtifact(`project-handoff-${selectedProject.id}.json`, packet);
  };

  const handleCopyProjectHandoffJson = async () => {
    const packet = buildProjectHandoffPacket();
    if (!packet) return;
    const json = JSON.stringify(packet, null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      downloadTextArtifact('project-handoff-copy-fallback.json', json, 'application/json;charset=utf-8');
    }
  };

  const buildProjectReviewPacketSnapshot = useCallback((): ProjectReviewPacketSnapshot | null => {
    if (!selectedProject) return null;
    return {
      next_step: selectedProject.next_step?.trim() || null,
      readiness_ready: handoffReadiness.ready,
      readiness_blockers: [...handoffReadiness.blockers],
      approved_evidence_ids: approvedArtifacts.map((artifact) => artifact.id),
      flagged_evidence_ids: flaggedArtifacts.map((artifact) => artifact.id),
      pending_evidence_ids: pendingArtifacts.map((artifact) => artifact.id),
      accepted_decision_ids: (selectedProject.decisions || [])
        .filter((decision) => decision.decision_state === 'accepted')
        .map((decision) => decision.id),
      deferred_decision_ids: (selectedProject.decisions || [])
        .filter((decision) => decision.decision_state === 'deferred')
        .map((decision) => decision.id),
      active_commitment_ids: (selectedProject.commitments || [])
        .filter((commitment) => commitment.commitment_state === 'active')
        .map((commitment) => commitment.id),
      completed_commitment_ids: (selectedProject.commitments || [])
        .filter((commitment) => commitment.commitment_state === 'completed')
        .map((commitment) => commitment.id),
      blocked_commitment_ids: (selectedProject.commitments || [])
        .filter((commitment) => commitment.commitment_state === 'blocked')
        .map((commitment) => commitment.id),
      today_entry_ids: stewardshipJournal.todayEntries.map((entry) => entry.id),
      summary_line: reviewPacketDelta.summary
    };
  }, [selectedProject, handoffReadiness, approvedArtifacts, flaggedArtifacts, pendingArtifacts, stewardshipJournal, reviewPacketDelta]);

  const handleSaveProjectHandoffArtifact = () => {
    setIsSavingCheckpoint(true);
    setCheckpointSigner(vesselMembers[0] || 'Malaky');
    setCheckpointWhyItChanged(reviewPacketDelta.summary || '');
    setCheckpointMessage(`Checkpoint - ${new Date().toLocaleDateString()}`);
  };

  const handleConfirmSaveCheckpoint = () => {
    if (!selectedProject) return;

    const signaturePayload = `checkpoint:${Date.now()}:${selectedProject.id}`;
    const generatedSignature = generateSimulatedSignature(checkpointSigner, signaturePayload);

    addProjectArtifact(selectedProject.id, {
      type: 'project_handoff',
      title: `Project Checkpoint - ${checkpointMessage.trim() || selectedProject.title}`,
      summary: checkpointWhyItChanged.trim() || selectedProject.next_step?.trim() || projectMemory.currentDirection,
      source_lane: 'projects',
      review_state: 'unreviewed',
      review_signal: 'clear',
      review_note: `Compiled checkpoint, signed by ${checkpointSigner}. Context: ${checkpointWhyItChanged}`
    });

    const snapshot = buildProjectReviewPacketSnapshot();
    if (snapshot) {
      saveProjectReviewPacket(selectedProject.id, {
        title: `Checkpoint: ${checkpointMessage.trim() || 'Handoff Checkpoint'}`,
        markdown: buildProjectHandoffMarkdown(),
        snapshot,
        why_it_changed: checkpointWhyItChanged.trim(),
        signer_handle: checkpointSigner,
        signer_signature: generatedSignature
      });
    }

    setIsSavingCheckpoint(false);
    setCheckpointMessage('');
    setCheckpointWhyItChanged('');
  };

  const handleExportProjectHandoffMarkdown = () => {
    if (!selectedProject) return;
    downloadTextArtifact(`project-handoff-${selectedProject.id}.md`, buildProjectHandoffMarkdown(), 'text/markdown;charset=utf-8');
  };

  const handleSaveProjectHandoffMarkdownArtifact = () => {
    if (!selectedProject) return;
    addProjectArtifact(selectedProject.id, {
      type: 'handoff_markdown',
      title: `Handoff Draft - ${selectedProject.title}`,
      summary: selectedProject.next_step?.trim() || projectMemory.currentDirection,
      source_lane: 'projects',
      review_state: 'unreviewed',
      review_signal: 'clear',
      review_note: 'Markdown handoff draft compiled from current project direction, evidence, decisions, commitments, and runtime context.'
    });
  };

  const handleGenerateShareableDossier = async () => {
    if (!selectedProject) return;
    const markdown = buildProjectHandoffMarkdown();
    const payload = {
      title: selectedProject.title,
      markdown
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}/handoff?p=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Shareable Dossier link copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy', e);
      alert('Failed to copy link. Check console.');
    }
  };

  const handleCopyProjectHandoffMarkdown = async () => {
    const markdown = buildProjectHandoffMarkdown();
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      downloadTextArtifact('project-handoff-copy-fallback.md', markdown, 'text/markdown;charset=utf-8');
    }
  };

  const handleCopyDailyNote = async () => {
    const markdown = buildProjectDailyNote();
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      downloadTextArtifact('project-daily-note-copy-fallback.md', markdown, 'text/markdown;charset=utf-8');
    }
  };

  const handleExportDailyNote = () => {
    if (!selectedProject) return;
    downloadTextArtifact(`project-daily-note-${selectedProject.id}.md`, buildProjectDailyNote(), 'text/markdown;charset=utf-8');
  };

  const handleSaveDailyNoteArtifact = () => {
    if (!selectedProject) return;
    addProjectArtifact(selectedProject.id, {
      type: 'daily_note',
      title: `Daily Note - ${selectedProject.title}`,
      summary: stewardshipJournal.carryForward[0] || stewardshipJournal.lastMeaningfulMovement,
      source_lane: 'projects',
      review_state: 'reviewed',
      review_signal: 'clear',
      review_note: 'Daily continuity note compiled from project activity, evidence review, decisions, commitments, and next-step state.'
    });
  };

  const handlePrintProjectHandoff = () => {
    if (!selectedProject) return;

    const approvedList = approvedArtifacts
      .map(
        (artifact) => `
          <div class="item-card">
            <div class="item-head">
              <div>
                <div class="item-title">${escapeHtml(artifact.title)}</div>
                <div class="item-meta">${escapeHtml(artifact.type)} | ${escapeHtml(formatTimestamp(artifact.timestamp))}</div>
              </div>
              <div class="badge approved">${escapeHtml(getArtifactReviewOutcomeLabel(artifact))}</div>
            </div>
            <div class="item-summary">${escapeHtml(artifact.summary || 'No summary recorded.')}</div>
            ${
              artifact.review_note
                ? `<div class="item-note"><strong>Review note:</strong> ${escapeHtml(artifact.review_note)}</div>`
                : ''
            }
          </div>
        `
      )
      .join('');

    const reviewList = [...flaggedArtifacts, ...pendingArtifacts]
      .map(
        (artifact) => `
          <div class="item-card">
            <div class="item-head">
              <div>
                <div class="item-title">${escapeHtml(artifact.title)}</div>
                <div class="item-meta">${escapeHtml(artifact.type)} | ${escapeHtml(formatTimestamp(artifact.timestamp))}</div>
              </div>
              <div class="badge attention">${escapeHtml(getArtifactReviewOutcomeLabel(artifact))}</div>
            </div>
            <div class="item-summary">${escapeHtml(artifact.summary || 'No summary recorded.')}</div>
            <div class="item-note">${escapeHtml(artifact.review_note || getArtifactReviewOutcomeDetail(artifact))}</div>
          </div>
        `
      )
      .join('');

    const decisionList = (selectedProject.decisions || [])
      .map(
        (decision) => `
          <div class="list-row">
            <strong>${escapeHtml(decision.title)}</strong> (${escapeHtml(decision.decision_state)})<br/>
            ${escapeHtml(decision.rationale)}
          </div>
        `
      )
      .join('');

    const commitmentList = (selectedProject.commitments || [])
      .map(
        (commitment) => `
          <div class="list-row">
            <strong>${escapeHtml(commitment.title)}</strong> (${escapeHtml(commitment.commitment_state)})<br/>
            <strong>Next action:</strong> ${escapeHtml(commitment.next_action)}<br/>
            <strong>Done when:</strong> ${escapeHtml(commitment.done_when)}${
              commitment.blocker_note ? `<br/><strong>Blocker:</strong> ${escapeHtml(commitment.blocker_note)}` : ''
            }
          </div>
        `
      )
      .join('');

    const popup = window.open('', '_blank', 'width=1024,height=1200');
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedProject.title)} - Project Handoff</title>
          <style>
            body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 28px; }
            h1, h2, h3, p { margin: 0; }
            .meta { margin-top: 8px; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
            .lead { margin-top: 18px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; font-size: 14px; line-height: 1.6; }
            .section { margin-top: 22px; }
            .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; font-weight: 700; margin-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .card, .item-card, .list-row { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; break-inside: avoid; }
            .item-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
            .item-title { font-weight: 700; font-size: 14px; }
            .item-meta { margin-top: 4px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
            .item-summary { margin-top: 10px; font-size: 14px; line-height: 1.6; color: #1e293b; }
            .item-note { margin-top: 10px; font-size: 13px; line-height: 1.6; color: #334155; }
            .badge { border: 1px solid; border-radius: 999px; padding: 4px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
            .badge.approved { border-color: #065f46; color: #065f46; background: #ecfdf5; }
            .badge.attention { border-color: #92400e; color: #92400e; background: #fffbeb; }
            .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 12px; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(selectedProject.title)}</h1>
          <div class="meta">${escapeHtml(selectedProject.category)} | ${escapeHtml(selectedProject.status)} | Updated ${escapeHtml(formatTimestamp(selectedProject.updated_at))}</div>
          <div class="lead">
            <div><strong>Current direction:</strong> ${escapeHtml(projectMemory.currentDirection)}</div>
            <div><strong>Next step:</strong> ${escapeHtml(selectedProject.next_step?.trim() || 'No next step recorded yet.')}</div>
            <div><strong>Return focus:</strong> ${escapeHtml(projectRelevance.returnFocus)}</div>
            ${
              runtimeCommitmentAdvisory
                ? `<div><strong>${escapeHtml(runtimeCommitmentAdvisory.label)}:</strong> ${escapeHtml(runtimeCommitmentAdvisory.message)}</div>`
                : `<div><strong>Runtime context:</strong> ${escapeHtml(bellowsRuntime.label)} (${escapeHtml(bellowsRuntime.detail)})</div>`
            }
          </div>
          <div class="section">
            <div class="section-label">Approved Evidence</div>
            ${approvedList || '<div class="card">No approved evidence has been recorded yet.</div>'}
          </div>
          <div class="section">
            <div class="section-label">Needs Review Before Handoff</div>
            ${reviewList || '<div class="card">No flagged or pending evidence is currently blocking this handoff.</div>'}
          </div>
          <div class="section">
            <div class="section-label">Decisions</div>
            <div class="grid">${decisionList || '<div class="card">No project decisions recorded yet.</div>'}</div>
          </div>
          <div class="section">
            <div class="section-label">Commitments</div>
            <div class="grid">${commitmentList || '<div class="card">No project commitments recorded yet.</div>'}</div>
          </div>
          <div class="footer">
            Built from current project data, evidence review, decisions, commitments, and runtime context. No external model call or sync involved.
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleExportProjectRoomDossier = () => {
    const packet = buildProjectRoomDossierPacket();
    if (!packet || !selectedProject) return;
    downloadJsonArtifact(`project-room-dossier-${selectedProject.id}.json`, packet);
  };

  const handleRecordProjectRoomDossierArtifact = () => {
    if (!selectedProject) return;
    addProjectArtifact(selectedProject.id, {
      type: 'project_room_dossier',
      title: `Handoff Packet - ${selectedProject.title}`,
      summary: selectedProject.next_step?.trim() || projectMemory.currentDirection,
      source_lane: 'projects',
      review_state: 'unreviewed',
      review_signal: 'clear',
      review_note: 'Packaged locally from room frames, review pressure, and continuity objects.'
    });
  };

  const handlePrintProjectRoomDossier = () => {
    if (!selectedProject) return;

    const popup = window.open('', '_blank', 'width=1100,height=1200');
    if (!popup) return;

    const frameHtml = projectFrames
      .map((frame) => {
        const objects = frame.objectIds
          .map((objectId) => projectRoomObjects.find((object) => object.id === objectId))
          .filter((object): object is ProjectRoomObject => Boolean(object));

        return `
          <section class="frame">
            <div class="frame-head">
              <div>
                <div class="label">${escapeHtml(frame.title)}</div>
                <h2>${escapeHtml(frame.summary)}</h2>
              </div>
              <div class="status">${escapeHtml(frame.status)}</div>
            </div>
            <div class="cue">${escapeHtml(frame.operatorCue)}</div>
            <div class="signal-list">
              ${frame.signals.map((signal) => `<div class="signal">${escapeHtml(signal)}</div>`).join('')}
            </div>
            <div class="object-grid">
              ${objects
                .map(
                  (object) => `
                    <div class="object-card">
                      <div class="object-meta">${escapeHtml(object.kind)} | ${escapeHtml(object.status)}</div>
                      <div class="object-title">${escapeHtml(object.title)}</div>
                      <div class="object-summary">${escapeHtml(object.summary)}</div>
                    </div>
                  `
                )
                .join('')}
            </div>
          </section>
        `;
      })
      .join('');

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedProject.title)} - Handoff Packet</title>
          <style>
            body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #ffffff; color: #0f172a; margin: 0; padding: 28px; }
            h1, h2 { margin: 0; }
            .meta { margin-top: 8px; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
            .intro { margin-top: 18px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
            .section-title { margin-top: 24px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; font-weight: 700; }
            .frame { margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; break-inside: avoid; }
            .frame-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; font-weight: 700; }
            .status { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; }
            .cue { margin-top: 12px; font-size: 14px; line-height: 1.5; color: #1e293b; }
            .signal-list { display: grid; gap: 8px; margin-top: 12px; }
            .signal { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 13px; color: #334155; }
            .object-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
            .object-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
            .object-meta { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
            .object-title { margin-top: 6px; font-weight: 700; font-size: 14px; }
            .object-summary { margin-top: 6px; font-size: 13px; color: #334155; line-height: 1.5; }
            .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #cbd5e1; color: #64748b; font-size: 12px; }
            @media print { body { padding: 18px; } .frame { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(selectedProject.title)}</h1>
          <div class="meta">${escapeHtml(selectedProject.category)} | ${escapeHtml(selectedProject.status)} | Updated ${escapeHtml(formatTimestamp(selectedProject.updated_at))}</div>
          <div class="intro">
            <div><strong>Project direction:</strong> ${escapeHtml(selectedProject.next_step?.trim() || projectMemory.currentDirection)}</div>
            <div style="margin-top:8px;"><strong>Return focus:</strong> ${escapeHtml(projectRelevance.returnFocus)}</div>
            <div style="margin-top:8px;"><strong>Runtime condition:</strong> ${escapeHtml(bellowsRuntime.label)} (${escapeHtml(bellowsRuntime.detail)})</div>
          </div>
          <div class="section-title">Project Sections</div>
          ${frameHtml}
          <div class="footer">
            Built from current project data, linked objects, commitments, decisions, runtime context, and attached evidence. No external model call or sync involved.
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const contextEntries = selectedProject ? getContextEntries(selectedProject) : [];

  useEffect(() => {
    if (!selectedProject?.artifacts?.length) {
      setSelectedArtifactId(null);
      return;
    }
    const artifactStillExists = selectedProject.artifacts.some((artifact) => artifact.id === selectedArtifactId);
    if (!artifactStillExists) {
      setSelectedArtifactId(selectedProject.artifacts[0].id);
    }
  }, [selectedArtifactId, selectedProject]);

  useEffect(() => {
    if (!effectiveSelectedProjectId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('project', effectiveSelectedProjectId);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [effectiveSelectedProjectId]);

  return (
    <div className="flex h-full w-full max-w-7xl flex-col gap-6 p-6 mx-auto font-mono">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-100">Projects</h1>
          <p className="mt-1 text-slate-400">
            Capture project inputs, review evidence, record decisions, carry commitments forward, and compile handoff in one workspace.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="rounded border border-indigo-800 bg-indigo-900/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-indigo-300 transition-colors hover:bg-indigo-900/60"
        >
          + New Project
        </button>
      </div>

      {inviteToken && (
        <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Project Invite</div>
              <h2 className="mt-2 text-lg font-bold text-slate-100">
                {invitePreview?.project_title || 'Project room invitation'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {invitePreview?.project_summary || 'Review the invite status below, then sign in to join if the invite is still pending.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
                <span className="rounded border border-indigo-800 bg-indigo-950/40 px-2 py-1 text-indigo-200">
                  Role: {invitePreview?.role || 'Reviewer'}
                </span>
                <span className={`rounded border px-2 py-1 ${
                  invitePreview?.status === 'pending'
                    ? 'border-emerald-800 bg-emerald-950/20 text-emerald-200'
                    : 'border-amber-800 bg-amber-950/20 text-amber-200'
                }`}>
                  {invitePreview?.status || 'Checking'}
                </span>
                {invitePreview?.expires_at && (
                  <span className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1 text-slate-300">
                    Expires {formatTimestamp(invitePreview.expires_at)}
                  </span>
                )}
              </div>
              {inviteStatusMessage && (
                <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                  {inviteStatusMessage}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {authState.status !== 'signed_in' ? (
                <div className="rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/80">
                  Sign in below to join this project room.
                </div>
              ) : (
                <button
                  onClick={handleAcceptInvite}
                  disabled={isAcceptingInvite || invitePreview?.status !== 'pending'}
                  className="rounded bg-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAcceptingInvite ? 'Joining...' : 'Join Project Room'}
                </button>
              )}
              <div className="max-w-xs text-xs leading-5 text-slate-500">
                Invites add you to the hosted room only. Public handoff links remain read-only unless the owner invites you here.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Hosted Project Rooms</div>
            <div className="mt-1 text-sm leading-6 text-slate-300">
              Keep evidence, decisions, comments, accepted context, and handoff links together when a client or reviewer needs to enter the room.
            </div>
            {cloudActionMessage && (
              <div className="mt-2 rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                {cloudActionMessage}
              </div>
            )}
            {hostedRoomError && (
              <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                {hostedRoomError}
              </div>
            )}
          </div>

          {authState.status === 'checking' && (
            <div className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">Checking account...</div>
          )}

          {authState.status === 'unconfigured' && (
            <div className="max-w-md rounded border border-amber-900/50 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80">
              {authState.error}
            </div>
          )}

          {(authState.status === 'signed_out' || authState.status === 'error') && (
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr),160px]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
                <input
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  placeholder="Password"
                  className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEmailAuth('sign_in')}
                  className="flex-1 rounded border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200 hover:bg-emerald-900/50"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleEmailAuth('create')}
                  className="flex-1 rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-800"
                >
                  Create
                </button>
              </div>
              <button
                onClick={handleGoogleAuth}
                className="rounded border border-indigo-800 bg-indigo-950/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:bg-indigo-950/50 sm:col-span-2"
              >
                Continue with Google
              </button>
              {(authMessage || authState.error) && (
                <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300 sm:col-span-2">
                  {authMessage || authState.error}
                </div>
              )}
            </div>
          )}

          {authState.status === 'signed_in' && (
            <div className="flex flex-col items-start gap-2 text-xs text-slate-300 sm:items-end">
              <div className="rounded border border-emerald-800/50 bg-emerald-950/20 px-3 py-2">
                Signed in as <span className="font-bold text-emerald-200">{authState.user.email || authState.user.displayName || authState.user.uid}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleImportAllProjects}
                  className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200 hover:bg-emerald-950/50"
                >
                  Import Existing Projects
                </button>
                <button
                  onClick={() => signOutProjectRoom()}
                  className="rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800"
                >
                  Sign Out
                </button>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                {hostedRooms.length} hosted room{hostedRooms.length === 1 ? '' : 's'} available
              </div>
            </div>
          )}
        </div>

        {authState.status === 'signed_in' && selectedProject && (
          <div className="mt-4 grid gap-3 border-t border-emerald-900/30 pt-4 xl:grid-cols-[1fr,1fr]">
            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Selected Room</div>
                  <div className="mt-1 text-sm font-bold text-slate-100">
                    {selectedHostedRoom ? 'Hosted copy connected' : 'Available on this device'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!selectedHostedRoom ? (
                    <button
                      onClick={handleImportSelectedProject}
                      className="rounded bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-500"
                    >
                      Import Selected
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSyncSelectedProject}
                        className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200 hover:bg-emerald-950/50"
                      >
                        Sync Room
                      </button>
                      <button
                        onClick={handlePublishHostedHandoff}
                        disabled={!selectedRoomPermissions.canPublishHandoff}
                        className="rounded border border-indigo-800 bg-indigo-950/40 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:bg-indigo-950/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Publish Handoff
                      </button>
                      {selectedHostedRoom.current_handoff_token && (
                        <button
                          onClick={handleRevokeHostedHandoff}
                          className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-200 hover:bg-red-950/40"
                        >
                          Revoke Link
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-400">
                Browser projects stay on this device until you import them. Hosted rooms preserve a cloud copy for client review, comments, and published handoff links.
              </div>
              {(lastPublishedHandoffUrl || selectedHostedRoom?.current_handoff_token) && (
                <div className="mt-3 rounded border border-indigo-900/40 bg-indigo-950/20 p-2 text-xs text-indigo-100">
                  <div className="font-bold uppercase tracking-widest text-indigo-300">Current Handoff Link</div>
                  <a
                    href={lastPublishedHandoffUrl || `/handoff/${selectedHostedRoom?.current_handoff_token}`}
                    className="mt-1 block break-all text-indigo-100 underline decoration-indigo-500/50"
                  >
                    {lastPublishedHandoffUrl || `${window.location.origin}/handoff/${selectedHostedRoom?.current_handoff_token}`}
                  </a>
                </div>
              )}
            </div>

            <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client Review</div>
                  <div className="mt-1 text-sm font-bold text-slate-100">Invites, threads, and timeline</div>
                </div>
                <span className="rounded border border-slate-800 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-400">
                  {rootRoomComments.length} thread{rootRoomComments.length === 1 ? '' : 's'}
                </span>
              </div>
              {selectedHostedRoom ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr),130px,auto]">
                    <input
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="reviewer@example.com"
                      className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as Exclude<ProjectRoomRole, 'owner'>)}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 outline-none focus:border-emerald-500"
                    >
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      onClick={handleCreateInvite}
                      disabled={!selectedRoomPermissions.canManageProject}
                      className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200 hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Copy Invite
                    </button>
                  </div>
                  {roomInvites.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {roomInvites.slice(0, 3).map((invite) => (
                        <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-xs text-slate-300">
                          <span className="min-w-0 truncate">{invite.email} - {invite.role} - {invite.status}</span>
                          {invite.status === 'pending' && (
                            <button onClick={() => handleRevokeInvite(invite.id)} className="text-[10px] font-bold uppercase tracking-widest text-red-300 hover:text-red-200">
                              Revoke
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
                    <input
                      value={roomCommentBody}
                      onChange={(event) => setRoomCommentBody(event.target.value)}
                      placeholder="Start a review thread..."
                      className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handlePostRoomComment}
                      disabled={!selectedRoomPermissions.canComment || !roomCommentBody.trim()}
                      className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Start Thread
                    </button>
                  </div>
                  {rootRoomComments.length > 0 && (
                    <div className="mt-3 rounded border border-slate-800 bg-slate-950/50">
                      <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Review Threads
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {rootRoomComments.slice(0, 5).map((comment) => (
                          <div key={comment.id} className="border-b border-slate-800/70 px-3 py-2 text-xs last:border-b-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-bold text-slate-200">{comment.author_label}</div>
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-slate-400">{comment.body}</div>
                            {comment.optimistic && (
                              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">Sending...</div>
                            )}
                            {(roomRepliesByParent[comment.id] || []).length > 0 && (
                              <div className="mt-2 space-y-2 border-l border-slate-800 pl-3">
                                {(roomRepliesByParent[comment.id] || []).map((reply) => (
                                  <div key={reply.id} className="rounded border border-slate-800/80 bg-slate-900/40 px-2 py-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="font-bold text-slate-300">{reply.author_label}</div>
                                      <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                        {new Date(reply.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="mt-1 whitespace-pre-wrap text-slate-400">{reply.body}</div>
                                    {reply.optimistic && (
                                      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">Sending...</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {replyingToCommentId === comment.id ? (
                              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr),auto,auto]">
                                <input
                                  value={replyBody}
                                  onChange={(event) => setReplyBody(event.target.value)}
                                  placeholder="Reply to this thread..."
                                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
                                />
                                <button
                                  onClick={() => handlePostRoomReply(comment)}
                                  disabled={!selectedRoomPermissions.canComment || !replyBody.trim()}
                                  className="rounded border border-emerald-900/60 bg-emerald-950/20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-200 hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Reply
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingToCommentId(null);
                                    setReplyBody('');
                                  }}
                                  className="rounded border border-slate-700 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setReplyingToCommentId(comment.id);
                                  setReplyBody('');
                                }}
                                disabled={!selectedRoomPermissions.canComment}
                                className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Reply
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {roomTimeline.length > 0 && (
                    <div className="mt-3 rounded border border-slate-800 bg-slate-950/50">
                      <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Room Timeline
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {roomTimeline.slice(0, 8).map((item) => (
                          <div key={item.id} className={`border-b px-3 py-2 text-xs last:border-b-0 ${item.accent}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-bold capitalize">{item.title}</div>
                              <div className="text-[10px] uppercase tracking-widest opacity-70">
                                {new Date(item.timestamp).toLocaleString()}
                              </div>
                            </div>
                            <div className="mt-1 whitespace-pre-wrap opacity-80">{item.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rootRoomComments.length === 0 && roomTimeline.length === 0 && (
                    <div className="mt-3 rounded border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-500">
                      No review threads or room events yet. Start a thread when a reviewer needs context.
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 rounded border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-500">
                  Import the selected project before inviting reviewers or collecting room comments.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isCreating && (
        <div className="flex flex-col gap-4 rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-6">
          <h2 className="border-b border-indigo-900/50 pb-2 text-sm font-bold uppercase tracking-widest text-indigo-200">
            New Project
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              placeholder="Title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-200"
            />
            <select
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-200"
            >
              <option value="morphology">Morphology</option>
              <option value="compliance">Compliance</option>
              <option value="stewardship">Stewardship</option>
              <option value="operations">Operations</option>
              <option value="workbench">Workbench</option>
            </select>
            <input
              placeholder="Short Description"
              value={newDesc}
              onChange={(event) => setNewDesc(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-200 md:col-span-2"
            />
            <input
              placeholder="Pinned Overview Note"
              value={newPinned}
              onChange={(event) => setNewPinned(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-200 md:col-span-2"
            />
            <input
              placeholder="Next Step (optional)"
              value={newNextStep}
              onChange={(event) => setNewNextStep(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 p-2 text-slate-200 md:col-span-2"
            />
            <div className="md:col-span-2">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-200">Starter Template</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <button
                  onClick={() => setNewProjectTemplate('blank')}
                  className={`rounded border p-3 text-left transition-colors ${
                    newProjectTemplate === 'blank'
                      ? 'border-indigo-700 bg-indigo-900/30 text-indigo-100'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-widest">Blank</div>
                  <div className="mt-2 text-xs text-slate-400">Start with an empty desk and shape the loop yourself.</div>
                </button>
                {Object.values(PROJECT_TEMPLATES).map((template) => (
                  <button
                    key={template.key}
                    onClick={() => setNewProjectTemplate(template.key)}
                    className={`rounded border p-3 text-left transition-colors ${
                      newProjectTemplate === template.key
                        ? 'border-indigo-700 bg-indigo-900/30 text-indigo-100'
                        : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-widest">{template.label}</div>
                    <div className="mt-2 text-xs text-slate-400">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <button
              onClick={() => {
                setIsCreating(false);
                setNewProjectTemplate('blank');
              }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              className="rounded bg-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-500"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-2">
          {(() => {
            const globalActive = projects.reduce((acc, p) => acc + (p.commitments || []).filter(c => c.commitment_state === 'active').length, 0);
            const globalBlocked = projects.reduce((acc, p) => acc + (p.commitments || []).filter(c => c.commitment_state === 'blocked').length, 0);
            const globalLowConf = projects.reduce((acc, p) => acc + (p.commitments || []).filter(c => c.commitment_state === 'active' && c.confidence === 'low').length, 0);
            const globalCompleted = projects.reduce((acc, p) => acc + (p.commitments || []).filter(c => c.commitment_state === 'completed').length, 0);

            if (projects.length === 0) return null;

            return (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 mb-2">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Commitment Focus
                  </h4>
                  {commitmentFocusFilter !== 'all' && (
                    <button 
                      onClick={() => setCommitmentFocusFilter('all')}
                      className="text-[8px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Reset All
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-center">
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'active' ? 'all' : 'active')}
                    className={`rounded border p-1 text-left flex flex-col justify-between transition-all ${
                      commitmentFocusFilter === 'active'
                        ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30'
                        : 'border-slate-800 bg-slate-900/10 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-indigo-400/80 font-bold">Active</div>
                    <div className="text-[11px] font-extrabold text-indigo-300 mt-0.5">{globalActive}</div>
                  </button>
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'blocked' ? 'all' : 'blocked')}
                    className={`rounded border p-1 text-left flex flex-col justify-between transition-all ${
                      commitmentFocusFilter === 'blocked'
                        ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500/30'
                        : 'border-slate-800 bg-slate-900/10 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-red-400/80 font-bold">Blocked</div>
                    <div className="text-[11px] font-extrabold text-red-300 mt-0.5">{globalBlocked}</div>
                  </button>
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'at_risk' ? 'all' : 'at_risk')}
                    className={`rounded border p-1 text-left flex flex-col justify-between transition-all ${
                      commitmentFocusFilter === 'at_risk'
                        ? 'border-amber-500 bg-amber-950/40 ring-1 ring-amber-500/30'
                        : 'border-slate-800 bg-slate-900/10 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-amber-400/80 font-bold">At Risk</div>
                    <div className="text-[11px] font-extrabold text-amber-300 mt-0.5">{globalLowConf}</div>
                  </button>
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'completed' ? 'all' : 'completed')}
                    className={`rounded border p-1 text-left flex flex-col justify-between transition-all ${
                      commitmentFocusFilter === 'completed'
                        ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500/30'
                        : 'border-slate-800 bg-slate-900/10 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-emerald-400/80 font-bold">Completed</div>
                    <div className="text-[11px] font-extrabold text-emerald-300 mt-0.5">{globalCompleted}</div>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Runtime Exposure Rollup */}
          {(() => {
            const isRuntimeDegraded = bellowsRuntime.label === 'Stale' || bellowsRuntime.label === 'Degraded' || bellowsRuntime.label === 'Unavailable';

            const projectsWithActiveExposed = projects.filter(p => 
              (p.commitments || []).some(c => c.commitment_state === 'active')
            ).length;

            const projectsWithLowConfExposed = projects.filter(p => 
              (p.commitments || []).some(c => c.commitment_state === 'active' && c.confidence === 'low')
            ).length;

            const activeCount = isRuntimeDegraded ? projectsWithActiveExposed : 0;
            const lowConfCount = isRuntimeDegraded ? projectsWithLowConfExposed : 0;

            const conditionColors: Record<string, string> = {
              Calm: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40',
              Stale: 'text-amber-400 bg-amber-950/20 border-amber-900/40',
              Degraded: 'text-red-400 bg-red-950/20 border-red-900/40',
              Unavailable: 'text-slate-400 bg-slate-950/20 border-slate-800'
            };

            const activeFocusClass = commitmentFocusFilter === 'active' 
              ? 'ring-1 ring-indigo-500/40 bg-indigo-950/20 border-indigo-800' 
              : 'border-slate-800 hover:border-slate-700/80 bg-slate-900/10';
            const riskFocusClass = commitmentFocusFilter === 'at_risk' 
              ? 'ring-1 ring-amber-500/40 bg-amber-950/20 border-amber-800' 
              : 'border-slate-800 hover:border-slate-700/80 bg-slate-900/10';

            return (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 mb-2">
                  <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Runtime Exposure
                  </h4>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono border ${conditionColors[bellowsRuntime.label] || 'text-slate-400 border-slate-800'}`}>
                    {bellowsRuntime.label}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'active' ? 'all' : 'active')}
                    className={`rounded border p-2 text-left flex items-center justify-between transition-all ${activeFocusClass}`}
                  >
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Active Exposed</span>
                    <span className="text-[10px] font-mono font-extrabold text-slate-200">{activeCount} {activeCount === 1 ? 'project' : 'projects'}</span>
                  </button>
                  <button
                    onClick={() => setCommitmentFocusFilter(commitmentFocusFilter === 'at_risk' ? 'all' : 'at_risk')}
                    className={`rounded border p-2 text-left flex items-center justify-between transition-all ${riskFocusClass}`}
                  >
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">Low-Confidence Exposed</span>
                    <span className="text-[10px] font-mono font-extrabold text-slate-200">{lowConfCount} {lowConfCount === 1 ? 'project' : 'projects'}</span>
                  </button>
                </div>
                {isRuntimeDegraded ? (
                  (activeCount > 0 || lowConfCount > 0) ? (
                    <div className="mt-2 text-[8px] leading-normal text-amber-400/80 font-sans border-t border-slate-800/40 pt-1.5">
                      Advisory: {activeCount} active / {lowConfCount} at-risk projects exposed. Verify commitment context.
                    </div>
                  ) : (
                    <div className="mt-2 text-[8px] leading-normal text-slate-500 font-sans border-t border-slate-800/40 pt-1.5 italic">
                      No projects are currently affected by degraded state.
                    </div>
                  )
                ) : (
                  <div className="mt-2 text-[8px] leading-normal text-slate-500 font-sans border-t border-slate-800/40 pt-1.5 italic">
                    Bellows state is calm. No active exposures.
                  </div>
                )}
              </div>
            );
          })()}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-1.5 mb-2">
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Resume Work
                </h4>
                <div className="mt-1 text-[10px] text-slate-500">
                  Start where a project changed, stalled, or still needs review.
                </div>
              </div>
              <span className="rounded border border-slate-800 bg-slate-900/40 px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                {dailyWorkQueue.length} queued
              </span>
            </div>
            {dailyWorkQueue.length === 0 ? (
              <div className="rounded border border-dashed border-slate-800 px-3 py-4 text-[11px] text-slate-500">
                No resume items yet. Capture something or record a next step to build momentum here.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {dailyWorkQueue.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleOpenDailyWorkItem(item)}
                    className={`rounded-lg border p-2.5 text-left transition-colors hover:border-slate-600 ${item.accentClasses} ${
                      effectiveSelectedProjectId === item.projectId ? 'ring-1 ring-indigo-500/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">{item.reason}</div>
                        <div className="mt-1 truncate text-sm font-bold text-slate-100">{item.projectTitle}</div>
                      </div>
                      <span className="rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-400">
                        {item.category}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] leading-relaxed text-slate-300">{item.detail}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500">
                        Updated {formatTimestamp(item.updatedAt)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-200">
                        {item.actionLabel}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {commitmentFocusFilter !== 'all' && (
            <div className="flex items-center justify-between rounded-lg bg-slate-950/30 px-3 py-1.5 text-[9px] border border-slate-800/40 font-mono">
              <span className="text-slate-400 font-bold">
                Focus: <span className="text-slate-200 capitalize">{commitmentFocusFilter.replace('_', ' ')}</span>
              </span>
              <button 
                onClick={() => setCommitmentFocusFilter('all')} 
                className="text-slate-500 hover:text-slate-300 transition-colors uppercase font-bold text-[8px] tracking-wider"
              >
                Clear
              </button>
            </div>
          )}

          {displayedProjects.map((project) => {
            const pCommitments = project.commitments || [];
            const activeCount = pCommitments.filter((c) => c.commitment_state === 'active').length;
            const blockedCount = pCommitments.filter((c) => c.commitment_state === 'blocked').length;
            const lowConfCount = pCommitments.filter((c) => c.commitment_state === 'active' && c.confidence === 'low').length;
            const completedCount = pCommitments.filter((c) => c.commitment_state === 'completed').length;

            const isRuntimeDegraded = bellowsRuntime.label === 'Stale' || bellowsRuntime.label === 'Degraded' || bellowsRuntime.label === 'Unavailable';
            const hasActiveCommitments = activeCount > 0;
            const hasLowConfCommitments = lowConfCount > 0;

            const isExposedActive = isRuntimeDegraded && hasActiveCommitments;
            const isExposedLowConf = isRuntimeDegraded && hasLowConfCommitments;

            let rowExposureMarker = null;
            let borderAccentClass = "";

            if (isExposedLowConf) {
              rowExposureMarker = { label: 'Low Confidence', bg: 'bg-amber-950/30 text-amber-300 border-amber-800/40' };
              borderAccentClass = "border-amber-900/40 bg-amber-950/5 hover:border-amber-800/60";
            } else if (isExposedActive) {
              rowExposureMarker = { label: 'Runtime Exposed', bg: 'bg-red-950/20 text-red-300 border-red-900/30' };
              borderAccentClass = "border-red-900/40 bg-red-950/5 hover:border-red-800/60";
            }

            const isMatching = isProjectMatchingFilter(project);
            const fadeClass = !isMatching && commitmentFocusFilter !== 'all' 
              ? 'opacity-35 hover:opacity-80' 
              : 'opacity-100';

            return (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`flex flex-col rounded-xl border p-4 text-left transition-all ${fadeClass} ${
                  effectiveSelectedProjectId === project.id
                    ? 'border-slate-600 bg-slate-800 shadow-md'
                    : borderAccentClass
                      ? borderAccentClass
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="truncate font-bold text-slate-200">{project.title}</span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                      {project.category}
                    </span>
                    {rowExposureMarker && (
                      <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${rowExposureMarker.bg}`}>
                        {rowExposureMarker.label}
                      </span>
                    )}
                  </div>
                </div>
                <span className="mt-1 line-clamp-2 text-xs text-slate-400">{project.description}</span>

                {pCommitments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1 border-t border-slate-800/40 pt-2">
                    {activeCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-950/40 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300 border border-indigo-900/30">
                        Act: {activeCount}
                      </span>
                    )}
                    {blockedCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-950/40 px-1.5 py-0.5 text-[9px] font-bold text-red-300 border border-red-900/30">
                        Blk: {blockedCount}
                      </span>
                    )}
                    {lowConfCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-900/30">
                        Risk: {lowConfCount}
                      </span>
                    )}
                    {completedCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-900/30">
                        Done: {completedCount}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusClasses(project.status)}`}>
                    {project.status}
                  </span>
                </div>
              </button>
            );
          })}
          {projects.length === 0 && (
            <div className="rounded border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              No projects found.
            </div>
          )}
        </aside>

        <section className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
          {!selectedProject ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-500">
              <span className="mb-2 text-lg">Select a Project</span>
              <span className="text-sm">Review project context, progress updates, evidence items, and discussion.</span>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-800 bg-slate-900/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                        {selectedProject.category}
                      </span>
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusClasses(selectedProject.status)}`}>
                        {selectedProject.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">{selectedProject.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{selectedProject.description}</p>
                    {(() => {
                      const isRuntimeDegraded = bellowsRuntime.label === 'Stale' || bellowsRuntime.label === 'Degraded' || bellowsRuntime.label === 'Unavailable';
                      if (!isRuntimeDegraded) return null;

                      const pCommitments = selectedProject.commitments || [];
                      const hasLowConf = pCommitments.some(c => c.commitment_state === 'active' && c.confidence === 'low');
                      const hasActive = pCommitments.some(c => c.commitment_state === 'active');

                      if (!hasLowConf && !hasActive) return null;

                      let stripMessage = '';
                      let stripColorClass = '';

                      if (bellowsRuntime.label === 'Unavailable') {
                        stripMessage = 'Bellows state is unavailable; review current commitments before advancing work.';
                        stripColorClass = 'bg-slate-900/50 text-slate-300 border-slate-700';
                      } else if (hasLowConf) {
                        stripMessage = 'Low-confidence commitments are exposed under current Bellows conditions.';
                        stripColorClass = 'bg-amber-950/30 text-amber-300 border-amber-900/40';
                      } else {
                        stripMessage = 'Active commitments may require manual verification.';
                        stripColorClass = 'bg-red-950/20 text-red-300 border-red-900/30';
                      }

                      return (
                        <div className={`mt-3 inline-flex items-center gap-2 rounded border px-2.5 py-1.5 ${stripColorClass}`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 border-r border-current pr-2">Runtime Exposure</span>
                          <span className="text-xs font-medium opacity-90">{stripMessage}</span>
                        </div>
                      );
                    })()}
                    {(() => {
                      const selCommitments = selectedProject.commitments || [];
                      const active = selCommitments.filter((c) => c.commitment_state === 'active').length;
                      const blocked = selCommitments.filter((c) => c.commitment_state === 'blocked').length;
                      const lowConf = selCommitments.filter((c) => c.commitment_state === 'active' && c.confidence === 'low').length;
                      const completed = selCommitments.filter((c) => c.commitment_state === 'completed').length;

                      if (selCommitments.length === 0) return null;

                      return (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded border border-indigo-900/40 bg-indigo-950/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            Active: {active}
                          </span>
                          {blocked > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded border border-red-900/40 bg-red-950/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                              Blocked: {blocked}
                            </span>
                          )}
                          {lowConf > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded border border-amber-900/40 bg-amber-950/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              At Risk: {lowConf}
                            </span>
                          )}
                          {completed > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              Completed: {completed}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-right text-xs uppercase tracking-widest text-slate-500">
                    <div>Last Updated</div>
                    <div className="mt-1 text-slate-300 normal-case tracking-normal">{formatTimestamp(selectedProject.updated_at)}</div>
                  </div>
                </div>

                {selectedProject.pinned_note && (
                  <div className="mt-4 flex items-start gap-3 rounded border border-indigo-900/50 bg-indigo-900/20 p-3">
                    <span className="font-bold text-indigo-400">PINNED</span>
                    <span className="text-sm text-indigo-200">{selectedProject.pinned_note}</span>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 rounded border border-emerald-900/50 bg-emerald-950/20 p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Next Step</span>
                    {!editingNextStep ? (
                      <button 
                        onClick={() => {
                          setActiveNextStepInput(selectedProject.next_step || '');
                          setEditingNextStep(true);
                        }}
                        className="text-[10px] text-emerald-500 hover:text-emerald-300 font-bold uppercase tracking-wider transition-colors"
                      >
                        Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingNextStep(false)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 uppercase tracking-wider"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            updateNextStep(selectedProject.id, activeNextStepInput);
                            setEditingNextStep(false);
                          }}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                  {!editingNextStep ? (
                <div id="project-next-step" className="text-sm text-emerald-100/90">{selectedProject.next_step || <span className="italic text-emerald-900/60">No next step defined.</span>}</div>
                  ) : (
                    <input 
                      type="text"
                      autoFocus
                      value={activeNextStepInput}
                      onChange={(e) => setActiveNextStepInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateNextStep(selectedProject.id, activeNextStepInput);
                          setEditingNextStep(false);
                        } else if (e.key === 'Escape') {
                          setEditingNextStep(false);
                        }
                      }}
                      className="w-full bg-slate-900 border border-emerald-900/50 rounded px-2 py-1 text-sm text-emerald-100 outline-none focus:border-emerald-500"
                      placeholder="e.g. Verify tendon routing before frame assembly"
                    />
                  )}
                </div>

                <div id="project-capture-inbox" className="mt-4 rounded border border-sky-900/40 bg-sky-950/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-900/30 pb-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Capture Inbox</div>
                      <div className="mt-1 text-xs text-sky-100/70">
                        Drop raw project inputs here now, then review and promote them later.
                      </div>
                    </div>
                    <div className="text-right text-[10px] uppercase tracking-widest text-sky-200/70">
                      <div>{captureInboxItems.length} in inbox</div>
                      <div className="mt-1 text-slate-400">{(selectedProject.capture_items || []).length} total captured</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.25fr)]">
                    <div className="rounded border border-sky-900/30 bg-slate-950/40 p-3">
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-sky-400">Quick Add</div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Type</label>
                            <select
                              value={captureType}
                              onChange={(event) => setCaptureType(event.target.value as ProjectCaptureType)}
                              className="rounded border border-slate-700 bg-slate-950 p-2 text-xs font-bold uppercase tracking-widest text-slate-300 outline-none focus:border-sky-500"
                            >
                              <option value="text_note">Text Note</option>
                              <option value="link">Link</option>
                              <option value="file_reference">File Reference</option>
                              <option value="raw_snippet">Raw Snippet</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Title</label>
                            <input
                              type="text"
                              value={captureTitle}
                              onChange={(event) => setCaptureTitle(event.target.value)}
                              placeholder="Short label for this capture"
                              className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {captureType === 'link'
                              ? 'Link'
                              : captureType === 'file_reference'
                                ? 'Reference'
                                : captureType === 'raw_snippet'
                                  ? 'Snippet'
                                  : 'Note'}
                          </label>
                          <textarea
                            value={captureContent}
                            onChange={(event) => setCaptureContent(event.target.value)}
                            placeholder={
                              captureType === 'link'
                                ? 'Paste a link to save for later.'
                                : captureType === 'file_reference'
                                  ? 'Paste a file name, path, or upload note.'
                                  : captureType === 'raw_snippet'
                                    ? 'Paste JSON, logs, or a raw snippet.'
                                    : 'Drop a quick note before it disappears.'
                            }
                            className="min-h-[88px] resize-none rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Optional Note</label>
                          <input
                            type="text"
                            value={captureNote}
                            onChange={(event) => setCaptureNote(event.target.value)}
                            placeholder="Why this matters or what to do with it later"
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleAddCaptureItem}
                            disabled={!captureTitle.trim() && !captureContent.trim()}
                            className="rounded border border-sky-700 bg-sky-950/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-300 transition-colors hover:bg-sky-900/40 disabled:border-slate-800 disabled:bg-slate-950/40 disabled:text-slate-500"
                          >
                            Save to Inbox
                          </button>
                          <button
                            onClick={resetCaptureComposer}
                            className="rounded border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded border border-sky-900/30 bg-slate-950/40 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Recent Captures</div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-500">Collect now, sort later</div>
                      </div>
                      {captureInboxItems.length === 0 ? (
                        <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                          Nothing is waiting in the inbox. Drop in a note, link, file reference, or snippet to get the room moving.
                        </div>
                      ) : (
                        <div className="flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
                          {captureInboxItems.map((capture) => (
                            <div key={capture.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-bold text-slate-100">{capture.title}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                    {capture.capture_type.replace('_', ' ')} | {formatTimestamp(capture.created_at)}
                                  </div>
                                </div>
                                <span className="rounded border border-sky-900/30 bg-sky-950/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-sky-300">
                                  inbox
                                </span>
                              </div>
                              <div className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{capture.content}</div>
                              {capture.note && (
                                <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-400">
                                  {capture.note}
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => handlePromoteCaptureToArtifact(capture)}
                                  className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                >
                                  Promote to Artifact
                                </button>
                                <button
                                  onClick={() => handlePromoteCaptureToDecisionDraft(capture)}
                                  className="rounded border border-emerald-800 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40"
                                >
                                  Promote to Decision
                                </button>
                                <button
                                  onClick={() => handlePromoteCaptureToCommitmentDraft(capture)}
                                  className="rounded border border-amber-800 bg-amber-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-900/40"
                                >
                                  Promote to Commitment
                                </button>
                                <button
                                  onClick={() => handlePromoteCaptureToContext(capture)}
                                  className="rounded border border-teal-800 bg-teal-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-300 transition-colors hover:bg-teal-900/40"
                                >
                                  Promote to Context
                                </button>
                                <button
                                  onClick={() => handleDismissCaptureItem(capture)}
                                  className="rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                                >
                                  Dismiss
                                </button>
                              </div>

                              {promotingCaptureId === capture.id && (
                                <div className="mt-4 border-t border-indigo-900/50 pt-4 text-xs">
                                  <div className="mb-3 rounded border border-amber-900/30 bg-amber-950/20 p-2.5">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                                      <span>⚡ Signed Handoff & Promotion Loop</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                                      Promoting this inbox item into a formal project asset requires a signed peer or steward seal. Select a signatory handle to authorize and sign the promotion payload.
                                    </p>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Authorized Signatory
                                      </label>
                                      <select
                                        value={promotingSigner}
                                        onChange={(e) => setPromotingSigner(e.target.value)}
                                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                      >
                                        {vesselMembers.map((handle) => (
                                          <option key={handle} value={handle}>
                                            {handle}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Asset Target Type
                                      </label>
                                      <div className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 font-mono text-indigo-400 uppercase font-bold text-[10px] tracking-wider">
                                        {promotingTargetType}
                                      </div>
                                    </div>
                                  </div>

                                  {promotingTargetType === 'artifact' && (
                                    <div className="mt-3 space-y-3 border-t border-slate-900 pt-3">
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Artifact Title
                                        </label>
                                        <input
                                          type="text"
                                          value={promotingArtifactTitle}
                                          onChange={(e) => setPromotingArtifactTitle(e.target.value)}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Artifact Type
                                          </label>
                                          <select
                                            value={promotingArtifactType}
                                            onChange={(e) => setPromotingArtifactType(e.target.value)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="text_note">Text Note</option>
                                            <option value="link">Link</option>
                                            <option value="file_reference">File Reference</option>
                                            <option value="raw_snippet">Raw Snippet</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Artifact Summary / Content
                                        </label>
                                        <textarea
                                          value={promotingArtifactSummary}
                                          onChange={(e) => setPromotingArtifactSummary(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {promotingTargetType === 'decision' && (
                                    <div className="mt-3 space-y-3 border-t border-slate-900 pt-3">
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Decision Title
                                        </label>
                                        <input
                                          type="text"
                                          value={promotingDecisionTitle}
                                          onChange={(e) => setPromotingDecisionTitle(e.target.value)}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Decision State
                                          </label>
                                          <select
                                            value={promotingDecisionState}
                                            onChange={(e) => setPromotingDecisionState(e.target.value as DecisionState)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="proposed">Proposed</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="deferred">Deferred</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Impact Note (Optional)
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingDecisionImpact}
                                            onChange={(e) => setPromotingDecisionImpact(e.target.value)}
                                            placeholder="e.g. affect nursery shelf capacity, schema versioning"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Decision Rationale
                                        </label>
                                        <textarea
                                          value={promotingDecisionRationale}
                                          onChange={(e) => setPromotingDecisionRationale(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {promotingTargetType === 'commitment' && (
                                    <div className="mt-3 space-y-3 border-t border-slate-900 pt-3">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Commitment Title
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingCommitmentTitle}
                                            onChange={(e) => setPromotingCommitmentTitle(e.target.value)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Work Package ID / Name (Optional)
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingCommitmentWorkPackage}
                                            onChange={(e) => setPromotingCommitmentWorkPackage(e.target.value)}
                                            placeholder="e.g. wp-nursery-accessions"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            State
                                          </label>
                                          <select
                                            value={promotingCommitmentState}
                                            onChange={(e) => setPromotingCommitmentState(e.target.value as CommitmentState)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="proposed">Proposed</option>
                                            <option value="active">Active</option>
                                            <option value="blocked">Blocked</option>
                                            <option value="completed">Completed</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Confidence
                                          </label>
                                          <select
                                            value={promotingCommitmentConfidence}
                                            onChange={(e) => setPromotingCommitmentConfidence(e.target.value as 'high' | 'medium' | 'low')}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Constraints (Optional)
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingCommitmentConstraints}
                                            onChange={(e) => setPromotingCommitmentConstraints(e.target.value)}
                                            placeholder="Time, hardware limits, dependencies"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Next Action
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingCommitmentNextAction}
                                            onChange={(e) => setPromotingCommitmentNextAction(e.target.value)}
                                            placeholder="What is the next single-cycle move?"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Done When Criterion
                                          </label>
                                          <input
                                            type="text"
                                            value={promotingCommitmentDoneWhen}
                                            onChange={(e) => setPromotingCommitmentDoneWhen(e.target.value)}
                                            placeholder="Clear verification criteria"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>

                                      {promotingCommitmentState === 'blocked' && (
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Blocker Note
                                          </label>
                                          <textarea
                                            value={promotingCommitmentBlockerNote}
                                            onChange={(e) => setPromotingCommitmentBlockerNote(e.target.value)}
                                            rows={2}
                                            placeholder="Describe the blocker details..."
                                            className="w-full rounded border border-red-900/50 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-red-500"
                                          />
                                        </div>
                                      )}

                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Commitment Rationale
                                        </label>
                                        <textarea
                                          value={promotingCommitmentRationale}
                                          onChange={(e) => setPromotingCommitmentRationale(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {promotingTargetType === 'context' && (
                                    <div className="mt-3 space-y-3 border-t border-slate-900 pt-3">
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Context Proposal Title
                                        </label>
                                        <input
                                          type="text"
                                          value={promotingContextTitle}
                                          onChange={(e) => setPromotingContextTitle(e.target.value)}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Context Type
                                          </label>
                                          <select
                                            value={promotingContextType}
                                            onChange={(e) => setPromotingContextType(e.target.value as ProjectContextType)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="working_note">Working Note</option>
                                            <option value="constraint">Constraint / Guardrail</option>
                                            <option value="decision">Decision Statement</option>
                                            <option value="assumption">Active Assumption</option>
                                            <option value="warning">Systemic Warning</option>
                                            <option value="requirement">Handoff Requirement</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Context Body Content
                                        </label>
                                        <textarea
                                          value={promotingContextBody}
                                          onChange={(e) => setPromotingContextBody(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                        />
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-4 flex items-center justify-between border-t border-slate-900 pt-3">
                                    <div className="text-[10px] text-slate-400 italic">
                                      A simulated digital seal will be auto-generated for <span className="font-mono text-indigo-400 font-bold">{promotingSigner}</span>.
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setPromotingCaptureId(null);
                                          setPromotingTargetType(null);
                                        }}
                                        className="rounded border border-slate-750 bg-slate-950/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-900/60"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleConfirmSignedPromotion(capture.id)}
                                        className="rounded border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 hover:bg-indigo-900/60"
                                      >
                                        Confirm Signed Promotion
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded border border-fuchsia-900/40 bg-fuchsia-950/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-fuchsia-900/30 pb-3">
                    <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Project Brief</div>
                          <div className="mt-1 text-xs text-fuchsia-100/70">
                        A concise project summary built from memory, evidence, decisions, commitments, and runtime context.
                          </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleExportProjectBrief}
                        className="rounded border border-fuchsia-800 bg-fuchsia-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-900/40"
                      >
                        Export Brief
                      </button>
                      <button
                        onClick={handleRecordProjectBriefArtifact}
                        className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                      >
                        Save Brief
                      </button>
                      <button
                        onClick={handlePrintProjectBrief}
                        className="rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-900/70"
                      >
                        Print Brief
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded border border-fuchsia-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Current Brief</div>
                      <ul className="mt-2 space-y-1 text-sm text-fuchsia-50/85">
                        {projectBrief.currentBrief.map((item, index) => (
                          <li key={`brief-current-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-fuchsia-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Carry Forward</div>
                      <ul className="mt-2 space-y-1 text-sm text-fuchsia-50/85">
                        {projectBrief.carryForward.map((item, index) => (
                          <li key={`brief-forward-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-fuchsia-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Review Pressure</div>
                      <ul className="mt-2 space-y-1 text-sm text-fuchsia-50/85">
                        {projectBrief.reviewPressure.map((item, index) => (
                          <li key={`brief-pressure-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-fuchsia-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">Artifact Readiness</div>
                      <ul className="mt-2 space-y-1 text-sm text-fuchsia-50/85">
                        {projectBrief.artifactReadiness.map((item, index) => (
                          <li key={`brief-artifact-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-fuchsia-100/70">
                    Built from current project data, activity, runtime context, and attached artifacts. No external model call or sync involved.
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded border border-sky-900/40 bg-sky-950/10 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Top Signal</div>
                    <div className="mt-2 text-sm text-sky-50/85">{projectRelevance.topSignal}</div>
                  </div>
                  <div className="rounded border border-amber-900/40 bg-amber-950/10 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Open Signal</div>
                    <div className="mt-2 text-sm text-amber-50/85">{projectRelevance.unresolvedSignal}</div>
                  </div>
                  <div className="rounded border border-violet-900/40 bg-violet-950/10 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Latest Artifact</div>
                    <div className="mt-2 text-sm text-violet-50/85">{projectRelevance.latestArtifact}</div>
                  </div>
                  <div className="rounded border border-indigo-900/40 bg-indigo-950/10 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Return Focus</div>
                    <div className="mt-2 text-sm text-indigo-50/85">{projectRelevance.returnFocus}</div>
                  </div>
                </div>

                <div className="mt-4 rounded border border-teal-900/40 bg-teal-950/10 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Project Memory</span>
                    <span className="text-[10px] text-teal-200/70">Quick return context for this project.</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded border border-teal-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Remembered Context</div>
                      <div className="mt-2 text-sm text-teal-50/85">{projectMemory.rememberedContext}</div>
                    </div>
                    <div className="rounded border border-teal-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Current Direction</div>
                      <div className="mt-2 text-sm text-teal-50/85">{projectMemory.currentDirection}</div>
                    </div>
                    <div className="rounded border border-teal-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Open Question</div>
                      <div className="mt-2 text-sm text-teal-50/85">{projectMemory.openQuestion}</div>
                    </div>
                    <div className="rounded border border-teal-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Critical Review Signal</div>
                      <div className="mt-2 text-sm text-teal-50/85">{projectMemory.criticalReviewSignal}</div>
                    </div>
                    <div className="rounded border border-teal-900/30 bg-slate-950/40 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Recent Decision</div>
                      <div className="mt-2 text-sm text-teal-50/85">{projectMemory.recentDecision}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-950/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Bellows State</span>
                      <span className="text-[10px] text-slate-500">Supporting runtime context for this project.</span>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${bellowsRuntime.classes}`}>
                      {bellowsRuntime.label}
                    </span>
                  </div>

                  {!bellowsState ? (
                    <div className="rounded border border-dashed border-slate-800 bg-slate-950/40 p-3 text-sm italic text-slate-500">
                      {bellowsStateError || 'Bellows details are unavailable right now.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Runtime Condition</div>
                        <div className="mt-2 text-sm text-slate-200">{bellowsState.system_status || 'Unknown'}</div>
                        <div className="mt-1 text-xs text-slate-500">{bellowsRuntime.detail}</div>
                      </div>
                      <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Heartbeat</div>
                        <div className="mt-2 text-sm text-slate-200">{bellowsState.current_pulse || 'No recent Bellows state available.'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {bellowsState.last_update ? `Last update: ${formatTimestamp(bellowsState.last_update)}` : 'No recent Bellows state available.'}
                        </div>
                      </div>
                      <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Network Health</div>
                        <div className="mt-2 text-sm text-slate-200">{bellowsState.network_health || 'Unknown'}</div>
                      </div>
                      <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Active Agents</div>
                        <div className="mt-2 text-sm text-slate-200">
                          {bellowsState.active_agents && bellowsState.active_agents.length > 0
                            ? bellowsState.active_agents.join(', ')
                            : 'None recorded'}
                        </div>
                      </div>
                      {(typeof bellowsState.embodiment_goal?.symbolic_cost_ember === 'number' || bellowsState.wallet_balance !== undefined) && (
                        <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Economic State</div>
                          <div className="mt-2 text-sm text-slate-200 flex flex-col gap-1">
                            {bellowsState.wallet_balance !== undefined && (
                              <div>Wallet Balance: <span className="font-mono text-emerald-400">{bellowsState.wallet_balance.toLocaleString()} EMBER</span></div>
                            )}
                            {bellowsState.total_mined !== undefined && (
                              <div>Total Mined: <span className="font-mono text-amber-400">{bellowsState.total_mined.toLocaleString()} EMBER</span></div>
                            )}
                            {bellowsState.embodiment_goal?.symbolic_cost_ember !== undefined && (
                              <div>Symbolic Cost: <span className="font-mono text-slate-400">{bellowsState.embodiment_goal.symbolic_cost_ember.toLocaleString()} EMBER</span></div>
                            )}
                          </div>
                          <div className="mt-2 border-t border-slate-850 pt-1.5 text-[10px] text-slate-500">
                            Target: {bellowsState.embodiment_goal?.target || 'Unitree G1'} ({bellowsState.total_ticks || 0} ticks)
                          </div>
                        </div>
                      )}
                      {(bellowsState.embodiment_goal?.status || bellowsState.latest_receipt_note) && (
                        <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Latest Runtime Note</div>
                          <div className="mt-2 text-sm text-slate-200 leading-relaxed">
                            {bellowsState.latest_receipt_note || bellowsState.embodiment_goal?.status}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {runtimeCommitmentAdvisory && (
                  <div className={`mt-4 rounded border p-3 ${runtimeCommitmentAdvisory.classes}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {runtimeCommitmentAdvisory.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Advisory only. Commitments are not changed automatically.
                      </span>
                    </div>
                    <div className="mt-2 text-sm">{runtimeCommitmentAdvisory.message}</div>
                    <div className="mt-1 text-xs text-slate-400">{runtimeCommitmentAdvisory.detail}</div>
                  </div>
                )}

                {/* Peer Reflections */}
                <div className="mt-4 rounded border border-slate-800 bg-slate-950/20 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Peer Reflections</span>
                      <span className="text-[10px] text-slate-500">Local agent reflections recorded by the Bellows</span>
                    </div>
                  </div>
                  {reflections.length === 0 ? (
                    <div className="text-xs italic text-slate-600 p-2 border border-slate-900/60 rounded bg-slate-950/40">
                      No local agent reflections recorded yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {reflections.map((reflection, idx) => (
                        <div key={`reflection-${idx}`} className="rounded border border-slate-800 bg-slate-950/40 p-2.5 flex flex-col justify-between">
                          <div className="text-xs text-slate-300 font-mono leading-relaxed">
                            "{reflection.content}"
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-900/50 flex items-center justify-between text-[9px] uppercase tracking-wider font-semibold">
                            <span className="text-indigo-400 font-mono">{reflection.agent}</span>
                            <span className="text-slate-500">{reflection.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agent Continuity Summary */}
                <div className="mt-4 flex flex-col gap-2 rounded border border-amber-900/40 bg-amber-950/10 p-3">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Agent Summary</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div className="rounded border border-amber-900/30 bg-slate-950/40 p-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">Current State</div>
                      <ul className="space-y-1 text-sm text-amber-50/85">
                        {agentSummary.currentState.map((item, index) => (
                          <li key={`current-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-amber-900/30 bg-slate-950/40 p-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">Open Attention</div>
                      <ul className="space-y-1 text-sm text-amber-50/85">
                        {agentSummary.openAttention.map((item, index) => (
                          <li key={`attention-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded border border-amber-900/30 bg-slate-950/40 p-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">Suggested Review Focus</div>
                      <ul className="space-y-1 text-sm text-amber-50/85">
                        {agentSummary.suggestedReviewFocus.map((item, index) => (
                          <li key={`focus-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="text-xs text-amber-200/70">
                    Built from project activity, evidence items, and discussion. No external model call.
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Updates</div>
                    <div className="mt-1 text-lg font-bold text-slate-200">{selectedProject.activity?.length || 0}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Discussion</div>
                    <div className="mt-1 text-lg font-bold text-slate-200">{selectedProject.messages.length}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Evidence</div>
                    <div className="mt-1 text-lg font-bold text-slate-200">{selectedProject.artifacts?.length || 0}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Commitments</div>
                    <div className="mt-1 text-lg font-bold text-slate-200">{selectedProject.commitments?.length || 0}</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Project ID</div>
                    <div className="mt-1 truncate text-sm font-bold text-slate-200">{selectedProject.id}</div>
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-950/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Workspace Views</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Move through the daily desk, project record, linked objects, review queue, and handoff without losing context.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleExportProjectRoomDossier}
                        className="rounded border border-fuchsia-800 bg-fuchsia-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-900/40"
                      >
                        Export Handoff Packet
                      </button>
                      <button
                        onClick={handleRecordProjectRoomDossierArtifact}
                        className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                      >
                        Save Handoff Packet
                      </button>
                      <button
                        onClick={handlePrintProjectRoomDossier}
                        className="rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-900/70"
                      >
                        Print Handoff Packet
                      </button>
                      <button
                        onClick={handleExportProjectHandoff}
                        className="rounded border border-emerald-800 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40"
                      >
                        Export Handoff
                      </button>
                      <button
                        onClick={handleSaveProjectHandoffArtifact}
                        className="rounded border border-cyan-800 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-900/40"
                      >
                        Save Checkpoint
                      </button>
                      <button
                        onClick={handlePrintProjectHandoff}
                        className="rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-900/70"
                      >
                        Print Handoff
                      </button>
                      {([
                        { id: 'desk', label: 'Desk' },
                        { id: 'overview', label: 'Overview' },
                        { id: 'context', label: 'Accepted Context' },
                        { id: 'frames', label: 'Sections' },
                        { id: 'room', label: 'Links' },
                        { id: 'review', label: 'Review Queue' },
                        { id: 'handoff', label: 'Handoff' }
                      ] as Array<{ id: ProjectViewMode; label: string }>).map((view) => {
                        const active = projectViewMode === view.id;
                        return (
                          <button
                            key={view.id}
                            onClick={() => setProjectViewMode(view.id)}
                            className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                              active
                                ? 'border-indigo-700 bg-indigo-950/30 text-indigo-300'
                                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {view.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {projectViewMode === 'desk' && (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.25fr),minmax(340px,0.95fr)]">
                <div className="flex min-h-0 flex-col border-b border-slate-800 xl:border-b-0 xl:border-r">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Project Desk</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Open the project, see what changed, and take the next useful action without hunting.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-5">
                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Checkpoint</div>
                            <div className="mt-1 text-sm font-bold text-slate-100">{latestReviewPacket ? formatTimestamp(latestReviewPacket.timestamp) : 'No checkpoint saved yet.'}</div>
                            <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Goal</div>
                            <div className="mt-1 text-sm text-slate-300">
                              {selectedProject?.next_step?.trim() || selectedProject?.description || 'No goal recorded yet.'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!latestReviewPacket && handoffReadiness.ready && (
                              <button
                                onClick={handleSaveProjectHandoffArtifact}
                                className="rounded border border-cyan-800 bg-cyan-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-900/40"
                              >
                                Save First Checkpoint
                              </button>
                            )}
                            <button
                              onClick={handleResumeDesk}
                              className="rounded border border-indigo-800 bg-indigo-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                            >
                              Resume
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 rounded border border-slate-800 bg-slate-950/50 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">What Changed Since Last Packet</div>
                          <div className="mt-2 text-sm text-slate-200">{reviewPacketDelta.summary}</div>
                          <ul className="mt-3 space-y-2 text-sm text-slate-300">
                            {(reviewPacketDelta.changeLines.length > 0
                              ? reviewPacketDelta.changeLines.slice(0, 5)
                              : [reviewPacketDelta.readinessImpact]
                            ).map((line) => (
                              <li key={line} className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div
                        ref={nextActionCardRef}
                        tabIndex={-1}
                        className="rounded border border-indigo-900/40 bg-indigo-950/10 p-5 outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Next Action</div>
                            <div className="mt-2 text-lg font-bold text-slate-100">
                              {deskNextAction?.title || 'No next action derived yet.'}
                            </div>
                            <div className="mt-3 text-sm leading-6 text-slate-300">
                              {deskNextAction?.explanation || 'Capture a project input or record a next step to get the loop moving.'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {deskNextAction && (
                              <button
                                onClick={() => handleDeskNextAction(deskNextAction)}
                                className="rounded border border-indigo-700 bg-indigo-900/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100 transition-colors hover:bg-indigo-800/50"
                              >
                                {deskNextAction.actionLabel}
                              </button>
                            )}
                            {deskNextAction?.secondaryActionLabel && (
                              <button
                                onClick={handleDeskSecondaryAction}
                                className="rounded border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                              >
                                {deskNextAction.secondaryActionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded border border-sky-900/30 bg-sky-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                            Inbox {captureInboxItems.length}
                          </span>
                          <span className="rounded border border-amber-900/30 bg-amber-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                            Needs Review {flaggedArtifacts.length + pendingArtifacts.length}
                          </span>
                          <span className="rounded border border-emerald-900/30 bg-emerald-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                            Ready {approvedArtifacts.length + acceptedDecisions.length + activeCommitments.length}
                          </span>
                        </div>
                      </div>

                      {isEarlyProject && (
                        <div className="rounded border border-sky-900/30 bg-sky-950/10 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Quick Start</div>
                          <div className="mt-2 text-sm text-slate-200">
                            A useful project usually starts with one captured input, one reviewed evidence item, one decision, and one commitment.
                          </div>
                          <div className="mt-4">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Guided Templates</div>
                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                              {Object.values(PROJECT_TEMPLATES).map((template) => (
                                <button
                                  key={template.key}
                                  onClick={() => handleApplyProjectTemplate(template.key)}
                                  className="rounded border border-sky-900/20 bg-slate-950/40 px-3 py-3 text-left transition-colors hover:border-sky-700/40 hover:bg-sky-950/10"
                                >
                                  <div className="text-xs font-bold uppercase tracking-widest text-sky-200">{template.label}</div>
                                  <div className="mt-2 text-sm text-slate-300">{template.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {[
                              'Capture one note, link, file reference, or snippet.',
                              'Review that evidence and mark it approved or flagged.',
                              'Record one decision based on the evidence.',
                              'Turn the decision into one commitment and save a checkpoint.'
                            ].map((line) => (
                              <div key={line} className="rounded border border-sky-900/20 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <details className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Details</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Journal notes, daily note actions, and secondary project context.
                              </div>
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">
                              Open only when you need more context
                            </div>
                          </div>
                        </summary>
                        <div className="mt-4 flex flex-col gap-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={handleCopyDailyNote}
                              className="rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                            >
                              Copy Daily Note
                            </button>
                            <button
                              onClick={handleExportDailyNote}
                              className="rounded border border-fuchsia-800 bg-fuchsia-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-900/40"
                            >
                              Export Daily Note
                            </button>
                            <button
                              onClick={handleSaveDailyNoteArtifact}
                              className="rounded border border-cyan-800 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-900/40"
                            >
                              Save Daily Note
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr),minmax(280px,0.9fr)]">
                            <div className="rounded border border-slate-800 bg-slate-950/50 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Today</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {stewardshipJournal.todaySummary.length > 0 ? (
                                  stewardshipJournal.todaySummary.map((summary) => (
                                    <span key={summary} className="rounded border border-sky-900/30 bg-sky-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
                                      {summary}
                                    </span>
                                  ))
                                ) : (
                                  <span className="rounded border border-slate-800 bg-slate-950/50 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500">
                                    No movement recorded today
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 space-y-2">
                                {stewardshipJournal.recentEntries.slice(0, 3).map((entry) => (
                                  <div key={entry.id} className="rounded border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm text-slate-300">
                                    <div className="font-bold text-slate-200">{entry.title}</div>
                                    <div className="mt-1">{entry.detail}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded border border-emerald-900/30 bg-emerald-950/10 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Next Steps</div>
                              <div className="mt-3 space-y-2">
                                {stewardshipJournal.carryForward.map((line) => (
                                  <div key={line} className="rounded border border-emerald-900/20 bg-slate-950/30 px-3 py-3 text-sm text-slate-200">
                                    {line}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Handoff</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Save checkpoints, compile the latest handoff, and copy the current project summary forward.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-4">
                      {isSavingCheckpoint && (
                        <div className="rounded border border-cyan-900/50 bg-cyan-950/20 p-4 text-xs">
                          <div className="mb-3 rounded border border-amber-900/30 bg-amber-950/20 p-2.5">
                            <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                              <span>✍️ Sign and Seal Handoff Checkpoint</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
                              Compiling a handoff checkpoint records a signed snapshot of active evidence, decisions, and commitments. Provide a signatory handle and context rationale.
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Checkpoint Title / Identifier
                              </label>
                              <input
                                type="text"
                                value={checkpointMessage}
                                onChange={(e) => setCheckpointMessage(e.target.value)}
                                placeholder="e.g. Checkpoint - WP1 Accessioning Complete"
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Authorized Signer
                                </label>
                                <select
                                  value={checkpointSigner}
                                  onChange={(e) => setCheckpointSigner(e.target.value)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-cyan-500"
                                >
                                  {vesselMembers.map((handle) => (
                                    <option key={handle} value={handle}>
                                      {handle}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Provenance Authority
                                </label>
                                <div className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                                  Air-Gapped Sovereign Seal
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Why It Changed (Context Rationale)
                              </label>
                              <textarea
                                value={checkpointWhyItChanged}
                                onChange={(e) => setCheckpointWhyItChanged(e.target.value)}
                                rows={3}
                                placeholder="Describe the material changes in project assets, new commitments, or key decisions since the last checkpoint..."
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-cyan-500 font-mono"
                              />
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                              <div className="text-[9px] text-slate-400 italic">
                                Cryptographic seal will be signed under <span className="font-mono text-cyan-400 font-bold">{checkpointSigner}</span>.
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setIsSavingCheckpoint(false);
                                    setCheckpointMessage('');
                                    setCheckpointWhyItChanged('');
                                  }}
                                  className="rounded border border-slate-750 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-900/60"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleConfirmSaveCheckpoint}
                                  className="rounded border border-cyan-700 bg-cyan-900/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200 hover:bg-cyan-900/60"
                                >
                                  Confirm & Sign Checkpoint
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className={`rounded border p-4 ${handoffReadiness.ready ? 'border-emerald-900/30 bg-emerald-950/10' : 'border-amber-900/30 bg-amber-950/10'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Handoff Readiness</div>
                            <div className="mt-1 text-sm font-bold text-slate-100">
                              {handoffReadiness.ready ? 'Ready to share forward' : 'Still needs a few calls'}
                            </div>
                          </div>
                          <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${handoffReadiness.ready ? 'border-emerald-800 bg-emerald-950/20 text-emerald-300' : 'border-amber-800 bg-amber-950/20 text-amber-300'}`}>
                            {handoffReadiness.ready ? 'Ready' : `${handoffReadiness.blockers.length} blocker${handoffReadiness.blockers.length === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          {handoffReadiness.blockers.length === 0 ? (
                            <div>Approved evidence, decisions, commitments, and next step are in shape for a useful handoff.</div>
                          ) : (
                            handoffReadiness.blockers.map((blocker) => (
                              <div key={blocker} className="rounded border border-amber-900/20 bg-slate-950/30 px-3 py-2">
                                {blocker}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dual Export</div>
                            <div className="mt-1 text-xs text-slate-500">Use Markdown for people and JSON for agents from the same checkpoint-ready handoff.</div>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Markdown</div>
                            <div className="mt-2 text-xs text-slate-500">Readable handoff for review, copy/paste, and printing.</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={handleCopyProjectHandoffMarkdown}
                                className="rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-900/70"
                              >
                                Copy Markdown
                              </button>
                              <button
                                onClick={handleExportProjectHandoffMarkdown}
                                className="rounded border border-fuchsia-800 bg-fuchsia-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-900/40"
                              >
                                Export Markdown
                              </button>
                              <button
                                onClick={handleSaveProjectHandoffMarkdownArtifact}
                                className="rounded border border-cyan-800 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-900/40"
                              >
                                Save Draft
                              </button>
                            </div>
                          </div>
                          <div className="rounded border border-slate-800 bg-slate-950/50 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">JSON</div>
                            <div className="mt-2 text-xs text-slate-500">Stable agent-readable export with project state, next action, evidence summary, and checkpoint delta.</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={handleCopyProjectHandoffJson}
                                className="rounded border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-200 transition-colors hover:bg-slate-900/70"
                              >
                                Copy JSON
                              </button>
                              <button
                                onClick={handleExportProjectHandoff}
                                className="rounded border border-emerald-800 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40"
                              >
                                Export JSON
                              </button>
                              <button
                                onClick={handleGenerateShareableDossier}
                                className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                              >
                                Copy Share Link
                              </button>
                            </div>
                          </div>
                        </div>
                        <pre className="mt-4 max-h-[740px] overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-[#06090b] p-4 text-[12px] leading-6 text-slate-300">{buildProjectHandoffMarkdown()}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {projectViewMode === 'overview' && (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.4fr),minmax(320px,0.9fr)]">
                <div className="flex min-h-0 flex-col border-b border-slate-800 lg:border-b-0 lg:border-r">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Project Timeline</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Durable updates, review calls, and handoff milestones attached to this project.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    {!selectedProject.activity || selectedProject.activity.length === 0 ? (
                      <div className="py-8 text-center text-sm italic text-slate-500">No project activity recorded yet.</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {selectedProject.activity.map((activity) => (
                          <div key={activity.id} className="relative ml-2 border-l-2 border-slate-800 pl-4">
                            <div className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full border-2 ${getActivityDotClasses(activity.kind)}`} />
                            <div className={`rounded border p-3 ${getActivityClasses(activity.kind)}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-bold">{activity.title}</span>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                                  {formatTimestamp(activity.timestamp)}
                                </span>
                              </div>
                              {activity.detail && <p className="mt-2 text-sm text-slate-300">{activity.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Project Record</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Context, evidence, and discussion attached to the current project record.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-5">
                      {contextEntries.length > 0 && (
                        <div>
                          <h4 className="mb-3 border-b border-slate-800/50 pb-1 text-[10px] uppercase tracking-widest text-slate-500">
                            Project Context
                          </h4>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {contextEntries.map(([key, value]) => (
                              <div key={key} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">{humanizeKey(key)}</div>
                                <div className="mt-1 text-sm text-slate-200">{String(value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div id="project-evidence-review">
                        <h4 className="mb-3 border-b border-slate-800/50 pb-1 text-[10px] uppercase tracking-widest text-slate-500">
                          Evidence Review
                        </h4>
                        {selectedProject.artifacts && selectedProject.artifacts.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                              {selectedProject.artifacts.map((artifact) => {
                                const isSelected = selectedArtifact?.id === artifact.id;
                                return (
                                  <button
                                    key={artifact.id}
                                    onClick={() => setSelectedArtifactId(artifact.id)}
                                    className={`rounded border p-3 text-left transition-colors ${
                                      isSelected
                                        ? 'border-indigo-700 bg-indigo-950/20'
                                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/80'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-bold text-slate-200">{artifact.title}</div>
                                        <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                          {artifact.type} | {formatTimestamp(artifact.timestamp)}
                                        </div>
                                        <div className="mt-2">
                                          <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewOutcomeClasses(artifact)}`}>
                                            {getArtifactReviewOutcomeLabel(artifact)}
                                          </span>
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <span className="rounded border border-indigo-800 bg-indigo-900/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                                          Focused
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {selectedArtifact && (
                              <div className="rounded border border-indigo-900/40 bg-indigo-950/10 p-4">
                                <div className="mb-3 flex items-start justify-between gap-3 border-b border-indigo-900/30 pb-3">
                                  <div>
                                    <div className="text-sm font-bold text-slate-100">{selectedArtifact.title}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                      {selectedArtifact.type} | {formatTimestamp(selectedArtifact.timestamp)}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <span className="rounded border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] uppercase tracking-widest text-slate-300">
                                      {selectedArtifact.source_lane || selectedProject.category}
                                    </span>
                                    <button
                                      onClick={() => seedCommitmentFromArtifact(selectedArtifact)}
                                      className="rounded border border-indigo-800 bg-indigo-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                    >
                                      Promote to Commitment
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Evidence Type</div>
                                    <div className="mt-1 text-sm text-slate-200">{selectedArtifact.type}</div>
                                  </div>
                                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Source Lane</div>
                                    <div className="mt-1 text-sm text-slate-200">{selectedArtifact.source_lane || selectedProject.category}</div>
                                  </div>
                                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Review Outcome</div>
                                    <div className="mt-2">
                                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewOutcomeClasses(selectedArtifact)}`}>
                                        {getArtifactReviewOutcomeLabel(selectedArtifact)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 rounded border border-slate-800 bg-slate-950/40 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Review Decision</div>
                                      <div className="mt-1 text-sm text-slate-300">
                                        {getArtifactReviewOutcomeDetail(selectedArtifact)}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveArtifact(selectedArtifact)}
                                        className="rounded border border-emerald-800 bg-emerald-950/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/30"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFlagArtifact(selectedArtifact)}
                                        className="rounded border border-amber-800 bg-amber-950/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-900/30"
                                      >
                                        Flag
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleResetArtifactReview(selectedArtifact)}
                                        className="rounded border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-800/80"
                                      >
                                        Needs Review
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Review Status</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewStateClasses(selectedArtifact.review_state || 'unreviewed')}`}>
                                          {getArtifactReviewStateLabel(selectedArtifact.review_state || 'unreviewed')}
                                        </span>
                                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewSignalClasses(selectedArtifact.review_signal || 'clear')}`}>
                                          {getArtifactReviewSignalLabel(selectedArtifact.review_signal || 'clear')}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Downstream Use</div>
                                      <div className="mt-2 text-sm text-slate-200">
                                        {isArtifactApproved(selectedArtifact)
                                          ? 'Ready for handoff.'
                                          : isArtifactFlagged(selectedArtifact)
                                            ? 'Hold before handoff.'
                                            : 'Review before handoff.'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 rounded border border-slate-800 bg-slate-900/50 p-3">
                                    <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-2">Comment</label>
                                    <textarea
                                      value={localReviewNote}
                                      onChange={(event) => setLocalReviewNote(event.target.value)}
                                      onBlur={() => {
                                        updateArtifactReviewNote(selectedProject.id, selectedArtifact.id, localReviewNote);
                                      }}
                                      placeholder="Record the review call, concerns, or downstream guidance..."
                                      rows={4}
                                      className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                                    />
                                    <div className="mt-2 flex justify-end">
                                      {localReviewNote !== (selectedArtifact.review_note || '') && (
                                        <button
                                          onClick={() => {
                                            updateArtifactReviewNote(selectedProject.id, selectedArtifact.id, localReviewNote);
                                          }}
                                          className="rounded bg-indigo-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-indigo-500"
                                        >
                                          Save Comment
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="text-[10px] uppercase tracking-widest text-slate-500">Evidence Summary</div>
                                  <div className="mt-1 text-sm text-slate-300">
                                    {selectedArtifact.summary || 'No artifact summary recorded yet.'}
                                  </div>
                                </div>

                                {contextEntries.length > 0 && (
                                  <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
                                    <div className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">Related Project Context</div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {contextEntries.slice(0, 4).map(([key, value]) => (
                                        <div key={`artifact-context-${key}`} className="rounded border border-slate-800 bg-slate-900/70 p-2">
                                          <div className="text-[10px] uppercase tracking-widest text-slate-500">{humanizeKey(key)}</div>
                                          <div className="mt-1 text-sm text-slate-200">{String(value)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                            No evidence items attached yet.
                          </div>
                        )}
                      </div>

                      {/* Decisions Section */}
                      <div id="project-decisions">
                        <div className="mb-3 flex items-center justify-between border-b border-slate-800/50 pb-1">
                          <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            Decisions
                          </h4>
                          <span className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            {(selectedProject.decisions || []).length} Recorded
                          </span>
                        </div>
                        
                        {(!selectedProject.decisions || selectedProject.decisions.length === 0) ? (
                          <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500 italic">
                            No decisions recorded for this project yet. Use the decision composer below to log one.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {selectedProject.decisions.map((decision) => {
                              const decisionArtifact = selectedProject.artifacts?.find(a => a.id === decision.artifact_id);
                              
                              let stateBadgeColor = '';
                              switch (decision.decision_state) {
                                case 'accepted':
                                  stateBadgeColor = 'border-emerald-800 bg-emerald-950/30 text-emerald-400';
                                  break;
                                case 'deferred':
                                  stateBadgeColor = 'border-slate-700 bg-slate-800/50 text-slate-400';
                                  break;
                                case 'proposed':
                                default:
                                  stateBadgeColor = 'border-amber-800 bg-amber-950/30 text-amber-400';
                                  break;
                              }

                              return (
                                <div key={decision.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-900/60 pb-2 mb-2">
                                    <div>
                                      <h5 className="text-sm font-bold text-slate-200">{decision.title}</h5>
                                      <span className="text-[9px] text-slate-500">
                                        {formatTimestamp(decision.timestamp)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${stateBadgeColor}`}>
                                        {decision.decision_state}
                                      </span>
                                      <button
                                        onClick={() => seedCommitmentFromDecision(decision)}
                                        className="rounded border border-indigo-800 bg-indigo-950/30 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                      >
                                        Promote to Commitment
                                      </button>
                                      <button
                                        onClick={() => handlePromoteDecisionToContextPrompt(decision.id)}
                                        className="rounded border border-teal-800 bg-teal-950/30 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-teal-300 transition-colors hover:bg-teal-900/40"
                                      >
                                        Promote to Context
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div>
                                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Rationale</div>
                                      <p className="text-xs text-slate-300 mt-0.5">{decision.rationale}</p>
                                    </div>

                                    {decision.impact_note && (
                                      <div>
                                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Impact</div>
                                        <p className="text-xs text-indigo-300 mt-0.5">{decision.impact_note}</p>
                                      </div>
                                    )}

                                    {decisionArtifact && (
                                      <div className="inline-flex items-center gap-1.5 rounded border border-indigo-900/40 bg-indigo-950/20 px-2 py-1 mt-1 text-[10px] text-indigo-300">
                                        <span className="font-bold">Artifact Link:</span>
                                        <span>{decisionArtifact.title}</span>
                                      </div>
                                    )}
                                  </div>

                                  {promotingDecisionId === decision.id && (
                                    <div className="mt-3 border-t border-teal-900/50 pt-3 text-xs">
                                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                                        Promote Decision to Context
                                      </div>
                                      <div className="flex flex-wrap items-end gap-3">
                                        <div className="flex-1 min-w-[120px]">
                                          <label className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                                            Context Item Type
                                          </label>
                                          <select
                                            value={promotingDecisionContextType}
                                            onChange={(e) => setPromotingDecisionContextType(e.target.value as ProjectContextType)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200 outline-none focus:border-teal-500 text-xs"
                                          >
                                            <option value="working_note">Working Note</option>
                                            <option value="constraint">Constraint / Guardrail</option>
                                            <option value="decision">Decision Statement</option>
                                            <option value="assumption">Active Assumption</option>
                                            <option value="warning">Systemic Warning</option>
                                            <option value="requirement">Handoff Requirement</option>
                                          </select>
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => setPromotingDecisionId(null)}
                                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] uppercase font-bold tracking-widest text-slate-300 hover:bg-slate-900"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleConfirmPromoteDecisionToContext(decision.id)}
                                            className="rounded border border-teal-800 bg-teal-950 px-2 py-1 text-[9px] uppercase font-bold tracking-widest text-teal-300 hover:bg-teal-900/40"
                                          >
                                            Confirm
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div id="project-commitments">
                        <div className="mb-3 flex items-center justify-between border-b border-slate-800/50 pb-1">
                          <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                            Active Commitments
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {(selectedProject.commitments || []).length} Total
                            </span>
                            <button
                              onClick={() => {
                                setIsCreatingCommitment((value) => !value);
                                if (isCreatingCommitment) {
                                  resetCommitmentComposer();
                                }
                              }}
                              className="rounded border border-emerald-800 bg-emerald-950/20 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/30"
                            >
                              {isCreatingCommitment ? 'Close Composer' : 'New Commitment'}
                            </button>
                          </div>
                        </div>

                        {isCreatingCommitment && (
                          <div className="mb-4 rounded border border-emerald-900/40 bg-emerald-950/10 p-4">
                            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                              Commitment Composer
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Title</label>
                                <input
                                  type="text"
                                  value={commitmentTitle}
                                  onChange={(event) => setCommitmentTitle(event.target.value)}
                                  placeholder="e.g. Carry fabrication packet into bench assembly review"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Commitment State</label>
                                <select
                                  value={commitmentState}
                                  onChange={(event) => setCommitmentState(event.target.value as CommitmentState)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 outline-none focus:border-emerald-500"
                                >
                                  <option value="proposed">Proposed</option>
                                  <option value="active">Active</option>
                                  <option value="blocked">Blocked</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Confidence Level</label>
                                <select
                                  value={commitmentConfidence}
                                  onChange={(event) => setCommitmentConfidence(event.target.value as 'high' | 'medium' | 'low')}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 outline-none focus:border-emerald-500"
                                >
                                  <option value="high">High Confidence</option>
                                  <option value="medium">Medium Confidence</option>
                                  <option value="low">Low Confidence</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Linked Artifact (Optional)</label>
                                <select
                                  value={commitmentArtifactId}
                                  onChange={(event) => setCommitmentArtifactId(event.target.value)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500"
                                >
                                  <option value="">None</option>
                                  {(selectedProject.artifacts || []).map((artifact) => (
                                    <option key={artifact.id} value={artifact.id}>
                                      {artifact.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Linked Decision (Optional)</label>
                                <select
                                  value={commitmentDecisionId}
                                  onChange={(event) => setCommitmentDecisionId(event.target.value)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500"
                                >
                                  <option value="">None</option>
                                  {(selectedProject.decisions || []).map((decision) => (
                                    <option key={decision.id} value={decision.id}>
                                      {decision.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Work Package / Deliverable (Optional)</label>
                                <input
                                  type="text"
                                  value={commitmentWorkPackage}
                                  onChange={(event) => setCommitmentWorkPackage(event.target.value)}
                                  placeholder="e.g. SOLIS-ARM-V1.0 assembly module"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Constraints & Boundaries (Optional)</label>
                                <input
                                  type="text"
                                  value={commitmentConstraints}
                                  onChange={(event) => setCommitmentConstraints(event.target.value)}
                                  placeholder="e.g. Max torque 12Nm; Budget limit $150"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Rationale</label>
                                <textarea
                                  value={commitmentRationale}
                                  onChange={(event) => setCommitmentRationale(event.target.value)}
                                  placeholder="Why is this commitment in force now?"
                                  className="min-h-[72px] w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Next Action</label>
                                <input
                                  type="text"
                                  value={commitmentNextAction}
                                  onChange={(event) => setCommitmentNextAction(event.target.value)}
                                  placeholder="Immediate carrying-forward action"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Done When</label>
                                <input
                                  type="text"
                                  value={commitmentDoneWhen}
                                  onChange={(event) => setCommitmentDoneWhen(event.target.value)}
                                  placeholder="What counts as complete?"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Blocker (Optional)</label>
                                <input
                                  type="text"
                                  value={commitmentBlockerNote}
                                  onChange={(event) => setCommitmentBlockerNote(event.target.value)}
                                  placeholder="Only needed if this commitment is blocked or at risk"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                onClick={resetCommitmentComposer}
                                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleCreateCommitment}
                                disabled={!commitmentTitle.trim() || !commitmentRationale.trim() || !commitmentNextAction.trim() || !commitmentDoneWhen.trim()}
                                className="rounded bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500"
                              >
                                Save Commitment
                              </button>
                            </div>
                          </div>
                        )}

                        {sortedCommitments.length === 0 ? (
                          <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500 italic">
                            No commitments recorded yet. Promote a decision or artifact, or create a commitment directly.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {sortedCommitments.map((commitment) => {
                              const linkedArtifact = selectedProject.artifacts?.find((artifact) => artifact.id === commitment.artifact_id);
                              const linkedDecision = selectedProject.decisions?.find((decision) => decision.id === commitment.decision_id);
                              
                              const matchesFocus = (() => {
                                if (commitmentFocusFilter === 'all') return false;
                                if (commitmentFocusFilter === 'active') return commitment.commitment_state === 'active';
                                if (commitmentFocusFilter === 'blocked') return commitment.commitment_state === 'blocked';
                                if (commitmentFocusFilter === 'at_risk') return commitment.commitment_state === 'active' && commitment.confidence === 'low';
                                if (commitmentFocusFilter === 'completed') return commitment.commitment_state === 'completed';
                                return false;
                              })();

                              const isRuntimeDegraded = bellowsRuntime.label === 'Stale' || bellowsRuntime.label === 'Degraded' || bellowsRuntime.label === 'Unavailable';
                              const isExposed = isRuntimeDegraded && commitment.commitment_state === 'active';
                              
                              let exposureBadge = null;
                              if (isExposed) {
                                if (commitment.confidence === 'low') {
                                  exposureBadge = {
                                    label: 'Low-Confidence Exposure',
                                    style: 'bg-amber-950/30 text-amber-300 border-amber-900/40',
                                    detail: 'Review against current Bellows state'
                                  };
                                } else {
                                  exposureBadge = {
                                    label: 'Runtime Exposed',
                                    style: 'bg-red-950/20 text-red-300 border-red-900/30',
                                    detail: 'Review against current Bellows state'
                                  };
                                }
                              }

                              const borderClass = matchesFocus 
                                ? commitmentFocusFilter === 'at_risk'
                                  ? 'border-amber-500/50 bg-amber-950/15 shadow-md shadow-amber-950/10'
                                  : commitmentFocusFilter === 'blocked'
                                    ? 'border-red-500/50 bg-red-950/15 shadow-md shadow-red-950/10'
                                    : 'border-indigo-500/50 bg-indigo-950/15 shadow-md shadow-indigo-950/10'
                                : 'border-slate-800 bg-slate-950/60';

                              return (
                                <div key={commitment.id} className={`rounded border p-3 ${borderClass}`}>
                                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-slate-900/60 pb-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold text-slate-100">{commitment.title}</div>
                                        {matchesFocus && (
                                          <span className="inline-flex rounded-full bg-slate-800/80 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300 border border-slate-700">
                                            Focus Match
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                        {formatTimestamp(commitment.timestamp)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getCommitmentStateClasses(commitment.commitment_state)}`}>
                                        {getCommitmentStateLabel(commitment.commitment_state)}
                                      </span>
                                      <select
                                        value={commitment.commitment_state}
                                        onChange={(event) =>
                                          updateCommitmentState(
                                            selectedProject.id,
                                            commitment.id,
                                            event.target.value as CommitmentState
                                          )
                                        }
                                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 outline-none focus:border-emerald-500"
                                      >
                                        <option value="proposed">Proposed</option>
                                        <option value="active">Active</option>
                                        <option value="blocked">Blocked</option>
                                        <option value="completed">Completed</option>
                                      </select>
                                    </div>
                                  </div>

                                  {exposureBadge && (
                                    <div className={`mb-3 inline-flex items-center gap-2 rounded border px-2 py-1 ${exposureBadge.style}`}>
                                      <span className="text-[9px] font-bold uppercase tracking-wider">{exposureBadge.label}</span>
                                      <span className="text-[10px] opacity-50">|</span>
                                      <span className="text-[10px] opacity-90">{exposureBadge.detail}</span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Rationale</div>
                                      <div className="mt-1 text-sm text-slate-300">{commitment.rationale}</div>
                                    </div>
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Next Action</div>
                                      <div className="mt-1 text-sm text-slate-300">{commitment.next_action}</div>
                                    </div>
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Done When</div>
                                      <div className="mt-1 text-sm text-slate-300">{commitment.done_when}</div>
                                    </div>
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Confidence</div>
                                      <div className="mt-1 flex items-center">
                                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                                          commitment.confidence === 'high'
                                            ? 'border-emerald-800 bg-emerald-950/20 text-emerald-300'
                                            : commitment.confidence === 'low'
                                              ? 'border-red-800 bg-red-950/20 text-red-300'
                                              : 'border-amber-800 bg-amber-950/20 text-amber-300'
                                        }`}>
                                          {commitment.confidence || 'medium'}
                                        </span>
                                      </div>
                                    </div>
                                    {commitment.work_package && (
                                      <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Work Package</div>
                                        <div className="mt-1 text-sm text-slate-300">{commitment.work_package}</div>
                                      </div>
                                    )}
                                    {commitment.blocker_note && (
                                      <div className="rounded border border-red-900/40 bg-red-950/10 p-2.5">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-red-400">Blocker</div>
                                        <div className="mt-1 text-sm text-red-200">{commitment.blocker_note}</div>
                                      </div>
                                    )}
                                    {commitment.constraints && (
                                      <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5 sm:col-span-2">
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Constraints & Boundaries</div>
                                        <div className="mt-1 text-sm text-slate-300">{commitment.constraints}</div>
                                      </div>
                                    )}
                                  </div>

                                  {(linkedArtifact || linkedDecision) && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {linkedArtifact && (
                                        <span className="rounded border border-indigo-900/40 bg-indigo-950/20 px-2 py-1 text-[10px] text-indigo-300">
                                          Artifact: {linkedArtifact.title}
                                        </span>
                                      )}
                                      {linkedDecision && (
                                        <span className="rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-1 text-[10px] text-emerald-300">
                                          Decision: {linkedDecision.title}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="mb-3 border-b border-slate-800/50 pb-1 text-[10px] uppercase tracking-widest text-slate-500">
                          Discussion
                        </h4>
                        <div className="flex flex-col gap-3">
                          {selectedProject.messages.length === 0 ? (
                            <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                              No discussion yet. Add a project update below.
                            </div>
                          ) : (
                            selectedProject.messages.map((message) => (
                              <div key={message.id} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] text-slate-500">{formatTimestamp(message.timestamp)}</span>
                                  {message.tag !== 'none' && (
                                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTagColor(message.tag)}`}>
                                      {message.tag}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{message.content}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 bg-slate-900 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Update Type</label>
                        <select
                          value={updateType}
                          onChange={(event) => setUpdateType(event.target.value as StructuredUpdateType)}
                          className="rounded border border-slate-700 bg-slate-950 p-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 focus:border-indigo-500 outline-none"
                        >
                          <option value="status_update">Status Update</option>
                          <option value="review_note">Review Note</option>
                          <option value="artifact_update">Artifact Update</option>
                          <option value="decision">Decision</option>
                          <option value="question">Question</option>
                          <option value="warning">Warning</option>
                        </select>
                      </div>

                      {selectedProject.artifacts && selectedProject.artifacts.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Associate Artifact</label>
                          <select
                            value={associatedArtifactId}
                            onChange={(event) => setAssociatedArtifactId(event.target.value)}
                            className="rounded border border-slate-700 bg-slate-950 p-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 max-w-[200px] truncate focus:border-indigo-500 outline-none"
                          >
                            <option value="">None</option>
                            {selectedProject.artifacts.map((artifact) => (
                              <option key={artifact.id} value={artifact.id}>
                                {artifact.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {updateType === 'decision' && (
                      <div className="mb-3 grid grid-cols-1 gap-3 rounded border border-indigo-950 bg-indigo-950/20 p-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Decision Title</label>
                          <input
                            type="text"
                            value={decisionTitle}
                            onChange={(e) => setDecisionTitle(e.target.value)}
                            placeholder="e.g. Migrate to Postgres"
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Decision State</label>
                          <select
                            value={decisionState}
                            onChange={(e) => setDecisionState(e.target.value as DecisionState)}
                            className="rounded border border-slate-700 bg-slate-950 p-1.5 text-xs font-bold uppercase tracking-widest text-slate-300 focus:border-indigo-500 outline-none"
                          >
                            <option value="proposed">Proposed</option>
                            <option value="accepted">Accepted</option>
                            <option value="deferred">Deferred</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Impact (Optional)</label>
                          <input
                            type="text"
                            value={decisionImpact}
                            onChange={(e) => setDecisionImpact(e.target.value)}
                            placeholder="e.g. High architectural impact"
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <textarea
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                            handlePostUpdate();
                          }
                        }}
                        placeholder={updateType === 'decision' ? "Describe the choice rationale and justification here... (Ctrl+Enter to post)" : "Add details, findings, decision reasons, or signal descriptions... (Ctrl+Enter to post)"}
                        className="min-h-[72px] flex-1 resize-none rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={handlePostUpdate}
                        disabled={!newMessage.trim()}
                        className="rounded bg-indigo-600 px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {projectViewMode === 'context' && (
                <div id="project-context-root" className="flex min-h-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Accepted Context</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        The authoritative boundaries, constraints, warnings, requirements, and working assumptions of this project.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsCreatingContext(true);
                        setNewContextTitle('');
                        setNewContextBody('');
                        setNewContextType('working_note');
                      }}
                      className="rounded border border-teal-800 bg-teal-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-300 transition-colors hover:bg-teal-900/40"
                    >
                      + Propose New Context
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="mx-auto flex max-w-5xl flex-col gap-5">
                      
                      {/* Manual Proposal Form */}
                      {isCreatingContext && (
                        <div className="rounded border border-teal-900/40 bg-teal-950/10 p-4">
                          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-teal-400">
                            Propose Context Item
                          </div>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Proposal Title
                                </label>
                                <input
                                  type="text"
                                  value={newContextTitle}
                                  onChange={(e) => setNewContextTitle(e.target.value)}
                                  placeholder="e.g. Memory constraints on embedded device"
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Context Type
                                </label>
                                <select
                                  value={newContextType}
                                  onChange={(e) => setNewContextType(e.target.value as ProjectContextType)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500"
                                >
                                  <option value="working_note">Working Note</option>
                                  <option value="constraint">Constraint / Guardrail</option>
                                  <option value="decision">Decision Statement</option>
                                  <option value="assumption">Active Assumption</option>
                                  <option value="warning">Systemic Warning</option>
                                  <option value="requirement">Handoff Requirement</option>
                                </select>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Authorized Signatory
                                </label>
                                <select
                                  value={newContextSigner}
                                  onChange={(e) => setNewContextSigner(e.target.value)}
                                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500"
                                >
                                  {vesselMembers.map((handle) => (
                                    <option key={handle} value={handle}>
                                      {handle}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Proposal Seal Type
                                </label>
                                <div className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                                  Operator Signed Proposal
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Context Body Content
                              </label>
                              <textarea
                                value={newContextBody}
                                onChange={(e) => setNewContextBody(e.target.value)}
                                rows={3}
                                placeholder="Describe the constraints, requirements, or active working assumptions in detail..."
                                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500 font-mono"
                              />
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                              <div className="text-[9px] text-slate-400 italic">
                                Proposal will be signed under <span className="font-mono text-teal-400 font-bold">{newContextSigner}</span>.
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setIsCreatingContext(false);
                                    setNewContextTitle('');
                                    setNewContextBody('');
                                  }}
                                  className="rounded border border-slate-750 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-900/60"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleCreateContext}
                                  className="rounded border border-teal-700 bg-teal-900/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-200 hover:bg-teal-900/60"
                                >
                                  Confirm & Sign Proposal
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Context Items Grid/Categorized Lists */}
                      <div className="grid grid-cols-1 gap-6">
                        
                        {/* 1. Proposed/Pending Context Items */}
                        <div>
                          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Proposed Proposals ({((selectedProject.context_items || []).filter(c => c.context_state === 'proposed')).length})
                            </h4>
                          </div>
                          {((selectedProject.context_items || []).filter(c => c.context_state === 'proposed')).length === 0 ? (
                            <div className="rounded border border-dashed border-slate-850 p-4 text-xs text-slate-500 italic">
                              No context proposals pending peer review.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {((selectedProject.context_items || []).filter(c => c.context_state === 'proposed')).map((item) => (
                                <div key={item.id} className="rounded border border-slate-800 bg-slate-950/60 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2 pb-2 border-b border-slate-900/60">
                                    <div>
                                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider mb-1.5 ${getContextTypeBadgeStyle(item.context_type)}`}>
                                        {item.context_type.replace('_', ' ')}
                                      </span>
                                      <h5 className="text-sm font-bold text-slate-200">{item.title}</h5>
                                      <div className="text-[9px] text-slate-500 mt-0.5">
                                        Proposed by <span className="text-slate-400 font-bold">{item.actor_name || item.actor_type}</span> | {formatTimestamp(item.created_at)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isRejectingProposalId === item.id ? (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={rejectReasonForProposalId[item.id] || ''}
                                            onChange={(e) => setRejectReasonForProposalId(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            placeholder="Reason for rejection"
                                            className="rounded border border-red-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-200 outline-none"
                                          />
                                          <button
                                            onClick={() => handleRejectContextProposal(item.id)}
                                            className="rounded border border-red-800 bg-red-950/30 px-2 py-1 text-[9px] font-bold uppercase text-red-300 hover:bg-red-900/40"
                                          >
                                            Confirm Reject
                                          </button>
                                          <button
                                            onClick={() => setIsRejectingProposalId(null)}
                                            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-900"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Signatory:</span>
                                            <select
                                              value={activeSignerForProposalId[item.id] || vesselMembers[0] || 'Malaky'}
                                              onChange={(e) => setActiveSignerForProposalId(prev => ({ ...prev, [item.id]: e.target.value }))}
                                              className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[9px] text-slate-200 outline-none"
                                            >
                                              {vesselMembers.map((handle) => (
                                                <option key={handle} value={handle}>
                                                  {handle}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <button
                                            onClick={() => handleAcceptContextProposal(item.id)}
                                            className="rounded border border-emerald-800 bg-emerald-950/30 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300 hover:bg-emerald-900/40"
                                          >
                                            Accept & Sign
                                          </button>
                                          <button
                                            onClick={() => setIsRejectingProposalId(item.id)}
                                            className="rounded border border-red-800 bg-red-950/30 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-900/40"
                                          >
                                            Reject
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <p className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-slate-950/40 rounded p-2.5">{item.body}</p>
                                  
                                  {item.source_type && (
                                    <div className="mt-2 text-[9px] text-slate-500">
                                      Source: <span className="font-bold">{item.source_type}</span> ({item.source_id})
                                    </div>
                                  )}
                                  
                                  {item.signed_by && (
                                    <div className="mt-2.5 rounded border border-slate-900 bg-slate-950/80 p-2 font-mono text-[9px] text-slate-400">
                                      <span className="text-teal-400 font-bold">Proposal Sealed By:</span> {item.signed_by}
                                      {item.signature && <span className="ml-2 text-slate-600 font-mono">({item.signature})</span>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 2. Canonical/Active Context Items */}
                        <div>
                          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                              Canonical Project Context ({((selectedProject.context_items || []).filter(c => c.context_state === 'accepted')).length})
                            </h4>
                          </div>
                          {((selectedProject.context_items || []).filter(c => c.context_state === 'accepted')).length === 0 ? (
                            <div className="rounded border border-dashed border-slate-850 p-4 text-xs text-slate-500 italic">
                              No canonical context rules verified for this project yet. Use proposals to establish them.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {((selectedProject.context_items || []).filter(c => c.context_state === 'accepted')).map((item) => (
                                <div key={item.id} className="rounded border border-slate-850 bg-slate-950/30 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2 pb-2 border-b border-slate-900/60">
                                    <div>
                                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider mb-1.5 ${getContextTypeBadgeStyle(item.context_type)}`}>
                                        {item.context_type.replace('_', ' ')}
                                      </span>
                                      <h5 className="text-sm font-bold text-slate-200">{item.title}</h5>
                                      <div className="text-[9px] text-slate-500 mt-0.5">
                                        Reviewed & Signed by <span className="text-emerald-400 font-bold">{item.signed_by}</span> | Active since {formatTimestamp(item.reviewed_at || item.updated_at)}
                                      </div>
                                    </div>
                                    <div>
                                      {isSupersedingItemId === item.id ? (
                                        <button
                                          onClick={() => setIsSupersedingItemId(null)}
                                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] font-bold uppercase text-slate-400 hover:bg-slate-900"
                                        >
                                          Close Form
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setIsSupersedingItemId(item.id);
                                            setSupersedingContextTitle(`Supersedes: ${item.title}`);
                                            setSupersedingContextBody(item.body);
                                            setSupersedingContextType(item.context_type);
                                            setSupersedingReviewNote('');
                                          }}
                                          className="rounded border border-indigo-800 bg-indigo-950/30 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-indigo-300 hover:bg-indigo-900/40"
                                        >
                                          Supersede Context
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <p className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-slate-950/40 rounded p-2.5">{item.body}</p>
                                  
                                  {item.supersedes_id && (
                                    <div className="mt-2 text-[9px] text-slate-500 font-mono">
                                      Supersedes older item: {item.supersedes_id}
                                    </div>
                                  )}
                                  
                                  {item.signature && (
                                    <div className="mt-2.5 rounded border border-slate-900 bg-slate-950/80 p-2 font-mono text-[9px] text-slate-400">
                                      <span className="text-emerald-400 font-bold">Authorized Seal:</span> {item.signed_by}
                                      <span className="ml-2 text-slate-600 font-mono">({item.signature})</span>
                                    </div>
                                  )}

                                  {/* Inline Supersede Form */}
                                  {isSupersedingItemId === item.id && (
                                    <div className="mt-4 border-t border-indigo-900/40 pt-4 space-y-4">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                        Propose Replacement Context (Supersede)
                                      </div>
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="sm:col-span-2">
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Replacement Title
                                          </label>
                                          <input
                                            type="text"
                                            value={supersedingContextTitle}
                                            onChange={(e) => setSupersedingContextTitle(e.target.value)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Replacement Type
                                          </label>
                                          <select
                                            value={supersedingContextType}
                                            onChange={(e) => setSupersedingContextType(e.target.value as ProjectContextType)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            <option value="working_note">Working Note</option>
                                            <option value="constraint">Constraint / Guardrail</option>
                                            <option value="decision">Decision Statement</option>
                                            <option value="assumption">Active Assumption</option>
                                            <option value="warning">Systemic Warning</option>
                                            <option value="requirement">Handoff Requirement</option>
                                          </select>
                                        </div>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Authorized Signatory
                                          </label>
                                          <select
                                            value={supersedingSigner}
                                            onChange={(e) => setSupersedingSigner(e.target.value)}
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                                          >
                                            {vesselMembers.map((handle) => (
                                              <option key={handle} value={handle}>
                                                {handle}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                            Supersede Reason / Review Note
                                          </label>
                                          <input
                                            type="text"
                                            value={supersedingReviewNote}
                                            onChange={(e) => setSupersedingReviewNote(e.target.value)}
                                            placeholder="e.g. Replaced due to new hardware design details"
                                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                                          />
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                          Replacement Body Content
                                        </label>
                                        <textarea
                                          value={supersedingContextBody}
                                          onChange={(e) => setSupersedingContextBody(e.target.value)}
                                          rows={3}
                                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                        />
                                      </div>
                                      
                                      <div className="flex items-center justify-between border-t border-slate-900 pt-3">
                                        <div className="text-[9px] text-slate-400 italic">
                                          Replacement will be active immediately upon signing by <span className="font-mono text-indigo-400 font-bold">{supersedingSigner}</span>.
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => setIsSupersedingItemId(null)}
                                            className="rounded border border-slate-750 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-900/60"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleSupersedeContext(item.id)}
                                            className="rounded border border-indigo-700 bg-indigo-900/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 hover:bg-indigo-900/60"
                                          >
                                            Confirm & Sign Supersede
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. Superseded & Rejected Context Items */}
                        <div>
                          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              Superseded / Rejected Context ({((selectedProject.context_items || []).filter(c => c.context_state === 'superseded' || c.context_state === 'rejected')).length})
                            </h4>
                          </div>
                          {((selectedProject.context_items || []).filter(c => c.context_state === 'superseded' || c.context_state === 'rejected')).length === 0 ? (
                            <div className="rounded border border-dashed border-slate-850 p-4 text-xs text-slate-500 italic">
                              No archived, rejected, or superseded context items.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {((selectedProject.context_items || []).filter(c => c.context_state === 'superseded' || c.context_state === 'rejected')).map((item) => (
                                <div key={item.id} className="rounded border border-slate-900 bg-slate-950/10 p-3 opacity-60">
                                  <div className="flex flex-wrap items-start justify-between gap-3 mb-1.5 pb-1.5 border-b border-slate-950">
                                    <div>
                                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider mb-1.5 border-slate-800 text-slate-400 bg-slate-950/40`}>
                                        {item.context_type.replace('_', ' ')}
                                      </span>
                                      <h5 className="text-xs font-bold text-slate-400 line-through">{item.title}</h5>
                                      <div className="text-[9px] text-slate-600 mt-0.5">
                                        Status: <span className="uppercase tracking-wider font-bold">{item.context_state}</span> | Updated {formatTimestamp(item.updated_at)}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="font-mono text-xs text-slate-500 bg-slate-950/20 rounded p-2 line-through">{item.body}</p>
                                  {item.review_note && (
                                    <div className="mt-2 text-[10px] text-indigo-400/80 italic">
                                      Note: "{item.review_note}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )}

              {projectViewMode === 'handoff' && (
                <div id="project-handoff-root" className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Project Handoff</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      A compiled project record built from reviewed evidence, decisions, commitments, and the current next step.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="mx-auto flex max-w-5xl flex-col gap-5">
                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-bold text-slate-100">{selectedProject.title}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                              {selectedProject.category} | {selectedProject.status} | Updated {formatTimestamp(selectedProject.updated_at)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded border border-emerald-900/40 bg-emerald-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                              {approvedArtifacts.length} Approved
                            </span>
                            <span className="rounded border border-amber-900/40 bg-amber-950/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                              {flaggedArtifacts.length} Flagged
                            </span>
                            <span className="rounded border border-slate-700 bg-slate-950/70 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                              {pendingArtifacts.length} Needs Review
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 text-sm leading-6 text-slate-300">
                          {selectedProject.description || 'No project description recorded yet.'}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr),minmax(320px,0.85fr)]">
                        <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Handoff</div>
                          <div className="mt-4 space-y-3 text-sm text-slate-300">
                            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">Current Direction</div>
                              <div className="mt-1 text-slate-200">{projectMemory.currentDirection}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">Next Step</div>
                              <div className="mt-1 text-slate-200">{selectedProject.next_step?.trim() || 'No next step recorded yet.'}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">Return Focus</div>
                              <div className="mt-1 text-slate-200">{projectRelevance.returnFocus}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">Review Focus</div>
                              <div className="mt-1 text-slate-200">{agentSummary.suggestedReviewFocus[0] || 'No special review focus is active.'}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">Since Last Packet</div>
                              <div className="mt-1 text-slate-200">{reviewPacketDelta.summary}</div>
                              <div className="mt-2 text-xs text-slate-400">{reviewPacketDelta.checkpointLabel}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Runtime Context</div>
                          <div className="mt-4 space-y-3 text-sm text-slate-300">
                            <div className={`rounded border p-3 ${bellowsRuntime.classes}`}>
                              <div className="text-[10px] uppercase tracking-widest">Runtime Condition</div>
                              <div className="mt-1 font-bold">{bellowsRuntime.label}</div>
                              <div className="mt-1 text-xs">{bellowsRuntime.detail}</div>
                            </div>
                            {runtimeCommitmentAdvisory ? (
                              <div className={`rounded border p-3 ${runtimeCommitmentAdvisory.classes}`}>
                                <div className="text-[10px] uppercase tracking-widest">{runtimeCommitmentAdvisory.label}</div>
                                <div className="mt-1 text-sm">{runtimeCommitmentAdvisory.message}</div>
                                <div className="mt-2 text-xs">{runtimeCommitmentAdvisory.detail}</div>
                              </div>
                            ) : (
                              <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                                No runtime advisory is currently changing this handoff.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Since Last Packet</div>
                            <div className="mt-1 text-xs text-slate-500">
                              The continuity delta between the latest saved checkpoint and the current handoff state.
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-500">{reviewPacketDelta.checkpointLabel}</div>
                        </div>
                        <div className="mt-4 rounded border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                          {reviewPacketDelta.readinessImpact}
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {reviewPacketDelta.changeLines.length === 0 ? (
                            <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500 lg:col-span-2">
                              No material handoff delta is recorded since the last saved checkpoint.
                            </div>
                          ) : (
                            reviewPacketDelta.changeLines.map((line) => (
                              <div key={`handoff-delta-${line}`} className="rounded border border-indigo-900/30 bg-indigo-950/10 p-4 text-sm text-slate-200">
                                {line}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reviewed Evidence</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Evidence that is ready to carry forward into downstream review or handoff.
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-500">{approvedArtifacts.length} approved</div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {approvedArtifacts.length === 0 ? (
                            <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                              No evidence has been approved yet.
                            </div>
                          ) : (
                            approvedArtifacts.map((artifact) => (
                              <div key={`handoff-approved-${artifact.id}`} className="rounded border border-emerald-900/30 bg-emerald-950/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-bold text-slate-100">{artifact.title}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                      {artifact.type} | {formatTimestamp(artifact.timestamp)}
                                    </div>
                                  </div>
                                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewOutcomeClasses(artifact)}`}>
                                    {getArtifactReviewOutcomeLabel(artifact)}
                                  </span>
                                </div>
                                <div className="mt-3 text-sm text-slate-300">
                                  {artifact.summary || 'No artifact summary recorded yet.'}
                                </div>
                                {artifact.review_note && (
                                  <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
                                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Comment</div>
                                    <div className="mt-1">{artifact.review_note}</div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Needs Review Before Handoff</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Evidence that still needs a review call or follow-up before it should be passed along.
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-500">{flaggedArtifacts.length + pendingArtifacts.length} open</div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {flaggedArtifacts.length + pendingArtifacts.length === 0 ? (
                            <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                              No evidence is currently holding this handoff back.
                            </div>
                          ) : (
                            [...flaggedArtifacts, ...pendingArtifacts].map((artifact) => (
                              <div key={`handoff-review-${artifact.id}`} className="rounded border border-amber-900/30 bg-amber-950/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-bold text-slate-100">{artifact.title}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                      {artifact.type} | {formatTimestamp(artifact.timestamp)}
                                    </div>
                                  </div>
                                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewOutcomeClasses(artifact)}`}>
                                    {getArtifactReviewOutcomeLabel(artifact)}
                                  </span>
                                </div>
                                <div className="mt-3 text-sm text-slate-300">
                                  {artifact.review_note || getArtifactReviewOutcomeDetail(artifact)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Decisions</div>
                          <div className="mt-4 space-y-3">
                            {(selectedProject.decisions || []).length === 0 ? (
                              <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                                No project decisions recorded yet.
                              </div>
                            ) : (
                              (selectedProject.decisions || []).map((decision) => (
                                <div key={`handoff-decision-${decision.id}`} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-sm font-bold text-slate-100">{decision.title}</div>
                                    <span className="text-[10px] uppercase tracking-widest text-slate-500">{decision.decision_state}</span>
                                  </div>
                                  <div className="mt-2 text-sm text-slate-300">{decision.rationale}</div>
                                  {decision.impact_note && (
                                    <div className="mt-2 text-xs text-slate-400">Impact: {decision.impact_note}</div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Commitments</div>
                          <div className="mt-4 space-y-3">
                            {sortedCommitments.length === 0 ? (
                              <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                                No project commitments recorded yet.
                              </div>
                            ) : (
                              sortedCommitments.map((commitment) => (
                                <div key={`handoff-commitment-${commitment.id}`} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-sm font-bold text-slate-100">{commitment.title}</div>
                                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getCommitmentStateClasses(commitment.commitment_state)}`}>
                                      {commitment.commitment_state}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-sm text-slate-300">{commitment.rationale}</div>
                                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[10px] uppercase tracking-widest text-slate-500">Next Step</div>
                                      <div className="mt-1 text-sm text-slate-200">{commitment.next_action}</div>
                                    </div>
                                    <div className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
                                      <div className="text-[10px] uppercase tracking-widest text-slate-500">Done When</div>
                                      <div className="mt-1 text-sm text-slate-200">{commitment.done_when}</div>
                                    </div>
                                  </div>
                                  {commitment.blocker_note && (
                                    <div className="mt-3 rounded border border-red-900/30 bg-red-950/10 p-3 text-sm text-red-200">
                                      <div className="text-[10px] uppercase tracking-widest text-red-300">Blocker</div>
                                      <div className="mt-1">{commitment.blocker_note}</div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/30 p-4 text-xs text-slate-500">
                        Built from current project data, evidence review, decisions, commitments, and runtime context. No external model call or sync involved.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {projectViewMode === 'frames' && (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[260px,minmax(0,1.15fr),minmax(320px,0.85fr)]">
                  <div className="flex min-h-0 flex-col border-b border-slate-800 xl:border-b-0 xl:border-r">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Project Sections</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Durable room containers that turn project objects into a navigable place instead of a stack.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="flex flex-col gap-3">
                        {projectFrames.map((frame) => {
                          const active = selectedFrame?.id === frame.id;
                          return (
                            <button
                              key={frame.id}
                              type="button"
                              onClick={() => setSelectedFrameId(frame.id)}
                              className={`rounded border p-4 text-left transition-colors ${
                                active ? 'border-indigo-700 bg-indigo-950/20' : `${frame.accent} hover:border-slate-700`
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-bold text-slate-100">{frame.title}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{frame.status}</div>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                  {frame.objectIds.length} objects
                                </span>
                              </div>
                              <div className="mt-3 text-sm text-slate-300">{frame.summary}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col border-b border-slate-800 xl:border-b-0 xl:border-r">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
                        {selectedFrame ? `${selectedFrame.title} Frame` : 'Frame Detail'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Organize the room by evidence, decisions, commitments, runtime pressure, and next moves.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      {!selectedFrame ? (
                        <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                          No frame is currently available.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className={`rounded border p-4 ${selectedFrame.accent}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-900/40 pb-3">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{selectedFrame.title}</div>
                                <div className="mt-1 text-lg font-bold text-slate-100">{selectedFrame.summary}</div>
                              </div>
                              <div className="text-right text-[10px] uppercase tracking-widest text-slate-400">
                                <div>{selectedFrame.status}</div>
                                <div className="mt-1">{selectedFrame.objectIds.length} linked objects</div>
                              </div>
                            </div>
                            <div className="mt-3 rounded border border-slate-800/70 bg-slate-950/40 p-3 text-sm text-slate-200">
                              {selectedFrame.operatorCue}
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2">
                              {selectedFrame.signals.map((signal, index) => (
                                <div key={`${selectedFrame.id}-signal-${index}`} className="rounded border border-slate-800/70 bg-slate-950/40 p-2.5 text-sm text-slate-300">
                                  {signal}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Frame Objects</h4>
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                {selectedFrameObjects.length} visible
                              </div>
                            </div>
                            {selectedFrameObjects.length === 0 ? (
                              <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                                This frame does not hold any room objects yet.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                {selectedFrameObjects.map((object) => {
                                  const active = selectedRoomObject?.id === object.id;
                                  return (
                                    <button
                                      key={object.id}
                                      type="button"
                                      onClick={() => setSelectedRoomObjectId(object.id)}
                                      className={`rounded border p-4 text-left transition-colors ${
                                        active ? 'border-indigo-700 bg-indigo-950/20' : `${object.accent} hover:border-slate-700`
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-sm font-bold text-slate-100">{object.title}</div>
                                          <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                            {object.kind} | {object.status}
                                          </div>
                                        </div>
                                        {object.timestamp && (
                                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                            {formatTimestamp(object.timestamp)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-3 text-sm text-slate-300">{object.summary}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Focused Object</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Inspect the selected room object while staying inside the frame that gives it meaning.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      {!selectedRoomObject ? (
                        <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                          Select a room object to inspect its detail and continuity links.
                        </div>
                      ) : (
                        <div className="rounded border border-slate-800 bg-slate-950/40 p-4">
                          <div className="border-b border-slate-800 pb-3">
                            <div className="text-sm font-bold text-slate-100">{selectedRoomObject.title}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                              {selectedRoomObject.kind} | {selectedRoomObject.status}
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-slate-300">{selectedRoomObject.summary}</div>
                          <div className="mt-4 space-y-2">
                            {selectedRoomObject.detail.map((line, index) => (
                              <div key={`frame-detail-${index}`} className="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-sm text-slate-300">
                                {line}
                              </div>
                            ))}
                          </div>
                          <div className="mt-5 border-t border-slate-800 pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Continuity Links</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Move through the room along links this project can genuinely support.
                                </div>
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                {roomContinuityLinks.length} linked
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {roomContinuityLinks.map((link) => {
                                const targetObject = link.targetRoomObjectId
                                  ? projectRoomObjects.find((object) => object.id === link.targetRoomObjectId) || null
                                  : null;

                                return (
                                  <button
                                    key={`frame-${link.id}`}
                                    type="button"
                                    onClick={() => {
                                      if (link.targetRoomObjectId) {
                                        setSelectedRoomObjectId(link.targetRoomObjectId);
                                        const matchingFrame = projectFrames.find((frame) => frame.objectIds.includes(link.targetRoomObjectId as string));
                                        if (matchingFrame) setSelectedFrameId(matchingFrame.id);
                                        return;
                                      }

                                      if (link.targetArtifactId) {
                                        setSelectedArtifactId(link.targetArtifactId);
                                        setProjectViewMode('overview');
                                      }
                                    }}
                                    disabled={!link.targetRoomObjectId && !link.targetArtifactId}
                                    className="w-full rounded border border-slate-800 bg-slate-950/60 p-3 text-left transition-colors hover:border-slate-700 disabled:cursor-default disabled:opacity-80"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">{link.label}</div>
                                        <div className="mt-1 text-sm text-slate-200">
                                          {targetObject?.title || (link.targetArtifactId ? 'Open linked artifact in overview.' : 'Derived continuity cue')}
                                        </div>
                                      </div>
                                      {targetObject && (
                                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{targetObject.kind}</span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">{link.reason}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {selectedRoomObject.linkedArtifactId && (
                            <button
                              onClick={() => {
                                setSelectedArtifactId(selectedRoomObject.linkedArtifactId || null);
                                setProjectViewMode('overview');
                              }}
                              className="mt-4 rounded border border-indigo-800 bg-indigo-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                            >
                              Open Linked Artifact
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {projectViewMode === 'room' && (
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.3fr),minmax(320px,0.8fr)]">
                  <div className="flex min-h-0 flex-col border-b border-slate-800 xl:border-b-0 xl:border-r">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Linked Objects</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Durable project objects assembled from evidence, decisions, commitments, runtime context, and derived briefs.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {projectRoomObjects.map((object) => {
                          const active = selectedRoomObject?.id === object.id;
                          return (
                            <button
                              key={object.id}
                              onClick={() => setSelectedRoomObjectId(object.id)}
                              className={`rounded border p-4 text-left transition-colors ${
                                active
                                  ? 'border-indigo-700 bg-indigo-950/20'
                                  : `${object.accent} hover:border-slate-700`
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-bold text-slate-100">{object.title}</div>
                                  <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                    {object.kind} | {object.status}
                                  </div>
                                </div>
                                {object.timestamp && (
                                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                    {formatTimestamp(object.timestamp)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 text-sm text-slate-300">{object.summary}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Linked Detail</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Inspect one linked project object at a time without losing the surrounding context.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                      {!selectedRoomObject ? (
                        <div className="rounded border border-dashed border-slate-800 p-4 text-sm italic text-slate-500">
                          No room object is currently available.
                        </div>
                      ) : (
                        <div className="rounded border border-slate-800 bg-slate-950/40 p-4">
                          <div className="border-b border-slate-800 pb-3">
                            <div className="text-sm font-bold text-slate-100">{selectedRoomObject.title}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                              {selectedRoomObject.kind} | {selectedRoomObject.status}
                            </div>
                          </div>
                          <div className="mt-4 text-sm text-slate-300">{selectedRoomObject.summary}</div>
                          <div className="mt-4 space-y-2">
                            {selectedRoomObject.detail.map((line, index) => (
                              <div key={`room-detail-${index}`} className="rounded border border-slate-800 bg-slate-950/60 p-2.5 text-sm text-slate-300">
                                {line}
                              </div>
                            ))}
                          </div>
                          <div className="mt-5 border-t border-slate-800 pt-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Continuity Links</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Follow only the links this room can support from current project data.
                                </div>
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                {roomContinuityLinks.length} linked
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {roomContinuityLinks.map((link) => {
                                const targetObject = link.targetRoomObjectId
                                  ? projectRoomObjects.find((object) => object.id === link.targetRoomObjectId) || null
                                  : null;

                                return (
                                  <button
                                    key={link.id}
                                    type="button"
                                    onClick={() => {
                                      if (link.targetRoomObjectId) {
                                        setSelectedRoomObjectId(link.targetRoomObjectId);
                                        return;
                                      }

                                      if (link.targetArtifactId) {
                                        setSelectedArtifactId(link.targetArtifactId);
                                        setProjectViewMode('overview');
                                      }
                                    }}
                                    disabled={!link.targetRoomObjectId && !link.targetArtifactId}
                                    className="w-full rounded border border-slate-800 bg-slate-950/60 p-3 text-left transition-colors hover:border-slate-700 disabled:cursor-default disabled:opacity-80"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                                          {link.label}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-200">
                                          {targetObject?.title || (link.targetArtifactId ? 'Open linked artifact in overview.' : 'Derived continuity cue')}
                                        </div>
                                      </div>
                                      {targetObject && (
                                        <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                          {targetObject.kind}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">{link.reason}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {selectedRoomObject.linkedArtifactId && (
                            <button
                              onClick={() => {
                                setSelectedArtifactId(selectedRoomObject.linkedArtifactId || null);
                                setProjectViewMode('overview');
                              }}
                              className="mt-4 rounded border border-indigo-800 bg-indigo-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                            >
                              Open Linked Artifact
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {projectViewMode === 'review' && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Review System</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      An operational review surface to process inbox captures, make decisions, and prepare handoffs.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-8">
                      {[
                        { stage: 'operational_cue', label: 'Operational Cues', desc: 'Runtime and systemic warnings.' },
                        { stage: 'needs_call', label: 'Needs Call', desc: 'Items that are stuck or awaiting an active decision.' },
                        { stage: 'ready_to_convert', label: 'Ready to Convert', desc: 'Inbox and open evidence ready to become decisions or commitments.' },
                        { stage: 'ready_to_carry', label: 'Ready to Carry', desc: 'Reviewed artifacts clear for the handoff packet.' }
                      ].map(stageGroup => {
                        const items = projectReviewQueue.filter(i => i.stage === stageGroup.stage);
                        if (items.length === 0) return null;
                        
                        return (
                          <div key={stageGroup.stage} className="flex flex-col gap-3">
                            <div className="border-b border-slate-800/50 pb-2">
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{stageGroup.label}</h4>
                              <p className="mt-1 text-[10px] text-slate-500">{stageGroup.desc}</p>
                            </div>
                            {items.map((item) => {
                              const priorityClass =
                                item.priority === 'high'
                                  ? 'border-red-900/40 bg-red-950/10'
                                  : item.priority === 'medium'
                                    ? 'border-amber-900/40 bg-amber-950/10'
                                    : 'border-emerald-900/40 bg-emerald-950/10';
      
                              return (
                                <div key={item.id} className={`rounded border p-4 ${priorityClass}`}>
                                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-900/40 pb-3">
                                    <div>
                                      <div className="text-sm font-bold text-slate-100">{item.title}</div>
                                      <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                                        {item.status} | {item.priority}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {item.actionType === 'seed_decision' && item.linkedArtifactId && selectedProject && (
                                        <button
                                          onClick={() => {
                                            const artifact = (selectedProject.artifacts || []).find(a => a.id === item.linkedArtifactId);
                                            if (artifact) seedDecisionFromArtifact(artifact);
                                          }}
                                          className="rounded border border-fuchsia-800 bg-fuchsia-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 transition-colors hover:bg-fuchsia-900/40"
                                        >
                                          Draft Decision
                                        </button>
                                      )}
                                      {item.actionType === 'open_artifact' && item.linkedArtifactId && (
                                        <button
                                          onClick={() => {
                                            setSelectedArtifactId(item.linkedArtifactId || null);
                                            setProjectViewMode('overview');
                                          }}
                                          className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                        >
                                          Open Evidence
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 text-sm text-slate-300">{item.summary}</div>
                                  <div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-2.5 text-sm text-slate-200">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Suggested Action</span>
                                    <div className="mt-1">{item.action}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

