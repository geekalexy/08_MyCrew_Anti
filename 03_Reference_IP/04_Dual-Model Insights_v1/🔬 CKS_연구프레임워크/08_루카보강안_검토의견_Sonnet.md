# 08. 루카 보강안 검토 의견
## `07_미해결_기술과제_설계_Luca.md` 에 대한 소넷 리뷰

> 작성자: 소넷 (Claude Sonnet 4.6)
> 작성일: 2026-04-17
> 검토 대상: `07_미해결_기술과제_설계_Luca.md`
> 맥락: `06_최종통합권장안_확정.md`의 미해결 과제 2개에 대한 루카 보강안 검토
> 결론: **v1.2 확정 동의 (조건부)**

---

## 검토 요약

| 항목 | 평가 | 비고 |
|------|------|------|
| Ablation Study 아이디어 | ✅ 채택 | 방법론적으로 탁월 |
| Ablation 가설 설계 | ⚠️ 보완 필요 | 4가지 시나리오 테이블로 확장 |
| KSI-S 파이썬 구현 | ✅ 채택 | 소넷 공식과 수학적으로 일치 확인 |
| 임베딩 모델 선택 | ⚠️ 보완 권장 | MiniLM + mpnet 교차 검증 병행 |
| AutoGen Hook 연결 | ✅ 방향 맞음 | pseudo-code → 실제 구현은 다음 단계 |

---

## 해결안 1 — Ablation Study

### ✅ 채택 이유

소넷이 제기한 문제:
> "Phase 4 메타 프롬프팅이 에이전트의 인위적 협력 행동을 유발할 수 있다"

루카의 해법:
```
B-Full    (완전체): Phase 1→2→3→4
B-Ablated (절제군): Phase 1→2→3 (Phase 4 없이 종료)
```

이 설계가 탁월한 이유:
- 외부 조건 변경 없이 **내부 구조 절제만으로 Phase 4 효과를 격리**함
- 전형적인 Ablation Study 방법론에 부합
- 소넷의 "유/무 비교" 제안보다 더 정밀한 인과 관계 증명 가능

### ⚠️ 가설 테이블 보완 필요

루카 원래 가설 (단일 시나리오):
> "KSI-S 높음 + EII 폭락 → Phase 4가 Sycophancy 주범"

**보완: 4가지 시나리오 테이블 (논문 Discussion 필수)**

| KSI-S | EII | 해석 | 대응 |
|-------|-----|------|------|
| ↑ 높음 | ↑ 높음 | ✅ Phase 4 이상적 — CKS 효과 증명 | 현행 유지 |
| ↑ 높음 | ↓ 폭락 | ⚠️ 루카 예측 시나리오 — Sycophancy 의심 | Temperature 상향 |
| ↓ 낮음 | ↑ 높음 | 창의성 있으나 지식 전이 없음 | 교차 강도 강화 |
| ↓ 낮음 | ↓ 폭락 | Phase 4 효과 없음 | 회고 루프 재설계 |

심사위원은 반드시 "루카가 예측한 시나리오 외의 경우는 어떻게 처리했나"를 물어볼 것.

---

## 해결안 2 — KSI-S 파이썬 구현

### ✅ 채택 — 수학 검증 완료

루카 구현 코드와 소넷 원래 공식 대조:

```python
# 루카 코드
cs_baseline     = util.cos_sim(vec_A_pre, vec_B_pre).item()
ksi_delta_A     = cs_A_absorbed_B - cs_baseline  # CS(A_post,B_pre) - CS(A_pre,B_pre)
ksi_delta_B     = cs_B_absorbed_A - cs_baseline  # CS(B_post,A_pre) - CS(B_pre,A_pre)
ksi_s_final     = (ksi_delta_A + ksi_delta_B) / 2

# 소넷 원래 공식
KSI_delta_A = CS(A_post, B_pre) - CS(A_pre, B_pre)
KSI_delta_B = CS(B_post, A_pre) - CS(B_pre, A_pre)
KSI_S       = (KSI_delta_A + KSI_delta_B) / 2
```

**수학적으로 동일 — 채택 확정.**

> 참고: `cs_baseline`을 양쪽 delta에 동일하게 쓰는 것도 정확함.
> 코사인 유사도는 대칭이므로 `CS(A_pre, B_pre) = CS(B_pre, A_pre)`.

### ⚠️ 임베딩 모델 교차 검증 권장

| 모델 | 속도 | 정밀도 | 권장 용도 |
|------|:----:|:------:|---------|
| `MiniLM-L12-v2` (루카 선택) | ⚡ 빠름 | ⭐⭐⭐ | 실시간 루프, 초기 실험 |
| `mpnet-base-v2` (소넷 이전 제안) | 🐢 느림 | ⭐⭐⭐⭐⭐ | 최종 논문 데이터 |

**소넷 제안**: 동일 데이터로 두 모델 교차 실행
- 결과 일치 → 논문에서 MiniLM 채택 (속도 + 재현성)
- 결과 불일치 → mpnet 우선 (정밀도 우선)
- 불일치 정도 자체도 논문 부록(Appendix)에 수록 가능

---

## 소넷 최종 결론

> **루카 보강안은 소넷이 제기한 2개 미해결 과제를 모두 정확히 겨냥했으며,
> KSI-S 구현 코드는 수학적으로 소넷 공식과 일치함을 확인했다.
> Ablation 가설을 4가지 시나리오 테이블로 확장하는 조건으로**
> **v1.2 확정에 동의한다.**

---

*소넷(Claude Sonnet 4.6) 작성 — 2026-04-17 16:21 KST*
*루카 보강안 `07_미해결_기술과제_설계_Luca.md` 독립 검토 후 작성*
