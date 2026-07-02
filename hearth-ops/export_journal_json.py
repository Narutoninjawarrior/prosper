# export_journal_json.py
# Exports the hearth-ops SQLite database contents into a read-only JSON journal format.
# Preserves truth boundary by only exporting existing fields.

import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / 'stewardship.db'
OUTPUT_PATH = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'journal_export.json'

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def export_journal():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}.")
        return

    print(f"Exporting journal from {DB_PATH} to {OUTPUT_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = dict_factory
    
    try:
        cursor = conn.cursor()
        
        # We will structure the export as a list of assets, each with their related history
        cursor.execute("SELECT * FROM assets;")
        assets = cursor.fetchall()
        
        journal_data = {
            "export_version": "1.0",
            "assets": []
        }
        
        for asset in assets:
            asset_id = asset['asset_id']
            
            # Get observations
            cursor.execute("SELECT * FROM observations WHERE asset_id = ? ORDER BY timestamp DESC;", (asset_id,))
            observations = cursor.fetchall()
            
            # Get work cards
            cursor.execute("SELECT * FROM work_cards WHERE asset_id = ? ORDER BY created_at DESC;", (asset_id,))
            work_cards = cursor.fetchall()
            
            # Enrich work cards with decisions and outcomes
            for wc in work_cards:
                wc_id = wc['work_card_id']
                
                cursor.execute("SELECT * FROM decision_traces WHERE work_card_id = ?;", (wc_id,))
                decisions = cursor.fetchall()
                wc['decision_traces'] = decisions
                
                cursor.execute("SELECT * FROM outcomes WHERE work_card_id = ?;", (wc_id,))
                outcomes = cursor.fetchall()
                wc['outcomes'] = outcomes
            
            asset_entry = {
                "asset": asset,
                "observations": observations,
                "work_cards": work_cards
            }
            
            journal_data["assets"].append(asset_entry)
        
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(journal_data, f, indent=2)
            
        print(f"Successfully exported {len(assets)} assets and their history to {OUTPUT_PATH}.")

    except Exception as e:
        print(f"Export failed: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    export_journal()
