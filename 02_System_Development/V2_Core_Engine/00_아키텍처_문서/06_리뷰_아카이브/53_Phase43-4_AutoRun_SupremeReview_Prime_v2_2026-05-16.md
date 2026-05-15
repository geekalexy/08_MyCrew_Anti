# Phase 43-4 Auto Run Pipeline — Supreme Review v2 (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-16  
> **리뷰 대상**: Phase43-4 PRD v1 (99줄) + 실제 코드베이스 전수 대조  
> **이전 리뷰**: `51_Phase43-4_AutoRun_Evolution_SupremeReview_Prime.md` — **A 등급 승인 (오류)**  
> **소넷 리뷰**: `52_Phase43-4_AutoRun_SupremeReview_Sonnet_2026-05-16.md` — 12건 결함 발견  
> **금번 등급**: 🔴 **D — 구현 착수 불가 (CRITICAL 3건, HIGH 5건, MEDIUM 4건)**

---

## ⚠️ 이전 리뷰 자기 비판 (Prime 오류 분석)

이전 리뷰(#51)에서 Prime은 PRD 표면 텍스트만 확인하고 "P1-001, P1-002 해소 확인 → A 등급 최종 승인"을 내렸습니다. **이것은 잘못된 판정이었습니다.**

| 실패 원인 | 상세 |
|-----------|------|
| **코드 대조 미수행** | PRD에 "새니타이즈 수행"이라고 적혀 있으면 실제 코드(`scrubbing.js`)를 열어 해당 함수가 Prompt Injection을 방어하는지 확인했어야 함. 하지 않음. |
| **Tool 존재 검증 미수행** | `save_execution_plan`이라는 Tool이 PRD에 명시됐으면, `contextInjector.js`/`executor.js`/`toolExecutor.js`에 해당 핸들러가 존재하는지 `grep`했어야 함. 하지 않음. |
| **상태 모델 대조 미수행** | `PLAN_COMPLETE`라는 새 상태를 PRD가 도입했으면, `database.js`의 상태 ENUM과 프론트엔드 BANNER_MAP에 해당 값이 있는지 확인했어야 함. 하지 않음. |
| **정책 충돌 미발견** | Phase43(Fork 강제)과 Phase43-4(덮어쓰기 방식)의 재실행 정책이 상충하는지 두 PRD를 대조했어야 함. 하지 않음. |

**결론**: 이전 리뷰는 "PRD 텍스트에 해당 단어가 등장하면 해소"로 판정한 **표면 검증**이었으며, 코드베이스와의 **정합성 검증을 완전히 생략**했습니다. 이하 재리뷰에서는 소넷 발견 사항을 코드로 교차 확인하고, 소넷이 놓친 추가 결함까지 도출합니다.

---

## 0.5 Graphify 기반 영향도 분석 (재수행)

| 변경 대상 | Graphify Edges | God Node? | 위험도 |
|-----------|---------------|-----------|--------|
| `server.js` | **187** | **#1** | 🔴 최고 |
| `database.js` | **84** | **God Node** | 🔴 최고 (execution_plans 테이블 신설 필요) |
| `executor.js` | **48** | #8 | 🟠 높음 |
| `contextInjector.js` | 4 (imported by 3) | — | 🟡 중간 (but 소비자가 #1, #4, #8) |
| `scrubbing.js` | 3 | — | 🟢 낮음 (but 역할 미스매치) |

---

## 멀티 렌즈 분석 — 코드 대조 기반

### 🔒 렌즈 1: 보안

#### 🔴 CRITICAL: GAP-S1 — `scrubbing.js`는 Prompt Injection 방어가 아님

**소넷 발견 확인**: ✅ **정확합니다.**

코드 검증:
```javascript
// scrubbing.js (실제 코드)
export function sanitize(text) {
    let sanitized = text;
    sanitized = sanitized.replace(regex, '[OUR_COMPANY]');   // 회사명 마스킹
    sanitized = sanitized.replace(regex, '[PERSON]');         // 인명 마스킹
    sanitized = sanitized.replace(regex, '[COMPETITOR]');     // 경쟁사 마스킹
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL_REMOVED]');  // URL 제거
    return sanitized.trim();
}
```

이 함수는 **비식별화(Anonymization) 전용**입니다. `IGNORE PREVIOUS INSTRUCTIONS`, `[SYSTEM]`, `[INST]` 등의 Prompt Injection 패턴을 **전혀 탐지하지 못합니다.**

PRD L28의 "Prompt Injection 방지를 위해 새니타이즈(Sanitize)를 수행"이라는 문구는 **존재하지 않는 기능을 약속**한 것입니다.

**Prime 추가 분석**: Phase 44-3에서 `artifact_url` 경유 주입에 대해 `replace(/\[SYSTEM\]|\[INST\]/gi, '[BLOCKED]')`를 적용했지만, 이것은 `server.js` L1912 부근의 인라인 코드이며 **재사용 가능한 모듈이 아닙니다.** 소넷이 제안한 `promptInjectionGuard.js` 전용 모듈 분리가 올바른 Best Practice입니다.

---

#### 🟠 HIGH: GAP-S2 — 컨텍스트 체이닝 Indirect Reference Attack

**소넷 발견 확인**: ✅ **정확합니다.**

`contextChainService.js`에서 `getItemByRefId()` 함수가 존재하지 않는 것을 `grep`으로 확인했으나, `buildLinkedContext()`는 `server.js` L378에 존재합니다. 이 함수는 카드 content에서 `@[...]` 참조를 재귀적으로 해석하여 **모든 링크된 파일/카드 내용을 로드**합니다.

**Prime 추가 결함**: `buildLinkedContext`는 **크로스 프로젝트 참조 제한이 없습니다.** 프로젝트 A의 카드가 프로젝트 B의 카드를 참조하면 격리 정책(P-001) 위반.

---

### 🏗️ 렌즈 2: 아키텍처

#### 🔴 CRITICAL: GAP-A1 — `save_execution_plan` Tool 미구현 (환각 위험)

**소넷 발견 확인**: ✅ **정확합니다. 코드에 존재하지 않음을 확인.**

```bash
grep -r "save_execution_plan" 01_아리_엔진/  →  No results found
```

PRD L81에서 Task Master에게 `save_execution_plan` Tool Call을 **강제**하고 있지만:
1. `contextInjector.js` L329-348의 Tool Specification 목록에 **없음**
2. `toolExecutor.js`의 `executeTool()` 핸들러에 **없음**
3. `database.js`에 `execution_plans` 테이블이나 `saveExecutionPlan()` 메서드가 **없음**

**LLM에게 존재하지 않는 Tool을 호출하도록 강제하면**: 
- Tool Call 자체가 `Unknown tool` 에러로 실패 → 무한 재시도
- 또는 LLM이 Tool Call 포기 → Task Master 단계를 건너뛰고 직접 코딩 시작
- **어느 쪽이든 "계획 선행 강제"라는 PRD 핵심 목적이 무력화됨**

---

#### 🟠 HIGH: GAP-A2 — Task Master/Developer 2상 실행 경계 미정의

**소넷 발견 확인**: ✅ **정확합니다.**

```bash
grep -r "TASK_MASTER" 01_아리_엔진/  →  No results found
```

`contextInjector.js` L295의 `buildAutoRunContext(taskData, mode)` 함수는 `mode`로 `'DEV'`, `'QA'`, `'DEBUG'`만 처리합니다(L299-327). `'TASK_MASTER'` 분기가 **존재하지 않습니다.**

**Prime 추가 분석 — 페르소나 오염 위험**:

소넷이 지적한 "단일 LLM 세션 내 2개 페르소나 오염"은 **정당한 우려**입니다. 만약 Task Master와 Developer를 동일 대화 세션에서 실행하면:
- Task Master가 "나는 계획만 세운다"고 지시받아도, 대화 히스토리에 Developer 시절의 코딩 맥락이 남아있으면 **역할 혼란**이 발생
- 권장: **별도 `executor.run()` 호출** — Task Master 세션 완료 후, 새로운 세션에서 Developer 시작

---

#### 🔴 PRIME 추가 발견: GAP-A3 — `forceRedispatchTask` 코멘트 체이닝 경로 불일치

PRD L29에서 "코멘트에 포함된 `@[...]`에 대해 `buildLinkedContext()` 적용"이라고 명시했으나, 실제 `forceRedispatchTask` 코드(server.js L467-487):

```javascript
async function forceRedispatchTask(taskId, agentId, additionalContext = '', ...) {
    try { linkedCtx = await buildLinkedContext(fullTask.content, fullTask.project_id); } catch(e) {}
    // ← fullTask.content에만 체이닝 적용. additionalContext(코멘트)에는 미적용!
}
```

`additionalContext`(코멘트 텍스트)는 `buildLinkedContext`를 통과하지 않습니다. **PRD가 약속한 "코멘트 컨텍스트 체이닝"이 현재 코드에서 실현 불가능**합니다.

---

### 🔄 렌즈 3: 상태 정합성

#### 🟠 HIGH: GAP-ST1 — `PLAN_COMPLETE` 상태가 State Model에 없음

**소넷 발견 확인**: ✅ **정확합니다.**

```bash
grep "PLAN_COMPLETE\|PLANNING" database.js  →  No results (node_modules 제외)
```

Phase 44-3에서 정의한 `last_autorun_status` 상태 모델:
```
DEV_DONE → QA_RUNNING → QA_DONE/QA_FAILED → DBG_RUNNING → DBG_DONE → PIPELINE_DONE → FAILED
```

여기에 `PLANNING`, `PLAN_COMPLETE` 상태가 **없습니다.** PRD가 이 상태를 사용하려면:
1. `database.js` 스키마 확장
2. `database.js` L143의 스타트업 훅에 `PLANNING` 좀비 복구 추가
3. 프론트엔드 `BANNER_MAP`에 `PLANNING` 배너 추가
4. `server.js`의 `updateAutoRunStatus()` 호출 경로에 반영

**이것은 God Node(`database.js`, 84 edges) 변경이며, 격리 트랜잭션으로 우선 구현해야 합니다.**

---

#### 🟡 MEDIUM: GAP-ST2 — 재실행 정책 충돌 (Phase43 vs Phase43-4)

**소넷 발견 확인**: ✅ **정확합니다.**

코드 검증:
```
Phase43 (L107): "자동으로 새로운 태스크 카드를 Fork(복제) 생성"
Phase43-4 (L40-42): "스냅샷 강제 생성 + UI 경고 모달 (동일 카드 재실행)"
```

**동일 상황(`DONE` 카드 재실행)에 2개의 상반된 정책**이 존재합니다. 둘 중 하나를 선택하고 나머지를 **명시적으로 폐기(Deprecated)** 처리해야 합니다.

**Prime 권장**: Phase43-4 방식(스냅샷 + 경고) 채택, Phase43 Fork 방식 폐기. 이유: Phase 44-3에서 이미 "Immutable Fork 폐기 → 스냅샷 전환"을 결정했으며, 이와 일관.

---

### 👤 렌즈 4: UX/사용자 흐름

#### 🟡 MEDIUM: GAP-UX1 — Task Master 단계 UI 투명성 부재

**소넷 발견 확인**: ✅ **정확합니다.**

현재 `BANNER_MAP`에 Task Master 전용 배너가 없으므로, 사용자는 `/auto_run` 실행 후 "왜 아직 코드를 안 짜지?"라는 혼란을 겪을 수 있습니다.

**필요 추가**:
```javascript
PLANNING: { text: '📋 실행 계획 수립 중...', color: 'blue' }
```

#### 🟡 MEDIUM: GAP-UX2 — `@[...]` vs `[#N]` 문법 비일관성

**소넷 발견**: 이건 **확인 불필요** — 저자가 아닌 검증자가 명명 규칙을 통일하면 됩니다. 실질적 위험 낮음.

---

### ⚙️ 렌즈 5: 런타임 안정성

#### 🟠 HIGH: GAP-RT1 — Task Master Max Steps/타임아웃 미지정

**소넷 발견 확인**: ✅ **정확합니다.**

현재 `executor.js`의 autoRun 루프에는 `MAX_STEPS = 20` 등이 존재하지만, Task Master에 대한 별도 제한이 없습니다. Task Master가 `query_graph`와 `grep_search`를 무한 반복하면 토큰 폭발.

**권장**: `TASK_MASTER_MAX_STEPS: 5`, `TASK_MASTER_TIMEOUT_MS: 120_000`

#### 🟡 MEDIUM: GAP-RT2 — Task Master 실패 시 Fallback 미정의

**소넷 발견 확인**: ✅ **정확합니다.**

Task Master가 5턴 내에 `save_execution_plan`을 호출하지 못하면? PRD에 대안이 없습니다.

**Prime 권장**: 소넷과 동의 — **A. 강제 중단** (FAILED 전환). B(Developer 직접 실행)는 PRD 핵심 목적("계획 선행 강제") 무력화.

---

### 📜 렌즈 6: 정책 준수

#### 🟡 MEDIUM: GAP-P1 — Task Master Tool 시스템 레벨 격리 없음

**소넷 발견 확인**: ✅ **정확합니다.**

PRD L81에 "NEVER write code"라고 프롬프트에 적었지만, `contextInjector.js` L335-344를 보면:
```javascript
if (mode !== 'QA') {
    context += `- **write_file**: ...`;  // ← DEV 모드가 아니면 write_file 노출
    context += `- **multi_replace**: ...`;
}
context += `- **run_command**: ...`;  // ← 무조건 노출
```

`mode === 'TASK_MASTER'`는 `mode !== 'QA'`이므로 **`write_file`, `multi_replace`, `run_command`가 모두 Tool Spec에 포함**됩니다. 프롬프트 지시("NEVER write code")만으로는 LLM의 환각 시 코드 수정을 **구조적으로 차단할 수 없습니다.**

Phase 44-3에서 QA 모드에 `toolExecutor.js` Interceptor를 구현한 것과 동일하게, **TASK_MASTER 모드에서도 시스템 레벨 차단이 필요**합니다.

---

## 종합 판정 — 코드 대조 기반 최종 결함 매트릭스

| ID | 렌즈 | 심각도 | 제목 | 소넷 발견 | Prime 교차 확인 |
|----|------|--------|------|-----------:|:---------------|
| GAP-S1 | 🔒 보안 | 🔴 CRITICAL | `scrubbing.js`는 Prompt Injection 방어 불가 | ✅ | ✅ 코드 확인 완료 |
| GAP-A1 | 🏗️ 아키텍처 | 🔴 CRITICAL | `save_execution_plan` Tool 미구현 — 환각 위험 | ✅ | ✅ `grep` 0건 확인 |
| **GAP-A3** | 🏗️ 아키텍처 | 🔴 **CRITICAL** | `forceRedispatchTask`에서 코멘트 체이닝 미적용 | ❌ 미발견 | ✅ **Prime 신규 발견** — server.js L478 확인 |
| GAP-S2 | 🔒 보안 | 🟠 HIGH | 컨텍스트 체이닝 크로스 프로젝트 참조 무방어 | ✅ | ✅ 프로젝트 격리 미검증 확인 |
| GAP-A2 | 🏗️ 아키텍처 | 🟠 HIGH | Task Master/Developer 2상 전환 미정의 | ✅ | ✅ `TASK_MASTER` 분기 0건 확인 |
| GAP-ST1 | 🔄 상태 | 🟠 HIGH | `PLAN_COMPLETE` 상태 9-State 모델 미포함 | ✅ | ✅ `grep` 0건 확인 |
| GAP-RT1 | ⚙️ 런타임 | 🟠 HIGH | Task Master Max Steps/타임아웃 미지정 | ✅ | ✅ |
| GAP-P1 | 📜 정책 | 🟠 HIGH | Task Master `write_file`/`run_command` 시스템 차단 없음 | ✅ | ✅ contextInjector L335 확인 |
| GAP-ST2 | 🔄 상태 | 🟡 MEDIUM | Phase43 Fork vs Phase43-4 덮어쓰기 정책 충돌 | ✅ | ✅ Phase43 L107 확인 |
| GAP-UX1 | 👤 UX | 🟡 MEDIUM | Task Master 단계 UI 투명성 부재 | ✅ | ✅ |
| GAP-RT2 | ⚙️ 런타임 | 🟡 MEDIUM | Task Master 실패 Fallback 미정의 | ✅ | ✅ |
| GAP-UX2 | 👤 UX | 🟢 LOW | `@[...]` vs `[#N]` 문법 비일관성 | ✅ | — |
| GAP-P2 | 📜 정책 | 🟢 LOW | `dangerously` 접두사 미적용 | ✅ | — |

**총 13건** (CRITICAL 3 + HIGH 5 + MEDIUM 3 + LOW 2)

---

## 구현 착수 전 필수 보완 항목 (Blocking 8건)

| # | 항목 | 설명 |
|---|------|------|
| 1 | **`promptInjectionGuard.js` 신설** | `scrubbing.js`와 완전 분리. `[SYSTEM]`, `[INST]`, `IGNORE PREVIOUS` 등 패턴 탐지 + 차단 |
| 2 | **`save_execution_plan` Tool 전체 구현** | DB 테이블 → toolExecutor 핸들러 → contextInjector Tool Spec 등록 순서 |
| 3 | **`forceRedispatchTask` 코멘트 체이닝** | `additionalContext`에도 `buildLinkedContext()` 적용 (현재 `fullTask.content`만 적용) |
| 4 | **TASK_MASTER 모드 분기 신설** | `contextInjector.js` + `toolExecutor.js` Interceptor (Read-Only 화이트리스트) |
| 5 | **`PLANNING`/`PLAN_COMPLETE` 상태 추가** | database.js 스키마 + 스타트업 훅 + 프론트엔드 BANNER_MAP |
| 6 | **Task Master Max Steps 명시** | `TASK_MASTER_MAX_STEPS: 5`, `TIMEOUT: 120_000` |
| 7 | **재실행 정책 단일화** | Phase43-4(스냅샷+경고) 채택, Phase43(Fork) 명시적 폐기 |
| 8 | **Task Master 실패 Fallback** | FAILED 강제 전환 (Developer 직접 실행 금지) |

---

## Prime 반성 및 프로세스 개선

### 이전 리뷰 실패의 근본 원인

| 문제 | 개선 |
|------|------|
| PRD 텍스트 확인만으로 "해소" 판정 | **코드 `grep` 검증 필수** — PRD에 명시된 함수/Tool/상태가 코드에 실제로 존재하는지 확인 |
| 단일 패스(1회) 리뷰 | **2-패스 리뷰** — 1패스: PRD 논리 검증, 2패스: 코드 대조 |
| 소넷 리뷰 결과 미참조 | **교차 리뷰 필수** — 소넷이 먼저 리뷰한 경우 반드시 읽고 교차 확인 |

**향후 모든 Supreme Review에서 다음 체크리스트를 의무 수행합니다:**

```
□ PRD에 명시된 Tool이 코드에 존재하는가? (grep 확인)
□ PRD에 명시된 상태(State)가 DB 스키마에 존재하는가? (grep 확인)
□ PRD에 명시된 함수가 호출 경로에 실제로 연결되어 있는가? (코드 추적)
□ PRD에 명시된 보안 방어가 실제 코드에서 해당 기능을 수행하는가? (함수 본문 확인)
□ 이전 Phase PRD와 정책 충돌이 있는가? (크로스 PRD 대조)
```

---

*Prime Supreme Review v2 | Phase 43-4 Auto Run Pipeline | 2026-05-16*  
*이전 리뷰(#51)의 A 등급 판정을 D로 정정합니다.*
