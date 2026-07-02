# record_outcome.py
# Operator utility to record a real-world outcome against a work card.

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
import argparse

DB_PATH = Path(__file__).resolve().parent / 'stewardship.db'

def record_outcome(work_card_id, metric_name, metric_unit, observed_value, calculated_prediction_error=None, notes=None):
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return False

    if not work_card_id or not metric_name or not metric_unit or observed_value is None:
        print("Error: work_card_id, metric_name, metric_unit, and observed_value are required.")
        return False

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        # 1. Validate work card exists
        cursor.execute("SELECT status FROM work_cards WHERE work_card_id = ?", (work_card_id,))
        row = cursor.fetchone()
        if not row:
            print(f"Error: Work card '{work_card_id}' does not exist.")
            return False

        # 2. Prevent duplicate outcome for the same work card (since relation is One-to-One per our schema)
        cursor.execute("SELECT outcome_id FROM outcomes WHERE work_card_id = ?", (work_card_id,))
        if cursor.fetchone():
            print(f"Error: Outcome already recorded for work card '{work_card_id}'.")
            return False

        # 3. Generate new outcome record
        outcome_id = f"out-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
        observed_at = datetime.utcnow().isoformat() + 'Z'

        cursor.execute("""
            INSERT INTO outcomes (outcome_id, work_card_id, observed_at, metric_name, observed_value, metric_unit, calculated_prediction_error, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (outcome_id, work_card_id, observed_at, metric_name, observed_value, metric_unit, calculated_prediction_error, notes))

        conn.commit()
        print(f"Success: Outcome '{outcome_id}' recorded for work card '{work_card_id}'.")
        return True

    except sqlite3.IntegrityError as e:
        conn.rollback()
        print(f"Integrity Error: {e}")
        return False
    except Exception as e:
        conn.rollback()
        print(f"Failed to record outcome: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Record an outcome for a work card.")
    parser.add_argument("work_card_id", help="The ID of the work card this outcome belongs to.")
    parser.add_argument("metric_name", help="The name of the metric observed (e.g., relative_humidity).")
    parser.add_argument("metric_unit", help="The unit of the metric observed (e.g., %% or C).")
    parser.add_argument("observed_value", type=float, help="The numeric value observed.")
    parser.add_argument("--error", type=float, default=None, help="The calculated prediction error percentage, if applicable.")
    parser.add_argument("--notes", type=str, default=None, help="Operator notes regarding the outcome.")
    
    args = parser.parse_args()
    record_outcome(args.work_card_id, args.metric_name, args.metric_unit, args.observed_value, args.error, args.notes)
