-- Phase 42 ADM: 004_project_columns.sql
-- projects 테이블 ALTER 모음 (Phase 28a ~ Phase 41)

ALTER TABLE projects ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE projects ADD COLUMN isolation_level TEXT DEFAULT 'GLOBAL';
ALTER TABLE projects ADD COLUMN updated_at DATETIME;
ALTER TABLE projects ADD COLUMN isolation_scope TEXT DEFAULT '{"type":"strict_isolation","shared_projects":[]}';
ALTER TABLE projects ADD COLUMN objective TEXT;
ALTER TABLE projects ADD COLUMN objective_raw TEXT;
ALTER TABLE projects ADD COLUMN workflow_raw TEXT;
ALTER TABLE projects ADD COLUMN pipeline_mode TEXT DEFAULT 'none';
ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'development';
ALTER TABLE projects ADD COLUMN plan_master_status TEXT DEFAULT NULL;
ALTER TABLE projects ADD COLUMN plan_master_revision_count INTEGER DEFAULT 0;

-- team_agents nickname 추가 (Phase 31+)
ALTER TABLE team_agents ADD COLUMN nickname TEXT;

-- Log 테이블 project_id 추가
ALTER TABLE Log ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
