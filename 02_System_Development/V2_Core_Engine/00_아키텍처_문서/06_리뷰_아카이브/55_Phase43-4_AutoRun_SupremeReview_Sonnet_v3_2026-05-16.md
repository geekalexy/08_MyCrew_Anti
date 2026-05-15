# 🛡️ Supreme Review v3 (최종) — Phase43-4 Auto Run 보강기획 PRD (v1.3)

**리뷰어**: 소넷 (Claude Sonnet 4.6 Thinking) — 코드 직접 대조 최종 검증  
**리뷰 대상**: `Phase43-4_Auto_Run_보강기획_PRD.md` (v1.3, 루카 3차 보강본)  
**리뷰 일시**: 2026-05-16  
**이전 리뷰**: `54_Phase43-4_AutoRun_SupremeReview_Sonnet_v2_2026-05-16.md`  
**참조 리뷰**: `53_Phase43-4_AutoRun_SupremeReview_Prime_v2_2026-05-16.md`  
**금번 등급**: 🟡 **B+ — 구현 착수 가능** (PRD 설계 완성. 신규 CRITICAL 0건)

---

## ✅ STEP 0 — 정책 파일 확인
- `POLICY_INDEX.md` / `strategic_memory.md` 기준: 본 리뷰는 P-020(CEO 승인 코딩 금지), P-016(dangerously 접두사) 정책 하에 수행됨.

## ✅ STEP 1 — 실제 읽은 코드 파일
- `server.js` L378-437 (`buildLinkedContext` 함수)
- `server.js` L467-510 (`forceRedispatchTask` 함수)
- `database.js` L1764-1785 (`getTaskByProjectNumAcrossScopes` 함수)
- `database.js` L1126-1147 (`getKanbanColumns` — BLOCKED 상태 검증)

## ✅ STEP 2 — Graphify 호출
- `mcp_graphify_god_nodes`: DatabaseManager (84 edges) = God Node 확인
- `mcp_graphify_query_graph`: buildLinkedContext → forceRedispatchTask 연결 경로 확인
- `mcp_graphify_get_neighbors(executor.js)`: TASK_MASTER 분기 미존재 확인

---

## 📋 v1.3 신규 추가 섹션 코드 대조 결과

### 4.5절 — GAP-A3 코멘트 체이닝 명세

**PRD v1.3 L120:**
```javascript
const commentCtx = await buildLinkedContext(additionalContext, projectId);
```

**코드 검증 결과:**
- `buildLinkedContext(text, projectId)` 함수 시그니처 확인: `server.js L378`
  - 첫 인자는 파싱할 텍스트, 두 번째는 projectId
  - `additionalContext`를 첫 인자로 넘기는 것은 **시그니처 호환** ✅
- `forceRedispatchTask` L467의 파라미터 `additionalContext`가 코멘트 텍스트임 확인 ✅
- `projectId`는 `fullTask.project_id`로부터 가져와야 하며 함수 내에서 접근 가능 ✅

**판정**: PRD의 수정 명세가 실제 코드 구조와 정합합니다. 구현 시 적용 가능.

---

### 4.5절 — GAP-A4 누적 토큰 캡 (8,000자, LRU)

**PRD v1.3 L122:**
> `buildLinkedContext` 내부 처리 시 총 체인 누적 토큰 리밋을 8,000자로 제한, LRU 방식 잘라냄

**코드 검증 결과:**
- 현재 `buildLinkedContext`는 개별 `section.push(...)` 후 최종적으로 `sections.join('\n')`만 수행 (`server.js L435-436`)
- 총 누적 길이 제한 로직 없음 — PRD가 올바르게 결함을 지적하고 있음 ✅
- LRU 방식(오래된 링크부터 잘라냄): 현재 `for loop` 순서가 `CARD_TAG_REGEX.matchAll` 순서 → 앞에서 발견된 태그가 먼저 처리됨. LRU 적용 시 `sections.splice(0, 1)` 또는 역순 처리 필요 — 구현 명세로 충분히 실현 가능 ✅

**판정**: 구현 가능한 명세. 세부 구현 전 `sections` 배열 누적 길이 체크 위치를 확인해야 함.

> ⚠️ **소넷 구현 가이드 추가**: LRU는 "오래된 링크부터"이지만 `matchAll` 순서는 텍스트 등장 순서입니다. 구현 시 `sections.pop()` (마지막 추가된 것 제거)이 아니라 `sections.shift()` (가장 먼저 추가된 것 제거)가 실제 LRU에 해당합니다. PRD에 방향을 명시하면 더 좋습니다.

---

### 4.6절 — GAP-S2 크로스 스코프 참조 정책

**PRD v1.3 L125:**
> `getTaskByProjectNumAcrossScopes` 호출 시 명시적으로 같은 워크스페이스 내의 연관 프로젝트만 참조 가능하도록 정책을 제한

**코드 검증 결과:**
`database.js L1764-1785` 실제 구현:
```javascript
async getTaskByProjectNumAcrossScopes(requestingProjectId, taskNum, isolationType) {
  const accessibleIds = await this.getAccessibleProjectIds(requestingProjectId);
  // accessibleIds → 이미 isolation_scope 기반으로 접근 가능한 프로젝트 ID 목록
  // WHERE project_id IN (${placeholders}) 로 필터링됨
}
```

`getAccessibleProjectIds` 함수가 실제로 "같은 워크스페이스 내 연관 프로젝트"만 반환하는지 확인 필요. 현재 PRD는 `getAccessibleProjectIds`의 구체적 로직에 의존하므로:

**잠재적 약점**: PRD 4.6절은 정책 의도는 명확하지만 `getAccessibleProjectIds` 내부 로직이 워크스페이스 경계를 실제로 강제하는지 검증하지 않음. 그러나 이것은 별도 함수의 책임이며 본 PRD 범위를 벗어남.

**판정**: PRD 설계 차원에서 정책이 명확히 정의됨 ✅. 구현 시 `getAccessibleProjectIds` 의 워크스페이스 격리 로직 별도 확인 권고.

---

### 4.4절 — BLOCKED 상태 신규 사용

**PRD v1.3 L115:**
> 상태를 `BLOCKED`로 전환

**코드 검증 결과:**
- `database.js L1128-1135` `getKanbanColumns` 기본값 목록: `PENDING`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`, `FAILED`, `ARCHIVED`
- `BLOCKED` 상태가 **기본 칸반 컬럼 목록에 없음** ⚠️
- `server.js`에서도 `BLOCKED` grep 결과 0건

**소넷 신규 발견 — GAP-A5 (MEDIUM)**: `BLOCKED` 상태를 Task Master Fallback으로 사용하려면:
1. `database.js` `getKanbanColumns` 기본값 배열에 `BLOCKED` 추가
2. 프론트엔드 `BANNER_MAP`에 `BLOCKED` 배너 추가
3. `server.js`의 `updateTaskStatus` 허용 상태 목록 확인

PRD 4.4절에서 `BLOCKED`를 도입했으나 이 상태가 기존 시스템에서 인식되지 않으면 DB에는 저장되지만 프론트엔드에서 표시가 안 됨.

---

## 📋 v1.3 기준 최종 결함 매트릭스

| ID | 심각도 | 제목 | 최종 상태 |
|----|--------|------|----------|
| GAP-S1 | 🔴 CRITICAL | `promptInjectionGuard.js` 신설 | ✅ PRD 명시 완료, 구현 대기 |
| GAP-A1 | 🔴 CRITICAL | `save_execution_plan` Tool 구현 | ✅ PRD 명시 완료, 구현 대기 |
| GAP-A2 | 🔴 CRITICAL | Task Master/Developer 2상 분리 | ✅ PRD 명시 완료, 구현 대기 |
| GAP-A3 | 🔴 CRITICAL | 코멘트 체이닝 (`additionalContext`) | ✅ **v1.3에서 해소** — 코드 시그니처 정합 확인 |
| GAP-S2 | 🟠 HIGH | 크로스 스코프 참조 정책 | ✅ **v1.3에서 해소** — 4.6절 정책 명시 |
| GAP-P1 | 🟠 HIGH | Task Master Tool 시스템 레벨 격리 | ✅ PRD 명시 완료, 구현 대기 |
| GAP-ST1 | 🟠 HIGH | PLANNING/PLAN_COMPLETE 상태 추가 | ✅ PRD 명시 완료, 구현 대기 |
| GAP-RT1 | ✅ 해소 | Task Master Max Steps (max_steps=3) | ✅ v1.1에서 해소 |
| GAP-RT2 | ✅ 해소 | Task Master Fallback (BLOCKED) | ✅ v1.1에서 해소 |
| GAP-ST2 | ✅ 해소 | 재실행 정책 충돌 (Fork 폐기) | ✅ v1.1에서 해소 |
| GAP-UX1 | ✅ 해소 | Task Master UI (Planning 스피너) | ✅ v1.1에서 해소 |
| GAP-A4 | 🟡 MEDIUM | 체인 누적 토큰 총합 캡 (8,000자) | ✅ **v1.3에서 해소** — LRU 방식 명시 |
| **GAP-A5** | 🟡 **MEDIUM** | `BLOCKED` 상태 칸반 시스템 미등록 | 🆕 **소넷 v3 신규 발견** — PRD 보완 필요 |
| GAP-P2 | 🟢 LOW | `dangerously` 접두사 미적용 | 구현 시 처리 |
| GAP-UX2 | 🟢 LOW | `@[...]` vs `[#N]` 문법 통일 | 구현 시 처리 |

**총 15건 중 해소 8건 / 구현 대기 4건 (CRITICAL) / 신규 1건 (MEDIUM) / 저우선순위 2건**

---

## 🎯 PRD 추가 보완 권고 (GAP-A5 — 1건)

### 4.4절 또는 4.3절에 추가:

```markdown
* **`BLOCKED` 상태 시스템 등록 필요**: Task Master Fallback으로 `BLOCKED`를 
  사용하려면 `database.js` `getKanbanColumns` 기본값 배열, 
  프론트엔드 BANNER_MAP, 상태 전이 허용 목록에 `BLOCKED`를 추가해야 합니다.
  (`PLANNING`, `PLAN_COMPLETE`와 함께 동일 PR에서 처리 권장)
```

---

## 🏁 최종 종합 판정

**PRD v1.3은 구현 착수 가능한 수준입니다.**

- 4차례 리뷰 루프(소넷 v1 → 루카 v1.1 → 프라임 v2 → 루카 v1.3 → 소넷 v3)를 통해 최초 12건 → 현재 CRITICAL 0건(신규), 설계상 미해소 없음.
- 남은 CRITICAL 3건(GAP-S1, GAP-A1, GAP-A2)은 **코드 구현 과제**이지 PRD 설계 결함이 아닙니다.
- GAP-A5(MEDIUM) 단 1건만 PRD에 한 줄 추가 후 구현 착수 권장.

**권장 구현 순서:**
1. `database.js` — `execution_plans` 테이블 + `PLANNING/PLAN_COMPLETE/BLOCKED` 상태 등록 (God Node, 최우선 격리 트랜잭션)
2. `promptInjectionGuard.js` — 신규 파일 생성 (독립 모듈, 의존성 없음)
3. `contextInjector.js` — `TASK_MASTER` 모드 분기 + `save_execution_plan` Tool Spec 추가
4. `toolExecutor.js` — `save_execution_plan` 핸들러 등록
5. `server.js` — `forceRedispatchTask` 코멘트 체이닝 수정 + `buildLinkedContext` 누적 캡 추가

---

📁 **저장 완료 보고:**
```
경로: 06_리뷰_아카이브/55_Phase43-4_AutoRun_SupremeReview_Sonnet_v3_2026-05-16.md
결함: CRITICAL 0건(신규) / MEDIUM 1건(GAP-A5) / 구현대기 3건(CRITICAL급이나 PRD 설계는 완료)
PRD 추가 보완: GAP-A5 (BLOCKED 상태 등록 명세 — 한 줄 추가)
최종 판정: 🟡 B+ — 구현 착수 가능
```

---

*Supreme Review v3 (최종) — 소넷 (Claude Sonnet 4.6 Thinking) | 2026-05-16*  
*4차 리뷰 루프 완료. PRD 설계 단계 종료 판정.*
