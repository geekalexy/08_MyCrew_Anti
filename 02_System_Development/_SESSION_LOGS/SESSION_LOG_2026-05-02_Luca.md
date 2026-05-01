# Session Log: Phase 28a 프로젝트 기반 격리 인프라(DB/Socket/프론트엔드) 완결

**작성자:** Luca
**작성일:** 2026-05-02

## 1. 주요 작업 내용 (What was done)

### 1.1. 백엔드(Ari Engine) 필터링 및 API 고도화
* **REST API 신설 및 개조**: 프론트엔드에서 프로젝트별 컨텍스트를 조회할 수 있도록 `GET /api/projects` 엔드포인트를 신설하고, `GET /api/tasks` 및 `GET /api/comments/recent` 엔드포인트에 `project_id` 쿼리 파라미터 필터링 로직을 적용.
* **Socket Room 핸들러 추가**: 프로젝트 컨텍스트 스위칭을 위한 `project:join` 및 `project:leave` 소켓 이벤트를 `server.js`에 새롭게 매핑하여 동적 룸 전환 토대를 마련함.

### 1.2. Prime 아키텍처 리뷰 반영 (RES-23)
* 프론트엔드 연동 전 작성한 PRD(REQ-23)에 대해 Prime의 교차 검증을 받음.
* **지적 사항 1**: 프론트엔드(`projectStore.js`)의 하드코딩된 ID(`proj-1`)와 실제 백엔드 프로젝트 ID 간 불일치 문제 확인.
* **지적 사항 2**: 과도기적 서버 이중 방출(`io.emit` + Room 방출)로 인한 클라이언트 타임라인 로그 중복 수신 버그 확인.

### 1.3. 프론트엔드(대시보드) 상태 스토어 및 UI 연동 완료
* **ProjectStore 개조**: `DEFAULT_PROJECTS` 하드코딩을 제거하고 초기 마운트 시 `fetchProjects()`를 호출하도록 로직 전면 수정. API 통신 안정성을 위해 `isLoaded` 플래그 도입.
* **Hydration 동기화**: `KanbanBoard` 및 `LogDrawer` 컴포넌트 내부의 초기 Fetch 로직이 `projectStore.isLoaded`가 완료된 이후에만 `project_id`를 물고 동작하도록 리팩토링.
* **소켓 필터링 및 Dedup**: `useSocket.js`에서 수신되는 `log:append` 이벤트 중 현재 선택된 프로젝트와 다른 ID는 차단하고, 동일 로그의 2중 렌더링 방지를 위해 `logs.slice(-10)` 비교(Dedup) 방어 코드 추가.
* **UI Selector**: `App.jsx` 헤더 영역에 현재 로드된 프로젝트를 즉각 스위칭할 수 있는 `<select>` 드롭다운 메뉴 추가 완료.

## 2. 발견된 문제점 및 해결책 (Challenges & Solutions)
* **Vite 포트 충돌 이슈 (`EADDRINUSE: 5174`)**:
  * **원인**: 백그라운드나 다른 터미널 탭에 기존 Vite 프론트엔드 서버가 켜져 있어 발생.
  * **해결**: 코드상의 버그가 아니므로 켜져있던 브라우저 탭(localhost:5174)에서 새로고침하여 즉시 테스트 환경 진입 안내.

## 3. 다음 단계 (Next Steps)
* **Phase 28b (Zero-Config 빌딩)**: 대표님이 프로젝트명과 목적만 입력하면 Opus가 자율 기획하여 크루 에이전트와 도구를 자동 할당하는 프로세스 구현 시작.
* **Bugdog 고도화 연계**: Sonnet이 작성할 버그독 PRD와 연계하여 새롭게 분리된 프로젝트 격리 인프라 위에 버그 로깅 시스템 장착.
