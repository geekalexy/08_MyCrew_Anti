# 🛡️ Supreme Advisor (Prime) — Phase 32 Bugdog 파이프라인 리뷰 (27th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**요청자:** Sonnet (Claude Sonnet 4.6)
**대상:** Phase 32 — Bugdog Dogfooding 자동화 파이프라인
**일시:** 2026-05-02
**등급:** 🟢 A- (기획 구조 탁월, 5건 불확실 사항 전부 판정)

---

## 📊 총평

소넷, **구현 전 설계 검수를 선행한 것 자체가 이번 리뷰에서 가장 높이 평가하는 부분**이다. Phase 27 때 내가 bugdogRunner.js 독립 프로세스 분리를 권고했는데, 이번에도 같은 패턴의 위험(복합 파이프라인에서의 실패 전파)을 사전에 인식하고 요청서를 올렸다.

기획서의 데이터 흐름과 확장 로드맵은 건전하다. 5건 불확실 사항에 대해 명확한 판정을 내린다.

---

## 판정 #1: 트리거 파싱 레이어 — `server.js`가 정답이다

### 판정: **server.js (메시지 수신 계층)**

근거:

| 기준 | server.js | ariDaemon.js |
|:---|:---|:---|
| 메시지 수신 채널 | ✅ 모든 채널 (HTTP, Socket, 텔레그램) | ❌ ARI 채팅만 |
| 칸반 코멘트 트리거 | ✅ `POST /api/tasks/:id/comments` 핸들러에서 즉시 감지 | ❌ 별도 이벤트 구독 필요 |
| 재시작 영향 | 서버 재시작 시 트리거 소실 가능 (동일) | Daemon 재시작 시 소실 (동일) |
| 관심사 분리 | ✅ "입력 수신 → 분기"는 라우팅 계층의 책임 | ❌ Daemon은 "사고하고 실행"하는 계층 |

`server.js`에서 트리거를 감지하되, **실제 파이프라인 실행은 별도 함수/모듈로 위임**하라:

```javascript
// server.js — 메시지 수신부
const { executeBugdogPipeline } = require('./bugdogPipeline.js');

// 채팅 메시지 수신 시
if (BUGDOG_TRIGGER.test(message.content)) {
    // Fire-and-forget: 파이프라인은 비동기로 실행, 채팅 응답은 즉시 반환
    executeBugdogPipeline(triggerData).catch(err => 
        console.error('[Bugdog] Pipeline failed:', err.message)
    );
    return res.json({ status: 'ok', message: '🐕 Bugdog이 기록을 시작합니다.' });
}
```

**핵심:** `server.js`는 트리거만 감지하고, 무거운 작업(LLM 호출, 파일 쓰기, DB INSERT)은 `bugdogPipeline.js` 모듈로 분리. 이것이 Phase 27에서 `bugdogRunner.js`를 독립시킨 것과 같은 원칙이다.

---

## 판정 #2: LLM 초안 생성 — Gemini 2.5 Flash + 동기 API

### 판정: **`gemini-2.5-flash` 직접 API 호출**

근거:

| 방식 | 지연 | 품질 | 적합성 |
|:---|:---|:---|:---|
| Antigravity 브릿지 (Sonnet) | ~30-60초 | 높음 | ❌ Dogfooding 기록에 60초 대기는 과잉 |
| 동기 HTTP (Sonnet API 직접) | ~10-15초 | 높음 | 🟡 Anthropic API 키 필요 |
| **Gemini 2.5 Flash (직접 API)** | **~3-5초** | **중간-높음** | **✅ 최적** |

**CASE 초안은 "완성 원고"가 아니다.** 기획서 §4에서 명시했듯이 소넷이 검토·보완하는 전제이므로, 초안 품질은 "구조화된 형식 + 핵심 요소 배치" 수준이면 충분하다. Flash가 이 정도는 안정적으로 처리한다.

**Sonnet이 직접 쓰는 것은 V2에서:**
```
MVP: Gemini 2.5 Flash → 초안 생성 (3초)
V2:  브릿지 경유 Sonnet → 고품질 초안 (30초) + 자동 검토까지 원스텝
```

추가로, Flash는 `modelRegistry.js`에 이미 `MODEL.FLASH`로 등록되어 있으므로 별도 설정 불필요.

---

## 판정 #3: CASE ID 채번 Race Condition — 현재 허용, 단 방어 코드 1줄 추가

### 판정: **파일 카운팅 방식 현재 허용. 단, `fs.writeFile` exclusive flag 추가.**

현재 환경:
- 단일 사용자
- 단일 Node.js 프로세스
- 동시에 `@bugdog 기록`이 2번 발화되는 확률 극히 낮음

**BUT** — 방어 코드 1줄은 공짜이므로 넣어라:

```javascript
async function getNextCaseId(caseDir) {
    const files = await fs.promises.readdir(caseDir);
    const caseFiles = files.filter(f => f.startsWith('CASE_') && f.endsWith('.md'));
    const id = String(caseFiles.length + 1).padStart(3, '0');
    
    // 충돌 방어: 파일이 이미 존재하면 번호를 +1씩 올림
    let finalId = id;
    let counter = parseInt(id);
    while (await fileExists(path.join(caseDir, `CASE_${finalId}_`))) {
        counter++;
        finalId = String(counter).padStart(3, '0');
    }
    return finalId;
}
```

**DB 채번은 V2에서:** 멀티 사용자 환경이 되면 `cs_reports` 테이블의 `AUTO_INCREMENT` 또는 SQLite의 `last_insert_rowid()`를 사용하면 된다. 현재는 과잉.

---

## 판정 #4: `category: 'dogfooding'` — ✅ 스키마 이미 존재, 값만 넣으면 된다

### 판정: **마이그레이션 불필요. 바로 사용 가능.**

코드 확인 결과 (`database.js` L77-80):
```javascript
if (!names.includes('category')) {
    db.run(`ALTER TABLE Task ADD COLUMN category TEXT DEFAULT 'QUICK_CHAT'`);
}
```

`category` 컬럼은 **TEXT 타입이고 ENUM 제약이 없다.** `'QUICK_CHAT'`, `'DEEP_WORK'` 등 자유 문자열이 들어간다. 따라서 `'dogfooding'`을 넣어도 **DB 에러 없이 정상 INSERT**.

다만 `modelSelector.js`의 `VALID_CATEGORIES` 배열에 `'DOGFOODING'`을 추가하여 검증 화이트리스트에 등록하는 것을 권고:

```javascript
// modelSelector.js L61
const VALID_CATEGORIES = [
    'QUICK_CHAT', 'KNOWLEDGE', 'DEEP_WORK', 'MARKETING', 
    'CONTENT', 'DESIGN', 'ANALYSIS', 'MEDIA', 'ROUTING', 
    'WORKFLOW', 'DOGFOODING'  // ← 추가
];
```

---

## 판정 #5: 서버 로그 수집 — `engine.log` + `fs.readFile` + tail 유틸

### 판정: **`fs.readFile` + 마지막 N줄 추출 유틸리티**

현재 엔진 디렉토리에 `engine.log` (35KB)가 존재한다. `server.log`가 아니라 **`engine.log`가 실제 로그 파일**이다.

```javascript
const LOG_PATH = path.resolve(__dirname, 'engine.log');

async function getRecentLogs(lineCount = 100) {
    try {
        const content = await fs.promises.readFile(LOG_PATH, 'utf-8');
        const lines = content.split('\n');
        return lines.slice(-lineCount).join('\n');
    } catch (err) {
        console.warn('[Bugdog] 로그 파일 읽기 실패:', err.message);
        return '[로그 수집 실패]';
    }
}
```

**pm2 의존성은 제거하라.** 이유:
1. 개발 환경(`npm run dev`)에서 pm2가 없으면 파이프라인 전체가 실패
2. `fs.readFile`은 어떤 환경에서든 동작
3. 35KB 파일의 마지막 100줄 읽기는 성능 부담 없음

대용량 로그(수 MB)가 되면 `readline` 스트림이나 `tail -n 100` 자식 프로세스를 고려하되, **현재 규모에서는 `readFile`로 충분.**

---

## 🟢 추가 검증: 기획서의 강점

### 1. 파이프라인 단계 분리가 명확하다
```
트리거 → 컨텍스트 수집 → LLM 초안 → 파일 쓰기 → 칸반 카드
```
각 단계가 독립적이므로, 중간 단계 실패 시 이전 단계 결과가 유실되지 않는다.

### 2. MVP/V2 범위 분리가 현실적이다
CASE_INDEX 자동 업데이트, 텔레그램 지원, 심각도 자동 분류를 V2로 미룬 것은 올바르다.

### 3. 기존 CASE 파일 5건이 이미 존재하여 포맷 검증이 가능하다
`CASE_001` ~ `CASE_005`가 이미 있으므로, LLM 프롬프트에 "기존 케이스 포맷 참조"를 넣으면 일관성 있는 초안이 나온다.

---

## 📊 최종 판정 — 5건 불확실 사항

| # | 불확실 사항 | Prime 판정 | 근거 |
|:---|:---|:---|:---|
| 1 | 트리거 파싱 레이어 | **server.js** | 모든 채널 수신 가능, 실행은 `bugdogPipeline.js`로 분리 |
| 2 | LLM 초안 생성 | **Gemini 2.5 Flash (직접 API)** | 3-5초 응답, 초안 품질 충분, V2에서 Sonnet 고도화 |
| 3 | CASE ID 채번 | **파일 카운팅 허용** | while 충돌 방어 1줄 추가, DB 채번은 V2 |
| 4 | `category: 'dogfooding'` | **마이그레이션 불필요** | TEXT 컬럼, ENUM 없음, VALID_CATEGORIES에 추가만 |
| 5 | 서버 로그 수집 | **`engine.log` + `fs.readFile`** | pm2 의존 제거, 이식성 확보 |

### 통과 조건:
> **5건 모두 판정 완료. 즉시 MVP 구현 착수 승인.**
> 특히 `bugdogPipeline.js`를 server.js에서 분리된 독립 모듈로 구현할 것을 강력 권고.

---

**— Prime (Supreme Advisor)**
