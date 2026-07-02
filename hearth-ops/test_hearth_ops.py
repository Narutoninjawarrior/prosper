# test_hearth_ops.py
# A plain Python test script to verify hearth-ops fundamentals.

import os
import sqlite3
import json
import unittest
from pathlib import Path
import time

def safe_unlink(path):
    if not path.exists():
        return
    for _ in range(10):
        try:
            path.unlink()
            return
        except PermissionError:
            time.sleep(0.1)
    path.unlink()
# Important: ensure we operate on a test database to avoid clobbering the main one during tests
import init_db
import seed_sample_data
import export_journal_json
import import_journal_json
import import_decision_json
import record_decision
import record_outcome

TEST_DB_PATH = Path(__file__).resolve().parent / 'stewardship_test.db'
TEST_JSON_PATH = Path(__file__).resolve().parent / 'test_journal_export.json'

class TestHearthOps(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Override paths in imported modules for testing
        init_db.DB_PATH = TEST_DB_PATH
        seed_sample_data.DB_PATH = TEST_DB_PATH
        export_journal_json.DB_PATH = TEST_DB_PATH
        export_journal_json.OUTPUT_PATH = TEST_JSON_PATH
        import_journal_json.DB_PATH = TEST_DB_PATH
        import_journal_json.INPUT_PATH = TEST_JSON_PATH
        import_decision_json.DEFAULT_INPUT_PATH = TEST_JSON_PATH
        import_decision_json.export_journal_json.DB_PATH = TEST_DB_PATH
        import_decision_json.export_journal_json.OUTPUT_PATH = TEST_JSON_PATH
        record_decision.DB_PATH = TEST_DB_PATH
        record_outcome.DB_PATH = TEST_DB_PATH

    def setUp(self):
        # Clean up before each test
        safe_unlink(TEST_DB_PATH)
        safe_unlink(TEST_JSON_PATH)

    def tearDown(self):
        # Clean up after each test
        safe_unlink(TEST_DB_PATH)
        safe_unlink(TEST_JSON_PATH)

    def test_db_initializes_cleanly(self):
        init_db.init_database()
        self.assertTrue(TEST_DB_PATH.exists())
        
        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row[0] for row in cursor.fetchall()}
        self.assertTrue({'assets', 'observations', 'work_cards', 'decision_traces', 'outcomes'}.issubset(tables))
        conn.close()

    def test_seed_inserts_expected_rows(self):
        init_db.init_database()
        seed_sample_data.seed_data()
        
        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM assets;")
        self.assertEqual(cursor.fetchone()[0], 1)
        
        cursor.execute("SELECT COUNT(*) FROM work_cards;")
        self.assertEqual(cursor.fetchone()[0], 1)
        
        conn.close()

    def test_export_produces_valid_json(self):
        init_db.init_database()
        seed_sample_data.seed_data()
        
        export_journal_json.export_journal()
        self.assertTrue(TEST_JSON_PATH.exists())
        
        with open(TEST_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        self.assertIn("assets", data)
        self.assertEqual(len(data["assets"]), 1)
        self.assertEqual(data["assets"][0]["asset"]["asset_id"], "example-cacao-habitat-04")

    def test_import_rejects_malformed_payload(self):
        init_db.init_database()
        
        # Create a malformed JSON file
        with open(TEST_JSON_PATH, 'w') as f:
            f.write("NOT JSON")
            
        success = import_journal_json.import_journal(TEST_JSON_PATH)
        self.assertFalse(success)

    def test_import_decision_payload_records_review(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute("UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?", ("wc-20260702-001",))
        conn.commit()
        conn.close()

        payload = {
            "work_card_id": "wc-20260702-001",
            "operator_approved": True,
            "reasoning": "Imported decision payload approved by steward.",
            "reviewed_by": "steward-import-1",
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        success = import_decision_json.import_decision_payload(TEST_JSON_PATH)
        self.assertTrue(success)

        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT operator_approved, reasoning, reviewed_by FROM decision_traces WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        decision_row = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(decision_row)
        self.assertEqual(decision_row[0], 1)
        self.assertEqual(decision_row[1], "Imported decision payload approved by steward.")
        self.assertEqual(decision_row[2], "steward-import-1")

    def test_import_decision_payload_accepts_utf8_bom(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute("UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?", ("wc-20260702-001",))
        conn.commit()
        conn.close()

        payload = {
            "work_card_id": "wc-20260702-001",
            "operator_approved": True,
            "reasoning": "BOM-prefixed decision payload approved by steward.",
            "reviewed_by": "steward-import-bom",
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8-sig") as f:
            json.dump(payload, f)

        success = import_decision_json.import_decision_payload(TEST_JSON_PATH)
        self.assertTrue(success)

    def test_import_decision_payload_rejects_missing_required_fields(self):
        init_db.init_database()

        bad_payload = {
            "work_card_id": "wc-20260702-001",
            "operator_approved": True,
            "reasoning": "Missing reviewer should fail.",
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(bad_payload, f)

        success = import_decision_json.import_decision_payload(TEST_JSON_PATH)
        self.assertFalse(success)

    def test_imported_decision_refreshes_operations_export(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute(
            "UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        conn.commit()
        conn.close()

        payload = {
            "work_card_id": "wc-20260702-001",
            "operator_approved": True,
            "reasoning": "Decision must be visible in the refreshed operations artifact.",
            "reviewed_by": "steward-visible-1",
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        success = import_decision_json.import_decision_payload(
            TEST_JSON_PATH,
            refresh_operations=True,
        )
        self.assertTrue(success)

        with open(TEST_JSON_PATH, "r", encoding="utf-8") as f:
            exported = json.load(f)

        work_card = exported["assets"][0]["work_cards"][0]
        self.assertEqual(work_card["status"], "REVIEWED")
        self.assertEqual(len(work_card["decision_traces"]), 1)
        decision = work_card["decision_traces"][0]
        self.assertEqual(decision["reasoning"], payload["reasoning"])
        self.assertEqual(decision["reviewed_by"], payload["reviewed_by"])

    def test_record_outcome_inserts_valid_record(self):
        init_db.init_database()
        seed_sample_data.seed_data()
        
        # Remove existing outcome for testing to allow a new one
        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.commit()
        conn.close()

        success = record_outcome.record_outcome(
            work_card_id="wc-20260702-001",
            metric_name="relative_humidity",
            metric_unit="%",
            observed_value=75.0,
            calculated_prediction_error=5.0,
            notes="Test outcome recorded successfully."
        )
        
        self.assertTrue(success)
        
        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT observed_value, calculated_prediction_error, notes FROM outcomes WHERE work_card_id = ?", ("wc-20260702-001",))
        row = cursor.fetchone()
        
        self.assertIsNotNone(row)
        self.assertEqual(row[0], 75.0)
        self.assertEqual(row[1], 5.0)
        self.assertEqual(row[2], "Test outcome recorded successfully.")
        conn.close()

    def test_record_decision_inserts_and_promotes_reviewed_status(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute("UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?", ("wc-20260702-001",))
        conn.commit()
        conn.close()

        success = record_decision.record_decision(
            work_card_id="wc-20260702-001",
            operator_approved=True,
            reasoning="Humidity is below the safe operating band. Review approved.",
            reviewed_by="operator-review-1",
        )
        self.assertTrue(success)

        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT operator_approved, reasoning, reviewed_by FROM decision_traces WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        decision_row = cursor.fetchone()
        cursor.execute(
            "SELECT status FROM work_cards WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        status_row = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(decision_row)
        self.assertEqual(decision_row[0], 1)
        self.assertEqual(decision_row[1], "Humidity is below the safe operating band. Review approved.")
        self.assertEqual(decision_row[2], "operator-review-1")
        self.assertEqual(status_row[0], "REVIEWED")

    def test_rejected_decision_keeps_work_card_in_draft(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute("UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?", ("wc-20260702-001",))
        conn.commit()
        conn.close()

        success = record_decision.record_decision(
            work_card_id="wc-20260702-001",
            operator_approved=False,
            reasoning="Operator rejected the action pending manual canopy inspection.",
            reviewed_by="operator-review-2",
        )
        self.assertTrue(success)

        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT operator_approved FROM decision_traces WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        decision_row = cursor.fetchone()
        cursor.execute(
            "SELECT status FROM work_cards WHERE work_card_id = ?",
            ("wc-20260702-001",),
        )
        status_row = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(decision_row)
        self.assertEqual(decision_row[0], 0)
        self.assertEqual(status_row[0], "DRAFT")

    def test_record_outcome_requires_approved_decision(self):
        init_db.init_database()
        seed_sample_data.seed_data()

        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.execute("UPDATE work_cards SET status = 'DRAFT' WHERE work_card_id = ?", ("wc-20260702-001",))
        conn.commit()
        conn.close()

        success = record_outcome.record_outcome(
            work_card_id="wc-20260702-001",
            metric_name="relative_humidity",
            metric_unit="%",
            observed_value=73.0,
            calculated_prediction_error=3.0,
            notes="Should fail because no approved decision exists.",
        )
        self.assertFalse(success)

    def test_import_outcome_payload_valid_and_bom(self):
        import import_outcome_json
        init_db.init_database()
        seed_sample_data.seed_data()
        
        # Must have an approved decision first
        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.commit()
        conn.close()

        record_decision.record_decision(
            work_card_id="wc-20260702-001",
            operator_approved=True,
            reasoning="Approve for outcome test",
            reviewed_by="steward"
        )

        payload = {
            "work_card_id": "wc-20260702-001",
            "metric_name": "temp",
            "metric_unit": "C",
            "observed_value": 25.5,
            "calculated_prediction_error": 0.5,
            "notes": "Test outcome BOM"
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8-sig") as f:
            json.dump(payload, f)

        success = import_outcome_json.import_outcome_payload(TEST_JSON_PATH, refresh_operations=True)
        self.assertTrue(success)

        with open(TEST_JSON_PATH, "r", encoding="utf-8") as f:
            exported = json.load(f)

        work_card = exported["assets"][0]["work_cards"][0]
        self.assertEqual(len(work_card["outcomes"]), 1)
        self.assertEqual(work_card["outcomes"][0]["observed_value"], 25.5)

    def test_import_outcome_payload_missing_fields(self):
        import import_outcome_json
        init_db.init_database()
        bad_payload = {
            "work_card_id": "wc-20260702-001",
            "metric_name": "temp",
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(bad_payload, f)

        success = import_outcome_json.import_outcome_payload(TEST_JSON_PATH)
        self.assertFalse(success)

    def test_import_outcome_payload_non_finite(self):
        import import_outcome_json
        init_db.init_database()
        bad_payload = {
            "work_card_id": "wc-20260702-001",
            "metric_name": "temp",
            "metric_unit": "C",
            "observed_value": float("inf")
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(bad_payload, f)

        success = import_outcome_json.import_outcome_payload(TEST_JSON_PATH)
        self.assertFalse(success)

    def test_import_outcome_fails_without_approved_decision(self):
        import import_outcome_json
        init_db.init_database()
        seed_sample_data.seed_data()
        
        conn = sqlite3.connect(TEST_DB_PATH)
        conn.execute("DELETE FROM outcomes;")
        conn.execute("DELETE FROM decision_traces;")
        conn.commit()
        conn.close()

        payload = {
            "work_card_id": "wc-20260702-001",
            "metric_name": "temp",
            "metric_unit": "C",
            "observed_value": 25.5
        }
        with open(TEST_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        success = import_outcome_json.import_outcome_payload(TEST_JSON_PATH)
        self.assertFalse(success)

    def test_full_schema_roundtrip(self):
        init_db.init_database()
        seed_sample_data.seed_data()
        
        export_journal_json.export_journal()
        self.assertTrue(TEST_JSON_PATH.exists())

        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM work_cards")
        pre_export_wc = cursor.fetchall()
        cursor.execute("SELECT * FROM outcomes")
        pre_export_outcomes = cursor.fetchall()
        conn.close()
        
        # Wipe DB
        safe_unlink(TEST_DB_PATH)
        init_db.init_database()
        
        # Import JSON
        success = import_journal_json.import_journal(TEST_JSON_PATH)
        self.assertTrue(success)

        # Verify
        conn = sqlite3.connect(TEST_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM work_cards")
        post_import_wc = cursor.fetchall()
        cursor.execute("SELECT * FROM outcomes")
        post_import_outcomes = cursor.fetchall()
        conn.close()

        self.assertEqual(len(pre_export_wc), len(post_import_wc))
        self.assertEqual(len(pre_export_outcomes), len(post_import_outcomes))
        self.assertEqual(pre_export_wc, post_import_wc)
        self.assertEqual(pre_export_outcomes, post_import_outcomes)

if __name__ == '__main__':
    unittest.main()
