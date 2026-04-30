# Phase 29: 워크스페이스 패널 격리 및 Socket Room 아키텍처 PRD

## 1. 개요 (Overview)
본 PRD는 기존 전역(Global)으로 동작하던 MyCrew 워크스페이스의 우측 패널(채팅, 타임라인 로그)과 칸반 태스크 보드를 **프로젝트(Project) 단위로 완전 격리(Multi-tenant Migration)**하는 상세 개발 명세서입니다. 
본 구현이 완료되면 사용자가 프로젝트를 전환할 때마다 해당 프로젝트에 종속된 에이전트 대화, 로그, 태스크 데이터만 로드되며, 실시간 소켓 이벤트 역시 해당 프로젝트 룸(Room)으로만 전파됩니다.

---

## 2. DB 스키마 마이그레이션 (Database Schema)

모든 데이터 엔티티가 특정 프로젝트에 종속되도록 스키마를 업데이트합니다. (`database.js`)

### 2.1 신규 테이블: `Project`
- `id` (TEXT, PK): 프로젝트 고유 ID (예: `proj_12345`)
- `name` (TEXT): 프로젝트명
- `description` (TEXT): 프로젝트 목적 및 개요
- `isolation_level` (TEXT): 데이터 격리 수준 (`ISOLATED`, `SCOPED`, `GLOBAL` 중 택 1)
- `status` (TEXT): 상태 (`ACTIVE`, `ARCHIVED`, `DELETED`)
- `created_at` / `updated_at` (TEXT)

### 2.2 기존 테이블 수정 (컬럼 추가)
아래 테이블들에 `project_id` (TEXT) 컬럼을 추가하고 인덱스를 생성합니다.
- `Task` (칸반 태스크)
- `TaskComment` (태스크 댓글 및 에이전트 산출물 내역)
- `Log` (타임라인 활동 로그)
- `WebChat` (우측 패널 아리/에이전트와의 채팅 내역)

> **[마이그레이션 전략]**: 기존 데이터 유실을 막기 위해 `proj_default`(기본 워크스페이스)라는 기본 프로젝트 레코드를 생성하고, 기존에 존재하던 모든 레코드의 `project_id`를 `proj_default`로 일괄 업데이트(UPDATE)합니다.

---

## 3. 백엔드 통신 아키텍처 (Backend Routing & Socket.IO)

### 3.1 Socket.IO Room 기반 브로드캐스트
모든 실시간 이벤트는 `io.emit()`(전체 전송) 대신 **`io.to(RoomID).emit()`**(특정 룸 전송) 형태로 전환되어야 합니다.

- **Room ID 규칙**: `project_{projectId}`
- **이벤트: `project:join`**
  - 클라이언트가 특정 프로젝트를 선택하면 호출합니다.
  - 서버 처리: 
    ```javascript
    socket.on('project:join', ({ projectId }) => {
      // 기존 프로젝트 룸에서 이탈 (중복 수신 방지)
      socket.rooms.forEach(room => { if(room.startsWith('project_')) socket.leave(room); });
      // 새 프로젝트 룸 입장
      socket.join(`project_${projectId}`);
    });
    ```
- **이벤트 전파 수정**:
  - 기존 `io.emit('log:added', log)` ➡️ `io.to('project_' + projectId).emit('log:added', log)`
  - 기존 `io.emit('chat:message', msg)` ➡️ `io.to('project_' + projectId).emit('chat:message', msg)`
  - 기존 `io.emit('task:created', task)` ➡️ `io.to('project_' + projectId).emit('task:created', task)`

### 3.2 REST API 엔드포인트 개편
데이터 조회 및 생성 API가 특정 프로젝트를 타겟팅하도록 URL Path를 수정합니다.
- `GET /api/projects/:projectId/tasks` : 특정 프로젝트의 칸반 보드 조회
- `GET /api/projects/:projectId/logs` : 특정 프로젝트의 타임라인 조회
- `GET /api/projects/:projectId/chat` : 특정 프로젝트의 채팅 내역 조회
- `POST /api/projects/:projectId/tasks` : 특정 프로젝트 내 신규 태스크 생성
- *첨부파일 API도 `POST /api/input/:projectId/:taskId` 형태로 확장 고려.*

### 3.3 에이전트 지식 격리 수준(Isolation Level) 보안 제어
프로젝트 생성 시 설정된 `isolation_level` 값에 따라 에이전트(Ari 등)의 파일 접근 권한 및 RAG(검색) 참조 범위를 서버단에서 동적으로 제한합니다.
- **ISOLATED (전면 격리)**: `07_OUTPUT/{projectId}/` 및 자신에게 업로드된 파일만 읽기 허용. 타 프로젝트나 전역 폴더(`06_소시안자료`) 접근 전면 차단.
- **SCOPED (일부 공유)**: 자신의 프로젝트 폴더 + 공통 지식 폴더(`06_소시안자료`)만 접근 허용. 타 프로젝트의 아웃풋은 참조 불가.
- **GLOBAL (전면 공유)**: 시스템 코드(`02_System_Development`)를 제외한 워크스페이스 내 모든 에셋 및 타 프로젝트의 완료된 산출물까지 자유롭게 참조 가능.

---

## 4. 프론트엔드 아키텍처 (Frontend State & UI)

### 4.1 Zustand 상태 관리 (`projectStore.js` 신설)
```javascript
export const useProjectStore = create((set, get) => ({
  activeProjectId: 'proj_default', // 초기값
  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId });
    // 상태 변경 시 소켓 조인 및 데이터 리패치 트리거
    useSocket.getState().socket.emit('project:join', { projectId });
    useKanbanStore.getState().fetchTasks(projectId);
    useLogStore.getState().fetchLogs(projectId);
    useChatStore.getState().fetchChats(projectId);
  }
}));
```

### 4.2 Right Panel 컴포넌트 (`RightPanel.jsx`, `LogDrawer.jsx`)
- 상단에 현재 활성화된 프로젝트 이름을 표기하는 헤더 추가.
- `activeProjectId`가 없을 경우 패널 영역에 **"프로젝트를 선택해주세요"**라는 Empty State 화면 노출 (입력창 비활성화).
- 프로젝트 전환 시 `log` 및 `chat` 배열 상태를 즉시 비우고(Clear), 새로운 `projectId` 기준으로 데이터를 다시 받아오도록 `useEffect` 훅 구성.

---

## 5. 단계별 개발 스프린트 (Sprint Tasks)

1. **[DB]** `database.js` 내에 Project 테이블 생성 및 기존 테이블(`Task`, `Log` 등) `project_id` 컬럼 추가 및 초기 데이터 마이그레이션 스크립트 작성.
2. **[API]** `server.js`의 기존 REST API 라우트들을 `/api/projects/:projectId/...` 패턴으로 전면 수정.
3. **[Socket]** `server.js` 내의 모든 `io.emit` 호출을 찾아 `io.to('project_'+projectId).emit`으로 교체하고 `project:join` 핸들러 구현.
4. **[Frontend]** `projectStore.js` 생성 및 좌측 LNB(사이드바)에 프로젝트 리스트 UI 구성 (클릭 시 `setActiveProject` 호출).
5. **[Frontend]** 칸반 보드 및 우측 패널(타임라인/채팅)이 `activeProjectId` 변경에 즉각 반응하여 데이터를 교체하도록 컴포넌트 라이프사이클 수정.
6. **[QA]** 탭을 두 개 띄워놓고 A 프로젝트에서 채팅 시 B 프로젝트를 보고 있는 창에 메시지가 새어나가지 않는지(격리 여부) 크로스 체크.
