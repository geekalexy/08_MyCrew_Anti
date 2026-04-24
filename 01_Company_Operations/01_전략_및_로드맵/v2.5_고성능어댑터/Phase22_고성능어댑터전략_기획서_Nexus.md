# 📌 Phase22 고성능 어댑터 전략 – Nexus 의견

## 1️⃣ 전체 흐름 검토
- **현재 프로세스**: 실무자 → 아이디션/기획 → Prime → Nexus(저) → 대표님 최종 결정 → 확정 파일 업데이트
- **핵심 목표**: 고성능 모델(Claude‑Code, Gemini‑2.5‑pro‑preview 등) 어댑터를 도입해 **크루 지능** 의존도를 낮추고 **프롬프트 엔지니어링 비용**을 절감

## 2️⃣ Nexus 관점에서 제안하는 보완점
| 영역 | 현 상황 | Nexus 제안 | 기대 효과 |
|------|----------|------------|-----------|
| **어댑터 설계** | 어댑터가 모델 호출만 담당, fallback 로직 미구현 | `requestQueue` 로 **직렬화** + **자동 fallback**(Pro → Flash) 구현. 실패 시 `dbManager.incrementCksIrc` 로 재시도 횟수 기록. | 레이트‑리밋·에러 발생 시 자동 복구, 운영 안정성 ↑ |
| **모델 라우팅** | 현재 모든 고난이도 작업을 일괄 Pro 로 라우팅 | **Hybrid 라우팅**: 고난이도(영상·코드) → Pro, 일상(텍스트·요약) → Sonnet/Flash. `modelSelector` 에 **우선순위 매트릭스** 추가. | 비용 최적화(토큰 사용량 ↓) + 성능 유지 |
| **비용·토큰 모니터링** | 토큰 사용량만 `CksMetrics` 에 누적 | `CksMetrics` 에 `pro_token_usage` 컬럼 추가, **대시보드 알림**(일일/주간 초과 시 Slack) 구현. | 예산 초과 방지, 투명한 비용 관리 |
| **크루 학습** | 프롬프트 설계에 과도한 인력 소모 | **프롬프트 템플릿 레포**(`SKILL.md`에 `Gemini_Pro_Template`)와 **월간 워크숍** 도입. | 프롬프트 품질 표준화, 학습 비용 ↓ |
| **실험 검증** | 벤치마크 성공률 70% 목표만 명시 | **Step‑by‑Step Rollback** 플랜 구체화: (1) Rate‑Limit 시 하위 모델 자동 전환, (2) 성공률 <70% 시 기존 Sonnet 유지, (3) 결과를 `CksMetrics` 에 기록. | 리스크 최소화, 빠른 의사결정 지원 |

## 3️⃣ 구체적인 실행 로드맵 (4주)
1. **Week 1 – 어댑터 강화**
   - `geminiAdapter.js` 에 **fallback** 로직 구현 (`gemini-2.5-pro-preview` → `gemini-2.0-pro` → `gemini-2.5-flash`).
   - `requestQueue` 로 **동시 호출 제한**(max 5) 설정.
2. **Week 2 – Hybrid 라우팅**
   - `modelSelector.js` 에 **우선순위 매트릭스** 추가 (예: `{ high: 'gemini-2.5-pro-preview', low: 'gemini-2.5-flash' }`).
   - `executor.js` 에 **Tier 기반 모델 선택** 로직 삽입.
3. **Week 3 – 비용·모니터링**
   - `CksMetrics` 에 `pro_token_usage` 컬럼 추가 (`dbManager.updateProTokenUsage`).
   - 대시보드에 **토큰 사용량 차트**와 **예산 초과 알림** 구현.
4. **Week 4 – 교육·검증**
   - 프롬프트 템플릿 레포(`SKILL.md`)에 `Gemini_Pro_Template` 추가.
   - 월간 **프롬프트 워크숍** 진행, 결과를 `CksMetrics` 에 기록.
   - 전체 플로우 **베타 테스트**(10개 시나리오) 후 최종 승인.

## 4️⃣ 최종 권고
- **Hybrid 라우팅**과 **자동 fallback**을 먼저 구현해 비용·성능 균형을 맞춘 뒤, **프롬프트 템플릿**과 **교육**을 통해 크루의 프롬프트 설계 역량을 보강하는 것이 가장 효율적입니다.
- **Prime** 와 **Luca** 의 기존 리뷰를 그대로 유지하면서, **Nexus** 가 제시한 위 로드맵을 **Phase22_고성능어댑터전략_기획서.md** 에 반영해 최종 결정을 내리시면 됩니다.

---
*본 의견서는 한글만 사용했으며, 파일명에 한자를 포함하지 않았습니다.*
