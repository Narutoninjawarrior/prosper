# import_journal_json.py
# Ingests journal_export.json back into SQLite, handling duplicates safely.

import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / 'stewardship.db'
INPUT_PATH = Path(__file__).resolve().parent / 'journal_export.json'

def import_journal(input_file=INPUT_PATH):
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return False

    if not Path(input_file).exists():
        print(f"Error: Input file not found at {input_file}")
        return False

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Malformed JSON payload - {e}")
        return False
    except Exception as e:
        print(f"Error reading input file: {e}")
        return False

    if "assets" not in data or not isinstance(data["assets"], list):
        print("Error: Malformed payload. Expected 'assets' list in root.")
        return False

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        stats = {'assets': 0, 'observations': 0, 'work_cards': 0, 'decision_traces': 0, 'outcomes': 0}

        for asset_block in data["assets"]:
            # Import Asset
            if "asset" in asset_block:
                a = asset_block["asset"]
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO assets (asset_id, name, type, status, facility_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (a.get('asset_id'), a.get('name'), a.get('type'), a.get('status'), a.get('facility_id'), a.get('created_at')))
                    if cursor.rowcount > 0: stats['assets'] += 1
                except sqlite3.IntegrityError as e:
                    print(f"Skipping malformed asset {a.get('asset_id')}: {e}")

            # Import Observations
            for obs in asset_block.get("observations", []):
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO observations (observation_id, asset_id, steward_id, timestamp, source, metric_name, metric_value, metric_unit)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (obs.get('observation_id'), obs.get('asset_id'), obs.get('steward_id'), obs.get('timestamp'), obs.get('source'), obs.get('metric_name'), obs.get('metric_value'), obs.get('metric_unit')))
                    if cursor.rowcount > 0: stats['observations'] += 1
                except sqlite3.IntegrityError as e:
                    print(f"Skipping malformed observation {obs.get('observation_id')}: {e}")

            # Import Work Cards, Decisions, Outcomes
            for wc in asset_block.get("work_cards", []):
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO work_cards (work_card_id, asset_id, observation_id, label, description, estimated_labor_hours, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (wc.get('work_card_id'), wc.get('asset_id'), wc.get('observation_id'), wc.get('label'), wc.get('description'), wc.get('estimated_labor_hours'), wc.get('status'), wc.get('created_at')))
                    if cursor.rowcount > 0: stats['work_cards'] += 1
                except sqlite3.IntegrityError as e:
                    print(f"Skipping malformed work_card {wc.get('work_card_id')}: {e}")
                    continue # Skip dependent records if work card fails

                for dt in wc.get("decision_traces", []):
                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO decision_traces (decision_id, work_card_id, operator_approved, reasoning, reviewed_by, reviewed_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (dt.get('decision_id'), dt.get('work_card_id'), dt.get('operator_approved'), dt.get('reasoning'), dt.get('reviewed_by'), dt.get('reviewed_at')))
                        if cursor.rowcount > 0: stats['decision_traces'] += 1
                    except sqlite3.IntegrityError as e:
                        pass

                for out in wc.get("outcomes", []):
                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO outcomes (outcome_id, work_card_id, observed_at, metric_name, observed_value, calculated_prediction_error, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (out.get('outcome_id'), out.get('work_card_id'), out.get('observed_at'), out.get('metric_name'), out.get('observed_value'), out.get('calculated_prediction_error'), out.get('notes')))
                        if cursor.rowcount > 0: stats['outcomes'] += 1
                    except sqlite3.IntegrityError as e:
                        pass

        conn.commit()
        print(f"Import complete. New rows inserted: {stats}")
        return True

    except Exception as e:
        conn.rollback()
        print(f"Import failed: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Import a JSON journal into the DB.")
    parser.add_argument("--file", default=INPUT_PATH, help="Path to the JSON journal file to import.")
    args = parser.parse_args()
    import_journal(args.file)
