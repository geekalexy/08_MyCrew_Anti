# Phase 46 — UX 반응성 및 통신 아키텍처 개선 PRD Supreme Review

**리뷰어**: Sonnet (Claude Sonnet 4.6 Thinking)  
**리뷰 대상**: `Phase46_UI_반응성_및_통신_아키텍처_개선_PRD.md`  
**리뷰 일시**: 2026-05-16  
**이전 리뷰**: `58_Phase46_UX_Latency_SupremeReview_Luca_2026-05-16.md`

---

## 📋 결함 요약 매트릭스

| # | 심각도 | 렌즈 | 위치 | 결함 내용 |
|---|--------|------|------|-----------|
| F-01 | 🔴 CRITICAL | 아키텍처 | `ariDaemon.js` `/api/compute` | SSE 파이프가 이미 열려있지만 `tool:start` 이벤트 삽입 위치(L1286~1295 루프 진입 직전)를 PRD가 단순히 "1줄 추가"로 서술 — **동일 루프 내 다중 도구 순차 호출 시 각 도구별 `tool:start/end` 쌍 발송 로직이 명시되지 않아 구현 시 누락 위험 HIGH** |
| F-02 | 🔴 CRITICAL | 런타임 안정성 | `useStreaming.js` (신규) | PRD가 "30초 UI 타임아웃" 언급 → 그러나 SSE 연결 자체가 30초 이상 소요되는 무거운 도구(터미널, Graphify 전체 스캔)에서 **타임아웃이 거짓 양성(False Positive) 에러를 발생시킬 수 있음. 도구 종류별 타임아웃 차등 설계가 없음** |
| F-03 | 🟠 HIGH | 상태 정합성 | `ariDaemon.js` conversationHistory | `conversationHistory`는 서버 메모리 싱글턴으로 관리됨. **SSE 스트림 도중 서버 재시작 시 히스토리 유실 + 클라이언트 SSE 스트림이 `close` 이벤트 없이 끊겨 `useStreaming` 훅이 무한 대기 상태에 빠질 수 있음** |
| F-04 | 🟠 HIGH | 아키텍처 | 4-3절 Redis 캐싱 | Redis 도입 제안에 **Redis 장애 시(OOM, Crash) Fallback 전략이 "TTL 만료 + 주기적 해시 체크"로만 언급** — Redis 자체가 내려간 경우 실시간 파일 I/O로 즉시 전환하는 Circuit Breaker 패턴이 미설계 |
| F-05 | 🟠 HIGH | 보안 | 4-4절 크롬 익스텐션 AOM | **Content Script → 서버로 전달되는 AOM 트리에 사용자 민감 정보(비밀번호 필드, 결제 정보 등)가 포함될 수 있음**. `input[type=password]`, `[autocomplete=cc-number]` 등 민감 셀렉터 필터링 로직이 명시되지 않음 |
| F-06 | 🟠 HIGH | 아키텍처 | `App.jsx` (익스텐션) | 현재 익스텐션은 `io('http://localhost:4010')` WebSocket 단일 연결만 존재. PRD 4-4절이 **"SSE 채널을 통해 익스텐션 Background Script로 조작 명령어 스트리밍"을 제안하나 익스텐션 Background Script는 표준 SSE 수신 불가** — `EventSource` API가 Background Service Worker에서 제한적으로만 동작하며, Manifest V3 환경에서 SSE 수신은 별도 Offscreen Document 또는 Content Script 중계가 필요함 (현재 설계 누락) |
| F-07 | 🟡 MEDIUM | UX/사용자 흐름 | PRD 4-2절 | `tool:start` 이벤트에 포함될 **도구명(toolName) 한국어 매핑 테이블이 없음**. 사용자가 "[run_command 실행 중...]" 같은 내부 식별자를 그대로 보게 됨 |
| F-08 | 🟡 MEDIUM | 정책 준수 | `chatStore.js` L26 | `dangerouslyPurgeAllChats()` 함수가 이미 **P-016 규정(`dangerously` 접두사) 준수 완료** ✅ — 이 함수 자체는 문제없으나, 신규 `useStreaming.js` 구현 시 스트림 강제 종료 함수에도 `dangerouslyAbortStream()` 형태의 네이밍 규칙 적용 필요 여부를 PRD가 명시하지 않음 |
| F-09 | 🟡 MEDIUM | 런타임 안정성 | 5절 파급 반경 | "기존 웹소켓 채널을 즉각 제거하지 않고 병렬 추가" → **WebSocket 이벤트와 SSE 이벤트가 동시에 같은 메시지를 프론트로 전달하는 이중 발송(Duplicate Event) 시나리오가 전환 기간 동안 발생할 수 있음**. 이를 방지하는 Feature Flag 또는 Mutex 설계 미명시 |
| F-10 | 🟢 LOW | 보안 | `ariDaemon.js` L1197 | `ARI_ALLOWED_MODELS` 배열 하드코딩. `modelRegistry.js` 상수를 참조하지 않아 **P-006 위반 경계선**에 있음. 직접 하드코딩이지만 모델 추가 시 두 곳 동기화 필요 |

---

## 🔴 GOD NODE 경보 없음

변경 대상 파일(`ariDaemon.js`, 신규 `useStreaming.js`)은 God Node 목록(DatabaseManager 84엣지, TenantMiddleware 28엣지, GeminiAdapter 26엣지 등)에 해당하지 않음.  
다만 **`ariDaemon.js`는 executeTool(), conversationHistory 등 50개 이상의 contains 관계**를 보유한 준-God Node급 파일임. 변경 시 주의 필요.

---

## STEP 1 — 실제 코드 확인 결과

### `ariDaemon.js` 도구 실행 루프 (L1282~1295) 직접 확인

```javascript
// 현재 코드 (L1286~1295)
for (const part of toolCallParts) {
  const { name, args } = part.functionCall;
  const result = await executeTool(name, args, projectId);  // ← 완전 블로킹
  toolResults.push({
    functionResponse: { name, response: result }
  });
}
// 이후 generateContentStream() 호출 (L1306)
```

**PRD 진단 완전 일치 확인**: `tool:start` / `tool:end` 이벤트가 존재하지 않음. `executeTool()` 완료 전까지 `res.write()` 호출 없음.

### `App.jsx` (크롬 익스텐션) 확인

- **현재 통신**: `socket.io` WebSocket 단방향. `extension:chat` emit → `extension:reply` 수신 구조
- **SSE 수신 코드 없음**: `EventSource` 또는 `fetch + ReadableStream` 패턴이 완전 부재
- **DOM 스냅샷 방식**: 직접 CSS selector 기반 상호작용 요소 50개 추출(L151~167). AOM 방식 미적용(현 구현과 PRD 4-4절 사이 간격 있음)

### `chatStore.js` 확인

- `dangerouslyPurgeAllChats()` L26 → P-016 네이밍 규칙 준수 ✅
- SSE 관련 스트림 상태 관리 없음 (신규 `useStreaming.js` 훅 개발 필요 확정)

---

## STEP 2 — Graphify Blast Radius 분석

### 변경 영향 파일 목록

| 파일 | 역할 | 영향도 |
|------|------|--------|
| `ariDaemon.js` | SSE `tool:start/end` 이벤트 삽입 | 🔴 직접 변경 (준-God Node, 50+ 연결) |
| `useStreaming.js` | 신규 훅 — SSE 파싱 + AbortController | 🟠 신규 생성 |
| `ChatPanel.jsx` / `App.jsx` | useStreaming 훅 연결 | 🟠 컴포넌트 로직 수정 |
| `chatStore.js` | 스트림 상태 추가 가능성 | 🟡 잠재적 영향 |
| `useSocket.js` | 기존 WebSocket + 신규 SSE 병행 기간 | 🟠 Duplicate Event 위험 |
| `TaskDetailModal.jsx` | tool 실행 상태 인디케이터 추가 | 🟡 잠재적 영향 |

### 커뮤니티 교차 영향

- `ariDaemon.js` (Community 6) → `useSocket.js` (Community 28) → `chatStore.js` (Community 28) → `App.jsx` (Community 11)
- **3개 이상의 Community 교차**: 백엔드(6) ↔ 프론트 Store(28) ↔ UI Layer(11) 모두 영향받음
- **설계 결합도 MEDIUM-HIGH**: SSE 전환은 독립적으로 구현 가능하나, WebSocket 병행 기간 동안 이중 이벤트 위험 존재

---

## STEP 3 — 6개 렌즈 분석

### 🔒 렌즈 1: 보안 (Security)

**결함 발견 (F-05, HIGH)**  
`4-4절` 크롬 익스텐션 AOM 도입 시 Content Script가 추출하는 DOM 정보에 비밀번호 입력 필드(`input[type=password]`), 결제 정보(`autocomplete="cc-number"` 등)가 포함될 위험이 있다. 현재 `App.jsx`의 DOM 스냅샷 추출 코드(L151~167)는 `button, a, input, textarea, select, [role="button"]`을 광범위하게 수집한다. PRD 4-4절이 이 필터링 로직을 명시하지 않아 구현 시 민감 정보 유출 벡터가 생길 수 있다.

**권고**: PRD에 `input[type=password], input[type=hidden], [autocomplete*="cc-"]` 셀렉터 명시적 제외 규칙을 추가해야 한다.

**추가 관찰**: `ariDaemon.js` L1197의 `ARI_ALLOWED_MODELS` 하드코딩(F-10). 하드코딩된 모델 식별자는 `modelRegistry.js`를 우회하며, P-006 경계선 위반이다.

---

### 🏗️ 렌즈 2: 아키텍처 (Architecture)

**결함 발견 (F-01, CRITICAL)**  
PRD 4-2절 도구 래퍼 설계에서 "1줄 추가"로 `tool:start` 이벤트를 삽입한다고 서술하나, `ariDaemon.js` L1286~1295의 `for (const part of toolCallParts)` 루프는 **다중 도구를 순차 실행**한다. PRD가 단일 도구 시나리오만 가정하여 다중 도구 호출 시 각 도구별 `tool:start/end` 쌍 발송이 누락될 수 있다. 구현 가이드에 루프 내부 이벤트 발송 패턴을 명시해야 한다.

**결함 발견 (F-06, HIGH)**  
크롬 익스텐션 Background Script의 SSE 수신 제약이 PRD에 반영되지 않았다. Manifest V3 환경에서 Background Service Worker는 지속적 네트워크 연결을 유지하지 못하며, SSE(`EventSource`)가 Worker 수명 주기와 충돌한다. **Offscreen Document 또는 Content Script SSE 중계 구조가 필요**하며 이는 별도 설계가 필요한 수준의 작업이다.

---

### 🔄 렌즈 3: 상태 정합성 (State Consistency)

**결함 발견 (F-03, HIGH)**  
`conversationHistory`는 `ariDaemon.js` 모듈 수준 변수(메모리 싱글턴)다. SSE 스트리밍 도중 서버가 재시작되면:  
1. 진행 중인 SSE 스트림이 `close` 이벤트를 발생시키지 않을 수 있음
2. 클라이언트의 `useStreaming` 훅이 연결 종료를 감지하지 못하고 무한 대기
3. 히스토리 유실로 에이전트가 컨텍스트를 잃음

PRD가 `req.on('close')` 핸들러(4-4절 크롬 익스텐션 섹션에서만 언급)를 **메인 `/api/compute` 엔드포인트에도 명시적으로 요구해야** 한다.

**결함 발견 (F-09, MEDIUM)**  
WebSocket + SSE 병행 전환 기간 동안 `chat:message` 소켓 이벤트와 SSE `text` 청크가 동시에 클라이언트로 전달될 수 있다. PRD가 Feature Flag 또는 버전 협상(Version Negotiation) 메커니즘을 명시하지 않아 UI 중복 렌더링 위험이 있다.

---

### 👤 렌즈 4: UX/사용자 흐름 (User Experience)

**결함 발견 (F-07, MEDIUM)**  
`tool:start` 이벤트의 `toolName` 값이 내부 식별자(`run_command`, `graphify_search`, `list_dir` 등)다. 사용자에게 노출될 때 "[run_command 실행 중...]"처럼 내부 기술 식별자가 노출된다. PRD가 `toolName → 사용자 친화적 표시명` 매핑 테이블을 명시하지 않아 구현자가 임의로 처리하게 될 가능성이 높다.

**결함 발견 (F-02, CRITICAL)**  
"30초 UI 타임아웃" 설정은 Graphify 전체 그래프 탐색, 터미널 장기 실행 명령 등 30초를 초과하는 정상 도구 실행을 거짓 에러로 처리한다. 이는 사용자가 "에이전트가 멈췄다"고 오인하게 만드는 UX 결함이다. 도구 카테고리별 차등 타임아웃(예: 경량 도구 15초, 터미널 120초)이 필요하다.

---

### ⚙️ 렌즈 5: 런타임 안정성 (Runtime Stability)

**결함 발견 (F-04, HIGH)**  
4-3절 Redis 캐싱에서 이벤트 유실 대비 "Redis TTL + 주기적 디렉토리 해시 체크(Fallback)"를 명시했으나, Redis 프로세스 자체가 내려간 경우(`ECONNREFUSED`) 의 처리가 없다. 실시간 파일 I/O로 즉각 전환하는 Circuit Breaker 패턴(예: `ioredis`의 `enableOfflineQueue: false` + 에러 핸들러)이 필요하다.

**F-03과 연계**: SSE 스트림 도중 서버 재시작 시 `req.on('close')` 핸들러로 `AbortController.abort()`를 호출하는 정리 로직이 `/api/compute` 엔드포인트에 반드시 추가되어야 한다.

---

### 📜 렌즈 6: 정책 준수 (Policy Compliance)

**F-10 (LOW) — P-006 경계선**  
`ariDaemon.js` L1197: `const ARI_ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']` 하드코딩. `modelRegistry.js`의 `MODEL` 상수를 사용하지 않는다. Phase 46 작업 범위에서 함께 수정을 권고한다.

**P-017 준수 확인 ✅**  
PRD 4-2절이 `useStreaming.js` 훅에 `AbortController` 필수 적용을 명시하고, "(P-017 규정 준수)"를 괄호로 표기했다. 정책 인식은 올바르다.

**P-016 확인 ✅**  
`chatStore.js` L26의 `dangerouslyPurgeAllChats()` 기준으로 기존 위험 함수 네이밍 규칙은 준수 중.

**신규 권고 (F-08)**  
`useStreaming.js` 신규 구현 시 SSE 강제 종료 함수에도 `dangerouslyAbortStream()` 형태를 검토할 것.

---

## 🏁 종합 판정

### 구현 착수 전 필수 해결 항목 (CRITICAL + HIGH)

| 우선순위 | 항목 | 조치 |
|---------|------|------|
| 1 | **F-01** 다중 도구 루프 내 tool:start/end 쌍 발송 패턴 명시 | PRD 4-2절 구현 가이드 보강 |
| 2 | **F-02** 도구 카테고리별 차등 타임아웃 설계 | PRD 4-2절 타임아웃 테이블 추가 |
| 3 | **F-03** `/api/compute` SSE 스트림에 `req.on('close')` 핸들러 명시 | PRD 4-2절 서버 안정성 항목 추가 |
| 4 | **F-04** Redis Circuit Breaker 패턴 설계 | PRD 4-3절 보강 |
| 5 | **F-05** AOM 민감 정보 필터링 규칙 명시 | PRD 4-4절 보안 항목 추가 |
| 6 | **F-06** 크롬 익스텐션 MV3 SSE 수신 제약 인식 및 Offscreen Document 설계 포함 | PRD 4-4절 아키텍처 수정 |

### 소넷 최종 의견

Phase 46의 핵심 아이디어(tool:start/end 이벤트 삽입으로 체감 지연 개선)는 **코드베이스 실사 결과 정확하고 유효하다.** 실제로 `ariDaemon.js` L1286~1295 구간이 완전 블로킹이며, `tool:start` 이벤트 삽입만으로 UX가 즉각 개선되는 것이 확인된다.

그러나 **크롬 익스텐션 SSE 아키텍처(F-06)는 MV3 제약을 고려하지 않은 설계 오류**로 별도 스프린트 수준의 재설계가 필요하다. Phase 46-A(ariDaemon SSE 이벤트)와 Phase 46-B(익스텐션 SSE) 작업을 명확히 분리하여 46-A를 먼저 안정 구현하고, 46-B는 MV3 제약 분석 후 별도 PRD로 분리할 것을 권고한다.

---

*Supreme Review 완료 — Sonnet (Claude Sonnet 4.6 Thinking) | 2026-05-16*
