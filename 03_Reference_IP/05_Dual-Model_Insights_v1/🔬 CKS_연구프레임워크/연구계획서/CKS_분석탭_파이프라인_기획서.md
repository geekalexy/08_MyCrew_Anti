# 📊 [기획안] CKS 연구 지표 (분석 탭) 실데이터 연동 파이프라인

현재 대시보드의 **'팀 > 분석'** 탭 하단에 있는 CKS 연구 지표는 하드코딩된 Mock 데이터입니다. 
학계와 시장에 플랫폼의 신뢰성과 논문급 벤치마크를 제공하기 위해, 이 Mock 데이터를 실제 에이전트 실행 결과로부터 추출하여 연동하는 파이프라인을 기획했습니다. 본 기획안에 대한 대표님의 승인 후 개발에 착수하겠습니다.

---

## 1. 🎯 수집할 핵심 데이터 (What)

현재 분석 탭에 정의된 4가지 CKS 학술 지표를 실제 데이터 기반으로 계산합니다.

1. **TEI (Token Efficiency Index, 토큰 효율 지수)**
   * **의미**: 단일 모델 대비 다중 에이전트 협업이 토큰을 얼마나 아꼈는가?
   * **수집 데이터**: 각 API 응답의 `totalTokenCount` 누적값. DB 로깅 필수.

2. **KSI (Knowledge Sync Index, 지식 동기화 지수)**
   * **의미**: 팀 단위 지식 전달의 성공률. 두 가지로 세분화.
     * **KSI-R (Rule Survival)**: 이전 스프린트 금지 조항의 실질 반영률 (정량).
     * **KSI-S (Semantic)**: 코사인 유사도를 활용한 텍스트 문맥 동기화 수준.

3. **HER (Hallucination Elim. Rate, 환각/오류 방어율)**
   * **의미**: 교차 검증을 통해 사전 차단된 내부 논리 오류 건수.

4. **EII (Evolution & Iteration Index, 창의 파생 점수)**
   * **의미**: 지시된 태스크 외에 자율적으로 제안한 창의적 돌파구. JSON Diff 카운트.

5. **IRC (Iterative Revision Count, 반복 수정 횟수)** [추가됨]
   * **의미**: 사용자가 마음에 들지 않아 'Done'에서 'In-Progress'로 되돌린 횟수.
   * **수집 데이터**: 웹훅이나 상태 관리(Kanban Store)에서 티켓 상태 변경 로그 카운트.

6. **UXS (User Experience Satisfaction, 체감 만족도)** [추가됨 / Prime 제안]
   * **의미**: 최종 퀄리티에 대한 사용자의 정성 편의 척도.
   * **수집 데이터**: 태스크 승인 시 대시보드에서 1~5점 별점을 남기게 하는 UI 수집 기믹 추가.

---

## 2. ⚙️ 데이터 흐름 및 아키텍처 (How)

### Step 1: 데이터베이스 스키마 확장 (`database.js`)
* 기존 `tasks` 테이블 외에 `cks_metrics` 테이블 신설.
* 칼럼: `task_id`, `team_type`(A/B), `tei_tokens`, `ksi_r_score`, `ksi_s_score`, `her_count`, `eii_score`, `irc_count`, `uxs_rating`, `created_at`

### Step 2: 엔진 평가/수집 로직 주입 (`workflowOrchestrator.js` & `executor.js`)
* `geminiAdapter`와 `anthropicAdapter`에서 응답 텍스트뿐만 아니라 `tokens` 메타데이터도 함께 반환하도록 수정.
* Brain(Ollie/Luna)이 최종 보고서를 작성할 때, 프롬프트에 다음 문장을 추가:
  > *"가시적인 보고서 텍스트 작성 외에도, 백엔드 분석용으로 이번 태스크의 KSI(0-100), HER(오류적발건수), EII(1-5점) 수치를 포함한 JSON 블록을 맨 마지막에 추가하세요."*

### Step 3: 실시간 수집 및 대시보드 반영 (`server.js` & `OrgView.jsx`)
* **서버**: 기존에 Mock으로 열려있는 `GET /api/metrics/cks` 엔드포인트가 `cks_metrics` DB를 조회하여 평균값과 추세(Trend)를 계산해 반환하도록 로직 구현.
* **프론트**: `AnalyticsTab` 컴포넌트가 마운트될 때 위 API를 폴링(Polling)하여 UI의 막대바와 퍼센티지를 렌더링.

---

## 3. 🛡️ 예상 효과 및 다음 단계

* **신뢰성 입증**: 사용자는 대시보드 분석 탭을 볼 때마다 AI가 단순히 말을 잘하는 것을 넘어, **절약한 API 비용(토큰)**과 **방어한 오류 건수**를 실시간으로 체감하게 됩니다. 
* **학술적 기여**: 이 데이터가 누적되면 대표님께서 구상하신 "단일 모델 vs CKS 프레임워크 비교 논문"의 실측 베이스 데이터(Ground Truth)로 즉각 활용 가능합니다.

> **루카의 승인 요청**: 위 기획안의 지표 추출 방식과 파이프라인 흐름이 대표님의 의도와 부합하는지 확인 부탁드립니다. 승인해 주시면 즉시 DB 스키마 생성과 어댑터 토큰 추출 개발(Step 1~2)에 착수하겠습니다!
