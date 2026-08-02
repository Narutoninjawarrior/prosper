#!/usr/bin/env python
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


ALLOWED_TYPES = {"run", "run_step", "decision", "scope_note", "source", "open_action"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_bundle(
    brief: Dict[str, Any],
    payload: Dict[str, Any],
    agent_id: str | None,
    human_summary: str | None,
) -> Dict[str, Any]:
    room_id = (
        payload.get("room_id")
        or brief.get("proposal_write_path", {}).get("room_id")
        or brief.get("room_identity", {}).get("id")
    )
    packet_version = payload.get("packet_version_seen", brief.get("packet_version"))
    effective_agent_id = payload.get("agent_id") or agent_id or "external_agent"
    effective_summary = payload.get("human_summary") or human_summary or "Packet update proposal bundle."
    client_request_id = payload.get("client_request_id") or f"req_{uuid.uuid4().hex[:12]}"
    bundle_id = payload.get("bundle_id") or f"bundle_{uuid.uuid4().hex[:12]}"
    submitted_at = payload.get("submitted_at") or now_iso()

    return {
        "bundle_id": bundle_id,
        "room_id": room_id,
        "packet_version_seen": packet_version,
        "client_request_id": client_request_id,
        "agent_id": effective_agent_id,
        "submitted_at": submitted_at,
        "human_summary": effective_summary,
        "execution_trace": payload.get("execution_trace"),
        "proposals": payload.get("proposals", []),
    }


def validate_bundle(brief: Dict[str, Any], bundle: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    write_path = brief.get("proposal_write_path", {})
    allowed_types = set(write_path.get("allowed_proposal_types", [])) or ALLOWED_TYPES
    room_id = write_path.get("room_id") or brief.get("room_identity", {}).get("id")
    packet_version = brief.get("packet_version")
    max_proposals = int(write_path.get("max_proposals_per_bundle", 25))
    existing_run_ids = {
        run.get("id")
        for run in brief.get("active_runs", [])
        if isinstance(run, dict) and isinstance(run.get("id"), str)
    }

    if not bundle.get("bundle_id"):
        errors.append("bundle_id is required.")
    if not bundle.get("room_id"):
        errors.append("room_id is required.")
    elif room_id and bundle["room_id"] != room_id:
        errors.append(f'room_id must match the Agent Brief room ({room_id}).')
    if bundle.get("packet_version_seen") is None:
        errors.append("packet_version_seen is required.")
    elif packet_version is not None and bundle["packet_version_seen"] != packet_version:
        errors.append(f'packet_version_seen is stale. Agent Brief expects v{packet_version}.')
    if not bundle.get("client_request_id"):
        errors.append("client_request_id is required.")
    if not bundle.get("agent_id"):
        errors.append("agent_id is required.")
    if not bundle.get("human_summary"):
        errors.append("human_summary is required.")
    elif len(str(bundle["human_summary"])) > 280:
        errors.append("human_summary must stay under 280 characters.")

    proposals = bundle.get("proposals", [])
    if not isinstance(proposals, list) or not proposals:
        errors.append("proposals must contain at least one item.")
        return errors
    if len(proposals) > max_proposals:
        errors.append(f"proposals cannot contain more than {max_proposals} items.")

    for index, proposal in enumerate(proposals):
        if not isinstance(proposal, dict):
            errors.append(f"proposals[{index}] must be an object.")
            continue
        proposal_type = proposal.get("type")
        if proposal_type not in allowed_types:
            errors.append(f"proposals[{index}] uses an unsupported type: {proposal_type}.")
            continue
        proposal_payload = proposal.get("payload")
        if not isinstance(proposal_payload, dict):
            errors.append(f"proposals[{index}] requires an object payload.")
            continue
        if proposal_type in {"run", "decision", "scope_note", "source", "open_action"} and not proposal_payload.get("title"):
            errors.append(f"proposals[{index}] requires payload.title.")
        if proposal_type == "run_step" and not proposal.get("run_id"):
            errors.append(f"proposals[{index}] requires run_id.")
        elif proposal_type == "run_step" and proposal.get("run_id") not in existing_run_ids:
            errors.append(f"proposals[{index}] references an unknown run_id.")
        if proposal_type == "open_action":
            if not proposal_payload.get("next_action"):
                errors.append(f"proposals[{index}] requires payload.next_action.")
            if not proposal_payload.get("done_when"):
                errors.append(f"proposals[{index}] requires payload.done_when.")
        if proposal_type == "run" and "actions" in proposal_payload:
            actions = proposal_payload.get("actions")
            if not isinstance(actions, list) or not actions:
                errors.append(f"proposals[{index}] requires a non-empty actions list.")
        if len(json.dumps(proposal_payload)) > 12000:
            errors.append(f"proposals[{index}] payload is too large.")

    return errors


def write_bundle(path: Path, bundle: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")


def submit_bundle(endpoint: str, id_token: str, bundle: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(bundle).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {id_token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status, payload
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8") if exc.fp else "{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {"ok": False, "error": "http_error", "message": body or str(exc)}
        return exc.code, payload


def infer_endpoint(brief: Dict[str, Any]) -> str | None:
    remote_submission = brief.get("remote_submission", {})
    if isinstance(remote_submission, dict):
        endpoint = remote_submission.get("endpoint")
        if isinstance(endpoint, str) and endpoint.strip():
            return endpoint.strip()
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build and validate a Prosper proposal bundle from an exported Agent Brief."
    )
    parser.add_argument("--brief", required=True, help="Path to an exported agent-brief JSON file.")
    parser.add_argument("--input", required=True, help="Path to a bundle draft JSON file.")
    parser.add_argument("--output", help="Optional output path for the canonical bundle.")
    parser.add_argument("--agent-id", help="Fallback agent identifier when input omits agent_id.")
    parser.add_argument("--summary", help="Fallback human summary when input omits human_summary.")
    parser.add_argument("--submit", action="store_true", help="Submit the validated bundle to the remote Prosper endpoint.")
    parser.add_argument("--endpoint", help="Override the remote submission endpoint.")
    parser.add_argument("--id-token", help="Firebase ID token from a shared-room member.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print a result without writing files.")
    args = parser.parse_args()

    brief = load_json(Path(args.brief))
    payload = load_json(Path(args.input))
    bundle = build_bundle(brief, payload, args.agent_id, args.summary)
    errors = validate_bundle(brief, bundle)

    if errors:
        print(json.dumps({"ok": False, "errors": errors}, indent=2))
        return 1

    result: Dict[str, Any] = {
        "ok": True,
        "bundle_id": bundle["bundle_id"],
        "room_id": bundle["room_id"],
        "packet_version_seen": bundle["packet_version_seen"],
        "client_request_id": bundle["client_request_id"],
        "proposal_count": len(bundle["proposals"]),
        "next_step": "Import this JSON into the Prosper Agent Proposal Intake gateway."
    }

    if not args.dry_run and args.output:
        write_bundle(Path(args.output), bundle)
        result["output"] = args.output

    if args.submit:
        if args.dry_run:
            result["next_step"] = "Dry run only. No remote submission was attempted."
            print(json.dumps(result, indent=2))
            return 0

        endpoint = args.endpoint or os.environ.get("PROSPER_SUBMISSION_ENDPOINT") or infer_endpoint(brief)
        if not endpoint:
            print(json.dumps({
                "ok": False,
                "error": "missing_endpoint",
                "message": "No remote submission endpoint was provided or found in the Agent Brief.",
            }, indent=2))
            return 1

        id_token = args.id_token or os.environ.get("PROSPER_FIREBASE_ID_TOKEN")
        if not id_token:
            print(json.dumps({
                "ok": False,
                "error": "missing_id_token",
                "message": "Remote submission requires a Firebase ID token from a shared-room member.",
            }, indent=2))
            return 1

        try:
            status, payload = submit_bundle(endpoint, id_token, bundle)
        except Exception as exc:
            print(json.dumps({
                "ok": False,
                "error": "submission_unavailable",
                "message": str(exc),
            }, indent=2))
            return 1

        if status >= 400 or payload.get("ok") is False:
            print(json.dumps({
                "ok": False,
                "status": status,
                "endpoint": endpoint,
                "response": payload,
            }, indent=2))
            return 1

        print(json.dumps({
            "ok": True,
            "endpoint": endpoint,
            "status": status,
            "response": payload,
        }, indent=2))
        return 0

    if not args.dry_run and not args.output:
        print(json.dumps(bundle, indent=2))
        return 0

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
