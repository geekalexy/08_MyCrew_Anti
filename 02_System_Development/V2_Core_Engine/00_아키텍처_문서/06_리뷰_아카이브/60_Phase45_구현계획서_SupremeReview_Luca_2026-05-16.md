# Phase 45 — MCP 루프 전환 구현계획서 Supreme Review

**리뷰어**: Luca (Gemini)
**리뷰 대상**: `Phase45_MCP루프전환_구현계획서.md`
**리뷰 일시**: 2026-05-16
**이전 리뷰**: `58_Phase45_MCP루프전환_SupremeReview_Prime_2026-05-16.md`

---

## 📋 결함 요약 매트릭스

| # | 심각도 | 렌즈 | 위치 | 결함 내용 |
|---|--------|------|------|-----------|
| F-01 | 🔴 CRITICAL | 아키텍처 | B-4 프론트엔드 대응 | `POST /analyze`가 `202 Accepted`를 반환하도록 비동기 전환하지만, 현재 백엔드에 `plan_master` 진행 상황을 프론트로 전달할 SSE 엔드포인트가 없음. Phase 45-C 소켓 의존 제거 전에 대체 수단(DB 폴링/SSE)을 명시적으로 설계하지 않으면 **UI 무한 대기(Deadlock) 발생**. |
| F-02 | 🔴 CRITICAL | 정책 준수 | PRE-2 / F-1 | `modelRegistry.js` 검증 결과, 상수로 `MODEL.SONNET`은 `'claude-sonnet-4-6'`을 가리킴. Antigravity 브릿지용 모델은 `MODEL.ANTI_SONNET_THINK`임. PRD 가이드(`MODEL.SONNET` 교체)를 따르면 **런타임 에러 또는 비-Think 모델 호출로 성능 저하 발생**. |
| F-03 | 🟠 HIGH | 런타임 안정성 | A-2 `qaLoop.js` 재작성 | AI가 도구를 호출하기 직전 사용자 입력에 대한 Prompt Injection 검증(`promptInjectionGuard.sanitizeInput()`)은 개별 루프가 아니라 **`executor.js`의 공통 진입점**에서 선행되어야 함. 루프 내부에 삽입할 경우 검증 누락 우려. |
| F-04 | 🟡 MEDIUM | UX/사용자 흐름 | B-2 `confirm_mvp` 도구 | `/confirm` 연속 클릭 방지용 Idempotency Guard를 언급했으나, 사용자가 "승인"을 눌렀을 때 백엔드가 카드를 생성하는 동안 **UI 피드백(버튼 로딩 상태 등)**을 어떻게 처리할지 프론트 스토어(`kanbanStore` 등) 연동 계획 누락. |
| F-05 | 🟢 LOW | 보안 | A-1 `contextInjector.js` | QA/DEBUG 모드에 권한을 할당할 때, 기존 DEV 모드와의 권한 탈출(Privilege Escalation)을 막기 위한 명시적 허용 도구 리스트 하드코딩이 훌륭하게 설계됨. (이상 없음) |

---

## 🔴 GOD NODE 경보

- `server.js` (L3532~L3732 제거 대상): 200줄의 코드를 덜어내는 작업이 포함되어 있습니다.
- `useSocket.js` (Graphify Rank 7, 23 edges): Phase 45-C로 분리된 것은 올바른 판단이나, 소켓 이벤트 6개 스토어에 미치는 커뮤니티 전파 효과가 크므로 **개별 PR 검증이 필수**입니다.
- **Graphify 누락 확인**: `qaLoop.js`는 현재 AST 트리에 등록되지 않은 상태(고립 노드)임이 `get_neighbors` 결과로 확인되었습니다. PRE-1(`graphify update .`) 필수입니다.

---

## 🔍 6개 렌즈 상세 분석

### 1. 🔒 보안 (Security)
**결함 발견 (F-03, HIGH)**
구현계획서 A-2 항목에서 `promptInjectionGuard.sanitizeInput()` 호출을 언급했습니다. 그러나 `qaLoop.js` 내부에서 이를 처리하면, 다른 루프(debugLoop, DEV 모드)에서 검증이 누락될 수 있습니다. 사용자 입력(프롬프트)에 대한 살균 처리는 `executor.runWithTools` 직전, 즉 공통 인입점(`ariDaemon.js` 또는 `executor.js`)에서 한 번만 수행하도록 아키텍처가 조정되어야 합니다.

### 2. 🏗️ 아키텍처 (Architecture)
**결함 발견 (F-01, CRITICAL)**
B-3과 B-4에서 God Route를 덜어내며 API 응답을 동기 대기에서 `202 Accepted` 즉각 반환으로 변경합니다. 하지만 진행 상황(`plan-master:thought_update`)을 알려주던 Socket 통신이 Phase 45-C에서 제거될 예정입니다. **만약 Phase 46(SSE 인프라 구축)이 완료되기 전이라면 프론트엔드는 응답을 받을 채널이 없어집니다.** DB 폴링 방식을 프론트엔드(`TaskDetailModal` / `chatStore`)에 즉시 추가하거나, Phase 46 SSE 파이프라인 구현을 Phase 45-B 이전으로 당겨와야 합니다.

### 3. 🔄 상태 정합성 (State Consistency)
**우수 설계 확인**
A-2에서 `QA_RUNNING` 좀비 카드 발생 시 서버 기동 시점에 `QA_FAILED`로 강제 복구하는 안전망과 B-5의 `PLANNING` 상태 30분 타임아웃 처리는 상태 고착을 막는 훌륭한 설계입니다. 추가 결함 없음.

### 4. 👤 UX/사용자 흐름 (User Experience)
**결함 발견 (F-04, MEDIUM)**
B-2의 `confirm_mvp` 도구 사용 시 중복 카드 생성(Idempotency) 방지책은 백엔드 층위에 있으나, 사용자가 버튼을 눌렀을 때의 인지적 피드백(버튼 Disabled, 스피너 렌더링)에 대한 프론트엔드 뷰 모델 처리가 누락되었습니다. 상태가 `PLAN_COMPLETE`에서 `IN_PROGRESS`로 넘어갈 때까지 UI 차단 조치가 필요합니다.

### 5. ⚙️ 런타임 안정성 (Runtime Stability)
**우수 설계 확인**
B-3의 `try-catch-finally` DB 커넥션 릴리스 점검은 메모리 누수 및 커넥션 풀 고갈을 막기 위한 적절한 방어벽입니다. 결함 없음.

### 6. 📜 정책 준수 (Policy Compliance)
**결함 발견 (F-02, CRITICAL)**
PRE-2에서 `server.js`의 `anti-claude-sonnet-4.6-thinking` 식별자를 `MODEL.SONNET`으로 교체하라고 되어 있으나, 실제 `modelRegistry.js` 확인 결과 다음과 같습니다.
- `MODEL.SONNET` = `'claude-sonnet-4-6'`
- `MODEL.ANTI_SONNET_THINK` = `'anti-claude-sonnet-4.6-thinking'`
PRD 가이드대로 구현하면 P-006(환각 식별자) 위반 또는 IDE 브릿지가 아닌 로컬/일반 모델을 호출하여 **성능이 심각하게 저하**됩니다. 구현계획서의 교체 대상을 `MODEL.ANTI_SONNET_THINK`로 정정해야 합니다.

---

## 🏁 종합 판정 및 다음 행동

| 우선순위 | 항목 | 조치 |
|---------|------|------|
| 1 | **F-02** 모델 식별자 상수 정정 | PRE-2 항목을 `MODEL.ANTI_SONNET_THINK`로 수정 |
| 2 | **F-01** 비동기 202 전환에 따른 프론트 데드락 해소 | Phase 45-B와 Phase 46-A(SSE 구현) 순서 조정 또는 임시 DB 폴링 추가 |
| 3 | **F-03** 인젝션 가드 위치 조정 | A-2 내용에서 `executor` 공통 계층 검증으로 수정 |

**Luca 의견**: 구현계획서의 논리 흐름은 대체로 훌륭하나, **F-01(통신 채널 부재)과 F-02(상수 오기재)**는 코딩에 돌입했을 때 즉각적인 런타임 마비(Deadlock)와 P-006 정책 위반을 발생시킬 수 있는 시한폭탄입니다. 이 세 가지 지적 사항을 구현계획서에 즉시 수정한 뒤 `/code` 모드로 진입하는 것을 권장합니다.

*Supreme Review 완료 — Luca (Gemini) | 2026-05-16*
