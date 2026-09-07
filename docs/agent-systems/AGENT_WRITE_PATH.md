# Agent Write-Path

Prosper now has one official first-party path for coding agents to write into a packet room:

1. Export the Agent Brief from a project or shared packet room.
2. Generate or edit a room-bound proposal draft against that brief.
3. Validate the bundle locally with `scripts/agent_write_path.py`.
4. Either submit the validated bundle to the remote room endpoint or import it into the Agent Proposal Intake gateway.
5. Let a human reviewer accept, reject, or defer the waiting bundle.

This is intentionally supervised. Agents can propose work, but they cannot write accepted truth directly into the packet.

## Files

- Helper script: `D:\Hearth\prosper2\scripts\agent_write_path.py`
- Example bundle: `D:\Hearth\prosper2\docs\agent-systems\example-proposal-bundle.json`

## Example

```bash
python scripts/agent_write_path.py \
  --brief agent-brief-room-abc123.json \
  --input proposal-draft-room-abc123.json \
  --print-template

python scripts/agent_write_path.py \
  --brief agent-brief-room-abc123.json \
  --input proposal-draft-room-abc123.json \
  --output out/proposal-bundle-room-abc123.json \
  --dry-run
```

Then run without `--dry-run` and with `--submit` to stage it in the room.

The product now treats this as a room-bound path: export a room-specific brief, fill a room-specific draft, validate it, then submit it back into that same room.

## Repo-native entrypoint

Prosper should also be visible from the repo, not only from the web UI.

To emit a room-bound `AGENTS.md` snippet from the current Agent Brief:

```bash
python scripts/agent_write_path.py \
  --brief agent-brief-room-abc123.json \
  --input proposal-draft-room-abc123.json \
  --print-agents-md
```

Drop that output into the repo's `AGENTS.md` so a fresh coding-agent session can find the official write-path without a custom explanation.

## Fastest starter path

If you want the helper to generate a contract-aligned starter bundle from the current Agent Brief:

```bash
python scripts/agent_write_path.py \
  --brief agent-brief-room-abc123.json \
  --input proposal-draft-room-abc123.json \
  --print-template
```

This prints a minimal bundle template using:

- the current `room_id`
- the current `packet_version`
- the current room goal
- the current `safe_next_proposal`

Use that output as the starting point for a real proposal bundle instead of guessing the contract by hand.

## What success looks like

The official path is:

`Agent Brief -> valid Proposal Bundle -> remote submit -> Waiting for Judgment`

On success, the remote endpoint returns a structured payload including:

- `room_id`
- `bundle_id`
- `packet_version_seen`
- `staged_count`
- `fingerprint`
- `message`

That response means the bundle is staged for review. It does not mean packet truth changed.

The helper also prints a `brief_summary` block so an agent or operator can verify:

- which room it is targeting
- which packet version it saw
- what the packet goal is
- what the current safe next proposal is
- which remote endpoint it resolved
- what the exact next step should be if validation passed

## Remote submit

When the Agent Brief includes `remote_submission.endpoint`, or when you provide one explicitly, the helper can submit remotely:

```bash
python scripts/agent_write_path.py \
  --brief agent-brief-room-abc123.json \
  --input proposal-draft-room-abc123.json \
  --submit \
  --id-token "$PROSPER_FIREBASE_ID_TOKEN"
```

You can also override the endpoint with `--endpoint` or `PROSPER_SUBMISSION_ENDPOINT`.

Success and failure output now include a direct `next_step` so an operator or coding agent can recover without guessing.

## Common failure: stale packet version

If the room moved forward before submission, the endpoint rejects the bundle with a stale `packet_version_seen` error.

The fix is practical:

1. Export a fresh Agent Brief.
2. Rebuild the bundle against the new packet version.
3. Resubmit with a new `client_request_id`.

Do not retry the old bundle unchanged. The stale error is the review boundary working as intended.

The helper prints a `stale_hint` when this happens so the next move is machine-readable as well as human-readable.

Other failure modes now also include a plain `next_step`, for example:

- export a fresh Agent Brief from Agent Setup
- refresh the Firebase ID token for the shared-room member
- correct the remote endpoint for the current room

## Proposal Policy Envelopes & Process Defect Codes

Proposal bundles are evaluated against a declarative **Proposal Policy Envelope** before landing in `/review`. Validation returns machine-readable, structured **Process Defect Codes** inspired by ProcBench:

| Defect Code | Trigger Condition | Agent Recovery Action |
| --- | --- | --- |
| `stale_context` | `packet_version_seen` is outdated relative to active brief. | Export a fresh Agent Brief, rebuild proposal against active version, and submit with a new `client_request_id`. |
| `missing_rationale` | `decision` or `open_action` missing `payload.rationale`. | Include clean reasoning in `payload.rationale`. |
| `underspecified_action` | `open_action` missing `next_action`/`done_when`, or missing `title`. | Specify explicit `next_action`, `done_when`, and non-empty `title`. |
| `oversized_bundle` | Proposals > 25 (or policy limit) or payload > 12 KB. | Split into smaller, reviewable atomic bundles. |
| `unsupported_operation` | Proposal type not in allowed list (`run`, `run_step`, `decision`, `scope_note`, `source`, `open_action`). | Use allowed proposal types specified in the Agent Brief. |
| `collision_risk` | `client_request_id` already used or unknown `run_id`. | Generate a new `client_request_id` or fix `run_id`. |
| `weak_summary` | `human_summary` < 10 chars, > 280 chars, or contains generic placeholders (e.g. `do work`, `tbd`, `todo`, `advance the packet safely`). | Write a clear, specific 1-sentence summary of the intent for human review. |
| `failed_attempt` | `execution_trace` exit code != 0. | Resolve local test/command failures before submitting for human judgment. |

> [!IMPORTANT]
> **Why Silent Failure is Worse than Rejected Work:**
> Silent failures, hidden errors, or bypassing policy checks obscure agent drift. A structured policy failure allows agents to self-correct automatically. All accepted truth still strictly requires explicit human judgment.

## What gets validated

- `room_id` must match the Agent Brief room
- `packet_version_seen` must match the current packet version
- `client_request_id` must exist and be unique
- `human_summary` must exist, stay compact (10-280 chars), and avoid generic placeholders
- `execution_trace` must have exit code 0 when provided
- proposal types must be allowed by the brief
- `run_step` proposals must target an active `run_id`
- `decision` and `open_action` proposals must include a non-empty rationale
- oversized or empty bundles are rejected with structured defect details

## Minimal schema reminder

Every remote bundle must include:

- `bundle_id`
- `room_id`
- `packet_version_seen`
- `client_request_id`
- `agent_id`
- `submitted_at`
- `human_summary`
- `proposals[]`

Optional:

- `execution_trace`

## Current boundary

Shared packet rooms now expose a real authenticated submission endpoint. Private local-only projects still use the verified local gateway path.

- Shared room path:
  `Agent Brief -> validated bundle -> remote endpoint -> Waiting for Judgment`
- Local fallback:
  `Agent Brief -> validated bundle file -> Agent Proposal Intake -> Waiting for Judgment`

The endpoint still only stages review work. It cannot accept truth into the packet directly.

## Practical loop

The official supervised loop is:

1. Export a fresh Agent Brief from the shared packet room
2. Print a starter template if needed
3. Build one compact proposal bundle
4. Dry-run validate it locally
5. Submit remotely
6. Open `/review`
7. Let a human accept, reject, or defer it into packet truth
