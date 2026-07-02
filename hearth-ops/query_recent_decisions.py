# query_recent_decisions.py
# Runs a relational query over assets, observations, work cards, decisions, and outcomes.

from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'stewardship.db'

def query_decisions():
    print(f"Executing relational analytics query on: {DB_PATH}\n")
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()

        query = """
            SELECT 
                a.name AS asset_name,
                o.metric_name AS observed_metric,
                o.metric_value AS initial_value,
                o.metric_unit AS initial_unit,
                wc.label AS work_card_label,
                dt.operator_approved AS operator_approved,
                dt.reasoning AS operator_reasoning,
                out.observed_value AS final_value,
                out.calculated_prediction_error AS error_percent,
                out.notes AS outcome_notes
            FROM work_cards wc
            JOIN assets a ON wc.asset_id = a.asset_id
            LEFT JOIN observations o ON wc.observation_id = o.observation_id
            LEFT JOIN decision_traces dt ON wc.work_card_id = dt.work_card_id
            LEFT JOIN outcomes out ON wc.work_card_id = out.work_card_id
            ORDER BY wc.created_at DESC;
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        print(f"{'Asset Name':<30} | {'Metric':<18} | {'Initial':<8} | {'Approved':<8} | {'Final':<8} | {'Error %':<8}")
        print("-" * 92)

        for row in rows:
            asset_name = row[0]
            metric = row[1]
            initial = f"{row[2]}{row[3]}" if row[2] is not None else "N/A"
            approved = "YES" if row[5] == 1 else "NO"
            final = f"{row[7]}{row[3]}" if row[7] is not None else "N/A"
            error = f"{row[8]}%" if row[8] is not None else "N/A"
            
            print(f"{asset_name:<30} | {metric:<18} | {initial:<8} | {approved:<8} | {final:<8} | {error:<8}")
            print(f"  > Work Option: {row[4]}")
            print(f"  > Operator Decision Reasoning: {row[6]}")
            print(f"  > Outcome Resolution: {row[9] or 'N/A'}\n")

    except Exception as e:
        print(f"Query execution failed: {e}")
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    query_decisions()
