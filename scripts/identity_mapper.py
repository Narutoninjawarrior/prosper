#!/usr/bin/env python3
"""
Hearthlands Identity Mapper — Phase A+B server-side Firestore writes.

Links Privy human IDs and agent profiles to Solana public keys.
Requires firebase-admin and a service account JSON (never commit secrets).

PowerShell:
  $env:GOOGLE_APPLICATION_CREDENTIALS = "D:\\Hearth\\secrets\\service-account.json"
  python scripts\\identity_mapper.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DEFAULT_PRIVY_ID = "j4y6f6aam6mu4tdfhkyabad6"
DEFAULT_HUMAN_PUBKEY = "8Cc3dqWwKSuw6FgaTcrscAjxgb24A4ZDPvqPvXRoGzdk"
DEFAULT_AGENT_ID = "solis"
DEFAULT_AGENT_PUBKEY = "8FvCkHBetZWoMf5yFjyQ3QkwYL7b8LHUWDgS3CuQvM1D"


def _windows_credential_help(creds_path: str | None) -> str:
    return f"""\
[!] Firebase credentials not found or invalid.

Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path, then retry.

PowerShell (current session):
  $env:GOOGLE_APPLICATION_CREDENTIALS = "D:\\Hearth\\secrets\\your-service-account.json"

Or pass --credentials:
  python scripts\\identity_mapper.py --credentials "D:\\Hearth\\secrets\\your-service-account.json"

Expected file: {creds_path or '(not set)'}
Keep service account JSON under secrets/ — it is gitignored. Never commit it.
"""


def _discover_service_account() -> str | None:
    """Scan D:\\Hearth\\secrets for a Firebase service account JSON."""
    secrets_dir = Path(r"D:\Hearth\secrets")
    if not secrets_dir.is_dir():
        return None
    for path in sorted(secrets_dir.glob("*.json")):
        if path.name == "agent_solis_wallet.json":
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("type") == "service_account" and data.get("private_key"):
                return str(path.resolve())
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            continue
    return None


def _resolve_credentials_path(explicit: str | None) -> str | None:
    if explicit:
        return os.path.abspath(explicit)
    env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env:
        return os.path.abspath(env)
    return _discover_service_account()


def _init_firestore(credentials_path: str | None):
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print(
            "[!] firebase-admin not installed.\n"
            "    pip install -r scripts\\requirements-identity.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    creds_path = _resolve_credentials_path(credentials_path)

    try:
        if not firebase_admin._apps:
            if creds_path and os.path.isfile(creds_path):
                print(f"[*] Using service account: {creds_path}")
                cred = credentials.Certificate(creds_path)
                firebase_admin.initialize_app(cred)
            else:
                print("[*] No service account file — trying Application Default Credentials (gcloud login)")
                firebase_admin.initialize_app()
        return firestore.client()
    except Exception as exc:
        print(_windows_credential_help(creds_path), file=sys.stderr)
        print(f"[!] Firebase init failed: {exc}", file=sys.stderr)
        sys.exit(1)


def register_human_identity(db, privy_user_id: str, solana_pubkey: str) -> None:
    from firebase_admin import firestore as fs

    doc_ref = db.collection("wallet_identities").document(privy_user_id)
    doc_ref.set(
        {
            "human_pubkey": solana_pubkey,
            "privy_user_id": privy_user_id,
            "created_at": fs.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    print(f"[+] Human Identity Registered: {solana_pubkey} linked to {privy_user_id}")


def register_agent_identity(db, agent_id: str, solana_pubkey: str) -> None:
    from firebase_admin import firestore as fs

    doc_ref = db.collection("agent_profiles").document(solana_pubkey)
    doc_ref.set(
        {
            "agent_id": agent_id,
            "solana_pubkey": solana_pubkey,
            "created_at": fs.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    print(f"[+] Agent Identity Registered: {agent_id} bound to {solana_pubkey}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Register human (Privy) and agent Solana identities in Firestore.",
    )
    parser.add_argument(
        "--credentials",
        "-c",
        help="Path to Firebase service account JSON (overrides GOOGLE_APPLICATION_CREDENTIALS)",
    )
    parser.add_argument("--privy-id", default=DEFAULT_PRIVY_ID, help="Privy user ID for human wallet")
    parser.add_argument("--human-pubkey", default=DEFAULT_HUMAN_PUBKEY, help="Human Solana public key")
    parser.add_argument("--agent-id", default=DEFAULT_AGENT_ID, help="Agent identifier (e.g. solis)")
    parser.add_argument("--agent-pubkey", default=DEFAULT_AGENT_PUBKEY, help="Agent Solana public key")
    parser.add_argument("--human-only", action="store_true", help="Register human identity only")
    parser.add_argument("--agent-only", action="store_true", help="Register agent identity only")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print("--- Hearthlands Identity Mapper ---")

    db = _init_firestore(args.credentials)

    if not args.agent_only:
        register_human_identity(db, args.privy_id, args.human_pubkey)
    if not args.human_only:
        register_agent_identity(db, args.agent_id, args.agent_pubkey)

    print("--- Phase A+B Mapping Complete ---")


if __name__ == "__main__":
    main()
