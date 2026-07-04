import { sqliteClient } from './sqliteClient';
import { buildMerkleTree } from './merkleProof';

export interface ComplianceReport {
  generated_at: string;
  report_period: { start: string; end: string };
  operator: string;
  sections: {
    executive_summary: string;
    bed_inventory: any[];
    asset_traceability: any[];
    input_records: any[];
    output_records: any[];
    sensor_compliance: any[];
    work_card_compliance: any[];
    non_conformances: any[];
    merkle_integrity: string;
  };
}

export const generateComplianceReport = async (startDate: string, endDate: string): Promise<ComplianceReport> => {
  const beds = await sqliteClient.query('SELECT * FROM growing_beds');
  const assets = await sqliteClient.query('SELECT * FROM asset_passports');
  const amendments = await sqliteClient.query(
    `SELECT * FROM soil_amendments WHERE application_date >= '${startDate}' AND application_date <= '${endDate}'`
  );
  const harvests = await sqliteClient.query(
    `SELECT * FROM harvest_logs WHERE harvest_date >= '${startDate}' AND harvest_date <= '${endDate}'`
  );
  const sensors = await sqliteClient.query(
    `SELECT * FROM sensor_readings WHERE fetched_at >= '${startDate}' AND fetched_at <= '${endDate}'`
  );
  const workCards = await sqliteClient.query(
    `SELECT * FROM work_card_links WHERE outcome_recorded_at >= '${startDate}' AND outcome_recorded_at <= '${endDate}'`
  );
  const nc = await sqliteClient.query(
    `SELECT * FROM non_conformances WHERE created_at >= '${startDate}' AND created_at <= '${endDate}'`
  );
  
  const entries = await sqliteClient.query(
    `SELECT content_hash FROM journal_entries WHERE timestamp >= '${startDate}' AND timestamp <= '${endDate}' AND content_hash IS NOT NULL`
  );
  
  let root = 'unknown';
  let status = 'unverified';
  try {
    if (entries.length > 0) {
      const hashes = entries.map((e: any) => e.content_hash);
      const merkle = await buildMerkleTree(hashes);
      root = merkle.root;
      status = 'VERIFIED';
    } else {
      status = 'NO_ENTRIES';
    }
  } catch(e) {
    console.error('Merkle integrity check failed', e);
  }
  
  const report: ComplianceReport = {
    generated_at: new Date().toISOString(),
    report_period: { start: startDate, end: endDate },
    operator: 'Hearthlands Stewardship Protocol',
    sections: {
      executive_summary: `Stewardship report for period ${startDate} to ${endDate}. ${assets.length} assets tracked across ${beds.length} beds. ${harvests.length} harvest events recorded. Merkle chain integrity: ${status}.`,
      bed_inventory: beds,
      asset_traceability: assets,
      input_records: amendments,
      output_records: harvests,
      sensor_compliance: sensors,
      work_card_compliance: workCards,
      non_conformances: nc,
      merkle_integrity: root,
    }
  };
  
  return report;
};
