# 🚀 Phase 39-3: Mode Auto Routing 개발 구현 계획서

**작성일**: 2026-05-13  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft  
**연결 문서**: [Phase39-3_MODE_AUTO_ROUTING_아키텍처_감사리포트.md](Phase39-3_MODE_AUTO_ROUTING_아키텍처_감사리포트.md)

---

## 1. 개요
Phase 39의 핵심인 "Zero-Command UX" 및 "Cross-Mode Handoff"가 프론트엔드 UI/UX 한계 및 백엔드 라우팅 설계 오류로 인해 완벽하게 연동되지 않고 있던 문제를 해결합니다. 사용자의 자연어 텍스트 분석 라우팅을 활성화하고, 상태와 산출물을 ID 기반으로 추적하여 인계(Handoff)하는 체계를 구축합니다.

---

## 2. 주요 개발 스펙 및 체크리스트

### 📌 2.1 프론트엔드: Zero-Command 입력 연동 (`TaskDetailModal.jsx`)
- [ ] **자연어 기반 트리거 연동**: 채팅 입력창(Input)에서 모드를 지정하지 않은 기본 상태(`NONE` 또는 Idle 상태)일 때 코멘트 작성 후 전송 시, 단순 `task:message` 소켓 이벤트에 그치지 않고 백엔드의 `/api/tasks/:id/run` 엔드포인트를 호출하도록 변경합니다.
  - *동작 원리*: `handleCommentSubmit` 등에서 입력된 텍스트를 `intent` 파라미터로 감싸 `POST /run`으로 전송 (모드는 명시하지 않음).
- [ ] **명시적 모드 실행 시 Context Payload 주입**: 사용자가 특정 모드(예: `DEV`)를 선택한 후 텍스트를 입력하고 "실행" 버튼을 누를 때, 입력한 추가 지시사항(텍스트)을 `intent` 필드로 백엔드에 전달하여 `Context Payload` 래핑이 가능하게 합니다.

### 📌 2.2 백엔드: ARCHITECT 라우팅 분기 처리 (`server.js`, `intentRouter.js`)
- [ ] **라우터 충돌 해결**: `intentRouter.js`가 자연어를 분석하여 `mode: 'ARCHITECT'` (또는 `PLAN_MASTER`)를 반환한 경우, 일반 `executor.js` 루프로 빠지지 않도록 가드(Guard) 로직을 추가합니다.
- [ ] **Plan Master 소켓 트리거**: 백엔드에서 ARCHITECT 모드로 감지되면 에이전트 실행을 중단하고 `io.emit('plan-master:trigger', { taskId })`를 호출해 프론트엔드에서 즉시 `PlanMasterModal`이 열리도록 통신 인터페이스를 구축합니다.

### 📌 2.3 백엔드: Cross-Mode Handoff (Diff Analysis) 래퍼 신설 (`executor.js`)
- [ ] **컨텍스트 상태 추적 (카드 ID 및 코멘트 ID)**: 에이전트가 실행될 때 과거 수행되었던 모드의 산출물(예: 기획 모드의 PRD 등)을 식별하기 위해 DB(`task.content` 또는 `comments` 테이블 내 고정된 `system` 코멘트 ID)에서 최신 상태를 불러옵니다.
- [ ] **System Prompt Wrapper 주입**: 이전 모드(예: ARCHITECT)에서의 기획 산출물과 현재 코드(또는 상태)를 Diff-비교하여 "작업 전 선행 분석을 통해 수정/제거/유지할 항목을 도출하라"는 내용의 System Prompt 지시자(Directive)를 강제 주입합니다.

---

## 3. 작업 순서 가이드

1. **Phase 1**: `server.js`의 `/api/tasks/:id/run` 라우터 수정 (ARCHITECT 분기 및 소켓 이벤트 발송)
2. **Phase 2**: `TaskDetailModal.jsx`에서 자연어 전송 시 자동 실행 트리거 및 소켓 수신 시 Plan Master 모달 오픈 연동
3. **Phase 3**: `executor.js` 내부에서 DB 코멘트 이력을 조회하여 카드 ID / 코멘트 ID 기반으로 Diff Analysis 프롬프트를 주입하는 Handoff 로직 구현
4. **Phase 4**: 종합 연동 테스트 (자연어 "기획서 써줘" -> 모달 오픈 -> 확정 -> "이제 코드 짜줘" -> Diff Analysis -> 개발 실행)

---
*본 문서는 감사를 통해 확인된 사항을 바탕으로 작성되었으며, 작업 완료 시 즉각적인 테스트로 전환합니다.*
