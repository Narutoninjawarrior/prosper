-- schema.sql
-- Relational schema for the local-first operations console (hearth-ops)
-- Enforces foreign keys, data normalization, and integrity across operations.

PRAGMA foreign_keys = ON;

-- 1. Assets Table
CREATE TABLE IF NOT EXISTS assets (
    asset_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,          -- e.g., 'living_habitat', 'actuator', 'sensor'
    status TEXT NOT NULL,        -- e.g., 'active', 'dormant', 'degraded'
    facility_id TEXT NOT NULL,
    created_at TEXT NOT NULL     -- ISO 8601 string
);

-- 2. Observations Table
CREATE TABLE IF NOT EXISTS observations (
    observation_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    steward_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,     -- ISO 8601 string
    source TEXT NOT NULL,        -- e.g., 'operator-field-manual', 'sensor-stream'
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL,
    FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE
);

-- 3. Work Cards Table (Proposals and executable task containers)
CREATE TABLE IF NOT EXISTS work_cards (
    work_card_id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    observation_id TEXT,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    estimated_labor_hours REAL NOT NULL,
    status TEXT NOT NULL,        -- 'DRAFT', 'REVIEWED', 'AUTHORIZED'
    operator_type TEXT NOT NULL, -- 'human', 'AI', 'robot', 'team'
    qualification TEXT NOT NULL,
    task_class TEXT NOT NULL,
    tools_json TEXT NOT NULL,    -- JSON array
    materials_json TEXT NOT NULL,-- JSON array
    safety_limits_json TEXT NOT NULL,    -- JSON array
    stop_conditions_json TEXT NOT NULL,  -- JSON array of StopConditionV1
    created_at TEXT NOT NULL,    -- ISO 8601 string
    FOREIGN KEY(asset_id) REFERENCES assets(asset_id) ON DELETE CASCADE,
    FOREIGN KEY(observation_id) REFERENCES observations(observation_id) ON DELETE SET NULL
);

-- 4. Decision Traces Table (Audit logs of operator approvals/vetos)
CREATE TABLE IF NOT EXISTS decision_traces (
    decision_id TEXT PRIMARY KEY,
    work_card_id TEXT NOT NULL UNIQUE,
    operator_approved INTEGER NOT NULL CHECK(operator_approved IN (0, 1)),
    reasoning TEXT NOT NULL,
    reviewed_by TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,   -- ISO 8601 string
    FOREIGN KEY(work_card_id) REFERENCES work_cards(work_card_id) ON DELETE CASCADE
);

-- 5. Outcomes Table (Closing the feedback loop with empirical results)
CREATE TABLE IF NOT EXISTS outcomes (
    outcome_id TEXT PRIMARY KEY,
    work_card_id TEXT NOT NULL UNIQUE,
    observed_at TEXT NOT NULL,   -- ISO 8601 string
    metric_name TEXT NOT NULL,
    observed_value REAL NOT NULL,
    metric_unit TEXT NOT NULL,
    calculated_prediction_error REAL,
    notes TEXT,
    FOREIGN KEY(work_card_id) REFERENCES work_cards(work_card_id) ON DELETE CASCADE
);
