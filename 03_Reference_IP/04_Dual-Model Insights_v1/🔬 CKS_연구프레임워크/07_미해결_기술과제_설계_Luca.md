# 07. 미해결 기술 과제 설계 (Ablation 및 KSI-S 파이썬 구현)

> **작성자**: Luca (CTO / System Architect)
> **최종 갱신일**: 2026-04-17
> **분류**: 04_Dual-Model Insights_v1 / 🔬 CKS_연구프레임워크
> **배경**: `06_최종통합권장안_확정.md`의 [10. 미해결 과제] 중 우선순위가 가장 높은 두 가지(Ablation 세팅, KSI-S 메트릭 로직)에 대한 엔지니어링 해결안을 명시합니다.

---

## 1. [해결안 1] Ablation Study (절제 연구) 파이프라인 설계

**문제 제기 (소넷)**: Phase 4(전체 회고) 단계에서 진행되는 메타 프롬프팅이 에이전트 간의 '지나친 동조(오염)'를 유발할 수 있음. 어떻게 검증할 것인가?

**해결 설계안 (루카)**: 
CKS 실험군(Group B)의 파이프라인을 내부적으로 두 개의 스웜(Swarm)으로 쪼개서 실행(Ablation)하여 요소의 타당성을 증명합니다.

* **Group B-Full (완전체)**: 
  * `Phase 1(발산) ➝ Phase 2(심사) ➝ Phase 3(교차) ➝ Phase 4(전체 회고🔥)`
* **Group B-Ablated (절제군)**: 
  * `Phase 1(발산) ➝ Phase 2(심사) ➝ Phase 3(교차)` ➝ **(회고 없이 강제 종료🧊)**

**검증 가설 시나리오 (Hypothesis Scenarios)**:
Phase 4 회고 루프의 타당성과 부작용(과잉 동조)을 입증하기 위해, `Group B-Full`과 `Group B-Ablated`의 지표 차이를 다음 4가지 시나리오 매트릭스로 분석합니다.

| KSI-S (동기화) | EII (창의성) | 현상 해석 (Phase 4의 효과) | 시스템 대응 방안 (System Tuning) |
|---|---|---|---|
| ↑ 상승 | ↑ 상승 | ✅ **가장 이상적 시나리오.** 지식도 동기화되고 아이디어도 발산됨 (CKS 증명 완료). | 현행 시스템 체계 및 메타 프롬프트 유지. |
| ↑ 상승 | ↓ 폭락 | ⚠️ **과잉 동조(Sycophancy) 의심.** 맹목적 동의로 인해 창발성이 죽어버림. | 어드바이저(Prime)의 `temperature`를 상향하고 비판 프롬프트 강화. |
| ↓ 하락 | ↑ 상승 | **지식 융합 실패.** 창의성만 있고 동료의 지식은 흡수되지 않음. | Phase 3(교차 분석) 및 Phase 4의 교차 인입 메커니즘 강도 상향. |
| ↓ 하락 | ↓ 폭락 | **최악의 시나리오.** 회고 루프가 오히려 에이전트를 고장냄. | Phase 4 회고 루프 메커니즘 자체를 전면 재설계. |

---

## 2. [해결안 2] KSI-S 측정용 로컬 파이썬(Python) 아키텍처

**문제 제기 (통합안)**: 소넷이 수학적으로 제안한 코사인 유사도 델타 공식을 로컬 환경에서 토큰 낭비 없이 어떻게 자동화할 것인가?

**해결 설계안 (루카)**: 
값비싼 LLM 임베딩(OpenAI 등) API를 호출하지 않고, HuggingFace의 오픈소스 경량 모델(`sentence-transformers`)을 사용하여 AutoGen 파이프라인 백그라운드에서 실시간으로 델타를 계산하여 SQLite에 적재합니다.

### 핵심 구현 코드 (Pseudo-code)

```python
import sqlite3
from sentence_transformers import SentenceTransformer, util

# 1. 속도가 빠르고 다국어(한국어) 의미망 모델 로드 (로컬 구동)
# [교차 검증 설계 방안 적용]
# - 초기 실험 및 실시간 루프(속도/재현성 우선): 'paraphrase-multilingual-MiniLM-L12-v2' (아래 적용됨)
# - 논문 최종 데이터(고정밀도 우선): 'paraphrase-multilingual-mpnet-base-v2' 교차 검증 병행
print("Loading Embedding Model (MiniLM for realtime, mpnet for final paper)...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

def calculate_ksi_s(A_pre_text, B_pre_text, A_post_text, B_post_text):
    """
    초기 산출물(pre)과 회고 이후 변경된 산출물(post)을 받아 
    의미론적 지식 동기화 지수(KSI-S)를 계산합니다.
    """
    
    # Text -> Vector 변환
    vec_A_pre = model.encode(A_pre_text)
    vec_B_pre = model.encode(B_pre_text)
    vec_A_post = model.encode(A_post_text)
    vec_B_post = model.encode(B_post_text)
    
    # 2. 베이스라인 추출: 원래 A와 B가 얼마나 비슷하게 기획했었나?
    cs_baseline = util.cos_sim(vec_A_pre, vec_B_pre).item()
    
    # 3. 크로스-동기화 추출 
    # (회고 후 A가 B의 초기 아이디어를 얼마나 흡수했는가?)
    cs_A_absorbed_B = util.cos_sim(vec_A_post, vec_B_pre).item()
    # (회고 후 B가 A의 초기 아이디어를 얼마나 흡수했는가?)
    cs_B_absorbed_A = util.cos_sim(vec_B_post, vec_A_pre).item()
    
    # 4. 델타 연산 (순수하게 회고 루프를 통해 증가한 지식 임베딩 값)
    ksi_delta_A = cs_A_absorbed_B - cs_baseline
    ksi_delta_B = cs_B_absorbed_A - cs_baseline
    
    # 5. 최종 KSI-S 산출
    ksi_s_final = (ksi_delta_A + ksi_delta_B) / 2
    
    return ksi_s_final

# [실행 예시] 
# AutoGen의 Message Loop Hook에서 각 Phase의 결과물이 나올 때마다 위 함수를 호출하여 DB에 자동 적재
# db.execute("INSERT INTO ksi_metrics (task_id, ksi_s) VALUES (?, ?)", (task_1, ksi_s_final))
```

**설계의 강점**:
이 파이프라인을 연결하면 연구자는 수작업으로 글을 읽지 않아도, 실험이 종료되는 순간 벤치마크 점수판 대시보드에 **"Task 1의 동기화율은 0.14입니다"** 라는 정량적 숫자가 꽂히게 됩니다. 완벽한 논문용(Journal-ready) 데이터셋 생성이 가능해집니다.
