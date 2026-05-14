-- Migration: 012_phase44_autoqa_pipeline
-- Description: Create task_snapshots table for Immutable QA pipeline (Phase 44-3)

CREATE TABLE IF NOT EXISTS task_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    linked_files TEXT,
    FOREIGN KEY(task_id) REFERENCES Task(id) ON DELETE CASCADE
);
