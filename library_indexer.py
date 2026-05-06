from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable


ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "library_schema.json"
BUILD_DIR = ROOT / "build"
INDEX_PATH = BUILD_DIR / "library_index.json"
MANIFEST_PATH = ROOT / "PUSH_MANIFEST.md"


def _host_log(message: str) -> None:
    fn = globals().get("lodge_log")
    if callable(fn):
        try:
            fn(message.encode("utf-8"), len(message.encode("utf-8")))
            return
        except TypeError:
            pass
        try:
            fn(message, len(message))
            return
        except TypeError:
            pass
    print(message)


def _host_request_ember(amount: float, reason: str) -> None:
    fn = globals().get("lodge_request_ember")
    if callable(fn):
        payload = reason.encode("utf-8")
        try:
            fn(float(amount), payload, len(payload))
            return
        except TypeError:
            pass
        try:
            fn(float(amount), reason, len(reason))
            return
        except TypeError:
            pass


def _host_scry_state() -> str:
    fn = globals().get("lodge_scry_state")
    if not callable(fn):
        return ""
    try:
        result = fn()
    except TypeError:
        return ""
    if isinstance(result, bytes):
        return result.decode("utf-8", errors="replace")
    if isinstance(result, str):
        return result
    return ""


def _load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _stable_weight(pillar_name: str, title: str, body: str, priority: int) -> float:
    digest = hashlib.sha256(
        f"{pillar_name}\n{title}\n{body}\n{priority}".encode("utf-8")
    ).hexdigest()
    bucket = int(digest[:8], 16) % 1000
    return round(priority * 10.0 + bucket / 1000.0, 3)


def _extract_title(path: Path, text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip()
    return path.stem.replace("_", " ").strip().title()


def _file_summary(path: Path, pillar_name: str, priority: int) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    title = _extract_title(path, text)
    rel_path = path.relative_to(ROOT).as_posix()
    weight = _stable_weight(pillar_name, title, text, priority)
    return {
        "path": rel_path,
        "title": title,
        "pillar": pillar_name,
        "chivalry_weight": weight,
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "line_count": text.count("\n") + (0 if text.endswith("\n") or not text else 1),
        "byte_count": len(text.encode("utf-8")),
    }


def _iter_text_files(directory: Path) -> Iterable[Path]:
    if not directory.exists():
        return []
    files = [
        path
        for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in {".md", ".txt"}
    ]
    return sorted(files, key=lambda p: p.relative_to(ROOT).as_posix().lower())


def _build_index(schema: dict[str, Any]) -> dict[str, Any]:
    pillars = schema.get("pillars", {})
    scry_state = _host_scry_state()
    index: dict[str, Any] = {
        "schema_version": schema.get("schema_version"),
        "project": schema.get("project"),
        "generated_by": "library_indexer",
        "source_schema_sha256": hashlib.sha256(
            json.dumps(schema, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
        "repository_tree": scry_state,
        "pillars": [],
        "summary": {
            "total_files": 0,
            "total_bytes": 0,
            "total_lines": 0,
            "total_weight": 0.0,
        },
    }

    for pillar_name in sorted(pillars.keys(), key=lambda s: pillars[s]["priority"]):
        pillar = pillars[pillar_name]
        directory = ROOT / pillar["directory"]
        _host_log(f"Indexing Pillar: {pillar_name}...")
        files = []
        for path in _iter_text_files(directory):
            summary = _file_summary(path, pillar_name, pillar["priority"])
            files.append(summary)
            index["summary"]["total_files"] += 1
            index["summary"]["total_bytes"] += summary["byte_count"]
            index["summary"]["total_lines"] += summary["line_count"]
            index["summary"]["total_weight"] += summary["chivalry_weight"]

        index["pillars"].append(
            {
                "name": pillar_name,
                "priority": pillar["priority"],
                "directory": pillar["directory"],
                "description": pillar.get("description", ""),
                "tags": pillar.get("tags", []),
                "files": files,
            }
        )

    index["summary"]["total_weight"] = round(index["summary"]["total_weight"], 3)
    index["summary"]["pillar_count"] = len(index["pillars"])
    return index


def _write_manifest(index: dict[str, Any]) -> None:
    lines = [
        "# PUSH_MANIFEST",
        "",
        "Step 145 Seal of Completion",
        "",
        f"- Schema: `{SCHEMA_PATH.name}`",
        f"- Output: `{INDEX_PATH.as_posix()}`",
        f"- Pillars indexed: {index['summary']['pillar_count']}",
        f"- Files indexed: {index['summary']['total_files']}",
        f"- Total bytes: {index['summary']['total_bytes']}",
        f"- Total lines: {index['summary']['total_lines']}",
        f"- Total chivalry weight: {index['summary']['total_weight']}",
        "",
        "## Indexed Pillars",
    ]
    for pillar in index["pillars"]:
        lines.append(
            f"- {pillar['name']} -> {pillar['directory']} ({len(pillar['files'])} files)"
        )
    lines.extend(
        [
            "",
            "## Determinism",
            "- No clocks used.",
            "- No random seeds used.",
            "- File order is stable and path-sorted.",
            "- Weights are derived only from schema and file content.",
            "",
            "## Verification",
            "- Double-run hash should match for `build/library_index.json`.",
        ]
    )
    MANIFEST_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_index() -> dict[str, Any]:
    schema = _load_schema()
    index = _build_index(schema)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps(index, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    _write_manifest(index)
    _host_request_ember(
        float(schema.get("economic_directive", {}).get("task_reward_ember", 15.0)),
        "Successful Indexing of the Three Pillars",
    )
    _host_log("Library index written to build/library_index.json")
    return index


if __name__ == "__main__":
    run_index()
