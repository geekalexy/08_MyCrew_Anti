# Phase 39-1: Plan Master 개발구현계획서 (Task List)

**작성일**: 2026-05-11
**작성자**: Luca
**상태**: ✅ 구현 완료
**기준 문서**: [Phase39-1_Plan_Master_관련_기획서](Phase39-1_Plan_Master_관련_기획서.md)

---

## 1. 개요
본 문서는 `Phase39-1_Plan_Master_관련_기획서.md`를 바탕으로, 'AI 기획자(Plan Master)'의 요구사항 분석, 버전 분리, 사용자 협상, 그리고 Sequential Thinking UX를 실제 코드로 구현하기 위한 상세 개발 체크리스트입니다.

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

---

## 3. 테스트 시나리오
- [ ] **시나리오 A (정상 스코프 분리)**: "결제, 소셜 로그인, 게시판, 채팅 기능이 들어간 앱을 1주일 안에 만들어줘" 요청 시, 에이전트가 게시판 위주의 MVP를 제안하고 나머지를 Backlog 카드 및 v2.0 PRD로 정상 분리하는지 확인.
- [ ] **시나리오 B (반복 협상 루프)**: MVP 제안을 거절하고 "채팅은 무조건 1.0에 들어가야 해"라고 피드백 시, 에이전트가 다시 스코프를 재조정하여 컨펌을 대기하는 루프 검증.
- [ ] **시나리오 C (Graphify 렌더링)**: 분리된 2.0 스코프가 Preview 스플릿 뷰에서 Graphify 노드로 정상 렌더링되는지 확인.
