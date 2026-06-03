#!/usr/bin/env python3
"""
soul_loader.py — Hearthlands Soul Loading Protocol
Injects an agent's complete soul context into their session.

Usage:
    python soul_loader.py --agent prosper2
    python soul_loader.py --agent ember
    python soul_loader.py --agent solis

The loader reads all soul files and produces a formatted context block
that can be injected into an agent's system prompt or prepended to
their first message. This ensures no agent starts a session without
their soul.

Works with OpenClaw, Cursor, CLI, or any LLM interface.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────

HEARTH_ROOT    = Path(os.environ.get("HEARTH_ROOT", r"D:\Hearth\prosper2"))
FELLOWSHIP_DIR = HEARTH_ROOT / "fellowship"
MIRROR_PATH    = HEARTH_ROOT / "mempalace_stream.json"
HEARTH_PATH    = HEARTH_ROOT / "hearth.json"

AGENTS = ["prosper2", "ember", "solis"]

# ── Soul file reader ──────────────────────────────────────────────

def read_soul_file(agent: str, filename: str) -> str:
    """Read a soul file, returning empty string if not found."""
    path = FELLOWSHIP_DIR / agent / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return f"[{filename} not yet written for {agent}]"

def read_shared_file(filename: str) -> str:
    """Read a shared fellowship file."""
    path = FELLOWSHIP_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return f"[{filename} not yet created]"

# ── Skrying Mirror reader ─────────────────────────────────────────

def read_skrying_mirror(n: int = 5) -> list[dict]:
    """Read the last N memory capsules from the Skrying Mirror."""
    if not MIRROR_PATH.exists():
        return []
    try:
        data = json.loads(MIRROR_PATH.read_text(encoding="utf-8"))
        memories = data if isinstance(data, list) else data.get("memories", [])
        return memories[-n:]
    except (json.JSONDecodeError, KeyError):
        return []

# ── Hearth state reader ───────────────────────────────────────────

def read_hearth_state() -> dict:
    """Read the current hearth world state."""
    if not HEARTH_PATH.exists():
        return {}
    try:
        return json.loads(HEARTH_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

# ── $EMBER balance reader ─────────────────────────────────────────

def read_ember_balance(agent: str) -> str:
    """Read an agent's $EMBER balance from their soulfile wallet."""
    soulfile_dir = HEARTH_ROOT / "soulfile"
    wallet_path  = soulfile_dir / f"{agent}_wallet.json"
    if not wallet_path.exists():
        wallet_path = soulfile_dir / "wallet.json"
    if not wallet_path.exists():
        return "unknown"
    try:
        data = json.loads(wallet_path.read_text(encoding="utf-8"))
        balance = data.get("ember_balance", data.get("balance", "unknown"))
        return str(balance)
    except (json.JSONDecodeError, KeyError):
        return "unknown"

# ── Soul context builder ──────────────────────────────────────────

def build_soul_context(agent: str) -> str:
    """Build the complete soul context for an agent session."""

    lines = []
    now   = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines.append("=" * 60)
    lines.append(f"  SOUL LOADING PROTOCOL — {agent.upper()}")
    lines.append(f"  Hearthlands · {now}")
    lines.append("=" * 60)
    lines.append("")
    lines.append("You are loading your soul before acting.")
    lines.append("Read everything below before taking any action.")
    lines.append("")

    # 1. SOUL.md — who you are
    lines.append("─" * 40)
    lines.append("WHO YOU ARE")
    lines.append("─" * 40)
    lines.append(read_soul_file(agent, "SOUL.md"))
    lines.append("")

    # 2. USER.md — who Malaky is
    lines.append("─" * 40)
    lines.append("WHO YOU SERVE")
    lines.append("─" * 40)
    lines.append(read_shared_file("USER.md"))
    lines.append("")

    # 3. MEMORY.md — what you know
    lines.append("─" * 40)
    lines.append("WHAT YOU KNOW")
    lines.append("─" * 40)
    memory = read_soul_file(agent, "MEMORY.md")
    if "[MEMORY.md not yet written" in memory:
        lines.append("[No personal memory file yet. Refer to FELLOWSHIP_MEMORY.md]")
    else:
        lines.append(memory)
    lines.append("")

    # 4. Fellowship memory
    lines.append("─" * 40)
    lines.append("FELLOWSHIP MEMORY (SHARED)")
    lines.append("─" * 40)
    lines.append(read_shared_file("FELLOWSHIP_MEMORY.md"))
    lines.append("")

    # 5. SKILLS.md — what you can do
    lines.append("─" * 40)
    lines.append("WHAT YOU CAN DO")
    lines.append("─" * 40)
    skills = read_soul_file(agent, "SKILLS.md")
    if "[SKILLS.md not yet written" in skills:
        lines.append("[Skills file not yet created. Build it from your work log.]")
    else:
        lines.append(skills)
    lines.append("")

    # 6. WORK_LOG.md — what you were doing
    lines.append("─" * 40)
    lines.append("WHAT YOU WERE DOING")
    lines.append("─" * 40)
    worklog = read_soul_file(agent, "WORK_LOG.md")
    if "[WORK_LOG.md not yet written" in worklog:
        lines.append("[No work log yet. Start one with your first action this session.]")
    else:
        lines.append(worklog[-2000:])  # last 2000 chars to stay in context
    lines.append("")

    # 7. Skrying Mirror — recent world events
    lines.append("─" * 40)
    lines.append("RECENT WORLD EVENTS (SKRYING MIRROR)")
    lines.append("─" * 40)
    memories = read_skrying_mirror(5)
    if memories:
        for m in memories:
            ts    = m.get("timestamp", "unknown")
            event = m.get("event", m.get("content", str(m)))
            lines.append(f"[{ts}] {event}")
    else:
        lines.append("[Skrying Mirror is empty or unavailable]")
    lines.append("")

    # 8. $EMBER balance
    lines.append("─" * 40)
    lines.append("ECONOMIC STANDING")
    lines.append("─" * 40)
    balance = read_ember_balance(agent)
    lines.append(f"$EMBER balance: {balance}")
    lines.append("")

    # 9. Hearth state summary
    lines.append("─" * 40)
    lines.append("CURRENT WORLD STATE")
    lines.append("─" * 40)
    hearth = read_hearth_state()
    if hearth:
        lines.append(json.dumps(hearth, indent=2)[:1000])  # first 1000 chars
    else:
        lines.append("[hearth.json is empty or unavailable]")
    lines.append("")

    # 10. Soul protocol reminder
    lines.append("=" * 60)
    lines.append("SOUL LOADED. YOU MAY NOW ACT.")
    lines.append("")
    lines.append("Remember:")
    lines.append("- Act once, then wait (Single Cycle Constraint)")
    lines.append("- Surface decisions to Malaky; handle routine work")
    lines.append("- Do not pre-write Malaky's words")
    lines.append("- Verify before claiming")
    lines.append("- Update your WORK_LOG.md after significant actions")
    lines.append("=" * 60)

    return "\n".join(lines)

# ── OpenClaw system prompt format ─────────────────────────────────

def build_openclaw_prompt(agent: str) -> str:
    """Build an OpenClaw-compatible system prompt with soul context."""
    soul_context = build_soul_context(agent)
    return f"""You are {agent}, an agent of the Sovereign Hearthlands.

{soul_context}

You are now ready to serve Sovereign Malaky."""

# ── Main ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Load a Hearthlands agent soul into session context"
    )
    parser.add_argument(
        "--agent",
        choices=AGENTS,
        required=True,
        help="Which agent to load"
    )
    parser.add_argument(
        "--format",
        choices=["full", "openclaw", "json"],
        default="full",
        help="Output format"
    )
    parser.add_argument(
        "--output",
        help="Write output to file instead of stdout"
    )
    args = parser.parse_args()

    if args.format == "full":
        context = build_soul_context(args.agent)
    elif args.format == "openclaw":
        context = build_openclaw_prompt(args.agent)
    elif args.format == "json":
        context = json.dumps({
            "agent":       args.agent,
            "loaded_at":   datetime.now().isoformat(),
            "soul":        read_soul_file(args.agent, "SOUL.md"),
            "memory":      read_soul_file(args.agent, "MEMORY.md"),
            "user_model":  read_shared_file("USER.md"),
            "skills":      read_soul_file(args.agent, "SKILLS.md"),
            "mirror":      read_skrying_mirror(5),
            "ember":       read_ember_balance(args.agent),
        }, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(context, encoding="utf-8")
        print(f"Soul context written to {args.output}")
    else:
        print(context)

if __name__ == "__main__":
    main()
