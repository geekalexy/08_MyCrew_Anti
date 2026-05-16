# Phase 45 — MCP 루프 전환 현황 점검 및 설계 PRD

> 작성자: 소넷 (Sonnet)  
> 작성일: 2026-05-16  
> CTO 리뷰: 루카 (Luca) — 2026-05-16  
> 리뷰어: Prime (Claude Sonnet 4.6 Thinking) — 2026-05-16  
> 상태: **점검 완료 / 설계 초안 / Prime 리뷰 반영**  
> 연관 Phase: Phase 43-4 (AutoRun), Phase 43-5 (Task 분기), Phase 46 (Full Auto QA)

---

## 1. 배경 및 점검 목적

MyCrew v2가 MCP 서버 아키텍처로 전환된 이후, **각 에이전트가 MCP Tool을 통해 코멘트를 읽고 쓰는 방식**이 루프 트리거의 핵심이 되어야 한다.

그러나 소켓(`io.emit`)이나 별도 이벤트 시스템에 의존하는 레거시 패턴이 여전히 잔존하는지 확인이 필요하여, 대표님 요청에 따라 **두 핵심 모드**를 대상으로 현황 점검을 수행했다.

**점검 대상**:
- `/plan_master` — 플랜 모드 (Phase 39-1~5 구현)
- `/auto_QA` + `/auto_debug` — 디버깅 모드 (Phase 43-4 구현 목표)

---

## 2. 점검 결과 (AS-IS)

### 2-1. `/plan_master` (플랜 모드)

#### 실행 흐름 (현재)
```
[프론트] 사용자가 ARCHITECT 모드 버튼 클릭
    ↓
POST /api/tasks/:id/run { mode: 'ARCHITECT' }
    ↓
server.js: io.emit('plan-master:trigger') ← 소켓 이벤트 의존
    ↓
[프론트] socket.on('plan-master:trigger') → PlanMasterModal 오픈
    ↓
[프론트] POST /api/projects/:id/plan-master/analyze 호출
    ↓
server.js: while (nextThoughtNeeded && thoughtNumber <= 5) { ← 서버 측 블로킹 루프
    antigravityAdapter.generateResponse() → AI 호출
    io.emit('plan-master:thought_update') ← 소켓 이벤트 의존
}
    ↓
POST /api/projects/:id/plan-master/generate-roadmaps → while 루프 2차
    ↓
dbManager.createTask() × N → 칸반 카드 일괄 생성
```

#### 진단

| 항목 | 현재 상태 | MCP 기반 여부 |
|------|-----------|:---:|
| 모드 트리거 | `io.emit('plan-master:trigger')` | ❌ 소켓 의존 |
| AI 루프 제어 | `while` 블로킹 서버 루프 | ❌ 서버 하드코딩 |
| 진행 브로드캐스트 | `io.emit('plan-master:thought_update')` | ❌ 소켓 의존 |
| 카드 생성 | `dbManager.createTask()` 직접 호출 | ✅ DB 직접 (폴링 無) |
| FilePollingAdapter | 미사용 | ✅ |

**핵심 문제**: `server.js`의 analyze/generate-roadmaps 핸들러가 AI를 직접 루프 호출하는 **God Route** 패턴. MCP Tool Call을 거치지 않고 AI 응답 JSON을 서버에서 직접 파싱한다. [Prime] 추가로 L3576에 모델 식별자 `'anti-claude-sonnet-4.6-thinking'`이 하드코딩되어 있어 **P-006 위반** — God Route 제거 시 `MODEL.SONNET` 상수 참조로 교체 필수.

---

### 2-2. `/auto_QA` + `/auto_debug` (디버깅 모드)

#### 실행 흐름 (현재)
```
POST /api/tasks/:id/run { mode: 'QA' or 'DEBUG' }
    ↓
server.js: forceRedispatchTask() → executor.runDirect()
    ↓
loops/qaLoop.js (또는 debugLoop.js)
    ↓
[실제 내용]
    await dbManager.updateAutoRunStatus(task.id, 'QA_RUNNING');
    io.emit('task:qa_status_update');
    await new Promise(res => setTimeout(res, 3000));  ← 3초 대기 목업
    await dbManager.updateAutoRunStatus(task.id, 'QA_DONE');
    io.emit('task:qa_status_update');
    return { status: 'COMPLETED' };
```

#### 진단

| 항목 | 현재 상태 | 평가 |
|------|-----------|:---:|
| AI 실제 호출 | **없음** | 🔴 미구현 |
| Bun 데몬 연동 | `// TODO: Bun 데몬 연동` 주석만 | 🔴 미구현 |
| MCP Tool Call | **없음** | 🔴 미구현 |
| 코멘트 핑퐁 루프 | **없음** | 🔴 미구현 |
| 상태 전파 | `io.emit('task:qa_status_update')` | ⚠️ 소켓 의존 |
| FilePollingAdapter | 미사용 | ✅ |

**핵심 문제**: [Prime] `qaLoop.js`와 `debugLoop.js`는 **완전 더미 코드**다. `import { executeTool }`이 L1에 존재하지만 본문에서 한 번도 호출되지 않으며, 3초 `setTimeout` 후 무조건 성공을 반환한다. Phase 45-A에서 `contextInjector.buildAutoRunContext(taskData, 'QA')` 호출 → `executeTool` 실제 라우팅으로 전환 필수.

---

## 3. 종합 진단 — 레거시 잔존 현황

```
┌────────────────────┬──────────────┬──────────────────────────────┐
│ 대상               │ 레거시 구분   │ 상태                         │
├────────────────────┼──────────────┼──────────────────────────────┤
│ FilePollingAdapter │ 구폴링 방식   │ ✅ 실제 사용처 없음           │
│ plan_master 트리거 │ 소켓 의존     │ ⚠️  io.emit에 강하게 결합    │
│ plan_master 루프   │ 서버 블로킹   │ ⚠️  while 동기 루프 고착     │
│ qaLoop.js          │ 스켈레톤      │ 🔴 구현 없음                 │
│ debugLoop.js       │ 스켈레톤      │ 🔴 구현 없음                 │
└────────────────────┴──────────────┴──────────────────────────────┘
```

**결론**: FilePolling 구방식은 제거되었으나, **MCP Tool Call 기반 루프 전환은 아직 어디에도 구현되지 않은 상태**다.

---

## 4. TO-BE 설계 — MCP Tool Call 기반 루프

### 4-1. 설계 원칙 (Phase 45)

Phase 43-5 기획서의 코멘트 핑퐁 루프 원칙을 plan_master와 auto_QA 모두에 일관되게 적용한다.

```
에이전트가 루프를 스스로 주도한다.
서버(server.js)는 최초 트리거만 발행하고, 이후 루프는 에이전트가 MCP Tool을 호출하며 진행한다.
```

### 4-2. plan_master — MCP 기반 재설계

#### 목표 흐름
```
POST /api/tasks/:id/run { mode: 'ARCHITECT' }
    ↓
server.js: 카드 상태 → PLANNING, executor.runDirect() 호출
    ↓
executor → contextInjector ('PLAN_MASTER' 모드 신설 필요 — [Prime] 현재 L318에 'TASK_MASTER'만 존재)
    ↓
AI (Sonnet Thinking) 실행
    ↓
AI가 MCP Tool 호출:
    analyze_scope({ thought, must_have, nice_to_have })
    make_roadmaps({ mvp_tasks, future_scope })
    confirm_mvp({ message_to_user })
    ↓
MCP Tool 핸들러:
    → DB에 스코프/로드맵 저장
    → 칸반 카드 생성 (P-020: Dry-Run 승인 후)
    → add_comment(taskId, "로드맵 완성: ...")
    ↓
루프 종료: 카드 상태 → PLAN_COMPLETE
```

#### 현행 `server.js` God Route 제거 대상
- `POST /api/projects/:id/plan-master/analyze` — AI 루프 로직 → executor로 이전
- `POST /api/projects/:id/plan-master/generate-roadmaps` — AI 루프 로직 → executor로 이전
- `POST /api/projects/:id/plan-master/confirm` — DB 상태 변경만 유지 (이건 존속)

> 💡 **[Luca (CTO) 아키텍처 리뷰]**  
> `server.js`의 하드코딩된 while 루프를 제거하고 에이전트 주도의 MCP로 책임을 넘기는 방향성에 적극 동의합니다. 단, 라우터에서 동기적 루프가 사라지므로, `POST /analyze` API 호출 시 서버는 즉각 `202 Accepted`를 반환하도록 수정해야 합니다. 프론트엔드가 타임아웃 없이 비동기 응답을 대기(또는 SSE 구독)할 수 있는 구조가 핵심입니다.

### 4-3. auto_QA / auto_debug — MCP 기반 구현

#### 목표 흐름 (qaLoop.js 재작성)
```
executor.runDirect(task, { mode: 'QA' })
    ↓
contextInjector (QA 모드 페르소나 + MCP Tool 권한)
    ↓
AI (Sonnet) 실행
    ↓
AI가 MCP Tool 호출:
    get_task_context(taskId)           → 태스크 본문/첨부 읽기
    add_comment(taskId, "QA 시작...")  → 상태 코멘트 기록
    run_browser_test(url, selectors)   → Bun 데몬 호출 (Phase 46)
    add_comment(taskId, "결과: ✅/❌")
    update_card_status(taskId, 'QA_DONE' or 'QA_FAILED')
    ↓
루프 종료 조건: QA_DONE 또는 MAX_ITERATIONS(10회) 도달
```

> 💡 **[Luca (CTO) 아키텍처 리뷰]**  
> QA 루프는 외부(브라우저 데몬 등) 도구를 빈번히 호출하므로 예기치 않은 중단 확률이 높습니다. 루프 도중 서버나 데몬이 크래시될 경우, 해당 태스크가 영원히 `QA_RUNNING` 상태의 좀비가 될 위험이 있습니다. `server.js` 구동 시점에 기존 상태를 체크하여 강제로 `QA_FAILED`나 `PENDING`으로 복구(Recover)하는 안전망 로직을 추가 설계할 것을 권장합니다.

---

## 5. 구현 우선순위 (Phase 45 Task List)

### Phase 45-A: qaLoop / debugLoop 실체화 (최우선)

- [ ] `qaLoop.js` TODO 구현: `executor.runDirect()` → AI → MCP Tool `add_comment` 연동
- [ ] `debugLoop.js` TODO 구현: 동일 패턴 적용
- [ ] `contextInjector.js`: QA/DEBUG 모드 페르소나 및 허용 Tool 목록 추가
- [ ] 루프 종료 조건: `MAX_ITERATIONS = 10`, 명시적 상태 전이(`QA_DONE`/`QA_FAILED`) 우선

### Phase 45-B: plan_master God Route 제거 (차순위)

- [ ] `server.js` analyze 핸들러의 `while` 루프 → executor 위임으로 교체
- [ ] `buildAutoRunContext('PLAN_MASTER')` 에 `analyze_scope`, `make_roadmaps`, `confirm_mvp` Tool 추가 — **단, 현재 contextInjector.js에는 `PLAN_MASTER` 모드가 없음. `TASK_MASTER` 로 통합할지, 별도 분기를 신설할지 결정 필요**
- [ ] P-020 준수: 로드맵 카드 생성 전 Dry-Run 프리뷰 반환 → 사용자 승인 후 실제 생성
- [ ] **[신규] server.js L3576 하드코딩 모델 식별자 `'anti-claude-sonnet-4.6-thinking'` → `MODEL.SONNET` 상수로 교체 (P-006)**

### Phase 45-C: 소켓 의존 제거 — 독립 PR 분리 필수

[Prime] `useSocket()` 훅은 Graphify 기준 **God Node #7 (23 edges)**이며, `App.jsx`, `Column.jsx`, `KanbanBoard.jsx`, `LogDrawer.jsx`, `TaskDetailModal` 등 프론트 5개 코어 컴포넌트에서 직접 구독 중이므로, **Phase 45-C는 독립 PR로 분리**한다.

- [ ] `useSocket` 의존 컴포넌트 매핑 사전 작성 (5개 컴포넌트 + 6개 스토어)
- [ ] `plan-master:trigger` — 소켓 대신 HTTP 응답 즉시 반환 + 프론트 polling 또는 SSE로 대체
- [ ] `task:qa_status_update` — DB 상태 변경만으로 충분하면 소켓 제거 가능 여부 검토
- [ ] 의존 컴포넌트 단계적 제거 (App.jsx → KanbanBoard.jsx → TaskDetailModal 순서)

---

## 6. 정책 준수 체크 (Phase 45 적용 기준)

| 정책 | 내용 | 적용 방식 |
|------|------|-----------|
| **P-020** | 명시적 허가 없는 카드 생성 금지 | Dry-Run 프리뷰 후 confirm API 호출로만 카드 생성 |
| **P-016** | dangerously 접두사 필수 | 데이터 파괴 연산 없으므로 해당 없음 |
| **P-001** | 에이전트 ID 규격 | `dev_qa_auto`, `dev_debug_auto` — 규격 준수 |
| **P-006** | 모델 식별자 | `MODEL.SONNET`, `MODEL.OPUS` 상수만 사용 (하드코딩 금지) |

---

## 7. 블로커 및 주의사항

> [!WARNING]
> **qaLoop / debugLoop의 Bun 데몬 연동**은 Phase 46 범위와 겹칩니다.  
> Phase 45에서는 **AI + MCP Tool `add_comment` 기반 루프 골격**만 완성하고, Bun 데몬 실제 연동은 Phase 46에서 붙이는 순서를 권장합니다.

> [!IMPORTANT]
> **plan_master God Route 제거 시** server.js L3532~L3732 약 200줄이 변경됩니다.  
> `ContextInjector`는 God Node가 아니지만 `server.js`, `ariDaemon.js`, `executor.js` 3곳에서 import 중 — 변경 파급 범위 통제 가능.

> 💡 **[Luca (CTO) 아키텍처 리뷰]**  
> `ContextInjector`의 페르소나 및 도구 스펙 주입 로직을 건드릴 때, 기존 Phase 43-4의 DEV 모드 오토런이 오염되지 않도록 철저한 격리(Isolation)가 필요합니다. 또한 `server.js`에서 200줄 가까운 God Route 삭제 전, 만일을 대비해 트랜잭션 롤백 처리와 DB 커넥션 릴리스가 누락되지 않도록 라우터 단의 `try-catch-finally` 블록을 확실히 점검 바랍니다.

---

## 8. 다음 단계

**선결 사항 (착수 전 필수)** [Prime]:
0. `contextInjector.js`에 `PLAN_MASTER` 모드 분기 신설 (현재 `TASK_MASTER`만 존재)
1. `qaLoop.js`/`debugLoop.js`의 미사용 `import { executeTool }` 제거 후 실제 라우팅 설계
2. `graphify update .` 실행 — `qaLoop`, `debugLoop`, `CategoryTaskService`가 그래프에 미등록

**구현 순서**:
1. 선결 사항 해소 후 `/code` 모드 전환 → Phase 45-A 구현 착수
2. Phase 45-A 완료 후 Phase 43-5 Task 분기 보강 기획서와 통합하여 Phase 45-B 진행
3. 전체 완료 후 Supreme Review → Phase 46 (Full Auto QA) 착수

---

*작성: 소넷 | Phase 45 | 2026-05-16*
