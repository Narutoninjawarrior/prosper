import { describe, it, expect } from 'vitest';
import { normalizeOpsData } from './opsAdapter';

describe('opsAdapter', () => {
  it('returns error for null or undefined input', () => {
    expect(normalizeOpsData(null)).toEqual({ error: 'NO_RECORDS' });
    expect(normalizeOpsData(undefined)).toEqual({ error: 'NO_RECORDS' });
  });

  it('returns error for unknown schema', () => {
    const unknown = { some_random_field: 123 };
    expect(normalizeOpsData(unknown)).toEqual({ error: 'UNKNOWN_SCHEMA' });
  });

  it('normalizes stewardship-journal-envelope-v1 correctly', () => {
    const envelope = {
      schema: 'stewardship-journal-envelope-v1',
      updated_at: '2026-07-02T00:00:00Z',
      entries: [
        {
          entry_id: 'test-entry-1',
          observation_id: 'test-obs-1',
          living_asset_id: 'test-asset-1',
          steward_continuity_id: 'steward-1',
          observation: {
            timestamp: '2026-07-02T00:00:00Z',
            source: 'test-sensor',
            measurements: [
              { metric_name: 'temperature', value: 25, unit: 'C' }
            ]
          },
          model_proposal: {
            care_options: [
              { option_id: 'opt-1', label: 'Test Care', description: 'Test Desc', estimated_labor_hours: 1 }
            ]
          },
          decision: {
            selected_option: 'opt-1',
            reasoning: 'looks good',
            approved_by_human: true,
            reviewed_by_steward_id: 'steward-1'
          }
        }
      ]
    };

    const result = normalizeOpsData(envelope) as any;
    expect(result).not.toHaveProperty('error');
    expect(result.meta.schema).toBe('stewardship-journal-envelope-v1');
    expect(result.assets.length).toBe(1);
    expect(result.assets[0].asset_id).toBe('test-asset-1');
    expect(result.observations.length).toBe(1);
    expect(result.observations[0].metric_name).toBe('temperature');
    expect(result.work_cards.length).toBe(1);
    expect(result.work_cards[0].status).toBe('REVIEWED');
    expect(result.decision_traces.length).toBe(1);
  });

  it('normalizes hearth-ops export shape correctly', () => {
    const sqliteExport = {
      export_version: '1.0',
      assets: [
        {
          asset: {
            asset_id: 'sqlite-asset-1',
            name: 'Test Asset',
            type: 'test',
            status: 'active',
            facility_id: 'test-fac',
            created_at: '2026-07-02T00:00:00Z'
          },
          observations: [
            {
              observation_id: 'sqlite-obs-1',
              asset_id: 'sqlite-asset-1',
              steward_id: 'steward-1',
              timestamp: '2026-07-02T00:00:00Z',
              source: 'test',
              metric_name: 'humidity',
              metric_value: 50,
              metric_unit: '%'
            }
          ],
          work_cards: [
            {
              work_card_id: 'sqlite-wc-1',
              asset_id: 'sqlite-asset-1',
              observation_id: 'sqlite-obs-1',
              label: 'Test Label',
              description: 'Test Desc',
              estimated_labor_hours: 1,
              status: 'pending',
              operator_type: 'human',
              qualification: 'none',
              task_class: 'maintenance',
              tools_json: '["hammer"]',
              materials_json: '[]',
              safety_limits_json: '[]',
              decision_traces: [],
              outcomes: []
            }
          ]
        }
      ]
    };

    const result = normalizeOpsData(sqliteExport) as any;
    expect(result).not.toHaveProperty('error');
    expect(result.meta.schema).toContain('PhysicalWorkPackV1');
    expect(result.assets.length).toBe(1);
    expect(result.observations.length).toBe(1);
    expect(result.work_cards.length).toBe(1);
    expect(result.work_cards[0].tools).toEqual(['hammer']); // verifying json parsing
  });
});
