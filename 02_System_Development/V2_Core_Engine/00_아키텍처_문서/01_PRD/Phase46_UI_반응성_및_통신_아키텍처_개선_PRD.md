# Phase 46 — UX 반응성(Latency) 최적화 및 통신 아키텍처 개선 PRD

> 작성자: 루카 (Luca)  
> 검토자: 소넷 (Sonnet) — 2026-05-16 인라인 보강  
> 작성일: 2026-05-16  
> 상태: **Supreme Review 완료 / 구현 전 필수 해결 항목 6건**  
> 연관 Phase: Phase 45 (MCP 루프 전환)

> 📋 **Supreme Review 결과**  
> - Luca 리뷰: `06_리뷰_아카이브/58_Phase46_UX_Latency_SupremeReview_Luca_2026-05-16.md`  
> - Sonnet 리뷰: `06_리뷰_아카이브/59_Phase46_UX_Latency_SupremeReview_Sonnet_2026-05-16.md`  
>
> | 결함 | 심각도 | 요약 |
> |------|--------|------|
> | F-01 | 🔴 CRITICAL | 다중 도구 루프에서 `tool:start/end` 쌍 발송 패턴 미명시 |
> | F-02 | 🔴 CRITICAL | 30초 고정 타임아웃 → 장기 도구(터미널·Graphify) 거짓 오류 |
> | F-03 | 🟠 HIGH | `/api/compute` SSE 스트림에 `req.on('close')` 핸들러 미명시 |
> | F-04 | 🟠 HIGH | Redis 다운 시 Circuit Breaker 패턴 미설계 |
> | F-05 | 🟠 HIGH | AOM DOM 추출 시 비밀번호·결제 필드 민감 정보 필터링 규칙 부재 |
> | F-06 | 🟠 HIGH | 크롬 익스텐션 MV3 Service Worker의 SSE 수신 제약 미반영 |
> | F-07 | 🟡 MEDIUM | `toolName` 내부 식별자 → 사용자 표시명 매핑 테이블 부재 |
> | F-08 | 🟡 MEDIUM | 신규 스트림 강제 종료 함수에 `dangerously` 접두사 적용 여부 미명시 |
> | F-09 | 🟡 MEDIUM | WebSocket+SSE 병행 기간 중복 이벤트 방지 Feature Flag 미설계 |
> | F-10 | 🟢 LOW | `ARI_ALLOWED_MODELS` 하드코딩 — `modelRegistry.js` 상수 미참조 (P-006) |

---

## 1. 배경 및 점검 목적

MyCrew v2가 MCP 서버 아키텍처로 전환되면서, 에이전트가 무거운 도구(Graphify 검색, 터미널 실행 등)를 빈번하게 호출하게 되었다. 

그러나 워크스페이스 우측 패널(채팅, 타임라인, 크롬 익스텐션)에서 사용자와 에이전트 간 통신 시, 에이전트의 응답 지연(Perceived Latency)이 심각하게 발생하고 있다. 이는 단순한 네트워크 지연이 아닌 통신 아키텍처 자체의 구조적 한계로 파악되어, 현황 점검 및 아키텍처 전면 개편을 수행하고자 한다.

**점검 대상**:
- `ariDaemon.js` 및 `executor.js`의 LLM 통신 및 도구 실행 제어 흐름
- `ChatPanel.jsx` 및 `TaskDetailModal.jsx`의 웹소켓 이벤트 수신 구조
- 크롬 익스텐션과 백엔드 간의 상태 동기화 파이프라인

---

## 2. 점검 결과 (AS-IS)

### 2-1. 에이전트 응답 및 도구 실행 (채팅/타임라인)

#### 실행 흐름 (현재)
```text
[프론트] 사용자가 프롬프트 전송
    ↓
[서버] ariDaemon.js: LLM에 전체 응답 생성 요청 (generateContent — Non-Streaming)
    ↓   ← [블로킹 #1] 도구 결정까지 전체 대기 (수 초)
[에이전트] LLM 모델 추론 중 (TTFT 병목)
    ↓
[서버] 도구 결정 후 executeTool() 동기 호출
    ↓   ← [블로킹 #2] 무거운 도구 실행 완료까지 서버 완전 정지
[서버] 도구 결과 포함 2차 응답 → generateContentStream (이 시점부터만 청크 전송)
    ↓
[프론트] 도구 실행이 끝난 뒤에야 타이핑 렌더링 시작
```

> 💡 **[Sonnet 코드 검증]** `ariDaemon.js` L1262 확인: 1차 LLM 추론은 `generateContent`(동기 블로킹)를 사용한다. 2차 최종 응답에서만 `generateContentStream`(L1306)이 적용되는 구조다. 사용자는 **도구 실행이 완전히 끝날 때까지 아무런 피드백도 받지 못한다**. `tool:start` / `tool:end` 이벤트 래퍼는 현재 코드베이스 전체에 **존재하지 않는다** — PRD의 결함 진단이 정확히 일치한다.
>
> [Prime] `chatStore.js`(33줄) 검증: SSE 수신/fetch 로직이 **전무**하며, 단순 Zustand persist 스토어로 `appendChat()` 1개 함수만 존재한다. 즉, **프론트엔드에 SSE 파싱 계층 자체가 없다** — `useStreaming.js` 신설은 선택이 아니라 필수 전제조건이다.

#### 진단

| 항목 | 현재 상태 | 평가 |
|------|-----------|:---:|
| 1차 LLM 추론 (도구 결정) | `generateContent` 동기 블로킹 | 🔴 TTFT 체감 지연 극대화 |
| 도구(Tool) 실행 | `executeTool()` 동기 await — 상태 이벤트 없음 | 🔴 시스템 응답 완전 중단 |
| 2차 LLM 응답 스트리밍 | `generateContentStream` 적용 완료 | ✅ 도구 결과 이후는 스트리밍 |
| `tool:start` / `tool:end` 이벤트 | **미구현** | 🔴 사용자 인지적 피드백 전혀 없음 |
| SSE 기반 도구 상태 중계 | **미구현** | 🔴 프론트엔드가 도구 실행 중임을 알 수 없음 |

**핵심 문제**: 문제는 두 개의 연쇄 블로킹이다. `generateContent`로 도구를 결정하는 동안 블로킹(#1), 이후 `executeTool()`을 동기적으로 await하는 동안 추가 블로킹(#2). 스트리밍은 이 두 단계가 모두 완료된 후에야 시작된다. 사용자는 총 5~30초가 소요되는 작업을 "Thinking..." 화면 하나로 감내해야 한다. [Prime] 추가로 SSE 헤더(`text/event-stream`)는 이미 L1226에서 설정되고 있으나, **도구 실행 구간(L1286~1295)에서 `res.write`가 한 번도 호출되지 않는다** — SSE 파이프가 열려있지만 침묵하는 구조.

---

### 2-2. 크롬 익스텐션 동기화

#### 진단

| 항목 | 현재 상태 | 평가 |
|------|-----------|:---:|
| 익스텐션 연결 | 양방향 웹소켓 상시 유지 | ⚠️ 연결 유지 리소스 비용 높음 |
| 단순 상태 동기화 | 웹소켓 이벤트 기반 푸시 | ⚠️ 불필요한 양방향 오버헤드 |
| DOM 분석 | 전체 HTML 원본 전달 추정 | ⚠️ LLM 토크나이징 비용 과다 |
| [Prime] 소켓 이벤트 하드코딩 | `extension:chat`, `extension:reply` 등 6개 | 🔴 `App.jsx` L27~L128에 직접 바인딩 |

**핵심 문제**: 단순한 텍스트 렌더링 및 상태 업데이트를 위해서도 무거운 양방향 소켓 통신을 유지해야 하며, 렌더링 최적화(Debouncing)가 되어있지 않아 잦은 이벤트 발생 시 DOM 과부하가 우려된다. [Prime] 코드 확인: 익스텐션 `App.jsx` L3에서 `socket.io-client`를 직접 import하며, `extension:chat`, `extension:reply`, `extension:confirm_action`, `extension:history_loaded` 등 **6개 소켓 이벤트**가 컴포넌트 내부에 하드코딩되어 있다 — SSE 전환 시 이 6개 이벤트를 모두 대체해야 한다.

---

## 3. 종합 진단 — 통신 아키텍처 현황

```text
┌────────────────────────┬───────────────────┬──────────────────────────────────┐
│ 대상                   │ 아키텍처 방식      │ 상태                             │
├────────────────────────┼───────────────────┼──────────────────────────────────┤
│ 1차 LLM 추론 (Tool 결정)│ generateContent   │ 🔴 동기 블로킹 — 즉시 개선 필요  │
│ MCP Tool 실행 제어     │ executeTool() await│ 🔴 도구 실행 시 UI 완전 침묵     │
│ tool:start/end 이벤트  │ 미구현            │ 🔴 사용자 피드백 부재             │
│ 2차 LLM 응답 스트리밍  │ generateContentStream│ ✅ 이미 적용 완료              │
│ UI 상태 인디케이터     │ 미구현            │ 🔴 프론트 수신 로직 없음          │
│ 통신 프로토콜          │ 단일 WebSocket    │ ⚠️ SSE와 하이브리드 전환 필요    │
└────────────────────────┴───────────────────┴──────────────────────────────────┘
```

> 💡 **[Sonnet 코드 검증]** 2차 응답 스트리밍(`generateContentStream`)은 이미 구현되어 있으므로, 이 부분은 TO-BE 작업에서 제외한다. **실제 개선 타깃은 1차 추론 단계와 `executeTool()` 래핑** 두 곳이다.

**결론**: 일부 스트리밍 인프라는 이미 갖춰져 있으나, **도구 결정~실행 구간 전체가 침묵 블로킹**이다. 이 구간에 `tool:start` 이벤트를 삽입하는 것만으로도 체감 지연을 즉각 개선할 수 있다.

---

## 4. TO-BE 설계 — 스트리밍 및 비동기 이벤트 루프

### 4-1. 설계 원칙 (Phase 46)

Phase 45의 MCP 루프 전환 기조를 유지하되, 프론트엔드와 백엔드 간의 체감 지연 시간을 "0"에 가깝게 만든다.

```text
백엔드는 결코 프론트엔드를 기다리게 하지 않는다.
생성되는 모든 토큰과 실행되는 도구의 상태 변화는 즉각적으로(스트리밍/이벤트) 클라이언트에 중계된다.
```

### 4-2. 스트리밍 및 비동기 도구 래퍼 설계

#### 목표 흐름
```text
[프론트] 사용자가 프롬프트 전송
    ↓
[서버] ariDaemon.js: 1차 LLM 추론 (generateContent — 도구 결정, 현재 구조 유지)
    ↓   ← 개선: 도구 결정 즉시 아래 이벤트 발송 (도구 실행 전)
[서버] res.write('data: {"type":"tool:start","toolName":"run_command"}\n\n') 즉시 발송
    ↓
[프론트] useStreaming.js 훅이 tool:start 수신 → "[터미널 실행 중...]" 스피너 즉시 표시
    ↓
[서버] executeTool() 비동기 실행 (도구 완료 대기)
    ↓
[서버] res.write('data: {"type":"tool:end","toolName":"run_command"}\n\n') 발송
    ↓
[서버] generateContentStream으로 2차 응답 스트리밍 (현재 구조 그대로 재사용)
    ↓
[프론트] 50~100ms Debouncing 후 메시지 버블 실시간 타이핑 렌더링
```

> 💡 **[Sonnet 인라인 코멘트]** 핵심 구현 포인트는 `ariDaemon.js` L1286~1295 (`for (const part of toolCallParts)` 루프) 직전에 `tool:start` 이벤트를 `res.write()`로 즉시 발송하는 것이다. 도구 실행 후 L1306 `generateContentStream` 전에 `tool:end`를 발송한다. **기존 2차 스트리밍 구조(L1306~L1324)는 그대로 보존**한다.

#### 현행 블로킹 아키텍처 개선 대상

| 파일 | 현재 상태 | 개선 내용 |
|------|-----------|-----------|
| `ariDaemon.js` L1286~1295 | [Prime] 도구 결정 후 무음 실행 (라인번호 교정: L1282→L1286) | `tool:start` 이벤트 삽입 (1줄 추가) |
| `ariDaemon.js` L1304~1315 | [Prime] 도구 완료 후 바로 2차 스트림 (라인번호 교정: L1305→L1315) | `tool:end` 이벤트 삽입 (1줄 추가) |
| `toolExecutor.js` | 이벤트 래퍼 없음 | (Phase 46-B) `tool:start/end` 래퍼 추출 공통화 |
| `useStreaming.js` | **신규 생성** | SSE 청크 수신 + `tool:start/end` 파싱 + AbortController 관리 |
| `ChatPanel.jsx` | SSE 수신 없음 | `useStreaming` 훅 연결 (컴포넌트 로직 최소화) |
| [Prime] `chatStore.js` | 단순 persist 스토어 (33줄, SSE 로직 0) | `useStreaming` 훅이 `appendChat()` 호출로 연동 |
| [Prime] 크롬 익스텐션 `App.jsx` | `socket.io-client` 직접 import, 6개 이벤트 하드코딩 | SSE 전환 시 별도 리팩토링 PR 필요 |

- **UI 수신기 분리 (God Node 방지)**: `ChatPanel.jsx`나 `TaskDetailModal.jsx`에 직접 SSE를 구현하지 않고, `useStreaming.js` 커스텀 훅으로 통신 계층을 분리. **(P-017 규정 준수: `AbortController`를 필수 적용하여 컴포넌트 언마운트 시 고스트 스트림 방지)** [Prime] 현재 `AbortController`는 `KanbanBoard.jsx` L52에 1건만 존재 — `useStreaming.js` 신설 시 **반드시 포함** 필수.
- **UI 타임아웃 안전망**: `tool:start` 수신 시 애니메이션 인디케이터(Status Indicator) 노출 로직 추가하되, 서버 크래시로 인한 무한 로딩 방지를 위해 UI 자체 Timeout(예: 30초) 설정.
- **통신 프로토콜 최적화 (하이브리드)**: 단방향 상태 푸시 및 LLM 응답은 SSE로 분리하고, 명령 실행은 REST API로 전환하여 웹소켓 소켓풀 부담 완화.

### 4-3. 컨텍스트 캐싱 및 상태 동기화 (Redis + File Watcher)

에이전트가 `list_dir`이나 `read_file` 등의 도구를 통해 워크스페이스 상태를 파악하는 데 소모되는 시간(Reasoning Time)을 단축하기 위해 인메모리 캐싱 시스템을 도입합니다.

#### 목표 흐름
```text
[백그라운드] File Watcher(예: Chokidar) 가 워크스페이스 디렉토리 변경 감시
    ↓
[서버] 파일 생성/수정/삭제 이벤트 감지 시 Redis 캐시 즉시 업데이트 또는 무효화
    ↓
[에이전트] 컨텍스트 조회(예: get_workspace_state 등) 도구 호출
    ↓
[서버] 실제 파일 시스템 I/O 없이 Redis에 캐싱된 최신 구조 즉각 반환 (오버헤드 0)
```

#### 현행 지연 발생 구간 개선 대상
- **파일 워처(File Watcher) 데몬 구축**: 실시간 이벤트 기반의 캐시 무효화(Invalidation) 로직 구현. 단, 워처 이벤트 유실(Drop)에 대비하여 **Redis TTL 적용 및 주기적 디렉토리 해시 체크(Fallback)** 로직 필수.
- **읽기 전용 도구(Read-only Tools) 최적화**: 디렉토리 트리 조회 시 Redis 캐시를 최우선으로 반환하도록 인터셉터(Interceptor) 패턴 적용.
- **Tenant Isolation (보안)**: 워크스페이스 캐시 Key는 반드시 `projectId` 접두사를 포함하여 프로젝트 간 데이터 오염(Leak)을 원천 차단.

### 4-4. 크롬 익스텐션 특화: 동적 화면 제어 및 크롤링 (Auto-QA 패턴 이식)

Auto-QA 단계에서 검증된 동적 화면 제어 및 시맨틱 트리 분석 방법론을 크롬 익스텐션(Ari) 환경에 이식하여, 브라우저 화면 인식과 데이터 크롤링 능력을 극대화합니다. 익스텐션 자체가 사용자의 브라우저 위에서 동작하는 "살아있는 데몬" 역할을 수행하게 됩니다.

#### 목표 흐름 (익스텐션 동적 제어)
```text
[프론트/익스텐션] 사용자가 화면 기반 지시 (예: "현재 화면의 표 데이터 크롤링해줘")
    ↓
[익스텐션] Content Script가 현재 페이지의 DOM을 AOM(Accessibility Object Model) 기반으로 경량화하여 전송
    ↓
[서버/에이전트] 수신된 AOM 트리를 분석하여 조작 대상(Selector) 또는 추출할 데이터 구조 식별
    ↓
[에이전트] 익스텐션 전용 MCP 제어 도구(예: `execute_extension_action`) 호출
    ↓
[서버] SSE 채널을 통해 익스텐션 Background Script로 조작 명령어 즉시 스트리밍
    ↓
[익스텐션] Content Script가 동적으로 버튼 클릭, 폼 입력, 데이터 크롤링 등을 수행 후 결과 반환
```

#### 핵심 개선 대상
- **DOM 경량화 파이프라인 (AOM 도입)**: 방대한 전체 HTML 소스를 그대로 LLM에 넘기는 대신, 접근성 트리(AOM)를 기반으로 의미 있는 요소(버튼, 링크, 텍스트 노드)만 추출·압축하여 전송함으로써 Payload 통신 지연 및 LLM의 컨텍스트 분석(Tokenizing) 시간을 비약적으로 단축.
- **Action Tool 체계화**: Auto-QA용 헤드리스 브라우저 데몬(Bun)의 명령어 체계를 크롬 익스텐션 Content Script 로직으로 포팅하여, `click`, `type`, `extract_list` 등 브라우저 화면을 직접 다룰 수 있는 범용 도구화.
- **연결 단절 예외 처리 (서버 안정성)**: 익스텐션 팝업이 닫히거나 탭 이동 시 SSE가 끊어질 경우를 대비해, 서버단에 `req.on('close')` 핸들러를 맵핑하여 진행 중인 에이전트 워커를 즉각 중단(Kill)하는 안전장치 필수 구현.

---

## 5. 파급 반경 (Blast Radius) 및 리스크 통제

- **영향도**: 기존 웹소켓 이벤트(`chat:message`, `task:updated`)에 강하게 결합되어 있던 UI 로직 전반. 특히 스트리밍 청크 누적 렌더링을 위한 `ChatMessage.jsx`의 상태 관리 전략(`useRef` 도입 등) 수정 필수.
- [Prime] **크롬 익스텐션 blast radius**: `App.jsx`에 `socket.io-client` 직접 import + 6개 소켓 이벤트 하드코딩 (L27~L128). SSE 전환 시 **독립 PR로 분리** 필수 — 대시보드와 동시 변경하면 양쪽 모두 깨질 위험.
- **리스크 통제**: 기존 웹소켓 기반 통신을 즉각 제거하지 않고, SSE 스트리밍 채널을 병렬로 추가하여 점진적 롤아웃 수행.
- **검증 기준**: TTFT(첫 토큰 도달 시간) 1초 이내 달성 및 무거운 MCP 도구 실행 시 UI 멈춤 없이 0.5초 이내에 상태 지시자 노출 확인.

> 💡 **[Sonnet 최종 코멘트]** `ariDaemon.js`는 이미 SSE 파이프(res.write)와 `generateContentStream`을 갖추고 있다. Phase 46-A의 실제 구현 난이도는 낮다 — `tool:start` 이벤트를 `executeTool()` 호출 직전에 삽입하는 **2줄 추가**만으로 사용자 체감 지연을 극적으로 개선할 수 있다. `useStreaming.js` 훅 신설 및 `ChatPanel.jsx` 연동은 프론트엔드 작업이며 별도 스프린트로 분리 진행이 가능하다.

---

## 6. 선결 사항 (Phase 46-A 착수 전 필수) [Prime]

0. **`chatStore.js` SSE 수신 계층 부재 해소**: 현재 33줄짜리 단순 스토어에 SSE 파싱 로직이 전혀 없으므로, `useStreaming.js` 훅 신설이 Phase 46-A의 **전제 조건**
1. **`ariDaemon.js` 라인번호 교정**: PRD 본문의 L1282~1295 → 실제 L1286~1295, L1304~1305 → L1304~1315로 수정 완료 (위 표 참조)
2. **크롬 익스텐션 소켓 이벤트 매핑 사전 작성**: `extension:chat`, `extension:reply`, `extension:confirm_action`, `extension:confirm_action_response`, `extension:load_history`, `extension:history_loaded` — 6개 이벤트의 SSE 대체 설계 필요
3. **`AbortController` 표준화**: 현재 KanbanBoard.jsx L52에 1건만 존재 — `useStreaming.js`에 필수 포함하고, 기존 fetch 호출에도 일괄 적용 검토
