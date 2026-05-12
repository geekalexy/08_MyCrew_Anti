# Phase 42.5: Agent Absolute Isolation — 최종 승인 (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-13 01:05  
> **리뷰 등급**: 🟢 **A — 최종 승인 (Full Pass)**  
> **차단 결함**: 0건  
> **이전 등급**: B+ (조건부 승인) → **A (무조건 승인)**

---

## 1. 2차 패치 검증 결과

### ✅ P1-001 해결 — MCP Resource 환각 입구 완전 차단

```diff
- // AS-IS: 정적 URI → 전사 카드 노출
- resources://mycrew/tasks/all         ← getAllTasksLight() 파라미터 없음
- resources://mycrew/tasks/pending     ← getAllTasksLight() 파라미터 없음

+ // TO-BE: 템플릿 URI → projectId 강제 추출
+ resources://mycrew/projects/{projectId}/tasks/all
+ resources://mycrew/projects/{projectId}/tasks/pending
```

**구현 검증 (mcp_server.js)**:
- `ListResourceTemplatesRequestSchema` 핸들러 도입 (L66-83) ✅
- 정규식 매칭으로 `projectId` 추출 후 `getAllTasksLight(projectId)` 호출 (L98-131) ✅  
- 기존 정적 `resources://mycrew/tasks/all` 리소스 **완전 폐기** ✅
- `resources://mycrew/projects` (프로젝트 목록)만 정적 리소스로 유지 — 적절 ✅

**판정**: 🔴 Critical → ✅ **해결 완료**. LLM이 전사 카드를 한 번에 가져올 수 있는 경로가 완전히 소멸했습니다.

---

### ✅ P2-001 해결 — runDirect 완료 후 dispatch

```javascript
// server.js L312 (수정 확인)
setTimeout(() => dispatchNextTaskForAgent(agentId, fullTask.project_id), 1000);
//                                              ✅ project_id 전달
```

---

### ✅ P2-002 해결 — dispatch 호출부 3곳

```javascript
// server.js L631 (API dispatch — 수정 확인)
const { agentId, projectId } = req.body;  // ✅ projectId 수신
await dispatchNextTaskForAgent(agentId, projectId);  // ✅ 전달

// server.js L896 (project:join — 수정 확인)
dispatchNextTaskForAgent(member.agent_id, projectId);  // ✅ 전달

// server.js L1004 (task:create — 수정 확인)
setTimeout(() => dispatchNextTaskForAgent(assignee, targetProjectId), 500);  // ✅ 전달
```

---

## 2. 전체 격리 패치 최종 검증 매트릭스

| Step | 대상 | 핵심 변경 | 1차 판정 | 2차 패치 후 |
|------|------|----------|---------|-----------|
| 1 | DB: `#N` SQL | `CASE WHEN + NULL 방어` | ✅ A | ✅ A |
| 2 | API: `getAllTasksLight` Guard | `projectId` 주입 | ⚠️ C | ✅ **A** |
| 3 | I/O: `ruleHarvester` + `b4System` | 프로젝트별 파일 분리 | ✅ A | ✅ A |
| 4 | Executor: `SKILL.md` 경로 | 캐시 키 + 경로 분리 | ✅ A | ✅ A |
| 5 | Graphify: `global add` 차단 | `isolation_scope` 쿼리 | ✅ A | ✅ A |

---

## 3. 격리 커버리지 최종 확인

### `getAllTasksLight()` 전수 호출부 감사

| # | 위치 | projectId 전달 | 판정 |
|---|------|---------------|------|
| 1 | `server.js` L190 (dispatch 함수 내) | ✅ 파라미터로 수신 | ✅ |
| 2 | `server.js` L312 (runDirect 완료) | ✅ `fullTask.project_id` | ✅ |
| 3 | `server.js` L631 (API dispatch) | ✅ `req.body.projectId` | ✅ |
| 4 | `server.js` L896 (project:join) | ✅ `projectId` | ✅ |
| 5 | `server.js` L950 (task:move drag) | ✅ `task.project_id` | ✅ |
| 6 | `server.js` L969 (drag done→review) | ✅ `task.project_id` | ✅ |
| 7 | `server.js` L1004 (task:create) | ✅ `targetProjectId` | ✅ |
| 8 | `server.js` L3244 (autoArchive) | ⬜ 의도적 전사 대상 | ✅ 예외 허용 |
| 9 | `mcp_server.js` L101, L117 | ✅ URI 템플릿에서 추출 | ✅ |

### `dispatchNextTaskForAgent()` 전수 호출부 감사

| # | 위치 | projectId 전달 | 판정 |
|---|------|---------------|------|
| 1 | L312 | ✅ `fullTask.project_id` | ✅ |
| 2 | L631 | ✅ `req.body.projectId` | ✅ |
| 3 | L896 | ✅ `projectId` | ✅ |
| 4 | L969 | ✅ `task.project_id` | ✅ |
| 5 | L1004 | ✅ `targetProjectId` | ✅ |

**전수 감사 결과: 격리 우회 경로 0건.**

---

## 4. Prime 최종 총평

Phase 42.5 에이전트 절대 격리 패치의 **전 5단계 구현이 완료**되었습니다.

1차 리뷰에서 발견된 **P1-001(MCP 환각 입구)**은 정적 URI를 템플릿 URI로 전환하는 **구조적 해결**로 차단했습니다. 단순히 파라미터를 추가한 것이 아니라, URI 스키마 자체를 변경하여 **projectId 없이는 API 호출 자체가 불가능**하도록 만든 점이 인상적입니다.

P2-001/P2-002는 각 스코프에서 이미 존재하던 `projectId` 변수를 dispatch 호출에 전달하는 1줄 수정으로 깔끔하게 해결되었습니다.

4대 컨텍스트 오염 원인:
- ✅ `getAllTasksLight()` 전사 카드 로딩 → **projectId 강제화**
- ✅ `#N` 카드 참조 SQL 우선순위 → **CASE WHEN 자기 프로젝트 최우선**
- ✅ `SKILL.md` / `GROUND_RULES.md` 글로벌 공유 → **{projectId}_ 접두사 분리**
- ✅ Graphify `global add` 비격리 병합 → **isolation_scope 체크로 A타입 차단**

**Phase 42.5 에이전트 절대 격리 패치를 최종 승인합니다. 등급 A.**

---

*Prime Supreme Review — Final Approval | Phase 42.5 | 2026-05-13*
