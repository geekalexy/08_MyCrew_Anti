-- Phase 42 ADM: 007_utility_tables.sql
-- user_settings, CksMetrics, image_lab_sessions, cs_reports, agent_profiles, extension_sessions

CREATE TABLE IF NOT EXISTS user_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO user_settings (key, value) VALUES ('heartbeat_auto_resume_level', 'SAFE_ONLY');
INSERT OR IGNORE INTO user_settings (key, value) VALUES ('batch_report_interval_min', '30');

CREATE TABLE IF NOT EXISTS CksMetrics (
    task_id     TEXT PRIMARY KEY,
    team_type   TEXT,
    tei_tokens  INTEGER DEFAULT 0,
    ksi_r_score INTEGER DEFAULT 0,
    ksi_s_score REAL DEFAULT 0.0,
    her_count   INTEGER DEFAULT 0,
    eii_score   REAL DEFAULT 0.0,
    irc_count   INTEGER DEFAULT 0,
    uxs_rating  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS image_lab_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    ref_path TEXT,
    analysis_json TEXT,
    prompt TEXT,
    result_url TEXT,
    score_avg REAL,
    is_learned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cs_reports (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    report_no        TEXT    NOT NULL,
    severity         TEXT    NOT NULL CHECK(severity IN ('WARNING','CRITICAL')),
    service          TEXT    NOT NULL,
    affected_service TEXT,
    error_code       TEXT,
    error_msg        TEXT,
    stack_trace      TEXT,
    status           TEXT    NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED')),
    auto_generated   INTEGER NOT NULL DEFAULT 1,
    reporter         TEXT    NOT NULL DEFAULT 'bugdog',
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at      TEXT
);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id               TEXT PRIMARY KEY,
    nickname         TEXT,
    role             TEXT,
    model            TEXT,
    bridge           INTEGER NOT NULL DEFAULT 0,
    default_category TEXT,
    team_id          TEXT REFERENCES teams(id) ON DELETE SET NULL,
    project_id       TEXT REFERENCES projects(id) ON DELETE SET NULL,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS extension_sessions (
    session_id TEXT PRIMARY KEY,
    history    TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
