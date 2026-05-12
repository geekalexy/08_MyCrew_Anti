-- Phase 42 ADM: 003_comment_columns.sql
-- TaskComment 테이블 ALTER 모음

ALTER TABLE TaskComment ADD COLUMN meta_data TEXT DEFAULT NULL;
ALTER TABLE TaskComment ADD COLUMN project_id TEXT DEFAULT NULL;
ALTER TABLE TaskComment ADD COLUMN comment_idx INTEGER DEFAULT NULL;
ALTER TABLE TaskComment ADD COLUMN context_chain TEXT DEFAULT '[]';
