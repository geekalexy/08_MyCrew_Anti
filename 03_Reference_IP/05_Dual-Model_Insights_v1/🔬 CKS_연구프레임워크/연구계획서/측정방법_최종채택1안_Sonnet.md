# 측정 방법 최종 채택안
## 루카 제안 + 소넷 검토 교차 결과

> 작성자: 소넷 (Claude Sonnet 4.6)
> 작성일: 2026-04-17
> 근거: `측정방법_기술제안_Luca.md` × `검토의견_Sonnet.md` 교차 검토
> 상태: 논문 Section 5 반영 권장안

---

## 최종 채택 측정 스택

| 지표 | 측정 방법 | 도구 | 채택 근거 |
|------|---------|------|---------|
| **RFS** 요구사항 충족도 | GPT-4o 블라인드 루브릭 채점 | LangSmith + TruLens | 순환 편향 해결 ✅ |
| **TEI** 토큰 효율 | API `usage` 직접 로깅 + RFS 앵커링 | SQLite + Python | 재현성 높음 ✅ |
| **KSI** 지식 동기화 | 코사인 유사도 **델타** (베이스라인 차감 필수) | Sentence Transformers + FAISS | 의미론적 측정 ✅ |
| **EII** 창발 아이디어 | JSON Diff 자동 카운트 | `response_format` + Python diff | 구현 단순, 재현 가능 ✅ |

---

## 1. RFS — 요구사항 충족도 (Requirement Fulfillment Score)

### 채택 이유
루카 제안 중 **순환 편향 문제를 가장 정확히 해결**한 항목.
실험 참여 모델(Gemini Pro, Claude Sonnet) 외의 독립 모델을 Judge로 배치.

### 구현 방식
```
Judge 모델: GPT-4o (실험 비참여 모델)
           또는 격리된 Opus 인스턴스 (별도 API 키, 별도 세션)

평가 방식: Phase 1 산출물 vs Phase 4 산출물 블라인드 제출
           어느 쪽이 Phase 1인지 Judge가 모르게 랜덤 순서 제출

루브릭 (1~10점):
  - 컨텍스트 명확성 (Context Clarity)
  - 템플릿 실용성 (Template Practicality)
  - 워크플로우 완결성 (Workflow Completeness)
  - 스킬 정의 정확성 (Skill Definition Accuracy)

최종 RFS = 4개 항목 평균
```

### 도구
- **LangSmith**: 체인 추적, 라벨링, 채점 이력 관리
- **TruLens**: 자동화된 평가 루프 구성 (Ragas는 부적합 — RAG 전용이므로 제외)

---

## 2. TEI — 토큰 및 턴 효율성 (Token & Turn Efficiency)

### 채택 이유 + 보완 조건

루카 제안은 유효하나, **"동일한 품질"** 기준이 명시되지 않으면 비교 불가.
**RFS 점수를 앵커로** 사용하면 해결됨.

### 구현 방식
```
비교 실험:
  단일 에이전트 조건: RFS ≥ X점에 도달할 때까지 사용자와 반복 대화
  CKS 조건:          Phase 1~4 전체 파이프라인 1회 실행

측정값:
  - 총 누적 토큰 수 (Prompt + Completion)
  - 총 사용자-에이전트 간 턴(Turn) 수

TEI = RFS 점수 ÷ (총 토큰 수 / 1,000)
      (높을수록 = 적은 토큰으로 높은 품질)
```

### 도구
```python
# Helicone/Langfuse 대신 → 재현성이 높은 로컬 SQLite 로깅
import sqlite3, json

conn = sqlite3.connect("experiment_log.db")
conn.execute("""
  CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT, phase INT, model TEXT,
    prompt_tokens INT, completion_tokens INT,
    turn_count INT, rfs_score REAL,
    timestamp TEXT
  )
""")

# API 응답에서 usage 추출
usage = response.usage
conn.execute("INSERT INTO runs VALUES (?,?,?,?,?,?,?,?)",
  (run_id, phase, model,
   usage.prompt_tokens, usage.completion_tokens,
   turn_count, rfs_score, timestamp))
```

---

## 3. KSI — 지식 동기화 지수 (Knowledge Synchronization Index)

### 채택 이유 + 필수 보정

루카의 Sentence Transformers 접근이 타당하나,
**베이스라인 차감 없이는 측정값이 오염됨.**

### 핵심 문제
```
같은 주제(e.g. "마케팅 온보딩 설계")를 받으면
교차 평가 전에도 두 에이전트 출력은 원래 유사함.
→ 이 원래 유사도를 빼야 "교차 평가로 인한 추가 동기화"가 나옴.
```

### 수정 공식

```python
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

model = SentenceTransformer('paraphrase-multilingual-mpnet-base-v2')  # 한국어 지원

# 임베딩
A_pre  = model.encode([agent_A_phase1_output])
B_pre  = model.encode([agent_B_phase1_output])
A_post = model.encode([agent_A_phase3_output])
B_post = model.encode([agent_B_phase3_output])

# 베이스라인 유사도
baseline_A = cosine_similarity(A_pre, B_pre)[0][0]  # 교차 전 원래 유사도
baseline_B = cosine_similarity(B_pre, A_pre)[0][0]

# 교차 후 유사도
post_A = cosine_similarity(A_post, B_pre)[0][0]  # A가 B를 얼마나 흡수했나
post_B = cosine_similarity(B_post, A_pre)[0][0]  # B가 A를 얼마나 흡수했나

# 델타 KSI (베이스라인 차감)
KSI_A = post_A - baseline_A
KSI_B = post_B - baseline_B
KSI   = (KSI_A + KSI_B) / 2

# KSI > 0.1:  유의미한 지식 동기화
# KSI → 0:   교차 평가가 실질적 영향 없음
# KSI < 0:   오히려 발산 (의견 분기 심화)
```

### 도구
- **Sentence Transformers** (`paraphrase-multilingual-mpnet-base-v2`): 한국어 포함 다국어 지원
- **FAISS**: Phase가 누적될수록 임베딩 저장·검색에 활용
- ChromaDB는 소규모 실험에서는 불필요 (FAISS만으로 충분)

---

## 4. EII — 창발 아이디어 지수 (Emergent Idea Index)

### 채택 이유
루카 제안 중 **가장 우아하고 즉시 구현 가능한** 항목.
JSON Diff는 구현 단순하고 논문 Figure로 직접 활용 가능.

### 구현 방식
```python
import json

# 모든 Phase에서 에이전트 출력을 JSON으로 강제
# (response_format={"type": "json_object"} — OpenAI/Anthropic 공통 지원)

schema = {
  "skills": [],      # ["컨텍스트 수집", "카피작성", ...]
  "workflows": [],   # ["D-Day 기획", "크로스체크 모드", ...]
  "rules": []        # ["SSOT 필수 참조", ...]
}

phase1 = json.loads(agent_output_phase1)
phase4 = json.loads(agent_output_phase4)

# Delta 추출
emergent_skills    = set(phase4["skills"])    - set(phase1["skills"])
emergent_workflows = set(phase4["workflows"]) - set(phase1["workflows"])
emergent_rules     = set(phase4["rules"])     - set(phase1["rules"])

EII = len(emergent_skills) + len(emergent_workflows) + len(emergent_rules)

print(f"창발 아이디어: {EII}건")
print(f"  스킬: {emergent_skills}")
print(f"  워크플로우: {emergent_workflows}")
```

> **DSPy는 이 단계에서 불필요.** 네이티브 `response_format`으로 충분하며,
> 초기 실험에서 DSPy 도입은 재현성 위험 증가.

---

## 5. 실험 자동화 아키텍처 (최종)

```
[입력] 동일 Task → A팀(격리) / B팀(격리)
         ↓
[Phase 1] 각 에이전트 독립 실행
  → JSON 구조화 출력 강제
  → SQLite에 tokens/turn/output 기록
         ↓
[Phase 2] Claude Opus(평가 에이전트) 평가 보고서 생성
         ↓
[Phase 3] 교차 평가 프롬프트 주입 → 재출력
  → Sentence Transformers로 KSI 계산 (델타 방식)
         ↓
[Phase 4] 전체 회고 → JSON 재출력
  → JSON Diff로 EII 자동 카운트
         ↓
[Judge] GPT-4o 블라인드 RFS 채점
         ↓
[출력] 논문용 데이터 테이블 자동 생성
  → CSV / LaTeX 테이블 직출력
```

### 오케스트레이션 도구
- **Phase 1~4**: 순수 Python + API 직접 호출 (LangChain/AutoGen 보류)
  → 프레임워크 버전 의존성 없음 = 논문 재현성 ↑
- **LangSmith**: 체인 추적 및 라벨링 전용으로 제한 사용

---

## 기각/보류 목록

| 도구 | 결정 | 이유 |
|------|------|------|
| Ragas | ❌ 기각 | RAG 전용 프레임워크, 본 실험에 부적합 |
| DSPy | ⏳ 보류 | Phase 2에서 실험 자동화 고도화 시 재검토 |
| LangChain | ⏳ 보류 | 재현성 위험. 순수 Python으로 대체 |
| AutoGen | ⏳ 보류 | 동일 이유. 고도화 단계에서 검토 |
| Helicone/Langfuse | ⏳ 보류 | SQLite 로컬 로깅으로 충분 |
| ChromaDB | ⏳ 보류 | FAISS만으로 충분 |

---

*루카 제안(`측정방법_기술제안_Luca.md`) 기반 + 소넷 검토의견 반영 통합본*
*다음 단계: 이 내용을 논문 Section 5 (평가지표) 개정에 반영*
