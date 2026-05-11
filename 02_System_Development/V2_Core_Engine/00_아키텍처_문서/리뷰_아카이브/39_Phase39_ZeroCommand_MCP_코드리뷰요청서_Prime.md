# Phase 39: Zero-Command UX & MCP 아키텍처 구현 코드 리뷰 요청서 (To Prime/Sonnet)

## 1. 개요
- **작성자:** Luca
- **리뷰어:** Prime (또는 Sonnet)
- **목적:** Phase 39에서 기획된 Zero-Command UX(명령어 없는 직관적 UI)와 Claude 토큰 제약을 우회하기 위한 백엔드 Quota Defender, 그리고 MCP Selective Tool Loading 구현에 대한 구조 및 코드 정합성 검토 요청.

## 2. 주요 변경 사항 및 검토 포인트

### A. 프론트엔드 (React / UI)
**[변경 파일]** `KanbanBoard.jsx`, `Column.jsx`, `TaskDetailModal.jsx`
1. **6단계 컬럼 확장 및 보관소 분리**: 기존 4단계에서 `Backlog`, `To Do`, `In Progress`, `Review`, `Done`, `Finalized` 6단계로 확장하고, `Archive`를 우측 상단 탭으로 숨겨 가시성을 높였습니다.
2. **Zero-Command Trigger**: `KanbanBoard.jsx`의 `handleDragEnd` 이벤트에서 카드가 `To Do` → `In Progress`로 이동할 때 명시적 명령어 입력 없이 즉시 백엔드의 `/api/tasks/:taskId/run`을 호출하도록 연동했습니다.
3. **TaskDetailModal UI 개편**:
   - 하단 툴바 좌측에 모드 전환용 `[ + ]`, 모델 교체용 `[ ⏫ ]` 아이콘 배치.
   - 입력창 바로 상단에 현재 `[ 선택된 모드 | 모델 ]` 텍스트 상태값을 우아하게 노출.
   - `Auto-resize` 속성을 통해 자연스러운 높이 조절 적용.

**👉 검토 요청 포인트:**
- UI/UX 변경 사항이 Phase 39 기획의 `Zero-Command` 사상(사용자의 타이핑 최소화)을 잘 만족하고 있는지 검토 부탁드립니다.
- 컴포넌트의 상태(State) 관리가 모달과 칸반 보드 간 사이드 이펙트를 유발하지 않는지 확인 바랍니다.

### B. 백엔드 (인텐트 라우터 및 Hotswap)
**[변경 파일]** `ai-engine/services/intentRouter.js`, `ai-engine/executor.js`, `server.js`
1. **`intentRouter.js` 신규 생성**: 
   - 사용자의 드래그 트리거나 자연어 텍스트를 `[ARCHITECT, DEV, QA, DEBUG]` 모드로 맵핑합니다. 
   - 속도와 비용을 고려해 `Gemini 1.5 Flash` 기반의 `callLLM` 로직으로 가볍게 처리하도록 설계했습니다.
2. **`executor.js` (Quota Defender)**:
   - Claude(Sonnet/Opus) API 사용 시 일일 쿼터 제한(2시간) 도달을 방어하기 위해, `modelToUse` 파이프라인 구간에 **Gemini 3.1 Pro로 Hotswap(강제 우회)**하는 Hook을 탑재했습니다.
3. **`server.js`**:
   - Zero-Command 실행을 처리하기 위한 `POST /api/tasks/:id/run` 엔드포인트를 추가하고, 내부적으로 `intentRouter`를 거쳐 `forceRedispatchTask`로 연결했습니다.

**👉 검토 요청 포인트:**
- `intentRouter.js`의 프롬프트 호출 방식 및 `executor.js`의 Hotswap 로직이 기존의 `modelSelector` 및 `adapters`와 충돌하지 않는지 검토 바랍니다.
- ESM/CommonJS 모듈 호환성 방어 측면에서 `intentRouter.js` 구조가 올바른지 확인 바랍니다.

### C. MCP (Selective Tool Loading)
**[변경 파일]** `mcp_server.js`
1. **6대 스킬 등록**: `analyze_scope`, `split_roadmap`, `run_tasks`, `trace_bug`, `extract_graph`, `audit_code`를 `ListToolsRequestSchema`에 명시했습니다.
2. **Selective Loading**: 클라이언트(Claude)로부터 불필요한 토큰 낭비를 막기 위해, Node 환경 변수 `process.env.MYCREW_MODE`를 읽어 현재 4대 모드에 딱 필요한 스킬 2개씩만 묶어 반환하도록 필터링을 걸었습니다.

**👉 검토 요청 포인트:**
- MCP 표준 스펙과 `ListToolsRequestSchema`의 동적 필터링(Selective Loading) 접근법이 적절한지 보안 및 스펙 측면에서 리뷰 부탁드립니다.

---

## 3. 후속 과제 (Next Phase)
본 리뷰가 통과되면, Phase 39의 마지막 관문인 **"Graphify MCP 서버와 연동한 `trace_bug` Cypher 디버깅 역추적 테스트"**로 진입할 예정입니다.

감사합니다.
