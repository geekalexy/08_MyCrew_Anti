-- Phase 42 ADM: 009_seed_data.sql
-- 정적 시드 데이터 (team_agents INSERT OR IGNORE)

-- Team Independent (공유 라우터)
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_independent','ari','공유 라우터 (Gemini Flash)');
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_independent','ari','독립 판관 (GPT-4o 심사 보조)');

-- Team B (LUNA, PICO, LUMI)
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','luna','Team B — 최종 합성자 (Claude Opus)');
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','backend_engineer','Team B — 영상 담당 (Claude Sonnet)');
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','ux_designer','Team B — 이미지 담당 (Gemini Flash)');

-- Team A (OLLIE, LILY, NOVA)
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','ollie','Team A — 적대적 판관 (Claude Opus)');
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','lily', 'Team A — 영상 담당 (Claude Sonnet)');
INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','nova', 'Team A — 이미지 담당 (Gemini Flash)');
