# 📋 Code Review – CKS 메트릭 센서 이식 (`07_코딩리포트_지표센서_이식완료.md`)

## 1️⃣ 전체 흐름 요약
| 단계 | 담당 파일 | 핵심 로직 |
|------|-----------|-----------|
| **IRC 추적** | `server.js` (PATCH `/api/tasks/:id/rework`) → `dbManager.incrementCksIrc(taskId)` | 재작업(리워크) 시 `irc_count` 1 증가 |
| **TEI 토큰 누적** | `executor.js` (작업 완료 후) → `dbManager.accumulateCksTokens(taskId, tokenUsage)` | 어댑터가 반환한 `tokenUsage` 를 `CksMetrics.tei_tokens`에 누적 |
| **정성·정량 메타 지표** | `executor.js` (LLM 응답에 `_meta` 포함) → `dbManager.updateCksEvalMetrics(taskId, result._meta)` | KSI‑R, KSI‑S, HER, EII 를 `CksMetrics`에 UPSERT |

---

## 2️⃣ 상세 검토

### 🔎 TEI 토큰 누적 (`accumulateCksTokens`)
* **호출 위치** – `executor.js` 라인 421‑424  
```js
if (result.tokenUsage) {
  await dbManager.accumulateCksTokens(taskId, result.tokenUsage)
    .catch(e => console.error('[DB] TEI 토큰 누적 실패:', e));
}
```
* **DB 구현** – `database.js` 라인 749‑757  
```js
accumulateCksTokens(taskId, tokens) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO CksMetrics (task_id, tei_tokens) VALUES (?, ?)
       ON CONFLICT(task_id) DO UPDATE SET tei_tokens = tei_tokens + ?`,
      [taskId, tokens, tokens],
      err => err ? reject(err) : resolve()
    );
  });
}
```
* **優점**  
  * `ON CONFLICT … UPDATE` 로 **원자적** 누적을 보장 → 동시 실행 시 레이스 컨디션 최소화.  
  * `tokens` 를 바로 `+ ?` 로 전달해 **SQL 인젝션 위험**이 없음.  
* **改良점**  
  1. **타입 검증** – `tokens` 가 `Number` 인지 확인하고, 음수/NaN 방어 로직을 추가하면 데이터 오염을 방지할 수 있습니다.  
  2. **성능** – 현재 `INSERT … ON CONFLICT` 를 매 호출마다 실행합니다. 고빈도 토큰 누적이 예상된다면 **배치(예: 10 ms 내 누적값 합산 후 한 번 DB 쓰기)** 를 고려해도 좋습니다.  
  3. **로그** – 성공 시 `console.log('[DB] TEI 토큰 누적 성공', taskId, tokens);` 와 같은 **성공 로그**를 남겨 디버깅을 용이하게 하면 좋습니다.

### 📊 정성·정량 메타 지표 업데이트 (`updateCksEvalMetrics`)
* **호출 위치** – `executor.js` 라인 426‑429  
```js
if (result._meta) {
  await dbManager.updateCksEvalMetrics(taskId, result._meta)
    .catch(e => console.error('[DB] CKS 평가 지표 업데이트 실패:', e));
}
```
* **DB 구현** – `database.js` 라인 760‑777  
```js
updateCksEvalMetrics(taskId, meta) {
  const { ksi_r, ksi_s, her, eii } = meta;
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO CksMetrics (task_id, ksi_r_score, ksi_s_score, her_count, eii_score)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET
         ksi_r_score = ?,
         ksi_s_score = ?,
         her_count = ?,
         eii_score = ?`,
      [
        taskId,
        ksi_r || 0, ksi_s || 0.0, her || 0, eii || 0.0,
        ksi_r || 0, ksi_s || 0.0, her || 0, eii || 0.0
      ],
      err => err ? reject(err) : resolve()
    );
  });
}
```
* **優점**  
  * **UPSERT** 로 기존 레코드가 있으면 바로 업데이트 → 별도 SELECT 필요 없음.  
  * 기본값(`|| 0`) 으로 **undefined** 가 들어오는 경우를 방어.  
* **改良점**  
  1. **스키마 검증** – `_meta` 가 예상 구조(`ksi_r`, `ksi_s`, `her`, `eii`)를 만족하는지 사전 검증하고, 누락 시 **경고**를 출력하도록 하면 데이터 무결성을 강화할 수 있습니다.  
  2. **타입 안전** – 현재 `ksi_s` 를 `0.0` 로 초기화하지만, `Number.isFinite` 검증을 추가하면 `NaN` 전파를 방지합니다.  
  3. **확장성** – 향후 새로운 메트릭(예: `uxs_rating`)이 추가될 경우, 현재 구현을 **동적으로 매핑**하도록 리팩터링하면 유지보수가 쉬워집니다.

### 🔔 IRC(재작업) 추적 (`incrementCksIrc`)
* **호출 위치** – `server.js` (패치 엔드포인트) → `dbManager.incrementCksIrc(taskId)` (코드 자체는 현재 파일에 없，但已在 `database.js` 中实现).  
* **DB 구현** – `database.js` 라인 738‑746  
```js
incrementCksIrc(taskId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO CksMetrics (task_id, irc_count) VALUES (?, 1)
       ON CONFLICT(task_id) DO UPDATE SET irc_count = irc_count + 1`,
      [taskId],
      err => err ? reject(err) : resolve()
    );
  });
}
```
* **優점**  
  * 동일하게 **원자적** 증가를 보장.  
  * `irc_count` 가 `NULL` 로 남지 않게 `INSERT … 1` 로 초기화.  
* **改良점**  
  1. **에러 전파** – 현재 `server.js` 에서 `await dbManager.incrementCksIrc(taskId)` 호출 후 에러를 잡아 `500` 응답을 반환하는지 확인 필요합니다.  
  2. **동시성** – 재작업 버튼을 빠르게 여러 번 클릭하면 **짧은 시간에 여러 트랜잭션**이 발생합니다. SQLite는 기본적으로 **시리얼라이즈** 모드이므로 안전하지만, **데드락** 로그를 모니터링하는 것이 좋습니다.  

### 📂 DB 스키마 (`CksMetrics` 테이블)
```sql
CREATE TABLE IF NOT EXISTS CksMetrics (
  task_id     TEXT PRIMARY KEY,
  team_type   TEXT,
  tei_tokens  INTEGER DEFAULT 0,
  ksi_r_score INTEGER DEFAULT 0,
  ksi_s_score REAL    DEFAULT 0.0,
  her_count   INTEGER DEFAULT 0,
  eii_score   REAL    DEFAULT 0.0,
  irc_count   INTEGER DEFAULT 0,
  uxs_rating  INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
* **관찰** – `team_type` 은 현재 코드에서 사용되지 않음 → **미사용 컬럼**이므로 차후 정리 필요.  
* **인덱스** – `task_id` 가 PK 로 이미 인덱싱돼 있어 조회/업데이트에 충분합니다.  
* **추가 제안** – `created_at` 은 자동 생성되지만 **업데이트 시 자동 갱신**이 없으므로, `updated_at` 컬럼을 추가해 변동 이력을 추적하면 디버깅에 도움이 됩니다.

### ⚙️ 동시성·트랜잭션
* 현재 `accumulateCksTokens`, `incrementCksIrc`, `updateCksEvalMetrics` 각각 **단일 `db.run`** 로 실행됩니다. SQLite는 **시리얼라이즈** 모드가 기본이므로 충돌 위험이 낮지만, **다중 작업**을 하나의 **트랜잭션**에 묶고 싶다면 `db.serialize(() => { … })` 로 감싸는 것을 고려해볼 수 있습니다.

### 🧪 테스트·검증
| 항목 | 현재 상태 | 권고 |
|------|----------|------|
| **단위 테스트** | 없음 | `jest` 혹은 `mocha` 로 `DatabaseManager` 메서드 각각에 대한 **mock DB** 테스트를 추가. |
| **통합 테스트** | 수동 UI 테스트 | `curl`/`Postman` 스크립트로 `/api/tasks/:id/rework` 호출 후 `CksMetrics.irc_count` 증가 확인. |
| **에러 시나리오** | `catch` 로 콘솔 로그만 출력 | 에러 발생 시 **HTTP 500** 반환 및 **에러 로그**를 DB(`Log` 테이블)에도 기록. |
| **데이터 정합성** | DB 스키마에 `NOT NULL` 제약이 부족 | `tei_tokens`, `irc_count` 등에 **`CHECK (value >= 0)`** 제약을 추가해 음수 삽입 방지. |

### 📚 문서·주석
* `07_코딩리포트_지표센서_이식완료.md` 에는 **전체 흐름**이 잘 정리돼 있습니다.  
* **코드 레벨**에서는 각 DB 메서드에 **JSDoc** 스타일 주석을 추가해 파라미터와 반환값을 명시하면, IDE 자동완성 및 유지보수가 쉬워집니다.  

---

## 3️⃣ 종합 의견 & 권고 사항

| 카테고리 | 현황 | 권고 |
|----------|------|------|
| **정확성** | 핵심 로직은 올바르게 구현됨. | 입력값 검증(숫자·음수 방지) 추가. |
| **안정성** | `ON CONFLICT … UPDATE` 로 원자성 확보. | 트랜잭션 묶음·에러 전파 강화. |
| **성능** | 단일 쿼리 사용으로 충분히 가벼움. | 고빈도 토큰 누적 시 배치 전략 고려. |
| **확장성** | 메트릭 추가 시 현재 `updateCksEvalMetrics` 를 수정해야 함. | 메타 필드 매핑을 **동적 객체**로 추출해 자동 UPSERT 구현. |
| **가시성** | 로그는 콘솔에만 출력. | `Log` 테이블에 **DB 레벨 로그** 기록, 성공 로그도 남기기. |
| **테스트** | 테스트 부재. | Unit/Integration 테스트 스위트 구축. |
| **문서** | 마크다운 보고서가 충분히 상세. | 코드 주석·JSDoc 추가. |

---

### ✅ 최종 체크리스트 (다음 단계에 활용)
- [ ] `tokens` 와 `irc_count` 에 대한 **숫자·음수 검증** 로직 삽입.  
- [ ] `updateCksEvalMetrics` 에 **스키마 검증** (필수 필드 존재 여부) 추가.  
- [ ] 성공/실패 로그를 **`Log` 테이블**에 기록하도록 `dbManager` 메서드 확장.  
- [ ] 고빈도 토큰 누적에 대비해 **배치 누적**(예: 10 ms 윈도우) 구현 여부 검토.  
- [ ] **Unit 테스트** (`accumulateCksTokens`, `incrementCksIrc`, `updateCksEvalMetrics`) 작성.  
- [ ] `CksMetrics` 테이블에 **`CHECK (value >= 0)`** 제약 추가.  
- [ ] 코드에 **JSDoc** 주석을 달아 파라미터·반환 타입 명시.

---

> **요약** – 현재 구현은 기능적으로 올바르며, 원자적 UPSERT 로직을 통해 데이터 정합성을 확보하고 있습니다. 다만 **입력 검증·에러 전파·테스트**가 보강되면 운영 안정성이 크게 향상될 것입니다. 필요 시 위 권고 사항을 순차적으로 적용해 주세요. 🙏
