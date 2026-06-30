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


def tail_lines(p: Path, n: int) -> str:
    if not p.exists():
        return ""
    try:
        text = p.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"<read error: {exc}>"
    lines = text.splitlines()
    return "\n".join(lines[-n:]) if lines else ""


def parse_json_safely(p: Path):
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        return {"_parse_error": f"{exc.msg} at line {exc.lineno} col {exc.colno}"}
    except OSError as exc:
        return {"_read_error": str(exc)}


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


def main() -> int:
    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lm_studio": probe_lm_studio(),
        "hermes_processes": list_hermes_processes(),
        "mempalace_stream": {
            "tail": tail_lines(ALLOWLIST["mempalace_stream"], MEMPALACE_TAIL),
            "parse_status": "see heartbeat.log for current parser state",
        },
        "hearth_world_state": parse_json_safely(ALLOWLIST["hearth_world_state"]),
        "heartbeat_log_tail": tail_lines(ALLOWLIST["heartbeat_log"], LOG_TAIL_LINES),
        "solis_log_tail": tail_lines(ALLOWLIST["solis_log"], LOG_TAIL_LINES),
        "soul_md_head": tail_lines(ALLOWLIST["soul_md"], SOUL_HEAD_LINES),
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
