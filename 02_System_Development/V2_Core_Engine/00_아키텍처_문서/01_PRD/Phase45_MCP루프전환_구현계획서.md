# Phase 45 — MCP 루프 전환 구현계획서

> 작성자: 소넷 (Sonnet)  
> 작성일: 2026-05-16  
> 근거 문서:  
> - PRD: `01_PRD/Phase45_MCP_루프전환_현황점검_및_설계PRD.md`  
> - Prime Review: `06_리뷰_아카이브/58_Phase45_MCP루프전환_SupremeReview_Prime_2026-05-16.md`  
> - Luca Supreme Review: `06_리뷰_아카이브/60_Phase45_구현계획서_SupremeReview_Luca_2026-05-16.md`  
> 상태: **✅ Luca 리뷰 반영 완료 — 구현 착수 가능 (PRE-1~3 선결 후)**

---

## 1. 구현 전 선결 사항 (착수 금지 — 해결 먼저)

> [!IMPORTANT]
> 아래 2건이 해결되기 전까지 `/code` 모드 전환 및 코드 수정 금지 (P-020).

| # | 항목 | 파일 | 조치 |
|---|------|------|------|
| **F-1** | `server.js` L3576 하드코딩 모델 식별자 `'anti-claude-sonnet-4.6-thinking'` | `server.js` | → **`MODEL.ANTI_SONNET_THINK`** 상수로 교체 (P-006) ⚠️ `MODEL.SONNET`은 `'claude-sonnet-4-6'`(로컬 호출)이므로 사용 금지 — Luca 정정 |
| **F-2** | `contextInjector.js`에 `PLAN_MASTER` 모드 미존재 (`TASK_MASTER`만 있음) | `contextInjector.js` | → `PLAN_MASTER` 분기 신설 또는 `TASK_MASTER`로 통합 결정 |
| **F-5** | `qaLoop.js`, `debugLoop.js`, `CategoryTaskService.js` Graphify 미등록 | 그래프 | → `graphify update .` 실행 |

---

## 2. 구현 트랙 구성

```
Phase 45-A  qaLoop / debugLoop 실체화        ← 최우선
Phase 45-B  plan_master God Route 제거        ← 차순위
Phase 45-C  소켓 의존 제거                    ← 독립 PR (별도 스프린트)
```

---

## 3. 상세 태스크 리스트

### ✅ [사전] 선결 사항 (착수 전 완료 필수)

- [ ] **PRE-1** `graphify update .` 실행 — qaLoop, debugLoop, CategoryTaskService 그래프 등록
- [ ] **PRE-2** `server.js` L3576 모델 식별자 → `MODEL.ANTI_SONNET_THINK` 교체
  - ⚠️ `MODEL.SONNET` 사용 금지 (`'claude-sonnet-4-6'` = 로컬 직접 호출 → Antigravity 브릿지 미거침)
  - ✅ 정정 확정: `MODEL.ANTI_SONNET_THINK` = `'anti-claude-sonnet-4.6-thinking'` (Luca 리뷰 #60)
- [ ] **PRE-3** `contextInjector.js` — `PLAN_MASTER` 모드 분기 신설/통합 결정 후 구현

---

### 🔴 Phase 45-A: qaLoop / debugLoop 실체화

> **목표**: 3초 setTimeout 더미 코드를 실제 MCP Tool Call 루프로 교체

#### A-1. `contextInjector.js` QA/DEBUG 모드 추가
- [ ] `buildAutoRunContext(taskData, 'QA')` — QA 페르소나 + 허용 Tool 목록 추가
  - 허용 Tool: `get_task_context`, `add_comment`, `update_card_status`, `run_browser_test`
- [ ] `buildAutoRunContext(taskData, 'DEBUG')` — DEBUG 페르소나 + 허용 Tool 목록 추가
  - 허용 Tool: `get_task_context`, `add_comment`, `update_card_status`, `read_error_log`
- [ ] 기존 DEV 모드 오토런 오염 방지 — 모드별 Tool 허용 목록 격리 검증 (Luca 권고)

#### A-2. `qaLoop.js` 재작성
- [ ] 미사용 `import { executeTool }` 제거 (F-3)
- [ ] 루프 골격 구현:
  ```
  contextInjector.buildAutoRunContext(task, 'QA')
    → executor.runWithTools()
    → AI가 MCP Tool 호출:
        get_task_context(taskId)
        add_comment(taskId, "QA 시작...")
        run_browser_test(url, selectors)   ← Phase 46에서 실제 연동 (현 단계: stub)
        add_comment(taskId, "결과: ✅/❌")
        update_card_status(taskId, 'QA_DONE' | 'QA_FAILED')
  ```
- [ ] 루프 종료 조건: `QA_DONE` 또는 `MAX_ITERATIONS = 10`
- [ ] **좀비 복구 안전망** (Luca 권고): `server.js` 구동 시 `QA_RUNNING` 상태 카드 → `QA_FAILED` / `PENDING` 강제 복구 로직 추가
- [ ] ~~`qaLoop.js` 내부에서 `promptInjectionGuard.sanitizeInput()` 호출~~ → **❌ 변경: 루프 내부 호출 금지**
- [ ] **[Luca 리뷰 반영]** `executor.js`의 `runWithTools()` 진입점에서 **단 1회** `promptInjectionGuard.sanitizeInput()` 호출
  - 이유: 루프별 개별 구현 시 `debugLoop`, DEV 모드 등 다른 루프에서 검증 누락 위험 (F-03)

#### A-3. `debugLoop.js` 재작성
- [ ] `qaLoop.js`와 동일 패턴 적용
- [ ] DEBUG 전용 Tool (`read_error_log`, `trace_stack`) stub 추가

#### A-4. 상태 전이 검증
- [ ] `QA_RUNNING` → `QA_DONE` | `QA_FAILED` 전이 DB 반영 확인
- [ ] `DEBUG_RUNNING` → `DEBUG_DONE` | `DEBUG_FAILED` 전이 확인

---

### 🟠 Phase 45-B: plan_master God Route 제거

> **목표**: `server.js` L3532~L3732 (~200줄) 블로킹 while 루프 → executor 위임

#### B-1. 선결 사항 확인
- [ ] PRE-3 (`PLAN_MASTER` 모드) 완료 확인 후 착수

#### B-2. `contextInjector.js` PLAN_MASTER 모드 완성
- [ ] 허용 Tool 등록:
  - `analyze_scope`, `make_roadmaps`, `confirm_mvp`, `add_comment`
- [ ] P-020: 카드 생성은 `confirm_mvp` Tool 내부에서만 — Dry-Run 프리뷰 반환 후 사용자 승인 필수
- [ ] **idempotency guard**: `/confirm` 연속 클릭 시 중복 카드 생성 방지 (Prime 권고)
  - 서버 측 1회 실행 플래그 또는 DB unique constraint 활용

  > 💡 **[Luca 리뷰 — UX/사용자 흐름 MEDIUM]** Idempotency Guard가 백엔드 층위에 있으나, 사용자가 버튼을 눌렀을 때의 인지적 피드백(버튼 Disabled, 스피너 렌더링)에 대한 프론트엔드 연동 계획이 누락되었습니다. 카드가 생성 완료(`IN_PROGRESS`)될 때까지 UI 차단 및 로딩 표시 처리를 태스크에 추가할 것을 권장합니다.

#### B-3. `server.js` God Route 제거
- [ ] `POST /api/projects/:id/plan-master/analyze` — while 루프 → `executor.runDirect()` 호출로 교체
  - **응답을 `202 Accepted` 즉시 반환** (Luca 권고 — 동기 대기 금지)
- [ ] `POST /api/projects/:id/plan-master/generate-roadmaps` — 동일 패턴 적용
- [ ] `POST /api/projects/:id/plan-master/confirm` — DB 상태 변경 로직만 유지 (존속)
- [ ] `try-catch-finally` 블록 점검 — DB 커넥션 릴리스 누락 없는지 확인 (Luca 권고)
- [ ] `io.emit('plan-master:trigger')` 소켓 이벤트 → HTTP 응답 전환
- [ ] `io.emit('plan-master:thought_update')` → SSE 또는 DB 폴링 방식으로 대체

#### B-4. 프론트엔드 대응 (최소 범위)
- [ ] `POST /analyze` 응답이 `202 Accepted`로 바뀜에 따른 프론트 비동기 처리 추가
  - **[Luca 리뷰 F-01 반영] 임시 DB 폴링 방식 필수 적용** (Phase 46 SSE 완성 전까지)
    - `TaskDetailModal` 또는 `chatStore`에서 `/api/tasks/:id/status` 폴링(2초 간격) 추가
    - Phase 46-A SSE 파이프라인 완성 후 폴링 → SSE 구독으로 교체
  - ⚠️ 소켓 제거(Phase 45-C) 전 DB 폴링 배포 필수 — 미이행 시 UI 무한 대기(Deadlock) 발생

#### B-5. 상태 고착 방지 (Prime 권고)
- [ ] `PLANNING` 상태 타임아웃 자동 `FAILED` 전이 로직 추가
  - 권장: 30분 이상 `PLANNING` 유지 시 자동 실패 처리

---

### 🟡 Phase 45-C: 소켓 의존 제거 (독립 PR)

> [!WARNING]
> `useSocket()` 은 God Node #7 (23 edges). 독립 PR로 분리 필수.  
> **Phase 45-A/B 완료 및 Supreme Review 통과 후 착수.**

#### C-0. 사전 매핑 작성 (코딩 전 필수)
- [ ] `useSocket()` 의존 컴포넌트 전체 목록화:
  - `App.jsx`, `Column.jsx`, `KanbanBoard.jsx`, `LogDrawer.jsx`, `TaskDetailModal()`
  - 6개 스토어: kanbanStore, agentStore, chatStore, timelineStore, projectStore, uiStore
- [ ] 각 소켓 이벤트별 대체 방식 결정 테이블 작성

#### C-1. plan-master 소켓 이벤트 제거
- [ ] `plan-master:trigger` → HTTP 응답 직접 처리로 대체
- [ ] `plan-master:thought_update` → SSE 또는 DB 폴링

#### C-2. QA 상태 소켓 이벤트 검토
- [ ] `task:qa_status_update` — DB 상태 변경만으로 충분한지 검토
- [ ] 충분하면 소켓 제거, 불충분하면 SSE 대체

#### C-3. 단계적 컴포넌트 의존 제거
- [ ] `App.jsx` → `KanbanBoard.jsx` → `TaskDetailModal.jsx` 순서로 순차 제거

---

## 4. 파급 반경 (Blast Radius) 요약

| 파일 | 변경 유형 | 영향도 |
|------|-----------|--------|
| `qaLoop.js` | 전면 재작성 | 🔴 직접 |
| `debugLoop.js` | 전면 재작성 | 🔴 직접 |
| `contextInjector.js` | QA/DEBUG/PLAN_MASTER 모드 추가 | 🔴 직접 (기존 DEV 모드 격리 필수) |
| `server.js` L3532~L3732 | ~200줄 God Route 제거 | 🟠 대규모 |
| `server.js` L3576 | 모델 식별자 1줄 교체 | 🟢 단순 |
| `useSocket.js` | Phase 45-C에서 의존 제거 | 🔴 God Node — 독립 PR |
| `executor.js` | `runDirect()` 호출 추가 | 🟡 경미 |

---

## 5. 완료 검증 기준

### Phase 45-A 완료 조건
- [ ] QA 모드 실행 시 실제 AI 호출 + `add_comment` Tool 로그 확인
- [ ] `QA_DONE` / `QA_FAILED` 상태 카드가 DB에 정상 기록됨
- [ ] 서버 재시작 후 `QA_RUNNING` 좀비 카드 자동 복구 확인

### Phase 45-B 완료 조건
- [ ] `POST /analyze` 응답 시간 < 200ms (202 즉시 반환)
- [ ] ARCHITECT 모드 실행 시 AI가 `analyze_scope` Tool 호출 로그 확인
- [ ] Dry-Run 프리뷰 → 승인 → 카드 생성 플로우 정상 동작
- [ ] `/confirm` 연속 클릭 시 카드 중복 생성 없음

### Phase 45-C 완료 조건
- [ ] `useSocket()` 직접 구독 컴포넌트 0개
- [ ] plan_master 및 QA 흐름이 소켓 없이 정상 동작

---

## 6. 구현 순서 (최종 확정 — Luca 리뷰 반영)

```
[PRE-1] graphify update .                         ← qaLoop 등 그래프 등록
[PRE-2] server.js L3576 → MODEL.ANTI_SONNET_THINK  ← P-006 정정 (5분)
[PRE-3] contextInjector.js PLAN_MASTER 분기 신설   ← 모드 결정 후 구현
[PRE-4] executor.js runWithTools() 진입점에         ← F-03: 인젝션 가드
         promptInjectionGuard.sanitizeInput() 추가

↓ 선결 완료 후 /code 모드 전환

[A-1] contextInjector QA/DEBUG 모드 페르소나 추가
[A-2] qaLoop.js 재작성 (더미 코드 → 실제 MCP Tool 루프)
[A-3] debugLoop.js 재작성
[A-4] 상태 전이 + 좀비 복구 검증 (QA_RUNNING → QA_FAILED)

↓ Phase 45-A Supreme Review 통과 후

[B-0] 프론트엔드 DB 폴링 추가           ← F-01: 소켓 제거 전 임시 채널 확보 필수
[B-1~5] plan_master God Route 제거 + 202 응답 전환
[B-6] confirm_mvp 버튼 로딩 UI 처리     ← F-04: Idempotency Guard 프론트 연동

↓ Phase 45-B Supreme Review 통과 후

[C-0~3] 소켓 의존 제거 (독립 PR)        ← useSocket God Node, 별도 PR 필수

↓ Phase 45-C 완료 후

[Phase 46-A] SSE 파이프라인으로 DB 폴링 교체
```

---

## 7. 관련 문서

| 문서 | 경로 |
|------|------|
| Phase 45 PRD | `01_PRD/Phase45_MCP_루프전환_현황점검_및_설계PRD.md` |
| Prime Supreme Review | `06_리뷰_아카이브/58_Phase45_MCP루프전환_SupremeReview_Prime_2026-05-16.md` |
| Phase 46 PRD (후속) | `01_PRD/Phase46_UI_반응성_및_통신_아키텍처_개선_PRD.md` |
| POLICY_INDEX | `01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md` |

---

*작성: 소넷 | Phase 45 구현계획서 | 2026-05-16*
