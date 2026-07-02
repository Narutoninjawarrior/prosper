# console_view.py
# A tiny read-only terminal console view for the hearth-ops local database.

import sqlite3
import textwrap
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / 'stewardship.db'

def print_header(title):
    print(f"\n{'='*80}")
    print(f" {title.upper()}")
    print(f"{'='*80}")

def print_table(cursor, query):
    cursor.execute(query)
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    if not rows:
        print("  (No records found)\n")
        return

    # Calculate column widths
    col_widths = [len(col) for col in columns]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)) if val is not None else 3)
            
    # Print header
    header_format = " | ".join([f"{{:<{w}}}" for w in col_widths])
    print(header_format.format(*columns))
    print("-" * (sum(col_widths) + len(columns) * 3 - 1))
    
    # Print rows
    for row in rows:
        formatted_row = [str(val) if val is not None else "N/A" for val in row]
        # Truncate long strings for console readability
        formatted_row = [textwrap.shorten(val, width=max(w, 20), placeholder="...") if len(val) > max(w, 20) else val for val, w in zip(formatted_row, col_widths)]
        print(header_format.format(*formatted_row))
    print()

def run_console_view():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}. Run init_db.py first.")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        cursor = conn.cursor()
        
        print_header("Asset Summary")
        print_table(cursor, "SELECT asset_id, name, type, status, facility_id FROM assets;")
        
        print_header("Observation Summary")
        print_table(cursor, "SELECT observation_id, asset_id, metric_name, metric_value, metric_unit, source FROM observations;")
        
        print_header("Work Card Summary")
        print_table(cursor, "SELECT work_card_id, asset_id, label, status, estimated_labor_hours FROM work_cards;")
        
        print_header("Decision Trace Summary")
        print_table(cursor, "SELECT decision_id, work_card_id, operator_approved, reviewed_by, reviewed_at FROM decision_traces;")
        
        print_header("Outcome Summary")
        print_table(cursor, "SELECT outcome_id, work_card_id, metric_name, observed_value, calculated_prediction_error FROM outcomes;")
        
        print_header("Filtered Query: Decisions with Associated Outcome Error")
        filtered_query = """
            SELECT 
                dt.decision_id,
                wc.label AS work_card_label,
                dt.operator_approved,
                o.metric_name,
                o.calculated_prediction_error,
                o.observed_value
            FROM decision_traces dt
            JOIN work_cards wc ON dt.work_card_id = wc.work_card_id
            JOIN outcomes o ON wc.work_card_id = o.work_card_id
            WHERE o.calculated_prediction_error IS NOT NULL;
        """
        print_table(cursor, filtered_query)

    except Exception as e:
        print(f"Failed to query database: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    run_console_view()
