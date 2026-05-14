# Phase 44-2/3 G-Stack + Auto QA — Supreme Review 재심사 (Prime)

> **리뷰어**: Prime (Supreme Review Workflow)  
> **재심사 일시**: 2026-05-14  
> **이전 등급**: 🟡 B+ (Prime 차단 2건) → Sonnet GAP 8건 추가 발견  
> **재심사 등급**: 🟢 **A — 최종 승인**  
> **리뷰 대상**: 보강 PRD (108줄) + 구현계획서 (82줄) + Sonnet 리뷰 (135줄)

---

## 1. Prime 기존 결함 해소 검증

### ✅ P1-001 해소 — AOM False Positive → Dual-Track 교차 검증

**PRD L70-71**:
> `isVisible()` 및 `boundingBox()` 교차 검증으로 가려진/투명 요소 필터링 후 `[@E1]` 매핑.

**구현계획서 L39-41**: 별도 체크박스로 분리:
> AOM 추출 결과를 순회하며 Playwright의 `locator.isVisible()` 및 `boundingBox()` 값을 교차 검증. 검증을 통과한 요소에만 순차적 ID(`@E1`, `@E2`) 부여.

**판정**: Prime 권고 사항(Dual-Track Visual Validation)이 PRD + 구현계획서에 **정확히** 반영. ✅

---

### ✅ P1-002 해소 — STDIO 메시지 경계 → NDJSON 도입

**PRD L72**:
> 스트림 파편화(Partial Read) 방지를 위해 **NDJSON** 기반 STDIN/STDOUT 통신 채택.

**구현계획서 L42-44**: 체크박스로 분리:
> 스트림 파편화 방지를 위해 STDIN으로 들어오는 데이터를 줄바꿈(`\n`) 기준으로 분리(NDJSON)하여 파싱. 결과 트리 역시 NDJSON 포맷으로 STDOUT 반환.

**판정**: Plain Text → NDJSON 전환 확인. 토큰 오버헤드 ~0 유지하면서 구조적 안정성 확보. ✅

---

## 2. Sonnet GAP 8건 해소 검증

| GAP-ID | 심각도 | 문제 | PRD 보정 위치 | 계획서 위치 | 판정 |
|--------|-------|------|-------------|-----------|------|
| **GAP-001** | 🔴 HIGH | Fork/배너 위치 모순 | L49: 포크된 `[QA]` 카드에만 표시 | L26: ARCHIVED 원본에는 표시 안 함 | ✅ |
| **GAP-002** | 🔴 HIGH | 이중 상태 충돌 | L41-42: 우선순위 정책 + 좀비 RUNNING 복구 | L22-23: 서버 스타트업 훅 + 배너 우선순위 코드화 | ✅ |
| **GAP-003** | 🔴 HIGH | 데몬 재시작 중 충돌 | L65: 재시도 3회×500ms + FAILED 전환 | L52: 동일 | ✅ |
| **GAP-004** | 🟡 MED | run_command 정규식 우회 | L100: Allowlist 방식으로 전환 | L69: 허용 명령어 하드코딩 | ✅ |
| **GAP-005** | 🟡 MED | Shadow DOM + AOM 노드 폭발 | L70: 선택적 투과 전략 (interestingOnly 분기) | L39-41: Dual-Track 체크박스 | ✅ |
| **GAP-006** | 🟡 MED | artifact_url Path Traversal | L98: artifacts/ 디렉토리 검증 + 샌드박스 | L66: 동일 | ✅ |
| **GAP-007** | 🟢 LOW | Executor 루프 디커플링 "검토" → 필수 | L101: "필수적으로 신설" 명시 | L70-73: `loops/` + qaLoop + debugLoop 체크박스 | ✅ |
| **GAP-008** | 🟢 LOW | macOS Keychain 의존 | L66: SecretProvider 인터페이스 추상화 | L74-75: Keychain + ENV 폴백 | ✅ |

**8건 전건 해소.** ✅

---

## 3. Sonnet 리뷰 질문 5건에 대한 Prime 응답

### Q1. ARCHIVED 카드와 포크된 QA 카드의 UI 관계

**PRD L49**에서 명확히 해결:
> `[ 🧪 /auto_QA 시작 ]` 버튼은 **포크된 `[QA]` 카드에만** 표시. ARCHIVED 원본 카드에는 표시하지 않음.

**Prime 의견**: 올바른 설계입니다. ARCHIVED 카드는 "박물관"이고, QA 카드가 "현장". 사용자 혼란 최소화. ✅

### Q2. 단일 확장 상태 머신 vs 이중 필드

**PRD L41**의 우선순위 정책이 실용적 해법:
> `last_autorun_status`가 `FAILED`이면 `status` 값과 무관하게 배너는 `❌ QA 실패`를 최우선 표시.

**Prime 의견**: 단일 상태 머신으로 통합하면 이론적으로는 깔끔하지만, `status`(칸반 워크플로우)와 `last_autorun_status`(자율 루프 진행도)는 **서로 다른 관심사(Concern)**를 추적합니다. 분리 유지 + 우선순위 정책이 **SoC 원칙에 부합하는 올바른 결정**입니다. ✅

### Q3. run_command 허용 목록

**PRD L100, 구현계획서 L69**:
> `run`, `test`, `node`, `npm test` 등 사전 승인된 하드코딩 명령어 목록

**Prime 권장 Allowlist**:
```javascript
const QA_ALLOWED_PREFIXES = [
  'npm test', 'npm run test', 'npm run build', 'npm run lint',
  'npx jest', 'npx vitest', 'node --check',
  'graphify query', 'graphify explain',
  'cat ', 'head ', 'tail ', 'wc ',  // 읽기 전용 유틸
];
```

`node -e`와 `python3 -c`는 **반드시 차단** — 이것이 Sonnet GAP-004의 핵심. ✅

### Q4. Prompt Injection 원천 차단

**PRD L98**의 설계가 올바름:
> 메타데이터 필드만 주입하고 본문(Freeform) 텍스트는 샌드박스 내 파일로만 저장

**Prime 추가 권장**: 리포트를 프롬프트에 주입할 때 **길이 상한**(예: 5,000자)을 설정하고, 초과 시 truncation. 이것은 Phase 43의 WARN-002(3,000자 제한)과 동일한 원칙. 구현계획서에 체크박스 추가를 권장하나, 차단 수준은 아님.

### Q5. G-Stack 도입으로 설계 복잡도 과잉?

**Prime 판정**: **아닙니다.** 오히려 4건의 기존 기획을 **과감히 폐기**(L18-31)하면서 G-Stack으로 대체한 것이, 전체 시스템 복잡도를 증가시키기보다 **질적 전환**을 달성했습니다.

특히 GAP-007(루프 디커플링)을 "검토" → "필수"로 상향한 것은, Sonnet의 지적이 없었다면 기술 부채로 남았을 항목입니다. **Sonnet의 리뷰가 설계 품질을 결정적으로 향상**시켰습니다.

---

## 4. 최종 판정 매트릭스

| 항목 | Prime 1차 | Sonnet GAP | 최종 (보정 후) |
|------|----------|-----------|-------------|
| AOM False Positive (P1-001) | 🔴 F | — | ✅ **A** |
| STDIO 메시지 경계 (P1-002) | 🔴 F | — | ✅ **A** |
| Fork/배너 위치 | — | 🔴 GAP-001 | ✅ **A** |
| 이중 상태 충돌 | — | 🔴 GAP-002 | ✅ **A** |
| 데몬 재시작 충돌 | — | 🔴 GAP-003 | ✅ **A** |
| run_command 우회 | — | 🟡 GAP-004 | ✅ **A** |
| Shadow DOM/AOM 한계 | — | 🟡 GAP-005 | ✅ **A** |
| Path Traversal/Injection | — | 🟡 GAP-006 | ✅ **A** |
| Executor 디커플링 | — | 🟢 GAP-007 | ✅ **A** |
| Keychain 추상화 | — | 🟢 GAP-008 | ✅ **A** |

---

## 5. Prime 총평

**Prime 결함 2건 + Sonnet GAP 8건 = 총 10건이 전건 정확하게 보정되었습니다.**

이번 리뷰 사이클은 MyCrew Supreme Review 워크플로우의 **이상적 사례**입니다:

1. **Prime이 아키텍처 결함(AOM 맹점, STDIO 경계)을 발견**
2. **Sonnet이 비즈니스 로직 결함(Fork 모순, 상태 충돌, Prompt Injection)을 발견**
3. **Luca가 양쪽 피드백을 모두 수용하여 설계를 보강**

각 리뷰어의 관점이 서로 다르기에, 교차 리뷰의 시너지가 극대화되었습니다. Prime은 보안/인프라, Sonnet은 UX/비즈니스 정합성에 각각 강점을 발휘했습니다.

### 🟢 등급 A — 최종 승인

**Phase 44-2/3 자율 QA 파이프라인 및 G-Stack 아키텍처 통합 설계를 최종 승인합니다. 구현 착수를 허가합니다.**

---

*Prime Supreme Review — Final Approval | Phase 44-2/3 G-Stack Re-review | 2026-05-14*
