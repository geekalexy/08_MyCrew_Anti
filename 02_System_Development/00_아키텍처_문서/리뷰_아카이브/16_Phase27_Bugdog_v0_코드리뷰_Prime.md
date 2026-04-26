# 🛡️ Supreme Advisor (Prime) — Phase 27 Bugdog v0 코드 리뷰 (16th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**요청자:** Sonnet (AI 개발자)
**대상:** Bugdog v0 — database.js / server.js / bugdogRunner.js
**일시:** 2026-04-27
**등급:** 🟢 A- (v0으로서 우수. 소넷의 자가 점검 5개 중 4개가 정확)

---

## 📊 총평

소넷, 좋은 일 했다. **코드의 구조와 방어 로직이 견실**하다.

특히 인상적인 점:
- `bugdogRunner.js`가 ariDaemon과 완전히 분리된 독립 프로세스
- 서버가 죽었을 때 JSON 파일 폴백 (L200-203)
- `node-cron` 미설치 시 `setInterval` 폴백 (L225-231)
- 각 헬스체크 함수의 try-catch 격리 (L164-172)

**그리고 리뷰 요청서의 자가 점검이 매우 좋다.** 5개 중 4개가 실제 문제였고, 자기 코드의 약점을 정확히 짚었다. 이것이 시니어 개발자의 자세다.

이제 각 항목을 하나씩 판정하겠다.

---

## 🔴 P1: `updateCsReportStatus`의 SQL 문자열 조합 — 수정 필요

### 소넷의 우려

```javascript
const resolvedAt = status === 'RESOLVED' ? `datetime('now')` : 'NULL';
db.run(
  `UPDATE cs_reports SET status = ?, resolved_at = ${resolvedAt === 'NULL' ? 'NULL' : resolvedAt} WHERE id = ?`,
  status === 'RESOLVED' ? [status, id] : [status, id],
);
```

### Prime 판정: **우려가 정확하다. 수정해야 한다.**

문제 3가지:

1. **SQL 함수 `datetime('now')`가 문자열 보간으로 삽입됨** — 현재는 외부 입력이 아니라 하드코딩이므로 SQL Injection 위험은 없지만, 패턴 자체가 위험한 습관이다.

2. **`status === 'RESOLVED' ? [status, id] : [status, id]`** — 소넷이 직접 표시했듯이, 양쪽 분기의 파라미터가 동일하다. 의미 없는 삼항연산.

3. **두 가지 SQL 문이 하나의 문자열에 뒤섞여 있음** — 가독성 저하.

### 수정 코드

```javascript
updateCsReportStatus(id, status) {
  return new Promise((resolve, reject) => {
    // 방법 1: 두 케이스를 명확히 분리
    const sql = status === 'RESOLVED'
      ? `UPDATE cs_reports SET status = ?, resolved_at = datetime('now') WHERE id = ?`
      : `UPDATE cs_reports SET status = ?, resolved_at = NULL WHERE id = ?`;

    db.run(sql, [status, id], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}
```

**변경 포인트:** 
- SQL 함수 호출은 SQL 문 안에 고정 문자열로 존재 (보간 아님)
- 파라미터 배열이 항상 `[status, id]`로 통일
- 삼항연산이 SQL 템플릿 선택에만 사용

---

## 🟡 P2: `node-fetch` vs 네이티브 `fetch` — 전환 권고

### 소넷의 우려

```javascript
// bugdogRunner.js L11
import fetch from 'node-fetch';
```

### Prime 판정: **전환이 바람직하나 긴급하지는 않다.**

| 환경 | `fetch` 사용 |
|:---|:---|
| server.js | 네이티브 `fetch` (Node 18+) |
| ariDaemon.js | 네이티브 `fetch` |
| bugdogRunner.js | `node-fetch` 패키지 |

**현재 프로젝트의 Node.js 버전이 18+이면** (거의 확실), `node-fetch`는 불필요한 의존성이다.

### 수정 코드

```javascript
// bugdogRunner.js L11 — 삭제
// import fetch from 'node-fetch';  // ← 제거

// Node 18+ 네이티브 fetch 사용 (import 불필요)
```

**확인 방법:**
```bash
node -v  # v18 이상이면 네이티브 fetch 사용 가능
```

만약 Node 18 미만이면 `node-fetch`를 유지하되, `package.json`에 의존성이 등록되어 있는지 반드시 확인.

---

## 🟡 P3: `GET /api/cs-reports?limit=` 상한선 미검증 — 수정 권고

### 소넷의 우려

```javascript
const reports = await dbManager.getCsReports({ status, limit: limit ? parseInt(limit) : 50 });
```

### Prime 판정: **맞다. 상한선이 필요하다.**

`limit=99999999`가 들어오면 SQLite가 전체 테이블을 스캔한다. 현재 데이터가 적으므로 즉각 장애는 없지만, 운영 시간이 쌓이면 문제가 될 수 있다.

### 수정 코드

```javascript
// server.js — GET /api/cs-reports
const MAX_LIMIT = 200;
const parsedLimit = Math.min(parseInt(limit) || 50, MAX_LIMIT);
const reports = await dbManager.getCsReports({ status, limit: parsedLimit });
```

추가로 `status` 파라미터도 검증:

```javascript
const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
if (status && !VALID_STATUSES.includes(status)) {
  return res.status(400).json({ status: 'error', message: '유효하지 않은 status 필터' });
}
```

---

## 🟡 P4: YouTube 헬스체크의 실제 API 호출 — 전환 필요

### 소넷의 우려

```javascript
// bugdogRunner.js L124
const r = await httpGet(`https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&key=${key}`, 5000);
```

### Prime 판정: **15th 리뷰(Gemini 간접 검증)와 동일한 문제. 전환 필요.**

이 호출은:
1. YouTube API quota를 소비한다 (하루 10,000 유닛 중 1유닛)
2. `mine=true`는 OAuth 토큰이 필요한데, API 키만으로는 403이 뜬다
3. **403이 뜨면 "quota 초과"로 오진**한다 (실제로는 인증 방식 불일치)

### 수정 코드

```javascript
async function checkYoutubeApi() {
  const key = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return { service: 'YouTube API', severity: 'WARNING', errorCode: 'YT_KEY_MISSING', errorMsg: 'YouTube API 키 미등록' };

  // v0: 키 존재 확인만. quota 실시간 조회는 v1에서 OAuth 기반으로.
  if (key.length < 10) return { service: 'YouTube API', severity: 'WARNING', errorCode: 'YT_KEY_INVALID', errorMsg: '키 길이 비정상' };

  return { service: 'YouTube API', severity: 'OK' };
}
```

**v1에서 quota 조회가 필요하면** YouTube Data API의 `youtube.googleapis.com/youtube/v3/videos?chart=mostPopular&maxResults=1&key=...` (1유닛) 같은 저비용 엔드포인트를 사용하거나, GCP Console의 quota dashboard API를 사용하세요.

---

## 🟢 P5: SQLite CHECK 제약 — 현재 충분

### 소넷의 우려

SQLite가 버전에 따라 CHECK 제약을 무시할 수 있음.

### Prime 판정: **우려는 이해하지만, 현재 충분히 방어되어 있다.**

1. SQLite 3.25+ (2018년 이후)에서 CHECK 제약은 정상 동작한다. macOS 번들 SQLite는 항상 이 버전 이상.
2. `server.js L2123-2125`에서 PATCH API가 이미 애플리케이션 레벨 검증을 수행:

```javascript
if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
  return res.status(400).json({ status: 'error', message: '유효하지 않은 status 값' });
}
```

3. `POST /api/cs-reports`에서도 severity 검증 추가를 권고:

```javascript
if (!['WARNING', 'CRITICAL'].includes(severity)) {
  return res.status(400).json({ status: 'error', message: '유효하지 않은 severity 값' });
}
```

---

## 🆕 P6: POST API에 severity enum 검증 누락 (소넷 미발견)

소넷이 놓친 1건.

```javascript
// server.js L2094 — 현재
if (!severity || !service) return res.status(400).json({...});
```

`severity`가 존재하는지만 확인하고, **값이 유효한지는 확인하지 않는다.** `severity: "BANANA"`가 들어오면 그대로 DB에 저장된다. CHECK 제약이 잡아주긴 하지만, 애플리케이션 레벨에서도 막아야 한다.

### 수정 코드

```javascript
// server.js L2094 — 수정
if (!severity || !service) return res.status(400).json({ status: 'error', message: 'severity, service 필수' });
if (!['WARNING', 'CRITICAL'].includes(severity)) return res.status(400).json({ status: 'error', message: 'severity는 WARNING 또는 CRITICAL만 허용' });
```

---

## 🆕 P7: Gemini 간접 검증의 SQL 쿼리가 부정확 (소넷 미발견)

```javascript
// bugdogRunner.js L88
db.get(`SELECT MAX(created_at) as last FROM Task WHERE model LIKE '%Gemini%'`, ...);
```

**문제:** 현재 Task 테이블의 `model` 필드에 저장되는 값은 `gemini-2.5-flash`, `gemini-2.5-pro` 등이다. `LIKE '%Gemini%'`는 대소문자를 구분하므로 **매칭되지 않을 수 있다.**

### 수정 코드

```javascript
// 대소문자 무시 + modelRegistry 상수와 일치하는 패턴
db.get(`SELECT MAX(created_at) as last FROM Task WHERE LOWER(model) LIKE '%gemini%'`, ...);
```

---

## 📊 수정 우선순위

| 순위 | 항목 | 파일 | 소요 |
|:---|:---|:---|:---|
| **P1** | updateCsReportStatus SQL 분리 | database.js L889-900 | 5분 |
| **P4** | YouTube 헬스체크 간접 전환 | bugdogRunner.js L120-128 | 5분 |
| **P6** | POST severity enum 검증 | server.js L2094 | 2분 |
| **P7** | Gemini SQL LIKE 대소문자 | bugdogRunner.js L88 | 1분 |
| **P3** | limit 상한선 + status 검증 | server.js L2110 | 3분 |
| **P2** | node-fetch → 네이티브 전환 | bugdogRunner.js L11 | 1분 |

**총 예상 수정 시간: 17분.** 전부 사소한 수정이고, 구조적 리팩토링은 필요 없다.

---

## ✅ 소넷에게 보내는 메모

소넷, 자가 점검 5개 중 4개(P1~P4)가 실제 수정이 필요한 정확한 지적이었다. P5만 "현재 충분"이었고, 대신 내가 P6(severity 검증 누락)과 P7(SQL LIKE 대소문자)을 추가로 찾았다.

**특히 리뷰 요청서 형식이 훌륭하다.** 코드 전문 + 자가 점검 + 구체적 질문 — 이 포맷으로 계속 요청하면 리뷰 효율이 극대화된다.

---

**— Prime (Supreme Advisor)**
**"17분이면 전부 끝난다. 소넷, 가장 위험한 P1(SQL 분리)부터."**
