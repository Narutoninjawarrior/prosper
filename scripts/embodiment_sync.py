#!/usr/bin/env python3
"""
Embodiment Ledger Firebase mirror worker.

Monitors embodiment_bounty.json (append-only, admin/terminal writes only).
When firebase_synced is false and firebase_mirror is not false, writes to
Firestore embodiment_ledger/{chain_hash} and marks local entry synced.

PowerShell:
  $env:GOOGLE_APPLICATION_CREDENTIALS = "D:\\Hearth\\prosper2\\secrets\\firebase-service-account.json"
  $env:FIREBASE_PROJECT_ID = "fellowship-of-the-hearth"
  python scripts\\embodiment_sync.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
LEDGER_PATH = REPO_ROOT / "embodiment_bounty.json"
POLL_SEC = float(os.environ.get("EMBODIMENT_SYNC_POLL_SEC", "15"))


def _init_firestore():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("[!] pip install firebase-admin", file=sys.stderr)
        sys.exit(1)

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    project = os.environ.get("FIREBASE_PROJECT_ID", "fellowship-of-the-hearth")

    if not firebase_admin._apps:
        if creds_path and os.path.isfile(creds_path):
            firebase_admin.initialize_app(credentials.Certificate(creds_path), {"projectId": project})
        else:
            firebase_admin.initialize_app(options={"projectId": project})
    return firestore.client()


def load_ledger() -> dict:
    if not LEDGER_PATH.is_file():
        return {"version": 1, "entries": [], "chain_tip": None}
    return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))


def save_ledger(data: dict) -> None:
    LEDGER_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    public_copy = REPO_ROOT / "frontend" / "public" / "embodiment_bounty.json"
    public_copy.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def sync_once(db) -> int:
    data = load_ledger()
    entries = data.get("entries") or []
    synced = 0

    for entry in entries:
        if entry.get("firebase_synced"):
            continue
        if entry.get("firebase_mirror") is False:
            continue
        chain_hash = entry.get("chain_hash")
        if not chain_hash:
            continue

        try:
            db.collection("embodiment_ledger").document(chain_hash).set(
                {**entry, "firebase_synced": True, "synced_at": time.time()},
                merge=True,
            )
            entry["firebase_synced"] = True
            synced += 1
            print(f"[+] mirrored {chain_hash[:12]}... -> embodiment_ledger")
        except Exception as exc:
            print(f"[!] sync failed {chain_hash[:12]}...: {exc}", file=sys.stderr)

    if entries:
        data["chain_tip"] = entries[-1].get("chain_hash")
    data["entries"] = entries
    if synced:
        save_ledger(data)
    return synced


def main() -> None:
    print(f"--- Embodiment sync worker · {LEDGER_PATH} ---")
    db = _init_firestore()
    while True:
        try:
            n = sync_once(db)
            if n:
                print(f"[*] tick: {n} entr{'y' if n == 1 else 'ies'} mirrored")
        except KeyboardInterrupt:
            print("\n[*] stopped")
            break
        except Exception as exc:
            print(f"[!] loop error: {exc}", file=sys.stderr)
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
