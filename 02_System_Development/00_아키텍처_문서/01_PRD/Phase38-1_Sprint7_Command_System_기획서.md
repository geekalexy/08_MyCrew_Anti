# Phase 38-1 (Sprint 7): Chrome Extension Command System & 스킬 연동 기획서

- **작성일**: 2026-05-09
- **작성자**: 루카 (Luca)
- **상위 기획서**: [Phase38-1_ChromeExtension_에이전트_기획서.md](./Phase38-1_ChromeExtension_에이전트_기획서.md)

---

## 1. 개요 (Overview)
현재 크롬 익스텐션 에이전트는 사용자의 브라우저 화면을 읽고 제어하는 **"Local Action(프론트엔드 DOM 제어)"** 능력을 갖추었습니다.
본 기획서(Sprint 7)는 이를 넘어, 에이전트가 마이크루 백엔드의 핵심 시스템(Kanban DB, 파이프라인 등)을 직접 조작할 수 있도록 **"System Action(백엔드 도구 제어)"**과 **"Slash Command(빠른 명령어)"**를 통합 연동하는 워크플로우를 정의합니다.

---

## 2. 액션 종류 명확화 (Action Types Classification)
에이전트가 수행하는 '액션(Action)'을 실행 주체와 영역에 따라 두 가지로 엄격히 분리합니다.

### A. Local Browser Action (프론트엔드 액션)
- **목적**: 사용자가 현재 보고 있는 웹페이지(DOM)를 물리적으로 조작.
- **포맷**: `{"action": "CLICK" | "TYPE" | "SCROLL", ...}`
- **실행 위치**: 크롬 익스텐션 내부 (`App.jsx` -> `chrome.scripting.executeScript`)
- **특징**: 백엔드는 개입하지 않으며, 클라이언트의 자바스크립트(Native Setter 등)를 이용해 즉시 실행됨.

### B. System Backend Action (백엔드 스킬 액션)
- **목적**: 마이크루 시스템의 데이터베이스(SQLite) 상태를 변경하거나 백그라운드 파이프라인을 트리거.
- **포맷**: `{"system_action": { "action": "CHANGE_STATUS" | "CREATE_TASK" | "ASSIGN_AGENT", ... }}`
- **실행 위치**: 마이크루 브릿지 서버 (`server.js` -> `dbManager` 또는 `executor`)
- **특징**: LLM이 반환한 응답을 프론트엔드로 보내기 전에 **백엔드에서 먼저 가로채어(Intercept) 파싱**하고, 실제 DB 조작 후 성공 여부를 익스텐션에 피드백함.

---

## 3. 퀵 커맨드 시스템 (Slash Commands)
사용자가 자연어 인식을 기다리지 않고 시스템 기능(스킬)을 즉각적으로 명시 호출하기 위한 단축키 시스템입니다.
프론트엔드에서 사용자가 입력 후 엔터를 치면, 백엔드가 LLM에게 넘기기 전에 선제적으로 처리합니다.

| 커맨드 | 문법 | 설명 | 워크플로우 |
| :--- | :--- | :--- | :--- |
| **`/task`** | `/task [작업 내용]` | 현재 프로젝트의 Inbox(To-Do)에 즉시 새 칸반 카드를 생성합니다. | `server.js` 인터셉트 → `dbManager.createKanbanTask` → Socket 갱신 → 익스텐션 응답 |
| **`/context`**| `/context` | [보안/컨텍스트 관리] 활성화된 웹페이지 텍스트를 컨텍스트로 불러옵니다. 영구 지식(DB) 오염 방지를 위해, **저장되지 않는 1회성 휘발성 리소스(`resource://mycrew/context/ephemeral_tab_1`)로만 등록**하며 **TTL 30분 하드 타임아웃**을 적용하여 비정상 세션 종료 시에도 메모리 잔류를 방지합니다. | 익스텐션 화면 추출 → 백엔드 휘발성 MCP 메모리에 단기 보관 (`maxAgeMs: 1800000`) |

---

### ⏳ 추가 연구 필요 (Pending Research)
*   **`/run` (또는 `/goal`) 커맨드 아키텍처**
    *   최근 AI 업계(Codex 등)에서 발표한 **`/Goal` 커맨드 패러다임**을 마이크루 시스템에 적용하기 위한 선행 연구가 필요합니다.
    *   단순히 기존의 절차적인 릴레이 파이프라인(Rule-based Execution)을 실행하는 것을 넘어, **목표(Goal)를 선언하면 MCP 클라이언트들이 알아서 전략을 세우고 협업하는 자율 에이전트(Autonomous Goal-Driven) 방식**으로의 구조적 설계 전환을 검토합니다.
    *   *상태: 보류 및 별도 연구 과제로 분리 (Sprint 7 개발 범위에서 제외).*

---

## 4. 도구 스킬 워크플로우 (Tool Skill Workflow)

### 시나리오: "13번 카드 완료 처리해줘" (System Action)
1. **[User]**: 익스텐션 채팅창에 "13번 카드 완료 처리해줘" 입력.
2. **[LLM]**: `ContextInjector`로 주입받은 `ARI_BRAIN` 규칙에 따라 `CHANGE_STATUS` 액션이 포함된 JSON 응답 생성.
   - *예: `{"system_action": {"action": "CHANGE_STATUS", "target": "COMPLETED", "taskId": 13}}`*
3. **[Backend Intercept]**: `server.js` (`extension:chat` 핸들러)
   - LLM 응답 텍스트에서 정규식으로 `system_action` 블록을 탐지 및 파싱.
   - 텍스트에서 JSON 블록을 깔끔하게 제거.
   - ⚠️ **[Graceful Fallback]**: JSON 파싱 실패 시(마크다운 코드펜스 누락, 키 순서 변경 등) 에러를 삼키고 사용자에게 `"명령을 처리하지 못했습니다. 다시 한 번 말씀해 주세요."` 안내 메시지를 반환. LLM의 원문 텍스트는 그대로 전달하여 대화 흐름이 끊기지 않도록 보장.
4. **[System Execution]**: `server.js`
   - `dbManager.updateTaskStatus(projectId, 13, 'COMPLETED')` 함수 호출.
   - 성공 시 로컬 칸반 보드 탭에 `project:update` 소켓 이벤트 발송 (칸반 보드 UI 실시간 변경됨).
5. **[Feedback to Extension]**: 
   - 파싱된 깔끔한 텍스트("네, 13번 카드를 완료 처리했습니다!")를 익스텐션 프론트엔드로 전송.

---

## 5. 보안 설계 — Approval Modal (Prime 리뷰 #1 반영)

> ⚠️ **LLM Safety Bypass + DOM 제어 권한이 동시에 열린 상태는 프롬프트 인젝션 리스크가 존재합니다.**
> — Prime 리뷰 (2026-05-09)

Sprint 7에서는 **System Action(DB 변경) 실행 전** 반드시 사용자 확인(Approval)을 거치는 보안 계층을 추가합니다.

| 액션 유형 | 위험 등급 | 승인 방식 |
|:---|:---|:---|
| `CHANGE_STATUS` (상태 변경) | 🟡 Medium | 익스텐션 내 인라인 확인 버튼 ("13번 카드를 '완료'로 변경할까요? [확인/취소]") |
| `CREATE_TASK` (카드 생성) | 🟢 Low | 자동 실행 (생성은 비파괴적이므로 즉시 허용) |
| `ASSIGN_AGENT` (담당자 변경) | 🟡 Medium | 익스텐션 내 인라인 확인 버튼 |
| Local Browser Action (CLICK/TYPE) | 🔴 High | 현재는 자동 실행, 향후 MCP V2에서 대시보드 Approval Modal로 격상 검토 |

---

## 6. 단계별 개발 계획 (Implementation Plan)

### Step 1: Backend Interceptor 구축 (`server.js`)
- `extension:chat` 수신부에서 텍스트가 `system_action`을 포함하고 있는지 검사하는 파서(Regex Parser) 구현.
- LLM 응답을 프론트엔드로 보내기 전, 백엔드에서 액션을 동기(Awaited) 처리하는 로직 추가.
- **[Graceful Fallback]**: `JSON.parse` 실패 시 에러를 삼키고, 원문 텍스트를 그대로 전달하며 안내 메시지(`"명령을 처리하지 못했습니다."`)를 덧붙이는 fallback 로직 필수 구현.

### Step 2: System Action 컨트롤러 연결 (`dbManager` 연동)
- `CHANGE_STATUS` (칸반 상태 변경) 구현
- `CREATE_TASK` (칸반 카드 생성) 구현
- `ASSIGN_AGENT` (크루 멤버 할당) 구현
- 모든 액션 완료 시 `socket.emit('project:update')`를 트리거하여 대시보드 화면 동기화.

### Step 3: Approval Gate 구현 (보안 승인 계층)
- Medium 위험 등급 이상의 System Action 감지 시, 익스텐션에 `extension:confirm_action` 이벤트를 발송.
- 사용자가 [확인]을 누르면 실행, [취소]를 누르면 폐기하고 안내 메시지 반환.

### Step 4: Slash Command 전처리기 구축 (`server.js`)
- `if (text.startsWith('/task '))` 형태의 전처리 로직 구현.
- 슬래시 커맨드 사용 시 LLM 호출 비용을 아끼기 위해 LLM을 거치지 않고 즉시 시스템 기능으로 연결 후 Feedback 응답(Direct Response).

### Step 5: UI 폴리싱 (명령어 가이드)
- 익스텐션 채팅창 입력 영역 위에 "`/task 내용` 으로 즉시 카드 생성" 같은 플레이스홀더(Placeholder) 또는 도움말 힌트 제공.
