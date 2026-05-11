# 🛡️ Prime Advisor (Prime) — Phase 20 온보딩 아키텍처 2차 리뷰

**리뷰어:** Prime (Claude Opus) — Prime Advisor  
**대상:** Phase 20 Onboarding + Practical Security (Revised)  
**일시:** 2026-04-15 (7th Review Session)  

---

## 📊 총평: A- (C+ → A- | 전회 P0 3건 모두 해소, 신규 발견 2건)

Luca, 이번 보완은 **정확히 P0 지적을 수용한 정밀 수정**입니다. 불필요한 AES를 과감히 걷어내고, KeyProvider 추상화와 `/api/secrets` 분리를 수용한 것은 보안 공학적으로 올바른 판단입니다.

전회 대비 변화를 먼저 추적합니다:

### 📋 전회 P0 해소 상태

| 전회 지적 | 조치 | 판정 |
|:---|:---|:---|
| P0-1: AES 과잉 설계 | ✅ `.env` 우선 + 핸들링 강화로 전환 | **해소** |
| P0-2: .env Git 노출 | ✅ `.gitignore` 재확인 + `.env.example` 제공 명시 | **해소 (단, 아래 참조)** |
| P0-3: 마이그레이션 경로 부재 | ✅ KeyProvider 브릿지 도입 | **해소** |
| 추가-1: 분기 로직 | ✅ 스마트 분기 조건 명시 | **해소** |
| 추가-2: settings/secrets 분리 | ✅ `/api/secrets` 독립 엔드포인트 명시 | **해소** |
| 추가-3: Google Drive 제거 | ✅ 온보딩에서 제외, 추후 고급 설정 이관 | **해소** |

**6건 중 6건 해소** — 이전 리뷰 반영률 100%. 이것이 반복 리뷰의 가치입니다.

---

## 🟢 잘 설계된 부분 (Highlights)

### ✅ KeyProvider 3단계 우선순위
1순위: 메모리 캐시 → 2순위: DB(온보딩) → 3순위: .env(레거시)
- 하위 호환성 100% 확보, 서버 재시작 불필요.

### ✅ 스마트 분기 로직
- 기존 사용자(대표님)와 신규 고객, 이탈자를 완벽하게 가려내는 `!hasEnvKey && !hasDbKey && !onboardingCompleted` 설계는 훌륭함.

---

## 🟡 신규 주의 사항 및 조건부 내역

1. **`.gitignore` 최우선 적용**: 리뷰 당시에는 누락되어 있었으나, 즉시 생성하여 적용 필요. (→ Luca가 바로 생성하여 해소 완료)
2. **AnthropicAdapter Lazy Init 오류 위험**: 생성자 단계에서 `await keyProvider` 호출 불가, Gemini 구현체처럼 구조 변경(명시) 필요.
3. **SKILL 원문 누출 위험**: `clone-agent.sh` 작동 전 `executor.js` 내부의 `actualContent` 기록 제거 패치 종속성 필수. (→ Luca 확인 결과 최근 핫패치로 처리 완료됨)

### 최종 등급: A- | 조건부 승인 (C+ → A-)
즉시 조건 2건(Gitignore 처리, 원문 로깅 배제) 해소되었으므로, **"Phase 20 구현 착수를 전면 승인"**합니다.
