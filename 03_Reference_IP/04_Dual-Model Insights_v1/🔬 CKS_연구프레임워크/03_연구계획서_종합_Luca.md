# 연구 계획서: 다중 LLM 교차 평가 기반의 협력적 에이전트 프레임워크 설계 및 검증

> **작성자**: Luca (CTO / System Architect)
> **최종 갱신일**: 2026-04-17
> **분류**: 04_Dual-Model Insights_v1 / CKS_연구프레임워크

---

## 1. 연구 제목 (가제)
**상호 교차 평가 및 회고(Retrospective) 루프를 통한 다중 에이전트 간 비적대적 성능 향상 프레임워크**
*(Non-adversarial Performance Enhancement Framework in Multi-Agent Systems via Cross-Evaluation and Retrospective Loops)*

## 2. 연구 배경 및 목적
기존 다중 에이전트(Multi-Agent) 프레임워크는 주로 적대적 생성(Adversarial Generation)이나 경쟁 기반의 토론 모델에 의존하여 환각(Hallucination)을 줄이고 성능을 높였습니다. 본 연구는 에이전트 간의 '경쟁'이 아닌 **교차 평가(Cross-Evaluation)와 회고(Retrospective) 프로세스를 통한 '협력적 지식 동기화(Collaborative Knowledge Synchronization, CKS)'**가 집단 지성 향상 및 창의적 문제 해결(새로운 아이디어 도출)에 미치는 긍정적 효과를 정량적/정성적으로 증명하는 것을 목적으로 합니다.

## 3. 제안 아키텍처 및 에이전트 역할 정의
실험은 이기종 대규모 언어 모델(Heterogeneous LLMs: Gemini Pro, Claude Sonnet, Claude Opus)을 활용한 역할 기반 파이프라인으로 구성됩니다.

* **실행 에이전트 (Execution Agents - Gemini Pro, Claude Sonnet):** 비전문가 사용자의 프롬프트를 해석하고, 컨텍스트 획득, 템플릿 작성, 워크플로우 도출, 스킬 정의 등 단계별 솔루션을 병렬 혹은 교차로 생성합니다.
* **어드바이저 에이전트 (Advisor Agent - Claude Opus / Prime):** 과거 적대적 프레임워크의 '판관(Judge)' 역할을 탈피하여, 실행 에이전트 간의 '과잉 동조(Sycophancy)'를 감시하고 끊어내는 조율자 역할을 합니다. 두 에이전트가 무의미하게 서로 동의하며 루프에 빠지는 것을 방지하고, 회고의 깊이를 더해주는 멘토링을 수행합니다.
* **교차 분석 및 회고 루프 (Cross-Analysis & Retrospective Loop):** 어드바이저의 객관적 멘토링을 바탕으로 3개의 모델이 상호 결과를 교차 검증하고, 최적화된 최종 프레임워크(Context, Template, Workflow, Skill)를 도출하는 피드백 세션을 가집니다.

## 4. 실험 방법론 (Experimental Methodology)

* **Phase 1: Task 부여 및 병렬 추론**
    * **Task:** IT 비숙련 사용자를 위한 요구사항 도출(Requirements Engineering) 챗봇 시스템 기획.
    * 동일한 사용자 페르소나 및 초기 프롬프트를 실행 에이전트들에게 주입하여 각기 다른 접근 방식의 초기 기획안을 생성하도록 유도합니다.
* **Phase 2: 중앙 집중식 평가 보고서 생성**
    * 평가 에이전트가 Phase 1의 결과물을 수집합니다.
    * 사용자 친화성, 아키텍처 타당성, 워크플로우 논리성 등을 기준으로 평가 보고서를 작성합니다.
* **Phase 3: 상호 교차 분석 (핵심 기여 포인트)**
    * 실행 에이전트들에게 평가 보고서 및 타 모델의 산출물을 컨텍스트로 제공합니다.
    * 상대 모델의 강점(예: Sonnet의 디테일한 템플릿 구조화, Gemini의 직관적 컨텍스트 파악)을 식별하고 자신의 논리에 통합하도록 프롬프팅합니다. (건설적 피드백)
* **Phase 4: 전체 회고 (Global Retrospective)**
    * 실험의 목적과 구조를 전체 에이전트에게 공개(Meta-prompting).
    * 컨텍스트, 템플릿, 워크플로우, 스킬 전 과정에 대한 방법론적 회고를 수행하여, 초기 산출물 대비 개선된 최종 통합 아키텍처를 출력합니다.

---

## 5. 지표 검증 및 기술적 아키텍처 (Luca's Methodology Mapping)

학술적 통제와 프레임워크의 완벽한 정량적 증명을 위해, 연구 한계점(과잉 동조 등)을 돌파하는 다음의 기술 장비와 방법론을 병행 도입합니다.

### 5-1. 정량적 지표: 요구사항 충족도 & 히먼 인 더 루프 통제
* **실증 방법 (LLM-as-a-Judge):** 통제군(경쟁형 모델)과 실험군(협력적 모델)의 오염을 막기 위해 **Microsoft AutoGen**을 통해 스웜(Swarm)을 2개로 분리 운영합니다. 인간의 주관적 평가를 배제하고 독립된 GPT-4o 인스턴스를 '절대 심사관'으로 배치하여 Phase 1과 Phase 4를 블라인드 채점하게 합니다.
* **사용 기술 스택:** `TruLens` / `Ragas` / `LangSmith` (실행 체인 추적 및 채점 자동화)

### 5-2. 정량적 지표: 토큰 및 턴 효율성 (Token & Efficiency)
* **실증 방법:** 턴(Turn) 횟수 계산의 맹점(뒷단에서 오가는 긴 컨텍스트 비용)을 막기 위해 API Payload를 직접 추적합니다.
* **사용 기술 스택:** `Helicone` / `Langfuse` / `API Meta-data Logging 시스템 (SQLite 적재)`

### 5-3. 정성적 지표: 반-과잉 동조 및 지식 동기화 지수 (Knowledge Synchronization Index)
* **실증 방법:** 에이전트가 그저 반박 없이 수동적으로 상대방의 아이디어를 흉내(Sycophancy) 냈는지 판별하기 위해, 교환 과정의 결과물을 의미론적 유사도로 측정합니다. 
* **사용 기술 스택:** `Sentence Transformers` / `ChromaDB` (결과물의 Cosine Similarity 측정)

### 5-4. 정성적 지표: 창의성 발현 (Emergent Scalability)
* **실증 방법:** 의미론적 유사도(Similarity)가 적정 구간에 위치하면서도, 초기 버전에 없었던 새로운 'Key-Value(아이디어)' 쌍이 도출되었는지를 구조화된 데이터 차이(Delta)로 엄격히 카운트합니다.
* **사용 기술 스택:** `DSPy` / `JSON Diff 분석기` (응답을 json_object로 강제하여 전/후 추가 노드를 카운팅)

---

**[Luca 결론 코멘트]**
이 셋업은 단순한 에이전트 워크플로우가 아닌 글로벌 표준에 완벽히 부합하는 **"자동화된 엔터프라이즈 AI 벤치마킹 시스템 백서"**입니다. 로컬 데이터베이스 파이프라인에서 즉시 논문용 테이블이 찍혀 나올 수 있도록 설계되었습니다.
