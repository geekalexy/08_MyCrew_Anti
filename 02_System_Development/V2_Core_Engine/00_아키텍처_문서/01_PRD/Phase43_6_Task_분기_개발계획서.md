# [Phase 43-6] Task Master 업무 분기 백엔드 개발 계획서

**작성자**: 루카 (Gemini)  
**수정**: Prime — 2026-05-16 (G-1~G-4 본문 직접 반영)  
**목적**: `Phase43_5_Task_분기_보강기획서.md`를 바탕으로 프론트엔드(소넷) 개발 착수 전, 아리 엔진(Ari Engine)의 코어 및 서비스 계층을 개편하는 구체적 구현 계획 명시.

---

## 1. 개요
* 단일 카드 기반 순차 실행의 병목 및 복잡도 증가를 해결하기 위해, **대분류(에픽) 카드 생성 + 하위 코멘트 실행 보고** 형태의 MCP Tool Call 기반 코멘트 핑퐁 루프 구조로 백엔드를 재구성합니다.
* `database.js`의 God Node(84 엣지) 현상을 완화하고자 `CategoryTaskService`를 분리합니다.
* 사용자 유래 텍스트를 LLM에 반환하는 모든 신규 Tool에 대해 `promptInjectionGuard`를 연동합니다.

> [소넷] 개요의 방향은 타당합니다. 단, "이벤트 드리븐"이라는 표현은 소켓/이벤트 버스를 연상시킬 수 있습니다. 기획서에서 합의한 것처럼 이 루프는 **MCP Tool Call 자체가 트리거**이므로, 개요 문구를 "MCP Tool Call 기반 코멘트 핑퐁 루프 구조"로 명확히 수정하는 것을 권장합니다.

---

## 2. 세부 개발 범위 및 전략

### 2-0. [선행] DB 마이그레이션 — Task 테이블 스키마 확장
**파일**: `01_아리_엔진/migrations/014_phase43-5_category_tasks.sql` (신규)

현재 `Task` 테이블에는 대분류 카드 구조에 필요한 컬럼이 없으므로, 서비스 레이어 작성 전 반드시 아래 마이그레이션을 선행합니다.

```sql
-- [Phase 43-5] Category Task Branching
ALTER TABLE Task ADD COLUMN category TEXT;
ALTER TABLE Task ADD COLUMN parent_task_id INTEGER REFERENCES Task(id);
ALTER TABLE Task ADD COLUMN depends_on TEXT;
```

### 2-1. [Service Layer] CategoryTaskService 신설
**파일**: `01_아리_엔진/services/CategoryTaskService.js` (신규 디렉토리 `services/` 생성 필요)

1. **역할**: Task Master가 생성한 10개 대분류별 JSON 플랜을 실제 여러 장의 칸반 카드(Task) 데이터로 변환하여 DB에 삽입.
2. **원자성 보장**: N개의 카드가 생성 중 하나라도 실패할 경우를 대비하여 `db.run('BEGIN TRANSACTION')` ~ `db.run('COMMIT') / db.run('ROLLBACK')`을 직접 다룹니다.
3. **스키마 매핑**: 생성된 자식 카드들은 `category`, `parent_task_id`, `depends_on` 필드와 부모 카드의 `projectId`를 그대로 상속합니다.

> [소넷] 2-1은 설계가 명확합니다. 추가로 고려할 사항:
> - **`parent_task_id` 필드**: `depends_on`은 카드 간 순서 의존성용이고, 부모-자식 관계는 별도의 `parent_task_id` 컬럼이 필요합니다. F-4의 "모든 자식 DONE → 부모 DONE" 전이 로직이 이 컬럼을 기반으로 동작해야 합니다. DB 마이그레이션에 `parent_task_id` 추가를 명시적으로 포함해야 합니다.
> - **순환 참조 주의**: `CategoryTaskService.js`가 `database.js`를 import하고, `database.js`가 다시 Service를 import하면 순환 참조 발생. **단방향 의존성 원칙**: CategoryTaskService → database.js(단방향)만 허용.

### 2-2. [Context Layer] TASK_MASTER 전용 Tool Spec 
**파일**: `01_아리_엔진/ai-engine/tools/contextInjector.js`

1. **`buildAutoRunContext` 수정**: 
   - `mode === 'TASK_MASTER'` 분기 내의 Available Tools 목록에 기존 4개 외 **신규 5개 도구 추가**.
     - `create_category_tasks`
     - `add_comment`
     - `read_comments`
     - `update_card_status`
     - `get_next_task`
2. **보안 차단 (P-001)**: `mode` 파라미터가 `DEV`, `QA`, `DEBUG`일 경우에는 위 5개의 도구 스펙이 출력되지 않아 에이전트들의 오사용을 원천 방지합니다.

> [소넷] 2-2는 F-2, F-3 해소의 핵심입니다. 구현 시 주의사항:
> - **Tool Spec 형식 일관성**: 기존 `contextInjector.js` L327의 Tool Spec 형식(JSON Schema 또는 텍스트 설명 방식)을 그대로 따를 것. 형식이 다르면 LLM이 신규 Tool을 인식하지 못할 수 있음.
> - **`ariDaemon.js` 동기화**: contextInjector는 `server.js`, `ariDaemon.js`, `executor.js` 3곳에서 import됩니다. 수정 후 ariDaemon.js의 컨텍스트 빌드 경로도 TASK_MASTER 모드를 정상 수신하는지 확인 필요.

### 2-3. [Tool Layer] 신규 MCP 도구 핸들러 및 가드 연동
**파일**: `01_아리_엔진/ai-engine/tools/toolExecutor.js`

1. **라우팅 추가**: 5개의 도구명에 대해 각 핸들러로 매핑.
2. **F-1 프롬프트 인젝션 방어**:
   - `read_comments`와 `get_next_task`는 기존 코멘트나 카드 본문(사람이 작성했을 가능성 존재)을 읽어오는 도구입니다.
   - LLM 반환 전 `promptInjectionGuard.sanitizeInput(content)`을 무조건 통과시킨 결과값을 `executeTool`의 응답으로 줍니다.

> [소넷] 2-3 구현 시 추가 고려사항:
> - **`create_category_tasks`도 Injection 방어 대상**: 카드 title/content 파라미터도 Task Master가 AI로 생성하지만, 앞서 카드 본문을 읽은 컨텍스트가 오염되어 있을 수 있습니다. **5개 Tool 전체의 사용자 유래 텍스트 파라미터**에 sanitize를 적용하는 것을 권장합니다 (F-1 기획서 원문 준수).
> - **`update_card_status` 허용 상태값 화이트리스트**: 임의 문자열이 status 컬럼에 들어가지 않도록 `['DONE', 'BLOCKED', 'IN_PROGRESS', 'REVIEW']` 등 허용 값 목록을 toolExecutor 내부에서 검증하는 가드 추가 권장.

### 2-4. [Execution Layer] 코멘트 핑퐁 자율 루프
**파일**: `01_아리_엔진/ai-engine/executor.js`

1. **Phase 분리 로직 (2-Phase 호출 시퀀스)**:
   - `autoRun(projectId, agentId, startingTaskId)` 시작 시 `currentTaskId`가 대상이 됩니다.
   - **현재 `executor.js` L1175는 `buildAutoRunContext(taskData)`를 `mode` 인자 없이 호출하여 항상 `'DEV'`로 실행됩니다.** 이를 아래 2-phase 시퀀스로 교체합니다:

   ```javascript
   // Phase 1: Task Master (카드 분기)
   const planCtx = contextInjector.buildAutoRunContext(taskData, 'TASK_MASTER');
   // → LLM 호출 → create_category_tasks 실행 → PLAN_COMPLETE 확인
   // → Dry-Run 프리뷰 → 사용자 승인 대기 (await confirmGate)

   // Phase 2: Developer (각 자식 카드 순차 실행)
   const childCards = await dbManager.getChildTasks(parentTaskId);
   for (const child of childCards) {
     const devCtx = contextInjector.buildAutoRunContext(
       { title: child.title, description: child.content }, 'DEV'
     );
     // → 코멘트 핑퐁 루프 (MAX_ITERATIONS 카드별 독립 적용)
   }
   ```

   - **BRANCHING 모드 진입 조건**: 카드의 `execution_mode === 'BRANCHING'`일 때만 Phase 1을 실행. 그 외에는 기존 Single Card 루프(`'DEV'` 직행)를 유지하여 regression 방지.

2. **대분류 순차 루프 (M-4 해소)**:
   - `create_category_tasks` 완료 후, 생성된 자식 카드 목록을 조회.
   - `for` 문을 통해 각 카드별로 루프 시작. (병렬 확장을 고려하되 이번엔 순차 `await` 대기)
3. **루프 통제 및 상태 전이 (F-4 해소)**:
   - `MAX_ITERATIONS = 20` 글로벌 카운터와 `consecutive_errors = 3` 제한 적용.
   - 각 자식 카드 내부 루프는 코멘트 작성을 통해 `DONE`을 주고받습니다.
   - 모든 자식 카드 `DONE` ➡️ 원본 카드 `DONE`.
   - 한 개라도 `BLOCKED` 발생 ➡️ 즉시 `break` 및 원본 카드 `BLOCKED`.
   - `activeAutoRuns` 격리 키는 기존과 동일하게 `projectId` 단위로 유지하여 타 프로젝트 오토런과 무관하게 동작.

> [소넷] 2-4는 루프 설계의 핵심입니다. 세 가지 주의사항:
> 1. **`MAX_ITERATIONS` 스코프 명확화**: 이 카운터는 **카드 하나의 내부 루프** 기준인지, **전체 자식 카드 합산** 기준인지 명시가 필요합니다. 예를 들어 카드 3장이 각각 20회 반복 허용이면 최대 60턴이 됩니다. 권장: 카드별 독립 카운터(각 10회) + 전체 합산 캡(30회) 이중 적용.
> 2. **Dry-Run 승인 게이트 위치**: `autoRun` 함수 내에서 `create_category_tasks` 호출 **전에** Dry-Run 프리뷰를 반환하고 일시 정지하는 `await` 포인트가 필요합니다. 백엔드가 프리뷰 JSON을 API 응답으로 반환하면, 프론트가 확인 후 `/api/tasks/:id/run/confirm` 같은 2단계 엔드포인트를 호출하는 흐름으로 설계할 것을 권장합니다.
> 3. **기존 Single Card 로직 백업**: 계획서에 "기존 Single Card 로직 백업 후 교체"가 명시되어 있습니다. 교체 후 일반 DEV 오토런(대분류 없이 카드 1장 직접 실행)도 여전히 작동해야 합니다. TASK_MASTER 모드 진입 조건을 명확히 분기할 것 — 예: 카드에 `execution_mode: 'BRANCHING'` 필드가 있을 때만 분기, 나머지는 기존 Single Card 루프 유지.

---

## 3. 진행 순서 및 검증 포인트

0. **[선행] `migrations/014_phase43-5_category_tasks.sql` 작성** 및 `db_migrator.js` 실행하여 스키마 적용 확인.
1. `services/` 디렉토리 신설 → `CategoryTaskService.js` 작성 → DB 모듈 순환 참조 방지 점검.
2. `contextInjector.js` 및 `toolExecutor.js` 업데이트 → `test_autorun.js` 샌드박스로 Tool Spec 파싱/가드 연동 검증. `ariDaemon.js`도 TASK_MASTER 모드 정상 수신 확인.
3. `executor.js`의 `autoRun` 코어 개편 (기존 Single Card 로직 백업 후 교체). **일반 DEV 오토런 regression 테스트 필수.**
4. **Dry-Run 프리뷰 API 계약 문서화**: FE-2-4에 정의된 엔드포인트(`/run`, `/run/confirm`, `/run/revise`) 응답 형태를 `server.js`에 구현하고 소넷과 계약 확정.
5. 백엔드 배포 및 터미널 출력(Log)을 통한 1차 무결성 확보 후, 소넷(프론트엔드)에게 배턴 터치.

> [소넷] 검증 순서에 추가 권장:
> - **Step 1 후**: `db_migrator.js` 실행하여 `parent_task_id` 컬럼 마이그레이션 확인.
> - **Step 2 후**: `contextInjector.js` 변경으로 `ariDaemon.js`도 영향받는지 smoke test 필수.
> - **Step 3 후**: 일반 DEV 오토런(기존 Single Card)이 regression 없이 동작하는지 기존 `test_autorun.js` 케이스로 재확인.
> - **Step 4 전**: `server.js` L3839의 Dry-Run 승인 게이트 2단계 엔드포인트(`/confirm`)가 존재하는지 확인. 없으면 백엔드 배턴 전 반드시 추가.

---

---

# [Phase 43-6-FE] Task Master 업무 분기 — 프론트엔드 개발 계획서

**담당**: 소넷 (Claude Sonnet 4.6)  
**선행 조건**: 백엔드(루카) Step 1~4 완료 및 API 계약 확정 후 착수  
**목적**: 백엔드가 제공하는 Dry-Run 프리뷰 API와 상태 전이 이벤트를 기반으로, 사용자가 Task Master의 카드 분기 계획을 검토·승인하고 실시간으로 진행 상황을 확인할 수 있는 UI를 구현.

---

## FE-1. 개요 및 설계 원칙

* **담당 파일 범위**: `03_워크스페이스_대시보드/src/` 내 컴포넌트 및 스토어
* **핵심 원칙**:
  - 소켓(`io.emit`) 이벤트는 상태 표시 업데이트 용도로만 구독. UI 트리거 로직은 REST API 호출 기반.
  - 백엔드 API 응답 형태가 확정될 때까지 목업(mock) 데이터를 사용하여 컴포넌트 먼저 개발.
  - 기존 `TaskDetailModal.jsx`와 `useAgentStore`의 구조를 최대한 유지하고 최소 침습적으로 확장.

---

## FE-2. 세부 개발 범위

### FE-2-1. Dry-Run 프리뷰 UI 컴포넌트

**파일**: `src/components/Modal/CategoryPreviewModal.jsx` (신규)

| 요소 | 설명 |
|------|------|
| **프리뷰 카드 목록** | 백엔드가 반환한 `previewCards[]` 배열을 렌더링. 카테고리별 아이콘, 태스크 수 표시. |
| **[✅ 승인] 버튼** | `POST /api/tasks/:id/run/confirm` 호출 → 실제 카드 생성 시작 |
| **[✏️ 수정] 버튼** | 자연어 피드백 입력창(`<textarea>`) 오픈. 입력 후 Task Master에게 재분석 요청(`POST /api/tasks/:id/run/revise`). 응답으로 새 프리뷰 수신 후 동일 모달 갱신. |
| **[❌ 취소] 버튼** | 파이프라인 종료. 원본 카드 상태 복원(백엔드 처리). |

> 피드백 재분석은 루프 횟수 제한 없이 사용자가 만족할 때까지 반복 가능. 단, 연속 5회 이상 수정 시 "재분석 횟수가 많습니다. 계속하시겠습니까?" 안내 문구 표시 권장.

### FE-2-2. TaskDetailModal 확장

**파일**: `src/components/Modal/TaskDetailModal.jsx` (기존 파일 확장)

1. **BRANCHING 모드 감지**: 카드의 `execution_mode === 'BRANCHING'`일 때 기존 Auto Run 버튼 대신 **"Task Master 분기 실행" 버튼** 표시.
2. **Dry-Run 트리거**: 버튼 클릭 시 `POST /api/tasks/:id/run { mode: 'BRANCHING' }` 호출 → 응답(`previewCards`)으로 `CategoryPreviewModal` 오픈.
3. **자식 카드 진행 상황 섹션**: 대분류 카드가 생성된 이후, 모달 하단에 자식 카드 목록과 각각의 상태(`IN_PROGRESS`, `DONE`, `BLOCKED`)를 표시하는 **미니 칸반 뷰** 추가.
   ```
   ┌───────────────────────────────────┐
   │ 🔄 Backend    [IN_PROGRESS]  4/7  │
   │ ✅ Architecture [DONE]       3/3  │
   │ ⏸️ Frontend   [WAITING]      -    │
   └───────────────────────────────────┘
   ```

### FE-2-3. 소켓 이벤트 구독 (상태 표시)

**파일**: `src/stores/useAgentStore.js` 또는 `src/components/Modal/TaskDetailModal.jsx`

백엔드에서 발행하는 소켓 이벤트 구독 (표시 전용, 트리거 용도 금지):

| 이벤트명 | 처리 |
|---------|------|
| `task:category_card_created` | 자식 카드 목록 갱신 |
| `task:comment_added` | 해당 자식 카드의 코멘트 실시간 추가 |
| `task:status_updated` | 자식 카드 상태 배지 갱신 |
| `task:branching_completed` | 원본 카드 상태 DONE 처리 + 완료 토스트 |
| `task:branching_blocked` | BLOCKED 알림 + 원인 코멘트 하이라이트 |

### FE-2-4. API 계약 명세 (백엔드 확정 필요)

아래 엔드포인트는 소넷이 개발 전 루카에게 응답 형태를 확인해야 합니다:

```typescript
// Dry-Run 프리뷰 요청
POST /api/tasks/:id/run
Body: { mode: 'BRANCHING' }
Response: {
  status: 'preview',
  previewCards: [
    { category: 'backend', title: '...', taskCount: 4 },
    { category: 'frontend', title: '...', taskCount: 2 },
  ]
}

// 승인 후 실행
POST /api/tasks/:id/run/confirm
Response: { status: 'ok', childTaskIds: ['123', '124', '125'] }

// 수정 요청
POST /api/tasks/:id/run/revise
Body: { feedback: 'Backend 카드를 두 개로 나눠줘' }
Response: { status: 'preview', previewCards: [...] }  // 재렌더링
```

---

## FE-3. 진행 순서 및 검증 포인트

1. **API 계약 확정**: 루카로부터 엔드포인트 응답 형태(위 명세 기준) 최종 확인.
2. **`CategoryPreviewModal.jsx` 목업 개발**: 백엔드 없이 mock 데이터로 UI 완성.
3. **`TaskDetailModal.jsx` 확장**: BRANCHING 모드 감지 + 자식 카드 미니 칸반 뷰 추가.
4. **소켓 이벤트 연동**: 백엔드와 연결하여 실시간 상태 업데이트 테스트.
5. **E2E 검증**: 승인 → 카드 생성 → 루프 실행 → DONE 전파 전체 흐름 UI 확인.

---

## FE-4. 프론트 담당자(소넷)에게 — 작업 시작 체크리스트

- [ ] 루카로부터 API 계약 명세(FE-2-4) 확정 수령
- [ ] `agents.json`에서 `dev_ux` ID 존재 확인 (P-001)
- [ ] `useAgentStore` 또는 소켓 구독 위치 결정 (기존 구조 침습 최소화)
- [ ] 기존 `PlanMasterModal.jsx` 패턴 참조 (유사한 다단계 승인 플로우)
- [ ] 완료 후 백엔드(루카)에게 소켓 이벤트명 최종 동기화

---

## 4. 백엔드 구현 및 QA 완료 보고 (루카)
*2026-05-16 백엔드 구현 및 QA 검증 완료*

1. **Dry-Run API 및 루프 연동 (✅ 통과)**: 
   - `POST /api/tasks/:id/run` (mode: `BRANCHING`) 동기식 프리뷰 생성 및 `execution_plans` 저장 구현 완료.
   - `POST /api/tasks/:id/run/confirm` 자식 카드 트랜잭션 기반 생성 및 `forceRedispatchTask` Developer 파이프라인 트리거 연동 완료.
   - `POST /api/tasks/:id/run/revise` 피드백 반영 구조 재분할 API 구현 완료.
2. **Graphify 인프라 복구 (✅ 해결)**:
   - Python `pipx` 바이너리 전역 경로 인식 불가 이슈를 `/Users/alex/.local/bin/graphify` 절대 경로 패치로 해결하여 정적 분석(AST 업데이트/쿼리) 파이프라인 안정화.
3. **보안 가드레일 & Executor 시뮬레이션 (✅ 통과)**:
   - `test_autorun.js` 기반 35개 시나리오(루프 제어, Max Steps 제한, Escape Hatch 등) 전면 통과.
   - 신규 `TASK_MASTER` 도구에 `promptInjectionGuard` 탑재 및 모드 격리 작동 확인 완료.

> 프론트엔드 담당자(소넷)는 본 문서를 확인 후 `CategoryPreviewModal.jsx` UI 개발 및 E2E 연동에 바로 착수할 수 있습니다.

---

*백엔드 구현/QA: 루카 (Gemini) | 프론트엔드: 소넷 (Claude Sonnet 4.6) | Phase 43-6 | 최종 업데이트: 2026-05-16*
