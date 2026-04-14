import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const sqlite3Verbose = sqlite3.verbose();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // [Phase 17-4 Opus 보완] MVP 클린업: 브라우저 초기화 시 사라지는 프론트 전용 임시 에이전트들의 고아 레코드 원천 삭제
  const KNOWN_AGENTS = ['ari', 'nova', 'lumi', 'pico', 'ollie'];
  const placeholders = KNOWN_AGENTS.map(() => '?').join(',');
  db.run(
    `DELETE FROM AgentSkill WHERE agent_id NOT IN (${placeholders})`,
    KNOWN_AGENTS,
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
});

class DatabaseManager {
  // ─── Task 생성 (risk_level 자동 태깅) ────────────────────────────────────
  // [Phase 14 W1] assignedAgent 파라미터 추가 — model과 에이전트 ID 완전 분리
  createTask(content, requester, model = 'Gemini-2.5-Flash', assignedAgent = null) {
    const riskLevel = classifyRiskLevel(content);
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO Task (content, status, requester, model, risk_level, assigned_agent) VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run([content, 'PENDING', requester, model, riskLevel, assignedAgent], function (err) {
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

  // ─── 프론트엔드 Hydration용: 전체 Task 목록 조회 ─────────────────────────
  getAllTasks() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, content, status, requester, model, assigned_agent, risk_level, execution_mode, created_at, updated_at,
          (SELECT content FROM TaskComment WHERE task_id = Task.id ORDER BY created_at DESC LIMIT 1) as latest_comment
         FROM Task 
         WHERE deleted_at IS NULL
         ORDER BY id DESC LIMIT 200`,
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
        `SELECT id, content, status, requester, model, assigned_agent, risk_level, execution_mode, created_at, updated_at
         FROM Task WHERE id = ? AND deleted_at IS NULL`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
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
  updateTaskModel(id, modelName) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE Task SET model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [modelName, id],
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

  // ─── 와치독용: 지연된 Task 조회 ──────────────────────────────────────────
  // staleMinutes: 마지막 업데이트로부터 경과 분 수 초과 시 반환
  getStaleTasks(staleMinutes = 5) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM Task
         WHERE status = 'in_progress'
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

  // ─── Task 댓글 추가 ───────────────────────────────────────────────────────
  createComment(taskId, author, content) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO TaskComment (task_id, author, content) VALUES (?, ?, ?)`
      );
      stmt.run([taskId, author, content], function (err) {
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

  // ─── Task 댓글 조회 ───────────────────────────────────────────────────────
  getComments(taskId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id, author, content, created_at FROM TaskComment WHERE task_id = ? ORDER BY created_at ASC`,
        [taskId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // ─── 사용자 설정 읽기 ─────────────────────────────────────────────────────

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
}

export default new DatabaseManager();
