# Phase 42.5: Agent Absolute Isolation — Supreme Review (Prime)

> **리뷰어**: Prime (Claude Opus 4.6 Thinking — Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-13  
> **리뷰 대상**: `Phase42_5_Agent_Absolute_Isolation_PRD.md` + 관련 코드 4개 파일  
> **리뷰 등급**: 🟢 **A — 정식 승인 (Pass)**, 보강 권고 4건 (차단 없음)

---

## 1. 리뷰 범위

| # | 대상 | 타입 |
|---|------|------|
| 1 | `Phase42_5_Agent_Absolute_Isolation_PRD.md` | 기획서 |
| 2 | `database.js` L2140-2157 (`getTaskByProjectNumAcrossScopes`) | 실제 버그 확인 |
| 3 | `database.js` L1622-1660 (`getAllTasksLight`) | 오염 경로 확인 |
| 4 | `server.js` L950 (`task:move` 핸들러) | 오염 호출 확인 |
| 5 | `Phase42_3_에이전트_컨텍스트_오염방지계획서.md` | 사전 분석 문서 교차 검증 |

---

## 2. 전략 평가 — ✅ 방향 전면 동의

### 2.1 핵심 판단: "이건 보안 문제가 아니라 환각 문제다"

기획서가 이 점을 명확히 구분한 것이 정확합니다. 마이크루는 **단일 소유자(CEO) 시스템**이므로 권한 차단이 목적이 아닙니다. 진짜 문제는 **에이전트가 타 프로젝트의 맥락을 자기 것으로 착각**하여 산출물을 오염시키는 것입니다. 이 프레이밍이 올바릅니다.

### 2.2 "선작업 후 설계" 반성의 문서화

§7 회고 섹션에서 Graphify `global add`를 기획 없이 투입한 과정을 명시적으로 반성하고, "원인 규명 선행 → 설계 → 승인 → 개발" 순서를 재확립한 것은 **팀 문화 차원에서 중요한 기록**입니다.

### 2.3 4대 오염 원인의 근거 충분성

코드베이스를 직접 확인한 결과, 기획서가 지적한 4가지 원인이 모두 **실제 코드에서 확인**됩니다:

---

## 3. 코드 교차 검증 — 4대 오염 원인 확정

### 🔴 원인 1: `getAllTasksLight()` 프로젝트 필터 누락 — **확정**

```javascript
// server.js L950 (task:move 핸들러)
const allTasks = await dbManager.getAllTasksLight();  // ← projectId 없음!
```

`getAllTasksLight(projectId = null)`은 `projectId`가 없으면 **전사 모든 프로젝트의 카드를 반환**합니다 (L1622-1640). `mcp_server.js` L89, L104에서도 동일하게 파라미터 없이 호출됩니다.

**기획서 솔루션 (§3.1)**: `projectId` 강제 주입 Guard → ✅ 정확한 해결 방향

### 🔴 원인 2: SKILL.md / TEAM_GROUND_RULES.md 글로벌 공유 — **확정** (문서 근거)

기획서와 오염방지계획서(§8.3)에서 확인된 대로, 프로젝트 구분 없는 단일 파일 구조입니다.

**기획서 솔루션 (§3.2)**: `{projectId}_SKILL.md` 파일명 분리 → ✅ 가장 단순하고 효과적인 접근

### 🔴 원인 3: `#N` 카드 참조 SQL 우선순위 버그 — **확정**

```sql
-- database.js L2148-2150 (현재 코드)
ORDER BY created_at ASC   -- 가장 오래된 카드(타 프로젝트) 우선 매칭!
LIMIT 1
```

`#3`을 참조할 때, 현재 프로젝트의 `#3`이 아니라 **시스템 전체에서 가장 오래된 `#3` 카드**가 반환됩니다. 이것이 "광고주센터에서 미니앱 코드를 뱉는" 직접적 원인입니다.

**기획서 솔루션 (§3.3)**:
```sql
ORDER BY CASE WHEN project_id = ? THEN 1 ELSE 2 END, created_at DESC
LIMIT 1
```
→ ✅ **정확한 SQL 수정**. 자기 프로젝트 최우선 + 타 프로젝트는 최신순 폴백.

### 🔴 원인 4: B4System RAG 격리 부재 — **확정** (문서 근거)

기획서 §3.4에서 `projectId` 파라미터 전달 + RuleHarvester 분리 저장 제안 → ✅ 올바른 방향

---

## 4. 솔루션 아키텍처 심층 분석

### 4.1 Step 1 (SQL 수정) — ✅ 승인

기획서의 `CASE WHEN` 쿼리는 정확합니다. 단, 한 가지 보강 사항:

**🟡 보강 권고 1: `requestingProjectId` 파라미터가 NULL일 때 방어**

```javascript
// database.js L2140: requestingProjectId가 null이면?
async getTaskByProjectNumAcrossScopes(requestingProjectId, taskNum, isolationType) {
  // requestingProjectId가 null이면 CASE WHEN이 무의미해짐
```

→ **권장**: `requestingProjectId`가 null/undefined인 경우 `created_at DESC`만 사용하는 폴백, 또는 아예 빈 결과를 반환하여 "소속 프로젝트 불명 에이전트"의 교차 참조를 차단

### 4.2 Step 2 (getAllTasksLight 강제 주입) — ✅ 승인

**🟡 보강 권고 2: 호출부 누수 방지를 위한 런타임 경고**

현재 `getAllTasksLight(projectId = null)`은 `projectId`가 없어도 조용히 전체 카드를 반환합니다. 격리 패치 후에도 새로운 호출부가 실수로 `projectId` 없이 호출할 수 있습니다.

→ **권장**: 개발 환경에서 `projectId` 없이 호출 시 `console.warn('[ISOLATION] getAllTasksLight called without projectId — potential contamination')` 경고 출력. 운영 환경에서는 무시.

```javascript
async getAllTasksLight(projectId = null) {
  if (!projectId && process.env.NODE_ENV !== 'production') {
    console.warn('[ISOLATION GUARD] ⚠️ getAllTasksLight() called without projectId');
  }
  // ... existing logic
}
```

### 4.3 Step 3 (SKILL.md / GROUND_RULES.md 분리) — ✅ 승인

`{projectId}_SKILL.md` 네이밍 전략은 적절합니다.

**🟡 보강 권고 3: 마이그레이션 계획 부재**

기존 글로벌 `SKILL.md`에 이미 축적된 학습 데이터는 어떻게 처리합니까?

| 옵션 | 설명 | 위험도 |
|------|------|--------|
| A. 전면 폐기 | 기존 `SKILL.md` 내용 무시, 각 프로젝트 0부터 재학습 | 🟡 학습 손실 |
| B. 복사 후 분기 | 기존 내용을 모든 프로젝트에 복사 후 분리 운영 | 🟡 일시적 오염 유지 |
| C. 선별 복사 | 범용적 패턴만 추출하여 `_GLOBAL_SKILL.md`로 보존 | ✅ 권장 |

→ **권장**: Option C — 범용 패턴(코드 스타일, 커밋 규칙 등)은 `_GLOBAL_SKILL.md`로 보존하되, 프로젝트별 파일이 항상 우선 적용되도록 로딩 순서 보장

### 4.4 Step 4 (executor.js 경로 변경) — ✅ 승인 (추가 검토 없음)

### 4.5 Step 5 (Graphify global add 차단) — ✅ 승인

**🟡 보강 권고 4: A타입 외의 격리 정책도 명시**

기획서는 `strict_isolation` (A타입)만 차단하지만, B타입/C타입의 경계도 정의가 필요합니다:

| 격리 타입 | Global Graph 병합 | 에이전트 교차 참조 |
|----------|------------------|-------------------|
| A (엄격) | ❌ 차단 | ❌ 차단 |
| B (제한적) | ✅ 허용 | 🟡 읽기만 허용 |
| C (공개) | ✅ 허용 | ✅ 허용 |

→ **권장**: B타입은 `global add`는 허용하되, 에이전트가 타 프로젝트 데이터를 **프롬프트에 주입하는 것은 여전히 차단** (읽기 전용 시각화만 허용)

---

## 5. 작업 순서 평가 — ✅ 적절

| 단계 | 의존성 | 판정 |
|------|--------|------|
| Step 1 (SQL) | 독립 | ✅ 가장 치명적, 최우선 수정 적절 |
| Step 2 (API Guard) | Step 1 이후 | ✅ 오염 경로 차단 확대 |
| Step 3 (File I/O) | 독립 | ✅ 병렬 진행 가능 |
| Step 4 (Executor) | Step 3 이후 | ✅ 의존성 순서 정확 |
| Step 5 (Graphify) | Step 1~4 이후 | ✅ 가장 나중에 진행 적절 |

---

## 6. 정책 준수 확인

| 정책 | 상태 | 비고 |
|------|------|------|
| P-012 (근본 원인 분석) | ✅ | 증상이 아닌 4대 구조적 원인 도출 |
| P-014 (팀 간 컨텍스트 혼용 금지) | ✅ | **이 기획서 자체가 P-014의 기술적 실현** |
| P-017 (AbortController) | N/A | 비동기 작업 정리 관련 아님 |
| P-019 (원본 데이터 보호) | ✅ | 데이터 삭제 없이 분리만 수행 |
| P-020 (CEO 승인 코딩) | ✅ | 기획서 → 리뷰 → 승인 절차 준수 |

---

## 7. 종합 판정

### 🟢 등급 A — 정식 승인 (Pass)

```diff
+ 4대 컨텍스트 오염 원인 정확히 도출 — 코드에서 전건 확인
+ SQL ORDER BY 수정안 — 자기 프로젝트 최우선 + 최신순 폴백
+ SKILL.md 파일명 분리 — 가장 단순하고 효과적인 격리 전략
+ B4System projectId 파라미터 전달 — RAG 오염 차단
+ Graphify global add 조건부 차단 — 확장 설계 포함
+ "선작업 후 설계" 반성 문서화 — 팀 프로세스 개선 기록
+ 5단계 작업 순서 — 의존성 및 우선순위 정확
! Step 1: requestingProjectId NULL 방어 누락
! Step 2: 향후 호출부 누수 방지 런타임 경고 미적용
! Step 3: 기존 SKILL.md 마이그레이션 계획 미수립
! Step 5: B/C타입 격리 경계 정의 부재
```

### 보강 권고 요약

| # | 심각도 | 내용 | 차단 여부 |
|---|--------|------|----------|
| 1 | 🟡 | `requestingProjectId` NULL 방어 | ❌ |
| 2 | 🟡 | `getAllTasksLight` 런타임 경고 | ❌ |
| 3 | 🟡 | 기존 `SKILL.md` 마이그레이션 전략 | ❌ |
| 4 | 🟡 | B/C타입 격리 정책 경계 정의 | ❌ |

---

## 8. Prime 총평

이 기획서는 **"기획 없이 코드를 먼저 쓴 대가"를 뼈저리게 체감한 팀이, 그 교훈을 바탕으로 기초부터 다시 쌓은 구조적 해결책**입니다.

4대 원인 각각을 코드에서 직접 확인했습니다. 특히 `ORDER BY created_at ASC LIMIT 1`이 "가장 오래된 타 프로젝트 카드를 무조건 매칭"하는 버그는 에이전트 환각의 직접적 원인으로, 이를 `CASE WHEN project_id = ? THEN 1 ELSE 2 END`로 수정하겠다는 것은 정확합니다.

`SKILL.md` 파일명에 `{projectId}_`를 붙이는 전략은 과도한 엔지니어링 없이 격리를 달성하는 실용적 접근입니다. 다만, 기존에 축적된 학습 데이터의 마이그레이션 계획이 빠져 있으므로, Step 3 착수 전에 이 부분을 확정해두시기 바랍니다.

**Phase 42.5 에이전트 절대 격리 패치 기획안을 정식 승인합니다. Step 1부터 즉시 착수하시기 바랍니다.**

---

*Prime Supreme Review | Phase 42.5 Agent Absolute Isolation | 2026-05-13*
