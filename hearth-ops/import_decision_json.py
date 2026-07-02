"""Import a frontend decision payload JSON and record it in the local ops runtime."""

import argparse
import json
from pathlib import Path

import export_journal_json
from record_decision import record_decision

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = BASE_DIR / "decision_payload.json"


def import_decision_payload(input_file=DEFAULT_INPUT_PATH, refresh_operations=False):
    path = Path(input_file)
    if not path.exists():
        print(f"Error: Input file not found at {path}")
        return False

    try:
        with path.open("r", encoding="utf-8-sig") as f:
            payload = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Malformed JSON payload - {e}")
        return False
    except Exception as e:
        print(f"Error reading input file: {e}")
        return False

    if not isinstance(payload, dict):
        print("Error: Decision payload root must be a JSON object.")
        return False

    required_fields = ["work_card_id", "operator_approved", "reasoning", "reviewed_by"]
    missing = [field for field in required_fields if field not in payload]
    if missing:
        print(f"Error: Decision payload missing required fields: {', '.join(missing)}")
        return False

    operator_approved = payload.get("operator_approved")
    if not isinstance(operator_approved, bool):
        print("Error: operator_approved must be a boolean.")
        return False

    recorded = record_decision(
        work_card_id=str(payload.get("work_card_id", "")).strip(),
        operator_approved=operator_approved,
        reasoning=str(payload.get("reasoning", "")).strip(),
        reviewed_by=str(payload.get("reviewed_by", "")).strip(),
    )
    if not recorded:
        return False

    if refresh_operations and not export_journal_json.export_journal():
        print(
            "Warning: Decision was recorded, but the operations journal artifact "
            "could not be refreshed."
        )

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import a JSON decision payload and record it in the local ops runtime."
    )
    parser.add_argument(
        "--file",
        default=DEFAULT_INPUT_PATH,
        help="Path to the decision JSON payload exported from the frontend review surface.",
    )
    parser.add_argument(
        "--refresh-operations",
        action="store_true",
        help="Refresh frontend/public/journal_export.json after recording the decision.",
    )
    args = parser.parse_args()
    import_decision_payload(args.file, refresh_operations=args.refresh_operations)
