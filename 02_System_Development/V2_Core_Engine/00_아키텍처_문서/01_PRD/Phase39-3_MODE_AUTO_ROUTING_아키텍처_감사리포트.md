# 🚀 Phase 39-3: Mode Auto Routing Architecture Audit Report

## 1. 개요 및 목적
본 문서는 `Phase39_MODE_AUTO_ROUTING_기획.md` (Zero-Command UX 및 자동 모드 라우팅)의 기획 요구사항이 실제 `intentRouter.js`, `server.js`, `TaskDetailModal.jsx`, `executor.js` 등의 코드 레벨에서 얼마나 정합성 있게 구현되었는지 감사(Audit)한 결과입니다.

---

## 2. 핵심 구현 누락 및 이상 발견 사항 (Critical Findings)

### 🔴 1. Zero-Command UX 단절 (Natural Language Routing Mocking)
- **기획 의도:** 사용자가 모드를 선택하지 않고 자연어("로그인 페이지 기획서 좀 써봐")만 입력하면, `Intent Router Agent`가 이를 분석하여 백엔드 파이프라인을 자동으로 실행.
- **구현 이상:** 프론트엔드(`TaskDetailModal.jsx`)의 채팅 입력부는 사용자가 텍스트를 입력할 때 단순히 `socket.emit('task:message', ...)` 혹은 `PATCH /api/tasks/:id` 로 코멘트/본문을 업데이트할 뿐, **어떠한 실행 API(`/api/tasks/:id/run`)도 호출하지 않습니다.** 
- **결과:** 사용자가 "실행(Start Task)" 버튼을 명시적으로 누르지 않는 한, 백엔드의 `intentRouter.js`는 영원히 호출되지 않는 **죽은 코드(Dead Code)** 상태입니다. 진정한 의미의 Zero-Command는 존재하지 않습니다.

### 🔴 2. Cross-Mode Handoff (교차 컨텍스트 주입 및 선행 분석) 누락
- **기획 의도:** `DEV` 모드 진행 중 `ARCHITECT` 모드로 전환했다가 다시 `DEV`로 복귀 시, "최신 기획(PRD) 내용과 기존 코드의 차이(Diff)를 비교하여 선행 분석 및 계획 수립"을 강제.
- **구현 이상:** `executor.js`나 백엔드 파이프라인 어디에도 이전 모드의 작업물 상태를 추적하거나, 복귀 시 **Diff Analysis를 강제하는 System Prompt/제어 로직이 전무**합니다. 단순 상태값만 바뀔 뿐, 문맥 병합(Context Handoff)이 일어나지 않습니다.

### 🟠 3. ARCHITECT 모드 백엔드 분기 오류 (Architecture Mismatch)
- **증상:** 자연어 입력이 정상적으로 라우팅되었다고 가정할 때, `intentRouter.js`가 `mode: 'ARCHITECT'`를 반환하면 백엔드(`server.js`)는 `forceRedispatchTask()` 함수를 호출하여 일반 에이전트 실행 루프를 태워버립니다.
- **구현 이상:** 기획(ARCHITECT) 파이프라인은 백엔드 에이전트 로직이 아니라, 프론트엔드에서 `PlanMasterModal` 컴포넌트를 팝업하여 별도의 API(`/analyze`)를 타도록 구현되어 있습니다. 즉, Intent Router가 기획 의도를 감지하더라도 정작 Plan Master 파이프라인은 실행되지 않고 엉뚱한 에이전트가 실행되는 구조적 결함이 있습니다.

### 🟢 4. Empty Body Auto-Fallback (정상 구현)
- **구현 성공:** 카드의 본문(Content)이 비어있는 상태에서 `DEV`, `QA`, `DEBUG` 모드 실행을 시도할 경우, `TaskDetailModal.jsx`의 `checkAutoFallback()` 로직이 이를 가로채고 `ARCHITECT` 모드로 자동 전환하며 토스트 메시지를 띄우는 폴백 로직은 기획대로 완벽하게 구현되어 있습니다.

---

## 3. 최종 결론 및 넥스트 액션 제안

현재 Mode Auto Routing은 "UI 상의 모드 선택 버튼"과 "비어있을 때의 방어 로직(Fallback)" 정도만 동작하는 **반쪽짜리 구현(Mocking)** 상태입니다. 

> [!TIP] 
> **권장 수정 방향 (Phase 39-3 제안)**
> 1. **Zero-Command 트리거 연동:** `TaskDetailModal.jsx`에서 자연어 코멘트 전송 시, 명시적 모드가 선택되지 않았다면 `/api/tasks/:id/run` 엔드포인트를 백그라운드에서 호출하도록 UI 이벤트를 연동해야 합니다.
> 2. **Context Payload Handoff 로직 신설:** `executor.js`에서 실행 시 이전 모드의 산출물(PRD 등)을 현재 상태와 Diff(비교)하도록 강제하는 프롬프트 래퍼(Wrapper)를 신설해야 합니다. 이때 산출물의 버전과 상태 구분을 명확히 하기 위해 **카드 ID 및 코멘트 ID(컨텍스트 링크)**를 활용하여 히스토리를 주입해야 합니다.
> 3. **Router 분기 동기화:** `intentRouter.js`가 `PLAN_MASTER`나 `ARCHITECT`를 반환할 경우, 백엔드에서 강제로 프론트엔드에 `PlanMasterModal`을 띄우라는 소켓 이벤트를 발송하거나 백엔드 단에서 Plan Master 파이프라인을 직접 구동하도록 구조를 일치시켜야 합니다.
