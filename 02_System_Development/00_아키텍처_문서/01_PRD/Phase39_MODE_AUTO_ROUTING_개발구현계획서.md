# Phase 39: MODE & AUTO-ROUTING 개발 구현 계획서

**작성일**: 2026-05-10  
**작성자**: 루카 (Luca)  
**상태**: ✅ Completed (진행 완료)
**연결 문서**: [Phase39_MODE_AUTO_ROUTING_기획](Phase39_MODE_AUTO_ROUTING_기획.md)

---

## 1. 개요 및 목적
본 문서는 `Phase39_MODE_AUTO_ROUTING_기획.md` (Zero-Command UX 개편 PRD)의 요구사항을 실제 프론트엔드 UI와 백엔드 API에 통합 반영하기 위한 구체적인 기술 구현 계획 및 완료 내역을 담고 있습니다.

**핵심 목표**: 
1. `TaskDetailModal.jsx` 내에 4대 모드(Architect, Dev, QA, Debug) 선택 UI 및 매크로 라벨 시각화 적용
2. 모드 선택 시, 백엔드 라우터로 `mode` 파라미터를 전달하여 최적의 LLM(Opus, Sonnet, Gemini 등)을 강제 할당
3. 본문(Content) 내용 누락 시, 시스템이 스스로 기획(ARCHITECT) 모드로 폴백(Auto-Fallback)하는 방어 로직 및 토스트 UI 구축

---

## 2. 프론트엔드 구현 상세 (02_워크스페이스_대시보드)

### 2.1. TaskDetailModal.jsx UI 개편
*   **모드 선택기(Mode Selector) 추가**:
    *   칸반 태스크의 메타 속성(Meta Properties) 영역에 `<select>` 드롭다운을 추가하여 4가지 모드 선택을 지원.
    *   모드 변경 시 DB와 즉시 동기화 (`PATCH /api/tasks/:id`).
*   **매크로 라벨 레이아웃 재배치**:
    *   기존에는 댓글 입력 창 내부에 종속되어 있던 모드 설명 라벨을, **Discussion 탭 상단(메타 속성 바로 아래)**으로 분리.
    *   시각적 가시성을 높이기 위해 여백(`marginBottom: 16px`), 곡률(`borderRadius: 6px`) 및 각 모드별 고유 컬러(기획: 보라, 개발: 녹색, 리뷰: 노랑, 디버그: 빨강) 적용.

### 2.2. 빈 내용 시 기획 모드 자동 전환 (Auto-Fallback)
*   **상황**: 사용자가 `제목(Title)`만 입력하고 `본문(Content)`을 비워둔 채 **개발(DEV)**, **리뷰(QA)** 모드로 파이프라인 전송(실행 시작) 시도.
*   **구현 로직 (`checkAutoFallback` 함수)**:
    1.  `task.content`가 비어있거나 5자 미만인지 검사.
    2.  `DEV`, `QA`, `DEBUG` 모드일 경우 강제로 `mode: 'ARCHITECT'`로 변경 및 백엔드 동기화.
    3.  동시에 화면 하단에 애니메이션 효과가 적용된 토스트 메시지 출력: 
        *"📋 상세 내용이 없어 기획 모드로 자동 전환되었습니다."*
    4.  이후 `handleSubmitComment` 및 `handleStartTask`에서 변환된 모드를 바탕으로 백엔드 파이프라인 트리거.
*   **효과**: 팝업(Alert)으로 인한 맥락 끊김(Friction) 없이, 시스템이 사용자의 실수를 보정하고 올바른 워크플로우로 유도(Smart Correction).

---

## 3. 백엔드 구현 상세 (01_아리_엔진)

### 3.1. REST API 수정 (`server.js`)
*   **댓글 전송 (`POST /api/tasks/:id/comments`) 및 제로커맨드 실행 (`POST /api/tasks/:id/run`) 라우팅**:
    *   프론트엔드로부터 전달받은 `req.body.mode` (또는 DB에 저장된 `mode`) 속성 추출.
    *   기획서 명세에 따라, 선택된 모드를 **고성능 매크로 스킬(Macro Skill)** 시스템 지시어로 변환 및 최적 모델 강제 할당(`forceModel`):
        *   📐 **`ARCHITECT` (기획 모드)** 👉 **`/plan_master` 수행**
            *   내부 로직: `[System Mode Directive] 사용자가 '기획 모드'로 실행했습니다. '/plan_master' 스코프 분석 및 로드맵 자동 생성을 수행하세요.` 컨텍스트 주입.
            *   사용 모델: **Claude Opus 4.6 (Thinking) + Gemini 3.1 Pro (High)**
        *   💻 **`DEV` (개발 모드)** 👉 **`/auto_run` 수행**
            *   내부 로직: `[System Mode Directive] 사용자가 '개발 모드'로 실행했습니다. '/auto_run' 태스크 기반 자율 연속 파이프라인 실행을 수행하세요.` 컨텍스트 주입.
            *   사용 모델: **Gemini 3.1 Pro (High)**
        *   🕵️‍♂️ **`QA` (리뷰 모드)** 👉 **`/auto_test` 수행**
            *   내부 로직: `[System Mode Directive] 사용자가 '리뷰 모드'로 실행했습니다. '/auto_test' 시나리오 기반 자율 테스트 및 검증을 수행하세요.` 컨텍스트 주입.
            *   사용 모델: **Claude Opus 4.6 (Thinking)**
        *   🧰 **`DEBUG` (디버깅 모드)** 👉 **`/auto_debug` 수행**
            *   내부 로직: `[System Mode Directive] 사용자가 '디버깅 모드'로 실행했습니다. '/auto_debug' 로그 추적 및 에러 자율 수정을 수행하세요.` 컨텍스트 주입.
            *   사용 모델: **Claude Sonnet 4.6 (Thinking) + Gemini 3.1 Pro (High) (Fallback)**
    *   설정된 매크로 지시어와 `forceModel`을 `executor.runDirect` 및 `forceRedispatchTask` 우회 파이프라인에 전달하여 즉각적이고 강제적인 릴레이 실행 보장.

### 3.2. 실행기 엔진 업데이트 (`executor.js`)
*   **`runDirect` 함수 서명 변경**:
    *   기존의 `targetModel` 판정 로직을 오버라이드할 수 있도록 `forceModel` 인자 추가 수용.
    *   `forceModel`이 명시된 경우, 복잡한 인텐트 라우팅 연산을 생략하고 즉시 해당 모델과 매크로 프롬프트를 결합하여 MCP 서버로 쿼리 전송.

---

## 4. 작업 완료 체크리스트 (Completed Tasks)
- [x] **모드 선택기 UI 통합**: `TaskDetailModal.jsx` 내 모드(Mode) 선택 드롭다운 UI 추가 및 상태 동기화 로직 구현.
- [x] **매크로 라벨 UI 개편**: 댓글창에 종속되었던 모드별 스킬 라벨을 독립시켜, 메타 속성 패널 하단(Discussion 탭 상단)으로 직관적 재배치 및 디자인 최적화.
- [x] **백엔드 Mode 라우팅 구현**: `POST /api/tasks/:id/comments` 및 `/run` 엔드포인트에서 `mode` 속성을 파싱하여 의도 기반 분기 처리 구축 (`server.js`).
- [x] **LLM 강제 할당 파이프라인**: 각 모드 특성에 맞는 최고 성능 모델(Opus, Sonnet, Gemini Pro 등)을 `executor.js` 실행 시 강제 할당(`forceModel`)하도록 아키텍처 연동.
- [x] **빈 내용(Empty Body) Auto-Fallback 로직**: 상세 내용이 비어있을 때 사용자가 개발/리뷰 등을 시도하면, 프론트엔드가 이를 가로채 기획(ARCHITECT) 모드로 자동 변환하는 방어 로직 구현.
- [x] **토스트(Toast) 알림 UI**: Auto-Fallback 발동 시 사용자 경험을 해치지 않고 부드럽게 이유를 고지하는 토스트 메시지 UI 구축.
- [x] **상태 동기화 버그 디버깅**: 중복 REST 호출과 소켓 이벤트 간섭으로 발생하던 무한 루프 렌더링 문제 해결.

---

## 5. 잔여 작업 체크리스트 (Remaining Tasks)
- [x] **상태 머신 (State Machine) 연동**: 
  - 현재 칸반 컬럼(`To Do`, `In Progress`, `Review` 등)에 따라 사용 가능한 모드/커맨드를 동적으로 제한하고 큐레이션하는 로직 개발.
- [x] **자연어 의도 분석 라우터 (Zero-Command Router) 완성**: 
  - 모드를 명시적으로 선택하지 않고 텍스트만 입력했을 때, 초경량 라우터 에이전트(Gemini Flash)가 문맥을 파악해 적절한 모드로 단일 실행을 자동 할당하는 기능 구현.
- [x] **하이브리드 입력 모델 적용 (Mode + Text)**: 
  - 모드를 선택한 후 부가 지시사항 텍스트를 입력하면, 텍스트가 먼저 코멘트로 저장(`Pre-update`)된 뒤 컨텍스트 페이로드로 에이전트에게 함께 전달되는 기능 구현. (명시적인 슬래시 커맨드 배제)
- [ ] **Graphify MCP (지식 베이스 허브) 연동 사전 준비**: 
  - 기획 모드 구동 시 프로젝트의 전체 아키텍처 문서를 Graphify 기반으로 참조할 수 있도록 Python MCP 서버와 통신 파이프라인 개설.
- [ ] **각 모드별 핵심 매크로 스킬(Macro Skill) 실제 구현 (추후 진행)**:
  - 현재는 UI/UX 라우팅과 모델 강제 할당까지만 연동된 상태입니다.
  - `/plan_master`, `/auto_run` 등에 해당하는 실제 백엔드 시스템 프롬프트와 MCP 도구 파이프라인(Tool Chaining) 세부 기획 및 구현은 구체적 설계 확정 후 후순위로 진행합니다.
