import { useEffect, useMemo, useState, useCallback } from 'react';

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
}

export interface ProjectDecision {
  id: string;
  timestamp: string;
  title: string;
  rationale: string;
  decision_state: DecisionState;
  artifact_id?: string;
  impact_note?: string;
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

export interface ProjectContext {
  asset_id?: string;
  preset_template?: string;
  morphology_class?: string;
  actuator_joint_count?: number;
  footprint?: string;
  maximum_reach_m?: number;
  validation_status?: string;
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
  context?: ProjectContext;
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

type ProjectViewMode = 'desk' | 'overview' | 'frames' | 'room' | 'review' | 'handoff';

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

function normalizeProject(project: unknown, index: number): Project {
  const item = project as Partial<Project>;
  const artifacts = normalizeArtifacts(item.artifacts);
  const messages = normalizeMessages(item.messages);
  const decisions = normalizeDecisions(item.decisions);
  const commitments = normalizeCommitments(item.commitments);
  const captureItems = normalizeCaptureItems(item.capture_items);
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
    impactNote?: string
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
        impact_note: impactNote || undefined
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

  const promoteCaptureToArtifact = (projectId: string, captureId: string) => {
    const timestamp = nowIso();
    const updated = projects.map((project) => {
      if (project.id !== projectId) return project;

      const currentCapture = project.capture_items?.find((capture) => capture.id === captureId);
      if (!currentCapture || currentCapture.capture_state !== 'inbox') {
        return project;
      }

      const newArtifact: ProjectArtifact = {
        id: `artifact_${Date.now()}`,
        type: currentCapture.capture_type,
        title: currentCapture.title,
        summary: currentCapture.note || currentCapture.content,
        source_lane: 'projects',
        review_state: 'unreviewed',
        review_signal: 'clear',
        review_note: currentCapture.note,
        timestamp
      };

      return {
        ...project,
        updated_at: timestamp,
        artifacts: [...(project.artifacts || []), newArtifact],
        capture_items: (project.capture_items || []).map((capture) =>
          capture.id === captureId ? { ...capture, capture_state: 'promoted' as const } : capture
        ),
        activity: [
          ...(project.activity || []),
          {
            id: `act_${Date.now()}`,
            kind: 'artifact_added' as const,
            title: 'Inbox item promoted',
            detail: `${currentCapture.title} promoted to artifact.`,
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
    promoteCaptureToArtifact
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
    promoteCaptureToArtifact
  } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [commitmentFocusFilter, setCommitmentFocusFilter] = useState<'all' | 'active' | 'blocked' | 'at_risk' | 'completed'>('all');
  const [reflections, setReflections] = useState<PeerReflection[]>([]);
  const [bellowsState, setBellowsState] = useState<BellowsStateSnapshot | null>(null);
  const [bellowsStateError, setBellowsStateError] = useState<string | null>(null);

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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === effectiveSelectedProjectId) || null,
    [projects, effectiveSelectedProjectId]
  );
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
  const openDecisions = useMemo(
    () =>
      (selectedProject?.decisions || []).filter(
        (decision) => decision.decision_state === 'proposed' || decision.decision_state === 'deferred'
      ),
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

  const handlePromoteCaptureToArtifact = (capture: ProjectCaptureItem) => {
    if (!selectedProject) return;
    promoteCaptureToArtifact(selectedProject.id, capture.id);
  };

  const handlePromoteCaptureToDecisionDraft = (capture: ProjectCaptureItem) => {
    if (!selectedProject) return;

    setProjectViewMode('overview');
    setUpdateType('decision');
    setDecisionTitle(capture.title);
    setDecisionState('proposed');
    setDecisionImpact('');
    setAssociatedArtifactId('');
    setNewMessage(capture.note?.trim() || capture.content);

    updateProjectCaptureState(
      selectedProject.id,
      capture.id,
      'promoted',
      `${capture.title} promoted to a decision draft in the project workspace.`
    );
  };

  const handlePromoteCaptureToCommitmentDraft = (capture: ProjectCaptureItem) => {
    if (!selectedProject) return;

    setProjectViewMode('overview');
    setIsCreatingCommitment(true);
    setCommitmentTitle(capture.title);
    setCommitmentRationale(capture.note?.trim() || capture.content);
    setCommitmentNextAction(`Review and act on: ${capture.title}`);
    setCommitmentDoneWhen('Captured work is reviewed, clarified, and moved into an active commitment.');
    setCommitmentState('proposed');
    setCommitmentBlockerNote('');
    setCommitmentArtifactId('');
    setCommitmentDecisionId('');
    setCommitmentConfidence('medium');
    setCommitmentWorkPackage('Inbox Review');
    setCommitmentConstraints('Captured quickly and may need verification before activation.');

    updateProjectCaptureState(
      selectedProject.id,
      capture.id,
      'promoted',
      `${capture.title} promoted to a commitment draft in the project workspace.`
    );
  };

  const handleDismissCaptureItem = (capture: ProjectCaptureItem) => {
    if (!selectedProject) return;
    updateProjectCaptureState(selectedProject.id, capture.id, 'dismissed', `${capture.title} dismissed from the inbox.`);
  };

  const handleCreateProject = () => {
    if (!newTitle.trim()) return;
    const newId = addProject({
      title: newTitle,
      description: newDesc,
      category: newCategory,
      status: 'PLANNING',
      pinned_note: newPinned,
      next_step: newNextStep
    });
    setSelectedProjectId(newId);
    setIsCreating(false);
    setNewTitle('');
    setNewDesc('');
    setNewPinned('');
    setNewNextStep('');
  };

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

    const artifacts = selectedProject.artifacts || [];
    const decisions = selectedProject.decisions || [];
    const commitments = selectedProject.commitments || [];
    const approved = artifacts.filter((artifact) => isArtifactApproved(artifact));
    const flagged = artifacts.filter((artifact) => isArtifactFlagged(artifact));
    const pending = artifacts.filter((artifact) => !isArtifactApproved(artifact) && !isArtifactFlagged(artifact));

    return {
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
        next_step: selectedProject.next_step || null,
        context: selectedProject.context || null
      },
      handoff: {
        current_direction: projectMemory.currentDirection,
        return_focus: projectRelevance.returnFocus,
        open_question: projectMemory.openQuestion,
        next_step: selectedProject.next_step?.trim() || null,
        runtime_condition: bellowsRuntime.label,
        runtime_detail: bellowsRuntime.detail,
        runtime_advisory: runtimeCommitmentAdvisory
          ? {
              label: runtimeCommitmentAdvisory.label,
              message: runtimeCommitmentAdvisory.message,
              detail: runtimeCommitmentAdvisory.detail
            }
          : null
      },
      evidence_summary: {
        total: artifacts.length,
        approved: approved.length,
        flagged: flagged.length,
        needs_review: pending.length
      },
      approved_evidence: approved.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
        timestamp: artifact.timestamp,
        source_lane: artifact.source_lane || selectedProject.category,
        summary: artifact.summary || null,
        review_note: artifact.review_note || null,
        review_outcome: getArtifactReviewOutcomeLabel(artifact)
      })),
      evidence_needing_review: [...flagged, ...pending].map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
        timestamp: artifact.timestamp,
        source_lane: artifact.source_lane || selectedProject.category,
        summary: artifact.summary || null,
        review_note: artifact.review_note || null,
        review_outcome: getArtifactReviewOutcomeLabel(artifact)
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
      recent_activity: (selectedProject.activity || []).slice(-6).map((activity) => ({
        id: activity.id,
        kind: activity.kind,
        title: activity.title,
        detail: activity.detail || null,
        timestamp: activity.timestamp
      }))
    };
  }, [selectedProject, projectMemory, projectRelevance, bellowsRuntime, runtimeCommitmentAdvisory]);

  const buildProjectHandoffMarkdown = useCallback(() => {
    if (!selectedProject) return '';

    const lines: string[] = [
      `# ${selectedProject.title}`,
      '',
      `- Category: ${selectedProject.category}`,
      `- Status: ${selectedProject.status}`,
      `- Updated: ${formatTimestamp(selectedProject.updated_at)}`,
      '',
      '## Summary',
      '',
      selectedProject.description || 'No project description recorded yet.',
      '',
      '## Current Direction',
      '',
      `- Current direction: ${projectMemory.currentDirection}`,
      `- Next step: ${selectedProject.next_step?.trim() || 'No next step recorded yet.'}`,
      `- Return focus: ${projectRelevance.returnFocus}`,
      agentSummary.suggestedReviewFocus[0]
        ? `- Review focus: ${agentSummary.suggestedReviewFocus[0]}`
        : '- Review focus: No special review focus is active.',
      '',
      '## Evidence Ready to Carry Forward',
      ''
    ];

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

    lines.push('', '## Decisions', '');
    if ((selectedProject.decisions || []).length === 0) {
      lines.push('- No decisions recorded yet.');
    } else {
      (selectedProject.decisions || []).forEach((decision) => {
        lines.push(`- ${decision.title} [${decision.decision_state}]`);
        lines.push(`  - Rationale: ${decision.rationale}`);
        if (decision.impact_note?.trim()) lines.push(`  - Impact: ${decision.impact_note.trim()}`);
      });
    }

    lines.push('', '## Commitments', '');
    if (sortedCommitments.length === 0) {
      lines.push('- No commitments recorded yet.');
    } else {
      sortedCommitments.forEach((commitment) => {
        lines.push(`- ${commitment.title} [${getCommitmentStateLabel(commitment.commitment_state)}]`);
        lines.push(`  - Rationale: ${commitment.rationale}`);
        lines.push(`  - Next action: ${commitment.next_action}`);
        lines.push(`  - Done when: ${commitment.done_when}`);
        if (commitment.blocker_note?.trim()) lines.push(`  - Blocker: ${commitment.blocker_note.trim()}`);
        if (commitment.constraints?.trim()) lines.push(`  - Constraints: ${commitment.constraints.trim()}`);
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
    approvedArtifacts,
    flaggedArtifacts,
    pendingArtifacts,
    sortedCommitments,
    bellowsRuntime,
    runtimeCommitmentAdvisory
  ]);

  const handleExportProjectHandoff = () => {
    const packet = buildProjectHandoffPacket();
    if (!packet || !selectedProject) return;
    downloadJsonArtifact(`project-handoff-${selectedProject.id}.json`, packet);
  };

  const handleSaveProjectHandoffArtifact = () => {
    if (!selectedProject) return;
    addProjectArtifact(selectedProject.id, {
      type: 'project_handoff',
      title: `Project Handoff - ${selectedProject.title}`,
      summary: selectedProject.next_step?.trim() || projectMemory.currentDirection,
      source_lane: 'projects',
      review_state: 'unreviewed',
      review_signal: 'clear',
      review_note: 'Compiled from reviewed evidence, decisions, commitments, and current next step.'
    });
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
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <button
              onClick={() => setIsCreating(false)}
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
                    <div className="text-sm text-emerald-100/90">{selectedProject.next_step || <span className="italic text-emerald-900/60">No next step defined.</span>}</div>
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

                <div className="mt-4 rounded border border-sky-900/40 bg-sky-950/10 p-4">
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
                                  onClick={() => handleDismissCaptureItem(capture)}
                                  className="rounded border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                                >
                                  Dismiss
                                </button>
                              </div>
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
                        Save Handoff
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
                      The working surface for what needs a call now, what is ready to move, and what can already be handed off.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="rounded border border-sky-900/30 bg-sky-950/10 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Inbox</div>
                          <div className="mt-2 text-2xl font-bold text-slate-100">{captureInboxItems.length}</div>
                          <div className="mt-2 text-sm text-slate-300">
                            {captureInboxItems.length === 0
                              ? 'No loose inputs are waiting right now.'
                              : `${captureInboxItems.length} captured item${captureInboxItems.length === 1 ? '' : 's'} still need to be sorted into project evidence or decisions.`}
                          </div>
                          <button
                            onClick={() => setProjectViewMode('overview')}
                            className="mt-4 rounded border border-sky-800 bg-sky-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-300 transition-colors hover:bg-sky-900/40"
                          >
                            Open Inbox
                          </button>
                        </div>
                        <div className="rounded border border-amber-900/30 bg-amber-950/10 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Needs Review</div>
                          <div className="mt-2 text-2xl font-bold text-slate-100">{flaggedArtifacts.length + pendingArtifacts.length}</div>
                          <div className="mt-2 text-sm text-slate-300">
                            {flaggedArtifacts.length + pendingArtifacts.length === 0
                              ? 'Evidence review is currently clear.'
                              : `${flaggedArtifacts.length} flagged and ${pendingArtifacts.length} still waiting on a review call.`}
                          </div>
                          <button
                            onClick={() => {
                              setProjectViewMode('overview');
                              if ((flaggedArtifacts[0] || pendingArtifacts[0])?.id) {
                                setSelectedArtifactId((flaggedArtifacts[0] || pendingArtifacts[0]).id);
                              }
                            }}
                            className="mt-4 rounded border border-amber-800 bg-amber-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-900/40"
                          >
                            Review Evidence
                          </button>
                        </div>
                        <div className="rounded border border-emerald-900/30 bg-emerald-950/10 p-4">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Ready to Carry</div>
                          <div className="mt-2 text-2xl font-bold text-slate-100">{approvedArtifacts.length + acceptedDecisions.length + activeCommitments.length}</div>
                          <div className="mt-2 text-sm text-slate-300">
                            {approvedArtifacts.length} approved evidence, {acceptedDecisions.length} accepted decision{acceptedDecisions.length === 1 ? '' : 's'}, and {activeCommitments.length} active commitment{activeCommitments.length === 1 ? '' : 's'} can feed the next handoff.
                          </div>
                          <button
                            onClick={() => setProjectViewMode('handoff')}
                            className="mt-4 rounded border border-emerald-800 bg-emerald-950/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40"
                          >
                            Open Handoff
                          </button>
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Work That Needs a Call</div>
                            <div className="mt-1 text-xs text-slate-500">
                              These are the places where the project still needs review, a decision, or a clearer next move.
                            </div>
                          </div>
                          <button
                            onClick={() => setProjectViewMode('review')}
                            className="rounded border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                          >
                            Open Review Queue
                          </button>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {blockedCommitments.slice(0, 2).map((commitment) => (
                            <div key={`desk-blocked-${commitment.id}`} className="rounded border border-red-900/30 bg-red-950/10 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-red-300">Blocked Commitment</div>
                              <div className="mt-2 text-sm font-bold text-slate-100">{commitment.title}</div>
                              <div className="mt-2 text-sm text-slate-300">{commitment.blocker_note || commitment.rationale}</div>
                            </div>
                          ))}
                          {openDecisions.slice(0, 2).map((decision) => (
                            <div key={`desk-decision-${decision.id}`} className="rounded border border-indigo-900/30 bg-indigo-950/10 p-4">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Open Decision</div>
                              <div className="mt-2 text-sm font-bold text-slate-100">{decision.title}</div>
                              <div className="mt-2 text-sm text-slate-300">{decision.rationale}</div>
                            </div>
                          ))}
                          {[...flaggedArtifacts, ...pendingArtifacts].slice(0, 2).map((artifact) => (
                            <div key={`desk-artifact-${artifact.id}`} className="rounded border border-amber-900/30 bg-amber-950/10 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Evidence Review</div>
                                  <div className="mt-2 text-sm font-bold text-slate-100">{artifact.title}</div>
                                </div>
                                <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${getArtifactReviewOutcomeClasses(artifact)}`}>
                                  {getArtifactReviewOutcomeLabel(artifact)}
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-slate-300">{artifact.review_note || artifact.summary || getArtifactReviewOutcomeDetail(artifact)}</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => {
                                    setProjectViewMode('overview');
                                    setSelectedArtifactId(artifact.id);
                                  }}
                                  className="rounded border border-amber-800 bg-amber-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-900/40"
                                >
                                  Open Review
                                </button>
                                <button
                                  onClick={() => seedDecisionFromArtifact(artifact)}
                                  className="rounded border border-indigo-800 bg-indigo-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
                                >
                                  Draft Decision
                                </button>
                              </div>
                            </div>
                          ))}
                          {blockedCommitments.length === 0 && openDecisions.length === 0 && flaggedArtifacts.length + pendingArtifacts.length === 0 && (
                            <div className="rounded border border-dashed border-slate-800 p-4 text-sm text-slate-500 lg:col-span-2">
                              This project is calm right now. The fastest next move is to refresh the handoff draft or capture new evidence.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded border border-slate-800 bg-slate-950/40 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent Movement</div>
                            <div className="mt-1 text-xs text-slate-500">
                              The latest changes to the project record, so a returning person can recover context fast.
                            </div>
                          </div>
                          <button
                            onClick={() => setProjectViewMode('overview')}
                            className="rounded border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
                          >
                            Open Timeline
                          </button>
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                          {(selectedProject.activity || []).slice(-4).reverse().map((activity) => (
                            <div key={`desk-activity-${activity.id}`} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-bold text-slate-100">{activity.title}</div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">{formatTimestamp(activity.timestamp)}</div>
                              </div>
                              {activity.detail && <div className="mt-2 text-sm text-slate-300">{activity.detail}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Auto-Draft Handoff</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      A markdown-ready handoff draft compiled from the project record, ready to copy, export, or save.
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="flex flex-col gap-4">
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
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Draft Output</div>
                          <div className="flex flex-wrap gap-2">
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
                            <button
                              onClick={handleGenerateShareableDossier}
                              className="rounded border border-emerald-800 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40"
                            >
                              Copy Shareable Link
                            </button>
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

                      <div>
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
                      <div>
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
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
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

              {projectViewMode === 'handoff' && (
                <div className="flex min-h-0 flex-1 flex-col">
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

