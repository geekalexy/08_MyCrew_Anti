# 🛡️ Supreme Review v2 — Phase43-4 Auto Run 보강기획 PRD (v1.1)

**리뷰어**: 소넷 (Claude Sonnet 4.6 Thinking) — 코드 직접 대조 기반  
**리뷰 대상**: `Phase43-4_Auto_Run_보강기획_PRD.md` (v1.1, 루카 보강본)  
**리뷰 일시**: 2026-05-16  
**이전 리뷰**: `52_Phase43-4_AutoRun_SupremeReview_Sonnet_2026-05-16.md` (소넷 1차 — 12건 발견)  
**참조 리뷰**: `53_Phase43-4_AutoRun_SupremeReview_Prime_v2_2026-05-16.md` (프라임 v2 — 13건, GAP-A3 신규)  
**금번 등급**: 🔴 **D — 구현 착수 불가** (CRITICAL 3건 미해소 + GAP-A3 신규 확인)

---

## ✅ STEP 1 실행 — 코드 대조 결과 요약

### 실제 읽은 파일
- `server.js` L467–510 (`forceRedispatchTask` 함수 전문)
- `server.js` L378–437 (`buildLinkedContext` 함수 전문)
- `contextInjector.js` (이전 세션에서 확인)
- `scrubbing.js` (이전 세션에서 확인)

### Graphify 확인 결과
- **God Node**: `DatabaseManager` (84 edges) — `execution_plans` 테이블 추가 시 영향 최대
- `executor.js`: 35개 neighbors (server.js, imageLabRouter.js 에서 import)
- `TASK_MASTER` 분기: **grep 0건 확인** — 미구현 사실 재확인

---

## 📋 PRD v1.1 보완 현황 분석

루카가 v1.1에서 소넷 1차 리뷰의 12건에 대해 보완했습니다. 항목별로 실제 코드와 대조합니다.

| GAP-ID | 소넷 1차 발견 | PRD v1.1 보완 내용 | 실제 코드 검증 | 판정 |
|--------|-------------|-------------------|-------------|------|
| GAP-S1 | scrubbing.js Prompt Injection 방어 불가 | `promptInjectionGuard.js` 신설 명시 (L28) | 코드에 아직 없음 — PRD 설계 기술에 그침 | ⏳ 설계 확인, 미구현 |
| GAP-A1 | save_execution_plan Tool 미구현 | 4.1절 `execution_plans` 테이블 + 도구 구현 명시 | grep 0건 — 여전히 미구현 | ⏳ 설계 확인, 미구현 |
| GAP-A2 | Task Master/Developer 2상 경계 미정의 | 4.2절 "완전히 새로운 세션(New LLM Thread)" 명시 | `TASK_MASTER` 모드 분기 grep 0건 | ⏳ 설계 확인, 미구현 |
| GAP-ST1 | PLAN_COMPLETE 상태 미포함 | 4.3절 `PLANNING`, `PLAN_COMPLETE` 상태 추가 | database.js grep 0건 | ⏳ 설계 확인, 미구현 |
| GAP-ST2 | 재실행 정책 충돌 | 4.3절 "Phase43 Fork 정책 전면 폐기" 명시 | **✅ PRD 수준에서 충돌 해소** |
| GAP-RT1 | Task Master Max Steps 미지정 | 4.4절 `max_steps=3`, 타임아웃 30초 명시 | **✅ PRD 수준에서 해소** |
| GAP-RT2 | Task Master 실패 Fallback 미정의 | 4.4절 "BLOCKED 전환 + 사용자 개입 요청" 명시 | **✅ PRD 수준에서 해소** |
| GAP-P1 | Tool 시스템 레벨 격리 없음 | 4.2절 "API Payload tools 배열에서 물리적 제거" 명시 | contextInjector.js 미반영 — 미구현 | ⏳ 설계 확인, 미구현 |
| GAP-UX1 | Task Master UI 투명성 부재 | 4.3절 "Planning... 스피너" 명시 | **✅ PRD 수준에서 해소** |

**판정 요약**: 9건 중 4건 PRD에서 해소(설계 확정) / 5건 여전히 코드 미구현 상태 (구현 대기)

> ⚠️ **PRD 보완과 코드 구현은 다릅니다.** 위의 "설계 확인, 미구현" 항목들은 PRD가 올바르게 설계됐으나 아직 코드에 반영이 안 된 상태입니다. 구현 착수 전 PRD 검토 단계에서는 이는 정상입니다. 단, CRITICAL 항목들은 PRD에 명시된 설계 자체의 결함이므로 구현 전에 PRD를 추가 보완해야 합니다.

---

## 🔍 프라임 GAP-A3 교차 확인: `forceRedispatchTask` 코멘트 체이닝 미적용

**프라임 발견**: ✅ **소넷이 1차에서 놓쳤습니다. 정확합니다.**

```javascript
// server.js L476-490 (실제 코드 직접 확인)
async function forceRedispatchTask(taskId, agentId, additionalContext = '', contextType = 'INTERIM', forceModel = null) {
  const fullTask = await dbManager.getTaskById(taskId);
  
  // [Phase 36b] 카드링크 컨텍스트 자동 주입
  let linkedCtx = '';
  try { linkedCtx = await buildLinkedContext(fullTask.content, fullTask.project_id); } catch(e) {}
  
  // 추가 컨텍스트 주입
  let enrichedContent = linkedCtx ? linkedCtx + '\n' + fullTask.content : fullTask.content;
  if (additionalContext) {
    // ← additionalContext가 여기서 enrichedContent에 append될 뿐
    // buildLinkedContext(additionalContext, ...)는 **호출되지 않음**
    enrichedContent += `\n\n---\n[코멘트 내용]\n${additionalContext}...`;
  }
}
```

**결론**: `buildLinkedContext`는 `fullTask.content`(카드 본문)에만 적용됩니다. `/auto_run` 트리거 시 코멘트로 전달되는 `additionalContext`는 체이닝 처리를 거치지 않습니다.

**PRD L29**: "코멘트에 포함된 `@[...]`에 대해서도 `buildLinkedContext()` 로직을 적용"

**실제**: `additionalContext`에 `@[#1C2]` 같은 카드링크가 포함된 코멘트가 들어오면 **해석되지 않고 텍스트로만 전달**.

**이것은 PRD v1.1에서도 해소되지 않은 신규 CRITICAL 결함입니다.**

---

## 🔍 소넷 v2 추가 발견: GAP-A4 — `buildLinkedContext` 토큰 폭발 방어 미구현

> 프라임 v2가 언급한 "크로스 프로젝트 참조"를 코드로 추적한 결과, 추가 결함 발견

```javascript
// server.js L378-437 buildLinkedContext 실제 코드
async function buildLinkedContext(taskContent, projectId) {
  // Q3: A타입(strict_isolation) → 동일 프로젝트만, B/C → 범위 탐색
  if (isolationType === 'strict_isolation') {
    refTask = await dbManager.getTaskByProjectNum(projectId, cardNum);
  } else {
    refTask = await dbManager.getTaskByProjectNum(projectId, cardNum)
      || await dbManager.getTaskByProjectNumAcrossScopes(projectId, cardNum, isolationType);
  }
  
  // content를 3000자로 자름 (코멘트 타입)
  sections.push(`...${(comment.content || '').slice(0, 3000)}...`);
  // 파일 타입은 5000자로 자름
  const raw = await fs.promises.readFile(attachment.file_path, 'utf-8')...;
  fileContent = raw.slice(0, 5000);
```

**발견 내용:**
1. **코멘트 1건당 3000자, 파일 1건당 5000자** 제한이 존재합니다 — 소넷 1차 리뷰에서 "하드캡 미정의"라고 발견했는데, **실제로는 구현되어 있었습니다**. 소넷 1차 리뷰의 일부 오진임을 인정합니다.
2. **단, 총 체인 누적 토큰 제한은 없습니다.** 카드링크 10개 × 3000자 = 30,000자가 한 번에 주입될 수 있습니다.
3. **`strict_isolation`이 아닌 경우 크로스 스코프 참조가 허용됩니다** — `getTaskByProjectNumAcrossScopes`로 다른 격리 범위의 카드 접근 가능. PRD에서 이 동작을 명시적으로 허용/금지하는 정책이 없습니다.

**GAP-A4 (MEDIUM)**: 총 체인 누적 토큰 리밋 미정의 (카드별 캡은 있으나, 전체 합산 캡 없음)

---

## 📋 최종 결함 매트릭스 (v2 기준)

| ID | 심각도 | 제목 | 상태 |
|----|--------|------|------|
| GAP-S1 | 🔴 CRITICAL | `promptInjectionGuard.js` 미구현 | ⏳ PRD 설계됨, 구현 대기 |
| GAP-A1 | 🔴 CRITICAL | `save_execution_plan` Tool 미구현 | ⏳ PRD 설계됨, 구현 대기 |
| GAP-A2 | 🔴 CRITICAL | Task Master/Developer 2상 분리 미구현 | ⏳ PRD 설계됨, 구현 대기 |
| **GAP-A3** | 🔴 **CRITICAL** | `forceRedispatchTask` 코멘트 체이닝 미적용 | ❌ PRD에서도 미해소 — **추가 보완 필요** |
| GAP-S2 | 🟠 HIGH | 크로스 스코프 참조 정책 미정의 | ⚠️ 코드에 구현됨(AcrossScopes)이나 PRD 정책 없음 |
| GAP-P1 | 🟠 HIGH | Task Master Tool 시스템 레벨 격리 미구현 | ⏳ PRD 설계됨, 구현 대기 |
| GAP-ST1 | 🟠 HIGH | PLANNING/PLAN_COMPLETE 상태 미구현 | ⏳ PRD 설계됨, 구현 대기 |
| GAP-RT1 | ✅ 해소 | Task Master Max Steps 명시 (max_steps=3, 30초) | PRD v1.1에서 해소 |
| GAP-RT2 | ✅ 해소 | Task Master 실패 Fallback (BLOCKED 전환) | PRD v1.1에서 해소 |
| GAP-ST2 | ✅ 해소 | 재실행 정책 충돌 (Phase43 Fork 폐기 확정) | PRD v1.1에서 해소 |
| GAP-UX1 | ✅ 해소 | Task Master 단계 UI 투명성 (Planning 스피너) | PRD v1.1에서 해소 |
| **GAP-A4** | 🟡 **MEDIUM** | 체인 누적 토큰 총합 리밋 미정의 | 🆕 소넷 v2 신규 발견 |
| GAP-P2 | 🟢 LOW | dangerously 접두사 미적용 | 비구현 (구현 중 처리) |
| GAP-UX2 | 🟢 LOW | @[...] vs [#N] 문법 비일관성 | 비구현 (구현 중 처리) |

**총 14건** (CRITICAL 4 + HIGH 3 + MEDIUM 1 + LOW 2 + 해소 4)

---

## 🎯 PRD 추가 보완 필요 항목 (GAP-A3 중심)

### 1. GAP-A3: `forceRedispatchTask` 코멘트 체이닝 — PRD 보완 필요

PRD L29에 약속된 "코멘트 `@[...]` 체이닝"을 실현하려면 구현 명세에 다음을 추가해야 합니다:

```
[4.2절 추가 구현 명세]
forceRedispatchTask 함수 수정:
  기존: buildLinkedContext(fullTask.content, projectId) 만 호출
  변경: 
    const contentCtx = await buildLinkedContext(fullTask.content, projectId);
    const commentCtx = await buildLinkedContext(additionalContext, projectId);
    // 두 컨텍스트를 순서대로 결합
```

### 2. GAP-A4: 체인 누적 토큰 총합 캡 — PRD 보완 권장

```
[4.1절 추가]
buildLinkedContext의 최대 누적 토큰: 8,000자 (카드별 3000자 × 최대 3개 링크)
초과 시: 가장 오래된 링크부터 잘라냄 (LRU 방식)
```

---

## 📁 저장 완료 보고

```
📁 리뷰 완료 저장:
경로: 02_System_Development/V2_Core_Engine/00_아키텍처_문서/06_리뷰_아카이브/
      54_Phase43-4_AutoRun_SupremeReview_Sonnet_v2_2026-05-16.md
결함: CRITICAL 4건 / HIGH 3건 / MEDIUM 1건 / LOW 2건
구현 착수 전 필수 해결: CRITICAL 4건 (GAP-S1, GAP-A1, GAP-A2, GAP-A3)
PRD 추가 보완 필요: GAP-A3 (코멘트 체이닝), GAP-A4 (누적 토큰 캡)
```

---

*Supreme Review v2 완료 — 소넷 (Claude Sonnet 4.6 Thinking) | 2026-05-16*  
*프라임 GAP-A3 확인 완료. 소넷 1차의 체인 캡 오진(GAP-S2 일부) 정정.*
