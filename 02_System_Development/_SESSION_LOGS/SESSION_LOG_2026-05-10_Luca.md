# SESSION LOG: 2026-05-10 (Luca)

## 1. 구현 완료된 태스크 리스트 (Task List)
- [x] 1. 프론트엔드 통합 UI/UX 공사
  - [x] 1.1 `KanbanBoard.jsx`: 6단계 컬럼(`Backlog`, `To Do`, `In Progress`, `Review`, `Done`, `Finalized`) 구성
  - [x] 1.2 `KanbanBoard.jsx`: Archive 탭 분리 및 메인 보드에서 숨기기
  - [x] 1.3 `TaskDetailModal.jsx`: 채팅/코멘트 입력창 좌측에 4대 모드 변경 `+` 아이콘 추가
  - [x] 1.4 `TaskDetailModal.jsx`: 채팅/코멘트 입력창 좌측에 모델 변경 `Collapse` 아이콘 추가
  - [x] 1.5 `TaskDetailModal.jsx`: 선택된 모드/모델 텍스트를 입력창 상단에 작게 배치 (가시성 확보)
  - [x] 1.6 `TaskDetailModal.jsx`: 입력창 텍스트 길어질 시 세로로 위로 늘어나도록 (Auto-resize) 개선
  - [x] 1.7 `KanbanBoard.jsx`: `To Do` -> `In Progress` 드래그 시 Zero-Command Trigger (`/run_tasks`) 연동
- [x] 2. 백엔드 Router & Quota Defender
  - [x] 2.1 Intent Router 생성 (`intentRouter.js`)
  - [x] 2.2 Claude 쿼터 방어 Hotswap 구현 (`executor.js`)
  - [x] 2.3 API 연동 (`server.js`에 `/api/tasks/:taskId/run` 엔드포인트 추가)
- [x] 3. MCP 스킬 바인딩
  - [x] 3.1 6대 단순화 스킬 등록 (`mcp_server.js`)
  - [x] 3.2 Selective Tool Loading 구현

---

## 2. 작업 완료 보고서 (Walkthrough)

> [!TIP]
> 이제 MyCrew는 사용자가 "명령어"를 외우지 않아도 되는 **Zero-Command** 환경으로 완전히 전환되었습니다. 
> 사용자의 행동(드래그)과 코멘트의 자연어를 인텐트 라우터가 즉시 분석하여 최적의 에이전트와 도구를 할당합니다.

### 2.1 프론트엔드: 통합 UI/UX 고도화
**칸반 보드 표준화 및 Zero-Command 연동**
- 기존 4단계 컬럼에서 **[Backlog, To Do, In Progress, Review, Done, Finalized]** 6단계 표준 체계로 확장했습니다.
- 무겁게 존재하던 `Archive` 컬럼을 완전히 분리해 상단 버튼형 탭으로 숨겨 보드의 가시성을 크게 높였습니다.
- 카드를 `To Do`에서 `In Progress`로 드래그하는 순간, **백엔드의 `/api/tasks/:id/run` 트리거가 자동으로 호출**되는 Zero-Command 파이프라인을 구축했습니다.

**입력창 (TaskDetailModal) UI 개편**
- 입력창 바로 위쪽에 **선택된 모드 및 모델 (예: 💻 개발 모드 | Claude Sonnet 4.6)** 이 작고 우아하게 표시되도록 구현했습니다.
- 기존의 복잡한 버튼들을 치우고, 입력창 좌측 아래에 **[ ➕ (모드 선택) ]** 과 **[ ⏫ (모델 선택) ]** 아이콘만 직관적으로 배치했습니다.
- 우측 하단에는 **[ 전송 ]** 버튼만 깔끔하게 남겼습니다.
- 텍스트 입력 양이 늘어나면 자동으로 위로 자연스럽게 늘어나는 **Auto-resize** 기능을 최적화했습니다.

### 2.2 백엔드: Intent Router 및 Quota Defender (Hotswap) 탑재
> [!IMPORTANT]
> **Quota Defender**는 Claude API의 "일일 2시간 사용 제한" 병목을 막아주는 핵심 방어 체계입니다.

**Intent Router (`intentRouter.js`)**
- 사용자의 자연어 입력 또는 드래그 앤 드롭 이벤트를 받아 **초고속/저비용 모델(Gemini 1.5 Flash)**이 내부적으로 분석합니다.
- 사용자의 의도가 "기획"인지, "단순 코딩"인지, "디버깅"인지 판단하여 `[ARCHITECT, DEV, QA, DEBUG]` 모드로 맵핑합니다.

**Quota Defender / Hotswap (`executor.js`)**
- 작업 실행 전 `executor.js`에서 사용 모델이 Claude(Sonnet/Opus)인지 확인합니다.
- 만약 잔여 사용 쿼터가 **15분 미만**으로 감지될 경우, 시스템 로그를 띄우고 즉각적으로 무제한 사용 가능한 **Gemini 3.1 Pro** 엔진으로 우회(Hotswap)하여 작업이 중단되는 참사를 방어합니다.

### 2.3 MCP: Selective Tool Loading 바인딩
> [!NOTE]
> MCP 서버에서 클라이언트(Claude)에게 불필요한 도구를 던져 토큰이 낭비되는 것을 막습니다. (Claude Task Master 사상)

- **`mcp_server.js`** 내부에 6개의 명확한 단순화 도구를 등록했습니다.
- Node 환경 변수 `MYCREW_MODE` 값을 읽어들여, 현재 모드에 필요한 도구만 골라(`filter`) 클라이언트에게 반환하도록 **Selective Loading** 방식을 완벽하게 구현했습니다.

---

## 3. 구현 계획서 원본 (Implementation Plan)

본 계획서는 Phase 39 아키텍처를 실제 코드로 구현하기 위한 최우선 순위 태스크입니다. 사전 준비 작업으로 2개의 프롬프트 파일(인텐트 라우터, 모드별 시스템 프롬프트)이 성공적으로 작성되었습니다.

### 사전 작성 완료 파일
1.  **`Phase39_Intent_Router_Prompt.md`**: 사용자의 자연어/이미지 입력을 4대 모드로 자동 변환하는 라우터 에이전트용 프롬프트.
2.  **`Phase39_Mode_System_Prompts.md`**: 모드 전환 시마다 주입되는 에이전트 역할 부여 프롬프트 (Architect, Dev, QA, Debug).

### 구현 태스크 리스트 및 우선순위 (Task List)
**Priority 1: 프론트엔드 통합 UI/UX 기반 공사**
- `frontend/src/components/KanbanBoard.jsx`: 6단계 컬럼 확장, `Archive` 탭 분리, Zero-Command Trigger 추가.
- `frontend/src/components/ChatInput.jsx`: 입력창 아이콘 배치 개편 및 상태 연동.

**Priority 2: 백엔드 Intent Router 및 Hotswap (Quota Defender) 구현**
- `backend/src/services/intentRouter.js`: 신규 생성. 초경량 라우터 로직.
- `backend/src/services/executor.js`: Quota Defender Hotswap 로직 추가.

**Priority 3: MCP 서버 스킬 세팅 및 선택적 로딩**
- `backend/src/mcp_server.js`: 6대 스킬 등록 및 Selective Loading 구현.

**Priority 4: Graphify + Cypher 디버깅 파이프라인 (다음 단계 진행 예정)**
- `backend/src/tools/debugTool.js`: `trace_bug` 로직.

---

## 4. 최종 리뷰 결과 (Prime)
- **등급:** 🟢 A — 정식 승인 (Pass)
- **조건부 결함 모두 해결 완료** (runDirect 내 Quota 방어, MCP 동적 모드 전환, 절대경로 하드코딩 제거)
- **향후 인지/개선 사항 (승인 차단 아님):**
  1. MCP 도구 6개가 현재 Mock 상태이므로, 다음 Phase(Graphify 및 Cypher 적용)에서 실제 로직으로 교체 필요.
  2. 프론트엔드 API `/run` 호출 시 `intent`와 `mode` 혼합 전달 구조를 명확히 분리 권장.

---

## 5. [추가] Graphify 백엔드 아키텍처 연동 완료 (Phase A & C)

**진행 완료된 태스크:**
- **AST 파서 (`graphify_mcp.py`)**: 정규식을 통해 `import/require` 구문을 추출하여 JavaScript/TypeScript/JSX 프로젝트의 의존성 그래프(`graph.json`)를 생성하는 로직 구축.
- **Cytoscape.js 시각화기**: 파이썬 데몬에서 `graph.html`을 직접 렌더링하도록 자동 생성 로직 완성.
- **Cypher 검색 (`query_graph`)**: BFS 알고리즘 기반으로 `shortest_path(A, B)` 및 `dependencies(A)`를 파싱하여 검색 결과 반환 로직 구현.
- **Watchdog 실체화**: `graphifyWatchdog.js`에서 파이썬 데몬을 직접 호출하여 프로젝트의 지식 그래프를 갱신하도록 통합.

**[완료] 프론트엔드 UI 연동 (Sonnet):**
- **메인 탭 영역 (`KanbanBoard.jsx`)**: 메인 뷰 상단에 **[칸반 보드 | 지식 그래프]** 탭 구조를 완성하고, Iframe을 통해 전체 아키텍처 그래프 뷰 전환 기능 구현 완료.
- **태스크 모달 영역 (`TaskDetailModal.jsx`)**: 우측 영역 상단에 **[Preview] / [Graph]** 탭 분할 및 렌더링 연동 완료. (Fallback 포트 4010 통합)

## 6. [추가] 브랜딩 적용 및 익스텐션 UI/UX 최적화

**진행 완료된 태스크:**
- **크롬 익스텐션 브랜드 적용**: 기존 Terminal 아이콘을 Antigravity 로고(`mycrew_logo_transparent.png`)로 전면 교체 완료.
- **백그라운드 투명화**: Python `Pillow` 스크립트(`remove_bg.py`)를 작성하여 로고 이미지 모서리의 흰색 찌꺼기와 안티앨리어싱을 정교하게 제거.
- **파비콘 일원화**: 익스텐션 툴바 아이콘 및 패널 상단 파비콘을 위해 사이즈별(16, 48, 128) 로고 리사이징 후 `manifest.json` `icons` 및 `action.default_icon`에 매핑 완료.
- **System Action 프롬프트 안정화**: 익스텐션 환경에서 AI(Antigravity)가 카드를 생성할 때 랜덤 ID를 지어내던 환각(Hallucination) 버그 수정. `server.js`의 프롬프트를 강화하여 `system_action` JSON을 강제 출력하게 하고, `CREATE_TASK` 시퀀스에서 담당자(`assignee`)가 정상적으로 할당되도록 로직 보완 및 핫픽스 적용.

## 7. [추가] Zero-Command UX 통합 및 Cross-Mode Handoff 설계

**진행 완료된 태스크:**
- **레거시 슬래시 커맨드 제거**: `/run`, `/run-b`, `/stop` 등의 레거시 커맨드 인터셉트 로직을 `TaskDetailModal.jsx`와 `LogDrawer.jsx`에서 전면 제거하여 백엔드의 Zero-Command 라우터로 책임을 단일화함.
- **CTA 팝업 제거**: 가입 직후 나타나던 파이프라인 시작 프롬프트(`PipelineStartPrompt`) 컴포넌트를 `App.jsx`에서 제거하여 초기 UX를 극도로 단순화함.
- **Cross-Mode Handoff(교차 모드 문맥 주입) 설계**: 개발 중 기획 모드로 전환 후 다시 복귀 시, "직전까지 작업한 코드"와 "업데이트된 최신 기획(PRD)"을 동시에 주입하고 시스템 프롬프트 레벨에서 선행 Diff 분석을 강제하는 정교한 컨텍스트 병합 로직을 기획서 및 `server.js`에 탑재 완료.
