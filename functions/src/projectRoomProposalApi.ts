import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth } from './lib/auth';
import { applyBodyLimit, applyRateLimit } from './lib/edgeGuard';

const db = admin.firestore();

type ProposalType = 'run' | 'run_step' | 'decision' | 'scope_note' | 'source' | 'open_action';
type RoomRole = 'owner' | 'editor' | 'reviewer' | 'viewer';

interface ProposalExecutionTraceV1 {
  exit_code: number;
  execution_seconds: number;
  changed_files?: number;
  proposed_lines?: number;
  console_tail?: string[];
}

interface ProposalBundleItemInput {
  type: ProposalType;
  run_id?: string;
  payload: Record<string, unknown>;
}

interface ProposalBundleV1 {
  bundle_id: string;
  room_id: string;
  packet_version_seen: number;
  client_request_id: string;
  agent_id: string;
  submitted_at: string;
  human_summary: string;
  execution_trace?: ProposalExecutionTraceV1;
  proposals: ProposalBundleItemInput[];
}

function nowIso() {
  return new Date().toISOString();
}

function setCors(res: functions.Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildDeterministicFingerprint(value: unknown) {
  const normalized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildProposalPayloadSummary(payload: Record<string, unknown>) {
  const parts = [
    typeof payload.title === 'string' ? payload.title : '',
    typeof payload.description === 'string' ? payload.description : '',
    typeof payload.rationale === 'string' ? payload.rationale : '',
    typeof payload.next_action === 'string' ? `Next: ${payload.next_action}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(payload);
}

function buildExecutionTraceSummary(trace?: ProposalExecutionTraceV1) {
  if (!trace) return 'No execution trace provided.';
  const parts = [
    `Exit: ${trace.exit_code}`,
    `Duration: ${trace.execution_seconds}s`,
    typeof trace.changed_files === 'number' ? `Files: ${trace.changed_files}` : '',
    typeof trace.proposed_lines === 'number' ? `Lines: ${trace.proposed_lines}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function parseExecutionTrace(value: unknown): ProposalExecutionTraceV1 | undefined {
  if (!isRecord(value)) return undefined;
  const exitCode = typeof value.exit_code === 'number' && Number.isFinite(value.exit_code) ? value.exit_code : 0;
  const executionSeconds =
    typeof value.execution_seconds === 'number' && Number.isFinite(value.execution_seconds) ? value.execution_seconds : 0;
  const changedFiles =
    typeof value.changed_files === 'number' && Number.isFinite(value.changed_files) ? value.changed_files : undefined;
  const proposedLines =
    typeof value.proposed_lines === 'number' && Number.isFinite(value.proposed_lines) ? value.proposed_lines : undefined;
  const consoleTail = Array.isArray(value.console_tail)
    ? value.console_tail.filter((item): item is string => typeof item === 'string').slice(0, 20)
    : undefined;
  return {
    exit_code: exitCode,
    execution_seconds: executionSeconds,
    changed_files: changedFiles,
    proposed_lines: proposedLines,
    console_tail: consoleTail,
  };
}

function sanitizeProposalPayload(payload: unknown): Record<string, unknown> {
  return isRecord(payload) ? payload : {};
}

function canSubmitRole(role: RoomRole) {
  return role === 'owner' || role === 'editor' || role === 'reviewer';
}

function canReviewRole(role: RoomRole) {
  return role === 'owner' || role === 'editor' || role === 'reviewer';
}

function getProposalReviewStateLabel(state: 'proposed' | 'accepted' | 'rejected' | 'deferred') {
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

function getProposalTypeLabel(type: ProposalType) {
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

function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function cloneRun(run: Record<string, unknown>): Record<string, unknown> {
  return {
    ...run,
    actions: Array.isArray(run.actions)
      ? run.actions.map((action) => (isRecord(action) ? { ...action } : action))
      : [],
  };
}

function applyProposalReviewToProject(
  baseProject: Record<string, unknown>,
  proposalId: string,
  nextState: 'accepted' | 'rejected' | 'deferred',
  reviewNote: string,
  reviewerLabel: string,
  reviewerRole: RoomRole,
) {
  const now = nowIso();
  const proposalHistory = asArray<Record<string, unknown>>(baseProject.proposal_history);
  const proposal = proposalHistory.find((item) => isRecord(item) && item.id === proposalId);
  if (!proposal) {
    throw new functions.https.HttpsError('not-found', 'Proposal not found.');
  }

  if ((nextState === 'rejected' || nextState === 'deferred') && !reviewNote.trim()) {
    throw new functions.https.HttpsError('invalid-argument', `${getProposalReviewStateLabel(nextState)} requires a review note.`);
  }

  const noteForState =
    reviewNote.trim() ||
    (nextState === 'accepted'
      ? 'Accepted into packet.'
      : nextState === 'rejected'
        ? 'Rejected in review.'
        : 'Deferred for a later call.');

  const updatedRuns: Record<string, unknown>[] = asArray<Record<string, unknown>>(baseProject.runs).map((run) => cloneRun(run));
  let updatedDecisions = asArray<Record<string, unknown>>(baseProject.decisions).map((decision) => ({ ...decision }));
  let updatedCommitments = asArray<Record<string, unknown>>(baseProject.commitments).map((commitment) => ({ ...commitment }));
  let updatedContexts = asArray<Record<string, unknown>>(baseProject.context_items).map((item) => ({ ...item }));
  let promotedTarget = isRecord(proposal.promoted_target) ? { ...proposal.promoted_target } : undefined;
  let downstreamWorkTarget = isRecord(proposal.downstream_work_target) ? { ...proposal.downstream_work_target } : undefined;
  const outcomeTitle = getProposalReviewStateLabel(nextState);
  let outcomeDetail = noteForState;
  const proposalType = proposal.proposal_type as ProposalType;
  const targetId = typeof proposal.target_id === 'string' ? proposal.target_id : undefined;
  const targetTitle = typeof proposal.target_title === 'string' ? proposal.target_title : undefined;
  const parentRunId = typeof proposal.parent_run_id === 'string' ? proposal.parent_run_id : undefined;
  const proposalPayload = isRecord(proposal.proposal_payload) ? proposal.proposal_payload : {};

  const maybeCreateDownstreamWork = (sourceTitle: string, linkedDecisionId?: string) => {
    if (proposalType === 'open_action') return;
    const nextAction =
      typeof proposalPayload.next_action === 'string' && proposalPayload.next_action.trim()
        ? proposalPayload.next_action.trim()
        : '';
    const doneWhen =
      typeof proposalPayload.done_when === 'string' && proposalPayload.done_when.trim()
        ? proposalPayload.done_when.trim()
        : '';
    if (!nextAction && !doneWhen) return;

    const downstreamId =
      typeof proposalPayload.follow_up_commitment_id === 'string' && proposalPayload.follow_up_commitment_id.trim()
        ? proposalPayload.follow_up_commitment_id.trim()
        : `commitment_followup_${proposalId}`;
    const downstreamTitle =
      typeof proposalPayload.follow_up_title === 'string' && proposalPayload.follow_up_title.trim()
        ? proposalPayload.follow_up_title.trim()
        : `Follow through on ${sourceTitle}`;
    const downstreamRationale =
      typeof proposalPayload.follow_up_rationale === 'string' && proposalPayload.follow_up_rationale.trim()
        ? proposalPayload.follow_up_rationale.trim()
        : `Accepted from ${getProposalTypeLabel(proposalType).toLowerCase()} "${sourceTitle}".`;

    const nextCommitment = {
      id: downstreamId,
      title: downstreamTitle,
      timestamp: now,
      commitment_state: 'active',
      rationale: downstreamRationale,
      next_action: nextAction || `Advance ${sourceTitle}.`,
      done_when: doneWhen || 'A reviewer can confirm the accepted truth is now carried into real work.',
      decision_id: linkedDecisionId,
      confidence:
        proposalPayload.confidence === 'high' || proposalPayload.confidence === 'medium' || proposalPayload.confidence === 'low'
          ? proposalPayload.confidence
          : undefined,
      work_package:
        typeof proposalPayload.work_package === 'string' && proposalPayload.work_package.trim()
          ? proposalPayload.work_package.trim()
          : undefined,
      constraints:
        typeof proposalPayload.constraints === 'string' && proposalPayload.constraints.trim()
          ? proposalPayload.constraints.trim()
          : undefined,
    };

    const existing = updatedCommitments.find((item) => item.id === downstreamId);
    if (existing) {
      updatedCommitments = updatedCommitments.map((item) => (item.id === downstreamId ? { ...item, ...nextCommitment } : item));
    } else {
      updatedCommitments = [nextCommitment, ...updatedCommitments];
    }
    downstreamWorkTarget = {
      kind: 'commitment',
      id: downstreamId,
      label: downstreamTitle,
    };
  };

  switch (proposalType) {
    case 'run': {
      if (nextState === 'accepted') {
        const run = updatedRuns.find((item) => item.id === targetId);
        if (run) {
          run.run_state = 'active';
          run.updated_at = now;
          promotedTarget = {
            kind: 'run',
            id: String(run.id),
            label: typeof run.title === 'string' && run.title.trim() ? run.title.trim() : targetTitle || 'Proposed Run',
          };
          outcomeDetail = `${noteForState} Promoted into packet as active run "${promotedTarget.label}".`;
          maybeCreateDownstreamWork(typeof promotedTarget.label === 'string' ? promotedTarget.label : targetTitle || 'Proposed Run');
        }
      } else {
        const filteredRuns = updatedRuns.filter((run) => run.id !== targetId);
        updatedRuns.splice(0, updatedRuns.length, ...filteredRuns);
      }
      break;
    }
    case 'run_step': {
      if (nextState === 'accepted') {
        updatedRuns.forEach((run) => {
          if (run.id !== parentRunId) return;
          run.actions = asArray<Record<string, unknown>>(run.actions).map((action) =>
            action.id === targetId ? { ...action, state: 'accepted' } : action,
          );
          run.updated_at = now;
          const acceptedAction = asArray<Record<string, unknown>>(run.actions).find((action) => action.id === targetId);
          if (acceptedAction) {
            promotedTarget = {
              kind: 'run_step',
              id: String(acceptedAction.id),
              label:
                typeof acceptedAction.description === 'string' && acceptedAction.description.trim()
                  ? acceptedAction.description.trim()
                  : targetTitle || 'Proposed Step',
              parent_run_id: String(run.id),
            };
            outcomeDetail = `${noteForState} Accepted into run "${typeof run.title === 'string' ? run.title : 'Untitled Run'}".`;
          }
        });
      } else {
        updatedRuns.forEach((run) => {
          if (run.id !== parentRunId) return;
          run.actions = asArray<Record<string, unknown>>(run.actions).filter((action) => action.id !== targetId);
          run.updated_at = now;
        });
      }
      break;
    }
    case 'decision': {
      if (nextState === 'accepted') {
        updatedDecisions = updatedDecisions.map((decision) =>
          decision.id === targetId ? { ...decision, decision_state: 'accepted', timestamp: now } : decision,
        );
        const decision = updatedDecisions.find((item) => item.id === targetId);
        if (decision) {
          promotedTarget = {
            kind: 'decision',
            id: String(decision.id),
            label: typeof decision.title === 'string' ? decision.title : targetTitle || 'Proposed Decision',
          };
          outcomeDetail = `${noteForState} Promoted into packet as accepted decision "${promotedTarget.label}".`;
          maybeCreateDownstreamWork(
            typeof promotedTarget.label === 'string' ? promotedTarget.label : targetTitle || 'Proposed Decision',
            String(decision.id),
          );
        }
      } else if (nextState === 'deferred') {
        updatedDecisions = updatedDecisions.map((decision) =>
          decision.id === targetId ? { ...decision, decision_state: 'deferred', timestamp: now } : decision,
        );
        const decision = updatedDecisions.find((item) => item.id === targetId);
        if (decision) {
          outcomeDetail = `${noteForState} "${typeof decision.title === 'string' ? decision.title : 'Decision'}" remains visible as a deferred decision.`;
        }
      } else {
        updatedDecisions = updatedDecisions.filter((decision) => decision.id !== targetId);
      }
      break;
    }
    case 'scope_note':
    case 'source': {
      if (nextState === 'accepted') {
        updatedContexts = updatedContexts.map((item) =>
          item.id === targetId
            ? {
                ...item,
                context_state: 'accepted',
                review_note: noteForState,
                reviewed_at: now,
                updated_at: now,
              }
            : item,
        );
        const contextItem = updatedContexts.find((item) => item.id === targetId);
        if (contextItem) {
          promotedTarget = {
            kind: 'context_item',
            id: String(contextItem.id),
            label: typeof contextItem.title === 'string' ? contextItem.title : targetTitle || 'Proposed Scope Note',
          };
          outcomeDetail = `${noteForState} Promoted into packet as scope note "${promotedTarget.label}".`;
          maybeCreateDownstreamWork(
            typeof promotedTarget.label === 'string' ? promotedTarget.label : targetTitle || 'Proposed Scope Note',
          );
        }
      } else {
        updatedContexts = updatedContexts.filter((item) => item.id !== targetId);
      }
      break;
    }
    case 'open_action': {
      if (nextState === 'accepted') {
        updatedCommitments = updatedCommitments.map((commitment) =>
          commitment.id === targetId ? { ...commitment, commitment_state: 'active', timestamp: now } : commitment,
        );
        const commitment = updatedCommitments.find((item) => item.id === targetId);
        if (commitment) {
          promotedTarget = {
            kind: 'commitment',
            id: String(commitment.id),
            label: typeof commitment.title === 'string' ? commitment.title : targetTitle || 'Proposed Open Action',
          };
          outcomeDetail = `${noteForState} Promoted into packet as open action "${promotedTarget.label}".`;
        }
      } else {
        updatedCommitments = updatedCommitments.filter((commitment) => commitment.id !== targetId);
      }
      break;
    }
  }

  if (nextState === 'accepted' && downstreamWorkTarget) {
    outcomeDetail = `${outcomeDetail} Created downstream open action "${downstreamWorkTarget.label}".`;
  }

  const updatedProposalHistory = proposalHistory.map((item) =>
    item.id === proposalId
      ? {
          ...item,
          review_state: nextState,
          reviewed_at: now,
          review_note: noteForState,
          reviewed_by: reviewerLabel,
          reviewed_by_role: reviewerRole,
          promoted_target: nextState === 'accepted' ? promotedTarget : item.promoted_target,
          downstream_work_target: nextState === 'accepted' ? downstreamWorkTarget : item.downstream_work_target,
        }
      : item,
  );

  const basePacketVersion =
    typeof baseProject.packet_version === 'number' && Number.isFinite(baseProject.packet_version)
      ? Math.floor(baseProject.packet_version)
      : 1;
  const nextPacketVersion = nextState === 'accepted' ? basePacketVersion + 1 : basePacketVersion;

  return {
    ...baseProject,
    updated_at: now,
    packet_version: nextPacketVersion,
    runs: updatedRuns,
    decisions: updatedDecisions,
    commitments: updatedCommitments,
    context_items: updatedContexts,
    proposal_history: updatedProposalHistory,
    activity: [
      ...asArray<Record<string, unknown>>(baseProject.activity),
      {
        id: `act_${Date.now()}_${proposalId}`,
        kind: 'status_update',
        title: `${getProposalTypeLabel(proposalType)} ${outcomeTitle.toLowerCase()}`,
        detail: `${typeof proposal.proposal_summary === 'string' ? proposal.proposal_summary : 'Proposal'} | Source: ${typeof proposal.proposed_by === 'string' ? proposal.proposed_by : proposal.proposal_source}. ${outcomeDetail}${nextState === 'accepted' ? ` Packet version is now v${nextPacketVersion}.` : ''}`,
        timestamp: now,
      },
    ],
  };
}

function reviewerDisplayLabel(memberData: Record<string, unknown>, fallbackUid: string) {
  if (typeof memberData.display_name === 'string' && memberData.display_name.trim()) return memberData.display_name.trim();
  if (typeof memberData.email === 'string' && memberData.email.trim()) return memberData.email.trim();
  return fallbackUid;
}

function validateProposalBundle(
  payload: unknown,
  options: {
    roomId: string;
    packetVersion: number;
    existingClientRequestIds: string[];
    existingRunIds: string[];
  }
): { ok: true; value: ProposalBundleV1; fingerprint: string } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(payload)) {
    return { ok: false, errors: ['Proposal bundle must be a JSON object.'] };
  }

  const bundleId = typeof payload.bundle_id === 'string' && payload.bundle_id.trim() ? payload.bundle_id.trim() : '';
  const roomId = typeof payload.room_id === 'string' && payload.room_id.trim() ? payload.room_id.trim() : '';
  const clientRequestId =
    typeof payload.client_request_id === 'string' && payload.client_request_id.trim() ? payload.client_request_id.trim() : '';
  const agentId = typeof payload.agent_id === 'string' && payload.agent_id.trim() ? payload.agent_id.trim() : '';
  const submittedAt =
    typeof payload.submitted_at === 'string' && payload.submitted_at.trim() ? payload.submitted_at.trim() : nowIso();
  const humanSummary =
    typeof payload.human_summary === 'string' && payload.human_summary.trim() ? payload.human_summary.trim() : '';
  const packetVersionSeen =
    typeof payload.packet_version_seen === 'number' && Number.isFinite(payload.packet_version_seen)
      ? Math.floor(payload.packet_version_seen)
      : NaN;
  const rawProposals = Array.isArray(payload.proposals) ? payload.proposals : [];

  if (!bundleId) errors.push('bundle_id is required.');
  if (!roomId) errors.push('room_id is required.');
  if (roomId && roomId !== options.roomId) {
    errors.push('room_id does not match the targeted shared packet room.');
  }
  if (!clientRequestId) errors.push('client_request_id is required.');
  if (clientRequestId && options.existingClientRequestIds.includes(clientRequestId)) {
    errors.push('client_request_id has already been used for this packet.');
  }
  if (!agentId) errors.push('agent_id is required.');
  if (!humanSummary) errors.push('human_summary is required.');
  if (humanSummary.length > 280) errors.push('human_summary must stay under 280 characters.');
  if (!Number.isFinite(packetVersionSeen)) errors.push('packet_version_seen must be a finite number.');
  if (Number.isFinite(packetVersionSeen) && packetVersionSeen !== options.packetVersion) {
    errors.push(`packet_version_seen is stale. Active packet version is v${options.packetVersion}.`);
  }
  if (rawProposals.length === 0) errors.push('proposals must contain at least one item.');
  if (rawProposals.length > 25) errors.push('proposals cannot contain more than 25 items in one bundle.');

  const executionTrace = parseExecutionTrace(payload.execution_trace);
  if (payload.execution_trace !== undefined && !executionTrace) {
    errors.push('execution_trace must be a valid object when provided.');
  }

  const proposals: ProposalBundleItemInput[] = [];
  rawProposals.forEach((proposal, index) => {
    if (!isRecord(proposal)) {
      errors.push(`proposals[${index}] must be an object.`);
      return;
    }
    const type = proposal.type;
    const proposalType: ProposalType | null =
      type === 'run' ||
      type === 'run_step' ||
      type === 'decision' ||
      type === 'scope_note' ||
      type === 'source' ||
      type === 'open_action'
        ? type
        : null;
    if (!proposalType) {
      errors.push(`proposals[${index}] uses an unsupported type.`);
      return;
    }

    const itemPayload = sanitizeProposalPayload(proposal.payload);
    const runId = typeof proposal.run_id === 'string' && proposal.run_id.trim() ? proposal.run_id.trim() : undefined;
    if (proposalType === 'run_step' && !runId) {
      errors.push(`proposals[${index}] requires run_id for run_step.`);
    } else if (proposalType === 'run_step' && runId && !options.existingRunIds.includes(runId)) {
      errors.push(`proposals[${index}] references an unknown run_id.`);
    }
    if (
      (proposalType === 'decision' ||
        proposalType === 'open_action' ||
        proposalType === 'run' ||
        proposalType === 'scope_note' ||
        proposalType === 'source') &&
      typeof itemPayload.title !== 'string'
    ) {
      errors.push(`proposals[${index}] requires payload.title.`);
    }
    if (proposalType === 'open_action') {
      if (typeof itemPayload.next_action !== 'string' || !String(itemPayload.next_action).trim()) {
        errors.push(`proposals[${index}] requires payload.next_action.`);
      }
      if (typeof itemPayload.done_when !== 'string' || !String(itemPayload.done_when).trim()) {
        errors.push(`proposals[${index}] requires payload.done_when.`);
      }
    }
    if (proposalType === 'run') {
      const actions = itemPayload.actions;
      if (!Array.isArray(actions) || actions.length === 0) {
        errors.push(`proposals[${index}] requires a non-empty actions list for a run.`);
      }
    }
    const payloadLength = JSON.stringify(itemPayload).length;
    if (payloadLength > 12000) {
      errors.push(`proposals[${index}] payload is too large.`);
    }

    proposals.push({
      type: proposalType,
      run_id: runId,
      payload: itemPayload,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const validated: ProposalBundleV1 = {
    bundle_id: bundleId,
    room_id: roomId,
    packet_version_seen: packetVersionSeen,
    client_request_id: clientRequestId,
    agent_id: agentId,
    submitted_at: submittedAt,
    human_summary: humanSummary,
    execution_trace: executionTrace,
    proposals,
  };
  return { ok: true, value: validated, fingerprint: buildDeterministicFingerprint(validated) };
}

export const submitProjectProposalBundle = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Use POST for proposal bundle submission.' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'submit-project-proposal-bundle', windowMs: 60 * 60 * 1000, max: 120 })) return;
  if (!applyBodyLimit(req, res, 128 * 1024)) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const requestedRoomId = isRecord(req.body) && typeof req.body.room_id === 'string' ? req.body.room_id.trim() : '';
    if (!requestedRoomId) {
      res.status(400).json({ ok: false, error: 'invalid_request', message: 'room_id is required.' });
      return;
    }

    const roomRef = db.collection('project_rooms').doc(requestedRoomId);
    const memberRef = roomRef.collection('members').doc(auth.uid);

    const result = await db.runTransaction(async (transaction) => {
      const [roomSnap, memberSnap] = await Promise.all([transaction.get(roomRef), transaction.get(memberRef)]);
      if (!roomSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Shared packet room was not found.');
      }
      if (!memberSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this shared packet room.');
      }

      const memberData = memberSnap.data() || {};
      const role = (memberData.role as RoomRole) || 'viewer';
      if (!canSubmitRole(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Reviewer role or higher is required to submit proposal bundles.');
      }

      const roomData = roomSnap.data() || {};
      const project = isRecord(roomData.project) ? (roomData.project as Record<string, unknown>) : null;
      if (!project) {
        throw new functions.https.HttpsError('failed-precondition', 'Shared packet room has no project packet to stage into.');
      }

      const packetVersion =
        typeof project.packet_version === 'number' && Number.isFinite(project.packet_version)
          ? Math.floor(project.packet_version)
          : 1;
      const proposalHistory = Array.isArray(project.proposal_history) ? [...project.proposal_history] : [];
      const existingClientRequestIds = proposalHistory
        .map((proposal) =>
          isRecord(proposal) && typeof proposal.client_request_id === 'string' ? proposal.client_request_id.trim() : ''
        )
        .filter((value) => value.length > 0);
      const existingRunIds = Array.isArray(project.runs)
        ? project.runs
            .map((run) => (isRecord(run) && typeof run.id === 'string' ? run.id : ''))
            .filter((value) => value.length > 0)
        : [];

      const validation = validateProposalBundle(req.body, {
        roomId: requestedRoomId,
        packetVersion,
        existingClientRequestIds,
        existingRunIds,
      });

      if (!validation.ok) {
        throw new functions.https.HttpsError('invalid-argument', validation.errors.join(' '));
      }

      const bundle = validation.value;
      const now = nowIso();
      const runs = Array.isArray(project.runs) ? [...project.runs] : [];
      const contextItems = Array.isArray(project.context_items) ? [...project.context_items] : [];
      const decisions = Array.isArray(project.decisions) ? [...project.decisions] : [];
      const commitments = Array.isArray(project.commitments) ? [...project.commitments] : [];
      const activity = Array.isArray(project.activity) ? [...project.activity] : [];
      const nextProposalHistory = [...proposalHistory];

      bundle.proposals.forEach((proposal, index) => {
        const idSeed = `${bundle.bundle_id}_${index}_${Date.now()}`;
        const proposalTargetId = `agent_prop_${idSeed}`;
        const proposalRecordId = `proposal_record_${idSeed}`;
        const proposalPayload = proposal.payload;
        let targetId: string | undefined;
        let targetTitle =
          typeof proposalPayload.title === 'string' && proposalPayload.title.trim()
            ? proposalPayload.title.trim()
            : typeof proposalPayload.description === 'string' && proposalPayload.description.trim()
              ? proposalPayload.description.trim()
              : proposal.type;
        let parentRunId: string | undefined = proposal.run_id;

        if (proposal.type === 'run') {
          targetId = proposalTargetId;
          runs.push({
            id: proposalTargetId,
            title: targetTitle || 'Proposed Run',
            run_type: typeof proposalPayload.run_type === 'string' ? proposalPayload.run_type : 'agent_operation',
            run_state: 'proposed',
            created_at: now,
            updated_at: now,
            actions: Array.isArray(proposalPayload.actions)
              ? proposalPayload.actions.map((action, actionIndex) => ({
                  id: `${proposalTargetId}_a${actionIndex}`,
                  description:
                    isRecord(action) && typeof action.description === 'string' && action.description.trim()
                      ? action.description.trim()
                      : 'Action step',
                  state: 'proposed',
                }))
              : [],
            agent_label: bundle.agent_id,
          });
        } else if (proposal.type === 'run_step' && proposal.run_id) {
          const run = runs.find((item) => isRecord(item) && item.id === proposal.run_id) as Record<string, unknown> | undefined;
          if (!run) {
            throw new functions.https.HttpsError('invalid-argument', `run_step proposal references missing run_id "${proposal.run_id}".`);
          }
          targetId = proposalTargetId;
          targetTitle =
            typeof proposalPayload.description === 'string' && proposalPayload.description.trim()
              ? proposalPayload.description.trim()
              : 'Proposed step';
          const actions = Array.isArray(run.actions) ? [...run.actions] : [];
          actions.push({ id: proposalTargetId, description: targetTitle, state: 'proposed' });
          run.actions = actions;
          run.updated_at = now;
        } else if (proposal.type === 'scope_note' || proposal.type === 'source') {
          targetId = proposalTargetId;
          contextItems.push({
            id: proposalTargetId,
            project_id: typeof project.id === 'string' ? project.id : requestedRoomId,
            title: targetTitle || 'Proposed Note',
            body: typeof proposalPayload.body === 'string' ? proposalPayload.body : '',
            context_type: proposal.type === 'source' ? 'working_note' : 'requirement',
            context_state: 'proposed',
            created_at: now,
            updated_at: now,
            actor_type: 'agent',
            actor_name: bundle.agent_id,
            source_type: 'agent_proposal',
          });
        } else if (proposal.type === 'decision') {
          targetId = proposalTargetId;
          decisions.push({
            id: proposalTargetId,
            timestamp: now,
            title: targetTitle || 'Proposed Decision',
            rationale: typeof proposalPayload.rationale === 'string' ? proposalPayload.rationale : '',
            decision_state: 'proposed',
          });
        } else if (proposal.type === 'open_action') {
          targetId = proposalTargetId;
          commitments.push({
            id: proposalTargetId,
            title: targetTitle || 'Proposed Action',
            timestamp: now,
            commitment_state: 'proposed',
            rationale: typeof proposalPayload.rationale === 'string' ? proposalPayload.rationale : '',
            next_action: typeof proposalPayload.next_action === 'string' ? proposalPayload.next_action : '',
            done_when: typeof proposalPayload.done_when === 'string' ? proposalPayload.done_when : '',
          });
        }

        nextProposalHistory.unshift({
          id: proposalRecordId,
          proposal_type: proposal.type,
          proposal_source: 'remote_agent_submission',
          proposed_at: bundle.submitted_at || now,
          proposal_bundle_id: bundle.bundle_id,
          proposal_bundle_label: `Proposal Bundle ${bundle.bundle_id.slice(-6)}`,
          proposal_bundle_source: bundle.agent_id,
          client_request_id: bundle.client_request_id,
          packet_version_seen: bundle.packet_version_seen,
          proposal_bundle_human_summary: bundle.human_summary,
          proposal_bundle_fingerprint: validation.fingerprint,
          proposal_bundle_validation: { status: 'valid', errors: [] },
          execution_trace_summary: buildExecutionTraceSummary(bundle.execution_trace),
          proposal_summary: targetTitle,
          payload_summary: buildProposalPayloadSummary(proposalPayload),
          proposal_payload: sanitizeProposalPayload(proposalPayload),
          review_state: 'proposed',
          proposed_by: bundle.agent_id,
          source_label: 'Remote Agent Submission',
          target_id: targetId,
          target_title: targetTitle,
          parent_run_id: parentRunId,
        });
      });

      activity.push({
        id: `act_${Date.now()}`,
        kind: 'status_update',
        title: 'Remote proposal bundle staged for review',
        detail: `${bundle.human_summary} ${bundle.proposals.length} proposal${bundle.proposals.length === 1 ? '' : 's'} from ${bundle.agent_id} entered Waiting for Judgment against packet v${bundle.packet_version_seen}. Fingerprint ${validation.fingerprint}.`,
        timestamp: now,
      });

      const nextProject = {
        ...project,
        updated_at: now,
        runs,
        context_items: contextItems,
        decisions,
        commitments,
        proposal_history: nextProposalHistory,
        activity,
      };

      transaction.update(roomRef, {
        project: nextProject,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const eventRef = roomRef.collection('events').doc();
      transaction.set(eventRef, {
        actor_uid: auth.uid,
        actor_label: typeof memberData.display_name === 'string' && memberData.display_name.trim()
          ? memberData.display_name.trim()
          : auth.uid,
        action: 'proposal_bundle_submitted',
        object_type: 'proposal_bundle',
        object_id: bundle.bundle_id,
        summary: `${bundle.agent_id} submitted ${bundle.proposals.length} proposal${bundle.proposals.length === 1 ? '' : 's'} for review.`,
        timestamp: now,
        metadata: {
          bundle_id: bundle.bundle_id,
          client_request_id: bundle.client_request_id,
          packet_version_seen: bundle.packet_version_seen,
          fingerprint: validation.fingerprint,
          submitted_by_uid: auth.uid,
        },
      });

      return {
        room_id: requestedRoomId,
        bundle_id: bundle.bundle_id,
        packet_version_seen: bundle.packet_version_seen,
        staged_count: bundle.proposals.length,
        fingerprint: validation.fingerprint,
        message: 'Proposal bundle staged for Waiting for Judgment.',
      };
    });

    res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      const status =
        error.code === 'permission-denied' ? 403 :
        error.code === 'not-found' ? 404 :
        error.code === 'failed-precondition' ? 412 :
        error.code === 'invalid-argument' ? 400 : 500;
      res.status(status).json({ ok: false, error: error.code, message: error.message });
      return;
    }
    res.status(500).json({
      ok: false,
      error: 'internal',
      message: error instanceof Error ? error.message : 'Remote proposal submission failed.',
    });
  }
});

export const reviewProjectProposalBundle = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed', message: 'Use POST for proposal review.' });
    return;
  }
  if (!applyRateLimit(req, res, { bucket: 'review-project-proposal-bundle', windowMs: 60 * 60 * 1000, max: 240 })) return;
  if (!applyBodyLimit(req, res, 64 * 1024)) return;

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const body = isRecord(req.body) ? req.body : {};
    const roomId = typeof body.room_id === 'string' ? body.room_id.trim() : '';
    const proposalId = typeof body.proposal_id === 'string' ? body.proposal_id.trim() : '';
    const bundleId = typeof body.bundle_id === 'string' ? body.bundle_id.trim() : '';
    const decision =
      body.decision === 'accepted' || body.decision === 'rejected' || body.decision === 'deferred'
        ? body.decision
        : null;
    const reviewNote = typeof body.review_note === 'string' ? body.review_note.trim() : '';

    if (!roomId) {
      res.status(400).json({ ok: false, error: 'invalid_request', message: 'room_id is required.' });
      return;
    }
    if (!decision) {
      res.status(400).json({ ok: false, error: 'invalid_request', message: 'decision must be accepted, rejected, or deferred.' });
      return;
    }
    if (!proposalId && !bundleId) {
      res.status(400).json({ ok: false, error: 'invalid_request', message: 'proposal_id or bundle_id is required.' });
      return;
    }
    if ((decision === 'rejected' || decision === 'deferred') && !reviewNote) {
      res.status(400).json({ ok: false, error: 'invalid_request', message: `${getProposalReviewStateLabel(decision)} requires a review note.` });
      return;
    }

    const roomRef = db.collection('project_rooms').doc(roomId);
    const memberRef = roomRef.collection('members').doc(auth.uid);

    const result = await db.runTransaction(async (transaction) => {
      const [roomSnap, memberSnap] = await Promise.all([transaction.get(roomRef), transaction.get(memberRef)]);
      if (!roomSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Shared packet room was not found.');
      }
      if (!memberSnap.exists) {
        throw new functions.https.HttpsError('permission-denied', 'You are not a member of this shared packet room.');
      }

      const memberData = memberSnap.data() || {};
      const role = (memberData.role as RoomRole) || 'viewer';
      if (!canReviewRole(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Reviewer role or higher is required to judge proposals.');
      }

      const roomData = roomSnap.data() || {};
      const project = isRecord(roomData.project) ? ({ ...(roomData.project as Record<string, unknown>) }) : null;
      if (!project) {
        throw new functions.https.HttpsError('failed-precondition', 'Shared packet room has no project packet to review.');
      }

      const proposalHistory = asArray<Record<string, unknown>>(project.proposal_history);
      const pendingProposalIds =
        bundleId
          ? proposalHistory
              .filter((item) => item.proposal_bundle_id === bundleId && item.review_state === 'proposed')
              .map((item) => String(item.id))
          : proposalHistory
              .filter((item) => item.id === proposalId && item.review_state === 'proposed')
              .map((item) => String(item.id));

      if (pendingProposalIds.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No waiting proposals matched this review request.');
      }

      let nextProject = project;
      for (const pendingId of pendingProposalIds) {
        nextProject = applyProposalReviewToProject(
          nextProject,
          pendingId,
          decision,
          reviewNote,
          reviewerDisplayLabel(memberData, auth.uid),
          role,
        );
      }

      transaction.update(roomRef, {
        project: nextProject,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const eventRef = roomRef.collection('events').doc();
      transaction.set(eventRef, {
        actor_uid: auth.uid,
        actor_label: reviewerDisplayLabel(memberData, auth.uid),
        action: bundleId ? 'proposal_bundle_reviewed' : 'proposal_reviewed',
        object_type: bundleId ? 'proposal_bundle' : 'proposal',
        object_id: bundleId || proposalId,
        summary: bundleId
          ? `${reviewerDisplayLabel(memberData, auth.uid)} marked ${pendingProposalIds.length} proposal${pendingProposalIds.length === 1 ? '' : 's'} ${getProposalReviewStateLabel(decision).toLowerCase()}.`
          : `${reviewerDisplayLabel(memberData, auth.uid)} marked 1 proposal ${getProposalReviewStateLabel(decision).toLowerCase()}.`,
        timestamp: nowIso(),
        metadata: {
          decision,
          review_note: reviewNote || null,
          proposal_ids: pendingProposalIds,
          packet_version: nextProject.packet_version,
        },
      });

      return {
        room_id: roomId,
        proposal_id: proposalId || null,
        bundle_id: bundleId || null,
        decision,
        reviewed_count: pendingProposalIds.length,
        packet_version: nextProject.packet_version,
        message: bundleId
          ? `Reviewed ${pendingProposalIds.length} proposal${pendingProposalIds.length === 1 ? '' : 's'} in bundle ${bundleId}.`
          : 'Proposal reviewed successfully.',
      };
    });

    res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      const status =
        error.code === 'permission-denied' ? 403 :
        error.code === 'not-found' ? 404 :
        error.code === 'failed-precondition' ? 412 :
        error.code === 'invalid-argument' ? 400 : 500;
      res.status(status).json({ ok: false, error: error.code, message: error.message });
      return;
    }
    res.status(500).json({
      ok: false,
      error: 'internal',
      message: error instanceof Error ? error.message : 'Proposal review failed.',
    });
  }
});
