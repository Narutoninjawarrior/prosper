# seed_sample_data.py
# Seeds local SQLite database with example data for testing and validation.

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'stewardship.db'

def seed_data():
    print(f"Seeding sample data into: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        # 1. Clear existing records to ensure deterministic seed
        cursor.execute("DELETE FROM outcomes;")
        cursor.execute("DELETE FROM decision_traces;")
        cursor.execute("DELETE FROM work_cards;")
        cursor.execute("DELETE FROM observations;")
        cursor.execute("DELETE FROM assets;")

        # 2. Insert Asset
        asset_id = "example-cacao-habitat-04"
        cursor.execute("""
            INSERT INTO assets (asset_id, name, type, status, facility_id, created_at)
            VALUES (?, 'Lower Cacao Canopy Zone 4', 'living_habitat', 'active', 'conservatory-south', ?);
        """, (asset_id, datetime.utcnow().isoformat() + 'Z'))

        # 3. Insert Observation (10 minutes ago)
        obs_id = "obs-20260702-001"
        obs_time = (datetime.utcnow() - timedelta(minutes=10)).isoformat() + 'Z'
        cursor.execute("""
            INSERT INTO observations (observation_id, asset_id, steward_id, timestamp, source, metric_name, metric_value, metric_unit)
            VALUES (?, ?, 'steward-continuity-1', ?, 'sensor-stream', 'relative_humidity', 68.0, '%');
        """, (obs_id, asset_id, obs_time))

        # 4. Insert Work Card (Proposal)
        wc_id = "wc-20260702-001"
        cursor.execute("""
            INSERT INTO work_cards (
                work_card_id, asset_id, observation_id, label, description, estimated_labor_hours,
                status, operator_type, qualification, task_class, tools_json, materials_json,
                safety_limits_json, stop_conditions_json, created_at
            )
            VALUES (
                ?, ?, ?, 'Misting Cycle (0.1 hrs)', 'Activate misting loop for 5 minutes', 0.1,
                'REVIEWED', 'human', 'Conservatory Steward', 'maintenance', ?, ?, ?, ?, ?
            );
        """, (
            wc_id,
            asset_id,
            obs_id,
            json.dumps(['humidity probe', 'misting control panel']),
            json.dumps([]),
            json.dumps(['Do not exceed 80% relative humidity']),
            json.dumps([
                {
                    'condition_id': 'abort_humidity_high',
                    'description': 'Relative humidity exceeds 80%',
                    'required_response': 'Stop misting cycle and re-check canopy conditions',
                }
            ]),
            obs_time,
        ))

        # 5. Insert Decision Trace (5 minutes ago)
        decision_id = "dec-20260702-001"
        dec_time = (datetime.utcnow() - timedelta(minutes=5)).isoformat() + 'Z'
        cursor.execute("""
            INSERT INTO decision_traces (decision_id, work_card_id, operator_approved, reasoning, reviewed_by, reviewed_at)
            VALUES (?, ?, 1, 'Misting is required to recover humidity boundary range (70-80%).', 'operator-field-manual', ?);
        """, (decision_id, wc_id, dec_time))

        # 6. Insert Outcome (Just now)
        outcome_id = "out-20260702-001"
        outcome_time = datetime.utcnow().isoformat() + 'Z'
        cursor.execute("""
            INSERT INTO outcomes (outcome_id, work_card_id, observed_at, metric_name, observed_value, metric_unit, calculated_prediction_error, notes)
            VALUES (?, ?, ?, 'relative_humidity', 72.5, '%', 2.5, 'Humidity recovered successfully. Nominal state active.');
        """, (outcome_id, wc_id, outcome_time))

        conn.commit()
        print("Sample data successfully seeded.")

    except Exception as e:
        conn.rollback()
        print(f"Failed to seed sample data: {e}")
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    seed_data()
