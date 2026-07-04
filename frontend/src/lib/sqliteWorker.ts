import * as SQLite from 'wa-sqlite';
// @ts-ignore
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';

let db: any;
let sqlite3: any;
const DB_NAME = 'stewardship-journal.sqlite';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS asset_passports (
    asset_id TEXT PRIMARY KEY,
    accession_number TEXT,
    botanical_name TEXT,
    cultivar TEXT,
    common_name TEXT,
    origin_country TEXT,
    source_type TEXT,
    donor_or_collector TEXT,
    acquisition_date TEXT,
    current_location TEXT,
    status TEXT,
    traceability_code TEXT,
    location_status_log TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id TEXT PRIMARY KEY,
    observation_id TEXT,
    living_asset_id TEXT,
    steward_continuity_id TEXT,
    data_freshness_seconds INTEGER,
    timestamp TEXT,
    source TEXT,
    model_proposal TEXT,
    prediction TEXT,
    decision TEXT,
    outcome TEXT,
    model_replacement TEXT,
    lineage TEXT,
    meta TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT,
    timestamp TEXT,
    value REAL,
    unit TEXT,
    asset_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS work_card_links (
    work_card_id TEXT PRIMARY KEY,
    journal_entry_id TEXT,
    asset_id TEXT,
    status TEXT,
    outcome_text TEXT,
    outcome_status TEXT,
    outcome_photo_url TEXT,
    outcome_next_steps TEXT,
    outcome_recorded_at DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS content_hashes (
    hash TEXT PRIMARY KEY,
    source_table TEXT,
    source_id TEXT,
    timestamp TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS media_attachments (
    id TEXT PRIMARY KEY,
    journal_entry_id TEXT REFERENCES journal_entries(entry_id),
    data_url TEXT NOT NULL,
    caption TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sensor_thresholds (
    id TEXT PRIMARY KEY,
    sensor_type TEXT NOT NULL UNIQUE,
    min_value REAL,
    max_value REAL,
    alert_message TEXT,
    severity TEXT DEFAULT 'WARNING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sensor_readings_linked ON sensor_readings(linked_journal_entry_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sensor_readings_fetched ON sensor_readings(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_created ON journal_entries(timestamp)`,
  `CREATE TABLE IF NOT EXISTS actuator_config (
    id TEXT PRIMARY KEY,
    relay_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sensor_type TEXT,
    mode TEXT DEFAULT 'alert_only',
    min_threshold REAL,
    max_threshold REAL,
    max_duration_seconds INTEGER DEFAULT 60,
    max_activations_per_cycle INTEGER DEFAULT 5,
    pause_minutes INTEGER DEFAULT 90,
    enabled INTEGER DEFAULT 1,
    predictive_window_size INTEGER DEFAULT 7,
    predictive_horizon_days INTEGER DEFAULT 7,
    predictive_min_slope REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS actuator_events (
    id TEXT PRIMARY KEY,
    config_id TEXT REFERENCES actuator_config(id),
    command_source TEXT NOT NULL,
    state TEXT NOT NULL,
    duration_seconds INTEGER,
    reason TEXT,
    operator_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `INSERT OR IGNORE INTO actuator_config (id, relay_id, name, sensor_type, mode, min_threshold, max_threshold)
   VALUES 
     ('act_1', 0, 'Main Bed Drip', 'capacitive_moisture', 'alert_only', 20.0, 60.0),
     ('act_2', 1, 'Raised Bed Soaker', 'capacitive_moisture', 'alert_only', 25.0, 65.0)`,
  `CREATE TABLE IF NOT EXISTS harvest_logs (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES asset_passports(id),
    harvest_date DATETIME NOT NULL,
    weight_kg REAL,
    count INTEGER,
    quality_grade TEXT,
    harvest_method TEXT,
    bed_id TEXT,
    notes TEXT,
    photo_url TEXT,
    operator_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS soil_amendments (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES asset_passports(id),
    bed_id TEXT,
    amendment_type TEXT NOT NULL,
    material_source TEXT,
    quantity_kg REAL,
    quantity_liters REAL,
    application_method TEXT,
    application_date DATETIME NOT NULL,
    weather_conditions TEXT,
    incorporation_depth_cm INTEGER,
    notes TEXT,
    operator_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS growing_beds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area_sqm REAL,
    facility_zone TEXT,
    conversion_status TEXT NOT NULL,
    conversion_start_date DATETIME,
    projected_certification_date DATETIME,
    last_audit_date DATETIME,
    next_audit_date DATETIME,
    audit_body TEXT,
    certifier_reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS bed_asset_history (
    id TEXT PRIMARY KEY,
    bed_id TEXT REFERENCES growing_beds(id),
    asset_id TEXT REFERENCES asset_passports(id),
    planted_at DATETIME,
    harvested_at DATETIME,
    yield_kg REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `INSERT OR IGNORE INTO growing_beds (id, name, area_sqm, conversion_status, conversion_start_date, projected_certification_date)
   VALUES
    ('bed_1', 'Main Bed North', 10.0, 'certified_organic', '2023-01-01', '2023-01-01'),
    ('bed_2', 'Raised Bed #3', 4.5, 'conversion_year_2', '2024-04-01', '2026-04-01'),
    ('bed_3', 'Greenhouse Zone A', 15.0, 'conversion_year_1', '2025-04-01', '2027-04-01')`,
  `CREATE TABLE IF NOT EXISTS non_conformances (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    source TEXT NOT NULL,
    related_bed_id TEXT REFERENCES growing_beds(id),
    related_asset_id TEXT REFERENCES asset_passports(id),
    related_work_card_id TEXT REFERENCES work_card_links(id),
    status TEXT NOT NULL DEFAULT 'identified',
    immediate_correction TEXT,
    corrected_at DATETIME,
    root_cause TEXT,
    rca_method TEXT,
    rca_completed_at DATETIME,
    corrective_action TEXT,
    action_owner TEXT,
    action_deadline DATETIME,
    action_completed_at DATETIME,
    verification_method TEXT,
    verification_evidence TEXT,
    verified_by TEXT,
    verified_at DATETIME,
    is_recurrent INTEGER DEFAULT 0,
    previous_nc_id TEXT REFERENCES non_conformances(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ics_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    approved_by TEXT,
    approved_at DATETIME,
    review_due_date DATETIME,
    is_current INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `INSERT OR IGNORE INTO ics_documents (id, title, category, version, content, approved_by, approved_at)
   VALUES
    ('ics_1', 'Organic Production Plan', 'plan', '1.0', 'This plan defines the scope, methods, and controls for organic production at the Hearthlands site...', 'Operator', '2026-01-01'),
    ('ics_2', 'Non-Conformance Management Procedure', 'procedure', '1.0', 'All deviations from organic standards are logged in the non-conformance register. Root cause analysis is mandatory for major non-conformances. Corrective actions are verified for effectiveness before closure.', 'Operator', '2026-01-01'),
    ('ics_3', 'Input Approval Policy', 'policy', '1.0', 'All soil amendments, seeds, and planting materials must be verified as compliant with EU Organic Regulation 2018/848 before use. Prohibited inputs: synthetic pesticides, chemical fertilizers, GMOs.', 'Operator', '2026-01-01'),
    ('ics_4', 'Traceability Procedure', 'procedure', '1.0', 'Every asset is assigned an accession number at planting. All operations (planting, amendment, harvest, work card) are linked to the asset ID. The Merkle chain provides cryptographic proof of record integrity.', 'Operator', '2026-01-01')`
];

class WorkerOPFSVFS extends OriginPrivateFileSystemVFS {
  handleAsync<T>(f: () => Promise<T>) {
    return f();
  }
}

async function init() {
  try {
    const { default: moduleFactory } = await import('wa-sqlite/dist/wa-sqlite-async.mjs');
    sqlite3 = SQLite.Factory(await moduleFactory());
  } catch (error: any) {
    throw new Error(`init/import-factory failed: ${error?.message || String(error)}`);
  }

  let vfs: any;
  try {
    vfs = new WorkerOPFSVFS();
    sqlite3.vfs_register(vfs, true);
  } catch (error: any) {
    throw new Error(`init/register-vfs failed: ${error?.message || String(error)}`);
  }

  const createSchema = async () => {
    let currentSchemaIndex = -1;
    try {
      for (const [index, statement] of SCHEMA_STATEMENTS.entries()) {
        currentSchemaIndex = index;
        await sqlite3.exec(db, statement);
      }
    } catch (error: any) {
      throw new Error(`init/create-schema failed: statement ${currentSchemaIndex} :: ${error?.message || String(error)}`);
    }
  };

  const removeCorruptDbFile = async () => {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(DB_NAME);
    } catch (error: any) {
      if (error?.name !== 'NotFoundError') {
        throw error;
      }
    }
  };

  if (import.meta.env.DEV) {
    await removeCorruptDbFile();
  }

  try {
    db = await sqlite3.open_v2(DB_NAME, 0x06, (vfs as any).name);
    await createSchema();
  } catch (error: any) {
    const message = error?.message || String(error);
    const shouldReset =
      message.includes('malformed') ||
      message.includes('disk image') ||
      message.includes('memory access out of bounds');
    if (!shouldReset) {
      throw new Error(`init/open-or-schema failed: ${message}`);
    }

    await removeCorruptDbFile();
    db = await sqlite3.open_v2(DB_NAME, 0x06, (vfs as any).name);
    await createSchema();
  }
  
  console.log("SQLite Worker: Initialized OPFS");
}

self.onmessage = async (e: MessageEvent) => {
  const { type, sql, id } = e.data;

  try {
    if (!db) {
      await init();
    }

    if (type === 'query') {
      const results: any[] = [];
      await sqlite3.exec(db, sql, (row: any, columns: any) => {
        const obj: any = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        results.push(obj);
      });
      self.postMessage({ id, results });
       // Exec multiple statements
       // Assuming params is an array for parameterized queries? Actually wa-sqlite doesn't support parameterized queries natively in exec without statements
       // For simple usage, we'll just execute raw SQL or use statements
       await sqlite3.exec(db, sql);
       self.postMessage({ id, success: true });
       if (sql.toUpperCase().includes('INSERT') || sql.toUpperCase().includes('UPDATE')) {
         self.postMessage({ type: 'MUTATION', timestamp: Date.now() });
       }
    }
  } catch (error: any) {
    const errorMessage =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : typeof error === 'string'
          ? error
          : JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
    self.postMessage({ id, error: errorMessage || 'Unknown SQLite worker error' });
  }
};
