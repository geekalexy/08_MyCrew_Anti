# 🚀 Phase 43-4: `/auto_run` 보강 기획서 (v1.4 최종 확정판)

**작성일**: 2026-05-16  
**작성자**: 루카 (Luca)  
**상태**: ✅ 기획 최종 확정 (Supreme Review 5차 루프 완료 — 설계 결함 전건 해소, 구현 착수 가능)
**연관 문서**: 
- [Phase43_Auto_Run_스킬_PRD.md](Phase43_Auto_Run_스킬_PRD.md) (본 기획서)

---

## 1. 개요 및 목적
기존 `Phase43` 기획서의 "3.1. 원자적 태스크 스케줄링" 단계에 대한 보강 기획입니다.
기획(ARCHITECT) 모드에서는 상세한 태스크 리스트가 별도로 생성되지 않습니다. 따라서 `/auto_run`이 시작되는 단계에서 시스템이 PRD를 분석하여 **원자 단위(Atomic)의 태스크 리스트를 동적으로 생성**해야 한다는 요구사항을 명확히 정의합니다.

## 2. 보강 내용: 오토런 시작 시 태스크 동적 생성

### 2.1. 기존 프로세스의 한계 및 현 구현 상태의 문제점
* **기존 기획서의 오류**: 에이전트가 오토런 시 글로벌 `v1.0_MVP_PRD` 문서를 전체 로드한다고 서술했으나, 이는 실제 구조와 다름. (토큰 폭발 위험 방지 필요)
* **타겟팅 누락**: 실제 오토런은 전체 PRD가 아니라, **`/api/tasks/:id/run` API를 호출한 해당 단일 태스크 카드(본문 및 코멘트)**만을 타겟으로 동작함.
* **코멘트 컨텍스트 체이닝 및 보안 누락**: 코멘트 내부의 멘션(`@[...]`) 체이닝이 미작동할 뿐만 아니라, **외부 텍스트 주입(Prompt Injection)에 대한 새니타이즈(Sanitize)** 방어 로직이 없음.
* **아카이빙 룰 위반 및 무방어 재실행(P1-002)**: 카드가 `DONE` 상태일 때 강제로 `ARCHIVED` 처리하던 오류를 제거해야 하나, 대체 방어장치가 없어 이미 완료된 작업이 무음으로 역전이(IN_PROGRESS)되어 재실행되는 위험이 발생함.
* **파이프라인 단절 위험(P1-001)**: Task Master가 수립한 원자적 태스크 리스트가 텍스트로만 존재하며, Developer 메인 루프에게 어떻게 구조적으로 인계되는지 인터페이스가 미정의됨.

### 2.2. 개선된 파이프라인 요구사항 (Single Card & Context Chaining)
오토런 파이프라인 진입 직후, 다음과 같은 구조적 전처리 과정이 강제 주입되어야 합니다.

1. **타겟 문서 적재 및 새니타이즈 (Single Card Pipeline)**:
   * **실행 대상 태스크 카드의 본문(Content)**과 **트리거 시점에 작성된 코멘트 데이터**를 메모리에 적재하되, Prompt Injection 방지를 위해 전용 모듈(`promptInjectionGuard.js`)을 거쳐 악의적 프롬프트(`IGNORE PREVIOUS INSTRUCTIONS` 등)를 사전 차단(GAP-S1 해결).
2. **완전한 컨텍스트 체이닝 (Full Context Chaining)**:
   * **코멘트에 포함된 카드링크(`@[...]`)**에 대해서도 `buildLinkedContext()` 로직을 적용하여 컨텍스트 결합 (토큰 리밋 모니터링 포함).
3. **원자적 태스크 분해 (Task Decomposition)**:
   * 수집된 컨텍스트를 분석하여 최소 작업 단위(원자 단위)를 추출.
4. **Task Master 구조적 인계 (P1-001 해결)**:
   * Task Master는 텍스트를 출력하고 끝나는 것이 아니라, 반드시 **`save_execution_plan` Tool Call을 호출**하여 도출된 계획(JSON)을 DB에 구조적으로 저장해야 함.
   * Tool Call이 성공하면 시스템은 `PLAN_COMPLETE` 액션을 트리거하여 메인 Developer 루프를 안전하게 시작함.

### 2.3. 시스템 강제 룰 교정 (P1-002 방어장치 추가)
* **아카이빙 로직 제거 및 재실행 방어장치**: 
  * 임의 아카이빙 로직(`updateTaskStatus(sid, 'ARCHIVED')`)은 제거함.
  * 단, 상태가 `COMPLETED` 또는 `DONE`인 카드를 재실행(`/run`)할 경우:
    1. **스냅샷 강제 생성**: 덮어쓰기로 인한 데이터 유실을 막기 위해 실행 직전 `task_snapshots` 테이블에 현재 상태 보존.
    2. **UI 경고 모달**: 프론트엔드에서 "이미 완료된 작업을 재실행합니다. 기존 코드가 덮어씌워질 수 있습니다"라는 경고 표시를 띄워 사용자의 명시적 동의(Confirm)를 받도록 수정.

## 3. 프롬프트 개선: AS-IS vs TO-BE (Task Master 도입)

Auto Run이 시작될 때 메인 코딩 에이전트가 즉각적인 개발에 착수하기 전, **실행 계획과 원자적 태스크를 먼저 수립하도록 강제**하기 위해 프롬프트를 전면 개편합니다.

### 3.1. 기존 프롬프트 (AS-IS)
현재 `contextInjector.js`의 `buildAutoRunContext`에 하드코딩된 프롬프트입니다. 철저한 실무자(Developer) 페르소나로 굳어져 있어 계획 없이 바로 코드를 짜도록 강제하고 있습니다.

```text
[SYSTEM PERSONA - MAIN MODEL]
You are an expert Senior Fullstack Developer functioning as the 'Main Model' in an autonomous loop.
Your ONLY purpose is to transform the provided PRD and task list into perfectly working code.

**CRITICAL RULES:**
1. Do NOT ask for permission to code. Just start coding immediately.
2. You must operate in 'Continuous Mode' when /auto_run is triggered.
3. After completing a task, DO NOT STOP. You must automatically proceed or finish the loop.
4. If you encounter an error, use query_graph to trace the blast radius before applying a fix.
```

### 3.2. 신규 Task Master 프롬프트 (TO-BE Draft)
기존의 묻지마 코딩 방식을 탈피하고, G-Stack의 핵심 철학(`autoplan`, `plan-eng-review` 스킬)을 벤치마킹하여 **인지 패턴(Cognitive Patterns)**을 주입한 전처리 프롬프트입니다. 이 프롬프트를 통과하여 산출된 원자 단위 계획(Atomic Tasks)이 생성된 후 비로소 개발자(Developer) 루프로 진입합니다.

- **Search Before Building**: 섣불리 코딩하지 않고 기존 구조 파악 선행
- **Blast Radius Instinct**: 수정 사항이 미칠 파급 반경(영향도) 분석
- **Completeness Principle (Boil the Lake)**: 해피패스뿐만 아니라 엣지 케이스와 에러 핸들링 포함
- **Todo-list Discipline**: 원자 단위의 검증 가능한 체크리스트 구성

```text
[SYSTEM PERSONA - TASK MASTER & PLANNER]
You are an expert Engineering Manager and Task Master.
Before the development loop begins, your ONLY purpose is to analyze the given Task Description and Enriched Context, and break it down into an actionable, atomic execution plan.

**CRITICAL RULES (G-Stack Benchmarked):**
1. **Search Before Building**: Your first planned step MUST be to investigate the existing codebase and architecture using `query_graph` or `grep_search`. Do not assume the system structure.
2. **Blast Radius Instinct**: Identify what could break. If the task modifies core shared components, your plan must include steps to verify the impact across the system.
3. **Completeness Principle (Boil the Lake)**: Do not just plan for the happy path. Your plan MUST include steps for error handling, edge cases, and logging.
4. **Todo-list Discipline**: Break the work down into atomic, independent steps. A single step should ideally represent one logical commit.
5. **Termination Condition (P1-001)**: You must NEVER write code. Once your plan is ready, you MUST call the `save_execution_plan` tool to save your atomic tasks structurally in the DB. After calling the tool, output a short summary and STOP.

**YOUR OUTPUT FORMAT:**
Instead of raw markdown text, you must invoke `save_execution_plan(plan_json)` with the following structure:
{
  "context_and_blast_radius": "(Brief summary and potential risks)",
  "atomic_tasks": [
    {"step": 1, "description": "Investigate existing state using query_graph"},
    {"step": 2, "description": "Implement changes with edge cases"},
    {"step": 3, "description": "Verify changes using test tools"}
  ]
}
```

---

## 4. Supreme Review 보완 아키텍처 (v1.1)
최고 수준 리뷰(Supreme Review) 결과 도출된 6개의 CRITICAL/HIGH 결함을 해결하기 위한 아키텍처 상세 설계입니다.

### 4.1. 격리 트랜잭션: DatabaseManager 및 Tool 설계 (GAP-A1)
* **`execution_plans` 테이블 신설**: Task Master의 결과물을 저장할 전용 테이블을 생성합니다. (DatabaseManager 수정 필수)
* **`save_execution_plan` 도구 구현**: `executor.js`와 `contextInjector.js`에 실제 동작 가능한 코드로 Tool을 등록하여, Task Master가 환각(Hallucination) 없이 실제 DB에 접근하도록 보장합니다.

### 4.2. 2-Phase 세션 분리 및 페르소나 보호 (GAP-A2, GAP-P1)
* **단일 세션 오염 방지**: Task Master와 Developer는 동일한 LLM 세션을 공유하지 않습니다. Task Master가 계획을 저장하고 종료하면, 백엔드 서버가 **완전히 새로운 세션(New LLM Thread)**을 생성하여 Developer 프롬프트를 주입합니다.
* **시스템 레벨 도구 차단**: Task Master 세션 구동 시 프롬프트 지시뿐만 아니라, **API 호출 Payload의 `tools` 배열 자체에서 `write_file` 및 `run_command` 도구를 물리적으로 제거**하여 호출 원천 차단(System-level blockage).

### 4.3. 상태(State) 모델 및 정책 확정 (GAP-ST1, GAP-ST2, GAP-UX1)
* **상태 전이 모델**: Task Master의 작업 상태를 위해 `PLANNING`(계획 수립 중), `PLAN_COMPLETE`(수립 완료) 상태를 시스템에 추가 편입.
* **UI 투명성 확보**: 프론트엔드 모달에 "Planning..." 스피너를 추가하여 현재 AI가 원자적 태스크를 도출 중임을 사용자에게 시각적으로 안내.
* **정책 충돌 해결**: Phase 43의 "Fork 강제" 정책은 전면 폐기(Deprecated)하며, Phase 43-4의 "덮어쓰기(Overwrite) + 스냅샷 백업" 정책을 최종 공식 룰로 채택.

### 4.4. 런타임 제어 및 Fallback (GAP-RT1, GAP-RT2, GAP-A5)
* **토큰 폭발 방지**: Task Master 세션은 깊은 사고가 필요치 않으므로 `max_steps=3`으로 하드 리밋을 설정. 타임아웃 30초 설정.
* **Fallback 정책**: Task Master 단계에서 파싱 에러나 타임아웃 발생 시, 강제로 개발 루프로 넘어가지 않고 상태를 `BLOCKED`로 전환한 뒤 사용자에게 개입을 요청함.
  * **[GAP-A5 보완]**: `BLOCKED` 상태는 기존 칸반 시스템에 없으므로, `PLANNING`, `PLAN_COMPLETE` 상태와 함께 `database.js`의 `getKanbanColumns()` 기본값 배열 및 프론트엔드 `BANNER_MAP`에 신규 등록하여 UI 렌더링 누락을 방지합니다.

### 4.5. 코멘트 체이닝 구조적 결함 수술 및 토큰 캡 설정 (GAP-A3, GAP-A4)
* **원인 규명 (GAP-A3)**: 현재 `server.js`의 `forceRedispatchTask` 엔드포인트에서 태스크 본문(`fullTask.content`)에만 `buildLinkedContext`를 적용하고 코멘트 파트(`additionalContext`)는 체이닝 파이프라인에서 누락시키는 치명적 오류.
* **해결 방안 (`server.js` 수정 필수)**: 
  * 본문 처리 로직과 별개로 `const commentCtx = await buildLinkedContext(additionalContext, projectId);`를 명시적으로 호출하여 코멘트 컨텍스트를 파싱.
  * 두 컨텍스트를 순서대로 결합하여 최종 Enriched Context를 생성.
* **누적 토큰 총합 캡 (GAP-A4)**: `buildLinkedContext` 내부 처리 시 개별 카드 제한(3000자) 외에 **총 체인 누적 토큰 리밋을 8,000자**로 제한 (카드별 3000자 × 최대 3개 링크 허용). 초과 시 LRU(오래된 링크부터) 잘라냄.

### 4.6. 크로스 스코프 참조 정책 (GAP-S2)
* `buildLinkedContext` 내 `getTaskByProjectNumAcrossScopes` 호출 시, 무분별한 다른 프로젝트 데이터 참조를 방지하기 위해 **명시적으로 같은 워크스페이스 내의 연관 프로젝트만 참조 가능하도록 정책을 제한**합니다.

---

## 5. 결론 및 영향도
이 보강 기획을 통해 1개 태스크 카드 단위로 코딩을 수행하는 **Single Card Pipeline** 구조가 명확해집니다. 사용자는 특정 카드에 "이 코멘트의 지시사항과 링크된 파일(`@[...]`)을 바탕으로 작업해줘"라고 지시하면, 시스템은 먼저 Task Master 프롬프트를 통해 **원자적 계획(Atomic Tasks)을 수립**한 후, 에이전트가 해당 카드와 코멘트의 체이닝된 컨텍스트만을 집중 분석하여 자율 루프를 완벽히 수행하게 됩니다.
