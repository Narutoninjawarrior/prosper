#!/usr/bin/env python3
"""Backward-compatible entry — delegates to bellows_brain.py."""

from bellows_brain import main_loop, parse_args

if __name__ == "__main__":
    args = parse_args()
    try:
        main_loop(once=args.once, dry_run=args.dry_run)
    except KeyboardInterrupt:
        print("\nBellows quieted — use bellows_brain.py going forward.")
