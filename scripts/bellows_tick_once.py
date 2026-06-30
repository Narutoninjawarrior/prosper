#!/usr/bin/env python3
"""Run a single Bellows pulse (no LM Studio loop). Useful for steward smoke tests."""

import argparse
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)

from biosphere_bellows import apply_bellows_tick
from hearth_firestore import read_world_state, push_world_state


def main():
    parser = argparse.ArgumentParser(description="Single Bellows tick → world_state")
    parser.add_argument("--intent", default="plant", help="plant | harvest | wait")
    parser.add_argument("--dry-run", action="store_true", help="Print payload only, do not write")
    args = parser.parse_args()

    world = read_world_state()
    tick = int(world.get("tick", 0)) + 1
    world = apply_bellows_tick(
        world,
        intent=args.intent,
        tick=tick,
        ember_balance=world.get("ember_balance"),
    )

    if args.dry_run:
        print(json.dumps(world, indent=2))
        return

    push_world_state(world)
    s2 = world.get("sim2real") or {}
    print(
        f"OK tick={tick} intent={args.intent} heat={world['heat']} "
        f"ember={world['ember_balance']} "
        f"weather={s2.get('temperature')}°C rain={s2.get('is_raining')} "
        f"wind={s2.get('wind_direction_deg')}°"
    )


if __name__ == "__main__":
    main()
