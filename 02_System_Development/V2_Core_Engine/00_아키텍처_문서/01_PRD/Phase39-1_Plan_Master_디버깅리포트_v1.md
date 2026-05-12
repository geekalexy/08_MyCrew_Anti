# Phase 39-1: Plan Master 디버깅 리포트 v1.0

**작성일**: 2026-05-12  
**작성자**: Sonnet (소넷)  
**세션 ID**: 8a67d288-e3eb-4794-8af9-b5eb995e286e  
**상태**: ✅ 패치 완료 (대기: 통합 테스트)  
**연결 문서**: [Phase39-1_Plan_Master_개발구현계획서](Phase39-1_Plan_Master_개발구현계획서.md)

---

## 1. 버그 발견 경위

사용자 보고 (2026-05-12):
> "플랜모드 설정하면 담당과 모델이 자동 적용되어야하는데 **모델은 변경되고 담당: CEO 상태**였음. 풀스텍으로 설정하니까 실행 버튼 활성화됨. 실행 조금 지나 → 타임라인에 작성완료 로그 찍혔으나 **카드에는 결과물이 안보임**. 조금 지나 다시 보니까 결과물이 보임."

총 **4개의 버그**가 확인되었으며, 연쇄 인과관계로 묶인 1·2번이 핵심 원인이었습니다.

---

## 2. 버그 상세 분석

### 🔴 Bug 1: 모드 변경 시 담당자(Assignee) 자동 배정 누락
- **파일**: `03_워크스페이스_대시보드/src/components/Modal/TaskDetailModal.jsx`
- **발생 위치**: 모드 선택 `<select>` `onChange` 핸들러 (L1347~1365)
- **증상**: ARCHITECT 모드 선택 시 `model` 필드만 `Claude Opus 4.6`으로 변경. `assignee`는 기존 `CEO` 유지.
- **근본 원인**:
  ```js
  // 수정 전 (버그 코드)
  patchTask(task.id, { mode: newMode, model: newModel });
  // ❌ assignee 누락 → CEO인 채로 남음
  ```
- **수정 내용**:
  ```js
  // 수정 후
  const patch = { mode: newMode, model: newModel };
  if (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') {
    // 모드별 기본 에이전트 배정
    if (newMode === 'ARCHITECT') newAssignee = 'dev_senior';
    else if (newMode === 'DEV')   newAssignee = 'dev_senior';
    else if (newMode === 'QA')    newAssignee = 'dev_advisor';
    else if (newMode === 'DEBUG') newAssignee = 'dev_senior';
    patch.assignee = newAssignee;
  }
  patchTask(task.id, patch); // ✅ assignee 포함
  ```

---

### 🔴 Bug 2: 실행 버튼 비활성화 (Bug 1의 연쇄 결과)
- **파일**: `TaskDetailModal.jsx`
- **발생 위치**: 실행 CTA 버튼 `disabled` 조건 (L1282)
- **증상**: 담당자가 CEO인 채로 남아 있어 실행 버튼이 항상 비활성화 상태.
  ```js
  disabled={!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo' || isStarting}
  ```
- **수정**: Bug 1 해결로 자동 연쇄 해소. CEO 담당자 방지 조건 자체는 의도적 설계이므로 유지.

---

### 🔴 Bug 3: `handleStartTask`가 ARCHITECT 모드를 일반 실행과 동일하게 처리
- **파일**: `TaskDetailModal.jsx`
- **발생 위치**: `handleStartTask` 함수 (L857~874)
- **증상**: ARCHITECT 모드로 실행해도 `POST /api/tasks/:id/run`이 아닌 단순 `PATCH column: in_progress`만 발생 → `plan-master/analyze` → `generate-roadmaps` 파이프라인 미호출 → 백로그 카드 생성 안 됨.
  ```js
  // 수정 전 (버그 코드)
  fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ column: 'in_progress' }), // 모드 완전 무시
  });
  ```
- **수정 내용**:
  ```js
  // 수정 후
  if (finalMode === 'ARCHITECT') {
    setShowPlanMasterModal(true); // PlanMasterModal 오픈 → Sonnet→Opus 파이프라인
    return;
  }
  // 그 외 모드: Zero-Command Router 경유
  fetch(`${SERVER_URL}/api/tasks/${task.id}/run`, {
    method: 'POST',
    body: JSON.stringify({ mode: finalMode }),
  });
  ```
- **추가 수정**:
  - `PlanMasterModal` 임포트 및 `showPlanMasterModal` 상태 추가
  - `onSubmit` 콜백에서 기획 완료 시 현재 태스크 `REVIEW`로 자동 이동

---

### 🟡 Bug 4: `task:bulk_created` 소켓 이벤트 핸들러 누락
- **파일**: `03_워크스페이스_대시보드/src/hooks/useSocket.js`
- **발생 위치**: 싱글턴 소켓 리스너 등록 블록
- **증상**: `generate-roadmaps` API가 `io.to(project_${projectId}).emit('task:bulk_created', {...})`를 보내도 프론트엔드에서 수신 핸들러가 없어 칸반 보드 즉시 미반영. 새로고침 후에야 카드 표시.
- **수정 내용**:
  ```js
  socketInstance.on('task:bulk_created', async ({ projectId, taskIds, count }) => {
    // 생성된 taskIds를 GET /api/tasks?projectId=xxx 로 즉시 fetch
    // → 필터링 후 kanbanStore.addTask()로 순차 반영
    // → 사용자에게 즉시 카드 표시
  });
  ```

---

### 🔵 추가 수정: PlanMasterModal confirm API 미연동
- **파일**: `PlanMasterModal.jsx`
- **발생 위치**: `handleConfirm` 함수 (L83~88)
- **증상**: "이대로 확정" 클릭 시 DB의 `plan_master_status`가 `LOCKED`로 변경되지 않음 → 서버 락온 미처리.
- **수정**: confirm 전 `POST /api/projects/:id/plan-master/confirm { action: 'confirm' }` 호출 추가.

---

## 3. 패치 적용 파일 목록

| 파일 | 변경 유형 | 수정 라인 수 |
|------|-----------|-------------|
| `TaskDetailModal.jsx` | 버그 수정 3건 + 기능 추가 | ~80줄 |
| `useSocket.js` | 이벤트 핸들러 신규 추가 | ~45줄 |
| `PlanMasterModal.jsx` | confirm API 연동 | ~12줄 |

---

## 4. 수정 후 기대 동작 흐름

```
[CEO] ARCHITECT 모드 선택
  ↓ ✅ 모델: Claude Opus 4.6 자동 설정
  ↓ ✅ 담당자: dev_senior 자동 배정
  ↓ ✅ 실행 버튼 즉시 활성화
[CEO] 실행 버튼 클릭
  ↓ ✅ PlanMasterModal 오픈
[CEO] 요구사항 + 기한 입력 → 스코프 분석 시작
  ↓ ✅ 1차: Sonnet 4.6 Thinking → needs_clarification 분기 또는 직접 분석
  ↓ ✅ 2차: Opus 4.6 Thinking → 로드맵 심층 분석 + 비즈니스 리스크 판단
  ↓ ✅ mvp_tasks → BACKLOG 카드 자동 생성
  ↓ ✅ future_scope → [확장 버전] 태그 카드 자동 생성
  ↓ ✅ task:bulk_created 소켓 → 칸반 즉시 반영 (지연 없음)
[CEO] "이대로 확정" 클릭
  ↓ ✅ plan_master_status: LOCKED (DB 기록)
  ↓ ✅ v1.0_MVP_PRD.locked 파일 생성
  ↓ ✅ 원래 태스크 → REVIEW 이동 (CEO 최종 검토 요청)
```

---

## 5. 미검증 항목 (후속 테스트 필요)

- [ ] **T-01**: Sonnet 4.6 실제 API 응답 속도 (2분 타임아웃 충분한지)
- [ ] **T-02**: Opus 4.6 로드맵 JSON 파싱 성공률 (Fallback 진입 빈도)
- [ ] **T-03**: `task:bulk_created` fetch 시 신규 카드만 필터링되는지 (기존 카드 중복 addTask 방지)
- [ ] **T-04**: `needs_clarification: true` 분기 후 옵션 선택 → 재분석 루프 정상 작동
- [ ] **T-05**: `revise` 피드백 루프 (MAX_REVISIONS=5) 한도 초과 시 Force Confirm 처리
- [ ] **T-06**: 멀티 프로젝트 환경에서 Room 격리 (`project_${projectId}`) 정상 작동

---

## 6. 관련 이슈 레퍼런스

| 이슈 | 연관 코드 | 상태 |
|------|-----------|------|
| `[H-001]` task:bulk_created 전역 emit → Room emit | `server.js:3489` | ✅ 이전 세션에서 수정 완료 |
| `[H-003]` analyze null 가드 | `server.js:3349` | ✅ 이전 세션에서 수정 완료 |
| `[N-001]` LOCKED 상태 재진입 방지 | `server.js:3510` | ✅ 이전 세션에서 수정 완료 |
| `[BUG-01]` 모드→담당자 미자동 배정 | `TaskDetailModal.jsx:1347` | ✅ **이번 세션 수정** |
| `[BUG-02]` CEO 담당자 실행버튼 비활성 | `TaskDetailModal.jsx:1282` | ✅ **이번 세션 수정** |
| `[BUG-03]` handleStartTask ARCHITECT 무시 | `TaskDetailModal.jsx:857` | ✅ **이번 세션 수정** |
| `[BUG-04]` bulk_created 소켓 핸들러 누락 | `useSocket.js:64` | ✅ **이번 세션 수정** |
| `[BUG-05]` PlanMasterModal confirm API 미연동 | `PlanMasterModal.jsx:83` | ✅ **이번 세션 수정** |
