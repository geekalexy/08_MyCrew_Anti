# Phase 43: `/auto_run` 자율주행 스킬 — Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-13  
> **리뷰 대상**: `executor.js` (autoRun), `toolExecutor.js` (신규), `contextInjector.js` (buildAutoRunContext)  
> **리뷰 등급**: 🟡 **B+ — 조건부 승인 (차단 결함 2건, 설계 경고 3건)**  
> **E2E 테스트**: 35/35 Pass (Luca 구현 + Sonnet QA 완료 상태)

---

## 0. 정책 동기화 (Step 0)

- `POLICY_INDEX.md` last_updated: `2026-05-05T21:10` — 확인 완료
- `strategic_memory.md` — 모델 식별자 정책 확인
- executor.js L1199: `MODEL.PRO` 사용 → `modelRegistry.js` 상수 참조 ✅ (P-006 준수)

---

## 0.5 Graphify 기반 영향도 분석 (Step 0.5)

### 📊 파급 반경 (Blast Radius)

#### `executor.js` — **God Node #8** (48 edges)

```
Imported BY (2 files):
  ← server.js (187 edges, God Node #1)
  ← imageLabRouter.js

Imports (24 modules):
  → database.js, modelSelector.js, modelRegistry.js
  → geminiAdapter.js, antigravityAdapter.js, filePollingAdapter.js
  → contextInjector.js, toolExecutor.js [NEW]
  → contextChainService.js, ruleHarvester.js, workflowOrchestrator.js
  → systemShieldSkill.js, scrubbing.js
  → nanoBananaGenerator.js, remotionRenderer.js
```

**판정**: `executor.js`는 **God Node #8** (48 edges). 단, 이번 변경은 기존 메서드(`run`, `runDirect`)를 수정하지 않고 **새 메서드(`autoRun`, `stopAutoRun`)만 추가**하므로, 기존 의존 파일(server.js, imageLabRouter.js)의 기존 호출 경로에는 영향 없음. **파급 반경 = 0 파일** (기존 API 호환).

#### `toolExecutor.js` — **신규 모듈** (그래프 미등록)

```
Graphify 노드: 0건 (신규 파일이라 아직 그래프에 미반영)
Import 관계: executor.js L11에서만 import → 단일 소비자
```

**판정**: 신규 파일이므로 기존 의존성 영향 없음. **단, 그래프 업데이트(`graphify update .`) 필요.**

#### `contextInjector.js` — 기존 모듈 + 메서드 추가

```
Imported BY (3 files):
  ← executor.js
  ← server.js
  ← ariDaemon.js
```

**판정**: 기존 메서드(`buildInjectionPayload`, `getEquippedSkillsContext` 등) 변경 없이 **새 메서드(`buildAutoRunContext`)만 추가**. 기존 소비자 영향 없음. **파급 반경 = 0 파일**.

### 📊 커뮤니티 교차 영향

`executor.js`(Community 0/23)에서 `toolExecutor.js`(신규)를 분리한 것은 도구 실행 로직을 별도 모듈로 격리하여 **결합도를 낮추는 올바른 방향**입니다. 다만 현재 `mcp_server.js`에서는 `toolExecutor.js`를 import하지 않아 "중앙화"가 아직 불완전합니다 (W-002 참조).

---

## 1. 코드 검증 — `toolExecutor.js` (59줄)

### 🔴 P1-001 (Critical): `execSync` Shell Injection 취약점

```javascript
// toolExecutor.js L35
const stdout = execSync(`graphify query "${args.query}"`, {
  encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
});
```

**문제**: `args.query`는 LLM이 생성한 문자열입니다. LLM이 악의적이거나 환각으로 `"; rm -rf / #` 같은 문자열을 생성하면 **Shell Injection**이 발생합니다.

`execSync`는 문자열을 셸에 전달하므로, 셸 메타문자(`;`, `|`, `$()`, `` ` ``)가 그대로 해석됩니다. Phase 41에서 `wikiEngine.js`의 `exec()` → `execFile()`로 전환한 것과 **정반대의 패턴**입니다.

**권장 수정**:
```javascript
import { execFileSync } from 'child_process';
// ...
const stdout = execFileSync('/Users/alex/.local/bin/graphify', ['query', args.query], {
  encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
});
```

이렇게 하면 `args.query`가 단일 인자로 전달되어 셸 해석을 완전히 우회합니다.

**심각도**: 🔴 **Critical** — LLM 생성 입력을 셸에 직접 전달하는 것은 **보안 1순위 차단 대상**.

---

### 🔴 P1-002 (Critical): Path Traversal 방어 불완전 — Symlink 우회

```javascript
// toolExecutor.js L16-18
const absPath = path.resolve(safeRoot, args.path);
if (!absPath.startsWith(safeRoot)) {
  throw new Error("보안 위반: 허용되지 않은 경로 접근(Path Traversal 방어)");
}
```

**문제**: `path.resolve()`는 `../../../etc/passwd` 같은 상대 경로 공격은 차단하지만, **심볼릭 링크(symlink)를 따라가는 공격은 차단하지 못합니다**.

예: `safeRoot` 내부에 `/tmp` 등을 가리키는 symlink가 존재하면, `absPath.startsWith(safeRoot)`는 통과하지만 실제 파일은 `safeRoot` 외부에 위치합니다.

**권장 수정**:
```javascript
const absPath = path.resolve(safeRoot, args.path);
const realPath = fs.realpathSync(absPath);    // symlink 해소
const realRoot = fs.realpathSync(safeRoot);
if (!realPath.startsWith(realRoot)) {
  throw new Error("보안 위반: 허용되지 않은 경로 접근(Symlink Traversal 방어)");
}
```

**심각도**: 🔴 **Critical** — LLM이 파일 시스템 전체를 읽을 수 있는 벡터.

---

## 2. 코드 검증 — `executor.js` autoRun (L1126-1312)

### ✅ 루프 구조 — 안전

```
while (!abortController.signal.aborted)        ← 외부 루프: 태스크 큐
  while (!isTaskCompleted && !aborted)          ← 내부 루프: 단일 태스크 Step
    if (stepCount > MAX_STEPS) throw Error     ← 폭주 방어
```

삼중 보호 구조(AbortController + isTaskCompleted + MAX_STEPS)는 무한 루프를 효과적으로 방어합니다. ✅

### ✅ 태스크 상태 전이 — 정확

```
TODO → IN_PROGRESS → [Loop] → REVIEW (CEO 할당) | FAILED | BLOCKED
```

BUG-001 수정(L1269: `!isBlocked` 조건)으로 BLOCKED 태스크가 REVIEW로 잘못 전환되는 경로 차단. ✅

### ✅ WARN-002 토큰 방어 — 적절

```javascript
// L1238-1246
if (output.length > 3000) output = output.substring(0, 3000) + '...';
if (toolOutputs.length > 3) toolOutputs.shift();
```

3000자 + 최근 3개 이력 제한으로 컨텍스트 무한 팽창 방어. ✅

### ✅ `finally` 블록 — 리소스 정리

```javascript
// L1289-1291
finally {
  this.activeAutoRuns.delete(runId);
}
```

에러/정상 종료 모두에서 activeAutoRuns Map 정리 보장. ✅

### 🟡 W-001: AbortSignal이 LLM API 호출을 실제로 중단하는가?

```javascript
// L1196-1200
const result = await geminiAdapter.generateResponse(
  "주어진 태스크를 달성하기 위해...",
  currentPrompt,
  MODEL.PRO
);
```

`abortController.signal`을 `generateResponse`에 전달하지 않고 있습니다. 현재 구조에서는 LLM API 호출이 완료될 때까지 기다린 후 다음 루프 시작점에서 `aborted` 체크를 합니다.

**영향**: 사용자가 `/stop`을 호출해도 **현재 진행 중인 LLM 생성이 끝날 때까지** 실제 중단이 지연됩니다. PRD 시나리오 4("진행 중인 LLM 스트림이 즉시 파괴")와 불일치.

**권장**: `generateResponse`에 `signal` 옵션 전달:
```javascript
const result = await geminiAdapter.generateResponse(
  "...", currentPrompt, MODEL.PRO, { signal: abortController.signal }
);
```

**판정**: 🟡 Major — 기능적 오작동은 아니나, PRD의 "즉시 Kill" 약속을 이행하지 못함.

---

## 3. 코드 검증 — `contextInjector.js` buildAutoRunContext (L281-318)

### ✅ 3단 모듈형 프롬프트 — PRD 일치

```
[SYSTEM PERSONA - MAIN MODEL]     ← Shrimp 차용
[TOOL SPECIFICATIONS]              ← Tool 사용법 + <tool_calls> 포맷
[PROJECT RULES - MYCREW EDITION]   ← 프로젝트 컨벤션
[CURRENT TASK CONTEXT]             ← 동적 태스크 데이터
```

PRD §2 명세와 정확히 일치. ✅

### 🟡 W-002: `multi_replace` 도구가 프롬프트에서 안내되지만 toolExecutor에 미구현

PRD Phase 43-1 Step 5에서 `multi_replace`를 로컬 스킬로 명시(L51):
> "로컬 스킬(`read_file`, `write_file`, `multi_replace`)과 MCP 원격 스킬을 구분하여 라우팅"

하지만:
1. `toolExecutor.js`에 `multi_replace` 핸들러가 **없음**
2. `contextInjector.js` L296-302의 Tool Specifications에도 `multi_replace`가 **없음**

LLM이 `multi_replace`를 호출하면 `Unknown tool multi_replace`로 실패합니다.

**판정**: 🟡 Major — 구현 계획서에 명시된 도구가 실제 구현에서 누락.

### 🟡 W-003: `ask_user` 도구가 프롬프트에서 안내되지 않음

`toolExecutor.js` L45-48에 `ask_user` 핸들러가 구현되어 있지만, `contextInjector.js`의 Tool Specifications(L298-302)에는 **`ask_user` 설명이 없습니다**. LLM은 프롬프트에 명시되지 않은 도구를 자발적으로 호출하기 어렵습니다.

```javascript
// contextInjector.js L298-302 — ask_user 누락
context += `- **read_file**: ...
context += `- **write_file**: ...
context += `- **query_graph**: ...
context += `- **finish_task**: ...
// ask_user는? ← 누락
```

**판정**: 🟡 Major — PRD 시나리오 3("에이전트 주도 탈출")이 실제로 트리거되기 어려움.

---

## 4. 종합 판정 매트릭스

| 항목 | 판정 | 근거 |
|------|------|------|
| 루프 구조 (3중 보호) | ✅ A | AbortController + MAX_STEPS + isTaskCompleted |
| 상태 전이 (Lifecycle) | ✅ A | BUG-001 수정 확인, BLOCKED/REVIEW 분기 정확 |
| 토큰 방어 (WARN-002) | ✅ A | 3000자 + 3개 이력 제한 |
| 리소스 정리 (finally) | ✅ A | activeAutoRuns.delete 보장 |
| 모듈형 프롬프트 (PRD 일치) | ✅ A | 3단 구조 정확 |
| Graphify 파급 반경 | ✅ A | 기존 API 무변경, 영향 파일 0개 |
| Shell Injection 방어 | 🔴 **F** | execSync + LLM 입력 = Critical |
| Symlink Traversal 방어 | 🔴 **F** | realpathSync 미사용 |
| AbortSignal LLM 전달 | 🟡 C | signal 미전달 → 즉시 중단 불가 |
| multi_replace 구현 누락 | 🟡 C | PRD 명시 도구 미구현 |
| ask_user 프롬프트 누락 | 🟡 C | 에이전트 탈출 트리거 불가 |

---

## 5. 승인 조건

### 🔴 필수 (병합 전 즉시 수정)

| # | 결함 | 수정 사항 |
|---|------|----------|
| P1-001 | Shell Injection | `execSync` → `execFileSync` + 절대 경로 + 인자 분리 |
| P1-002 | Symlink Traversal | `fs.realpathSync()` 추가하여 실제 경로 검증 |

### 🟡 권장 (병합 후 후속 패치 가능)

| # | 사항 | 조치 |
|---|------|------|
| W-001 | AbortSignal 미전달 | `generateResponse`에 `signal` 옵션 추가 |
| W-002 | `multi_replace` 누락 | `toolExecutor.js`에 핸들러 추가 + 프롬프트에 명세 추가 |
| W-003 | `ask_user` 프롬프트 누락 | `buildAutoRunContext`의 Tool Specifications에 `ask_user` 설명 추가 |

---

## 6. Prime 총평

**아키텍처 설계는 우수합니다.** Shrimp/Task Master에서 차용한 3단 모듈형 프롬프트, 3중 루프 보호 구조, 태스크 스케줄러의 1회성 오버라이드 패턴 등은 자율주행 에이전트의 핵심 요소를 잘 포착했습니다.

**그러나 보안 결함이 2건 존재합니다.** 특히 P1-001(Shell Injection)은 LLM 생성 입력을 `execSync`로 셸에 직접 전달하는 패턴으로, Phase 41에서 `wikiEngine.js`의 동일 패턴을 `execFile`로 교체한 전례를 고려하면 **동일한 보안 원칙이 적용되어야 합니다.**

35/35 E2E 테스트 통과는 기능적 안정성을 증명하지만, 보안 테스트는 기능 테스트와 별개의 차원입니다. **P1-001, P1-002 수정 후 재승인 요청을 권고합니다.**

---

*Prime Supreme Review | Phase 43 AutoRun | 2026-05-13*
