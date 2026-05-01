# Phase 29: 프로젝트 격리 아키텍처 재설계 v2.0

> **작성일**: 2026-05-01  
> **작성자**: 소넷 (Claude Sonnet 4.6 / Antigravity)  
> **근거 문서**: Phase28_프로젝트_패널_연동_아키텍처.md, Phase28_프로젝트_영향도_분석.md, Phase28_하드코딩_위험_분석서.md, Phase28_개발스프린트_계획서.md  
> **롤백 커밋**: `bafe795` (Phase29_Project_패널격리_&_inoutput_system) → `4a69d45` 으로 revert 완료

---

## ❗ 롤백 사유 (Root Cause of Rollback)

Phase 29 1차 구현(루카)에서 발견된 **구조적 결함** 4가지:

### 결함 1 — `projectId` 전파 단절 (가장 치명적)
```
[프론트] ari:message → { content, projectId: 'proj-1' }
   ↓ server.js (ari 소켓 핸들러)
[포워딩] postData = { content, author, oauthToken }   ← projectId 누락!
   ↓ ariDaemon.js /api/compute
[DB 저장] createTask(..., projectId = 'proj_default')  ← 항상 기본값
```
- Ari 채팅으로 생성된 카드는 항상 `proj_default`로 DB 저장됨
- 프론트 KanbanBoard는 `selectedProjectId`로 필터링 → 새로고침 시 카드 소멸

### 결함 2 — `io.emit` vs `io.to(room)` 혼재
- 일부 이벤트(`task:created` at L814)는 `io.to(project_${id}).emit` 사용
- 나머지 대부분(`task:moved`, `task:updated` 등 40+ 곳)은 여전히 `io.emit` (전체 브로드캐스트)
- → **반쪽짜리 격리**: 카드는 room emit으로 생성되지만 상태 변경은 전체 broadcast

### 결함 3 — `task:created` 수신 시 클라이언트 강제 projectId 주입
```js
// useSocket.js L74 — 버그
projectId: useProjectStore.getState().selectedProjectId || 'proj-1',
// 서버가 보낸 projectId를 무시하고 클라이언트 현재 선택 값으로 덮어씀
// → DB에 proj_default, 클라이언트 메모리에 proj-1 → 새로고침 시 불일치
```

### 결함 4 — `task:create` 소켓 (수동 카드 생성) projectId 미전달
```js
// server.js L432 — 버그
socket.on('task:create', async ({ title, content, assignee, priority, column }) => {
  const taskId = await dbManager.createTask(title, content, 'CEO', 'gemini-2.5-flash', assignee);
  // projectId 인자 없음 → DB에 proj_default 저장
```

---

## 🎯 재설계 원칙

1. **projectId는 소스에서 발생해 DB까지 끊김 없이 전달된다**
2. **io.emit (전체 broadcast)은 완전히 제거한다** — 모든 태스크 이벤트는 room emit
3. **단, 글로벌 알림(뱃지)은 별도 `global_notification` room으로 분리한다**
4. **클라이언트는 서버가 보낸 projectId를 그대로 사용한다** — 클라이언트 측 강제 주입 금지
5. **ariDaemon은 요청 컨텍스트(projectId)를 인지한 상태에서 도구를 실행한다**

---

## 🏗️ 완전 재설계 아키텍처

### A. projectId 전파 체인 (완전판)

```
[프론트 useSocket] sendAriMessage({ content, projectId: 'proj-1' })
         │
         ▼
[server.js /ari 소켓] ari:message 수신
  - projectId 추출
  - postData = { content, author, oauthToken, projectId }  ← 반드시 포함
         │
         ▼
[ariDaemon.js /api/compute]
  - req.body에서 projectId 수신 및 저장 (request-scoped)
  - executeTool() 호출 시 projectId 함께 전달
         │
         ▼
[executeTool('createKanbanTask', args, { projectId })]
  - dbManager.createTask(..., projectId)   ← projectId 정확히 저장
  - notify-created API에 projectId 포함 전달
         │
         ▼
[server.js POST /api/tasks/notify-created]
  - io.to(`project_${projectId}`).emit('task:created', { ..., projectId })
         │
         ▼
[useSocket.js task:created 핸들러]
  - addTask({ ..., projectId })   ← 서버에서 받은 값 그대로 사용 (클라이언트 강제 주입 X)
```

---

### B. Socket.IO Room 전략 (2-Track)

```
[소켓 구조]
├── project_proj-1          ← 프로젝트별 격리 room
│   ├── task:created
│   ├── task:moved
│   ├── task:updated
│   ├── task:comment_added
│   ├── task:archived
│   ├── task:deleted
│   └── log:append (프로젝트 타임라인)
│
├── project_proj-2          ← 다른 프로젝트
│   └── (동일 이벤트)
│
└── global_notification     ← 크로스 프로젝트 알림 전용
    ├── notification:task_completed  { projectId, taskId, title }
    ├── notification:task_failed     { projectId, taskId, title }
    └── agent:status_change         (전체 에이전트 상태 — 프로젝트 무관)
```

**클라이언트 소켓 조인 규칙:**
- `project:join` 시 → 이전 project_* room 이탈 + 새 room 조인 + `global_notification` room 유지
- `agent:status_change`, `output:created` 등 프로젝트 무관 이벤트는 `global_notification` room으로 emit

---

### C. DB 스키마 (현재 상태 기준 추가 필요 사항)

현재 롤백 이전 Phase 29에서 `database.js`에 `project_id` 컬럼 마이그레이션 코드가 포함돼 있었음.
롤백으로 인해 해당 코드도 제거됨 → **Sprint 1에서 재작업 필요**.

```sql
-- Task 테이블 (이미 project_id 컬럼 존재 여부 확인 후 적용)
ALTER TABLE Task ADD COLUMN project_id TEXT DEFAULT 'proj_default';
ALTER TABLE Log  ADD COLUMN project_id TEXT DEFAULT 'proj_default';
ALTER TABLE TaskComment ADD COLUMN project_id TEXT DEFAULT 'proj_default';

-- 기존 카드 호환성: project_id NULL 또는 'proj_default' → 현재 선택 프로젝트로 간주
-- (KanbanBoard Hydration 시: !task.projectId || task.projectId === 'proj_default' → 현재 프로젝트 포함)
```

---

## 📋 스프린트별 실행 계획 (v2)

### Sprint 1: projectId 전파 체인 완성 (P0 — 지금 당장)

> **목표**: Ari 채팅 및 수동 생성 카드가 올바른 projectId로 DB에 저장되고, 새로고침 후에도 사라지지 않도록 함.

| Task | 파일 | 작업 내용 | 규모 |
|------|------|-----------|------|
| 1-1 | `server.js` | `ari:message` 소켓에서 `projectId` 추출 → daemon 포워딩 postData에 포함 | 2줄 |
| 1-2 | `ariDaemon.js` | `/api/compute` 에서 `projectId` 수신 → `executeTool()` 에 전달 | 5줄 |
| 1-3 | `ariDaemon.js` | `createKanbanTask` tool: `dbManager.createTask(..., projectId)` 인자 추가 | 1줄 |
| 1-4 | `ariDaemon.js` | `notify-created` fetch body에 `projectId` 포함 | 1줄 |
| 1-5 | `server.js` | `task:create` 소켓에서 `projectId` 받아 `createTask` 인자로 전달 | 3줄 |
| 1-6 | `server.js` | `/api/tasks/notify-created` — `projectId` 기반 room emit으로 전환 | 3줄 |
| 1-7 | `useSocket.js` | `task:created` 핸들러: 서버 projectId 그대로 사용 (클라이언트 강제 주입 제거) | 2줄 |
| 1-8 | `database.js` | `project_id` 컬럼 마이그레이션 재적용 (롤백으로 제거됨) | 20줄 |

**예상 작업량**: 소형 (파일당 1~5줄 수정, 총 ~40줄)  
**위험도**: LOW — 각 수정이 독립적이고 범위가 명확

---

### Sprint 2: Socket.IO 전면 Room 격리 (P1)

> **목표**: 모든 태스크 이벤트를 `io.to(room).emit`으로 전환, 프로젝트 간 이벤트 누수 완전 차단.

**핵심 과제**: 현재 `server.js`에서 `io.emit()` 사용 위치 약 40개를 전환해야 함.

**전환 기준:**

| 이벤트 | 현재 | 변경 후 | 이유 |
|--------|------|---------|------|
| `task:created` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `task:moved` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `task:updated` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `task:comment_added` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `task:archived` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `task:deleted` | `io.emit` | `io.to(project_${pid}).emit` | 해당 프로젝트 룸만 |
| `log:append` | `io.emit` | `io.to(project_${pid}).emit` | 프로젝트 타임라인 격리 |
| `agent:status_change` | `io.emit` | `io.emit` 유지 (또는 global_notification) | 에이전트 상태는 전역 표시 필요 |
| `output:created` | `io.emit` | `io.emit` 유지 | IO Hub는 전역 |

**필요한 인프라 작업:**
- `dbManager.getTaskById(taskId)` 결과에서 `project_id` 추출하는 헬퍼 함수 신설
- 이벤트 emit 전 task의 `project_id`를 조회할 수 없는 경우 → `io.emit`으로 안전 폴백

**위험 요소:**
- `dispatchNextTaskForAgent` 내부 `io.emit` — task의 project_id를 조회해야 함 (추가 DB 쿼리 필요)
- `forceRedispatchTask` 동일

---

### Sprint 3: 클라이언트 2-Track 소켓 연결 (P1)

> **목표**: 사용자가 A 프로젝트 화면에 있어도 B 프로젝트 완료 알림을 받을 수 있도록.

```js
// useSocket.js 수정 방향
useEffect(() => {
  // Track 1: 프로젝트별 room (기존 project:join)
  socket.emit('project:join', { projectId: selectedProjectId });
  
  // Track 2: 글로벌 알림 room (새로 추가)
  socket.emit('global:join');  // 항상 유지
}, [selectedProjectId]);

// 새 이벤트 리스너 추가
socket.on('notification:task_completed', ({ projectId, taskId, title }) => {
  // 현재 프로젝트가 아닌 다른 프로젝트에서 완료 알림 → 토스트 뱃지
  if (projectId !== selectedProjectId) {
    showCrossProjectNotification({ projectId, taskId, title });
  }
});
```

---

### Sprint 4: KanbanBoard Hydration 호환성 처리 (P1)

**기존 카드 (`proj_default` 저장된 것들) 처리 정책:**

```js
// KanbanBoard.jsx tasksByColumn 필터 수정
if (
  !task.projectId ||
  task.projectId === 'proj_default' ||   // 기존 호환성
  task.projectId === selectedProjectId
) {
  grouped[task.column].push(task);
}
```

> ⚠️ **주의**: 기존 카드를 `proj_default`로 무한정 보존하면 멀티테넌시가 무의미해짐.  
> **마이그레이션 계획**: 서비스 초기 운영 단계이므로, 첫 1개월 내 기존 카드를 대표님이 수동으로 프로젝트에 재배정하는 UI 제공 후 `proj_default` 예외 처리 제거.

---

### Sprint 5: ariDaemon projectId 인지 구조 (P1)

**ariDaemon이 "현재 어떤 프로젝트 컨텍스트에서 동작 중인지" 항상 알아야 함.**

```js
// ariDaemon.js /api/compute 수정안
app.post('/api/compute', async (req, res) => {
  const { content, author, oauthToken, preferredModel, projectId } = req.body;
  // projectId를 request-scoped 변수로 저장
  const activeProjectId = projectId || 'proj_default';
  
  // executeTool 호출 시 context 객체로 전달
  const result = await executeTool(toolName, args, { projectId: activeProjectId });
});

// executeTool 시그니처 변경
async function executeTool(toolName, args, context = {}) {
  const { projectId = 'proj_default' } = context;
  
  if (toolName === 'createKanbanTask') {
    const taskId = await dbManager.createTask(
      title, content, 'ARI(위임)', MODEL.FLASH, assigneeId, category,
      projectId  // ← 이제 올바르게 전달됨
    );
    // notify-created에도 projectId 포함
    fetch('.../api/tasks/notify-created', {
      body: JSON.stringify({ taskId, title, content, column: 'todo', agentId: assigneeId, priority, projectId })
    });
  }
}
```

---

## ⚠️ 누락됐던 영향평가 항목 (Phase 28 문서에서 다루지 못한 것)

루카의 Phase 28/29 설계 문서가 훌륭했으나, **구현 시 발생할 세부 영향**이 누락된 부분:

### 1. ariDaemon ↔ server.js 경계의 projectId 전달 프로토콜
- 기존 설계에서 "소켓 room으로 격리"는 다뤘으나, **Ari Daemon이 카드 생성 시 어떻게 projectId를 알고 DB에 저장하는지** 구체적 흐름이 없었음.
- **v2 보완**: `/api/compute` ↔ `executeTool` 간 `context` 객체 전달로 명시화

### 2. `task:move` 소켓 핸들러의 room emit 전환 난이도
- task를 이동할 때 `project_id` 정보가 페이로드에 없음 (taskId만 있음)
- room emit을 하려면 DB에서 project_id를 먼저 조회해야 함 → 추가 DB 쿼리
- **v2 보완**: `task:move` 이벤트에 `projectId`를 함께 포함시키거나, 내부 DB 조회 후 emit

### 3. `dispatchNextTaskForAgent` 내부 io.emit 40+ 위치
- 자율 dispatcher가 실행하는 `io.emit` 들은 project_id 없이 전체 broadcast
- **v2 보완**: Sprint 2에서 `getAllTasksLight()`에 `project_id` 컬럼 포함, emit 시 해당 task의 project_id 참조

### 4. `proj_default` 기존 데이터와의 호환성 전략 미수립
- 기존 카드들이 `proj_default`로 저장된 경우 어떻게 처리할지 정책 없음
- **v2 보완**: 1개월 마이그레이션 기간 + UI 재배정 기능 계획

### 5. `io.emit` 전면 제거 시 Dispatcher/Watcher의 project_id 조회 오버헤드
- 40+ 위치를 room emit으로 전환하면 각 emit마다 task의 project_id를 알아야 함
- **v2 보완**: `getTaskById` 반환값에 `project_id` 포함 확인 (현재 포함 안 됨) → `database.js` 수정 필요

---

## ✅ 구현 순서 결정 기준

```
Priority 1 (오늘): Sprint 1 — projectId 전파 체인 완성
  → 가장 작은 변경으로 즉각적인 버그 해결 효과
  → 새로고침 후 카드 소멸 버그 즉시 수정

Priority 2 (이번 주): Sprint 4 — KanbanBoard Hydration 호환성 + Sprint 5 (ariDaemon)

Priority 3 (다음 주): Sprint 2 — io.emit 전면 room emit 전환
  → 영향 범위 크고 위험도 높으므로 별도 세션에서 집중 처리

Priority 4 (2주 후): Sprint 3 — 크로스 프로젝트 알림 (2-Track)
```

---

## 📁 관련 문서 링크

- [Phase28_프로젝트_패널_연동_아키텍처.md](./Phase28_프로젝트_패널_연동_아키텍처.md) — 루카의 원본 전략 기획
- [Phase28_프로젝트_영향도_분석.md](./Phase28_프로젝트_영향도_분석.md) — 시스템 전체 영향 분석
- [Phase28_하드코딩_위험_분석서.md](./Phase28_하드코딩_위험_분석서.md) — 동적 설계 원칙
- [Phase28_개발스프린트_계획서.md](./Phase28_개발스프린트_계획서.md) — 루카의 스프린트 계획 (참고용)

---

*작성: 소넷 (Claude Sonnet 4.6 / Antigravity) — 2026-05-01*  
*롤백 기반 재설계. 루카의 Phase 28 설계 자산을 계승하되, 구현 결함을 보완.*
