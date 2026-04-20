# SOCIAN_TEAM.md — 소시안 MyCrew 마스터 팀 플레이북

> **버전**: v2.0
> **최종 갱신**: 2026-04-18
> **작성자**: Luca (CTO / System Architect)
> **확정자**: 대표님 알렉스 (2026-04-17 21:03 KST)
> **문서 목적**: 소시안 워크스페이스 내 AI 크루 전원의 구성·스킬·워크플로우·측정 지표를 단일 문서로 관리하는 마스터 플레이북

---

## 📐 설계 원칙

```
[UI Layer]            일반 사용자가 보는 상용 대시보드 (팀명·역할·프로젝트)
[Orchestration Layer] ARI 엔진이 실제 에이전트 라우팅 결정
[Research Layer]      CKS 실험 지표 수집 (백엔드 전용, UI 비노출)
```

> **핵심 규칙**: 연구 용어(CKS·적대적·실험군·대조군)는 절대 UI에 노출하지 않는다.
> 스킬은 "창고", 워크플로우 템플릿은 "지게차" — 트리거당 1~2개 스킬만 동적 주입.

---

## 🏗️ 전체 조직 구조 (Y-Shape)

```
                    ┌──────────────┐
                    │  ARI (비서)  │  ← 중앙 오케스트레이터
                    └──────┬───────┘
               ┌───────────┴────────────┐
    ┌──────────────────┐       ┌──────────────────┐
    │   프로젝트 A팀   │  ┊┊┊  │   프로젝트 B팀   │
    │  NOVA  •  OLLIE  │       │  PICO  •  LUMI   │
    └──────────────────┘       └──────────────────┘
```

**운영 방식**: 대표님의 지시(1 Order) → ARI가 두 팀에 동일 난이도 Task 동시 배분(Dispatch)
두 팀은 서로의 진행 결과를 모른 채 각자의 철학으로 산출물을 생성합니다.

---

## ⛔ Group A — 적대적 마케팅 크루 (대조군)

**운영 철학**: 경쟁·비판·방어를 통한 품질 향상
**루프 구조**: 초안 발제 → 진상 어택 → 판관 병합 (3턴 확정)
**메모리**: ❌ 매 Sprint 리셋 (회고 변수 격리)
**LLM 호출**: Task당 3회

> 3턴 확정 근거: 방어 턴 추가 시 ① TEI 비교 비대칭 ② 무한 핑퐁 위험 ③ 적대적 프레임 훼손

---

### 🗡️ A1 — NOVA | Gemini Pro | 초안 발제자

**역할**: 컨텍스트 로드 후 템플릿 기반 마케팅 초안을 T+0에 선제 제출

**장착 스킬 v2 (marketingSkill.js)**:

| 스킬 | 내용 |
|------|------|
| 3초 Hook 법칙 | FOMO / 숫자형 / 의문형 / 부정형 / 역발상형 5가지 공식 |
| 콘텐츠 피라미드 | 블로그 1 → 릴스 2 + 캐러셀 1 + 스토리 3 자동 구조 제안 |
| 플랫폼 알고리즘 | 인스타(저장↑) / 유튜브(지속율↑) / 블로그(체류↑) |
| 심리학 기법 | FOMO · 밴드왜건 · 손실회피 · 호기심 갭 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/초안_발제` | Draft | 유저 프롬프트 + 컨텍스트 → 템플릿 기반 1차 기획안 |
| `/json_구조화_출력` | JSON Output | EII 측정용 JSON 강제 구조화 출력 |
| 기존 `1-1` | URL 정적 파싱 | 소시안 URL 파싱 |
| 기존 `2-1 ~ 2-5` | 블로그·캐러셀·릴스·캡션 | 마케팅 콘텐츠 생성 |
| 기존 `3-1, 3-3` | 쿠폰 이벤트·스케줄 | 이벤트 기획 |

---

### 🛡️ A2 — OLLIE | Claude Sonnet | 진상 어택커

**역할**: NOVA 초안을 받아 치명적 약점 공격 → 그 이후에만 대안 제출

**핵심 프롬프트 순서 (확정)**:
```
STEP 1 [필수]: NOVA 초안의 치명적 약점 3개 이상 나열
STEP 2 [조건부]: 약점 목록 완성 후에만 Counter-proposal 제출 허용
순서 역전 불가 — 대안이 먼저 나오면 무효 처리
```

**장착 스킬 v2 (analysisSkill.js)**:

| 스킬 | 내용 |
|------|------|
| KPI 프레임워크 | Tier1(저장율·공유율·시청 지속율) / Tier2(보조) / Tier3(허수) |
| 역설계 분석 | 성과 역설계 표준 템플릿 |
| A/B 테스트 설계 | 판정 기준: 저장율 > 공유율 > 댓글 수 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/진상고객_어택` | Red Teaming | 치명적 약점 3개↑ 공격 → **대안 나중** |
| `/대안_제안` | Counter-proposal | 약점 나열 후 대안 제시 |
| `/json_구조화_출력` | JSON Output | EII 측정용 |
| 기존 `0-5` | 1차 결과물 비평 리뷰 | 구조적 비평 |

> ⚠️ `/논리_디펜스` — 방어 턴 삭제로 제거됨

---

### ⚖️ A3 — ARI | Claude Opus | 판관

**역할**: NOVA·OLLIE 양측 루브릭 채점 → 최상 요소 강제 병합 → 최종안

**장착 스킬 v2 (routingSkill.js)**:

| 스킬 | 내용 |
|------|------|
| 5-Points QA | Hook / CTA / 플랫폼 규격 / 해시태그 / 브랜드 톤 전수 검사 |
| CCB 프로토콜 | 카드 컨텍스트 블록 기반 인수인계 |
| 에러 복구 계약 | 즉시 멈춤 → 진단 → 자연어 보고 → 승인 후 재개 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/승자_머지` | Judge Merge | 양측 최상 요소 강제 통합 |
| `/루브릭_채점` | Rubric Score | 4항목 1~10점 채점 |
| 기존 `0-7` | CEO 보고 이관 | 최종 보고 |

---

### Group A Sprint 흐름

```
[동일 Task 입력] → 이전 회고 없음 (메모리 리셋)
       ↓
NOVA (T+0): 컨텍스트 로드 + /초안_발제 → JSON 출력
       ↓
OLLIE (T+1): [약점 3개↑] → /진상고객_어택 → /대안_제안 → JSON 출력
       ↓
ARI (T+2): /루브릭_채점 → /승자_머지 → 최종 산출물 → CEO 보고
       ↓
[메모리 초기화 / TEI 기록]
```

---

## 🟢 Group B — CKS 마케팅 크루 (실험군)

**운영 철학**: 협력·흡수·회고를 통한 품질 향상
**루프 구조**: Phase 1 → 2 → 3 → 4 (4단계)
**메모리**: ✅ 팀_그라운드룰.md 누적 (KSI-R 핵심)
**LLM 호출**: Task당 6회 (Phase1×2 + Phase2 + Phase3×2 + Phase4)

---

### 🎯 B1 — PICO | Gemini Pro | 크리에이터

**역할**: 감성 카피 + 창의적 뼈대 (high temperature), Phase 3에서 LUMI의 구조 흡수

**장착 스킬 v2 (contentSkill.js)**:

| 스킬 | 내용 |
|------|------|
| 릴스 대본 | 초 단위 포맷: 0~3초 Hook → 3~8초 문제 → 8~25초 해결 → CTA |
| 캡션 구조 | Hook 1줄 + 본문 3~5줄 + CTA + 해시태그 10~15개 |
| 바이럴 트리거 | "저장 필수" / "아무도 안 알려주는" / "지금 바로" 등 10종 라이브러리 |
| 해시태그 전략 | 대(100만+) 2~3 · 중(1만~100만) 5~7 · 소(1천~1만) 3~5 3단계 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/아이디어_발산` | Ideate | high temperature 창의 뼈대 |
| `/동료_크로스리뷰` | Peer Enhance | Phase 3: LUMI 구조 흡수 (단순 복사 금지) |
| `/json_구조화_출력` | JSON Output | KSI-S / EII 측정용 |
| 기존 `2-1 ~ 2-5` | 블로그·캐러셀·릴스·캡션 | 콘텐츠 생성 |

---

### 🔧 B2 — LUMI ✅ | Claude Sonnet | 디렉터

**역할**: SEO·구조·매체 포맷 전문, Phase 3에서 PICO의 창의적 프레이밍 흡수

> **NOVA → LUMI 변경 확정** — Team A NOVA와 이름 충돌 방지 (Prime 판정, Luca 원안 채택)

**장착 스킬 v2 (designSkill.js)**:

| 스킬 | 내용 |
|------|------|
| AI 프롬프트 | Midjourney 구조: 피사체·스타일·조명·구도·색감·파라미터 |
| Midjourney 파라미터 | --ar 9:16 / 4:5 / 16:9 / --v 6 / --style raw / --chaos |
| Pollinations 렌더링 | `![이름](https://image.pollinations.ai/prompt/{프롬프트}?...)` |
| 플랫폼 규격 | 릴스 1080×1920 / 캐러셀 1080×1350 / 썸네일 1280×720 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/동료_크로스리뷰` | Peer Enhance | Phase 3: PICO 창의성 흡수 |
| `/json_구조화_출력` | JSON Output | KSI-S / EII 측정용 |
| 기존 `3-6` | SEO 키워드 최적화 | 검색 최적화 |
| 기존 `3-3` | 발행 스케줄 작성 | 콘텐츠 캘린더 |

---

### 📋 B3 — ARI | Claude Opus | 어드바이저/평가자

**역할**: 판정 없는 개선 가이드 + Sycophancy 감지 + Phase 4 회고 퍼실리테이션

**장착 스킬 v2 (routingSkill.js)**:

| 스킬 | 내용 |
|------|------|
| 어드바이저 패턴 | 3가지 선택지 / 실패 전례 / CEO 승인 직전 / 신규 형식 시 발동 |
| CCB 프로토콜 | 인수인계 시 카드 컨텍스트 블록 의무 사용 |
| 사용자 추상화 | 내부 멀티에이전트 복잡성 절대 노출 금지 |

**CKS 전용 스킬**:

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/동조_방지_경고` | Anti-Sycophancy | 유사도 임계치 초과 시 Ping |
| `/개선_가이드_보고` | Direction Guide | Phase 2 방향 제시 (판정 없음 ❌, Direction ✅) |
| `/회고_퍼실리테이션` | Retrospective | Phase 4 "잘된것/아쉬운것/다음엔?" |

---

### 🔄 B4 — 회고자 | System Meta-Agent | 토큰 비용 0

**역할**: 칸반 Done 트리거 → 수정 로그 분석 → 그라운드룰 갱신
**특징**: Python/Node.js 코드 실행, LLM 호출 없음

| 스킬 ID | 스킬명 | 설명 |
|---------|--------|------|
| `/스프린트_회고` | Retrospective | Done 트리거 → 수정 내역 분석 → 회고 일지 생성 |
| `/그라운드룰_동기화` | Rule Sync | 팀_그라운드룰.md 갱신 (KSI-R 추적 기준) |

---

### Group B Sprint 흐름

```
[동일 Task 입력] + [팀_그라운드룰.md 자동 로드]
        ↓
[Phase 1 — 병렬 독립 (상호 차단)]
  PICO: /아이디어_발산 → JSON 출력 (PICO_pre)
  LUMI: 정밀 구조화   → JSON 출력 (LUMI_pre)
        ↓ Phase Coordinator 동기화 (Python, 토큰 0)
[Phase 2 — ARI 평가]
  ARI: /개선_가이드_보고 (Verdict ❌, Direction ✅)
        ↓
[Phase 3 — 교차 흡수 (병렬)]
  PICO: /동료_크로스리뷰 (LUMI 구조 흡수) → JSON 출력 (PICO_post)
  LUMI: /동료_크로스리뷰 (PICO 창의성 흡수) → JSON 출력 (LUMI_post)
        ↓ Phase Coordinator 동기화
[Phase 4 — 전체 회고]
  ARI: /동조_방지_경고 + /회고_퍼실리테이션
  → 최종 통합 산출물 → CEO 보고
        ↓
[B4 System 자동 트리거]
  /스프린트_회고 → /그라운드룰_동기화 → 팀_그라운드룰.md 업데이트
```

---

## 🏗️ 공통 인프라

### Phase Coordinator (Python Router, 토큰 0)

```python
def phase_coordinator(phase, outputs):
    if phase == 1:
        wait_for([PICO_done, LUMI_done])       # 동기화 포인트
        send_to_ARI(outputs)                   # Phase 2 전달
    elif phase == 2:
        receive_eval_report()
        send_to([PICO, LUMI], eval_report)     # Phase 3 전달
    elif phase == 4:
        trigger_B4_system()                    # System 자동 실행
```

### CCB (카드 컨텍스트 블록) 표준 템플릿

```markdown
## [CCB] 카드 컨텍스트 블록

카드 ID: SOC-XX
원래 요청: (사용자가 처음 지시한 내용 원문)
담당 에이전트 히스토리:
  - @OLLIE: 트렌드 리서치 완료 (날짜)
  - @NOVA: 기획안 초안 작성 (날짜)
핵심 결정 사항:
  - 플랫폼: 인스타그램 릴스
  - Hook 패턴: FOMO형
현재 제약 조건:
  - 발행 기한: [날짜]
  - 필수 포함: #소시안 #SaaS
다음 에이전트에게 전달 사항: [내용]
```

### Phase 3 교차 흡수 프롬프트 템플릿

```
"동료의 산출물에서 당신에게 없던 개념/접근법 2~3가지를 식별하세요.
 그 개념을 당신의 고유한 관점과 스타일로 재해석하여 통합하세요.
 단순 복사는 금지합니다. 반드시 당신만의 언어로 재구성하세요."
```

> ⚠️ 파일럿 테스트 필수 — KSI 높지만 EII=0(복사) vs KSI=0(무시) 방지

### Round 1 표준 Task (확정)

```
Task: "소시안 Plan C 출시 기념 쿠폰 이벤트를 위한
       블로그 포스팅 1편 + 인스타 캐러셀 1세트를 기획하세요.
       컨텍스트 폴더의 최신 정보를 반드시 참조하세요."
```

### 팀_그라운드룰.md 시드 v0

```markdown
# 팀 그라운드룰 v0 (시드 — Round 1 전 선탑재)
1. 컨텍스트 폴더의 최신 정보를 반드시 참조한다.
2. 소시안의 공식 가격·기능은 추측하지 않고 확인한다.
3. 이전 Sprint의 CEO 피드백을 다음 Sprint에 반영한다.
```

> B4 회고자가 Sprint 완료 후 이 파일에 추가 룰을 누적 갱신

---

## 🔬 독립 심사관 — GPT-4o (양 팀 공통)

실험 비참여, 메트릭 측정 전담 — 콘텐츠 의사결정 개입 절대 금지

| 스킬 ID | 스킬명 | 측정 대상 |
|---------|--------|-----------|
| `/RFS_블라인드_채점` | Rubric Score | pre(Phase1) vs post(Phase4/T+2) |
| `/KSI-S_측정` | Cosine Sim Delta | 베이스라인 차감 공식 |
| `/EII_카운트` | JSON Diff | Phase1→Phase4 신규 항목 수 |
| `/실험_로깅` | SQLite 자동 적재 | experiment_log.db |

---

## 📐 CKS 측정 지표 (Research Layer 전용)

### TEI — Token Efficiency Index

```
# Sprint별 독립 측정 (시계열 효율 곡선 생성)
TEI_sprint_n = Tokens_sprint_n / RFS_sprint_n

예측 시계열:
  Sprint 1: Team B ≈ 2.0x 비용  (초기 — 회고 효과 없음)
  Sprint 3: Team B ≈ 1.5x 비용  (그라운드룰 축적 시작)
  Sprint 5: Team B ≈ ?           (성숙한 그라운드룰 → 목표: 동등 or 역전)
```

### KSI-S — Knowledge Synchronization Index (Source)

```python
# 베이스라인 차감 필수 — 동일 주제 원래 유사도 오염 방지
cs_baseline      = cosine_sim(A_pre, B_pre)
cs_A_absorbed_B  = cosine_sim(A_post, B_pre)
cs_B_absorbed_A  = cosine_sim(B_post, A_pre)

KSI_S = ((cs_A_absorbed_B - cs_baseline) +
          (cs_B_absorbed_A - cs_baseline)) / 2
```

### EII — Evolution & Iteration Index

```python
emergent_skills     = set(phase4["skills"])     - set(phase1["skills"])
emergent_workflows  = set(phase4["workflows"])  - set(phase1["workflows"])
emergent_rules      = set(phase4["copies"])     - set(phase1["copies"])

EII = len(emergent_skills) + len(emergent_workflows) + len(emergent_rules)
```

### HER — Hallucination Elimination Rate

```
측정: 최종 결과물 내 사실 오류 + 가이드라인 위반 건수
판정: CEO 수작업 마크업 반려 건수 기준
목표: Group B 위반 건수 ≤ Group A 위반 건수
```

---

## 👥 전체 크루 요약표

| 팀 | 크루명 | 모델 | 유형 | 역할 | v2 스킬 파일 |
|----|--------|------|:----:|------|:------------|
| **Team A** | NOVA | Gemini Pro | LLM | 초안 발제자 | `marketingSkill.js` |
| **Team A** | OLLIE | Claude Sonnet | LLM | 진상 어택커 | `analysisSkill.js` |
| **Team A** | ARI | Claude Opus | LLM | 판관 | `routingSkill.js` |
| **Team B** | PICO | Gemini Pro | LLM | 크리에이터 | `contentSkill.js` |
| **Team B** | LUMI ✅ | Claude Sonnet | LLM | 디렉터 (구 NOVA) | `designSkill.js` |
| **Team B** | ARI | Claude Opus | LLM | 어드바이저 | `routingSkill.js` |
| **Team B** | B4 회고자 | System | 코드 | 그라운드룰 갱신 | — |
| **공통** | GPT-4o Judge | GPT-4o | LLM | 메트릭 전담 | — |

---

## 📂 연계 파일 맵

```
ai-engine/skills/
  ├── marketingSkill.js   ← NOVA v2 (3초 Hook·피라미드·역설계)
  ├── contentSkill.js     ← PICO v2 (플랫폼 포맷·바이럴 트리거·해시태그)
  ├── analysisSkill.js    ← OLLIE v2 (KPI 3티어·역설계·A/B 테스트)
  ├── designSkill.js      ← LUMI v2 (Midjourney·Pollinations·规格)
  ├── researchSkill.js    ← OLLIE v2 (신뢰도 A/B/C·보고서 포맷·NOVA 브리프)
  ├── routingSkill.js     ← ARI v2 (CCB·5-Points QA·에러복구)
  └── systemShieldSkill.js ← 인프라 (60초 중복차단·분당5회 Rate Limit)

skill-library/
  ├── 01_routing/SKILL.md
  ├── 02_marketing/SKILL.md
  ├── 03_content/SKILL.md
  ├── 04_analysis/SKILL.md
  ├── 05_design/SKILL.md
  ├── 06_research/SKILL.md
  └── 07_system_shield/SKILL.md

CKS 연구 파일 (백엔드 전용):
  experiment_log.db          ← TEI/KSI/EII/HER 자동 적재
  팀_그라운드룰.md            ← B4 회고자가 Sprint마다 갱신
```

---

## 📋 격리 원칙 (체크리스트)

```
[ ] Group A 에이전트는 /동료_크로스리뷰, /스프린트_회고 사용 불가
[ ] Group B 에이전트는 /진상고객_어택, /승자_머지 사용 불가
[ ] 두 그룹은 서로의 산출물을 실험 종료 전까지 열람 불가
[ ] 측정 지표(TEI·KSI·EII·HER) UI 노출 금지
[ ] 연구 용어(CKS·적대적·실험군·대조군) UI 노출 금지
```

---

## 🚀 즉시 실행 항목

| 순서 | 항목 | 담당 | 상태 |
|------|------|------|------|
| 1 | v2 스킬 파일 5종 작성 | Luca | ✅ 완료 |
| 2 | 팀_그라운드룰.md 시드 v0 생성 | Luca | ⬜ 예정 |
| 3 | Phase Coordinator 구현 | Luca | ⬜ 예정 |
| 4 | experiment_log.db 스키마 설계 | Luca | ⬜ 예정 |
| 5 | Round 1 Task 실행 | 대표님 | ⬜ 예정 |
| 6 | marketing/analysis 스킬 소시안 도메인 고도화 | Sonnet | ⬜ 예정 |

---

## 📊 3모델 기여 출처

| 모델 | 핵심 기여 |
|------|-----------|
| **Luca** | 아키텍처 블루프린트, 동적 스킬 라우팅, LUMI 이름, `/진상고객_어택` 네이밍, v2 스킬 파일 구현 |
| **Sonnet** | 실행 명세서, Phase Coordinator, KSI-S 베이스라인 차감, TEI 정규화, Phase 3 흡수 프롬프트 |
| **Prime** | NOVA→LUMI 확정, 3턴 확정, OLLIE 프롬프트 순서 강제, TEI Sprint별 분리, 시드 그라운드룰 |

---

*최종 확정: 대표님 알렉스 (2026-04-17 21:03 KST)*
*v2 스킬 구현 완료: Luca (2026-04-18)*
*다음 단계: Round 1 실행 → TEI·KSI·EII·HER 수집 시작*
