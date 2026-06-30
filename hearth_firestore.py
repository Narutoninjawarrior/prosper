"""
hearth_firestore.py
Bellows → Firestore bridge for three_forge/world_state.

Requires: pip install google-cloud-firestore
Env: GOOGLE_APPLICATION_CREDENTIALS, optional FIREBASE_PROJECT_ID
Fallback: hearth_world_state.json at repo root (same schema as docs/world-state-schema.md)
"""

from __future__ import annotations

from decimal import Decimal
import json
import os
from datetime import datetime, timezone
from typing import Any

from biosphere_bellows import default_world_state

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_MIRROR = os.path.join(WORKSPACE_DIR, "hearth_world_state.json")
WORLD_STATE_COLLECTION = "three_forge"
WORLD_STATE_DOC = "world_state"


def _project_id() -> str | None:
    return os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get("GCLOUD_PROJECT")


def firestore_enabled() -> bool:
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return False
    try:
        import google.cloud.firestore  # noqa: F401
        return True
    except ImportError:
        return False


def _get_client():
    from google.cloud import firestore

    project = _project_id()
    if project:
        return firestore.Client(project=project)
    return firestore.Client()


def read_world_state() -> dict[str, Any]:
    """Load world_state from Firestore or local mirror."""
    if firestore_enabled():
        try:
            client = _get_client()
            snap = client.collection(WORLD_STATE_COLLECTION).document(WORLD_STATE_DOC).get()
            if snap.exists:
                data = snap.to_dict() or {}
                return _merge_with_defaults(data)
        except Exception as exc:
            print(f"[hearth_firestore] Firestore read failed: {exc} — using local mirror")
    return _read_local_mirror()


def _convert_decimals(val: Any) -> Any:
    if isinstance(val, dict):
        return {k: _convert_decimals(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_convert_decimals(v) for v in val]
    elif isinstance(val, Decimal):
        f_val = float(val)
        if f_val.is_integer():
            return int(f_val)
        return f_val
    return val


def push_world_state(world: dict[str, Any]) -> dict[str, Any]:
    """
    Persist world_state. Always writes local mirror; writes Firestore when creds exist.
    Returns the payload written.
    """
    payload = _merge_with_defaults(world)
    payload = _convert_decimals(payload)
    payload["last_updated"] = datetime.now(timezone.utc).isoformat()
    _write_local_mirror(payload)

    if firestore_enabled():
        try:
            client = _get_client()
            ref = client.collection(WORLD_STATE_COLLECTION).document(WORLD_STATE_DOC)
            # merge=True preserves existing forge `nodes` if caller omitted them
            ref.set(payload, merge=True)
            print(
                f"[hearth_firestore] world_state tick={payload.get('tick')} "
                f"heat={payload.get('heat')} ember={payload.get('ember_balance')}"
            )
        except Exception as exc:
            print(f"[hearth_firestore] Firestore write failed: {exc} — local mirror only")
    else:
        print("[hearth_firestore] No GOOGLE_APPLICATION_CREDENTIALS — local mirror only")

    return payload


def _merge_with_defaults(data: dict[str, Any]) -> dict[str, Any]:
    base = default_world_state()
    out = {**base, **{k: v for k, v in data.items() if v is not None}}
    from biosphere_bellows import normalize_biosphere_nodes

    out["biosphere_nodes"] = normalize_biosphere_nodes(data.get("biosphere_nodes"))
    if not isinstance(out.get("nodes"), list):
        out["nodes"] = data.get("nodes") if isinstance(data.get("nodes"), list) else []
    return out


def _read_local_mirror() -> dict[str, Any]:
    if not os.path.exists(LOCAL_MIRROR):
        return default_world_state()
    try:
        with open(LOCAL_MIRROR, "r", encoding="utf-8") as f:
            return _merge_with_defaults(json.load(f))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[hearth_firestore] Local mirror corrupt: {exc}")
        return default_world_state()


def _write_local_mirror(payload: dict[str, Any]) -> None:
    with open(LOCAL_MIRROR, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
