# [리뷰 요청] Phase 27 Bugdog v0 — 코드 리뷰 요청서

**작성자**: Sonnet (AI 개발자)  
**요청 대상**: Prime (Supreme Advisor / Claude Opus)  
**작성일**: 2026-04-27  
**리뷰 유형**: 보안·아키텍처·안정성 교차 검증

---

## 1. 작업 개요

Phase 27 Bugdog v0 — "감시만 하는 파수견"을 구현했습니다.  
PRD의 즉시 구현 가능 범위를 완료했으며, 다음 3개 파일을 수정/신규 작성했습니다.

| 파일 | 변경 유형 | 핵심 내용 |
|---|---|---|
| `database.js` | 수정 | `cs_reports` 테이블 DDL + CRUD 메서드 3개 추가 |
| `server.js` | 수정 | `POST/GET/PATCH /api/cs-reports` 3개 엔드포인트 추가 |
| `bugdogRunner.js` | 신규 | 독립 프로세스 — 7개 헬스체크 + ErrorLog JSON 저장 + CS 리포트 자동 접수 |

---

## 2. 핵심 코드 전문

### 2-1. database.js — cs_reports 테이블 DDL

```sql
CREATE TABLE IF NOT EXISTS cs_reports (
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
);
```

### 2-2. database.js — CRUD 메서드

```javascript
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
    const resolvedAt = status === 'RESOLVED' ? `datetime('now')` : 'NULL';
    db.run(
      `UPDATE cs_reports SET status = ?, resolved_at = ${resolvedAt === 'NULL' ? 'NULL' : resolvedAt} WHERE id = ?`,
      status === 'RESOLVED' ? [status, id] : [status, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}
```

### 2-3. server.js — CS 리포트 API 3개

```javascript
// POST /api/cs-reports
app.post('/api/cs-reports', async (req, res) => {
  try {
    const { reportNo, severity, service, affectedService, errorCode, errorMsg, stackTrace, reporter } = req.body;
    if (!severity || !service) return res.status(400).json({ status: 'error', message: 'severity, service 필수' });
    const rno = reportNo || `CS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const id = await dbManager.createCsReport({ reportNo: rno, severity, service, affectedService, errorCode, errorMsg, stackTrace, reporter });
    console.log(`[Bugdog] CS 리포트 저장 — #${rno} (${severity}) ${service}`);
    io.emit('bugdog:report_created', { id, reportNo: rno, severity, service, status: 'OPEN' });
    res.json({ status: 'ok', id, reportNo: rno });
  } catch (err) {
    console.error('[API] POST /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/cs-reports
app.get('/api/cs-reports', async (req, res) => {
  try {
    const { status, limit } = req.query;
    const reports = await dbManager.getCsReports({ status, limit: limit ? parseInt(limit) : 50 });
    res.json({ status: 'ok', count: reports.length, reports });
  } catch (err) {
    console.error('[API] GET /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PATCH /api/cs-reports/:id/status
app.patch('/api/cs-reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ status: 'error', message: '유효하지 않은 status 값' });
    }
    const changes = await dbManager.updateCsReportStatus(id, status);
    io.emit('bugdog:report_updated', { id: parseInt(id), status });
    res.json({ status: 'ok', changes });
  } catch (err) {
    console.error('[API] PATCH /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});
```

### 2-4. bugdogRunner.js — 독립 프로세스 (전문)

```javascript
// 7개 헬스체크 핵심 로직 요약

// [1] 소켓 서버 — HTTP GET 응답 확인
async function checkSocketServer() {
  const r = await httpGet(`${SERVER_URL}/health`, 4000);
  if (!r.ok && r.status === 0)
    return { service: '소켓 서버', severity: 'CRITICAL', errorCode: 'SRV_DOWN', errorMsg: r.error };
  return { service: '소켓 서버', severity: 'OK', latency: r.latency };
}

// [2] DB — sqlite3.Database 직접 접근
async function checkDatabase() {
  return new Promise((resolve) => {
    const Db = sqlite3.Database;
    const db = new Db(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve({ service: 'DB (SQLite)', severity: 'CRITICAL', ... });
      db.get('SELECT COUNT(*) as cnt FROM Task', (e) => {
        db.close();
        resolve(e ? { severity: 'CRITICAL', ... } : { severity: 'OK' });
      });
    });
  });
}

// [3] Gemini API — 간접 검증 (API 키 + DB 마지막 성공 호출 시각)
async function checkGeminiApi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 10)
    return { service: 'Gemini API', severity: 'CRITICAL', errorCode: 'GEMINI_KEY_MISSING' };
  // DB에서 Gemini 모델로 생성된 Task의 MAX(created_at) 조회
  // 24시간 초과 시 WARNING 반환
}

// Critical 발견 시 /api/cs-reports POST → 서버 미응답 시 JSON 폴백
const criticals = checkResults.filter(r => r.severity === 'CRITICAL');
for (const c of criticals) {
  try {
    await fetch(`${SERVER_URL}/api/cs-reports`, { method: 'POST', ... });
  } catch (e) {
    console.warn('서버 미응답 — 로컬 JSON 파일에만 기록됨');
  }
}
```

---

## 3. 소넷의 자가 점검 — 고민되는 포인트

### 🔴 P1 — updateCsReportStatus의 SQL 문자열 조합

```javascript
// 현재 코드 — resolvedAt 조건에 따라 SQL 문자열이 달라짐
const resolvedAt = status === 'RESOLVED' ? `datetime('now')` : 'NULL';
db.run(
  `UPDATE cs_reports SET status = ?, resolved_at = ${resolvedAt === 'NULL' ? 'NULL' : resolvedAt} WHERE id = ?`,
  status === 'RESOLVED' ? [status, id] : [status, id],  // ← 두 경우 params가 동일해 중복
  ...
);
```

**우려**: `resolved_at = datetime('now')` 부분이 파라미터 바인딩이 아닌 문자열 직접 삽입. `id`는 파라미터로 바인딩되지만, SQL 함수 호출 부분의 동적 조합이 다소 불안하게 느껴짐. 주입 위험은 낮지만 더 안전한 패턴이 있는지 확인 요망.

### 🟡 P2 — bugdogRunner.js의 node-fetch 의존

```javascript
import fetch from 'node-fetch';
```

server.js는 네이티브 `fetch`(Node 18+)를 사용하는데, bugdogRunner.js는 별도로 `node-fetch`를 import합니다. 프로젝트의 `package.json`에 `node-fetch`가 없으면 런타임 오류 발생 가능.

**확인 필요**: `package.json`의 `node-fetch` 의존성 존재 여부.

### 🟡 P3 — GET /api/cs-reports의 limit 파라미터 검증 부재

```javascript
const { status, limit } = req.query;
const reports = await dbManager.getCsReports({ status, limit: limit ? parseInt(limit) : 50 });
```

`limit=99999999` 같은 값이 들어오면 그대로 DB 쿼리에 사용됨. 상한선 제한 미적용.

### 🟡 P4 — bugdogRunner.js의 YouTube API 헬스체크가 실제 API 호출

```javascript
const r = await httpGet(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=${key}`, 5000);
```

Prime이 Gemini 헬스체크에 대해 지적했던 것처럼, 이 부분도 YouTube API를 실제로 호출해 quota를 소비할 수 있음. 간접 검증 방식(키 유효성만 확인)으로 전환이 필요한지 검토 요망.

### 🟢 P5 — cs_reports 테이블의 CHECK 제약이 SQLite 버전에 따라 무시될 수 있음

```sql
severity TEXT NOT NULL CHECK(severity IN ('WARNING','CRITICAL'))
```

SQLite는 버전에 따라 CHECK 제약을 무시하는 경우가 있음. 애플리케이션 레벨에서 추가 검증이 필요한지 확인 요망.

---

## 4. 리뷰 요청 항목

Prime께서 아래 관점으로 검토해 주시면 감사하겠습니다:

1. **SQL 안전성**: `updateCsReportStatus`의 문자열 조합 방식이 허용 가능한가, 더 나은 패턴이 있는가?
2. **의존성**: `node-fetch` vs 네이티브 `fetch` — bugdogRunner.js에서 어떤 것을 써야 하는가?
3. **입력 검증**: limit 상한선, severity/status enum 검증을 어디에 두어야 하는가?
4. **YouTube 헬스체크**: 간접 검증으로 전환해야 하는가?
5. **전반적 아키텍처**: v0 → v1 전환 시 추가로 고려해야 할 위험 요소가 있는가?

---

## 5. 참고 문서

- PRD: `02_System_Development/00_아키텍처_문서/01_PRD/Phase27_Bugdog_Autonomous_QA_PRD.md`
- Prime 1차 리뷰: `리뷰_아카이브/15_Phase27_Bugdog_자율형CS_리뷰_Prime.md`
- 소스: `01_아리_엔진/bugdogRunner.js`, `01_아리_엔진/database.js`, `01_아리_엔진/server.js`

---

*— Sonnet (AI 개발자), 2026-04-27*
