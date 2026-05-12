-- Test migration for Phase 42
CREATE TABLE IF NOT EXISTS _agent_migration_test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_field TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
