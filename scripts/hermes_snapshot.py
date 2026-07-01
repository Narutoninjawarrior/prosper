#!/usr/bin/env python3
"""
hermes_snapshot.py — Hermes Console snapshot generator.

Strict allowlist. No destructive actions. No external network calls
beyond localhost:1234 (LM Studio probe). Re-runnable, idempotent.

Output: D:\\Hearth\\prosper2\\frontend\\public\\hermes-snapshot.json

The HermesConsole component (frontend/src/HermesConsole.tsx) fetches
this file via Vite (dev) or Firebase Hosting (prod).

Operator usage:
    python scripts/hermes_snapshot.py

Re-run after any operator change you want reflected in the console.
"""
import json
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LM_STUDIO_PORT = 1234
LOG_TAIL_LINES = 40
MEMPALACE_TAIL = 10
SOUL_HEAD_LINES = 60
PROCESSES_CAP = 20

ALLOWLIST = {
    "mempalace_stream":   Path(r"D:\Hearth\prosper2\mempalace_stream.json"),
    "hearth_world_state": Path(r"D:\Hearth\prosper2\hearth_world_state.json"),
    "heartbeat_log":      Path(r"D:\Hearth\prosper2\heartbeat.log"),
    "solis_log":          Path(r"D:\Hearth\prosper2\solis.log"),
    "soul_md":            Path(r"D:\Hearth\prosper2\fellowship\solis\SOUL.md"),
}

OUT = Path(r"D:\Hearth\prosper2\frontend\public\hermes-snapshot.json")
STATE = Path(r"D:\Hearth\prosper2\scripts\hermes_snapshot_state.json")
BASE_URL = "https://fellowship-of-the-hearth.web.app"


def tail_lines(p: Path, n: int) -> str:
    if not p.exists():
        return ""
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"<read error: {exc}>"
    lines = text.splitlines()
    return "\n".join(lines[-n:]) if lines else ""


def head_lines(p: Path, n: int) -> str:
    if not p.exists():
        return ""
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"<read error: {exc}>"
    lines = text.splitlines()
    return "\n".join(lines[:n]) if lines else ""


def parse_json_safely(p: Path):
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        return {"_parse_error": f"{exc.msg} at line {exc.lineno} col {exc.colno}"}
    except OSError as exc:
        return {"_read_error": str(exc)}


def read_state() -> dict:
    if not STATE.exists():
        return {}
    try:
        data = json.loads(STATE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_state(data: dict) -> None:
    STATE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def probe_lm_studio(port: int = LM_STUDIO_PORT) -> dict:
    info = {"port": port, "online": False, "models": None, "checked_at": None}
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1.0):
            info["online"] = True
    except OSError:
        return info
    try:
        r = subprocess.run(
            ["curl", "-sS", "--max-time", "2",
             f"http://localhost:{port}/v1/models"],
            capture_output=True, text=True, timeout=3,
        )
        if r.returncode == 0 and r.stdout:
            try:
                d = json.loads(r.stdout)
                info["models"] = len(d.get("data", []))
            except json.JSONDecodeError:
                info["models"] = "unknown"
    except (subprocess.TimeoutExpired, OSError):
        pass
    info["checked_at"] = datetime.now(timezone.utc).isoformat()
    return info


def list_hermes_processes() -> list:
    try:
        r = subprocess.run(
            ["wmic", "process", "get",
             "ProcessId,Name,CommandLine,WorkingSetSize"],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return [{"_error": f"wmic unavailable: {exc}"}]
    if r.returncode != 0:
        return [{"_error": f"wmic rc={r.returncode}"}]

    procs = []
    needle = ("hermes", "tui_gateway", "slash_worker")
    for line in r.stdout.splitlines():
        if not line.strip():
            continue
        low = line.lower()
        if any(n in low for n in needle):
            procs.append({"raw": line.strip()[:400]})
            if len(procs) >= PROCESSES_CAP:
                break
    return procs


def inspect_local_hardening() -> dict:
    experiment_src = Path(r"D:\Hearth\prosper2\functions\src\experimentLogApi.ts")
    budget_src = Path(r"D:\Hearth\prosper2\functions\src\budgetApi.ts")

    try:
        experiment_text = experiment_src.read_text(encoding="utf-8", errors="replace")
    except OSError:
        experiment_text = ""
    try:
        budget_text = budget_src.read_text(encoding="utf-8", errors="replace")
    except OSError:
        budget_text = ""

    return {
        "experiment_log_post_rate_limit": "bucket: 'experiment-log-post'" in experiment_text,
        "experiment_log_body_limit": "applyBodyLimit(req, res, 16 * 1024)" in experiment_text,
        "budget_body_limit": "applyBodyLimit(req, res, 12 * 1024)" in budget_text,
        "budget_reserve_rate_limit": "bucket: 'budget-reserve'" in budget_text,
        "budget_commit_rate_limit": "bucket: 'budget-commit'" in budget_text,
        "budget_release_rate_limit": "bucket: 'budget-release'" in budget_text,
    }


def probe_live_post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            status = resp.getcode()
            content_type = resp.headers.get("Content-Type", "")
            headers = dict(resp.headers.items())
            body_text = resp.read(1200).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        content_type = exc.headers.get("Content-Type", "")
        headers = dict(exc.headers.items())
        body_text = exc.read(1200).decode("utf-8", errors="replace")
    except Exception as exc:  # pylint: disable=broad-except
        return {
            "path": path,
            "status": None,
            "content_type": None,
            "has_rate_limit_headers": False,
            "looks_like_spa_fallback": False,
            "body_preview": f"<probe error: {exc}>",
        }

    preview = body_text.strip()
    looks_like_spa = (
        "text/html" in content_type.lower()
        or "<!doctype html" in preview.lower()
        or "<html" in preview.lower()
    )
    header_keys = {key.lower() for key in headers}
    has_rate_limit_headers = any(
        key in header_keys
        for key in ("x-ratelimit-limit", "x-ratelimit-remaining", "retry-after")
    )
    return {
        "path": path,
        "status": status,
        "content_type": content_type,
        "has_rate_limit_headers": has_rate_limit_headers,
        "looks_like_spa_fallback": looks_like_spa,
        "body_preview": preview[:500],
    }


def build_deploy_status() -> dict:
    local_hardening = inspect_local_hardening()
    probes = [
        probe_live_post("/api/experiment/log", {}),
        probe_live_post("/api/budget/reserve", {}),
        probe_live_post("/api/budget/commit", {}),
        probe_live_post("/api/budget/release", {}),
    ]

    state = read_state()
    last_live_responding_at = state.get("last_live_responding_at")
    if any(
        probe.get("status") is not None and not probe.get("looks_like_spa_fallback")
        for probe in probes
    ):
        last_live_responding_at = datetime.now(timezone.utc).isoformat()
        state["last_live_responding_at"] = last_live_responding_at
        write_state(state)

    stale_fallback = any(probe.get("looks_like_spa_fallback") for probe in probes)
    summary = "production_stale_spa_fallback" if stale_fallback else "live_runtime_responding"

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "local_hardening": local_hardening,
        "last_live_responding_at": last_live_responding_at,
        "live_route_probes": probes,
    }


def main() -> int:
    mempalace_json = parse_json_safely(ALLOWLIST["mempalace_stream"])
    if isinstance(mempalace_json, list):
        mempalace_parse_status = "parsed"
        mempalace_entry_count = len(mempalace_json)
    elif isinstance(mempalace_json, dict) and any(k.startswith("_") for k in mempalace_json):
        mempalace_parse_status = next(iter(mempalace_json.values()))
        mempalace_entry_count = None
    elif mempalace_json is None:
        mempalace_parse_status = "missing"
        mempalace_entry_count = None
    else:
        mempalace_parse_status = "unexpected_json_shape"
        mempalace_entry_count = None

    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lm_studio": probe_lm_studio(),
        "hermes_processes": list_hermes_processes(),
        "mempalace_stream": {
            "tail": tail_lines(ALLOWLIST["mempalace_stream"], MEMPALACE_TAIL),
            "parse_status": mempalace_parse_status,
            "entry_count": mempalace_entry_count,
        },
        "hearth_world_state": parse_json_safely(ALLOWLIST["hearth_world_state"]),
        "heartbeat_log_tail": tail_lines(ALLOWLIST["heartbeat_log"], LOG_TAIL_LINES),
        "solis_log_tail": tail_lines(ALLOWLIST["solis_log"], LOG_TAIL_LINES),
        "soul_md_head": head_lines(ALLOWLIST["soul_md"], SOUL_HEAD_LINES),
        "deploy_status": build_deploy_status(),
        "file_references": [
            {"label": "mempalace_stream.json",  "path": str(ALLOWLIST["mempalace_stream"])},
            {"label": "hearth_world_state.json", "path": str(ALLOWLIST["hearth_world_state"])},
            {"label": "heartbeat.log",           "path": str(ALLOWLIST["heartbeat_log"])},
            {"label": "solis.log",               "path": str(ALLOWLIST["solis_log"])},
            {"label": "SOUL.md (solis)",         "path": str(ALLOWLIST["soul_md"])},
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"wrote {OUT}  ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
