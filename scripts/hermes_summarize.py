#!/usr/bin/env python3
"""
hermes_summarize.py — digest the .hermes/receipts.jsonl ledger.

Groups receipts by source and by path. Prints counts and the
most recent claim per group. Use this BEFORE starting any new
probe to avoid duplicating work the prior session already did.

Usage:
    python scripts/hermes_summarize.py
    python scripts/hermes_summarize.py --tail 5        # last 5 receipts
    python scripts/hermes_summarize.py --path sceneManifest
    python scripts/hermes_summarize.py --since 2026-06-30
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

LEDGER = Path(r"D:\Hearth\prosper2\.hermes\receipts.jsonl")


def load() -> list[dict]:
    if not LEDGER.exists():
        return []
    out = []
    for line in LEDGER.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tail", type=int, default=None,
                    help="print only the last N receipts verbatim")
    ap.add_argument("--path", default=None,
                    help="filter to receipts whose path contains this substring")
    ap.add_argument("--since", default=None,
                    help="filter to receipts with ts >= this ISO date")
    args = ap.parse_args()

    rows = load()
    if not rows:
        print(f"ledger empty: {LEDGER}")
        return 0

    if args.since:
        rows = [r for r in rows if r.get("ts", "") >= args.since]
    if args.path:
        rows = [r for r in rows if args.path in (r.get("path") or "")]

    if args.tail is not None:
        for r in rows[-args.tail:]:
            print(f"  {r.get('ts')}  {r.get('claim')}")
            print(f"    path:   {r.get('path')}")
            print(f"    source: {r.get('source')}")
            print(f"    evidence:    {r.get('evidence', '')[:120]}")
            print(f"    conclusion:  {r.get('conclusion', '')[:120]}")
            print()
        return 0

    by_source: dict[str, int] = defaultdict(int)
    by_path: dict[str, int] = defaultdict(int)
    recent_by_path: dict[str, dict] = {}
    for r in rows:
        s = r.get("source", "?")
        p = r.get("path") or "—"
        by_source[s] += 1
        by_path[p] += 1
        ts = r.get("ts", "")
        if p not in recent_by_path or recent_by_path[p].get("ts", "") < ts:
            recent_by_path[p] = r

    print(f"ledger: {LEDGER}")
    print(f"  total receipts: {len(rows)}")
    print(f"  first ts:       {rows[0].get('ts')}")
    print(f"  last ts:        {rows[-1].get('ts')}")
    print()
    print("=== by source ===")
    for s, n in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {n:3d}  {s}")
    print()
    print("=== by path (most recent claim shown) ===")
    for p, n in sorted(by_path.items(), key=lambda x: -x[1]):
        r = recent_by_path[p]
        print(f"  {n:3d}  {p}")
        print(f"        {r.get('ts')}  {r.get('claim')[:90]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
