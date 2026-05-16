**리뷰어**: Luca (Gemini)
**리뷰 대상**: `/00_아키텍처_문서/01_PRD/Phase46_UI_반응성_및_통신_아키텍처_개선_PRD.md`
**리뷰 일시**: 2026-05-16
**이전 리뷰**: 최초 리뷰

---

## 🚨 1. 결함 요약 매트릭스

| 렌즈 | 결함 수준 | 내용 | 해결 우선순위 |
|------|-----------|------|--------------|
| 아키텍처 | **CRITICAL** | `TaskDetailModal` / `useSocket` God Node 심화 우려 | P0 (구현 전 해결) |
| 안정성 | **HIGH** | SSE 연결 단절 시 예외 처리 및 좀비 상태 우려 | P0 (구현 전 해결) |
| 상태 정합성 | **HIGH** | File Watcher 유실에 따른 영구적 Stale Cache 위험 | P1 |
| UX | **MEDIUM** | `tool:end` 유실 시 스피너 무한 로딩 문제 | P1 |
| 보안 | **LOW** | Redis 워크스페이스 캐시 격리(Tenant Isolation) 명시 누락 | P2 |
| 정책 준수 | **MEDIUM** | P-017(AbortController 의무화) SSE 스트림 적용 누락 | P1 |

---

## 🔍 2. Graphify 기반 파급 반경 (Blast Radius) 분석

- **호출 도구**: `mcp_graphify_god_nodes`, `mcp_graphify_get_neighbors`, `mcp_graphify_query_graph`
- **대상 분석**: `TaskDetailModal()`, `executor.js`, `ariDaemon.js`

### 🔴 GOD NODE 경보
Graphify 분석 결과, PRD에서 SSE 수신기를 추가하겠다고 명시한 타겟 중 두 곳이 현재 시스템의 최상위 **God Node**입니다.
1. `TaskDetailModal()`: Rank 9 (22 edges)
2. `useSocket()`: Rank 7 (23 edges)

**아키텍처 위험**: 현재 `TaskDetailModal.jsx`는 이미 `WORKFLOW_STEPS`, `useUiStore`, `useSocket`, `ContextChainPanel` 등 방대한 의존성을 끌어안고 있습니다. 여기에 SSE 스트리밍 청크 누적 관리 로직과 도구 상태 스피너 렌더링 로직까지 추가하면 컴포넌트가 붕괴(God Object)될 위험이 큽니다.

---

## 🛡️ 3. 6개 렌즈 심층 분석 (Lenses Analysis)

### 1) 🏗️ 아키텍처 (Architecture)
- **결함**: `ChatPanel.jsx` / `TaskDetailModal.jsx`에 직접 SSE 수신기를 구현하겠다는 설계.
- **해결 방안**: 통신 로직을 분리해야 합니다. `useStreaming.js` 또는 `useSSE.js` 커스텀 훅을 신설하여, 컴포넌트는 오직 상태(Text Chunk, Tool Status)만 주입받도록(Data Fetching Layer 분리) 아키텍처를 수정해야 God Node 비대화를 막을 수 있습니다.

### 2) ⚙️ 런타임 안정성 (Runtime Stability)
- **결함**: 크롬 익스텐션(AOM 도입)에서 Background Script로 조작 명령어를 스트리밍할 때, 유저가 브라우저 탭을 닫거나 이동하면 SSE 연결이 비정상 종료됩니다.
- **해결 방안**: `server.js` 및 `ariDaemon.js`의 SSE 발송부(Emitter)에 `req.on('close')` 핸들러를 강력하게 구현하여, 클라이언트 이탈 시 진행 중인 에이전트 루프와 워커를 즉각 중단(Kill)하는 로직이 추가되어야 합니다.

### 3) 🔄 상태 정합성 (State Consistency)
- **결함**: 섹션 4-3의 "File Watcher 기반 Redis 캐싱". Chokidar 등 파일 워처는 OS 리소스 한계나 순간적인 I/O 폭주 시 이벤트를 유실(Drop)하는 고질적 문제가 있습니다.
- **해결 방안**: 파일 워처의 이벤트에만 100% 의존하면 안 됩니다. 캐시에 TTL(Time-To-Live)을 설정하거나, 주기적으로(예: 1분) 최상위 디렉토리 해시를 대조하는 Fallback 무효화 메커니즘을 설계에 명시해야 합니다.

### 4) 👤 UX / 사용자 흐름 (User Experience)
- **결함**: `tool:start` 이벤트 수신 시 UI에 스피너(`[작업 시작: 터미널 실행 중...]`)를 띄우고, `tool:end` 수신 시 스피너를 내립니다. 만약 서버 에러로 `tool:end`가 발송되지 않으면 UI는 영원히 "실행 중" 상태에 갇힙니다.
- **해결 방안**: UI 컴포넌트 레벨에서 도구 실행 스피너에 대한 자체 Timeout(예: 30초)을 설정하고, 타임아웃 도달 시 사용자에게 "응답 지연" 경고를 띄우고 스피너를 해제하는 안전망이 필요합니다.

### 5) 🔒 보안 (Security)
- **결함**: 섹션 4-3에서 Redis에 전체 워크스페이스 구조를 캐싱한다고 했습니다. 
- **해결 방안**: 향후 다중 사용자/다중 프로젝트 환경을 고려할 때 캐시 Key에 반드시 `projectId` 접두사를 붙여 격리(Tenant Isolation)해야 한다는 원칙이 설계에 명시되어야 합니다.

### 6) 📜 정책 준수 (Policy Compliance)
- **결함**: **P-017 (AbortController 의무화)** 규칙 위반 소지.
- **해결 방안**: 기존 웹소켓은 페이지 전환 시 끊어지지만, 새롭게 도입하는 SSE Fetch 스트림은 SPA 환경에서 컴포넌트가 언마운트되어도 백그라운드에 남아있을 수 있습니다. PRD 설계상 `AbortController`를 사용해 스트림을 정리(Cleanup)하는 지침이 필수적으로 포함되어야 합니다.

---

## 📋 4. 결론 및 다음 단계 (Next Steps)

> **총평**: 통신 병목을 해결하기 위한 SSE / 비동기 워커 도입 방향성 및 크롬 익스텐션 AOM 이식 아이디어는 훌륭하나, **UI God Node 심화 방지(분리 설계)**와 **네트워크 단절 시 예외 처리**가 누락되어 구현 시 큰 장애를 초래할 수 있습니다.

**요청 사항**: 
본 리뷰의 🚨 **결함 요약 매트릭스 P0, P1 항목**을 반영하여 `Phase46_UI_반응성_및_통신_아키텍처_개선_PRD.md` 문서를 보강(수정)한 후 구현 단계로 넘어가야 합니다.
