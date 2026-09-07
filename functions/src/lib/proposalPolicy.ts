export type ProposalDefectCode =
  | 'stale_context'
  | 'missing_rationale'
  | 'underspecified_action'
  | 'oversized_bundle'
  | 'unsupported_operation'
  | 'collision_risk'
  | 'weak_summary'
  | 'failed_attempt';

export interface ProposalDefect {
  code: ProposalDefectCode;
  message: string;
  path?: string;
  next_step?: string;
}

export interface ProposalPolicyEnvelope {
  version: 'v1';
  max_proposals_per_bundle: number;
  allowed_proposal_types: string[];
  require_execution_trace_clean_exit: boolean;
  min_human_summary_length: 10;
  max_human_summary_length: 280;
  blocked_placeholders: string[];
  require_rationale_for_types: string[];
}

export const DEFAULT_PROPOSAL_POLICY_ENVELOPE: ProposalPolicyEnvelope = {
  version: 'v1',
  max_proposals_per_bundle: 25,
  allowed_proposal_types: ['run', 'run_step', 'decision', 'scope_note', 'source', 'open_action'],
  require_execution_trace_clean_exit: false,
  min_human_summary_length: 10,
  max_human_summary_length: 280,
  blocked_placeholders: [
    'do work',
    'tbd',
    'todo',
    'lorem ipsum',
    'test summary',
  ],
  require_rationale_for_types: ['decision', 'open_action'],
};

export interface ValidationContextOptions {
  roomId: string;
  packetVersion: number;
  existingClientRequestIds: string[];
  existingRunIds: string[];
  policy?: Partial<ProposalPolicyEnvelope>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBundleWithPolicy(
  payload: unknown,
  options: ValidationContextOptions,
): { ok: true; defects: []; warnings: ProposalDefect[]; value: Record<string, unknown>; fingerprint: string } | { ok: false; defects: ProposalDefect[]; warnings: ProposalDefect[] } {
  const policy: ProposalPolicyEnvelope = {
    ...DEFAULT_PROPOSAL_POLICY_ENVELOPE,
    ...(options.policy || {}),
  };

  const defects: ProposalDefect[] = [];
  const warnings: ProposalDefect[] = [];

  if (!isRecord(payload)) {
    return {
      ok: false,
      defects: [
        {
          code: 'underspecified_action',
          message: 'Proposal bundle must be a JSON object.',
          path: '$',
          next_step: 'Pass a valid JSON object matching ProposalBundleV1.',
        },
      ],
      warnings: [],
    };
  }

  const bundleId = typeof payload.bundle_id === 'string' ? payload.bundle_id.trim() : '';
  const roomId = typeof payload.room_id === 'string' ? payload.room_id.trim() : '';
  const clientRequestId = typeof payload.client_request_id === 'string' ? payload.client_request_id.trim() : '';
  const agentId = typeof payload.agent_id === 'string' ? payload.agent_id.trim() : '';
  const humanSummary = typeof payload.human_summary === 'string' ? payload.human_summary.trim() : '';
  const packetVersionSeen =
    typeof payload.packet_version_seen === 'number' && Number.isFinite(payload.packet_version_seen)
      ? Math.floor(payload.packet_version_seen)
      : NaN;
  const rawProposals = Array.isArray(payload.proposals) ? payload.proposals : [];

  if (!bundleId) {
    defects.push({
      code: 'underspecified_action',
      message: 'bundle_id is required.',
      path: 'bundle_id',
      next_step: 'Provide a unique bundle_id (e.g. bundle_xxx).',
    });
  }

  if (!roomId) {
    defects.push({
      code: 'underspecified_action',
      message: 'room_id is required.',
      path: 'room_id',
      next_step: 'Provide the targeted room_id.',
    });
  } else if (roomId !== options.roomId) {
    defects.push({
      code: 'collision_risk',
      message: `room_id "${roomId}" does not match targeted shared packet room "${options.roomId}".`,
      path: 'room_id',
      next_step: 'Export a fresh brief for the targeted room before generating the bundle.',
    });
  }

  if (!clientRequestId) {
    defects.push({
      code: 'underspecified_action',
      message: 'client_request_id is required.',
      path: 'client_request_id',
      next_step: 'Generate a unique client_request_id for idempotency.',
    });
  } else if (options.existingClientRequestIds.includes(clientRequestId)) {
    defects.push({
      code: 'collision_risk',
      message: `client_request_id "${clientRequestId}" has already been staged for this packet.`,
      path: 'client_request_id',
      next_step: 'Generate a new client_request_id before resubmitting.',
    });
  }

  if (!agentId) {
    defects.push({
      code: 'underspecified_action',
      message: 'agent_id is required.',
      path: 'agent_id',
      next_step: 'Identify the agent submitting this proposal.',
    });
  }

  if (!humanSummary) {
    defects.push({
      code: 'weak_summary',
      message: 'human_summary is required.',
      path: 'human_summary',
      next_step: 'Write a clear 1-sentence summary of what this proposal changes for human review.',
    });
  } else {
    if (humanSummary.length < policy.min_human_summary_length) {
      defects.push({
        code: 'weak_summary',
        message: `human_summary is too short (${humanSummary.length} chars). Minimum is ${policy.min_human_summary_length}.`,
        path: 'human_summary',
        next_step: 'Provide a meaningful summary explaining the proposal intent.',
      });
    }
    if (humanSummary.length > policy.max_human_summary_length) {
      defects.push({
        code: 'weak_summary',
        message: `human_summary exceeds max length (${humanSummary.length}/${policy.max_human_summary_length}).`,
        path: 'human_summary',
        next_step: 'Keep human_summary concise (under 280 characters).',
      });
    }
    const lowerSummary = humanSummary.toLowerCase();
    if (policy.blocked_placeholders.some((placeholder) => lowerSummary === placeholder || lowerSummary.startsWith(placeholder))) {
      defects.push({
        code: 'weak_summary',
        message: `human_summary contains blocked generic placeholder text: "${humanSummary}".`,
        path: 'human_summary',
        next_step: 'Replace generic placeholder text with specific proposal intent.',
      });
    }
  }

  if (!Number.isFinite(packetVersionSeen)) {
    defects.push({
      code: 'stale_context',
      message: 'packet_version_seen must be a finite number.',
      path: 'packet_version_seen',
      next_step: 'Include packet_version_seen from the exported Agent Brief.',
    });
  } else if (packetVersionSeen !== options.packetVersion) {
    defects.push({
      code: 'stale_context',
      message: `packet_version_seen (v${packetVersionSeen}) is stale. Active packet version is v${options.packetVersion}.`,
      path: 'packet_version_seen',
      next_step: 'Export a fresh Agent Brief, rebuild against the active packet version, and retry with a new client_request_id.',
    });
  }

  if (rawProposals.length === 0) {
    defects.push({
      code: 'underspecified_action',
      message: 'proposals array must contain at least one item.',
      path: 'proposals',
      next_step: 'Include at least one valid proposal object in the proposals array.',
    });
  } else if (rawProposals.length > policy.max_proposals_per_bundle) {
    defects.push({
      code: 'oversized_bundle',
      message: `proposals array contains ${rawProposals.length} items. Policy maximum is ${policy.max_proposals_per_bundle}.`,
      path: 'proposals',
      next_step: 'Split large work into smaller, reviewable proposal bundles.',
    });
  }

  if (rawProposals.length > 10) {
    warnings.push({
      code: 'oversized_bundle',
      message: `Bundle contains ${rawProposals.length} proposals. Large bundles increase reviewer load and rejection risk.`,
      path: 'proposals',
      next_step: 'Consider splitting into smaller atomic bundles.',
    });
  }

  if (isRecord(payload.execution_trace)) {
    const trace = payload.execution_trace;
    if (typeof trace.exit_code === 'number' && trace.exit_code !== 0) {
      if (policy.require_execution_trace_clean_exit) {
        defects.push({
          code: 'failed_attempt',
          message: `execution_trace indicates non-zero exit code (${trace.exit_code}).`,
          path: 'execution_trace.exit_code',
          next_step: 'Resolve local execution/test failures before submitting work for human review.',
        });
      } else {
        warnings.push({
          code: 'failed_attempt',
          message: `execution_trace recorded non-zero exit code (${trace.exit_code}). Staged for review with warning.`,
          path: 'execution_trace.exit_code',
        });
      }
    }
  }

  rawProposals.forEach((proposal, index) => {
    const itemPath = `proposals[${index}]`;
    if (!isRecord(proposal)) {
      defects.push({
        code: 'underspecified_action',
        message: `${itemPath} must be an object.`,
        path: itemPath,
      });
      return;
    }

    const type = typeof proposal.type === 'string' ? proposal.type : '';
    if (!policy.allowed_proposal_types.includes(type)) {
      defects.push({
        code: 'unsupported_operation',
        message: `${itemPath} uses unsupported type "${type}". Allowed: ${policy.allowed_proposal_types.join(', ')}.`,
        path: `${itemPath}.type`,
        next_step: `Use one of the supported proposal types: ${policy.allowed_proposal_types.join(', ')}.`,
      });
      return;
    }

    const itemPayload = isRecord(proposal.payload) ? proposal.payload : {};
    const runId = typeof proposal.run_id === 'string' ? proposal.run_id.trim() : '';

    if (type === 'run_step') {
      if (!runId) {
        defects.push({
          code: 'underspecified_action',
          message: `${itemPath} requires run_id for run_step proposal.`,
          path: `${itemPath}.run_id`,
        });
      } else if (!options.existingRunIds.includes(runId)) {
        defects.push({
          code: 'collision_risk',
          message: `${itemPath} references unknown run_id "${runId}".`,
          path: `${itemPath}.run_id`,
          next_step: 'Verify active run IDs in the exported Agent Brief.',
        });
      }
    }

    if (policy.require_rationale_for_types.includes(type)) {
      const rationale = typeof itemPayload.rationale === 'string' ? itemPayload.rationale.trim() : '';
      if (!rationale) {
        defects.push({
          code: 'missing_rationale',
          message: `${itemPath} (${type}) requires a non-empty rationale in payload.rationale.`,
          path: `${itemPath}.payload.rationale`,
          next_step: 'Explain the reasoning behind this decision or open action.',
        });
      }
    }

    if (type === 'open_action') {
      const nextAction = typeof itemPayload.next_action === 'string' ? itemPayload.next_action.trim() : '';
      const doneWhen = typeof itemPayload.done_when === 'string' ? itemPayload.done_when.trim() : '';
      if (!nextAction) {
        defects.push({
          code: 'underspecified_action',
          message: `${itemPath} (open_action) requires payload.next_action.`,
          path: `${itemPath}.payload.next_action`,
        });
      }
      if (!doneWhen) {
        defects.push({
          code: 'underspecified_action',
          message: `${itemPath} (open_action) requires payload.done_when.`,
          path: `${itemPath}.payload.done_when`,
        });
      }
    }

    if (type === 'run') {
      const actions = Array.isArray(itemPayload.actions) ? itemPayload.actions : [];
      if (actions.length === 0) {
        defects.push({
          code: 'underspecified_action',
          message: `${itemPath} (run) requires a non-empty actions list in payload.actions.`,
          path: `${itemPath}.payload.actions`,
        });
      }
    }

    const title = typeof itemPayload.title === 'string' ? itemPayload.title.trim() : '';
    if (type !== 'run_step' && !title) {
      defects.push({
        code: 'underspecified_action',
        message: `${itemPath} (${type}) requires a non-empty title in payload.title.`,
        path: `${itemPath}.payload.title`,
      });
    }

    const payloadLength = JSON.stringify(itemPayload).length;
    if (payloadLength > 12000) {
      defects.push({
        code: 'oversized_bundle',
        message: `${itemPath} payload exceeds size limit (${payloadLength}/12000 bytes).`,
        path: `${itemPath}.payload`,
      });
    }
  });

  if (defects.length > 0) {
    return { ok: false, defects, warnings };
  }

  const normalized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const fingerprint = `fp_${(hash >>> 0).toString(16).padStart(8, '0')}`;

  return {
    ok: true,
    defects: [],
    warnings,
    value: payload as Record<string, unknown>,
    fingerprint,
  };
}
