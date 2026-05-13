---
description: Luca의 코드를 Claude Opus 등 고성능 모델에게 교차 검증(Peer Review)받기 위한 워크플로우
---

# Prime Advisor (Opus) 전용 리뷰 워크플로우

이 워크플로우는 비용(과금) 발생 없이 Antigravity 환경의 모델 변경(수동)을 활용하여 내부 코드의 무결성과 보안 취약점을 레드팀(Red Teaming) 관점에서 검증받는 공식 절차입니다.

## 0. 📋 [필수] Prime 컨텍스트 로딩 — 정책 동기화

> ⚠️ Prime(Opus)은 온디맨드로 호출되므로 정책 업데이트를 자동으로 받지 못합니다.
> 리뷰 시작 전 반드시 아래 파일을 읽어 정책 싱크를 맞추십시오.

**필수 읽기 (순서대로)**:
1. `01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md` — 전체 정책 인덱스 (last_updated 확인)
2. `01_Company_Operations/04_HR_온보딩/strategic_memory.md` — 모델 식별자·아키텍처 원칙

**리뷰 대상이 에이전트 ID / 팀빌딩 관련이면 추가 참조**:
- `02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md`

## 0.5 📊 [필수] Graphify 기반 영향도 분석 (CEO 지시, 2026-05-13)

> 🔴 **리뷰 시 반드시 Graphify 그래프를 활용해야 합니다.** grep/파일 읽기만으로 리뷰를 완료하는 것은 불충분합니다.

**리뷰 착수 전 필수 수행**:
1. `graphify-out/GRAPH_REPORT.md` 읽기 — God Nodes, Community 구조 파악
2. `graphify-out/graph.json`에서 변경 대상 파일의 **파급 반경(Blast Radius)** 추출 — import하는/import되는 파일 목록
3. 변경 대상이 God Node(상위 10개)에 해당하면 **추가 주의 판정** 부여
4. 의존성 경로(`imports_from`, `calls`, `contains`)를 통해 변경 전파 경로 분석

## 0.7 🔬 [필수] 멀티 렌즈 분석 (CEO 지시, 2026-05-14)

> 🔴 **보안/인프라 관점만으로는 불충분합니다.** Phase 44-2 리뷰에서 Prime은 2건만 발견했으나, Sonnet은 8건의 추가 결함(상태 모순, UX 흐름 단절, 권한 우회)을 발견했습니다. 이 교훈을 반영하여 아래 **6개 렌즈**를 반드시 적용하십시오.

**모든 리뷰에서 반드시 검증할 6개 관점**:

| # | 렌즈 | 핵심 질문 | 예시 결함 |
|---|------|----------|----------|
| 1 | **🔒 보안 (Security)** | 입력 검증, 권한 탈출, 인젝션 벡터가 있는가? | Shell Injection, Path Traversal, Prompt Injection |
| 2 | **🏗️ 아키텍처 (Architecture)** | God Node 비대화, 순환 참조, 모듈 경계 위반이 있는가? | Executor 1500줄, 크로스 모듈 변경 |
| 3 | **🔄 상태 정합성 (State Consistency)** | 상태 전이에 모순이 있는가? 충돌 시 우선순위가 정의되었는가? | ARCHIVED인데 배너 노출, 좀비 RUNNING 카드 |
| 4 | **👤 UX/사용자 흐름 (User Experience)** | 사용자가 실제로 이 기능을 쓸 때 혼란이 생기지 않는가? | Fork 후 어떤 카드를 봐야 하는지 모호 |
| 5 | **⚙️ 런타임 안정성 (Runtime Stability)** | 크래시, 타임아웃, 좀비 프로세스, 재시작 시나리오가 커버되는가? | 데몬 재시작 중 명령 충돌, PID 미스매치 |
| 6 | **📜 정책 준수 (Policy Compliance)** | P-002(ID 형식), P-006(모델 식별자), P-016(dangerously) 등 위반이 있는가? | qa_engineer(P-002 위반), 에이전트 본명 기입 |

---

## 1. 📝 리뷰 타겟(Target) 자동 생성
**대상(Target)**: Luca(Gemini) 또는 Sonnet이 작성한 모든 핵심 코어 아키텍처 및 보안 비즈니스 로직.
작업(코딩)을 마친 후, **절대 스스로 검증을 끝내지 않고** 아래 양식에 맞추어 `[Opus_Review_Target.md]` 파일을 생성합니다.
- 변경된 소스코드 원본 포함.
- 작업자(Luca/Sonnet)가 스스로 고민되는 Edge Case 및 공격 취약점 포인트 포함.

## 2. 🔄 (User) 모델 체인지 (Manual)
대표님은 작성된 `[Opus_Review_Target.md]` 아티팩트를 확인한 후, 안티그래비티 모델 선택 메뉴에서 모델을 **[Claude Sonnet 4.6 (Thinking)]** 또는 **[Claude Opus 4.6 (Thinking)]**로 변경합니다.

## 3. 🛡️ (User → Opus) 비판적 리뷰 명령
대표님은 변경된 모델에게 다음 프롬프트를 전송합니다.
> "현재 생성된 `[Opus_Review_Target.md]` 문서를 읽고, Prime Advisor로서 이 설계의 보안적 결함, 아키텍처 한계, 그리고 더 나은 Best Practice 대안을 비판적으로 도출해 줘."

## 4. 🛠️ (Luca) 피드백 수용 및 코드 수정
Opus의 비판(아티팩트 등)이 도출되면, 대표님은 다시 모델을 **[Gemini] (Luca)**로 복구합니다.
Luca는 Opus의 의견을 수용하여 최종 코드를 Refactoring 하고, `SUPREME_REVIEW_YYMMDD.md` 형태로 지식 뱅크에 백업합니다.
