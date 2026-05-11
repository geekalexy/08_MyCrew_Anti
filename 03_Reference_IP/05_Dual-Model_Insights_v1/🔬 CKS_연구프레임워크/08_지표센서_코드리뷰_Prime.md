# CKS 지표 센서 이식 — Prime 코드 리뷰

> **작성자**: Prime (Claude Opus — Supreme Advisor)
> **작성일**: 2026-04-19
> **리뷰 대상**: executor.js, geminiAdapter.js, anthropicAdapter.js, antigravityAdapter.js, database.js, server.js
> **리뷰 유형**: 데이터 파이프라인 무결성 + 보안 + 실험 측정 신뢰성

---

## 📊 전체 평가

| 파일 | 변경점 | 품질 | 위험 |
|------|--------|:----:|:----:|
| `geminiAdapter.js` (L46) | `tokenUsage` 리턴 추가 | ⭐⭐⭐⭐⭐ | 🟢 |
| `anthropicAdapter.js` (L35-38) | `tokenUsage` 리턴 추가 | ⭐⭐⭐⭐ | 🟡 |
| `antigravityAdapter.js` (L58, L81-91) | `_meta` 패스스루 + 프롬프트 주입 | ⭐⭐⭐⭐⭐ | 🟢 |
| `executor.js` (L421-429) | TEI 누적 + _meta 저장 | ⭐⭐⭐⭐ | 🟡 |
| `database.js` (L738-779) | IRC/TEI/Eval UPSERT 3종 | ⭐⭐⭐⭐⭐ | 🟢 |
| `server.js` (L934-935) | rework → IRC 증가 | ⭐⭐⭐⭐⭐ | 🟢 |

### 종합: ✅ PASS (조건부)

> **파이프라인 설계는 건전합니다.** API 응답 → Executor → DB까지 데이터가 누락 없이 흐르며, UPSERT 패턴으로 중복 삽입 방지도 되어 있습니다. 아래 5건의 보완 사항을 반영하면 프로덕션 투입 가능합니다.

---

## 1. ✅ TEI 추적 (토큰 누적) — 우수

### geminiAdapter.js (L43-47)
```js
return {
    text: response.text,
    model: modelName.includes('pro') ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash',
    tokenUsage: response.usageMetadata?.totalTokenCount || 0
};
```

**✅ 정확합니다.** `usageMetadata?.totalTokenCount`는 Google GenAI SDK의 공식 경로이며, Optional Chaining + fallback 0 으로 null-safe 처리가 되어 있습니다.

### anthropicAdapter.js (L35-38)
```js
return Object.assign(new String(response.content[0].text), {
    text: response.content[0].text,
    tokenUsage: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
});
```

**⚠️ 이슈 1: `Object.assign(new String(...))` 패턴**

이것은 **레거시 호환 래퍼**인 것으로 보입니다 (이전에 `result.toString()`으로 사용하던 코드가 있을 수 있음). 동작에는 문제없지만:

- `new String()`은 **primitive string이 아닌 String 객체**를 만듦
- `typeof result`가 `'object'`가 되어, 다른 곳에서 `typeof === 'string'` 체크가 있으면 깨질 수 있음

> **권장**: 기존 하위 호환이 확인되면 일반 객체로 교체
> ```js
> return {
>     text: response.content[0].text,
>     tokenUsage: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
> };
> ```

### executor.js (L421-424)
```js
// [Phase 4] CKS TEI 토큰 사용량 누적 로깅
if (result.tokenUsage) {
  await dbManager.accumulateCksTokens(taskId, result.tokenUsage).catch(e => ...);
}
```

**⚠️ 이슈 2: `taskId`가 null일 수 있음**

executor.run()의 시그니처: `run(taskContent, preEvaluated, agentId = 'ari', taskId = null)`

채팅(`/api/chat`)에서는 `taskId` 없이 executor를 호출합니다 (L645). 이 경우 `taskId = null`이면:
- `accumulateCksTokens(null, tokens)` 호출
- CksMetrics 테이블에 `task_id = NULL`인 행이 삽입될 수 있음
- SQLite에서 `TEXT PRIMARY KEY`에 NULL이 들어가면 **매번 새 행이 생성됨** (PRIMARY KEY 제약 무시)

> **권장**: taskId null 가드 추가
> ```js
> if (result.tokenUsage && taskId) {
>   await dbManager.accumulateCksTokens(taskId, result.tokenUsage).catch(...);
> }
> ```

---

## 2. ✅ _meta 정성 지표 — 우수

### antigravityAdapter.js (L58, L81-91)

`_meta` 블록을 응답 JSON에서 추출하여 패스스루하는 설계가 깔끔합니다:

```js
// parseAndValidate() 내부 (L58)
_meta: { ...parsed._meta }
```

프롬프트에 _meta 포맷을 강제 주입하는 것도 적절합니다 (L81-91). 에이전트가 JSON을 지킬 확률을 높입니다.

### executor.js (L426-429)
```js
if (result._meta) {
  await dbManager.updateCksEvalMetrics(taskId, result._meta).catch(...);
}
```

**⚠️ 이슈 3: Anti-Bridge Fallback 시 _meta 오염**

antigravityAdapter.js의 `fallbackToGemini()` (L134-148)에서:
```js
return {
    ...flashResponse,
    _meta: { fallback: true, originalAgent: agentKey, reason, timestamp }
};
```

Flash Fallback 응답에도 `_meta`가 붙는데, 이 `_meta`에는 `ksi_r`, `ksi_s`, `her`, `eii`가 없습니다. 그러나 executor.js의 L427에서 `if (result._meta)` 체크만 하므로, Fallback의 `_meta`도 `updateCksEvalMetrics`로 흘러들어갑니다.

`updateCksEvalMetrics`에서 `ksi_r || 0` 처리가 되어있어 당장 크래시는 안 나지만, **fallback 데이터가 ksi_r=0, eii=0으로 DB에 찍히면 실험 데이터가 오염됩니다.**

> **권장**: Fallback 여부 체크 추가
> ```js
> if (result._meta && !result._meta.fallback) {
>   await dbManager.updateCksEvalMetrics(taskId, result._meta).catch(...);
> }
> ```

---

## 3. ✅ IRC 추적 (재작업 횟수) — 우수

### server.js (L934-935)
```js
// [Phase 4] CKS 지표 - 반복 수정 횟수(IRC) 증가
await dbManager.incrementCksIrc(sid).catch(e => console.error('[DB] IRC 증가 실패:', e));
```

### database.js (L738-747)
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

**✅ 완벽합니다.** UPSERT + 원자적 증가(`irc_count + 1`)로 동시성 안전합니다. Rework API의 상태 가드(REVIEW만 허용)도 이미 적용되어 있어 이중 카운트 방지됩니다.

---

## 4. DB 스키마 리뷰

### CksMetrics 테이블 (L100-111)
```sql
CREATE TABLE IF NOT EXISTS CksMetrics (
    task_id     TEXT PRIMARY KEY,
    team_type   TEXT,
    tei_tokens  INTEGER DEFAULT 0,
    ksi_r_score INTEGER DEFAULT 0,
    ksi_s_score REAL DEFAULT 0.0,
    her_count   INTEGER DEFAULT 0,
    eii_score   REAL DEFAULT 0.0,
    irc_count   INTEGER DEFAULT 0,
    uxs_rating  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**⚠️ 이슈 4: `team_type` 컬럼이 채워지지 않음**

`accumulateCksTokens`, `incrementCksIrc`, `updateCksEvalMetrics` 3개 메서드 모두 `team_type`을 INSERT하지 않습니다. UPSERT로 최초 삽입 시 `team_type = NULL`로 들어갑니다.

나중에 Team A vs Team B 비교 분석을 할 때 `WHERE team_type = 'team_A'` 쿼리가 빈 결과를 반환합니다.

> **권장**: executor.js에서 에이전트 ID → team_type 매핑을 추가
> ```js
> const AGENT_TEAM_MAP = {
>   'nova': 'team_A', 'lily': 'team_A', 'ollie': 'team_A',
>   'lumi': 'team_B', 'pico': 'team_B', 'luna': 'team_B',
>   'ari': 'independent',
> };
> ```
> 그리고 `accumulateCksTokens`에 team_type 파라미터를 추가하거나, 별도 `updateCksTeamType(taskId, teamType)` 호출

**⚠️ 이슈 5: `updated_at` 컬럼 없음**

CksMetrics에 `created_at`만 있고 `updated_at`가 없어서, UPSERT로 값이 갱신된 시점을 추적할 수 없습니다.

> **권장**: 마이그레이션 추가
> ```sql
> ALTER TABLE CksMetrics ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
> ```
> 그리고 각 UPSERT에 `updated_at = CURRENT_TIMESTAMP` 추가

---

## 5. 보안 리뷰

| 항목 | 상태 | 비고 |
|------|:----:|------|
| SQL Injection | ✅ 안전 | 모든 쿼리가 파라미터 바인딩 사용 |
| _meta JSON Injection | ✅ 안전 | `parseAndValidate()`에서 방어 파싱 |
| Rework 권한 | ✅ 안전 | REVIEW 상태만 허용 (상태 가드) |
| 민감 데이터 노출 | ✅ 안전 | 토큰/지표만 저장, 프롬프트 본문 미저장 |

---

## 📋 수정 권장 요약

| # | 파일 | 위험도 | 내용 | 수정 난이도 |
|---|------|:------:|------|:----------:|
| **1** | `anthropicAdapter.js` L35 | 🟡 | `new String()` → 일반 객체로 교체 | 🟢 1분 |
| **2** | `executor.js` L422 | 🔴 | `taskId` null 가드 추가 | 🟢 1분 |
| **3** | `executor.js` L427 | 🔴 | Fallback `_meta` 필터 추가 | 🟢 1분 |
| **4** | `executor.js` + `database.js` | 🟡 | `team_type` 채우기 로직 추가 | 🟡 15분 |
| **5** | `database.js` CksMetrics | 🟢 | `updated_at` 컬럼 추가 | 🟢 5분 |

---

## 🏆 Prime 최종 결론

### 파이프라인 설계 — 건전합니다

```
API 어댑터 (tokenUsage 추출)
    ↓
Executor (accumulateCksTokens / updateCksEvalMetrics)
    ↓
Database (UPSERT — 원자적 누적)
    ↓
Server API (/api/metrics/cks — 대시보드 연동)
```

이 흐름은 **끊김 없이 관통하며**, 어댑터 → DB 트랜잭션까지 일관된 에러 핸들링(`.catch()`)이 적용되어 있습니다.

### 가장 시급한 수정 2건

1. **`taskId` null 가드** (이슈 2) — 채팅에서 토큰이 유령 행으로 쌓임
2. **Fallback `_meta` 필터** (이슈 3) — Flash 대체 응답이 정성 지표를 0으로 오염

이 2건만 수정하면 **즉시 Round 1 실험에 투입 가능**합니다.

> **"뼈대는 완성됐다. 관절 2개만 조이면 실전 투입이다."**

---

*본 코드 리뷰는 Prime(Claude Opus)이 6개 파일의 CKS 메트릭 센서 이식 코드를 독립적으로 검토하여 작성한 피어 리뷰입니다.*
*작성 시각: 2026-04-19 21:50 KST*
