# Phase 38-1: Chrome Extension 에이전트 브라우저 제어 개발 구현 보고서

- **작성일**: 2026-05-09
- **작성자**: 루카 (Luca)
- **대상 기획서**: [Phase38-1_ChromeExtension_에이전트_기획서.md](../01_PRD/Phase38-1_ChromeExtension_에이전트_기획서.md)
- **관련 코드**: `server.js`, `database.js`, `App.jsx` (크롬 익스텐션)

---

## 1. 구현 개요
본 구현 보고서는 크롬 익스텐션을 단순한 챗봇 화면에서 **"능동적으로 브라우저 상황을 파악하고 직접 제어할 수 있는 Super Ari"**로 고도화한 Sprint 4 ~ 6의 개발 내역을 요약합니다.

## 2. 주요 구현 항목 (Sprints 4, 5, 6)

### ✅ Sprint 4: 고성능 LLM 스위칭 및 Antigravity IDE 브릿지 연동
- **내용**: 익스텐션에서 사용자가 모델을 동적으로 변경할 수 있도록 UI(Dropdown)를 연동.
- **구현 방식**: 
  - `server.js`의 `extension:chat` 핸들러에서 `model` 접두사가 `anti-`로 시작할 경우, `antigravityAdapter`를 통해 **MyCrew의 Antigravity PRO/Enterprise 구독 토큰**을 무제한으로 사용하도록 라우팅 처리.
  - 내장 `geminiAdapter`와 IDE Bridge 기반 외부 모델을 유연하게 교체 가능하게 구현 완료.

### ✅ Sprint 5: 세션 영구 저장 (Persistent Memory)
- **내용**: 익스텐션 패널을 닫았다 열어도 기존 대화 컨텍스트가 완벽히 복원되는 기능.
- **구현 방식**:
  - `database.js` 내에 익스텐션 전용 세션 테이블 `extension_sessions` 생성.
  - 백엔드에서 `extension:chat` 수신 시 히스토리 배열을 DB에 `ON CONFLICT DO UPDATE` 로직으로 실시간 반영 (`saveExtensionSession`).
  - 익스텐션 최초 부팅(Socket Connect) 시 `extension:load_history` 이벤트를 발생시켜 과거 대화를 불러오고 화면에 복원 (`App.jsx`).

### ✅ Sprint 6: Action Execution (브라우저 DOM 읽기 및 제어)
- **내용**: 활성화된 탭의 화면 요소를 파악하고, LLM의 판단에 따라 버튼 클릭 및 텍스트 입력을 수행.
- **구현 방식**:
  - **DOM Read (시야 확보)**: `App.jsx`에서 `chrome.scripting.executeScript`를 호출하여 화면 내 `button, a, input, textarea` 등 상호작용 가능한 요소들을 스캔 후 CSS Selector와 텍스트를 추출. 이를 `domSnapshot` 형태로 묶어 백엔드(Context)로 전달.
  - **Safety Bypass (방어기제 무력화)**: LLM이 "화면을 볼 수 없다"고 거절하는 것을 방지하기 위해 `server.js` 시스템 프롬프트에 '당신은 DOM을 통해 화면을 본다', '거절 변명 금지' 규칙을 강력 적용.
  - **Action Execution (직접 제어)**: 모델이 `{"action": "CLICK", "selector": "..."}` JSON 포맷을 반환하면 프론트엔드가 이를 낚아채서 파싱 후 네이티브 자바스크립트로 `el.click()` 및 `Enter` 이벤트를 주입.
  - **SPA 대응 (React 우회)**: 칸반 보드 등 React 환경에서 `el.value` 입력을 무시하는 현상을 막기 위해 `Native Setter (getOwnPropertyDescriptor)`를 호출하여 State가 정상 반영되도록 우회 조치.

## 3. UI 폴리싱 및 사용자 경험(UX) 개선
- 에이전트가 출력하는 Action JSON 블럭이 채팅창에 그대로 노출되지 않도록, 프론트엔드 파싱 단계에서 정규식(`/```(?:json)?\s*\{\s*"action"[\s\S]*?\}\s*```/ig`)을 이용해 깔끔하게 제거.
- 액션 수행 시 **"✨ 지정하신 액션을 실행했습니다!"** 또는 자연스러운 대화형 코멘트만 표시되도록 마감 완료.

## 4. 향후 과제 (Next Steps)
- **Sprint 7**: 퀵 커맨드 연동 (`/task` 명령어 입력 시 칸반 자동 생성 등 단축키 확장)
- 모달 내 DOM 분석 고도화 및 Shadow DOM 스캔 지원 여부 검토

---
**[결론]**: 크롬 익스텐션은 단순 지식 질의응답을 넘어, 브라우저 화면의 Context를 직접 이해하고 사용자를 대신해 클릭/타이핑을 수행하는 완벽한 AI 비서 파이프라인(Agentic Web Control)을 구축하였습니다.
