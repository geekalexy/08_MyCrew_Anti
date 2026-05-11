# Phase 38: MyCrew MCP 서버 개발 계획서 (Development Plan)

**문서 버전**: v1.0  
**작성일**: 2026-05-08  
**작성자**: 루카 (Luca, CTO & Architecture Lead)  
**상태**: 🟡 개발 대기 (Pending Sprint)  
**연관 문서**: [Phase38_MCP_Server_아키텍처_기획서](Phase38_MCP_Server_아키텍처_기획서.md)

---

## 1. 개발 목표 (Objective)
기존 웹 대시보드 및 파일 폴링(File Polling) 통신 시스템(`server.js`)을 **그대로 유지(무중단 운영)**하면서, 외부의 강력한 AI 에디터(Antigravity, Cursor, Claude Code)가 네이티브로 마이크루의 상태를 읽고 제어할 수 있는 **독립적인 MCP 서버(`mcp_server.js`)를 병렬로 구축**합니다.

---

## 2. 아키텍처 원칙 (Architecture Principles)
1. **투트랙(Two-Track) 격리**: 기존 코드를 수정하여 MCP를 억지로 끼워 넣지 않습니다. 웹 소켓과 HTTP를 처리하는 기존 `server.js`와 터미널 표준 입출력(stdio)을 처리하는 `mcp_server.js`는 완전히 별개의 프로세스로 띄웁니다.
2. **SSOT (Single Source of Truth)**: 두 프로세스가 데이터를 주고받는 방식이 아니라, 양쪽 모두 기존의 `database.js`(SQLite) 하나만 바라보고 읽고 쓰도록 설계하여 상태 불일치를 방지합니다.
3. **표준 규격 준수**: Anthropic의 공식 `@modelcontextprotocol/sdk` 모듈을 사용하여 개발합니다.

---

## 3. 개발 스프린트 로드맵 (Phased Implementation)

### 🚀 Sprint 1: 기초 셋팅 및 Antigravity 연결 테스트 (PoC)
*   **목표**: 최소한의 껍데기만 있는 MCP 서버를 띄우고 안티그래비티가 이를 인식하는지 검증.
*   **작업 내용**:
    1.  `npm install @modelcontextprotocol/sdk` 라이브러리 설치.
    2.  `01_아리_엔진/mcp_server.js` 빈 스크립트 생성 및 `Server` 인스턴스 초기화 (stdio 전송 방식 적용).
    3.  단순한 "Ping" 테스트용 툴(Tool) 하나만 노출.
    4.  대표님 환경의 `/Users/alex/.gemini/antigravity/mcp_config.json`에 경로를 매핑하여 커넥션(Connection) 및 인식 여부 확인.

### 🚀 Sprint 2: 읽기 전용 데이터 노출 (Resources 구축)
*   **목표**: 외부 IDE(Antigravity)가 마이크루 칸반 보드의 현재 상태를 볼 수 있게 만듦.
*   **작업 내용**:
    1.  `database.js` 연동.
    2.  `resources://mycrew/tasks/all` 리소스 엔드포인트 구현: 칸반 보드의 모든 태스크 목록(JSON) 반환.
    3.  `resources://mycrew/tasks/pending` 리소스 구현: `TODO` 또는 `IN_PROGRESS` 상태인 작업만 반환.
    4.  안티그래비티 대화창에서 *"마이크루 칸반 보드에 남은 작업이 뭐야?"* 라고 물었을 때 완벽하게 읽어오는지 테스트.

### 🚀 Sprint 3: 쓰기 권한 및 액션 노출 (Tools 구축)
*   **목표**: 외부 IDE가 코딩을 끝낸 후 마이크루 칸반 보드의 카드를 옮기거나 새 카드를 만들 수 있게 만듦.
*   **작업 내용**:
    1.  `move_task_status` 툴 구현: 태스크 ID와 목표 컬럼(`done`, `in_progress` 등)을 인자로 받아 DB 상태 업데이트.
    2.  `create_kanban_task` 툴 구현: 다음 에이전트(QA 등)에게 릴레이 바통을 넘기기 위해 새로운 칸반 카드 생성.
    3.  `add_system_log` 툴 구현: 외부 에이전트가 "작업을 완료했습니다"라는 로그를 마이크루 로그 드로어에 찍을 수 있도록 허용.

### 🚀 Sprint 4: 프롬프트 템플릿 표준화 (Prompts 구축)
*   **목표**: 개발팀 역할(CTO, 프론트엔드 등)별 작업 지침을 표준화하여 주입.
*   **작업 내용**:
    1.  `prompts://role/dev_senior` 프롬프트 구현: "너는 마이크루의 CTO야. PRD를 검토하고..." 같은 시스템 프롬프트를 MCP를 통해 자동 공급.
    2.  안티그래비티나 클로드 코드가 해당 프롬프트를 장착한 채로 작업을 시작하도록 강제.

---

## 4. 예상 리스크 및 대응 방안
*   **동시성 이슈(DB Lock)**: 기존 `server.js`와 새로운 `mcp_server.js`가 동시에 SQLite DB 파일에 쓰기를 시도할 경우 `SQLITE_BUSY` 에러가 날 수 있습니다.
    *   **대응**: `database.js` 내에 WAL(Write-Ahead Logging) 저널 모드를 켜서 동시 읽기/쓰기 성능 및 안정성을 확보합니다.
*   **UI 즉시성(Reactivity) 문제**: `mcp_server.js`가 DB 상태를 바꿨을 때, 기존 `server.js`에 연결된 웹 프론트엔드에는 Socket 이벤트가 브로드캐스트되지 않아 새로고침을 해야만 바뀐 카드가 보일 수 있습니다.
    *   **대응**: `mcp_server.js`가 DB 업데이트 후 로컬 HTTP/IPC 훅을 통해 `server.js`에게 핑을 날려 "상태 바뀌었으니 프론트엔드에 Socket.io 브로드캐스트 해!" 라고 알려주는 징검다리 로직을 구현합니다.

---

## 5. 승인 (Approval)
본 계획서는 대표님의 안티그래비티 연결 PoC 승인 이후 즉시 **Sprint 1**부터 착수됩니다.
