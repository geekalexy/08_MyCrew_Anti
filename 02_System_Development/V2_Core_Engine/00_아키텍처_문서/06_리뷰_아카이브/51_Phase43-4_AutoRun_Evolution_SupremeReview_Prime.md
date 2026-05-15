# Phase 43-4 Auto Run Pipeline Evolution — Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-15  
> **리뷰 대상**: Review Target (102줄) + 보강기획 PRD (96줄)  
> **리뷰 등급**: 🟡 **B+ — 조건부 승인 (Critical 2건, Warning 4건)**

---

## 0.5 Graphify 기반 영향도 분석

| 변경 대상 | God Node | 변경 유형 | 위험도 |
|-----------|----------|----------|--------|
| `contextInjector.js` | — (4 edges, imported by 3) | TASK_MASTER 모드 신설 | 🟡 중간 |
| `server.js` | **#1** (187 edges) | 강제 아카이빙 제거 + 코멘트 체이닝 복구 | 🔴 최고 |
| `executor.js` | **#8** (48 edges) | Task Master → Developer 루프 전환 | 🟠 높음 |

**핵심 판정**: `contextInjector.js`는 `server.js`(#1), `ariDaemon.js`(#4), `executor.js`(#8) 세 God Node에서 import됩니다. 프롬프트 모드(`TASK_MASTER`) 추가는 이 3개 소비자 모두에 잠재적 영향. **소비자 측에서 새 모드를 올바르게 전달하는지 검증 필수.**

---

## 0.7 멀티 렌즈 분석 (6개 렌즈)

### 🔒 렌즈 1: 보안

#### ✅ Luca 고민 포인트 4번에 대한 Prime 응답

Luca:
> Task Master에게 `run_command`나 시스템 제어 도구 권한을 열어주어야 할까요?

**Prime 판정: Task Master에게는 Read-Only 도구만 제공하는 것이 정답입니다.**

Task Master의 목적은 **계획 수립**이지 **실행**이 아닙니다. Phase 44-3에서 QA 에이전트에 적용한 것과 동일한 원칙입니다:

```javascript
const TASK_MASTER_ALLOWED_TOOLS = ['query_graph', 'grep_search', 'read_file', 'view_file'];
// write_file, run_command, multi_replace → REJECTED
```

이것은 Phase 44-3 P1-001(QA Interceptor)과 동일한 패턴입니다. `toolExecutor.js`의 `mode` 파라미터에 `'TASK_MASTER'`를 추가하고 동일한 차단 로직을 적용하면 됩니다. ✅

#### 🟡 W-001: `buildLinkedContext` 확대 적용 시 Prompt Injection 벡터

Review Target L84-86:
```javascript
const enrichedComment = await contextChainService.buildLinkedContext(commentText, projectId);
finalContext += `\n\n[최근 사용자/에이전트 코멘트 지시사항]\n${enrichedComment}`;
```

코멘트의 `@[file.md]` 멘션을 통해 로드되는 파일 내용에 `[SYSTEM]` 등의 Prompt Injection 페이로드가 포함될 수 있습니다. Phase 44-3에서 `artifact_url` 경유 주입에 대해 새니타이즈를 적용했으므로, **`buildLinkedContext` 결과에도 동일한 새니타이즈 적용이 필요합니다.**

```javascript
const sanitized = enrichedComment.replace(/\[SYSTEM\]|\[INST\]|\[\/INST\]/gi, '[BLOCKED]');
```

**판정**: 🟡 Warning

---

### 🏗️ 렌즈 2: 아키텍처

#### 🔴 P1-001: Task Master → Developer 인계 구조 미정의 — 파이프라인 단절 리스크

Luca 고민 1번에 대한 Prime 응답:
> Task Master가 단순히 채팅 응답(Text)으로 내뱉을 경우 메인 코딩 루프(Developer)가 이를 정확히 인지하지 못할 수 있습니다. Tool Call 기반으로 DB에 명시적 `atomic_tasks`로 저장해야 할까요?

**Prime 판정: 🔴 이것은 이 설계의 가장 핵심적인 결함입니다.**

현재 PRD의 구조:
```
Task Master 프롬프트 → LLM이 마크다운 계획 "텍스트"를 생성 → ???  → Developer 루프 시작
```

`???` 부분이 **완전히 미정의**입니다. 두 가지 시나리오가 있습니다:

**시나리오 A: 단순 텍스트 연결 (PRD 암시)**
- Task Master가 마크다운 계획을 생성
- 이것이 대화 히스토리의 일부로 Developer에게 전달
- **문제**: Developer가 "이 마크다운은 내가 따라야 할 계획"이라는 것을 **구조적으로 인식하지 못함**. 프롬프트에 "위 계획을 따라라"고 적어도, LLM은 이를 무시하거나 자체 판단으로 재해석할 수 있음.

**시나리오 B: Tool Call 기반 DB 저장 (Luca 제안)**
- Task Master가 `save_execution_plan` Tool Call로 계획을 구조적으로 저장
- Developer가 시작할 때 DB에서 계획을 로드하여 프롬프트에 강제 주입
- **장점**: 계획이 **구조적 데이터**(JSON/DB 레코드)로 존재하므로, Developer가 무시할 수 없음

**Prime 권장: 시나리오 B — `finish_task` 패턴 차용**

```javascript
// Task Master 전용 Tool: 계획 저장
else if (name === 'save_execution_plan') {
    const plan = args.plan; // 마크다운 또는 JSON
    await dbManager.updateTaskField(args.taskId, 'execution_plan', plan);
    return { output: 'Execution plan saved.', action: 'PLAN_COMPLETE' };
}

// executor.js: PLAN_COMPLETE 액션 수신 시
if (result.action === 'PLAN_COMPLETE') {
    // Task Master 루프 종료 → Developer 루프 시작
    await startDeveloperLoop(task, executionPlan);
}
```

이렇게 하면 Task Master → Developer 인계가 **Tool Call 기반의 명시적 전환**이 되어 파이프라인 단절이 불가능합니다.

---

#### 🟡 W-002: `contextInjector.js`의 `mode` 파라미터 전파 경로 미정의

PRD에서 `mode === 'TASK_MASTER'`를 `contextInjector.js`에 신설하지만, **누가 이 모드를 설정하는지** 명시되지 않았습니다.

- `server.js`의 `/api/tasks/:id/run` → `forceRedispatchTask()` → `executor.js` → `contextInjector.js`

이 체인에서 `mode = 'TASK_MASTER'`는 어디서 주입되는가? `executor.js`의 `autoRun()` 루프가 첫 턴에 자동으로 `TASK_MASTER`를 설정하고, 계획 완료 후 `DEV`로 전환하는 로직이 필요합니다.

**판정**: 🟡 Warning — 모드 전환 트리거 메커니즘 명세 필요

---

### 🔄 렌즈 3: 상태 정합성

#### 🔴 P1-002: 강제 아카이빙 제거 시 `DONE` → `IN_PROGRESS` 역전이 허용 문제

Luca 고민 2번에 대한 Prime 응답:
> 강제 아카이빙 로직을 제거하면, `DONE` 상태 카드에서 `/run`을 누르면 `IN_PROGRESS`로 덮어씌워집니다.

**Prime 판정: 🔴 이것은 Phase 44-3의 스냅샷/불변성 체계와 직접 충돌합니다.**

Phase 44-3에서 확립한 원칙:
- DEV 완료 시 `task_snapshots` 테이블에 스냅샷 저장 → 불변성 보장
- `DONE` 상태의 카드는 완료된 작업의 **증거(Evidence)**

강제 아카이빙을 제거하는 것 자체는 올바르나, **대체 방어장치 없이 제거하면 안 됩니다.**

**권장 설계 — 상태 역전이 가드 + 스냅샷 강제**:

```javascript
// server.js - /api/tasks/:id/run
app.post('/api/tasks/:id/run', async (req, res) => {
    const task = await dbManager.getTaskById(id);
    
    // DONE/COMPLETED 상태의 카드를 재실행할 경우
    if (['DONE', 'COMPLETED'].includes(task.status)) {
        // 1. 현재 상태의 스냅샷을 강제 생성 (히스토리 보존)
        await dbManager.createTaskSnapshot(id);
        // 2. IN_PROGRESS로 전환 (아카이빙하지 않음)
        await dbManager.updateTaskStatus(id, 'IN_PROGRESS');
        // 3. UI에서 "⚠️ 이 카드는 이전에 완료된 작업을 재실행합니다" 경고 표시
    }
});
```

이렇게 하면:
- 아카이빙은 사용자 의도로만 수행 ✅
- 히스토리는 스냅샷으로 보존 ✅  
- 상태 역전이가 **무음으로 발생하지 않음** (경고 포함) ✅

---

### 👤 렌즈 4: UX/사용자 흐름

#### ✅ 우수: Single Card Pipeline 명확화

PRD L19:
> 실제 오토런은 전체 PRD가 아니라, `/api/tasks/:id/run` API를 호출한 해당 단일 태스크 카드(본문 및 코멘트)만을 타겟으로 동작

이것은 사용자의 **정신 모델(Mental Model)**과 정확히 일치합니다. "이 카드를 실행해줘" → 이 카드만 처리. 글로벌 PRD 로드라는 기존의 혼란을 제거. ✅

#### ✅ 우수: 코멘트 컨텍스트 체이닝 복구

코멘트 내 `@[file.md]` 멘션이 단순 문자열로 처리되던 버그를 수정하여 실제 파일 내용을 로드하는 것은 **사용자 기대와 시스템 동작의 일치**를 복구합니다. ✅

---

### ⚙️ 렌즈 5: 런타임 안정성

#### 🟡 W-003: `buildLinkedContext` 확대 시 토큰 폭발 위험

Luca 고민 3번에 대한 Prime 응답:
> 사용자가 코멘트에 거대한 프로젝트 위키 문서를 멘션하면 토큰 초과 크래시 발생

**Prime 판정: 🟡 Valid — 토큰 상한 설정 필수**

Phase 44-3에서 `artifact_url` 주입 시 8,000자 제한을 적용했습니다. 동일한 원칙을 `buildLinkedContext`에도 적용:

```javascript
async function buildLinkedContext(content, projectId) {
    const MAX_LINKED_CHARS = 10000;  // 코멘트 체이닝 상한
    let linked = await resolveLinks(content, projectId);
    if (linked.length > MAX_LINKED_CHARS) {
        linked = linked.slice(0, MAX_LINKED_CHARS) + '\n[...truncated due to token limit...]';
    }
    return linked;
}
```

#### 🟡 W-004: Task Master 루프의 종료 조건/타임아웃 미정의

Task Master가 계획 수립에 실패하거나 무한 반복할 경우의 종료 조건이 없습니다. Phase 43에서 `autoRun`에 `MAX_STEPS`, `isTaskCompleted` 등 3중 보호장치를 두었지만, Task Master 전처리 단계에도 동일한 보호가 필요합니다:

```javascript
// Task Master는 최대 3턴 내에 save_execution_plan을 호출해야 함
const TASK_MASTER_MAX_TURNS = 3;
```

---

### 📜 렌즈 6: 정책 준수

| 정책 | 검증 | 판정 |
|------|------|------|
| P-020 (무단 코딩 금지) | Task Master → Read-Only 도구만 허용 | ✅ 설계 의도 부합 |
| P-016 (dangerously) | 아카이빙 제거 시 파괴적 변경 아님 (데이터 삭제 없음) | ✅ |
| Phase 44-3 Interceptor 패턴 | TASK_MASTER 모드에서도 동일 적용 가능 | ✅ |

---

## 종합 판정 매트릭스

| 렌즈 | 항목 | 판정 |
|------|------|------|
| 🔒 보안 | Task Master Read-Only 샌드박싱 | ✅ A (Luca 자가 진단 정확) |
| 🔒 보안 | 코멘트 체이닝 Prompt Injection | 🟡 C (W-001) |
| 🏗️ 아키텍처 | Task Master → Developer 인계 구조 미정의 | 🔴 **F** (P1-001) |
| 🏗️ 아키텍처 | mode 전파 경로 미정의 | 🟡 C (W-002) |
| 🔄 상태 정합성 | DONE → IN_PROGRESS 역전이 무방어 | 🔴 **F** (P1-002) |
| 👤 UX | Single Card Pipeline 명확화 | ✅ **A+** |
| 👤 UX | 코멘트 컨텍스트 체이닝 복구 | ✅ A |
| ⚙️ 런타임 | 토큰 폭발 위험 | 🟡 C (W-003) |
| ⚙️ 런타임 | Task Master 종료 조건 미정의 | 🟡 C (W-004) |
| 📜 정책 | P-020, P-016 | ✅ A |

---

## 승인 조건

### 🔴 필수 (구현 착수 전 설계 보정)

| # | 결함 | 수정 사항 |
|---|------|----------|
| **P1-001** | Task Master → Developer 인계 미정의 | `save_execution_plan` Tool Call 도입: Task Master가 계획을 구조적 데이터로 DB에 저장 → `PLAN_COMPLETE` 액션으로 Developer 루프 시작. **텍스트 연결 방식은 파이프라인 단절 위험.** |
| **P1-002** | DONE → IN_PROGRESS 역전이 무방어 | 아카이빙 제거와 함께 ① 스냅샷 강제 생성 ② UI 경고 표시를 대체 방어장치로 도입. **대체 없는 제거는 불변성 체계 훼손.** |

### 🟡 권장 (구현 중 반영)

| # | 사항 |
|---|------|
| W-001 | `buildLinkedContext` 결과에 `[SYSTEM]`/`[INST]` 새니타이즈 적용 |
| W-002 | `executor.js`에서 `autoRun` 첫 턴 → `TASK_MASTER` 모드, 계획 완료 후 → `DEV` 모드 전환 로직 명세 |
| W-003 | `buildLinkedContext`에 토큰 상한(10,000자) 설정 |
| W-004 | Task Master 루프에 `MAX_TURNS = 3` 타임아웃 설정 |

---

## Prime 총평

**이 설계 변경의 핵심 철학은 탁월합니다.** "묻지마 코딩"에서 "계획 → 실행" 2단계로의 전환은, G-Stack의 `autoplan` 패턴을 MyCrew에 내재화하는 올바른 방향입니다. 또한 Single Card Pipeline과 코멘트 체이닝 복구는 사용자 경험을 근본적으로 개선합니다.

**그러나 2가지 구조적 미정의가 존재합니다:**

1. **P1-001 (파이프라인 인계)**: Task Master가 생성한 계획이 Developer에게 **어떻게 전달되는가**가 이 설계의 생사를 가릅니다. LLM의 텍스트 출력을 "다음 턴에서 읽을 것"이라고 가정하는 것은 **프롬프트에 대한 과신**입니다. `save_execution_plan` Tool Call로 구조적 인계를 보장해야 합니다.

2. **P1-002 (상태 역전이)**: 강제 아카이빙이 잘못된 것을 제거하는 것은 올바르지만, **대체 없는 제거는 새로운 결함을 만듭니다.** `DONE` 카드의 재실행은 스냅샷 + 경고로 보호해야 Phase 44-3의 불변성 체계와 양립합니다.

Luca의 4가지 자기 비판(인계 구조, 상태 충돌, 토큰 폭발, 도구 권한)은 모두 정확한 문제 식별이었습니다. 특히 1번(인계 구조)과 2번(상태 충돌)은 Prime도 **Critical로 격상**했습니다.

---

*Prime Supreme Review | Phase 43-4 Auto Run Pipeline Evolution | 2026-05-15*
