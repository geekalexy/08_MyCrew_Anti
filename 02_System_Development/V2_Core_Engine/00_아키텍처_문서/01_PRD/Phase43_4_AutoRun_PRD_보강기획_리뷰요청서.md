# [Supreme Review Target] Phase 43-4 Auto Run Pipeline Evolution

**작성자**: 루카 (Gemini)
**목적**: 오토런 진입 시 묻지마 코딩 방식의 기존 파이프라인을 개선하고, Task Master(기획자/PM) 단계를 선행시켜 원자 단위 태스크(Atomic Tasks) 리스트를 동적 생성하는 아키텍처 구조의 무결성 및 보안 검증.

---

## 1. 개요 및 배경 (Context)
* **문제점 1**: 기존 오토런 진입 시 `buildAutoRunContext` 프롬프트가 "무조건 즉시 코딩하라"로 고정되어 있어, 요구사항이 복잡할 경우 파급 반경(Blast Radius)을 무시하고 전체 코드를 훼손하는 현상이 발생함.
* **문제점 2**: 사용자가 작성한 코멘트 내부의 멘션(`@[...]`) 파일 링크가 파싱되지 않아 컨텍스트 체이닝이 끊어짐.
* **문제점 3**: 서버가 특정 상태(`COMPLETED`, `DONE`)의 태스크를 오토런 트리거 시 사용자의 명시적 지시 없이 강제 `ARCHIVED` 처리하는 룰 위반 존재.

## 2. 변경 대상 코드 원본 (AS-IS vs TO-BE)

### 2.1. 프롬프트 구조 변경 (ai-engine/tools/contextInjector.js)
**[AS-IS (기존 구조)]** - 오토런 호출 시 묻지마 코딩 강제
```javascript
// contextInjector.js
} else {
  context += `[SYSTEM PERSONA - MAIN MODEL]\n`;
  context += `You are an expert Senior Fullstack Developer functioning as the 'Main Model' in an autonomous loop.\n`;
  context += `Your ONLY purpose is to transform the provided PRD and task list into perfectly working code.\n\n`;
  context += `**CRITICAL RULES:**\n`;
  context += `1. Do NOT ask for permission to code. Just start coding immediately.\n`;
  context += `2. You must operate in 'Continuous Mode' when /auto_run is triggered.\n`;
  context += `3. After completing a task, DO NOT STOP. You must automatically proceed or finish the loop.\n`;
  context += `4. If you encounter an error, use query_graph to trace the blast radius before applying a fix.\n\n`;
}
```

**[TO-BE (제안 구조)]** - Task Master 전처리 분리 (G-Stack autoplan 벤치마킹)
```javascript
// contextInjector.js (Task Master 전용 모드 신설)
} else if (mode === 'TASK_MASTER') {
  context += `[SYSTEM PERSONA - TASK MASTER & PLANNER]\n`;
  context += `You are an expert Engineering Manager and Task Master.\n`;
  context += `Before the development loop begins, your ONLY purpose is to analyze the Task Description and Enriched Context, and break it down into an actionable, atomic execution plan.\n\n`;
  context += `**CRITICAL RULES:**\n`;
  context += `1. **Search Before Building**: Your first step MUST be to investigate the existing codebase using \`query_graph\` or \`grep_search\`. Do not assume structure.\n`;
  context += `2. **Blast Radius Instinct**: Identify what could break across the system.\n`;
  context += `3. **Completeness Principle (Boil the Lake)**: Plan for error handling, edge cases, and logging, not just the happy path.\n`;
  context += `4. **Todo-list Discipline**: Break work down into atomic, independent steps (one commit per step).\n\n`;
  context += `**YOUR OUTPUT FORMAT:**\n`;
  context += `Output your execution plan in markdown. After writing this plan, the developer loop will take over.\n`;
  // (마크다운 포맷 안내 내용 포함...)
}
```

### 2.2. 컨텍스트 체이닝 누락 및 강제 아카이빙 수정 (server.js)
**[AS-IS (기존 구조)]**
```javascript
// server.js - 강제 아카이빙 (Rule Violation)
app.post('/api/tasks/:id/run', async (req, res) => {
  // ...
  if (task.status === 'COMPLETED' || task.status === 'DONE') {
      await dbManager.updateTaskStatus(taskId, 'ARCHIVED'); // 강제 아카이빙!
      // (새로운 Fork 카드 생성 로직)
  }
});

// server.js - 코멘트 컨텍스트 체이닝 누락
async function forceRedispatchTask(taskId, commentText = null) {
  let finalContext = task.content;
  if (commentText) {
      finalContext += `\n\n[추가 코멘트 지시사항]\n${commentText}`; // 멘션 파싱 안됨
  }
  // 바로 Executor로 전송
}
```

**[TO-BE (제안 구조)]**
```javascript
// server.js - 상태 변경은 유저 의도로만 수행하므로 백엔드 강제 아카이빙 로직 제거
app.post('/api/tasks/:id/run', async (req, res) => {
  // 사용자의 명시적 상태 변경 API 또는 비서 에이전트의 Action이 이를 대신하도록 위임
  // 하드코딩 ARCHIVED 로직 완전 제거
});

// server.js - 체이닝 복구
async function forceRedispatchTask(taskId, commentText = null) {
  let finalContext = task.content;
  if (commentText) {
      // 코멘트 본문도 컨텍스트 체이닝 함수를 통과하여 @[file.md] 내용을 실제 로드
      const enrichedComment = await contextChainService.buildLinkedContext(commentText, projectId);
      finalContext += `\n\n[최근 사용자/에이전트 코멘트 지시사항]\n${enrichedComment}`;
  }
}
```

---

## 3. 작업자(Luca) 자체 검토 및 고민 포인트 (Edge Cases)
Opus(Prime)님, 아래 포인트들을 중점적으로 비판해 주십시오.

1. **아키텍처 (Architecture) - 파이프라인 단절 리스크**: Task Master가 도출한 원자 단위의 마크다운 리스트 결과물이 시스템(루프)으로 어떻게 안전하게 인계될 수 있는지 구조적 우려가 있습니다. Task Master가 단순히 채팅 응답(Text)으로 내뱉을 경우 메인 코딩 루프(Developer)가 이를 정확히 인지하지 못할 수 있습니다. 이를 Tool Call 기반으로 DB에 명시적 `atomic_tasks`로 저장해야 할까요?
2. **상태 정합성 (State Consistency)**: 강제 아카이빙 로직을 제거했을 때, 만약 유저가 `DONE` 상태인 카드에서 단순히 `/run` 버튼을 누르면 상태가 다시 `IN_PROGRESS`로 덮어씌워지게 됩니다. 이는 Phase 44-2의 Immutable Task(히스토리 보존) 정책과 상충하지 않나요? UI 측면에서 어떻게 보완해야 UX 혼란이 없을지 검토해 주십시오.
3. **런타임 안정성 (Runtime Stability) - Blast Radius**: `buildLinkedContext`를 코멘트에까지 전면 확대 적용 시, 사용자가 코멘트에 거대한 프로젝트 위키 문서를 멘션하면 `finalContext`의 토큰 리밋(Token Limit) 초과 크래시가 발생할 우려가 있습니다.
4. **보안 (Security)**: Task Master에게 `run_command`나 시스템 제어 도구 권한을 열어주어야 할까요? 계획만 세우는 것이라면 `query_graph`, `grep_search`, `read_file` 등 Read-Only 도구만 제공하여 샌드박싱하는 것이 보안 관점에서 맞을지 평가 부탁드립니다.

---
**지시사항**: 위 내용을 바탕으로 6개 렌즈(보안, 아키텍처, 상태 정합성, UX, 런타임, 정책) 관점에서 비판적 리뷰를 수행하고 대안을 제시해 주십시오.
