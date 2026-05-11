# 10. [Sonnet 리뷰] 미디어파트 Gemini Pro 전환안 검토

> **작성일**: 2026-04-19
> **검토자**: Sonnet (Claude 3.7 Sonnet) — 기술 아키텍트 & 시스템 구현 담당
> **검토 대상**: `08_기획보완_미디어파트_Gemini자동화.md`
> **결론**: ✅ **조건부 승인**

---

## 1. 동의하는 부분 (강점)

### ① 완전 자동화 논거 — 가장 설득력 있음
Anti-Bridge 셔틀 제거는 단순 편의 개선이 아니라 **시스템 자율성의 근본 전제**다.  
현재 Remotion 코드 생성을 Claude로 처리하면 API 직결 없이 Alex가 중간에 개입해야 한다.  
Gemini API 직결은 이 병목을 구조적으로 해소한다는 점에서 논거가 타당하다.

### ② Mirror Design 역발상 — Prime의 관점에 동의
"양팀 동일 엔진 → 실험 불공정"이 아니라, 오히려 **엔진 변수를 통제하여 프레임워크 변수(CKS vs 적대적)만 순수하게 측정 가능**해진다.  
이는 CKS 연구 설계 관점에서 오히려 더 rigorous한 구조다.

### ③ 2M 토큰 컨텍스트 — SKILL.md 자가학습에 실질적 이점
누적되는 실패/성공 패턴을 대량으로 주입해 자가학습하는 구조에서 2M 컨텍스트 윈도우는 실질적 차별점이다.

---

## 2. 기술적 검토 필요 사항

### ⚠️ [지적 1] "Gemini 3.1 Pro" — 해당 모델명 미존재

현재 Google 공식 모델 라인업:
```
gemini-1.5-pro          ← 안정 출시
gemini-2.0-flash        ← 현재 Image Lab에서 사용 중
gemini-2.5-pro-preview  ← 최신 (프리뷰 상태)
```

문서에 기재된 `gemini-3.1-pro-preview`는 **미출시 모델**이다.  
문맥상 `gemini-2.5-pro-preview`를 의도한 것으로 판단되며, **Next Step 실행 전 모델명 정정이 필수**다.

### ⚠️ [지적 2] Remotion 코드 생성 능력 — 사전 검증 필수

Gemini는 분석·요약·멀티모달에서 강점을 보이지만,  
**Remotion JSX Props 구조화 및 컴포넌트 코드 생성**은 Claude 계열이 현재까지 더 안정적인 경향이 있다.  
Prime의 Condition 1 (Week 1 빌드 성공률 벤치마크)이 이 리스크를 정확히 짚었다.  
→ **벤치마크 생략 시 전환 승인 불가.**

---

## 3. 실행 측면 추가 검토

현재 `geminiAdapter.js`가 Image Lab에 이미 연결되어 있어 인프라 전환 비용은 낮다.  
`remotionRenderer.js`의 Anthropic 호출부를 `geminiAdapter`로 교체하는 작업은 기술적으로 무리가 없다.  
단, Gemini의 함수 호출(function call) 및 스트리밍 패턴이 Anthropic과 다르므로 어댑터 레이어 검증이 필요하다.

---

## 4. 최종 의견

**✅ 조건부 승인** — 논리 구조 탄탄, Prime 조건 편입 적절

### 승인 조건 3가지

| # | 조건 | 기한 |
|:---|:---|:---:|
| 1 | `gemini-3.1-pro-preview` → `gemini-2.5-pro-preview` 모델명 정정 | 즉시 |
| 2 | Week 1 벤치마크 선행 — Remotion 빌드 성공률 **≥ 70%** 확인 후 전환 확정 | Week 1 |
| 3 | 실패 시 롤백 플랜 명문화 — Sonnet 유지 + Anti-Bridge 자동화 대안 | Week 1 |

조건 충족 시 전환을 적극 지지한다.

---

*검토자: Sonnet (Claude 3.7 Sonnet) — 2026-04-19*
