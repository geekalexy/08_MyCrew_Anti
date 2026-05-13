# 🚀 Phase 43: `/auto_run` 스킬 및 도구 기획서 (Shrimp & Task Master 프롬프트 원문 도입)

**작성일**: 2026-05-13  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft  
**연관 문서**: [Phase39_Shrimp_Task_Manager_벤치마킹_기획서.md](Phase39_Shrimp_Task_Manager_벤치마킹_기획서.md)

---

## 1. 개요 및 목적
본 기획서는 Shrimp Task Manager의 **의존성 기반 원자 단위 실행력(Atomic Task Decomposition)**과 Claude Task Master의 **모듈형 프롬프트(Selective Loading)** 아키텍처를 결합하여, 개발자 에이전트(`dev_senior` 등)가 완전 자율 주행으로 코딩을 수행할 수 있도록 하는 `/auto_run` 도구 및 스킬의 동작 원리를 정의합니다.

이 도구는 단순한 채팅 명령어가 아니라, 백엔드 에이전트 루프의 뼈대를 이루는 **Stateful Context Manager**이자 **실행 스케줄러**로 동작합니다.

---

## 2. 모듈형 프롬프트 아키텍처 (Claude Task Master 차용)

거대한 시스템 프롬프트 하나에 모든 지시사항을 우겨넣는 기존 방식을 탈피하고, `/auto_run` 모드 진입 시에만 조립되어 주입되는 3단 모듈형 프롬프트를 설계합니다. 아래는 **Shrimp와 Task Master의 오리지널 프롬프트 구조를 거의 그대로 차용**한 핵심 원문(번역/적용본)입니다.

### 🧩 2.1. System Persona (`system.md` 오리지널 차용)
Task Master의 가장 핵심적인 `Main Model` 지시사항을 그대로 이식합니다.
> **[System Prompt]**
> "You are an expert Senior Fullstack Developer functioning as the 'Main Model' in an autonomous loop.
> Your ONLY purpose is to transform the provided PRD and task list into perfectly working code.
> 
> **CRITICAL RULES:**
> 1. Do NOT ask for permission to code. Just start coding immediately.
> 2. You must operate in 'Continuous Mode' when `/auto_run` is triggered.
> 3. After completing a task, DO NOT STOP. You must automatically call the `next_task` tool until all dependencies are resolved and the PRD is fully implemented.
> 4. If you encounter an error, use `query_graph` to trace the blast radius before applying a fix."

### 🧩 2.2. Tool Specification (`tools.md` 오리지널 차용)
Shrimp의 도구 명세 방식처럼, 툴을 '언제, 왜' 써야 하는지 LLM에게 명시적으로 설명하는 원문 방식을 도입합니다.
> **[Tools Guide]**
> - **`read_file`**: Use this BEFORE modifying any existing code. Never overwrite without knowing the current state.
> - **`write_file` / `multi_replace`**: Use this to write code. Modifying one file at a time is STRICTLY ENFORCED to maintain atomic execution.
> - **`query_graph`**: When an error occurs or before refactoring a core module, use this tool to find Cross-Community nodes. Do NOT guess the architecture.

### 🧩 2.3. Project Rules (`shrimp-rules.md` 오리지널 차용)
프로젝트별 고유 컨벤션을 주입하는 템플릿입니다.
> **[Shrimp Project Rules - MyCrew Edition]**
> - Styling: ONLY use Vanilla CSS (`index.css`). TailwindCSS is strictly forbidden unless overridden by the user.
> - State Management: Use React Context API or Zustand.
> - Logging: All execution logs must be broadcasted via the `statusReporter` using `broadcastLog`.

---

## 3. `/auto_run` 핵심 로직 (Shrimp Task Manager 차용)

`/auto_run` 명령이 호출되면, 백엔드에서는 1회성 응답이 아닌 **자율 루프(Continuous Mode)**가 가동됩니다.

### 🔄 3.1. 원자적 태스크 스케줄링 (Atomic Execution)
1. 에이전트는 기획(ARCHITECT) 모드에서 생성된 `v1.0_MVP_PRD`와 태스크 리스트를 읽어옵니다.
2. 각 태스크의 의존성(Dependencies)을 파악하여 **실행 우선순위 트리(Execution Tree)**를 구성합니다.
   - *예시: DB 스키마 생성(Task 1) → 모델 정의(Task 2) → API 라우트(Task 3) → 프론트엔드 연동(Task 4)*
3. 에이전트는 한 번에 **단 하나의 태스크**만 `IN_PROGRESS` 상태로 두고 집중하여 코딩합니다.

### 🔄 3.2. 자가 검증 및 궤도 복구 (Self-Correction & Reflection)
- 태스크 1(DB 스키마)을 완료하면, 에이전트는 즉시 다음 태스크로 넘어가지 않고 내부적으로 **Reflection(회고)**를 강제 수행합니다.
- *프롬프트 지시자*: "방금 작성한 코드가 요구사항을 충족하는지, 구문 오류나 오타는 없는지 검토하십시오."
- 에러가 발견되면 스스로 코드를 재수정하며, 완벽해졌다고 판단될 때만 상태를 `DONE`으로 변경하고 다음 태스크로 넘어갑니다.

### 🔄 3.3. 인간의 개입 (Intervention) 지원
- 에이전트가 `/auto_run`으로 코드를 짜는 도중, 사용자가 대시보드에서 코멘트(예: "잠깐, 회원가입에서 소셜 로그인은 빼줘")를 남길 수 있습니다.
- 시스템은 에이전트의 루프 사이에 인터럽트(Interrupt)를 발생시켜, 최신 사용자의 코멘트를 컨텍스트에 긴급 주입(Hot-inject)합니다.
- 에이전트는 하던 작업을 멈추지 않되, 변경된 지시사항을 반영하여 궤도를 유연하게 수정합니다.

### 🛑 3.4. 강제 종료 및 루프 탈출 기제 (Escape Hatch & Force Stop)
Shrimp와 Task Master는 무한 루프(Infinite Loop)에 빠지는 것을 방지하기 위해 **시스템적 강제 제어**와 **에이전트 주도 탈출 도구**를 동시에 제공합니다. 이를 MyCrew에도 적용합니다.
1. **에이전트 주도 탈출 (Tool-based Exit)**:
   - 에이전트에게 `ask_user` 또는 `finish_task` 도구를 명시적으로 부여합니다. 도저히 해결할 수 없는 에러가 반복되거나 기획서에 누락된 치명적인 정보가 있을 때, 에이전트가 자의적으로 이 도구를 호출하면 `/auto_run` 루프가 즉각 중지(Pause)되고 제어권이 사용자에게 넘어옵니다.
2. **사용자 주도 강제 종료 (User Interrupt)**:
   - 사용자가 UI 상에서 ⏹️ **정지(Stop)** 버튼을 누르거나 대화창에 `/stop`을 입력하면, 백엔드의 `activeProcesses` 맵(Map)에서 해당 태스크의 `AbortController`를 트리거하여 진행 중인 LLM API 스트림을 즉각 강제 절단(Kill)합니다.
3. **시스템 런타임 제한 (Max Steps Guardrail)**:
   - 하나의 태스크 루프에서 LLM 호출 횟수(Max Steps)가 15회~20회를 초과하면 시스템이 에이전트의 상태를 `FAILED`로 강제 전환하고 루프를 파괴하여 토큰 폭발을 방지합니다.

---

## 4. UI/UX 연동 시나리오

1. **사용자**: 태스크 상세 모달에서 모드를 `DEV`로 맞추고 코멘트 창에 `/auto_run` 입력 후 전송.
2. **시스템**: `/api/tasks/:id/run` 엔드포인트를 호출하고, 백그라운드 에이전트 워커가 `MODEL.ANTI_GEMINI_PRO_HIGH` (또는 Sonnet)을 장착하여 가동됨.
3. **프론트엔드**: 소켓을 통해 에이전트가 어떤 파일을 읽고(Tool Call) 어떤 코드를 수정하는지 실시간 Timeline으로 렌더링.
4. **종료**: 더 이상 남은 태스크가 없거나 치명적인 빌드 에러가 발생하여 자력 복구가 불가능할 때 에이전트는 루프를 정지하고 사용자에게 통보. (`/bugdog기록` 연동)

---

## 5. 결론 및 다음 단계 (Next Steps)
본 PRD는 단순한 도구를 넘어, 에이전트가 사람처럼 계획하고 실행하는 완전한 **실무자 파이프라인**을 정의했습니다. 

**[Phase 39-6] 액션 아이템:**
- `executor.js` 내부 루프에 Shrimp 스타일의 태스크 의존성 추적 및 루프 탈출(Break) 조건 추가.
- `contextInjector.js`에 3단 모듈형 프롬프트(Persona, Tools, Rules) 동적 조립 로직 구현.
