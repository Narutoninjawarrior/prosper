#!/usr/bin/env python3
"""
hermes_receipt.py — append a single receipt to .hermes/receipts.jsonl.

Usage:
    python scripts/hermes_receipt.py --claim "..." --source file --path "..." --evidence "..." --conclusion "..."

The receipt ledger is the source of truth for "where did this claim
come from." Future Solis/Hermes sessions start by reading recent
receipts instead of re-probing the repo.

Schema (JSONL, one object per line):
    ts          ISO 8601 UTC
    claim       short sentence
    source      file | url | wmic | process | socket | system
    path        absolute path or URL
    line_range  optional, "N-M" or null
    evidence    short extract or observation
    conclusion  the assertion that follows from this evidence
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

LEDGER = Path(r"D:\Hearth\prosper2\.hermes\receipts.jsonl")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--claim", required=True)
    ap.add_argument("--source", required=True,
                    choices=["file", "url", "wmic", "process",
                             "socket", "system", "command"])
    ap.add_argument("--path", required=True)
    ap.add_argument("--line-range", default=None)
    ap.add_argument("--evidence", required=True)
    ap.add_argument("--conclusion", required=True)
    args = ap.parse_args()

    entry = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "claim": args.claim,
        "source": args.source,
        "path": args.path,
        "line_range": args.line_range,
        "evidence": args.evidence,
        "conclusion": args.conclusion,
    }
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"appended receipt ts={entry['ts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
