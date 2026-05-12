-- Phase 42 ADM: 005_agent_skill_table.sql
-- AgentSkill + project_agents 테이블

CREATE TABLE IF NOT EXISTS AgentSkill (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL,
    skill_id   TEXT NOT NULL,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS project_agents (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id         TEXT NOT NULL,
    model_id        TEXT NOT NULL,
    nickname        TEXT,
    avatar          TEXT,
    role_description TEXT,
    status          TEXT DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);
