-- Phase 42 ADM: 008_indexes_and_triggers.sql
-- 인덱스 + FTS5 전문 검색 + 동기화 트리거

CREATE INDEX IF NOT EXISTS idx_task_watchdog ON Task(status, updated_at);

CREATE VIRTUAL TABLE IF NOT EXISTS TaskFTS USING fts5(id UNINDEXED, content, tokenize='unicode61');

CREATE TRIGGER IF NOT EXISTS task_ai_insert AFTER INSERT ON Task
    BEGIN
        INSERT INTO TaskFTS(rowid, id, content) VALUES (new.id, new.id, new.content);
    END;

CREATE TRIGGER IF NOT EXISTS task_ai_update AFTER UPDATE OF content ON Task
    BEGIN
        UPDATE TaskFTS SET content = new.content WHERE rowid = old.id;
    END;

CREATE TRIGGER IF NOT EXISTS task_ai_delete AFTER DELETE ON Task
    BEGIN
        DELETE FROM TaskFTS WHERE rowid = old.id;
    END;
