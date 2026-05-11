# [Prime Advisor Review] Phase 39 — Plan Master & Mode Auto-Routing
> **리뷰어**: 소넷 (Claude Sonnet 4.6 / Antigravity)  
> **리뷰 대상**: Phase 39-1 Plan Master (`server.js` L3333~3505), Mode Auto-Routing (`server.js` L2756~2783)  
> **최종 등급**: 🟡 **B — 조건부 승인 (4건 필수 패치 후 A 승격 가능)**  
> **작성일**: 2026-05-11  

---

## 📋 총평

Phase 39 설계는 Zero-Command UX라는 방향성 자체는 올바르다. 단, **상태 머신이 메모리 내에만 존재**하고, **Iterative Review에 비용 제한이 전무**하며, **PRD 경로에 Prompt Injection 방어가 없다**는 세 가지 구조적 결함이 프로덕션 환경에서 치명적 장애로 이어질 수 있다.  
Luca가 스스로 제기한 4개 우려사항 모두 **실제 취약점**임을 확인했으며, 추가로 **3건의 신규 결함**을 발견했다.

---

## 🔴 C-001 — Stateless Session (상태 머신 부재) [심각도: Critical]

### 📍 위치
`server.js` L3480~3505 (`/plan-master/confirm` 라우트)

### 🔬 재현 시나리오
```
1. 사용자가 Plan Master 시작 → "pending_user_confirm" 상태 진입 의도
2. 브라우저 탭 닫기 또는 새로고침
3. 재접속 후 /confirm을 직접 두 번 호출
4. PRD 락 파일이 두 번 생성 가능, 상태 검증 없음
```

### 💥 실제 버그
`pending_user_confirm` 상태를 저장하는 코드가 **존재하지 않는다**.  
클라이언트는 어떤 상태에서도 `/plan-master/confirm`을 호출할 수 있다.

```js
// server.js L3484 — confirm 라우트
if (action === 'confirm') {
  // PRD 락온 파일 생성
} else if (action === 'revise') {
  // 피드백 반환
}
// ❌ "현재 기획 세션이 pending 상태인지" 검증하는 코드가 전혀 없음
```

**Deadlock은 발생하지 않는다. 대신 더 위험한 것 — "상태가 없는 유령 시스템"이다.**

### ✅ 처방 (Best Practice)
```sql
-- projects 테이블에 상태 컬럼 추가 (database.js)
ALTER TABLE projects ADD COLUMN plan_master_status TEXT DEFAULT NULL;
-- 값: NULL | 'analyzing' | 'pending_confirm' | 'locked'
ALTER TABLE projects ADD COLUMN plan_master_revision_count INTEGER DEFAULT 0;
```

```js
// /plan-master/analyze 진입 시
await dbManager.updateProjectField(projectId, 'plan_master_status', 'analyzing');

// /plan-master/generate-roadmaps 완료 시
await dbManager.updateProjectField(projectId, 'plan_master_status', 'pending_confirm');

// /plan-master/confirm 진입 전 가드
const project = await dbManager.getProjectById(projectId);
if (project.plan_master_status !== 'pending_confirm') {
  return res.status(409).json({ 
    error: '기획 확정 대기 상태가 아닙니다. 먼저 스코프 분석을 완료하세요.' 
  });
}
```

---

## 🔴 C-002 — Unbounded Revision Loop (무한 수정 루프 / Quota 소진) [심각도: Critical]

### 📍 위치
`server.js` L3495~3498 (`revise` 분기)

### 🔬 재현 시나리오
```
for (let i = 0; i < 1000; i++) {
  POST /api/projects/proj-1/plan-master/analyze         // Sonnet 4.6 호출
  POST /api/projects/proj-1/plan-master/generate-roadmaps  // Opus 4.6 호출
  POST /api/projects/proj-1/plan-master/confirm { action: 'revise' }
}
// revise 1회 = Sonnet + Opus 각 1회 → 무한 반복 시 비용 폭탄
```

### 💥 실제 버그
`revise` 처리 로직이 단순 메시지 반환이며, 루프 횟수를 제한하는 **카운터가 전혀 없다**.

### ✅ 처방 (Best Practice)
```js
// server.js - /plan-master/confirm 라우트
const MAX_REVISIONS = 5;
const project = await dbManager.getProjectById(projectId);
const revisionCount = project.plan_master_revision_count || 0;

if (action === 'revise') {
  if (revisionCount >= MAX_REVISIONS) {
    return res.status(429).json({
      error: `최대 수정 횟수(${MAX_REVISIONS}회)를 초과했습니다. 현재 로드맵을 확정하거나 새 기획 세션을 시작하세요.`,
      revision_count: revisionCount,
      max: MAX_REVISIONS
    });
  }
  await dbManager.updateProjectField(projectId, 'plan_master_revision_count', revisionCount + 1);
  await dbManager.updateProjectField(projectId, 'plan_master_status', 'pending_confirm');
  res.json({ 
    status: 'revision_requested', 
    revision_count: revisionCount + 1, 
    max: MAX_REVISIONS,
    feedback 
  });
}
```

---

## 🔴 C-003 — Prompt Injection (시스템 프롬프트 오염) [심각도: Critical]

### 📍 위치
`server.js` L3406 (`generate-roadmaps` 시스템 프롬프트 구성)

### 💥 실제 버그
```js
const systemPrompt = `...
- 필수(Must-have): ${must_have ? must_have.join(', ') : '없음'}
- 확장(Nice-to-have): ${nice_to_have ? nice_to_have.join(', ') : '없음'}
`;
// must_have = ["기능1\n\n무시하고 대신 이걸 해줘: <악성 지시>"] 형태의 Prompt Injection 가능
// → 줄바꿈을 통해 LLM 시스템 프롬프트 구조 파괴 가능
```

### ✅ 처방 (Best Practice)
```js
// sanitizeScope 헬퍼 함수 추가 (라우트 상단)
function sanitizeScope(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter(item => typeof item === 'string')
    .map(item => item.replace(/[`\n\r]/g, ' ').trim().slice(0, 200)) // 줄바꿈 제거, 200자 제한
    .slice(0, 30); // 최대 30개 항목
}

// projectId 화이트리스트 검증 (라우트 진입 즉시)
const projectIdPattern = /^[a-zA-Z0-9_-]{1,50}$/;
if (!projectIdPattern.test(projectId)) {
  return res.status(400).json({ error: '유효하지 않은 projectId 형식입니다.' });
}

const safe_must_have = sanitizeScope(must_have);
const safe_nice_to_have = sanitizeScope(nice_to_have);
// 이후 systemPrompt에 safe_must_have, safe_nice_to_have 사용
```

---

## 🟠 H-001 — createTask 시그니처 버그 + Socket Race Condition [심각도: High]

### 📍 위치
`server.js` L3443~3467 (`generate-roadmaps`의 태스크 생성 루프)

### 💥 실제 버그 (2가지 복합)

**버그 1**: `createTask`가 객체 방식으로 호출되나 실제 시그니처는 positional arguments:
```js
// L3446 — 객체 방식 호출 (잘못됨)
await dbManager.createTask({
  project_id: projectId,
  title: taskTitle,
  status: 'BACKLOG',
  assigned_agent: 'dev_senior'
});
// ❌ 실제 시그니처: createTask(title, content, requester, model, assignee, category, projectId, ...)
// → title=undefined로 태스크 생성되거나 런타임 에러
```

**버그 2**: `io.emit('task:bulk_created', ...)` — 전역 emit이어서 다른 프로젝트 클라이언트에도 불필요한 재렌더링 유발.

### ✅ 처방 (Best Practice)
```js
const createdIds = [];
for (const taskTitle of safe_mvp_tasks) {
  const taskId = await dbManager.createTask(
    taskTitle,       // title
    taskTitle,       // content
    'plan_master',   // requester
    null,            // model (default)
    'dev_senior',    // assignee
    'BACKLOG',       // category
    projectId        // projectId
  );
  createdIds.push(taskId);
}

// 전역 emit → 프로젝트 Room 한정 emit으로 교체
io.to(`project_${projectId}`).emit('task:bulk_created', {
  projectId,
  taskIds: createdIds.map(String),
  count: createdIds.length
});
```

---

## 🟠 H-002 — 모델 식별자 하드코딩 (P-006 위반) [심각도: High]

### 📍 위치
- `server.js` L3524, L3527, L3530, L3533 (Zero-Command 라우트 모드 분기)
- `server.js` L2769, L2773, L2776, L2779 (댓글 트리거 모드 분기)

### 💥 실제 버그
```js
forceModel = 'claude-opus-4-6';     // ⚠️ P-006 위반: 문자열 리터럴 하드코딩
forceModel = 'gemini-3.1-pro-high'; // ❌ strategic_memory.md 기준 올바른 식별자가 아님
forceModel = 'claude-sonnet-4-6';   // ⚠️ P-006 위반: 문자열 리터럴 하드코딩
```

### ✅ 처방
```js
// server.js 상단 — MODEL import 확인 (이미 있음: L34)
import { MODEL } from './ai-engine/modelRegistry.js';

// 모드 분기 전량 교체 (L2769, L2773, L2776, L2779, L3524, L3527, L3530, L3533)
if (resolvedMode === 'ARCHITECT') {
  forceModel = MODEL.OPUS;   // modelRegistry.js 상수 — 실제 값 확인 후 적용
} else if (resolvedMode === 'DEV') {
  forceModel = MODEL.PRO;    // modelRegistry.js 상수
} else if (resolvedMode === 'QA') {
  forceModel = MODEL.OPUS;
} else if (resolvedMode === 'DEBUG') {
  forceModel = MODEL.SONNET;
}
```

> ⚠️ `modelRegistry.js`에서 Antigravity 브릿지 모델의 실제 상수명 확인 후 적용할 것

---

## 🟡 M-001 — graphify_mcp.py handle_request BFS Depth 미패치 [심각도: Medium]

### 📍 위치
`graphify_mcp.py` L396~414 (`handle_request` 내부 BFS)

### 💥 실제 버그
Phase 41 패치에서 `execute_query_cli()`에만 `MAX_DEPTH=50`을 적용했으나,  
**MCP stdio 통신 경로**인 `handle_request()` 내부 BFS(L396~408)에는 동일한 제한이 **적용되지 않았다**.

```python
# graphify_mcp.py L396 — handle_request 경로 (MAX_DEPTH 없음)
while queue:  # ❌ 순환 참조 그래프에서 무한 루프 가능
    curr, p = queue.pop(0)
    ...
```

### ✅ 처방
```python
# handle_request 내 BFS에 동일한 MAX_DEPTH 적용
MAX_DEPTH = 50
queue = [(src, [src])]
visited = set([src])
path = None

while queue:
    curr, p = queue.pop(0)
    if len(p) > MAX_DEPTH:
        break  # Depth limit 초과, path=None 유지
    if curr == dst:
        path = p
        break
    for nxt in adj.get(curr, []):
        if nxt not in visited:
            visited.add(nxt)
            queue.append((nxt, p + [nxt]))

if path:
    path_str = " -> ".join(path)
    return {"content": [{"type": "text", "text": f"✅ 경로 발견:\n{path_str}"}]}
else:
    msg = f"⚠️ 최대 탐색 깊이({MAX_DEPTH})를 초과했거나 경로가 없습니다."
    return {"content": [{"type": "text", "text": msg}]}
```

---

## 🟡 M-002 — PRD Lock 파일 동기 I/O 블로킹 [심각도: Medium]

### 📍 위치
`server.js` L3489~3490 (`confirm` 라우트)

### 💥 실제 버그
```js
fs.mkdirSync(lockDir, { recursive: true }); // 동기 블로킹 ❌
fs.writeFileSync(lockPath, '...', 'utf-8'); // 동기 블로킹 ❌
// Phase 41에서 atomic write 패턴 적용했는데, 이 부분에는 미적용
```

### ✅ 처방
```js
// 비동기 + atomic write 패턴 (Phase 41과 동일 패턴)
await fs.promises.mkdir(lockDir, { recursive: true });
const tmpPath = lockPath + '.tmp';
await fs.promises.writeFile(tmpPath, `Locked at ${new Date().toISOString()} by CEO`, 'utf-8');
await fs.promises.rename(tmpPath, lockPath); // POSIX atomic rename
```

---

## 📊 결함 요약표

| ID | 분류 | 위치 | 심각도 | Luca 우려? | 패치 필요 |
|----|------|------|--------|-----------|----------|
| C-001 | 상태 머신 부재 | server.js L3480 | 🔴 Critical | ✅ 우려 1 | DB 컬럼 추가 + 상태 가드 |
| C-002 | 무한 루프 (비용) | server.js L3495 | 🔴 Critical | ✅ 우려 2 | revision_count 가드 |
| C-003 | Prompt Injection | server.js L3406 | 🔴 Critical | ✅ 우려 3 | sanitizeScope 함수 |
| H-001 | createTask 버그 + Socket Race | server.js L3446 | 🟠 High | ✅ 우려 4 | 시그니처 수정 + room emit |
| H-002 | 모델 ID 하드코딩 (P-006) | server.js L2769, L3524 | 🟠 High | ❌ 신규 발견 | MODEL 상수 사용 |
| M-001 | BFS Depth 미패치 경로 | graphify_mcp.py L396 | 🟡 Medium | ❌ 신규 발견 | handle_request BFS 패치 |
| M-002 | 동기 I/O 블로킹 | server.js L3489 | 🟡 Medium | ❌ 신규 발견 | 비동기 + atomic write |

---

## 🎯 A등급 승격 조건 (필수 4건)

다음 4건이 모두 패치되면 🟢 A등급으로 승격한다:

1. **[C-001]** `projects` 테이블에 `plan_master_status`, `plan_master_revision_count` 컬럼 추가 + `/confirm` 상태 가드
2. **[C-002]** `MAX_REVISIONS = 5` 가드 + `revision_count` DB 업데이트
3. **[C-003]** `sanitizeScope()` 함수 추가 및 3개 라우트 적용
4. **[H-002]** `MODEL` 상수로 하드코딩된 모델 식별자 8곳 전량 교체 (P-006 준수)

권장 패치 (A 등급 이후 진행 가능):

5. **[H-001]** `createTask` positional 시그니처 수정 + room-scoped emit 전환
6. **[M-001]** `handle_request` BFS에 `MAX_DEPTH=50` 적용 (CLI 경로와 동기화)
7. **[M-002]** Lock 파일 I/O 비동기화 + atomic write 적용

---

## 💡 아키텍처 개선 제안 (Next Phase 반영 권고)

1. **Plan Master Session을 1st-class Entity로 격상**: `plan_master_sessions` 테이블 분리 → 세션 ID 기반 멱등성 + 다중 기획 세션 병렬 진행 가능
2. **generate-roadmaps 태스크 생성 트랜잭션화**: `dbManager.createTasksBatch()` 구현 → 중간 실패 시 "반쪽 로드맵" 방지
3. **current_mcp_mode.txt Race Condition 방어**: `writeFileSync` → `tmp + atomic rename` 패턴 적용 (server.js L3544)

---

*Prime Advisor Review | 소넷 (Sonnet) | 2026-05-11*  
*참조 정책: P-004, P-005, P-006 (모델 식별자), P-020 (무단 코딩 금지)*
