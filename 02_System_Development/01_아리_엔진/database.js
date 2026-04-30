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
    // [Phase 29] 프로젝트 격리용 식별자
    if (!names.includes('project_id')) {
      db.run(`ALTER TABLE Task ADD COLUMN project_id TEXT DEFAULT 'proj_default'`);
      console.log('[DB] Phase 29 마이그레이션: Task.project_id 컬럼 추가 완료');
    }
  });

  db.all("PRAGMA table_info(TaskComment)", (err, rows) => {
    if (err) return;
    const names = rows.map((r) => r.name);
    if (!names.includes('meta_data')) {
      db.run(`ALTER TABLE TaskComment ADD COLUMN meta_data TEXT DEFAULT NULL`);
      console.log('[DB] Phase 22.6 마이그레이션: TaskComment meta_data 컬럼 추가 완료');
    }
    // [Phase 29] 프로젝트 격리용 식별자
    if (!names.includes('project_id')) {
      db.run(`ALTER TABLE TaskComment ADD COLUMN project_id TEXT DEFAULT 'proj_default'`);
      console.log('[DB] Phase 29 마이그레이션: TaskComment.project_id 컬럼 추가 완료');
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

  // [Phase 29] Log 테이블 프로젝트 격리 마이그레이션
  db.all(`PRAGMA table_info(Log)`, (err, cols) => {
    if (err) return;
    const names = (cols || []).map(c => c.name);
    if (!names.includes('project_id')) {
      db.run(`ALTER TABLE Log ADD COLUMN project_id TEXT DEFAULT 'proj_default'`);
      console.log('[DB] Phase 29 마이그레이션: Log.project_id 컬럼 추가 완료');
    }
  });

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

  // ─── [v2.0] 콜럼 마이그레이션: priority + has_artifact 신설 ──────────────────
  db.all(`PRAGMA table_info(Task)`, (err, cols) => {
    if (err) return;
    const names = (cols || []).map(c => c.name);
    if (!names.includes('priority'))     db.run(`ALTER TABLE Task ADD COLUMN priority TEXT DEFAULT 'medium'`);
    if (!names.includes('has_artifact')) db.run(`ALTER TABLE Task ADD COLUMN has_artifact INTEGER DEFAULT 0`);
    if (!names.includes('artifact_url')) db.run(`ALTER TABLE Task ADD COLUMN artifact_url TEXT DEFAULT NULL`);
  });

  // ─── [v2.0 & Phase 29] Multi-Team 아키텍스쳐: projects / teams / team_agents 테이블 ────────
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    isolation_level TEXT DEFAULT 'GLOBAL',
    status          TEXT DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // [Phase 29] 기존 projects 테이블 마이그레이션
  db.all(`PRAGMA table_info(projects)`, (err, cols) => {
    if (err) return;
    const names = (cols || []).map(c => c.name);
    if (!names.includes('description'))     db.run(`ALTER TABLE projects ADD COLUMN description TEXT DEFAULT ''`);
    if (!names.includes('isolation_level')) db.run(`ALTER TABLE projects ADD COLUMN isolation_level TEXT DEFAULT 'GLOBAL'`);
    if (!names.includes('updated_at'))      db.run(`ALTER TABLE projects ADD COLUMN updated_at DATETIME`);
  });

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id),
    name        TEXT NOT NULL,
    group_type  TEXT,
    icon        TEXT,
    color       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS team_agents (
    team_id         TEXT REFERENCES teams(id),
    agent_id        TEXT NOT NULL,
    experiment_role TEXT,
    PRIMARY KEY (team_id, agent_id)
  )`);

  // ─── [v2.0] 시더(종자) 데이터 ──────────────────────────────────────────
  db.run(`INSERT OR IGNORE INTO projects (id, name, description, isolation_level) VALUES ('proj_default', '기본 워크스페이스', '마이크루 기본 전역 워크스페이스입니다.', 'GLOBAL')`);
  db.run(`INSERT OR IGNORE INTO projects (id, name) VALUES ('sosiann_cks',   '소시안 CKS 실험')`);
  db.run(`INSERT OR IGNORE INTO projects (id, name) VALUES ('sosiann_planC', '소시안 Plan C 캠페인')`);

  db.run(`INSERT OR IGNORE INTO teams (id, project_id, name, group_type, icon, color)
    VALUES ('team_B', 'sosiann_planC', 'Team B — 협력적 CKS', '협력적 CKS', '🟢', '#4ade80')`);
  db.run(`INSERT OR IGNORE INTO teams (id, project_id, name, group_type, icon, color)
    VALUES ('team_A', 'sosiann_cks',   'Team A — 적대적 대조군', '적대적', '⛔', '#ffb963')`);
  db.run(`INSERT OR IGNORE INTO teams (id, project_id, name, group_type, icon, color)
    VALUES ('team_independent', NULL, '독립 심사관', '독립', '⚖️', '#b4c5ff')`);

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
});

class DatabaseManager {
  // ─── Task 생성 (risk_level 자동 태깅) ────────────────────────────────────
  // [Phase 14 W1] assignedAgent 파라미터 추가 — model과 에이전트 ID 완전 분리
  createTask(title, content, requester, model = 'Gemini-2.0-Flash', assignedAgent = null, category = 'QUICK_CHAT', projectId = 'proj_default') {
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
  searchTasks(query) {
    return new Promise((resolve, reject) => {
      // FTS5 MATCH 구문 (빠른 텍스트 검색)
      const searchQuery = `"${query}"*`; // 접두어로 연관 검색 강화
      db.all(
        `SELECT T.id, T.content, T.status, T.created_at, T.assigned_agent 
         FROM TaskFTS F
         JOIN Task T ON F.id = T.id
         WHERE TaskFTS MATCH ? AND T.deleted_at IS NULL
         ORDER BY rank
         LIMIT 20`,
        [searchQuery],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ─── 프론트엔드 Hydration용: 전체 Task 목록 조회 (경량 DTO, latest_comment JOIN 제거) ───
  getAllTasks(projectId = 'proj_default') {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, title, content, status, requester, model, assigned_agent, priority,
                risk_level, execution_mode, has_artifact, artifact_url, failure_count,
                created_at, updated_at, project_id
         FROM Task 
         WHERE deleted_at IS NULL AND project_id = ?
         ORDER BY id DESC LIMIT 200`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ─── Task 단건 조회 — 핑퐁 규칙 등 단일 레코드 접근 시 사용 (W1 Fix) ──────
  getTaskById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, title, content, status, requester, model, assigned_agent, risk_level, execution_mode, created_at, updated_at
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
  getArchivedTasks(projectId = 'proj_default') {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, title, content, status, requester, model, assigned_agent, priority,
                risk_level, execution_mode, has_artifact, artifact_url, created_at, updated_at
         FROM Task 
         WHERE status = 'ARCHIVED' AND deleted_at IS NULL AND project_id = ?
         ORDER BY id DESC`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
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

  // ─── [Phase 29] 모든 프로젝트 목록 조회 ──────────────────────────────
  getProjects() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT id, name, description, isolation_level FROM projects`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
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
        `SELECT id, content FROM Task WHERE status = 'PENDING' ORDER BY id ASC LIMIT 1`,
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
  insertLog(level, message, agentId, taskId, source) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO Log (level, message, agent_id, task_id, source) VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run([level, message, agentId, taskId, source], function (err) {
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
  getRecentGlobalComments(limit = 100, projectId = 'proj_default') {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT task_id, author, content, meta_data, created_at FROM TaskComment WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`,
        [projectId, limit],
        (err, rows) => {
          if (err) return reject(err);
          // [S1-1] _parseMetaRow 헬퍼로 통일
          const result = (rows || []).reverse().map(row => {
            const parsed = this._parseMetaRow(row);
            return {
              taskId: parsed.task_id,
              author: parsed.author,
              content: parsed.content,
              thought_process: parsed.thought_process,
              created_at: parsed.created_at,
            };
          });
          resolve(result);
        }
      );
    });
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

  // ─── [v2.0] 칸반 보드 전용 경량 DTO (콘텐츠 미포함) ───────────────────
  getAllTasksLight() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, title, content, status, assigned_agent, priority, risk_level,
                has_artifact, created_at, updated_at
         FROM Task
         WHERE deleted_at IS NULL
           AND (status IS NULL OR status != 'ARCHIVED')
         ORDER BY id DESC LIMIT 200`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
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
}

export default new DatabaseManager();
