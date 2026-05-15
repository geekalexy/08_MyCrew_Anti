---
description: Luca 또는 Sonnet의 코드/기획서를 고성능 모델(Opus, Sonnet Thinking 등)에게 교차 검증(Supreme Review)받기 위한 워크플로우
---

# 🛡️ Supreme Review 워크플로우 (강제 이행 버전)

> ## 🚨 이 워크플로우는 선택이 아닙니다
>
> **리뷰어(Prime/Sonnet/Luca)는 아래 단계를 순서대로 모두 완료해야 합니다.**  
> **단계를 건너뛰는 것은 P-020(무단 작업 금지) 위반과 동일하게 간주됩니다.**  
> 기획서만 읽고 리뷰를 완료했다고 선언하는 것은 **불완전 리뷰**이며 즉시 재수행해야 합니다.

---

## ✅ STEP 0 — 컨텍스트 로딩 (스킵 불가)

리뷰 첫 문장을 쓰기 전에 아래 파일을 **실제로 읽어야(view_file 호출)** 합니다.  
"이미 알고 있다"는 이유로 생략하는 것은 금지입니다.

**반드시 읽을 파일 (순서대로):**

| # | 파일 | 목적 |
|---|------|------|
| 1 | `01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md` | last_updated 확인, STRICT 정책 동기화 |
| 2 | `01_Company_Operations/04_HR_온보딩/strategic_memory.md` | 모델 식별자, 아키텍처 원칙 |

**리뷰 대상이 에이전트 ID/팀빌딩 관련이면 추가 필독:**
- `02_System_Development/V2_Core_Engine/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md`

---

## ✅ STEP 1 — 실제 코드 파일 읽기 (스킵 불가)

> 🔴 **기획서(PRD)만 읽고 리뷰하는 것은 불완전 리뷰입니다.**  
> 기획서가 참조하는 **실제 소스 코드 파일을 반드시 view_file 또는 grep_search로 직접 확인**해야 합니다.

**수행 방법:**
1. 리뷰 대상 기획서/문서에서 언급된 파일명을 모두 추출한다.
2. 각 파일을 `view_file` 도구로 실제 읽는다.
3. 기획서의 설명과 실제 코드 간의 괴리가 없는지 대조한다.

**예시 — Phase43-4 PRD 리뷰 시 필독 파일:**
```
ai-engine/tools/contextInjector.js   → buildAutoRunContext() 실제 구현 확인
ai-engine/executor.js                → Task Master 루프 핸들러 존재 여부 확인  
ai-engine/tools/scrubbing.js         → sanitize() 함수 실제 동작 확인
ai-engine/services/contextChainService.js → 체이닝 로직 확인
```

**이 단계를 건너뛰었다면 리뷰를 멈추고 처음부터 다시 시작하십시오.**

---

## ✅ STEP 2 — Graphify 기반 Blast Radius 분석 (스킵 불가)

> 🔴 grep/파일 읽기만으로 리뷰를 완료하는 것은 불충분합니다.  
> Graphify MCP 도구를 **반드시 호출**해야 합니다.

**수행해야 할 Graphify 도구 호출 (최소 3개):**

| 호출 도구 | 목적 |
|-----------|------|
| `mcp_graphify_god_nodes(top_n=10)` | God Node 목록 확인 — 변경 대상 포함 여부 판단 |
| `mcp_graphify_get_neighbors(label=변경대상파일)` | 직접 의존 파일 목록 추출 |
| `mcp_graphify_query_graph(question=리뷰핵심키워드)` | 영향 받는 Community 전파 경로 분석 |

**God Node 해당 시 → 보고서에 "🔴 GOD NODE 경보" 섹션 추가 필수**

---

## ✅ STEP 3 — 6개 렌즈 분석 (모두 적용, 스킵 불가)

> 🔴 "해당 없음"으로 처리하려면 그 이유를 한 문장 이상 명시해야 합니다.  
> 이유 없이 렌즈를 생략하는 것은 불완전 리뷰입니다.

**반드시 적용할 6개 관점:**

| # | 렌즈 | 핵심 질문 | 예시 결함 |
|---|------|----------|----------|
| 1 | **🔒 보안 (Security)** | 입력 검증, 권한 탈출, 인젝션 벡터가 있는가? | Shell Injection, Prompt Injection |
| 2 | **🏗️ 아키텍처 (Architecture)** | God Node 비대화, 순환 참조, 모듈 경계 위반이 있는가? | Executor 1500줄, 크로스 모듈 변경 |
| 3 | **🔄 상태 정합성 (State Consistency)** | 상태 전이에 모순이 있는가? 충돌 우선순위가 정의되었는가? | 좀비 RUNNING 카드, 상태 충돌 |
| 4 | **👤 UX/사용자 흐름 (User Experience)** | 사용자가 실제로 이 기능을 쓸 때 혼란이 생기지 않는가? | Fork 후 어떤 카드를 봐야 하는지 모호 |
| 5 | **⚙️ 런타임 안정성 (Runtime Stability)** | 크래시, 타임아웃, 좀비 프로세스, 재시작 커버가 되는가? | 데몬 재시작 중 명령 충돌 |
| 6 | **📜 정책 준수 (Policy Compliance)** | P-002(ID 형식), P-006(모델 식별자), P-016(dangerously) 위반이 있는가? | 하드코딩 모델 식별자 |

**각 렌즈마다 최소 1건 이상의 결함 또는 "이상 없음 + 근거" 를 명시해야 합니다.**

---

## ✅ STEP 4 — 자가 점검 게이트 (보고서 제출 전 필수)

리뷰 보고서를 저장하기 **직전**, 아래 체크리스트를 내부 사고(Thought)에서 점검하십시오.  
하나라도 No이면 해당 단계로 돌아가 보완한 후 저장합니다.

```
[ ] STEP 0: POLICY_INDEX.md와 strategic_memory.md를 실제로 view_file 했는가?
[ ] STEP 1: 기획서가 언급한 소스 코드 파일을 최소 1개 이상 직접 읽었는가?
[ ] STEP 2: Graphify MCP 도구를 최소 3회 호출했는가?
[ ] STEP 3: 6개 렌즈 모두 섹션이 존재하는가? (해당 없음도 근거 명시)
[ ] 보고서 헤더에 리뷰어 이름, 리뷰 대상, 리뷰 일시, 이전 리뷰 파일명이 있는가?
[ ] 결함 요약 매트릭스(표)가 포함되어 있는가?
```

---

## ✅ STEP 5 — 보고서 저장 (규칙 엄수)

**저장 경로 (절대 변경 금지):**
```
02_System_Development/V2_Core_Engine/00_아키텍처_문서/06_리뷰_아카이브/
```

**파일명 형식 (절대 임의 변경 금지):**
```
[일련번호]_[리뷰대상_키워드]_SupremeReview_[리뷰어이름]_[YYYY-MM-DD].md
```

| 리뷰어 | 이름 토큰 | 파일명 예시 |
|--------|-----------|------------|
| Luca (Gemini) | `Luca` | `53_Phase43-4_SupremeReview_Luca_2026-05-16.md` |
| 소넷 (Claude Sonnet) | `Sonnet` | `53_Phase43-4_SupremeReview_Sonnet_2026-05-16.md` |
| 프라임 (Claude Opus) | `Prime` | `53_Phase43-4_SupremeReview_Prime_2026-05-16.md` |

**일련번호**: `06_리뷰_아카이브/` 내 마지막 파일 번호 + 1  
→ 저장 전 반드시 `ls 06_리뷰_아카이브/` 로 마지막 번호를 확인할 것

**보고서 헤더 필수 항목 (없으면 저장 금지):**
```markdown
**리뷰어**: [이름 (모델명)]
**리뷰 대상**: `[파일명]`
**리뷰 일시**: YYYY-MM-DD
**이전 리뷰**: `[이전 파일명]` (없으면 "최초 리뷰"로 명시)
```

---

## ✅ STEP 6 — 저장 완료 보고 (대표님께 반드시)

저장 후 대화창에 다음 형식으로 보고합니다:

```
📁 리뷰 완료 저장:
경로: 02_System_Development/.../06_리뷰_아카이브/[파일명]
결함: CRITICAL [N]건 / HIGH [N]건 / MEDIUM [N]건 / LOW [N]건
구현 착수 전 필수 해결: [N]건
```

---

## 📋 워크플로우 전체 흐름 요약

```
STEP 0: 정책 파일 읽기 (view_file 필수)
   ↓
STEP 1: 관련 소스 코드 직접 읽기 (view_file 필수)
   ↓
STEP 2: Graphify 도구 최소 3회 호출
   ↓
STEP 3: 6개 렌즈 모두 분석
   ↓
STEP 4: 자가 점검 체크리스트 통과
   ↓
STEP 5: 06_리뷰_아카이브/ 에 저장 (파일명 형식 엄수)
   ↓
STEP 6: 대표님께 결과 보고
```

---

> **[반복 위반 발생 시]**  
> 소넷 또는 프라임이 이 워크플로우를 연속 2회 이상 불완전 이행한 경우,  
> 대표님은 해당 모델에게 "supreme_review_workflow.md를 다시 읽고 STEP 0부터 재수행하라"고 명령하십시오.  
> 에이전트는 변명 없이 즉시 재수행해야 합니다.
