"""Import a frontend outcome payload JSON and record it in the local ops runtime."""

import argparse
import json
import math
from pathlib import Path

import export_journal_json
from record_outcome import record_outcome

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_PATH = BASE_DIR / "outcome_payload.json"

def import_outcome_payload(input_file=DEFAULT_INPUT_PATH, refresh_operations=False):
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
        print("Error: Outcome payload root must be a JSON object.")
        return False

    required_fields = ["work_card_id", "metric_name", "metric_unit", "observed_value"]
    missing = [field for field in required_fields if field not in payload]
    if missing:
        print(f"Error: Outcome payload missing required fields: {', '.join(missing)}")
        return False

    observed_value = payload.get("observed_value")
    if not isinstance(observed_value, (int, float)) or not math.isfinite(observed_value):
        print("Error: observed_value must be a finite number.")
        return False
        
    calc_err = payload.get("calculated_prediction_error")
    if calc_err is not None:
        if not isinstance(calc_err, (int, float)) or not math.isfinite(calc_err):
            print("Error: calculated_prediction_error must be a finite number or null.")
            return False

    notes = payload.get("notes")
    if notes is not None and not isinstance(notes, str):
        print("Error: notes must be a string or null.")
        return False

    recorded = record_outcome(
        work_card_id=str(payload.get("work_card_id", "")).strip(),
        metric_name=str(payload.get("metric_name", "")).strip(),
        metric_unit=str(payload.get("metric_unit", "")).strip(),
        observed_value=float(observed_value),
        calculated_prediction_error=float(calc_err) if calc_err is not None else None,
        notes=notes.strip() if notes else None,
    )
    if not recorded:
        return False

    if refresh_operations and not export_journal_json.export_journal():
        print(
            "Warning: Outcome was recorded, but the operations journal artifact "
            "could not be refreshed."
        )

    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Import a JSON outcome payload and record it in the local ops runtime."
    )
    parser.add_argument(
        "--file",
        default=DEFAULT_INPUT_PATH,
        help="Path to the outcome JSON payload exported from the frontend review surface.",
    )
    parser.add_argument(
        "--refresh-operations",
        action="store_true",
        help="Refresh frontend/public/journal_export.json after recording the outcome.",
    )
    args = parser.parse_args()
    import_outcome_payload(args.file, refresh_operations=args.refresh_operations)
