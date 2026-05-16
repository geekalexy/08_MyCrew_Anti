# Supreme Review #57 — Phase 43-5 Task Master 업무 분기 보강 기획서

**리뷰어**: Prime (Claude Sonnet 4.6 Thinking)  
**리뷰 대상**: `Phase43_5_Task_분기_보강기획서.md`  
**최초 리뷰**: 2026-05-16  
**최종 업데이트**: 2026-05-16  
**이전 리뷰**: `55_Phase43-4_AutoRun_v12_SupremeReview_Prime_2026-05-16.md` (Phase 43-4 기준)

---

## 📋 리뷰 이력 (Revision Log)

| 회차 | 대상 버전 | 등급 | 결함 | 비고 |
|------|----------|------|------|------|
| v1 | PRD v1.1 | 미판정 | HIGH 3 + MED 1 + LOW 2 + INFO 1 | 초회 리뷰 |
| v2 | PRD v1.1 (재검증) | 🔴 C | HIGH 4 + MED 1 + LOW 2 + INFO 1 | F-7 신규 발견 (agents.json 미등록 ID) |
| **v3** | **PRD v1.2** | **🟢 A** | **LOW 1** | **F-1~F-5, F-7 전건 해소. F-6(Future Scope) 잔여.** |

---

# [v3] 최종 검증 — PRD v1.2 (🟢 등급 A)

## STEP 수행 요약

- STEP 0: POLICY_INDEX.md (last_updated 2026-05-05), strategic_memory.md 읽음 ✅
- STEP 1: contextInjector.js, executor.js, toolExecutor.js, database.js, agents.json 5개 파일 직접 확인 ✅
- STEP 2: god_nodes(), get_neighbors(Executor), query_graph() 3회 Graphify 호출 ✅

## 결함 해소 매트릭스

| # | 심각도 | 결함 | v1→v2 | v2→v3 | 해소 근거 (PRD v1.2 라인) |
|---|--------|------|-------|-------|--------------------------|
| F-1 | 🔴 HIGH | `get_next_task` PI 방어 미명시 | ❌ | ✅ | L180: 모든 신규 Tool 반환값에 `sanitizeInput()` 적용 |
| F-2 | 🟠 MED | `create_category_tasks` 권한 가드 미정의 | ❌ | ✅ | L181: TASK_MASTER Tool Spec에만 등록, DEV/QA 차단 |
| F-3 | 🔴 HIGH | TASK_MASTER Tool Spec 5개 누락 | ❌ | ✅ | L181: contextInjector.js에 등록 구현 지시 명시 |
| F-4 | 🔴 HIGH | 원본 ↔ 대분류 카드 상태 연동 미정의 | ⚠️ 부분 | ✅ | L208-213: 5-5절 신설 (DONE전파/BLOCKED전파/수동중단) |
| F-5 | 🟡 LOW | Dry-Run 수정 버튼 동작 미정의 | ❌ | ✅ | L72: 자연어 피드백 재분석 루프 명시 |
| F-6 | 🟡 LOW | 서버 재시작 시 루프 복구 없음 | ❌ | ⚠️ | Future Scope 허용. 기존 좀비 복구 훅 패턴으로 흡수 가능 |
| F-7 | 🔴 HIGH | `dev_architect/frontend/infra` agents.json 미등록 | 🆕 | ✅ | L87-97: 기존 등록 ID로 재매핑 |
| W-1 | ℹ️ INFO | 에이전트 모델 매핑 시 modelRegistry 참조 권장 | — | — | 구현 시 반영 |

**구현 착수 전 필수 해결: 0건**

---

# [v2] 재검증 — PRD v1.1 (🔴 등급 C)

> v1에서 지적한 F-1~F-4 필수 해결 4건 중 0건이 보강되지 않은 상태를 확인. 신규 F-7 발견.

### 🆕 F-7 — `CATEGORY_AGENT_MAP` 미등록 ID 3건

PRD v1.1의 `CATEGORY_AGENT_MAP`에서 사용한 3개 에이전트 ID가 `agents.json`에 존재하지 않음:

| PRD 지정 ID | agents.json | 상태 |
|-------------|:-----------:|------|
| `dev_architect` | ❌ | 미등록 → `dev_senior`로 Fallback되어 전문성 분기 무력화 |
| `dev_frontend` | ❌ | 미등록 → `dev_senior`로 Fallback |
| `dev_infra` | ❌ | 미등록 → `dev_senior`로 Fallback |

코드 근거: `agents.json` grep 결과 — `dev_fullstack`, `dev_ux`, `dev_senior`, `dev_backend`, `dev_qa`, `dev_advisor`, `dev_pm`만 등록.

---

# [v1] 초회 리뷰 — PRD v1.1 (미판정)

## STEP 수행 기록

- STEP 0: POLICY_INDEX.md, strategic_memory.md 읽음
- STEP 1: `contextInjector.js` (391줄), `executor.js` (L260~L1059) 직독
- STEP 2: god_nodes(), get_neighbors(ContextInjector), get_neighbors(DatabaseManager) 3회 호출

### 🔴 GOD NODE 경보: DatabaseManager (84 엣지)

신규 MCP Tool 5개는 모두 DatabaseManager를 경유. 별도 `CategoryTaskService.js` 분리 권장.

### 결함 상세 (F-1 ~ F-6, W-1)

**F-1 (HIGH) — `get_next_task` Prompt Injection 방어 미명시**
- 카드 본문(사용자 작성)이 Task Master 프롬프트에 직접 주입됨
- `promptInjectionGuard` 적용 지점 불명확

**F-2 (MEDIUM) — `create_category_tasks` 권한 가드 미정의**
- "Task Master 전용"이라고만 명시, 시스템 레벨 차단 메커니즘 없음
- contextInjector Tool Spec 제외 또는 toolExecutor 모드 체크 필요

**F-3 (HIGH) — `buildAutoRunContext(TASK_MASTER)` 신규 Tool 미등록**
- 현재 Tool Spec: `save_execution_plan`, `grep_search`, `query_graph`, `ask_user` 4개만
- 신규 5개(`create_category_tasks` 등) 미등록 → LLM이 인지 불가

**F-4 (HIGH) — 원본 ↔ 대분류 카드 상태 연동 미정의**
- 전체 DONE 시 원본 카드 상태 전이? 1장 BLOCKED 시 원본 상태?
- 수동 중단 시 일괄 처리 방법?

**F-5 (LOW) — Dry-Run `[✏️ 수정]` 버튼 동작 미정의**
- 재분석 요청인지 인라인 편집인지 불명확

**F-6 (LOW) — 서버 재시작 시 루프 복구 전략 없음**
- `activeAutoRuns` Map은 메모리 → 재시작 시 초기화 → 좀비 IN_PROGRESS 카드

**W-1 (INFO) — 에이전트 모델 매핑 시 `modelRegistry.js` 참조 명기 권장**

---

*Supreme Review #57 | Phase 43-5 | 리뷰 3회차 통합본 | 2026-05-16*
