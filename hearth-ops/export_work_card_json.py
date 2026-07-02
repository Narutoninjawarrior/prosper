# export_work_card_json.py
# Reads a work card from SQLite and exports it as a JSON payload matching the contract schema.

import json
from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'stewardship.db'

def export_work_card(work_card_id):
    print(f"Exporting Work Card '{work_card_id}' from: {DB_PATH}...\n")
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Query work card with associated asset and decision trace details
        query = """
            SELECT 
                wc.work_card_id,
                wc.label,
                wc.description,
                wc.estimated_labor_hours,
                wc.status,
                wc.created_at,
                a.facility_id,
                a.name AS asset_name,
                wc.operator_type,
                wc.qualification,
                wc.task_class,
                wc.tools_json,
                wc.materials_json,
                wc.safety_limits_json,
                wc.stop_conditions_json,
                dt.operator_approved,
                dt.reviewed_by,
                dt.reviewed_at,
                o.observation_id,
                o.source AS observation_source,
                o.metric_name AS observation_metric_name,
                o.metric_value AS observation_metric_value,
                o.metric_unit AS observation_metric_unit
            FROM work_cards wc
            JOIN assets a ON wc.asset_id = a.asset_id
            LEFT JOIN decision_traces dt ON wc.work_card_id = dt.work_card_id
            LEFT JOIN observations o ON wc.observation_id = o.observation_id
            WHERE wc.work_card_id = ?;
        """
        cursor.execute(query, (work_card_id,))
        row = cursor.fetchone()

        if not row:
            print(f"Work Card '{work_card_id}' not found.")
            return

        tools = json.loads(row['tools_json'])
        materials = json.loads(row['materials_json'])
        safety_limits = json.loads(row['safety_limits_json'])
        stop_conditions = json.loads(row['stop_conditions_json'])

        dependencies = []
        if row['observation_id']:
            dependencies.append(f"Observation ID: {row['observation_id']}")
        if row['observation_source'] and row['observation_metric_name'] is not None:
            dependencies.append(
                f"Observed via {row['observation_source']}: "
                f"{row['observation_metric_name']}={row['observation_metric_value']}{row['observation_metric_unit']}"
            )

        status = row['status'] if row['status'] in ('DRAFT', 'REVIEWED', 'AUTHORIZED') else 'DRAFT'
        approvals = {}
        if row['reviewed_by'] and row['reviewed_at']:
            approvals['reviewed_by'] = row['reviewed_by']
            approvals['reviewed_at'] = row['reviewed_at']

        work_pack = {
            "id": row['work_card_id'],
            "version": "v1.0.0",
            "facility_reference": {
                "facility_id": row['facility_id'],
                "facility_title": row['facility_id']
            },
            "target_assets": [row['asset_name']],
            "task": {
                "description": row['description'],
                "task_class": row['task_class'],
            },
            "proposed_operator": {
                "type": row['operator_type'],
                "required_role_or_qualification": row['qualification'],
            },
            "spatial_boundary": {
                "facility_zone": row['asset_name'],
            },
            "resource_requirements": {
                "materials": materials,
                "tools": tools,
                "estimated_labor_hours": row['estimated_labor_hours'],
            },
            "constraints": {
                "safety_limits": safety_limits,
                "stop_conditions": stop_conditions,
            },
            "dependencies": dependencies,
            "approvals": approvals,
            "status": status,
            "truth_boundary": "REVIEWED local planning draft exported from hearth-ops. Not a live execution command.",
            "domain_extensions": {
                "biological": {
                    "health_metric_target": row['observation_metric_name'] or '',
                }
            },
        }

        # Format and output JSON
        formatted_json = json.dumps(work_pack, indent=2)
        print("--- Canonical Work Pack Contract JSON Output ---")
        print(formatted_json)
        print("------------------------------------------------")
        
        # Save to output file
        output_filename = f"work_pack_{work_card_id}.json"
        output_path = BASE_DIR / output_filename
        with output_path.open('w', encoding='utf-8') as f:
            f.write(formatted_json + '\n')
        print(f"Successfully saved exported pack to file: {output_path}")

    except Exception as e:
        print(f"Export failed: {e}")
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    # Export the seeded card ID
    export_work_card('wc-20260702-001')
