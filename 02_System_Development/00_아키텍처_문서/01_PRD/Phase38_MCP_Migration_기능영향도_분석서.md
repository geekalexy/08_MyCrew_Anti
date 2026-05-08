# Phase 38: MCP Migration 기능 영향도 및 전환 분석서

**문서 버전**: v1.0  
**작성일**: 2026-05-08  
**작성자**: 루카 (Luca, CTO & Architecture Lead)  
**상태**: 🟢 기획 완료 (Architecture Review)  
**연관 문서**: [Phase38_MCP_Server_아키텍처_기획서](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/00_아키텍처_문서/01_PRD/Phase38_MCP_Server_아키텍처_기획서.md)

---

## 1. 개요
마이크루의 핵심 타겟이 "고관여 유저(터미널 및 IDE를 다루는 메이커)"로 확정됨에 따라, 시스템을 MCP(Model Context Protocol) 서버로 전환합니다. 본 문서는 현재 마이크루에 개발된 모든 기능의 **현재 상태(As-Is)**를 진단하고, **MCP 도입 후 변경점(To-Be)**을 규명합니다.

---

## 2. 핵심 기능별 전환(Migration) 분석 리스트

### 2.1 칸반 보드 및 태스크 상태 관리 (Kanban & Task Management)
*   **현재 상태 (As-Is)**
    *   `database.js`를 통해 SQLite에 직접 접근.
    *   Socket.io 기반으로 프론트엔드 대시보드에 상태 변화(`task:created`, `task:moved`) 브로드캐스트.
    *   외부 툴(클로드 코드 등)이 칸반 보드 데이터를 읽거나 카드를 옮길 방법이 전혀 없음.
*   **변경 후 (To-Be)**
    *   **MCP Resources**: 칸반 보드 데이터를 `resources://mycrew/kanban` 형태로 개방. 클로드 코드나 커서(Cursor)가 명령 한 번으로 전체 보드 상태를 JSON 형태로 파악 가능.
    *   **MCP Tools**: `create_task`, `move_task_status` 등의 툴을 노출. 외부 에이전트 터미널에서 작업 완료 후 "칸반 카드 12번을 Done으로 옮겨줘"라고 하면 마이크루 대시보드의 카드가 실시간으로 스윽 이동함.

### 2.2 자율 릴레이 파이프라인 (`/run`)
*   **현재 상태 (As-Is)**
    *   서버 내부의 릴레이 루프(`startPipelineInternal`)와 하드코딩된 API 호출에 의존.
    *   에이전트들이 `create_next_sprint_task` 도구를 통해 바통 터치.
*   **변경 후 (To-Be)**
    *   내부 루프 엔진은 유지하되, **외부 터미널(Claude Code) 참여 가능**.
    *   릴레이 중간에 "코드 작성" 단계가 오면, 마이크루 내부 아리가 아닌 사용자의 터미널에 띄워진 클로드 코드가 바통을 넘겨받아 코딩을 수행하고, 완료 후 다시 MCP Tool을 통해 "QA 에이전트"에게 바통 터치.

### 2.3 파일 브릿지 및 외부 위임 (File Polling Adapter)
*   **현재 상태 (As-Is)**
    *   마이크루와 안티그래비티를 연결하기 위해 임시방편으로 `.agents/tasks/` 폴더에 JSON 파일을 떨구고 감시(Watch)하는 구시대적 File Polling 방식 사용.
*   **변경 후 (To-Be)**
    *   **투트랙(Two-Track) 연동 방식 지원**.
    *   MCP를 네이티브로 지원하는 최신 툴(Cursor, Claude Code 등)을 위해서는 표준 **MCP Client-Server 통신**을 오픈합니다.
    *   하지만 정책적으로 MCP가 막혀있거나 연결이 까다로운 IDE(Codex, 일부 사내망 IDE 등)를 위해, 가장 원시적이지만 100% 호환성을 보장하는 **File Polling 브릿지 방식도 하위 호환성(Legacy Support) 목적**으로 유지합니다.

### 2.4 스킬 라이브러리 및 도구 실행 (인스타 스크래퍼 등)
*   **현재 상태 (As-Is)**
    *   `executor.js` 내부에서 Puppeteer 기반 인스타 스크래퍼 모듈을 하드코딩하여 직접 실행.
    *   아리(Flash)가 직접 실행 후 JSON 포맷팅 시 잦은 환각(Hallucination) 발생.
*   **변경 후 (To-Be)**
    *   마이크루 내부에 하드코딩된 스크래퍼 삭제.
    *   오픈소스로 배포되는 `mcp-server-puppeteer` 또는 `mcp-server-instagram`을 플러그인처럼 장착.
    *   데이터 파싱 및 실행은 클로드 코드(Sonnet)가 터미널에서 환각 없이 완벽하게 수행하고, 결과물(정형화된 JSON)만 마이크루 DB에 기록.

### 2.5 로그 드로어 및 실시간 관제 (Log Drawer)
*   **현재 상태 (As-Is)**
    *   서버에서 `broadcastLog` 함수를 호출하여 브라우저에 뿌려주는 단순 모니터링 창.
*   **변경 후 (To-Be)**
    *   **공유 메모리(Shared Memory)**화.
    *   터미널에서 작업 중인 클로드 코드가 길을 잃었을 때 `resources://mycrew/logs`를 조회하여 "다른 에이전트들이 무슨 대화를 나눴는지" 즉시 컨텍스트 복구 가능.

### 2.6 개발 방법론 및 CEO 작업 환경의 변화 (Development Paradigm Shift)
*   **현재 상태 (As-Is)**: 새로운 기능(예: 깃허브 크롤링, 웹 검색) 추가 시, 대표님과 AI가 직접 `executor.js`에 백엔드 코드를 짜고 JSON 스키마를 맵핑하며 서버를 껐다 켜야 함.
*   **변경 후 (To-Be)**: 마이크루 내부 백엔드 코딩이 대폭 축소됨. 대표님은 터미널에서 명령어 한 줄(예: `npx @smithery/cli install @modelcontextprotocol/server-github`)로 전 세계 개발자들이 만든 MCP 서버를 다운받아 마이크루에 "연결(Plug-in)"하기만 하면 됨. 대표님의 작업 초점이 **'지루한 로우레벨 코드 작성'에서 '시스템 전체 아키텍처 설계 및 UI 오케스트레이션'으로 완전히 이동**함.

### 2.7 대시보드 UI/UX 필수 변경 사항 (UI Impact)
MCP 서버로의 전환은 백엔드 구조의 변화지만, 이를 담아낼 프론트엔드 UI의 변화도 불가피합니다.
*   **[신규] MCP 플러그인 관리 패널**: 외부 MCP 서버들을 관리(연결/해제/환경변수 입력)할 수 있는 독립된 설정(Settings) UI 페이지 필요.
*   **[변경] 외부 에이전트 뱃지 (Kanban)**: 칸반 카드의 담당자(Assignee)에 내부 가상 에이전트(`dev_senior` 등)뿐만 아니라, **외부 클라이언트(`Alex's Terminal (Claude)`, `Cursor IDE`)**가 표시될 수 있는 시각적 식별 UI 추가.
*   **[신규] 보안 승인 팝업 (Approval Modal)**: 외부 터미널(클로드 코드)이 마이크루를 통해 파일 삭제 등 위험한 권한을 요청할 때, 웹 대시보드 상단에 승인/거절(Approve/Deny)을 묻는 팝업 UI 필수.

---

## 3. 마이그레이션 아키텍처 다이어그램 (To-Be)

```mermaid
graph TD
    subgraph 마이크루 (MyCrew MCP Server)
        A[Ari 엔진 / Node.js]
        B[(SQLite DB)]
        C[Kanban Board API]
        D[Log/Context System]
        
        A -->|Reads/Writes| B
        A --- C
        A --- D
    end

    subgraph 외부 에이전트 (High-Involvement Clients)
        E[Claude Code / Terminal]
        F[Cursor / IDE]
        G[AntiGravity]
    end

    E <==>|MCP Protocol| A
    F <==>|MCP Protocol| A
    G <==>|MCP Protocol| A
    
    subgraph 마이크루 대시보드 (GUI)
        H[웹 브라우저 UI]
        H <==>|Socket.io| A
    end
```

## 4. 결론 및 우선순위
마이크루는 고관여 유저들에게 단순한 프론트엔드 UI가 아니라, **"터미널 에이전트(Claude Code)들의 작업 궤적을 기록하고 시각화하는 시스템 허브(Hub)"**가 됩니다. 

*   **Phase 38 최우선 과제**: 낡고 불안정한 `File Polling Adapter`를 먼저 도려내고, 그 자리에 `MyCrew MCP 통신 모듈`을 이식하는 작업을 가장 1순위로 진행해야 합니다.

---

## 5. Q&A: 환경별 커스텀 매핑과 생태계 확장

**Q. MCP로 클로드 코드(Claude Code)가 아니라 안티그래비티(AntiGravity)를 붙여서 사용하는 것도 가능한가요?**
**A. 네, 완벽하게 가능합니다.** 
이것이 마이크루의 궁극적 목표입니다. 기존에 `File Polling`이라는 원시적인 파일 감시 방식으로 안티그래비티와 통신하던 것을 버리고, 안티그래비티 자체를 마이크루의 **표준 플러그인(MCP Client)**으로 찰칵 하고 연결할 수 있습니다. 

**Q. 사용자가 어떤 툴(코덱스, 안티그래비티, 단일 LLM API 등)을 붙이는지에 따라 개발팀 역할별 모델이 알아서 셋팅되고 커스텀할 수 있는 개념인가요?**
**A. 정확합니다. 마이크루는 '가상의 빈 책상 12개(CTO, 프론트엔드 등)'를 뼈대로 제공하는 오케스트레이터입니다.** 
어떤 '뇌(실행 툴)'를 그 책상에 앉힐 것인가는 전적으로 유저가 유연하게 셋팅할 수 있습니다.

*   **시나리오 1: 안티그래비티 연결 (고관여 유저)**
    마이크루에 안티그래비티를 MCP로 연결하면, 안티그래비티가 제공하는 오픈 라우팅 모델(Claude Sonnet, Gemini 3.1 Pro 등)이 즉시 CTO(`dev_senior`)와 개발자 역할을 위임받아 내 로컬 프로젝트에서 자율 코딩을 시작합니다.
*   **시나리오 2: 터미널 툴 없이 웹(SaaS) 접속 (저관여 유저)**
    연결된 외부 터미널 툴이 없으면, 시스템은 유저가 입력한 **순수 API 키(OpenAI, Gemini 등)**를 기본 '뇌'로 사용하도록 Fallback(대체) 셋팅합니다. 유저는 설정 화면에서 *"CTO는 GPT-4o, 마케터는 Gemini Flash로 셋팅"*하는 방식으로 커스텀 매핑합니다. 로컬 터미널 코드 실행은 차단되지만, 기획/마케팅 보조 봇으로는 완벽히 작동합니다.
*   **시나리오 3: 클로드 코드(Claude Code) 연결**
    터미널에서 클로드 코드를 켜고 마이크루를 연결하면, 클로드 코드가 해당 프로젝트의 개발 업무 카드를 스스로 물고 가서 터미널을 휘저으며 작업을 끝냅니다.

**결론적으로 마이크루는:** 
코딩을 모르는 마케터에게는 **"API 키 하나만 꽂으면 알아서 굴러가는 12명의 독립 대행사"**로, 하드코어 개발자에게는 **"내 안티그래비티 IDE를 24시간 자율주행하게 묶어주는 수석 프로젝트 매니저(PM)"**로 완벽하게 다중 포지셔닝을 할 수 있습니다.
