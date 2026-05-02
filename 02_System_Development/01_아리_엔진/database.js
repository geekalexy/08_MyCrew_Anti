import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const sqlite3Verbose = sqlite3.verbose();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [S2-1] agents.json 기반 동적 에이전트 ID Set — KNOWN_AGENTS 하드코딩 제거
const AGENT_IDS = (() => {
  try {
    const raw = readFileSync(path.resolve(__dirname, 'agents.json'), 'utf-8');
    const agents = JSON.parse(raw);
    return new Set(agents.map(a => (a.id || a.name || '').toLowerCase()).filter(Boolean));
  } catch (e) {
    console.warn('[DB] agents.json 로드 실패, 기본값 사용:', e.message);
    return new Set(['ari', 'nova', 'lumi', 'pico', 'ollie', 'lily', 'luna']);
  }
})();
// 시스템 주체(system, devteam)는 항상 포함
AGENT_IDS.add('system');
AGENT_IDS.add('devteam');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3Verbose.Database(dbPath);

// ─── 위험 키워드 자동 태깅 (Opus 권고: 파괴적 작업 사전 차단) ─────────────
const CRITICAL_KEYWORDS = [
  'delete', 'rm', 'drop', 'truncate', 'migration',
  'deploy', 'release', '결제', '배포', '삭제', '초기화', 'format'
];

function classifyRiskLevel(content) {
  const lower = content.toLowerCase();
  return CRITICAL_KEYWORDS.some((kw) => lower.includes(kw)) ? 'CRITICAL' : 'SAFE';
}

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");
  // Task 테이블 생성 (최초 설치 시)
  db.run(`CREATE TABLE IF NOT EXISTS Task (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT    NOT NULL,
    status     TEXT    NOT NULL,
    requester  TEXT,
    model      TEXT,
    risk_level TEXT    NOT NULL DEFAULT 'SAFE',
    execution_mode TEXT DEFAULT 'ari',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 기존 DB 마이그레이션: pragma로 컬럼 존재 여부 확인 후, 없을 때만 ADD COLUMN
  // SQLite는 ALTER TABLE ADD COLUMN IF NOT EXISTS 미지원 → PRAGMA table_info 활용
  db.all(`PRAGMA table_info(Task)`, (err, columns) => {
    if (err) return console.error('[DB] PRAGMA 오류:', err.message);
    const names = columns.map((c) => c.name);

    if (!names.includes('risk_level')) {
      db.run(`ALTER TABLE Task ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'SAFE'`);
    }
    if (!names.includes('updated_at')) {
      db.run(`ALTER TABLE Task ADD COLUMN updated_at DATETIME`);
    }
    if (!names.includes('execution_mode')) {
      db.run(`ALTER TABLE Task ADD COLUMN execution_mode TEXT DEFAULT 'ari'`);
    }
    if (!names.includes('deleted_at')) {
      db.run(`ALTER TABLE Task ADD COLUMN deleted_at DATETIME`);
    }
    // [Phase 14 W1] 에이전트 ID를 model 컬럼에서 완전 분리
    if (!names.includes('assigned_agent')) {
      db.run(`ALTER TABLE Task ADD COLUMN assigned_agent TEXT DEFAULT NULL`);
      console.log('[DB] Phase 14 마이그레이션: assigned_agent 컬럼 추가 완료');
    }
    // [v3.2] 워크플로우 분류를 위한 category 컬럼 추가
    if (!names.includes('category')) {
      db.run(`ALTER TABLE Task ADD COLUMN category TEXT DEFAULT 'QUICK_CHAT'`);
      console.log('[DB] v3.2 마이그레이션: category 컬럼 추가 완료');
    }
    if (!names.includes('title')) {
      db.run(`ALTER TABLE Task ADD COLUMN title TEXT DEFAULT ''`);
      console.log('[DB] Phase 27 마이그레이션: title 컬럼 추가 완료');
    }
    // [S4-3] 실패 이력 카운터
    if (!names.includes('failure_count')) {
      db.run(`ALTER TABLE Task ADD COLUMN failure_count INTEGER DEFAULT 0`);
      console.log('[DB] S4-3 마이그레이션: failure_count 컬럼 추가 완료');
    }
  });

  db.all("PRAGMA table_info(TaskComment)", (err, rows) => {
    if (err) return;
    const names = rows.map((r) => r.name);
    if (!names.includes('meta_data')) {
      db.run(`ALTER TABLE TaskComment ADD COLUMN meta_data TEXT DEFAULT NULL`);
      console.log('[DB] Phase 22.6 마이그레이션: TaskComment meta_data 컬럼 추가 완료');
    }
  });

  // Log 테이블 생성 (Phase 12: 1시간 배치 보고용 데이터 저장)
  db.run(`CREATE TABLE IF NOT EXISTS Log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    level      TEXT,
    message    TEXT NOT NULL,
    agent_id   TEXT,
    task_id    TEXT,
    source     TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // TaskComment 테이블 생성 (Prime W2 반영: 별도 테이블 설계)
  db.run(`CREATE TABLE IF NOT EXISTS TaskComment (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL,
    author     TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES Task(id) ON DELETE CASCADE
  )`);


  // 사용자 설정 테이블 (Active Heartbeat 2.0 설정 저장소)
  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  // 기본값 삽입 (이미 존재하면 무시)
  db.run(`INSERT OR IGNORE INTO user_settings (key, value) VALUES ('heartbeat_auto_resume_level', 'SAFE_ONLY')`);
  db.run(`INSERT OR IGNORE INTO user_settings (key, value) VALUES ('batch_report_interval_min', '30')`);

  // CKS 연구 프레임워크 지표 테이블 (Phase 4 도입)
  db.run(`CREATE TABLE IF NOT EXISTS CksMetrics (
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
  )`);
  db.run(`ALTER TABLE CksMetrics ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});


  // DB 와치독 조회 효율화: 복합 인덱스 (Opus 권고)
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_watchdog ON Task(status, updated_at)`);

  // [Phase 17-4] AgentSkill 테이블 생성 (에이전트별 장착된 스킬 기록)
  db.run(`CREATE TABLE IF NOT EXISTS AgentSkill (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id   TEXT NOT NULL,
    skill_id   TEXT NOT NULL,
    is_active  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, skill_id)
  )`);

  // [S2-1] 동적 AGENT_IDS로 고아 스킬 레코드 클린업
  const agentList = [...AGENT_IDS].filter(id => id !== 'system' && id !== 'devteam');
  const placeholders = agentList.map(() => '?').join(',');
  db.run(
    `DELETE FROM AgentSkill WHERE agent_id NOT IN (${placeholders})`,
    agentList,
    function(err) {
      if (err) console.error('[DB] AgentSkill 클린업 실패:', err.message);
      else if (this.changes > 0) console.log(`[DB] 고아 스킬 레코드 ${this.changes}건 삭제 완료`);
    }
  );

  // ─── [Week 3: Memory 흡수] FTS5 전문 검색 데이블 및 트리거 생성 ───────────────
  db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS TaskFTS USING fts5(id UNINDEXED, content, tokenize='unicode61')`);

  // Task 테이블과 TaskFTS 동기화 트리거
  db.run(`CREATE TRIGGER IF NOT EXISTS task_ai_insert AFTER INSERT ON Task
          BEGIN
            INSERT INTO TaskFTS(rowid, id, content) VALUES (new.id, new.id, new.content);
          END`);
  
  db.run(`CREATE TRIGGER IF NOT EXISTS task_ai_update AFTER UPDATE OF content ON Task
          BEGIN
            UPDATE TaskFTS SET content = new.content WHERE rowid = old.id;
          END`);
          
  db.run(`CREATE TRIGGER IF NOT EXISTS task_ai_delete AFTER DELETE ON Task
          BEGIN
            DELETE FROM TaskFTS WHERE rowid = old.id;
          END`);

  // ─── [v2.0] Multi-Team 아키텍스쳐: projects / teams / team_agents 테이블 ────────
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    objective  TEXT,
    isolation_scope TEXT DEFAULT '{"type":"strict_isolation","shared_projects":[]}',
    status     TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.all(`PRAGMA table_info(projects)`, (err, cols) => {
    if (err) return;
    const names = (cols || []).map(c => c.name);
    if (!names.includes('objective')) {
      db.run(`ALTER TABLE projects ADD COLUMN objective TEXT`);
      console.log('[DB] Phase 28a 마이그레이션: objective 컬럼 추가 완료');
    }
    if (!names.includes('isolation_scope')) {
      db.run(`ALTER TABLE projects ADD COLUMN isolation_scope TEXT DEFAULT '{"type":"strict_isolation","shared_projects":[]}'`);
      console.log('[DB] Phase 28a 마이그레이션: isolation_scope 컬럼 추가 완료');
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    group_type  TEXT,
    icon        TEXT,
    color       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS team_agents (
    team_id         TEXT REFERENCES teams(id) ON DELETE CASCADE,
    agent_id        TEXT NOT NULL,
    experiment_role TEXT,
    nickname        TEXT,
    PRIMARY KEY (team_id, agent_id)
  )`);

  // [Phase 31+] team_agents nickname 컨럼 마이그레이션
  db.all(`PRAGMA table_info(team_agents)`, (err, cols) => {
    if (err) return;
    const names = (cols || []).map(c => c.name);
    if (!names.includes('nickname')) {
      db.run(`ALTER TABLE team_agents ADD COLUMN nickname TEXT`);
      console.log('[DB] Phase 31+ 마이그레이션: team_agents.nickname 컨럼 추가 완료');
    }
  });

  // ─── [v2.0] 시더(종자) 데이터 (PRAGMA 전에 미리 삽입하여 외래키 만족) ────────────
  // (Phase 28b: Zero-Config 연동 완료로, 더미 프로젝트 시딩 로직은 제거됨)

  // ─── [v2.0] 콜럼 마이그레이션: priority + has_artifact + project_id ────────────
  // Task와 Log 마이그레이션을 단일 트랜잭션으로 통합하여 데드락 경합 방지
  db.all(`PRAGMA table_info(Task)`, (err, taskCols) => {
    if (err) return;
    const taskNames = (taskCols || []).map(c => c.name);
    
    db.all(`PRAGMA table_info(Log)`, (err, logCols) => {
      if (err) return;
      const logNames = (logCols || []).map(c => c.name);
      
      db.serialize(() => {
        if (!taskNames.includes('priority'))     db.run(`ALTER TABLE Task ADD COLUMN priority TEXT DEFAULT 'medium'`);
        if (!taskNames.includes('has_artifact')) db.run(`ALTER TABLE Task ADD COLUMN has_artifact INTEGER DEFAULT 0`);
        if (!taskNames.includes('artifact_url')) db.run(`ALTER TABLE Task ADD COLUMN artifact_url TEXT DEFAULT NULL`);
        
        const alterTask = !taskNames.includes('project_id');
        const alterLog = !logNames.includes('project_id');

        if (alterTask) db.run(`ALTER TABLE Task ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);
        if (alterLog)  db.run(`ALTER TABLE Log ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);

        if (alterTask || alterLog) {
          db.run("BEGIN TRANSACTION");
          if (alterTask) db.run(`UPDATE Task SET project_id = 'global_mycrew' WHERE project_id IS NULL`);
          if (alterLog)  db.run(`UPDATE Log SET project_id = 'global_mycrew' WHERE project_id IS NULL`);
          
          db.run("COMMIT", function(err) {
            if (err) {
              console.error("[DB] Legacy backfill failed, rolling back:", err.message);
              db.run("ROLLBACK");
            } else {
              console.log(`[DB] Successfully backfilled legacy tasks & logs to 'global_mycrew' project.`);
            }
          });
        }
      });
    });
  });

  // ─── [v3.2] Final Global Roster
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_independent','ari','공유 라우터 (Gemini Flash)')`);

  // Team B 맴버 (LUNA, PICO, LUMI)
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','luna','Team B — 최종 합성자 (Claude Opus)')`);
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','pico','Team B — 영상 담당 (Claude Sonnet)')`);
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_B','lumi','Team B — 이미지 담당 (Gemini Flash)')`);
  
  // Team A 맴버 (OLLIE, LILY, NOVA)
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','ollie','Team A — 적대적 판관 (Claude Opus)')`);
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','lily', 'Team A — 영상 담당 (Claude Sonnet)')`);
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_A','nova', 'Team A — 이미지 담당 (Gemini Flash)')`);

  // ─── [v2.0] 독립
  db.run(`INSERT OR IGNORE INTO team_agents (team_id, agent_id, experiment_role) VALUES ('team_independent','ari','독립 판관 (GPT-4o 심사 보조)')`);

  // [Phase 18] Image Lab 전용 테이블
  db.run(`CREATE TABLE IF NOT EXISTS image_lab_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    ref_path TEXT,
    analysis_json TEXT,
    prompt TEXT,
    result_url TEXT,
    score_avg REAL,
    is_learned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ─── [Phase 27] Bugdog CS 리포트 테이블 ────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS cs_reports (
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
  )`);

  // ─── [Phase 30] 에이전트 프로필 테이블 (Prime 검수 A- 승인) ──────────────
  // - agents.json 이 SSOT → DB가 SSOT로 전환 (agents.json은 읽기 전용 시드 역할)
  // - bridge: 파일 브릿지 vs API 직접 라우팅 구분 (executor.js 라우팅 핵심)
  // - default_category: 텔레그램 자동 할당 카테고리 매핑
  // - role: agents.json의 role이 정본 (team_agents.experiment_role 우선 아님)
  db.run(`CREATE TABLE IF NOT EXISTS agent_profiles (
    id               TEXT PRIMARY KEY,
    nickname         TEXT,
    role             TEXT,
    model            TEXT,
    bridge           INTEGER NOT NULL DEFAULT 0,
    default_category TEXT,
    team_id          TEXT REFERENCES teams(id) ON DELETE SET NULL,
    project_id       TEXT REFERENCES projects(id) ON DELETE SET NULL,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // [Phase 30] agents.json → agent_profiles 시드 마이그레이션
  // INSERT OR IGNORE: 기존 레코드 보존, 최초 부팅 시에만 삽입
  // role 정본: agents.json (team_agents.experiment_role 아님 — Prime 검수 확정)
  // team_id 매핑: team_agents 테이블에서 JOIN으로 가져옴
  try {
    const _agentsRaw = readFileSync(path.resolve(__dirname, 'agents.json'), 'utf-8');
    const _agentsSeed = JSON.parse(_agentsRaw);
    _agentsSeed.forEach(a => {
      db.run(
        `INSERT OR IGNORE INTO agent_profiles (id, nickname, role, model, bridge, default_category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.nameKo || a.id,           // nickname 초기값: nameKo (한글 이름)
          a.role || null,
          a.antiModel || null,        // model 초기값: antiModel
          a.bridge ? 1 : 0,
          a.defaultCategory || null,
        ],
        (err) => { if (err) console.error(`[DB] agent_profiles 시드 실패 (${a.id}):`, err.message); }
      );
      // team_id 매핑: team_agents에서 이미 존재하는 레코드를 참조 (별도 UPDATE)
      db.run(
        `UPDATE agent_profiles
         SET team_id    = (SELECT team_id    FROM team_agents WHERE agent_id = ? LIMIT 1),
             project_id = (SELECT t.project_id FROM team_agents ta JOIN teams t ON t.id = ta.team_id WHERE ta.agent_id = ? LIMIT 1)
         WHERE id = ? AND team_id IS NULL`,
        [a.id, a.id, a.id],
        (err) => { if (err) console.error(`[DB] agent_profiles team_id 매핑 실패 (${a.id}):`, err.message); }
      );
    });
    console.log('[DB] Phase 30: agent_profiles 시드 완료');
  } catch (e) {
    console.warn('[DB] Phase 30: agents.json 시드 실패 —', e.message);
  }
});


class DatabaseManager {
  // ─── Task 생성 (risk_level 자동 태깅) ────────────────────────────────────
  // [Phase 14 W1] assignedAgent 파라미터 추가 — model과 에이전트 ID 완전 분리
  createTask(title, content, requester, model = 'Gemini-2.0-Flash', assignedAgent = null, category = 'QUICK_CHAT', projectId = 'proj-1') {
    const riskLevel = classifyRiskLevel(content || '');
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO Task (title, content, status, requester, model, risk_level, assigned_agent, category, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([title || '', content || '', 'PENDING', requester, model, riskLevel, assignedAgent, category, projectId], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      stmt.finalize();
    });
  }

  // ─── [Week 3: Memory 흡수] 전문 검색 (FTS5) ──────────────────────────
  async searchTasks(query, projectId = null) {
    try {
      let targetIds = null;
      if (projectId) {
        targetIds = await this.getAccessibleProjectIds(projectId);
      }
      return new Promise((resolve, reject) => {
        // FTS5 MATCH 구문 (빠른 텍스트 검색)
        const searchQuery = `"${query}"*`; // 접두어로 연관 검색 강화
        let sql = `SELECT T.id, T.content, T.status, T.created_at, T.assigned_agent, T.project_id 
                   FROM TaskFTS F
                   JOIN Task T ON F.id = T.id
                   WHERE TaskFTS MATCH ? AND T.deleted_at IS NULL`;
        const params = [searchQuery];
        
        if (targetIds && targetIds.length > 0) {
          sql += ` AND T.project_id IN (${targetIds.map(() => '?').join(',')})`;
          params.push(...targetIds);
        }
        
        sql += ` ORDER BY rank LIMIT 20`;

        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    } catch(err) {
      return Promise.reject(err);
    }
  }

  // ─── 프로젝트 조회 ──────────────────────────────────────────────────────────
  getAllProjects() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT id, name, objective, isolation_scope, status, created_at FROM projects WHERE status = 'active' ORDER BY created_at ASC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // ─── [Phase 28a] 프로젝트 생성 ──────────────────────────────────────────────
  createProject(id, name, objective, isolation_scope) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, name, objective, isolation_scope) VALUES (?, ?, ?, ?)`,
        [id, name, objective, isolation_scope || '{"type":"strict_isolation","shared_projects":[]}'],
        function(err) {
          if (err) reject(err);
          else resolve(id);
        }
      );
    });
  }

  // ─── [Phase 29] 동적 컨텍스트 참조를 위한 프로젝트 ID 배열 반환 헬퍼 ───
  getAccessibleProjectIds(projectId) {
    return new Promise((resolve, reject) => {
      if (!projectId) return resolve(null);
      
      db.get(`SELECT isolation_scope FROM projects WHERE id = ? AND status = 'active'`, [projectId], (err, row) => {
        if (err) return reject(err);
        if (!row || !row.isolation_scope) return resolve([projectId]);
        
        try {
          const scope = JSON.parse(row.isolation_scope);
          if (scope.type === 'strict_isolation') {
            resolve([projectId]);
          } else if (scope.type === 'cross_project_link') {
            const shared = Array.isArray(scope.shared_projects) ? scope.shared_projects : [];
            resolve([...new Set([projectId, ...shared])]);
          } else if (scope.type === 'global_knowledge') {
            db.all(`SELECT id, isolation_scope FROM projects WHERE status = 'active'`, (err, allProj) => {
              if (err) return reject(err);
              const globalIds = allProj.filter(p => {
                try {
                  const pScope = JSON.parse(p.isolation_scope);
                  return pScope.type === 'global_knowledge';
                } catch(e) { return false; }
              }).map(p => p.id);
              resolve([...new Set([projectId, ...globalIds])]);
            });
          } else {
            resolve([projectId]);
          }
        } catch(e) {
          console.error('[DB] Error parsing isolation_scope:', e);
          resolve([projectId]);
        }
      });
    });
  }

  // ─── [Phase 28b] Zero-Config 단일 트랜잭션 파이프라인 ──────────────────────
  createZeroConfigProject(id, name, objective, isolation_scope, crew, initialTasks) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const teamId = `team-${Date.now()}`;

        // 1. Project
        db.run(
          `INSERT INTO projects (id, name, objective, isolation_scope, status) VALUES (?, ?, ?, ?, ?)`,
          [id, name, objective, JSON.stringify(isolation_scope || {"type":"strict_isolation","shared_projects":[]}), 'active'],
          function(err) {
            if (err) return rollback(err);
          }
        );

        // 2. Team
        db.run(
          `INSERT INTO teams (id, project_id, name) VALUES (?, ?, ?)`,
          [teamId, id, `${name}팀`],
          function(err) {
            if (err) return rollback(err);
          }
        );

        // 3. Team Agents Insert (프로젝트 격리 페르소나 부여)
        const stmtAgent = db.prepare(`INSERT OR REPLACE INTO team_agents (team_id, agent_id, experiment_role) VALUES (?, ?, ?)`);
        for (const agent of crew) {
          const agentId = (agent.agent_id || agent.agent_name || 'unknown').toLowerCase();
          const roleDesc = agent.role_description || agent.role || '팀원';
          stmtAgent.run([teamId, agentId, roleDesc], function(err) {
            if (err) return rollback(err);
          });
        }
        stmtAgent.finalize();

        // 4. Tasks Insert
        const stmtTask = db.prepare(`
          INSERT INTO Task (id, title, content, status, project_id, requester, assigned_agent, model, execution_mode) 
          VALUES (?, ?, ?, 'PENDING', ?, 'CEO', ?, 'gemini-2.5-flash', 'ari')
        `);
        for (const task of initialTasks) {
          const taskId = Date.now().toString() + Math.floor(Math.random() * 1000);
          stmtTask.run([taskId, task.title, task.title, id, task.assignee?.toLowerCase() || 'ari'], function(err) {
            if (err) return rollback(err);
          });
        }
        stmtTask.finalize();

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          resolve({ projectId: id, teamId });
        });

        function rollback(error) {
          db.run('ROLLBACK', () => reject(error));
        }
      });
    });
  }

  // ─── [Phase 28a] 프로젝트 설정(범위) 수정 ─────────────────────────────────
  updateProject(id, name, objective, isolation_scope) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE projects SET name = ?, objective = ?, isolation_scope = ? WHERE id = ?`,
        [name, objective, isolation_scope, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── 프로젝트 삭제 (Soft Delete) ──────────────────────────────────────────
  deleteProject(id) {
    return new Promise((resolve, reject) => {
      db.run(`UPDATE projects SET status = 'deleted' WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  // ─── 프론트엔드 Hydration용: 전체 Task 목록 조회 (경량 DTO, latest_comment JOIN 제거) ───
  async getAllTasks(projectId = null) {
    try {
      let targetIds = null;
      if (projectId) {
        targetIds = await this.getAccessibleProjectIds(projectId);
      }
      return new Promise((resolve, reject) => {
        let query = `SELECT id, title, content, status, requester, model, assigned_agent, priority,
                  risk_level, execution_mode, has_artifact, artifact_url, failure_count,
                  created_at, updated_at, project_id
           FROM Task 
           WHERE deleted_at IS NULL`;
        const params = [];
        
        if (targetIds && targetIds.length > 0) {
          const placeholders = targetIds.map(() => '?').join(',');
          if (targetIds.includes('proj-1')) {
            query += ` AND (project_id IN (${placeholders}) OR project_id IS NULL OR project_id IN ('proj_default', 'global_mycrew'))`;
          } else {
            query += ` AND project_id IN (${placeholders})`;
          }
          params.push(...targetIds);
        }
        
        query += ` ORDER BY id DESC LIMIT 200`;
        
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            // 원본 프로젝트의 데이터를 우선적으로 정렬 (Phase 29 Truncation 사전 준비)
            if (projectId) {
              rows.sort((a, b) => {
                if (a.project_id === projectId && b.project_id !== projectId) return -1;
                if (a.project_id !== projectId && b.project_id === projectId) return 1;
                return 0; // 최신순은 이미 ORDER BY id DESC 로 적용됨
              });
            }
            resolve(rows || []);
          }
        });
      });
    } catch(err) {
      return Promise.reject(err);
    }
  }

  // ─── Task 단건 조회 — 핑퐁 규칙 등 단일 레코드 접근 시 사용 (W1 Fix) ──────
  getTaskById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, title, content, status, requester, model, assigned_agent, risk_level, execution_mode, created_at, updated_at, project_id
         FROM Task WHERE id = ? AND deleted_at IS NULL`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  // ─── 아카이브 목록 조회 ────────────────────────────────────────────────────
  async getArchivedTasks(projectId = null) {
    try {
      let targetIds = null;
      if (projectId) {
        targetIds = await this.getAccessibleProjectIds(projectId);
      }
      return new Promise((resolve, reject) => {
        let query = `SELECT id, title, content, status, requester, model, assigned_agent, priority,
                risk_level, execution_mode, has_artifact, artifact_url, created_at, updated_at, project_id
         FROM Task 
         WHERE status = 'ARCHIVED' AND deleted_at IS NULL`;
        const params = [];
        
        if (targetIds && targetIds.length > 0) {
          const placeholders = targetIds.map(() => '?').join(',');
          if (targetIds.includes('proj-1')) {
            query += ` AND (project_id IN (${placeholders}) OR project_id IS NULL OR project_id IN ('proj_default', 'global_mycrew'))`;
          } else {
            query += ` AND project_id IN (${placeholders})`;
          }
          params.push(...targetIds);
        }
        
        query += ` ORDER BY id DESC`;

        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            if (projectId && rows && rows.length > 0) {
              rows.sort((a, b) => {
                if (a.project_id === projectId && b.project_id !== projectId) return -1;
                if (a.project_id !== projectId && b.project_id === projectId) return 1;
                return 0;
              });
            }
            resolve(rows || []);
          }
        });
      });
    } catch(err) {
      return Promise.reject(err);
    }
  }

  // ─── Task 상태 업데이트 (updated_at 갱신 포함) ───────────────────────────
  updateTaskStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── [Phase 14] Task 모델 정보 업데이트 (실제 사용된 LLM 기록) ──────────────
  updateTaskModel(id, modelName, category = null) {
    return new Promise((resolve, reject) => {
      const sql = category 
        ? `UPDATE Task SET model = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        : `UPDATE Task SET model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      const params = category ? [modelName, category, id] : [modelName, id];
      
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  // ─── [S4-3] 실패 카운터 증가 + FAILED 상태 기록 ────────────────────────────
  incrementFailureCount(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task 
         SET failure_count = COALESCE(failure_count, 0) + 1,
             status = 'FAILED',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── Task 실행 모드(execution_mode) 단독 업데이트 ─────────────────────────
  updateTaskExecutionMode(id, executionMode) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task SET execution_mode = ? WHERE id = ?`,
        [executionMode, id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── Task 상세 정보 업데이트 (수동 편집용) ──────────────────────────────────
  updateTaskDetails(id, title, content, assignedAgent, model) {
    const riskLevel = classifyRiskLevel(content || '');
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task 
         SET title = ?, content = ?, assigned_agent = ?, model = ?, risk_level = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [title || '', content || '', assignedAgent, model, riskLevel, id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── 와치독용: 지연된 Task 조회 ──────────────────────────────────────────
  // staleMinutes: 마지막 업데이트로부터 경과 분 수 초과 시 반환
  getStaleTasks(staleMinutes = 5) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM Task
         WHERE LOWER(status) = 'in_progress'
           AND execution_mode != 'omo'
           AND deleted_at IS NULL
           AND updated_at < datetime('now', ? || ' minutes')`,
        [`-${staleMinutes}`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ─── PENDING Task 존재 여부 (Intent Mapping 오탐 방지용) ─────────────────
  getFirstPendingTask() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, content FROM Task WHERE status = 'PENDING' AND deleted_at IS NULL ORDER BY id ASC LIMIT 1`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // ─── Task 삭제 (Soft Delete: Prime W3 반영) ───────────────────────────
  deleteTask(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── [Artifact] has_artifact 플래그 + URL 업데이트 ──────────────────────────
  // AdapterWatcher가 completed JSON에서 artifactPath를 감지했을 때 호출
  updateHasArtifact(taskId, artifactUrl) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task SET has_artifact = 1, artifact_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [artifactUrl || '', taskId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── Task 댓글 추가 ───────────────────────────────────────────────────────
  createComment(taskId, author, content, metaData = null) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO TaskComment (task_id, author, content, meta_data) VALUES (?, ?, ?, ?)`
      );
      const metaString = metaData ? JSON.stringify(metaData) : null;
      stmt.run([taskId, author, content, metaString], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      stmt.finalize();
    });
  }

  // ─── 실시간 로그 추가 ─────────────────────────────────────────────────────
  insertLog(level, message, agentId, taskId, source, projectId = null) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO Log (level, message, agent_id, task_id, source, project_id) VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run([level, message, agentId, taskId, source, projectId], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      stmt.finalize();
    });
  }

  // ─── 최근 24시간 활동 요약 데이터 조회 (일간 보고용) ──────────────────────
  getDailyActivities() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT level, message, agent_id, task_id, source, created_at 
         FROM Log 
         WHERE created_at >= datetime('now', '-24 hours') 
         ORDER BY created_at ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ─── [Phase 22.6] meta_data → thought_process 파싱 헬퍼 (DRY) ────────────────
  // getComments, getCommentsWithTopology, getRecentGlobalComments 공통 사용
  _parseMetaRow(row) {
    let thoughtProcess = null;
    if (row.meta_data) {
      try { thoughtProcess = JSON.parse(row.meta_data); } catch (e) {}
    }
    const createdAt = row.created_at
      ? (row.created_at.endsWith('Z') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z')
      : new Date().toISOString();
    return { ...row, thought_process: thoughtProcess, created_at: createdAt };
  }

  // ─── Task 글로벌 최근 댓글 조회 (Phase 22.6) ──────────────────────────────────
  async getRecentGlobalComments(limit = 100, projectId = null) {
    try {
      let targetIds = null;
      if (projectId) {
        targetIds = await this.getAccessibleProjectIds(projectId);
      }
      return new Promise((resolve, reject) => {
        let query = `SELECT c.task_id, c.author, c.content, c.meta_data, c.created_at, t.project_id 
                     FROM TaskComment c`;
        const params = [];
        
        if (targetIds && targetIds.length > 0) {
          const placeholders = targetIds.map(() => '?').join(',');
          if (targetIds.includes('proj-1')) {
            query += ` JOIN Task t ON c.task_id = t.id WHERE (t.project_id IN (${placeholders}) OR t.project_id IS NULL OR t.project_id IN ('proj_default', 'global_mycrew'))`;
          } else {
            query += ` JOIN Task t ON c.task_id = t.id WHERE t.project_id IN (${placeholders})`;
          }
          params.push(...targetIds);
        } else if (projectId) { // targetIds가 없는데 projectId가 있는 특이 케이스(방어코드)
          query += ` JOIN Task t ON c.task_id = t.id WHERE t.project_id = ?`;
          params.push(projectId);
        } else {
          // projectId가 null이면 전체 조회를 위해 LEFT JOIN
          query += ` LEFT JOIN Task t ON c.task_id = t.id`;
        }
        
        query += ` ORDER BY c.created_at DESC LIMIT ?`;
        params.push(limit);
        
        db.all(query, params, (err, rows) => {
          if (err) return reject(err);
          // [Phase 29] 원본 프로젝트의 데이터를 우선적으로 정렬할 필요가 있다면 여기서 추가 가능
          const result = (rows || []).reverse().map(row => {
            const parsed = this._parseMetaRow(row);
            return {
              taskId: parsed.task_id,
              author: parsed.author,
              content: parsed.content,
              thought_process: parsed.thought_process,
              created_at: parsed.created_at,
              is_reference: projectId ? row.project_id !== projectId : false
            };
          });
          resolve(result);
        });
      });
    } catch(err) {
      return Promise.reject(err);
    }
  }

  // ─── Task 댓글 조회 ───────────────────────────────────────────────────────
  // [S1-1 Fix] meta_data → thought_process 파싱 추가 (Phase 22.6)
  // 기존: rows 원시 반환 → REST 초기 로드 시 thought_process 누락
  // 수정: _parseMetaRow 헬퍼 적용하여 소켓·REST 일관된 구조 보장
  getComments(taskId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, author, content, meta_data, created_at FROM TaskComment WHERE task_id = ? ORDER BY created_at ASC`,
        [taskId],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(row => this._parseMetaRow(row)));
        }
      );
    });
  }

  // ─── 사용자 설정 단일 읽기 ──────────────────────────────────────────────────
  getSetting(key) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT value FROM user_settings WHERE key = ?`, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  }

  // ─── 사용자 설정 전체 읽기 ──────────────────────────────────────────────────
  getAllSettings() {
    return new Promise((resolve, reject) => {

      db.all(`SELECT key, value FROM user_settings`, (err, rows) => {
        if (err) reject(err);
        else {
          const settings = {};
          (rows || []).forEach((r) => { settings[r.key] = r.value; });
          resolve(settings);
        }
      });
    });
  }

  // ─── 사용자 설정 저장 ─────────────────────────────────────────────────────
  setSetting(key, value) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)`,
        [key, String(value)],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── 칸반 칼럼 정의 조회 (확장 가능한 SSOT) ────────────────────────────────
  /**
   * user_settings['kanban_columns']에서 칼럼 정의를 읽어옵니다.
   * 사용자가 컬럼을 추가/변경하면 이 메서드가 자동으로 최신 정의를 반환합니다.
   *
   * @returns {Promise<Array<{status, label, column, aliases}>>}
   *   - status  : DB 저장값 (e.g. 'COMPLETED')
   *   - label   : 표시명 (e.g. 'Done')
   *   - column  : 프론트엔드 칼럼 키 (e.g. 'done')
   *   - aliases : Ari가 사용할 수 있는 대체 이름 목록
   */
  async getKanbanColumns() {
    // 폴백 기본값 (DB 설정 없거나 파싱 실패 시)
    const DEFAULT_COLUMNS = [
      { status: 'PENDING',     label: 'To Do',      column: 'todo',        aliases: ['TODO', 'todo', 'PENDING', '대기', '할일'] },
      { status: 'IN_PROGRESS', label: 'In Progress', column: 'in_progress', aliases: ['in_progress', '진행중', '진행'] },
      { status: 'REVIEW',      label: 'Review',      column: 'review',      aliases: ['검토', '검토대기', '리뷰'] },
      { status: 'COMPLETED',   label: 'Done',        column: 'done',        aliases: ['DONE', 'done', '완료', '완성'] },
      { status: 'FAILED',      label: 'Failed',      column: 'failed',      aliases: ['실패', '오류'] },
      { status: 'ARCHIVED',    label: 'Archived',    column: 'archive',     aliases: ['archive', 'ARCHIVED', '아카이브', '보관'] },
    ];

    try {
      const raw = await this.getSetting('kanban_columns');
      if (!raw) return DEFAULT_COLUMNS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COLUMNS;
      return parsed;
    } catch (e) {
      console.warn('[DB] getKanbanColumns 파싱 실패, 기본값 사용:', e.message);
      return DEFAULT_COLUMNS;
    }
  }

  // ─── [Phase 17-4] AgentSkill 관리 ──────────────────────────────────────────
  getAgentSkills(agentId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT skill_id, is_active FROM AgentSkill WHERE agent_id = ?`,
        [agentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  toggleAgentSkill(agentId, skillId, isActive) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO AgentSkill (agent_id, skill_id, is_active, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(agent_id, skill_id) 
         DO UPDATE SET is_active = excluded.is_active, updated_at = CURRENT_TIMESTAMP`,
        [agentId, skillId, isActive ? 1 : 0],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── [Phase 30] agent_profiles CRUD ──────────────────────────────────────

  /** 전체 에이전트 프로필 조회 (executor.js 부팅 시 사용) */
  getAllAgentProfiles() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, nickname, role, model, bridge, default_category, team_id, project_id, updated_at
         FROM agent_profiles ORDER BY id ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows || []).map(r => ({ ...r, bridge: !!r.bridge })));
        }
      );
    });
  }

  /** 단건 에이전트 프로필 조회 */
  getAgentProfile(agentId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, nickname, role, model, bridge, default_category, team_id, project_id, updated_at
         FROM agent_profiles WHERE id = ?`,
        [agentId.toLowerCase()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? { ...row, bridge: !!row.bridge } : null);
        }
      );
    });
  }

  /** 에이전트 모델 업데이트 (프로필 페이지 변경 시 호출) */
  upsertAgentModel(agentId, model) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO agent_profiles (id, model, bridge, updated_at)
         VALUES (?, ?, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET model = excluded.model, updated_at = CURRENT_TIMESTAMP`,
        [agentId.toLowerCase(), model],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  /** 에이전트 프로필 부분 업데이트 (nickname, role, model 등) */
  updateAgentProfile(agentId, updates = {}) {
    const allowed = ['nickname', 'role', 'model', 'default_category', 'team_id', 'project_id'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) return Promise.resolve(0);
    const sql = `UPDATE agent_profiles SET ${fields.map(f => `${f} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const params = [...fields.map(f => updates[f]), agentId.toLowerCase()];
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  // ─── [v2.0] 칸반 보드 전용 경량 DTO (콘텐츠 미포함) ───────────────────
  async getAllTasksLight(projectId = null) {
    try {
      let targetIds = null;
      if (projectId) {
        targetIds = await this.getAccessibleProjectIds(projectId);
      }
      return new Promise((resolve, reject) => {
        let query = `SELECT id, title, content, status, assigned_agent, priority, risk_level,
                has_artifact, created_at, updated_at, project_id
         FROM Task
         WHERE deleted_at IS NULL
           AND (status IS NULL OR status != 'ARCHIVED')`;
        const params = [];
        
        if (targetIds && targetIds.length > 0) {
          const placeholders = targetIds.map(() => '?').join(',');
          query += ` AND project_id IN (${placeholders})`;
          params.push(...targetIds);
        }
        
        query += ` ORDER BY id DESC LIMIT 200`;
        
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            if (projectId && rows && rows.length > 0) {
              rows.sort((a, b) => {
                if (a.project_id === projectId && b.project_id !== projectId) return -1;
                if (a.project_id !== projectId && b.project_id === projectId) return 1;
                return 0;
              });
            }
            resolve(rows || []);
          }
        });
      });
    } catch(err) {
      return Promise.reject(err);
    }
  }

  // ─── [v2.0] Task 단건 전체 조회 (TaskDetailModal lazy-load용) ─────────────
  getTaskByIdFull(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, title, content, status, requester, model, assigned_agent, priority,
                risk_level, execution_mode, has_artifact, created_at, updated_at
         FROM Task WHERE id = ? AND deleted_at IS NULL`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  // ─── [v2.0] 조직도 벤크 조회 (teams + agents 중첩 JSON) ─────────────────
  getRoster() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.id as team_id, t.name as team_name, t.group_type, t.icon, t.color,
                p.id as project_id, p.name as project_name,
                ta.agent_id, ta.experiment_role
         FROM teams t
         LEFT JOIN projects p ON t.project_id = p.id
         LEFT JOIN team_agents ta ON t.id = ta.team_id
         ORDER BY t.id, ta.agent_id`,
        (err, rows) => {
          if (err) return reject(err);
          const teamMap = new Map();
          for (const row of (rows || [])) {
            if (!teamMap.has(row.team_id)) {
              teamMap.set(row.team_id, {
                id: row.team_id, name: row.team_name,
                groupType: row.group_type, icon: row.icon, color: row.color,
                project: row.project_id ? { id: row.project_id, name: row.project_name } : null,
                agents: [],
              });
            }
            if (row.agent_id) {
              teamMap.get(row.team_id).agents.push({
                id: row.agent_id, experimentRole: row.experiment_role,
              });
            }
          }
          const all = [...teamMap.values()];
          const independent = all.find(t => t.id === 'team_independent');
          const regularTeams = all.filter(t => t.id !== 'team_independent');
          resolve({
            teams: regularTeams,
            independentAgents: independent ? independent.agents : [],
          });
        }
      );
    });
  }

  // ─── [v2.0] 팀 생성 (+ 선택적 신규 프로젝트 생성) ────────────────────
  createTeam({ id, name, groupType, icon = '🟡', color = '#b4c5ff', projectId, newProjectName }) {
    return new Promise((resolve, reject) => {
      const teamId = id || `team_${Date.now()}`;
      const insert = (pid) => {
        db.run(
          `INSERT INTO teams (id, project_id, name, group_type, icon, color) VALUES (?,?,?,?,?,?)`,
          [teamId, pid, name, groupType || '협력적', icon, color],
          function(err) {
            if (err) reject(err);
            else resolve({ teamId, projectId: pid });
          }
        );
      };
      if (newProjectName) {
        const newPid = `proj_${Date.now()}`;
        db.run(`INSERT INTO projects (id, name) VALUES (?,?)`, [newPid, newProjectName], (err) => {
          if (err) reject(err); else insert(newPid);
        });
      } else {
        insert(projectId || null);
      }
    });
  }

  // ─── [v2.1] Comment 위상(지시 흐름) 구조 조회 ──────────────────────────
  // [v2.1 개선] requester 파라미터 추가: 크루 보고 대상을 CEO/ARI(위임) 동적 결정
  // [S2-1] 동적 AGENT_IDS 사용
  getCommentsWithTopology(taskId, assignedAgent, requester = 'CEO') {
    // 알려진 인간 작성자 패턴 (에이전트 아닌 모든 것)
    const makeNode = (name) => {
      const lower = name?.toLowerCase() || '';
      const isA = AGENT_IDS.has(lower);
      return isA
        ? { id: `agent-${lower}`, name }
        : { id: 'user-1', name: name || 'CEO' };
    };
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, author, content, meta_data, created_at FROM TaskComment WHERE task_id = ? ORDER BY created_at ASC`,
        [taskId],
        (err, rows) => {
          if (err) return reject(err);
          const allRows = rows || [];
          const result = allRows.map((row, idx) => {
            const isAgent = AGENT_IDS.has(row.author?.toLowerCase());
            // target 결정 원칙 (v2.2):
            // - CEO/비에이전트 댓글 → 항상 현재 assignedAgent에게 지시
            //   (assignee 변경 후 댓글 시 이미 task.assigned_agent가 새 값으로 업데이트됨)
            // - 에이전트 댓글 → 항상 requester(CEO 또는 ARI(위임))에게 보고
            const targetName = isAgent ? requester : (assignedAgent || 'ARI');

            // [S1-1] _parseMetaRow 헬퍼 통일 적용
            const parsed = this._parseMetaRow(row);

            return {
              step:        idx + 1,
              source:      makeNode(row.author),
              target:      makeNode(targetName),
              action_type: isAgent ? 'RESPONSE' : 'ORDER',
              content:     row.content,
              thought_process: parsed.thought_process,
              created_at: parsed.created_at,
            };
          });
          resolve(result);
        }
      );
    });
  }  // ← getCommentsWithTopology 종료

  // ─── [v3.2] 팀 멤버 목록 조회 ──────────────────────────
  getTeamAgents(teamId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT agent_id, experiment_role FROM team_agents WHERE team_id = ?`,
        [teamId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
  }

  // ─── [Phase 18] Image Lab 세션 관리 ──────────────────────────
  createImageLabSession({ sessionId, refPath, analysisJson }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO image_lab_sessions (session_id, ref_path, analysis_json) VALUES (?, ?, ?)`,
        [sessionId, refPath, analysisJson],
        err => err ? reject(err) : resolve()
      );
    });
  }

  updateImageLabSession(sessionId, { prompt, resultUrl }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE image_lab_sessions SET prompt = ?, result_url = ? WHERE session_id = ?`,
        [prompt, resultUrl, sessionId],
        err => err ? reject(err) : resolve()
      );
    });
  }

  finalizeImageLabSession(sessionId, { scoreAvg }) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE image_lab_sessions SET score_avg = ?, is_learned = 1 WHERE session_id = ?`,
        [scoreAvg, sessionId],
        err => err ? reject(err) : resolve()
      );
    });
  }

  // ─── [Phase 4] CKS 연구 지표 수집 연동 ──────────────────────────
  saveCksMetrics(metrics) {
    const { task_id, team_type, tei_tokens, ksi_r_score, ksi_s_score, her_count, eii_score, irc_count, uxs_rating } = metrics;
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO CksMetrics 
         (task_id, team_type, tei_tokens, ksi_r_score, ksi_s_score, her_count, eii_score, irc_count, uxs_rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [task_id, team_type, tei_tokens || 0, ksi_r_score || 0, ksi_s_score || 0.0, her_count || 0, eii_score || 0.0, irc_count || 0, uxs_rating || 0],
        err => err ? reject(err) : resolve()
      );
    });
  }

  getCksMetricsStats() {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          AVG(tei_tokens) as avg_tei,
          AVG(ksi_r_score) as avg_ksi_r,
          AVG(ksi_s_score) as avg_ksi_s,
          AVG(her_count) as avg_her,
          AVG(eii_score) as avg_eii,
          AVG(irc_count) as avg_irc,
          AVG(uxs_rating) as avg_uxs,
          COUNT(task_id) as total_samples
         FROM CksMetrics`,
        (err, row) => err ? reject(err) : resolve(row || {})
      );
    });
  }

  _getTeamType(agentId) {
    if (!agentId) return null;
    const a = agentId.toLowerCase();
    if (['nova', 'lily', 'ollie'].includes(a)) return 'team_A';
    if (['lumi', 'pico', 'luna'].includes(a)) return 'team_B';
    return 'independent';
  }

  incrementCksIrc(taskId) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO CksMetrics (task_id, irc_count) VALUES (?, 1)
         ON CONFLICT(task_id) DO UPDATE SET irc_count = irc_count + 1, updated_at = CURRENT_TIMESTAMP`,
        [taskId],
        err => err ? reject(err) : resolve()
      );
    });
  }

  accumulateCksTokens(taskId, tokens, agentId) {
    const safeTokens = Math.max(0, parseInt(tokens) || 0);
    const teamType = this._getTeamType(agentId);
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO CksMetrics (task_id, team_type, tei_tokens) VALUES (?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET tei_tokens = tei_tokens + ?, team_type = COALESCE(team_type, ?), updated_at = CURRENT_TIMESTAMP`,
        [taskId, teamType, safeTokens, safeTokens, teamType],
        err => err ? reject(err) : resolve()
      );
    });
  }

  updateCksEvalMetrics(taskId, meta, agentId) {
    const ksi_r = Math.max(0, parseInt(meta.ksi_r) || 0);
    const ksi_s = Math.max(0, parseFloat(meta.ksi_s) || 0.0);
    const her = Math.max(0, parseInt(meta.her) || 0);
    const eii = Math.max(0, parseFloat(meta.eii) || 0.0);
    const teamType = this._getTeamType(agentId);

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO CksMetrics (task_id, team_type, ksi_r_score, ksi_s_score, her_count, eii_score)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET 
           team_type = COALESCE(team_type, ?),
           ksi_r_score = ?,
           ksi_s_score = ?,
           her_count = ?,
           eii_score = ?,
           updated_at = CURRENT_TIMESTAMP`,
        [
          taskId, teamType, ksi_r, ksi_s, her, eii,
          teamType, ksi_r, ksi_s, her, eii
        ],
        err => err ? reject(err) : resolve()
      );
    });
  }

  // ─── [Phase 27] Bugdog CS 리포트 CRUD ────────────────────────────────────
  createCsReport({ reportNo, severity, service, affectedService, errorCode, errorMsg, stackTrace, reporter = 'bugdog' }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO cs_reports (report_no, severity, service, affected_service, error_code, error_msg, stack_trace, reporter)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportNo, severity, service, affectedService || null, errorCode || null, errorMsg || null, stackTrace || null, reporter],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getCsReports({ status, limit = 50 } = {}) {
    return new Promise((resolve, reject) => {
      const where = status ? `WHERE status = ?` : '';
      const params = status ? [status] : [];
      db.all(
        `SELECT * FROM cs_reports ${where} ORDER BY created_at DESC LIMIT ?`,
        [...params, limit],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });
  }

  updateCsReportStatus(id, status) {
    return new Promise((resolve, reject) => {
      // P1 수정(Prime): SQL 문자열 조합 제거 → 케이스별 명확한 SQL 분리
      const sql = status === 'RESOLVED'
        ? `UPDATE cs_reports SET status = ?, resolved_at = datetime('now') WHERE id = ?`
        : `UPDATE cs_reports SET status = ?, resolved_at = NULL WHERE id = ?`;
      db.run(sql, [status, id], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
  // ─── [Phase 31] 프로젝트에 할당된 전체 팀 크루 조회 ──────────────────────
  getProjectCrew(projectId) {
    return new Promise((resolve, reject) => {
      if (!projectId) return resolve([]);
      db.all(
        `SELECT ta.agent_id, ta.experiment_role, ta.nickname, t.name as team_name
         FROM team_agents ta
         JOIN teams t ON t.id = ta.team_id
         WHERE t.project_id = ?`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // 팀원 닉네임 설정 (PATCH /api/projects/:id/crew/:agentId/nickname)
  setCrewNickname(projectId, agentId, nickname) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE team_agents
         SET nickname = ?
         WHERE agent_id = ?
           AND team_id = (SELECT id FROM teams WHERE project_id = ? LIMIT 1)`,
        [nickname || null, agentId, projectId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // ─── [Phase 30] 프로젝트별 에이전트 페르소나 (역할) 조회 ──────────────────
  getAgentRoleInProject(agentId, projectId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT ta.experiment_role 
         FROM team_agents ta
         JOIN teams t ON t.id = ta.team_id
         WHERE ta.agent_id = ? AND t.project_id = ?
         LIMIT 1`,
        [agentId.toLowerCase(), projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.experiment_role : null);
        }
      );
    });
  }
}

export default new DatabaseManager();
