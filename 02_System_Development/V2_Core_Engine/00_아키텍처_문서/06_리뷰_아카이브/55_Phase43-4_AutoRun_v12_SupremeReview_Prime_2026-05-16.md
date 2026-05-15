# 🛡️ Supreme Review — Phase43-4 Auto Run 보강기획 PRD v1.2

**리뷰어**: Prime (Claude Sonnet 4.6 Thinking)  
**리뷰 대상**: `Phase43-4_Auto_Run_보강기획_PRD.md` v1.2  
**리뷰 일시**: 2026-05-16  
**이전 리뷰**: `53_Phase43-4_AutoRun_SupremeReview_Prime_v2_2026-05-16.md` (D 등급), `54_Phase43-4_AutoRun_SupremeReview_Sonnet_v2_2026-05-16.md`

---

## STEP 0 ✅ — 정책 동기화 완료

- `POLICY_INDEX.md`: last_updated 2026-05-05 확인. STRICT 13건 + WARN 7건.
- `strategic_memory.md`: 모델 식별자 규칙, 아키텍처 v4.0 원칙 확인.

## STEP 1 ✅ — 코드 직접 읽기 완료

| 파일 | 확인 내용 |
|------|----------|
| `contextInjector.js` L295-367 | `buildAutoRunContext()` 현재 3모드(DEV/QA/DEBUG). **TASK_MASTER 분기 미존재** 확인. |
| `executor.js` L1126-1200 | `autoRun()` 함수: `MAX_STEPS=15`, `contextInjector.buildAutoRunContext()` 호출. **모드 인자 미전달**(기본값 DEV 적용). **`save_execution_plan` 핸들러 없음** 확인. |
| `scrubbing.js` L28-80 | `sanitize()` 함수: 회사명/인명/경쟁사명 마스킹 + URL 제거 + 숫자 범위화. **Prompt Injection 패턴(`[SYSTEM]`, `IGNORE PREVIOUS`) 탐지 0건** 확인. |
| `server.js` L467-490 | `forceRedispatchTask()`: L478에서 `fullTask.content`에만 `buildLinkedContext()` 적용. `additionalContext`는 **L482-489에서 raw 문자열로 직접 결합**, 체이닝 미적용 확인. |
| `database.js` | `execution_plans` 테이블, `saveExecutionPlan()` 메서드 **미존재** 확인. `PLANNING`/`PLAN_COMPLETE` 상태 **미존재** 확인. |

## STEP 2 ✅ — Graphify 분석 완료 (4회 호출)

| 호출 | 결과 |
|------|------|
| `god_nodes(top_n=10)` | DatabaseManager: 84 edges (#1). server.js/executor.js는 노드 레벨 아닌 파일 레벨이므로 God Node 목록 직접 미포함이나, `forceRedispatchTask()` → community 17, `buildLinkedContext()` → community 17에 위치. |
| `get_neighbors("ContextInjector")` | server.js, ariDaemon.js, executor.js 3곳에서 import. 메서드 7개 보유. **`buildAutoRunContext`가 Graphify에 미등재** — 내부 메서드로 취급 가능. |
| `query_graph("forceRedispatchTask buildLinkedContext")` | BFS depth=3, 23 nodes. `forceRedispatchTask()` → `broadcastLog()` calls 관계 확인. `buildLinkedContext()` → `imageAnalysisService.js` imports 확인. **`additionalContext`가 `buildLinkedContext`를 거치는 경로 없음** — 그래프에서도 확인. |
| `get_neighbors("ContextInjector")` 재호출 (label 보정) | 메서드 목록 정상 반환. |

**🔴 GOD NODE 경보**: `execution_plans` 테이블 신설은 **DatabaseManager(84 edges, #1 God Node)** 변경 필수. 격리 트랜잭션 + 마이그레이션 스크립트 우선 구현 필수.

---

## STEP 3 — 6개 렌즈 분석

### 🔒 렌즈 1: 보안 (Security)

#### ✅ GAP-S1 해소 확인 — `promptInjectionGuard.js` 전용 모듈 명시

PRD v1.2 L28:
> Prompt Injection 방지를 위해 전용 모듈(`promptInjectionGuard.js`)을 거쳐 악의적 프롬프트(`IGNORE PREVIOUS INSTRUCTIONS` 등)를 사전 차단(GAP-S1 해결).

**코드 대조**: `scrubbing.js`는 여전히 Anonymization 전용이며 변경되지 않았음(L28-80 확인). 그러나 PRD가 **`promptInjectionGuard.js` 신규 모듈 신설**을 명시적으로 지정했으므로, `scrubbing.js`와의 혼동 위험은 해소됨. ✅

**판정**: ✅ 해소. 단, 구현 시 `promptInjectionGuard.js`가 `scrubbing.js`와 **별도 모듈**로 생성되는지 검증 필요.

#### 🟡 신규 발견: W-001 — `promptInjectionGuard.js`의 적용 범위 미정의

PRD L28은 "태스크 카드 본문과 코멘트 데이터" 적재 시 가드를 적용한다고 했으나, **`buildLinkedContext()`가 로드하는 링크된 외부 문서**에도 가드를 적용해야 하는지 명시되지 않았습니다.

공격 벡터: 카드 본문은 안전하더라도, `@[external_doc.md]`로 링크된 문서에 `IGNORE PREVIOUS INSTRUCTIONS`가 포함되면 체이닝 후 주입됨.

**권장**: `buildLinkedContext()` 결과물 전체에 `promptInjectionGuard`를 적용한다는 한 줄 추가.

---

### 🏗️ 렌즈 2: 아키텍처 (Architecture)

#### ✅ GAP-A1 해소 확인 — `save_execution_plan` 구현 경로 명시

PRD v1.2 L100-102:
> `execution_plans` 테이블 신설 + `save_execution_plan` 도구 구현 + executor.js/contextInjector.js 등록

**코드 대조**: `executor.js`에 `save_execution_plan` 핸들러 미존재, `database.js`에 테이블 미존재를 **v2 리뷰에서 확인**했으며, PRD v1.2가 이를 구현 필수 사항으로 명시. ✅

#### ✅ GAP-A2 해소 확인 — 2-Phase 세션 분리 명시

PRD v1.2 L104-106:
> Task Master와 Developer는 동일한 LLM 세션을 공유하지 않습니다. 백엔드 서버가 **완전히 새로운 세션(New LLM Thread)**을 생성.

**코드 대조**: `executor.js` L1175에서 현재 `contextInjector.buildAutoRunContext()`를 1회 호출하고 단일 루프 진입. PRD는 이를 2단계로 분리하라고 명시. 설계 방향 정합. ✅

#### ✅ GAP-A3 해소 확인 — 코멘트 체이닝 구조적 결함 수술 명시

PRD v1.2 L117-121 (신설 4.5절):
> `forceRedispatchTask`에서 `additionalContext`도 `buildLinkedContext()`를 거치도록 로직 전면 수정

**코드 대조**: `server.js` L478에서 `fullTask.content`에만 적용, L482-489에서 `additionalContext`는 raw 결합 — **현재 코드와 PRD 목표 간 괴리가 정확히 진단되어 있음.** ✅

#### 🟡 신규 발견: W-002 — `executor.js` autoRun 루프 개편 범위 불명확

현재 `executor.js` L1126-1290의 `autoRun()` 함수는 **단일 루프 구조**입니다. PRD v1.2는 이것을 Task Master → Developer 2단계로 분리해야 하는데, 구체적으로:

- `autoRun()` 내부를 `runTaskMasterPhase()` + `runDeveloperPhase()`로 분리하는가?
- 아니면 `autoRun()`을 2회 순차 호출하는가?

**PRD에 "별도 `executor.run()` 호출"(소넷 권장)이라고만 되어 있고, `autoRun()` 함수 자체의 리팩토링 범위가 불명확합니다.**

**권장**: executor.js 내부에 `runTaskMasterPhase(taskId)` → `runDeveloperPhase(taskId, planJson)` 2개 함수를 신설하고, `autoRun()` 진입점에서 순차 호출하는 구조를 PRD에 1줄 추가.

---

### 🔄 렌즈 3: 상태 정합성 (State Consistency)

#### ✅ GAP-ST1 해소 확인 — PLANNING/PLAN_COMPLETE 상태 추가 명시

PRD v1.2 L109:
> `PLANNING`(계획 수립 중), `PLAN_COMPLETE`(수립 완료) 상태를 시스템에 추가 편입.

**코드 대조**: `database.js` L143에서 서버 시작 시 좀비 상태(`QA_RUNNING`, `DBG_RUNNING`)를 `FAILED`로 복구하는 훅이 있음. **`PLANNING` 상태에 대한 동일한 좀비 복구 로직 추가가 필요**하다는 점이 PRD에 미명시.

**판정**: ✅ 해소 (상태 추가 명시). 단, 구현 시 좀비 `PLANNING` 복구 로직 포함 필요 → W-003으로 기록.

#### ✅ GAP-ST2 해소 확인 — Fork 정책 폐기, 덮어쓰기+스냅샷 채택

PRD v1.2 L111:
> Phase 43의 "Fork 강제" 정책은 전면 폐기(Deprecated)하며, Phase 43-4의 "덮어쓰기(Overwrite) + 스냅샷 백업" 정책을 최종 공식 룰로 채택.

**판정**: ✅ 해소. 정책 단일화 명시.

#### 🟡 W-003 — `PLANNING` 상태 좀비 복구 로직 미명시

`database.js` L143:
```javascript
db.run(`UPDATE Task SET last_autorun_status = 'FAILED' WHERE last_autorun_status IN ('QA_RUNNING', 'DBG_RUNNING')`, ...);
```

서버 재시작 시 `PLANNING` 상태로 남아있는 카드도 `FAILED`로 복구해야 합니다. PRD에 미명시.

---

### 👤 렌즈 4: UX/사용자 흐름

#### ✅ GAP-UX1 해소 확인 — Planning 스피너 추가 명시

PRD v1.2 L110:
> 프론트엔드 모달에 "Planning..." 스피너를 추가하여 현재 AI가 원자적 태스크를 도출 중임을 사용자에게 시각적으로 안내.

**판정**: ✅ 해소.

#### 이상 없음 — UX 측면 추가 결함 미발견

Task Master 단계의 UI 투명성이 확보되고, 재실행 시 경고 모달(L42)도 유지. UX 관점에서 추가 혼란 요소 없음.

---

### ⚙️ 렌즈 5: 런타임 안정성 (Runtime Stability)

#### ✅ GAP-RT1 해소 확인 — Task Master Max Steps/타임아웃 명시

PRD v1.2 L114:
> Task Master 세션은 `max_steps=3`으로 하드 리밋. 타임아웃 30초 설정.

**코드 대조**: 현재 `executor.js` L1136의 `MAX_STEPS = 15`는 Developer 루프용. Task Master용 별도 상수가 필요하며, PRD가 `3`으로 명시. ✅

**Prime 의견**: `max_steps=3`은 적절합니다. Task Master는 ①코드베이스 조사 ②계획 수립 ③`save_execution_plan` 호출 — 3스텝이면 충분. 단, **타임아웃 30초는 LLM API 응답 시간(평균 10-20초)을 고려하면 너무 짧을 수 있음.** 3스텝 × LLM 1회 호출당 15초 = 최소 45초 필요. **60초 이상이 안전**.

**판정**: 🟡 W-004 — 타임아웃 30초 → 90초 이상 권장 (3스텝 × LLM 응답 30초 여유 고려)

#### ✅ GAP-RT2 해소 확인 — Fallback 정책 명시

PRD v1.2 L115:
> 강제로 개발 루프로 넘어가지 않고 상태를 `BLOCKED`로 전환한 뒤 사용자에게 개입을 요청.

**판정**: ✅ 해소. Developer 직접 실행 금지(계획 선행 강제 보호). 

---

### 📜 렌즈 6: 정책 준수 (Policy Compliance)

#### ✅ GAP-P1 해소 확인 — 시스템 레벨 도구 차단 명시

PRD v1.2 L106:
> API 호출 Payload의 `tools` 배열 자체에서 `write_file` 및 `run_command` 도구를 물리적으로 제거.

**코드 대조**: `contextInjector.js` L329-348에서 Tool Spec을 모드별로 분기하는 로직이 이미 존재(`QA` 모드에서 `write_file` 제한 등). Task Master에서도 동일 패턴 적용 가능. **프롬프트 지시가 아닌 구조적 차단** 명시. ✅

#### P-016 (dangerously 접두사) — 확인

PRD L42에서 재실행 시 "이미 완료된 작업을 재실행합니다"라는 경고를 명시했으나, 백엔드 함수에 `dangerously` 접두사를 적용하라는 구체 명시는 없음. **LOW 수준이므로 구현 시 반영으로 충분.**

#### P-020 (무단 코딩 금지) — 해당 없음

이 PRD는 기획서이므로 코딩 행위 자체가 아님. 구현 착수 시 CEO 승인이 필요하다는 점은 Phase 전체 워크플로우에서 커버됨.

---

## 결함 요약 매트릭스

| ID | 렌즈 | 심각도 | 제목 | v1.0 대비 | 판정 |
|----|------|--------|------|-----------|------|
| GAP-S1 | 🔒 보안 | — | `promptInjectionGuard.js` 전용 모듈 명시 | v1.0 CRITICAL → **v1.2 해소** | ✅ |
| GAP-A1 | 🏗️ 아키텍처 | — | `save_execution_plan` 구현 경로 명시 | v1.0 CRITICAL → **v1.2 해소** | ✅ |
| GAP-A2 | 🏗️ 아키텍처 | — | 2-Phase 세션 분리 명시 | v1.0 HIGH → **v1.2 해소** | ✅ |
| GAP-A3 | 🏗️ 아키텍처 | — | 코멘트 체이닝 결함 수술 명시 | v1.0 CRITICAL → **v1.2 해소** | ✅ |
| GAP-ST1 | 🔄 상태 | — | PLANNING/PLAN_COMPLETE 상태 추가 | v1.0 HIGH → **v1.2 해소** | ✅ |
| GAP-ST2 | 🔄 상태 | — | Fork 폐기, 덮어쓰기+스냅샷 채택 | v1.0 MEDIUM → **v1.2 해소** | ✅ |
| GAP-UX1 | 👤 UX | — | Planning 스피너 명시 | v1.0 MEDIUM → **v1.2 해소** | ✅ |
| GAP-RT1 | ⚙️ 런타임 | — | Max Steps 3회 명시 | v1.0 HIGH → **v1.2 해소** | ✅ |
| GAP-RT2 | ⚙️ 런타임 | — | Fallback BLOCKED 전환 명시 | v1.0 MEDIUM → **v1.2 해소** | ✅ |
| GAP-P1 | 📜 정책 | — | 시스템 레벨 도구 차단 명시 | v1.0 MEDIUM → **v1.2 해소** | ✅ |
| **W-001** | 🔒 보안 | 🟡 LOW | `promptInjectionGuard` 적용 범위: `buildLinkedContext` 결과 포함 여부 미명시 | **신규** | 구현 시 반영 |
| **W-002** | 🏗️ 아키텍처 | 🟡 LOW | `executor.js` autoRun 내부 리팩토링 구조 불명확 | **신규** | 구현 시 반영 |
| **W-003** | 🔄 상태 | 🟡 LOW | `PLANNING` 좀비 상태 서버 재시작 복구 로직 미명시 | **신규** | 구현 시 반영 |
| **W-004** | ⚙️ 런타임 | 🟡 LOW | 타임아웃 30초 → 90초 이상 권장 | **신규** | 구현 시 반영 |

---

## STEP 4 — 자가 점검 게이트

```
[✅] STEP 0: POLICY_INDEX.md와 strategic_memory.md를 실제로 view_file 했는가? → 완료
[✅] STEP 1: 기획서가 언급한 소스 코드 파일을 최소 1개 이상 직접 읽었는가? → 5개 파일 확인
[✅] STEP 2: Graphify MCP 도구를 최소 3회 호출했는가? → 4회 호출
[✅] STEP 3: 6개 렌즈 모두 섹션이 존재하는가? → 6/6 완료
[✅] 보고서 헤더에 리뷰어, 리뷰 대상, 리뷰 일시, 이전 리뷰 파일명이 있는가? → 완료
[✅] 결함 요약 매트릭스(표)가 포함되어 있는가? → 완료
```

---

## 최종 등급: 🟢 A — 구현 착수 승인

**v1.0에서 발견된 13건(CRITICAL 3, HIGH 5, MEDIUM 3, LOW 2) 중 CRITICAL/HIGH/MEDIUM 전량(11건) 해소.**

v1.2에서 신규 발견된 4건은 모두 **LOW** 등급이며, 구현 단계에서 자연스럽게 흡수 가능합니다:

- W-001: `promptInjectionGuard`를 `buildLinkedContext` 결과에도 적용 (1줄 추가)
- W-002: `autoRun()` 리팩토링 시 2-phase 함수 분리 구조 채택
- W-003: `database.js` 좀비 복구 훅에 `PLANNING` 추가 (1줄 추가)
- W-004: 타임아웃을 30초에서 90초로 상향 (상수 1개 변경)

**PRD v1.2는 코드 레벨 괴리 진단(GAP-A3), 환각 방지 Tool 구현 경로(GAP-A1), 세션 분리(GAP-A2), 시스템 레벨 도구 차단(GAP-P1)을 모두 구조적으로 해결하였습니다.**

---

*Supreme Review 완료 — Prime (Claude Sonnet 4.6 Thinking) | 2026-05-16*
