# 🚀 Phase 39-2: Plan Master Architecture Audit Report

## 1. 개요 및 목적
본 감사는 `Phase39-2_Plan_Master_개발구현계획서.md` 및 `Phase39-1_Plan_Master_디버깅리포트_v1.md`를 바탕으로, 현재 구현된 Plan Master의 백엔드 파이프라인(`server.js`, `mcp_server.js`, `executor.js`)과 프론트엔드(`PlanMasterModal.jsx`, `TaskDetailModal.jsx`)가 **실제 Sequential Thinking MCP 스키마 규칙**을 완벽하게 준수하고 있는지 구조적 무결성을 분석한 결과입니다.

## 2. Graphify 기반 구조적 분석 종합
Graphify 메타데이터 및 의존성 관계망(`mcp_server.js` ↔ `server.js` ↔ `TaskDetailModal.jsx`)을 추적한 결과, JSON 스키마는 겉보기에 완벽하게 구현되어 UI에 렌더링되고 있으나, **내부 파이프라인(Agentic Loop)의 핵심 동작 원리가 심각하게 누락되어 있는 형태(Mocking)** 로 확인되었습니다.

---

## 3. 핵심 구현 누락 및 이상 발견 사항 (Critical Findings)

> [!WARNING]
> 현재 시스템은 Sequential Thinking의 "외형(JSON)"만 흉내 내고 있으며, 본질적인 "다단계 사고 루프(Multi-step reasoning)"가 끊어져 있는 상태입니다.

### 🔴 1. 도구 실행의 Mock 처리 (Native Tool Calling 부재)
- **증상:** `mcp_server.js`에는 `analyze_scope`, `make_roadmaps`, `confirm_mvp`가 완벽한 Sequential Thinking `inputSchema`로 정의되어 있습니다. 하지만, 정작 `server.js`의 API 라우터(`/api/projects/:id/plan-master/analyze` 등)에서는 LLM에게 **해당 도구를 함수 호출(Function Calling)로 사용하도록 요청하지 않습니다.**
- **구현 이상:** 프롬프트 상에 JSON 형식을 하드코딩하여 "이 형식과 완벽히 일치하는 순수 JSON을 텍스트로 반환하라"라고 강제하고 있으며, 단순히 `JSON.parse(result.text)`로 1회성 파싱만 진행합니다. 이는 MCP 기반의 동적인 Tool Calling이 아닙니다.

### 🔴 2. Sequential Thinking Loop 단절 (`nextThoughtNeeded`의 무용지물화)
- **증상:** 진짜 Sequential Thinking은 `nextThoughtNeeded: true`를 반환할 때 호스트가 재귀적으로 LLM을 다시 호출하는(While Loop) 파이프라인이 필수입니다.
- **구현 이상:** `server.js`의 System Prompt에는 예시로 `"nextThoughtNeeded": false`를 박아두었습니다. 백엔드 로직 어디에도 파싱된 결과의 `nextThoughtNeeded`가 `true`일 때 재요청을 보내는 로직이 없습니다. 프론트엔드의 `TaskDetailModal.jsx`에 있는 `{parsed.nextThoughtNeeded ? '사고 진행 중...' : '사고 완료'}` 렌더링은 사실상 영원히 '사고 완료'만 보여주는 껍데기 UI입니다.

### 🟠 3. 단일 책임 원칙(SRP) 위반: 스키마 병합(Collapse) 현상
- **증상:** `mcp_server.js`에서는 `make_roadmaps`와 `confirm_mvp`를 명확히 2개의 분리된 도구로 설계했습니다.
- **구현 이상:** `server.js`의 `/plan-master/generate-roadmaps` API에서는 LLM에게 "다음 단계인 `make_roadmaps`와 `confirm_mvp`의 결과를 **하나의 JSON 객체로 합쳐서 반환하라**"고 지시합니다. 이는 MCP 도구의 관심사 분리를 깨뜨리는 Anti-pattern입니다.

### 🟡 4. Graphify Future Scope 노드 등록 우회
- **증상:** `mcp_server.js`의 `make_roadmaps` 스키마 안에는 `graph_nodes` 옵션이 있어 Graphify 지식망에 노드를 주입할 수 있도록 설계되어 있습니다.
- **구현 이상:** `server.js`의 파이프라인은 이 노드 등록을 거치지 않고, `parsedResult.future_scope` 텍스트 배열만 가져다가 곧바로 `createTask([확장 버전] ...)` 칸반 카드로 밀어넣고 있습니다. 지식망과 칸반 백로그 간의 실시간 동기화가 누락되었습니다.

---

## 4. 최종 결론 및 넥스트 액션 제안

현재의 Plan Master 모드는 "Single-shot JSON Generator"이며, 엄밀한 의미의 Sequential Thinking MCP 연동 시스템이 아닙니다. 벤치마킹 리포트의 설계 의도(AI가 스스로 스코프를 쪼개고, 고민하고, 심화 질문을 던지는 과정)를 100% 달성하려면 백엔드 엔진의 재설계가 필요합니다.

> [!TIP] 
> **권장 수정 방향 (Phase 39-2 작업 완료 내역)**
> 1. `server.js`의 하드코딩된 프롬프트를 제거하고, `antigravityAdapter`에 `tools` 인자를 넘겨 Native MCP Tool Calling으로 전환해야 합니다. **(✅ 완료)**
> 2. `executor.js`나 `server.js` 내부에 `while (nextThoughtNeeded)` 루프를 신설하여, LLM이 사고 과정을 스스로 종료할 때까지 백그라운드에서 사고를 반복하도록 파이프라인을 보강해야 합니다. **(✅ 완료)**
> 3. 프론트엔드에서는 웹소켓으로 중간 사고 과정(`thoughtNumber: 1`, `thoughtNumber: 2`...)이 스트리밍되도록 하여 진짜 "사고 진행 중..." UX를 제공해야 합니다. **(✅ 완료)**
