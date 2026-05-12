-- Phase 42 ADM: 006_phase36_pipeline.sql
-- 파이프라인 관련 테이블 + task_attachments

CREATE TABLE IF NOT EXISTS task_attachments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
    comment_id   INTEGER DEFAULT NULL REFERENCES TaskComment(id) ON DELETE SET NULL,
    file_idx     INTEGER NOT NULL,
    file_label   TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_type    TEXT,
    file_size    INTEGER,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id, file_idx);
