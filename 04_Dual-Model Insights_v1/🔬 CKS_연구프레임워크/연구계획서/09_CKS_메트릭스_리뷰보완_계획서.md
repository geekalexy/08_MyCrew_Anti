# [계획서] CKS 메트릭스 파이프라인 리뷰 보완 계획

## 📌 개요
프라임(Prime)과 넥서스(Nexus)가 남겨준 심도 깊은 코드 리뷰(`08_지표센서_코드리뷰_Prime.md`, `Luca_Nexus_코딩리포트_지표센서_이식완료.md`)를 확인했습니다. **동시성 안전부터 Null Guard, 데이터 오염 방지까지** 매우 치명적인 엣지 케이스들을 완벽히 잡아냈습니다. 
안전한 모의 실험과 상용화를 위해 아래 5대 보완 패치를 진행하고자 합니다.

---

## 🛠️ 제안하는 코드 개선 사항 (Proposed Changes)

### 1. `executor.js` (Null 가드 및 Fallback 예외 처리)
> **Prime 지적 사항**: 일반 채팅 시 `taskId = null`로 유입될 경우 유령 레코드가 쌓이며, Fallback 발생 시 `_meta` 필드가 오염됨.
* **조치 내용**: 
  - `taskId` 존재 여부를 최우선으로 검증 (`if (taskId && result.tokenUsage)`)
  - `result._meta`에 `fallback: true` 플래그가 존재할 경우, 정성 평가 점수가 0점으로 삽입되는 것을 방지하기 위해 DB 저장을 생략하도록 수정 (`if (result._meta && !result._meta.fallback)`).
  - 해당 에이전트의 소속 팀(`team_A`, `team_B`, `independent`)을 매핑하여 DB에 `team_type` 함께 전달.

### 2. `anthropicAdapter.js` (타입 반환 규격화)
> **Prime 지적 사항**: `new String()` 래퍼는 타입 추론(`typeof === 'object'`)에 혼선을 줄 수 있음.
* **조치 내용**: 
  - 레거시 하위 호환 래퍼를 제거하고, `geminiAdapter.js`와 동일하게 명시적인 순수 객체 형태 `{ text: "...", tokenUsage: 1234 }` 로 반환하도록 클린 코드 적용.

### 3. `database.js` (데이터 타입 검증 및 스키마 강화)
> **Nexus 지적 사항**: 누적 시 음수나 NaN이 전파될 위험이 있으며, 업데이트 시간 추적이 불가.
* **조치 내용**:
  - `CksMetrics` 테이블 스키마에 `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP` 컬럼 추가.
  - `ON CONFLICT DO UPDATE` 절에 `updated_at = CURRENT_TIMESTAMP` 항목 일괄 추가.
  - 누적 계수 유입 시 `Math.max(0, Number(tokens) || 0)` 등으로 음수/NaN(Not a Number)가 데이터베이스에 침투해 연산을 붕괴시키는 상황 원천 차단.

---

## 🙋‍♂️ 루카의 승인 요청
대표님, 브레인들의 리뷰 포인트가 백룸에서 돌아가는 시스템의 코어 무결성을 완성하는 데 엄청난 통찰을 제공했습니다. 특히 Null 레코드 발생이나 Fallback 지표 오염은 실험 결과를 완전히 망칠 뻔한 크리티컬 이슈입니다!
위 **수정 계획안(Remediation Plan)**대로 5가지 관절을 안전하게 조이는 리팩토링 및 핫픽스를 진행해도 될까요? 승인해주시면 즉시 코드를 수정하겠습니다.
