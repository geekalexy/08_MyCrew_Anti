# Phase 39-2: Plan Master 개발구현계획서 (Task List)

**작성일**: 2026-05-13  
**작성자**: Luca  
**상태**: 🔧 패치 완료 — 통합 테스트 대기  
**기준 문서**: [Phase39-1_Plan_Master_관련_기획서](Phase39-1_Plan_Master_관련_기획서.md)  
**아키텍처 감사 리포트**: [plan_master_architecture_audit.md](../../../../../.gemini/antigravity/brain/3270c5ac-7e9c-4bd6-83ea-22a58e4cb5e3/artifacts/plan_master_architecture_audit.md)

---

## 1. 개요
본 문서는 `Phase39-1_Plan_Master_관련_기획서.md`를 바탕으로 구축된 Plan Master 파이프라인의 구조적 한계(단발성 Mocking)를 극복하고, 진정한 Sequential Thinking MCP 및 실시간 UI 스트리밍(Phase 39-2)을 구현하기 위한 상세 개발 체크리스트입니다.

---

## 2. 개발 체크리스트 (Task List)

### 📌 2.1 백엔드: MCP 도구 및 파이프라인 실제 구현 (`mcp_server.js`, `executor.js`)
- [x] **`analyze_scope` 도구 로직 구현**:
  - Sequential Thinking JSON(`thought`, `thoughtNumber`, `nextThoughtNeeded`) 구조화 반환 강제 적용.
  - `needs_clarification` 분기 시 객관식 옵션 반환, 구체적일 시 `must_have`/`nice_to_have` 분류 반환.
- [x] **`make_roadmaps` 도구 로직 구현**:
  - `.mycrew/docs/roadmaps/` 디렉토리에 `v1.0_MVP_PRD.txt`, `v2.0_ScaleUp_PRD.txt` 버전별 PRD 파일 물리적 자동 생성 I/O 파이프라인 구축 완료.
  - DB 칸반 카드 자동 생성 로직: `server.js`의 `/plan-master/generate-roadmaps` 엔드포인트에서 `mvp_tasks` → BACKLOG 카드, `future_scope` → `[확장 버전]` 태그 백로그 카드 자동 생성.
  - `io.emit('task:bulk_created')` 소켓 브로드캐스트로 UI 실시간 갱신.
  - Graphify `graph_nodes` 파라미터를 통한 Future Scope 노드 등록 연동.
- [x] **`confirm_mvp` 도구 로직 및 상태 제어 구현**:
  - `pending_user_confirm` 상태 반환 및 `action_required: 'confirm_or_revise'` 필드로 프론트엔드 액션블록 트리거.
  - `POST /api/projects/:id/plan-master/confirm` 신규 API 엔드포인트 추가: `action: 'confirm'` → PRD `.locked` 파일 생성(락온), `action: 'revise'` → 피드백 반영 재분석 안내.
  - Iterative Review 루프: 사용자가 `revise`를 선택하면 프론트엔드에서 `/plan-master/analyze`를 재호출하는 무중단 피드백 루프 구현.

### 📌 2.2 백엔드: 다중 모델 라우팅 (Quota Defender 연동)
- [x] **초기 스코프 라우터 연동**: `/plan-master/analyze` 엔드포인트에서 `anti-claude-sonnet-4.6-thinking` 모델로 1차 스코프 분류 및 로드맵 초안 작성 라우팅 적용 확인.
- [x] **심층 기획 마스터 라우팅**: `/plan-master/generate-roadmaps` 엔드포인트에서 `anti-claude-opus-4.6-thinking` 모델로 승격 적용 완료. 비즈니스 리스크 분석 및 최종 PRD 분할에 Opus 투입.

### 📌 2.3 프론트엔드: Sequential Thinking UX 구현 (`TaskDetailModal.jsx`)
- [x] **사고 과정 시각화 (Activity 탭)**:
  - 시스템 로그 JSON 파싱 시 `thoughtNumber`를 그라디언트 원형 뱃지로 렌더링하는 타임라인 UI 추가.
  - `nextThoughtNeeded` 값에 따라 '사고 진행 중...' / '사고 완료' 상태 텍스트 표시.
  - `status` 필드를 컬러 태그 뱃지(`pending_user_confirm`: 주황, 기타: 초록)로 시각화.
- [x] **Graphify 스플릿 뷰(Split-view) 프리뷰 연동**:
  - 이전 세션에서 구현 완료 확인: Preview 클릭 시 우측 Graph 탭에서 `graph.html` Iframe 렌더링 정상 작동.

### 📌 2.4 프론트엔드: 사용자 협상 인터페이스 (Shrimp UX)
- [x] **대기 및 컨펌(Confirm) UI 구현**:
  - `pending_user_confirm` 상태 감지 시, Activity 탭 내에 [ ✅ 확정하고 개발 시작 ] / [ 📝 기획 수정 요청 ] 액션블록 버튼 인라인 렌더링.
  - Confirm 클릭 → `/plan-master/confirm` API(`action: 'confirm'`) 호출 + 토스트 알림.
  - 수정 요청 클릭 → `prompt()` 입력창에서 피드백 수집 → `/plan-master/confirm` API(`action: 'revise'`) 호출 + 토스트 알림.

### 📌 2.5 프론트엔드: Plan Master 모드 전환 연동 버그 패치 ← **2026-05-12 추가**
> 상세 내역: [Phase39-1_Plan_Master_디버깅리포트_v1](Phase39-1_Plan_Master_디버깅리포트_v1.md)

- [x] **[BUG-01] ARCHITECT 모드 선택 시 담당자(Assignee) 미자동 배정 수정** (`TaskDetailModal.jsx`):
  - 모드 onChange 핸들러에서 `model`만 변경하고 `assignee`를 누락하던 버그 수정.
  - CEO/미할당 상태일 경우 모드별 기본 에이전트 자동 배정 (ARCHITECT/DEV → `dev_senior`, QA → `dev_advisor`).
- [x] **[BUG-02] CEO 담당자 상태에서 실행 버튼 비활성화 (BUG-01 연쇄)** (`TaskDetailModal.jsx`):
  - BUG-01 수정으로 자동 해소.
- [x] **[BUG-03] `handleStartTask`가 ARCHITECT 모드를 일반 실행과 동일하게 처리** (`TaskDetailModal.jsx`):
  - 기존: 단순 `PATCH column: in_progress` → plan-master 파이프라인 미호출.
  - 수정: ARCHITECT 모드 시 `PlanMasterModal` 오픈 → Sonnet→Opus 파이프라인 정상 진입.
  - 기획 완료 후 `onSubmit` 콜백에서 태스크 자동 REVIEW 이동.
  - 그 외 모드: `POST /api/tasks/:id/run` (Zero-Command Router) 경유로 변경.
- [x] **[BUG-04] `task:bulk_created` 소켓 이벤트 핸들러 누락** (`useSocket.js`):
  - 핸들러 부재로 generate-roadmaps 결과 카드들이 즉시 칸반에 반영 안 되는 문제 수정.
  - 신규 핸들러: `GET /api/tasks?projectId=xxx` fetch → 신규 taskIds 필터 → `kanbanStore.addTask()` 즉시 반영.
- [x] **[BUG-05] `PlanMasterModal` confirm API 미연동** (`PlanMasterModal.jsx`):
  - "이대로 확정" 버튼 클릭 시 `POST /plan-master/confirm { action: 'confirm' }` 호출 추가.
  - DB `plan_master_status: LOCKED` + `v1.0_MVP_PRD.locked` 파일 생성 정상화.

### 📌 2.6 백엔드: Native Tool Calling 및 Agentic Loop 적용 (Phase 39-2 신규)
- [x] **`antigravityAdapter.js` MCP 도구 연동**:
  - `generateResponse`에 `tools` 파라미터를 추가하여 IDE Bridge `requestJson` 내에 Native Tool Calling 스키마가 주입되도록 수정.
  - `mcp_server.js`의 `ALL_TOOLS`를 `export` 처리하여 연동 확보.
- [x] **`server.js` 파이프라인 루프 리팩토링 (`/analyze`)**:
  - 단일 샷 JSON 파싱 구조를 `while (nextThoughtNeeded)` 기반의 다중 사고(Agentic) 루프로 재작성.
  - 매 단계의 사고 과정(`accumulatedThoughts`)을 다음 프롬프트 컨텍스트에 누적 주입.
- [x] **`server.js` SRP 분리 (`/generate-roadmaps`)**:
  - 단일 책임 원칙(SRP) 위반을 해소하기 위해, 기존의 통합 프롬프트를 `make_roadmaps` 도구 호출과 `confirm_mvp` 도구 호출로 분할.
  - 두 단계 모두 독립된 `while` 루프를 적용하여 순차적 사고 흐름 강화.

### 📌 2.7 프론트엔드: "사고 진행 중..." 실시간 UX 스트리밍 (Phase 39-2 신규)
- [x] **Socket.IO 이벤트 연동 (`PlanMasterModal.jsx`)**:
  - 서버에서 전송되는 `plan-master:thinking`, `plan-master:thought_update` 이벤트를 `useSocket`으로 구독.
  - `thinkingLogs` 배열 상태를 관리하여 사고 과정이 1단계, 2단계 순으로 화면에 적층 렌더링되도록 구현.

---

## 3. 테스트 시나리오

### ✅ 기존 시나리오
- [ ] **시나리오 A (정상 스코프 분리)**: "결제, 소셜 로그인, 게시판, 채팅 기능이 들어간 앱을 1주일 안에 만들어줘" 요청 시, 에이전트가 게시판 위주의 MVP를 제안하고 나머지를 Backlog 카드 및 v2.0 PRD로 정상 분리하는지 확인.
- [ ] **시나리오 B (반복 협상 루프)**: MVP 제안을 거절하고 "채팅은 무조건 1.0에 들어가야 해"라고 피드백 시, 에이전트가 다시 스코프를 재조정하여 컨펌을 대기하는 루프 검증.
- [ ] **시나리오 C (Graphify 렌더링)**: 분리된 2.0 스코프가 Preview 스플릿 뷰에서 Graphify 노드로 정상 렌더링되는지 확인.

### 🆕 버그 패치 후속 테스트 시나리오 (2026-05-12 추가)
- [ ] **[T-01] 모드 전환 담당자 자동 배정**: ARCHITECT 선택 → 담당자가 `dev_senior`로 즉시 변경 + 토스트 알림 + 실행 버튼 즉시 활성화.
- [ ] **[T-02] 실행 버튼 → PlanMasterModal 오픈**: ARCHITECT + dev_senior 상태에서 실행 클릭 → PlanMasterModal 정상 오픈.
- [ ] **[T-03] 칸반 즉시 반영**: generate-roadmaps 완료 후 새로고침 없이 백로그 카드 즉시 표시.
- [ ] **[T-04] confirm LOCKED 상태**: "이대로 확정" 후 DB `plan_master_status = LOCKED` 확인 + 원래 태스크 REVIEW 이동 확인.
- [ ] **[T-05] 피드백 재기획 루프**: revise 요청 → 스코프 재분석 → 새 로드맵 제안 → 반복 (MAX 5회).
- [ ] **[T-06] 멀티 프로젝트 격리**: 다른 프로젝트의 bulk_created 이벤트가 현재 프로젝트 칸반에 混入되지 않는지.

### 🆕 Phase 39-2 추가 테스트 시나리오
- [ ] **[T-07] 다단계 사고 스트리밍 확인**: 분석 및 로드맵 도출 시 UI(PlanMasterModal)에서 "[Step 1]... [Step 2]..." 형식으로 실시간 사고 과정이 스트리밍되는지 확인.
- [ ] **[T-08] 도구 분할 작동 확인**: 로드맵 생성 시 `make_roadmaps` 루프와 `confirm_mvp` 루프가 연속적으로 실행되어 최종 브리핑 메시지가 도출되는지 확인.

---

## 4. 백로그 (Backlog)

> 이번 세션에서 수정하지 않았거나, 추가 검토가 필요한 항목

- [ ] **[BACKLOG-01] Sonnet API 응답 타임아웃 모니터링**: 2분 타임아웃이 실제 운영에서 충분한지 측정 후 조정 필요.
- [ ] **[BACKLOG-02] needs_clarification 옵션 선택 후 자동 재분석**: 현재 옵션 선택 → 텍스트 append 후 수동 재분석 버튼 클릭 필요. 자동 재분석 트리거로 UX 개선 가능.
- [ ] **[BACKLOG-03] PlanMasterModal 기존 task.content 자동 prefill**: ARCHITECT 모드 실행 시 카드 본문(요구사항)이 이미 있다면 요구사항 입력창에 자동 입력.
- [ ] **[BACKLOG-04] Opus JSON 파싱 실패율 모니터링**: Fallback 진입 빈도 추적을 위한 로그 메트릭 추가.
- [ ] **[BACKLOG-05] bulk_created 중복 addTask 방지 로직 강화**: 이미 kanbanStore에 존재하는 taskId 필터링 추가.
- [ ] **[BACKLOG-06] `task:bulk_created` 이벤트에 토스트 알림 추가**: 사용자에게 "N개 카드가 백로그에 추가되었습니다" 알림 노출.

