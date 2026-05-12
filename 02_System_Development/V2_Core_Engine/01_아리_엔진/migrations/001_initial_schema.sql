-- Phase 42 ADM: 001_initial_schema.sql
-- 핵심 테이블 CREATE (Task, Log, TaskComment, projects, teams, team_agents)
-- 모든 CREATE에 IF NOT EXISTS 적용 — 기존 DB에서도 안전

CREATE TABLE IF NOT EXISTS Task (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT    NOT NULL,
    status     TEXT    NOT NULL,
    requester  TEXT,
    model      TEXT,
    risk_level TEXT    NOT NULL DEFAULT 'SAFE',
    execution_mode TEXT DEFAULT 'ari',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    level      TEXT,
    message    TEXT NOT NULL,
    agent_id   TEXT,
    task_id    TEXT,
    source     TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS TaskComment (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL,
    author     TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES Task(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    group_type  TEXT,
    icon        TEXT,
    color       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_agents (
    team_id         TEXT REFERENCES teams(id) ON DELETE CASCADE,
    agent_id        TEXT NOT NULL,
    experiment_role TEXT,
    PRIMARY KEY (team_id, agent_id)
);
