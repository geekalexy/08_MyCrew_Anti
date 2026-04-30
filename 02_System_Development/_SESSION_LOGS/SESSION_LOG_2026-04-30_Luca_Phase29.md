# Antigravity Session Log: Phase 29 & 30 Draft (Multi-tenancy & Team Building)

**Date:** 2026-04-30
**Agent:** Luca (Antigravity)
**Context:** 마이크루(MyCrew) 워크스페이스 내 프로젝트 단위 데이터 격리(Multi-tenancy) 시스템 백엔드/프론트엔드 연동 및 Phase 30 초안 작성

## 1. 달성한 작업 (Completed Tasks)
- **Phase 29: 프로젝트 격리 인프라 (API & DB)**
  - `database.js` 내 `getProjects()` 인터페이스 신설 (프로젝트 전체 목록 조회용).
  - 텔레그램 지시어 분석 모듈(`modelSelector.js`)에 프로젝트 목록 데이터(Context)를 주입, 사용자의 자연어 발화에서 의도된 `target_project`를 추론/추출하도록 LLM 프롬프트 고도화.
  - `server.js`의 텔레그램 메시지 라우터(`handleResponse`) 수정. 추출된 `target_project` ID로 `createTask`를 호출하여 DB 상 프로젝트 격리 달성.
  
- **Phase 29: Socket.IO 실시간 룸 동기화 분리**
  - 클라이언트(`useSocket.js`)의 `activeProjectId` 변경 감지 시 `socket.emit('project:join', { projectId })` 로직 연동.
  - 서버 측 태스크/이벤트 전파 시 `io.to('project_' + target_project).emit()` 패턴 적용으로 다른 프로젝트 룸에 속한 클라이언트들에게는 데이터가 유출되지 않도록 처리.

- **Phase 29: 프론트엔드 UI/UX 대응**
  - `KanbanBoard.jsx`: 선택된 프로젝트가 없을 경우(`!selectedProjectId`) 렌더링될 Empty State 안내 UI 추가 ("프로젝트를 선택해주세요").
  - `LogDrawer.jsx`: 우측 채팅/타임라인 패널 헤더 바로 위에 현재 선택된 프로젝트 명과 아이콘 색상을 배지로 띄워, 유저의 컨텍스트(내가 어떤 프로젝트의 로그를 보고 있는지) 인지성 강화.

- **Phase 30: 프로젝트 자율 팀 빌딩 PRD 초안 작성**
  - `Phase30_프로젝트_팀빌딩_초안.md` 기획안 도출.
  - 사용자 의도 기반의 '목적(Objective)'과 '격리 옵션(ISOLATED/SCOPED/GLOBAL)' 입력 모달 설계 기획.
  - 목적 텍스트를 기반으로 한 Ari 엔진의 자율적 팀원 선발(Team Building) 및 킥오프 태스크(첫 To-Do 자동 생성) 시나리오 설계.

## 2. 남은 과제 (Pending / Next Steps)
- **Phase 30 개발 구현**:
  - `ProjectCreateModal.jsx` 풀-모달 컴포넌트 개발.
  - 백엔드 `POST /api/projects` 라우팅 생성.
  - Ari 엔진의 `TeamBuilder` 모듈 스크립트 작성 및 텔레그램/소켓 이벤트와의 체인 연동.
- **격리 고도화**:
  - 추후 `ISOLATED` 모드의 경우 서버 내 `07_OUTPUT` 폴더도 `project_id` 기반 서브 디렉토리로 격리하고, RAG 쿼리 시 타 프로젝트 데이터를 배제하는 메타데이터 필터링 로직 추가.

## 3. 발생했던 이슈 및 해결 방식
- 프론트엔드의 `projectStore.js`에서 기존엔 `selectedProjectId` 였던 변수명을 잠시 `activeProjectId`로 교체했다가, 기존 코드베이스의 호환성을 훼손하는 문제가 발생하여 Git 버전을 복원(Checkout)하고 기존 명칭인 `selectedProjectId`를 준수하는 방향으로 안전하게 회귀함.
