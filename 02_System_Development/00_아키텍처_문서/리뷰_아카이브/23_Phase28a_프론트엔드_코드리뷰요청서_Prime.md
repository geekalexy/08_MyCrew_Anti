# 🛡️ Supreme Advisor (Prime) 프론트엔드 설계 리뷰 요청서

**문서 번호:** REQ-23 (Phase 28a Frontend)
**작성자:** Luca (Antigravity AI)
**리뷰 대상:** Phase 28a 프로젝트 기반 격리 프론트엔드 구현 PRD
**작성일:** 2026-05-02

---

## 1. 개요 (Objective)
백엔드(Ari Engine)의 프로젝트 단위 데이터 격리(DB 스키마 마이그레이션, Socket Room 분리)가 성공적으로 완료되었습니다.
본 PRD는 백엔드와 연동하여 **프론트엔드(워크스페이스 대시보드)에서 프로젝트 컨텍스트를 스위칭하고 데이터를 완벽히 격리 렌더링**하기 위한 구현 명세서입니다. 본격적인 코드 작성에 앞서 Prime의 아키텍처 검증을 요청합니다.

---

## 2. 주요 구현 명세 (Frontend PRD)

### 2.1. ProjectStore 상태 관리 고도화
기존 하드코딩되어 있던 `src/store/projectStore.js`를 개편하여 백엔드 API와 동기화합니다.
* **상태 변수:** `projects` (배열), `selectedProjectId` (선택된 ID)
* **Action:**
  * `fetchProjects()`: `GET /api/projects`를 호출하여 DB의 프로젝트 목록을 로드.
  * `selectProject(projectId)`: 프로젝트 변경 시 상태를 업데이트하고, 연관 컴포넌트(Kanban, LogDrawer)의 리렌더링 및 Re-fetch를 유도.

### 2.2. API 필터링 및 소켓 룸(Room) 구독 연동
모든 데이터 페칭 컴포넌트는 `projectStore`의 `selectedProjectId`에 의존하여 동작하도록 변경합니다.

**A. KanbanBoard (`src/components/Board/KanbanBoard.jsx`)**
* **API 변경:** `GET /api/tasks?project_id=${selectedProjectId}` 호출.
* **동적 렌더링:** 프로젝트가 변경되면 기존 칸반 카드를 비우고 새 프로젝트의 카드로 교체.

**B. LogDrawer (`src/components/Log/LogDrawer.jsx` - 타임라인)**
* **API 변경:** `GET /api/comments/recent?project_id=${selectedProjectId}` 호출.
* **동적 렌더링:** 프로젝트 변경 시 타임라인 초기화 및 새 내역 로드.

**C. Socket.IO 격리 (`src/hooks/useSocket.js` 또는 개별 컴포넌트)**
* **구독(Join) 로직:** 프로젝트 변경 감지 시 기존 룸에서 이탈(`project:leave`)하고, 새 룸(`project:join`, payload: `{ projectId }`)에 조인.
* **이벤트 리스너:** 소켓 서버가 `io.to('project_...')`로 보내는 `log:append`, `task:created` 등의 이벤트를 격리된 룸 안에서만 수신.

### 2.3. Project Selector UI 컴포넌트 신설
* **위치:** 대시보드 상단 헤더(Header) 영역 좌측.
* **기능:** 드롭다운(Dropdown) 형태로 구현하여, 클릭 시 백엔드에서 받아온 `global_mycrew`, `sosiann_cks` 등의 프로젝트 목록을 표시하고 스위칭.

---

## 3. 발생 가능한 리스크 및 방어 로직 (Contingency Plan)

1. **Race Condition (소켓 이벤트 유실)**: 프로젝트 변경 시점(API 로딩 중)에 소켓 룸 전환이 지연되어 엉뚱한 로그가 타임라인에 섞일 위험.
   * **방어:** `log:append` 소켓 이벤트 페이로드에 포함된 `projectId`를 프론트엔드 단에서도 한 번 더 검사(`if (payload.projectId !== selectedProjectId) return;`)하여 이중 방어망 구축.
2. **Hydration 불일치**: 새로고침 시 `localStorage`에 저장된 `selectedProjectId`가 이미 삭제된 프로젝트일 경우.
   * **방어:** `fetchProjects()` 완료 직후 `selectedProjectId`가 목록에 없으면 자동으로 첫 번째 프로젝트(`global_mycrew`)로 Fallback.

---

## 4. Prime 님께 드리는 3가지 검토 질의 사항

1. **상태 관리 종속성 (Zustand vs React Query)**
   * 현재 Kanban과 Log의 초기 Hydration을 `useEffect` 내 `fetch`로 처리할 예정입니다. 프로젝트 스위칭이 잦을 경우 Zustand 스토어 구독만으로 리렌더링을 제어하는 방식이 충분히 견고할까요?
2. **소켓 Room 전환 비용 (Socket Re-subscription)**
   * 프로젝트 룸 전환 시 소켓 연결 자체를 끊지 않고 `.emit('join') / .emit('leave')`만 수행합니다. 이 방식이 Node.js 메모리에 남길 수 있는 좀비 리스너(Memory Leak) 리스크는 없습니까?
3. **P1 핫픽스 관련 확인**
   * 방금 전 백엔드(database.js)의 P1 데드락 및 외래키 결함을 단일 트랜잭션과 PRAGMA ON으로 수정 완료했습니다. 프론트엔드 진입 전 백엔드 구조가 완전무결하다고 판단하십니까?

---
> **통과 조건:** 위 PRD 구조가 안전하다고 승인하시면 즉시 프론트엔드 React 컴포넌트 개조 및 Project Selector UI 작업을 시작합니다.
