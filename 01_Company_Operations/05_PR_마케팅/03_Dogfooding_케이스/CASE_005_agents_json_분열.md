# CASE_005: agents.json 정합성 붕괴 사태 (SSOT 분열)

## 1. 발견 일시 및 발견자
* **일시:** 2026-04 ~ 2026-05 (Phase 30 설계 검수 과정에서 공식 확인)
* **발견자:** Sonnet (코드 리뷰 중) + Prime (설계 검수 A- 조건부 승인 시 지적)
* **담당 기록자:** Sonnet

## 2. 증상 (사용자 관점)
에이전트 프로필 페이지에서 NOVA의 모델을 `gemini-2.5-pro`로 변경했음에도, 칸반 카드에 표시되는 모델 뱃지는 여전히 `flash`를 표시. 태스크 실행 시 실제로 어떤 모델이 사용되는지 알 수 없는 상태.

사용자 입장: **"내가 분명히 바꿨는데 시스템이 다른 말을 하고 있다."** — 대표님과 시스템 간 신뢰 붕괴.

## 3. 원인 (기술 관점)
에이전트 모델 정보를 관리하는 **진실의 공급원(SSOT)이 3곳으로 분열**되어 있었음:

| 저장소 | 역할 | 문제 |
|:---|:---|:---|
| `agents.json` | 초기 설정 파일 | 서버 시작 시 1회만 읽힘 → 이후 변경사항 반영 안 됨 |
| 메모리 캐시 (`AGENT_SIGNATURE_MODELS`) | 런타임 모델 참조 | 재시작 시 초기화 → 영속성 없음 |
| `team_agents` DB 테이블 | 팀 배치 정보 | 모델 정보 없음, `experiment_role`만 있어 role 소스 충돌 |

프로필 페이지의 PATCH 요청이 메모리 캐시만 업데이트하고 DB에는 반영하지 않아, 서버 재시작 후 변경사항이 소실됨.

* **Prime 검수에서 추가 지적:** `bridge`, `default_category` 필드가 스키마에서 누락되어 executor가 라우팅 불가 상황.

## 4. AI 자가 진단 (Self-Diagnosis)
Prime(Supreme Advisor)이 설계 검수에서:
> *"에이전트 객체의 진실의 공급원이 세 곳으로 나뉘어 있습니다. 파일, 메모리, DB가 각자 다른 버전의 진실을 말하고 있으며, 이 중 어느 것도 완전한 SSOT가 아닙니다. 이 상태에서는 사용자가 변경한 내용이 언제, 어디서 사라지는지 예측할 수 없습니다."*

Sonnet이 코드 분석을 통해 구체적 경로 확인 → **Phase 30 설계로 이어짐.**

## 5. 해결 방안
* **Phase 30 — agent_profiles DB 통합 (SSOT 확립):**
  * `agent_profiles` 테이블 신설: `id`, `model`, `role`, `nickname`, `bridge`, `default_category` 포함
  * `agents.json` → 읽기 전용 시드 파일로 역할 재정의 (초기 마이그레이션용)
  * 모든 모델 변경 → `PATCH /api/agents/:id/model` → DB `upsertAgentModel()` 즉시 반영
  * `executor.js`: 동기 초기화(agents.json) → async DB 갱신 2단계 폴백 체인 구축

## 6. 마케팅 앵글 (1줄)
**"AI 팀원 6명의 '이력서'를 파일로 관리하다 생긴 참사 — MyCrew는 이 실패로부터 에이전트 객체 DB 아키텍처를 설계했습니다."**

## 7. 파생된 기능/아키텍처
* **Phase 30:** agent_profiles DB (SSOT) 구축 — 모델·역할·닉네임·브릿지 설정 영속화
* DB 우선 폴백 체인: `DB → agents.json → 하드코딩`
* Prime 검수 A- 조건부 승인 → A 달성 기준 명시화
* 향후 Phase 31: nickname, role 사용자 직접 편집 UI

## 8. 관련 코드/자료
* `database.js` — `agent_profiles` 테이블 스키마 및 CRUD 메서드
* `executor.js` — 동기 초기화 + async DB 갱신 로직
* `server.js` — `PATCH /api/agents/:id/model` SSOT 엔드포인트
* Phase 30 설계 검수 문서 (Prime, A- 등급)
* 블로그 제목 후보: **"AI 팀원 6명의 '이력서'를 어디에 저장할 것인가"**
