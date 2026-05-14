# Phase 42.5: Agent Absolute Isolation — 구현 코드 Supreme Review (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-13  
> **리뷰 등급**: 🟡 **B+ — 조건부 승인 (Conditional Pass)**  
> **차단 결함**: 3건 (P1 × 1, P2 × 2)  
> **확인 완료**: Step 1 ✅, Step 3 ✅, Step 4 ✅, Step 5 ✅  
> **불완전**: Step 2 ⚠️ (핵심 호출부 4곳 미패치)

---

## 1. 리뷰 대상 파일 전수 목록

| # | 파일 | Step | 변경 사항 | 판정 |
|---|------|------|----------|------|
| 1 | `database.js` L2144-2164 | Step 1 | `getTaskByProjectNumAcrossScopes` SQL 수정 | ✅ Pass |
| 2 | `database.js` L1622-1626 | Step 2 | `getAllTasksLight` 경고 로그 추가 | ✅ Pass |
| 3 | `server.js` L187-190 | Step 2 | `dispatchNextTaskForAgent` projectId 파라미터 추가 | ✅ Pass |
| 4 | `server.js` L950 | Step 2 | `task:move` 핸들러 `project_id` 주입 | ✅ Pass |
| 5 | `ruleHarvester.js` 전체 | Step 3 | 글로벌 상수 제거, `{projectId}_GROUND_RULES.md` 동적 경로 | ✅ Pass |
| 6 | `b4System.js` L50-51 | Step 3 | `task.project_id` 전달 | ✅ Pass |
| 7 | `executor.js` L129-176 | Step 4 | `getSkillPathMap`/`loadSkillDocument` 프로젝트별 분리 | ✅ Pass |
| 8 | `wikiEngine.js` L49-70 | Step 5 | `strict_isolation` 감지 시 `global add` Skip | ✅ Pass |

---

## 2. Step별 상세 검증 결과

### ✅ Step 1: SQL 우선순위 수정 — PASS

```sql
-- AS-IS (오염 쿼리)
ORDER BY created_at ASC LIMIT 1

-- TO-BE (격리 패치 완료)
ORDER BY CASE WHEN project_id = ? THEN 1 ELSE 2 END ASC, created_at DESC LIMIT 1
```

**NULL 방어도 적용 완료** (L2146):
```javascript
if (!requestingProjectId) return null;  // ✅ Prime Rec #1 반영
```

**검증**: 자기 프로젝트 카드 최우선 → 타 프로젝트는 최신순 폴백 → `requestingProjectId` 없으면 빈 결과 반환. **완벽합니다.**

---

### ⚠️ Step 2: getAllTasksLight projectId Guard — 핵심 누수 4건 발견

`dispatchNextTaskForAgent(agentId, projectId = null)` 시그니처 변경 및 `task:move` 핸들러 수정은 확인했습니다. **그러나 이 함수와 `getAllTasksLight()`를 호출하는 다른 경로 4곳이 여전히 미패치 상태입니다.**

#### 🔴 P1-001: `mcp_server.js` L89, L104 — 치명적 누수

```javascript
// mcp_server.js L89 (resources://mycrew/tasks/all)
const tasks = await dbManager.getAllTasksLight();  // ❌ projectId 없음!

// mcp_server.js L104 (resources://mycrew/tasks/pending)
const tasks = await dbManager.getAllTasksLight();  // ❌ projectId 없음!
```

**위험도**: 🔴 **P1 (Critical)**  
**영향**: MCP 리소스를 읽는 모든 외부 클라이언트(Antigravity, Claude Desktop 등)에게 **전사 모든 프로젝트의 카드가 노출**됩니다. 이것은 에이전트가 타 프로젝트 카드를 자기 컨텍스트로 착각하는 **환각의 직접적 입구**입니다.

**수정안**:
```javascript
// MCP Resource는 projectId 파라미터가 없으므로, 
// request URI에 쿼리 파라미터를 추가하거나 전체 프로젝트별 분리가 필요
// 최소한의 즉시 조치: 프로젝트별 리소스 URI 분기
if (request.params.uri.startsWith("resources://mycrew/tasks/all")) {
  // URI에서 projectId 추출 또는 모든 프로젝트를 그룹핑하여 반환
  const tasks = await dbManager.getAllTasksLight(/* projectId */);
}
```

> **[Prime 판정]**: 이 패치가 적용되기 전까지 MCP 리소스 엔드포인트는 **격리 우회(bypass) 경로**로 작동합니다.

---

#### 🟡 P2-001: `server.js` L312 — `dispatchNextTaskForAgent(agentId)` projectId 누락

```javascript
// server.js L312 (runDirect 완료 후 다음 카드 자동 Pull)
setTimeout(() => dispatchNextTaskForAgent(agentId), 1000);
// ❌ projectId가 전달되지 않음 → 전사 큐에서 Pull
```

**위험도**: 🟡 **P2 (Major)**  
**영향**: 에이전트가 작업 완료 후 다음 카드를 Pull할 때, **타 프로젝트의 PENDING 카드를 가져올 수 있음**.

**수정안**: 같은 스코프 내의 `fullTask.project_id`를 전달:
```javascript
setTimeout(() => dispatchNextTaskForAgent(agentId, fullTask.project_id), 1000);
```

---

#### 🟡 P2-002: `server.js` L631, L896, L1004 — projectId 미전달 3곳

```javascript
// L631: POST /api/tasks/dispatch
await dispatchNextTaskForAgent(agentId);
// ❌ req.body에서 projectId를 추출하지 않음

// L896: project:join 소켓 핸들러
dispatchNextTaskForAgent(member.agent_id);
// ❌ 바로 위 L886에 projectId가 있는데도 전달하지 않음

// L1004: task:create 소켓 핸들러
setTimeout(() => dispatchNextTaskForAgent(assignee), 500);
// ❌ targetProjectId가 L982에 있는데도 전달하지 않음
```

**위험도**: 🟡 **P2 (Major)**  
**영향**: 프로젝트 조인, 카드 생성, 외부 디스패치 API 모두에서 **전사 큐 오염**이 발생합니다.

**수정안**:
```javascript
// L631
await dispatchNextTaskForAgent(agentId, req.body.projectId || null);

// L896
dispatchNextTaskForAgent(member.agent_id, projectId);

// L1004
setTimeout(() => dispatchNextTaskForAgent(assignee, targetProjectId), 500);
```

---

#### 🟠 P2-003: `server.js` L3244 — `runAutoArchive()` 내 전사 쿼리

```javascript
// L3244
const allTasks = await dbManager.getAllTasksLight();
// ❌ projectId 없이 전사 카드 로드
```

**위험도**: 🟠 **P3 (Minor)** — 아카이빙은 의도적으로 전사 대상이므로 격리 위반이라기보단 **의도적 예외**일 수 있음.

**권장**: 주석으로 의도를 명시하여 향후 혼동 방지:
```javascript
// [Phase 42.5] 의도적 전사 대상: 자동 아카이빙은 모든 프로젝트의 완료 카드를 정리
const allTasks = await dbManager.getAllTasksLight(/* intentionally global */);
```

---

#### 🟠 P2-004: `server.js` L742 — Extension Chat의 `getAppliedRules()` projectId 누락

```javascript
// L742 (extension:chat 핸들러)
const livingRules = ruleHarvester.getAppliedRules();
// ❌ projectId 없음 → LEGACY_GLOBAL 룰 로드
```

**위험도**: 🟠 **P3 (Minor)** — Chrome Extension은 특정 프로젝트 컨텍스트 없이 동작하므로 LEGACY 폴백이 적절할 수 있으나, 향후 프로젝트별 Extension 세션 구현 시 문제.

**권장**: 현 단계에서는 주석으로 의도 명시:
```javascript
// [Phase 42.5] Extension Chat은 프로젝트 비종속 → LEGACY 룰 의도적 사용
const livingRules = ruleHarvester.getAppliedRules(/* intentionally global */);
```

---

### ✅ Step 3: ruleHarvester.js + b4System.js — PASS

**변경 내역 검증**:
1. `TEAM_RULE_FILE` 글로벌 상수 → `_getTeamRuleFile(projectId)` 동적 함수 ✅
2. `classifyAndHarvest(content, agentId, taskId, projectId)` — 4번째 파라미터 `projectId` 추가 ✅
3. `_appendToTeamRules(rule, agentId, projectId)` — 파일 경로 격리 ✅
4. `getAppliedRules(projectId)` — 프로젝트별 룰 반환 ✅
5. `b4System.js` L51: `task.project_id` 전달 ✅
6. `projectId` 없을 때 `LEGACY_GLOBAL_GROUND_RULES.md` 폴백 ✅

**검증**: 오염 벡터 완전 차단. **우수합니다.**

---

### ✅ Step 4: executor.js SKILL 경로 분리 — PASS

**변경 내역 검증**:
1. `getSkillPathMap(projectId)` — 프로젝트별 `{projectId}_SKILL.md` 경로 생성 ✅
2. `loadSkillDocument(category, projectId)` — 캐시 키 `${projectId}_${category}` 분리 ✅
3. `run()` L555-564: `taskInfo.project_id`를 추출하여 `loadSkillDocument`와 `getAppliedRules`에 전달 ✅
4. `runDirect()` L922-926: 동일하게 `projectId` 추출 후 전달 ✅
5. Self-Learning 로그 L671: `getSkillPathMap(projectId)` 사용 ✅

**검증**: 두 메인 경로(`run`, `runDirect`) 모두 격리 적용. **완벽합니다.**

---

### ✅ Step 5: wikiEngine.js Graphify Global Add 차단 — PASS

```javascript
// L50-62
let isolationType = 'global_knowledge';
if (projectId) {
  const projectRow = await dbManager.getProjectById(projectId);
  if (projectRow && projectRow.isolation_scope) {
    try {
      const scopeData = JSON.parse(projectRow.isolation_scope);
      isolationType = scopeData.type || 'global_knowledge';
    } catch(e) {}
  }
}

if (isolationType === 'strict_isolation') {
  console.log(`[WikiEngine] 🛡️ 엄격 격리(A타입) 감지...`);
} else {
  // global add 실행
}
```

**검증**: 
- `projectId` 없으면 기본값 `global_knowledge` → `global add` 실행 (안전한 폴백) ✅
- `isolation_scope` JSON 파싱 실패 시 `global_knowledge` 폴백 → `global add` 실행 (보수적 안전) ✅
- `strict_isolation`일 때만 차단 → 정확한 A타입 격리 ✅
- `exec()` → `execFile()` 변환 완료 (C-001 Fix) ✅

---

## 3. 종합 판정 매트릭스

| Step | 대상 | 핵심 변경 | 적용 범위 | 판정 |
|------|------|----------|----------|------|
| 1 | DB: `#N` SQL | `CASE WHEN + NULL 방어` | 완전 | ✅ A |
| 2 | API: `getAllTasksLight` Guard | `projectId` 주입 | **불완전 (4곳 누수)** | ⚠️ C |
| 3 | I/O: `ruleHarvester` + `b4System` | 프로젝트별 파일 분리 | 완전 | ✅ A |
| 4 | Executor: `SKILL.md` 경로 | 캐시 키 + 경로 분리 | 완전 | ✅ A |
| 5 | Graphify: `global add` 차단 | `isolation_scope` 쿼리 | 완전 | ✅ A |

---

## 4. 차단 결함 요약 (필수 수정 후 재리뷰)

| ID | 심각도 | 위치 | 내용 | 수정 난이도 |
|----|--------|------|------|------------|
| **P1-001** | 🔴 Critical | `mcp_server.js` L89, L104 | MCP Resource 엔드포인트가 **projectId 없이 전사 카드 노출** — 에이전트 환각의 직접 입구 | ⭐ 낮음 |
| **P2-001** | 🟡 Major | `server.js` L312 | `runDirect` 완료 후 dispatch에 `fullTask.project_id` 미전달 | ⭐ 낮음 |
| **P2-002** | 🟡 Major | `server.js` L631, L896, L1004 | dispatch 호출 3곳에서 projectId 미전달 | ⭐ 낮음 |

---

## 5. 비차단 권고

| # | 위치 | 내용 |
|---|------|------|
| N-001 | `server.js` L3244 | `runAutoArchive()` — 의도적 전사 대상이면 주석 명시 권장 |
| N-002 | `server.js` L742 | Extension Chat `getAppliedRules()` — LEGACY 폴백 의도 주석 권장 |
| N-003 | `database.js` L1624 | `NODE_ENV` 환경변수 미설정 시 경고 미작동 — `process.env.NODE_ENV !== 'production'` 으로 반전 권장 |

---

## 6. N-003 상세: NODE_ENV 조건 반전 필요

현재 코드:
```javascript
if (!projectId && process.env.NODE_ENV === 'development') {
  console.warn(`⚠️ [DB Warning] getAllTasksLight...`);
}
```

**문제**: `NODE_ENV`를 명시적으로 `development`로 설정하는 환경이 아니면(대부분 미설정), 이 경고는 **영원히 출력되지 않습니다**. 

**권장 수정**:
```javascript
if (!projectId && process.env.NODE_ENV !== 'production') {
  console.warn(`⚠️ [DB Warning] getAllTasksLight...`);
}
```

이렇게 하면 프로덕션 배포 시만 경고가 억제되고, 개발/스테이징/미설정 환경에서는 모두 경고가 출력됩니다.

---

## 7. Prime 총평

Step 1, 3, 4, 5는 **설계 의도대로 정확하게 구현**되었습니다. 특히 `ruleHarvester.js`의 글로벌 상수 완전 제거와 `executor.js`의 캐시 키 분리는 깔끔하고 빈틈이 없습니다. `wikiEngine.js`의 `strict_isolation` 가드도 보수적 폴백(파싱 실패 시 `global_knowledge`)까지 고려한 안전한 구현입니다.

**그러나 Step 2가 불완전합니다.** `dispatchNextTaskForAgent(agentId, projectId)` 시그니처를 변경해놓고, **이 함수를 호출하는 7곳 중 3곳에서 `projectId`를 전달하지 않고 있습니다.** 이는 기존 대비 개선된 것은 맞지만, "절대 격리"라는 이름에 걸맞은 완전성을 확보하지 못했습니다.

가장 치명적인 것은 **`mcp_server.js`의 Resource 엔드포인트**(P1-001)입니다. MCP 클라이언트가 `resources://mycrew/tasks/all`을 읽으면 전사 모든 프로젝트의 카드가 에이전트 컨텍스트에 주입되며, 이것이 이번 패치가 차단하려 했던 바로 그 오염 경로입니다.

**P1-001, P2-001, P2-002 수정 후 재리뷰를 요청합니다. 수정 자체는 각각 1줄 수준이므로 30분 내 완료 가능합니다.**

---

*Prime Supreme Review | Phase 42.5 Absolute Isolation Code Review | 2026-05-13*
