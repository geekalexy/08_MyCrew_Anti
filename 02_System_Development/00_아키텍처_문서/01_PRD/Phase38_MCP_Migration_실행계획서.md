# Phase 38: MCP V2 마이그레이션 실행 계획서

**문서 버전**: v1.0
**작성일**: 2026-05-09
**작성자**: 루카 (Luca, CTO & Architecture Lead)
**상태**: 🟢 실행 중 (In Progress)

---

## 1. 개요 (Overview)
`v1.0-final`로 동결된 파일 폴링 기반의 레거시 엔진(`ariDaemon.js`)을 완전히 폐기하고, 시스템을 **표준 Model Context Protocol (MCP)** 규격을 준수하는 마이크로서비스 아키텍처(V2)로 전환합니다. 
마이크루 백엔드는 더 이상 능동적으로 파일을 읽고 쓰는 '일꾼'이 아니라, 외부 클라이언트(Claude Code, Antigravity, Chrome Extension 등)가 안전하게 접속하여 데이터를 읽고(Resources) 도구를 실행(Tools)할 수 있게 해주는 **'작전 통제소(Command Center)'** 역할을 수행합니다.

## 2. 단계별 실행 계획 (Execution Plan)

### Step 1: MCP Core SDK 도입 및 환경 구성 (현재 진행)
* **목표**: `01_아리_엔진`에 공식 MCP SDK 연동.
* **작업 내용**:
  - `@modelcontextprotocol/sdk` NPM 패키지 설치.
  - V2용 메인 진입점 `mcp-server.js` 생성.
  - Stdio / SSE 통신 트랜스포트 계층(Transport Layer) 세팅.

### Step 2: Resource Abstraction (데이터 노출 계층)
* **목표**: DB의 칸반 데이터를 MCP 클라이언트가 읽을 수 있는 표준 URI 체계로 노출.
* **작업 내용**:
  - `kanban://project/{id}/tasks` : 프로젝트 전체 태스크 리스트 리소스.
  - `kanban://task/{id}` : 단일 태스크의 세부 내용 리소스.
  - `dbManager.js`의 Read 메서드들을 MCP Server의 `setRequestHandler(ListResourcesRequestSchema)` 및 `ReadResourceRequestSchema`로 래핑.

### Step 3: Tool Abstraction (도구 실행 계층)
* **목표**: 하드코딩된 액션들을 MCP 클라이언트가 호출할 수 있는 명세(JSON Schema)화 된 도구로 전환.
* **작업 내용**:
  - `create_task`, `update_status`, `assign_agent` 도구를 MCP Server의 `setRequestHandler(ListToolsRequestSchema)`에 등록.
  - `CallToolRequestSchema`를 통해 기존 `dbManager.js`의 Write 메서드들을 연결.
  - 도구 실행 전 **Approval Gate(승인 로직)** 모듈을 Tool Handler 내부에 캡슐화.

### Step 4: 레거시 폐기 및 라우팅 전환 (Deprecation)
* **목표**: V1 아키텍처 청소 및 완전한 V2 전환.
* **작업 내용**:
  - `ariDaemon.js`의 정규식 폴링 로직 비활성화.
  - `server.js`의 익스텐션 소켓 통신을 MCP SDK(SSE Transport) 또는 브릿지로 매핑.
  - `v2.0-mcp` 안정화 버전 릴리즈.

---

## 3. 예상 아키텍처 변화도

**[V1 Legacy (과거)]**
사용자 ➔ DB(SQLite) ➔ `ariDaemon.js` (폴링 ➔ LLM 호출 ➔ 정규식 파싱 ➔ DB Write) ➔ 사용자 UI 갱신

**[V2 MCP Server (현재)]**
사용자 (Chrome Ext / Antigravity) ➔ **[MCP Protocol]** ➔ `mcp-server.js` (도구 명세 제공 및 실행) ➔ `dbManager.js` ➔ DB(SQLite) ➔ UI (Socket.io 동기화)

---
*본 문서는 작업 진행에 따라 실시간으로 갱신됩니다.*
