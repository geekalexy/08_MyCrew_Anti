# Phase 38-1 Sprint 4: 실시간 LLM 연동 및 모델 스위칭 구현 완료 보고서

**날짜**: 2026-05-08  
**담당자**: 루카 (CTO)

---

## 1. 개요
본 보고서는 마이크루(MyCrew) 크롬 확장 프로그램의 Sprint 4 단계인 **'실시간 AI 모델 연동 및 통신망 고도화'** 작업의 결과를 정리합니다. 
기존 Sprint 2에서 구현된 임시 Echo(메아리) 응답 로직을 걷어내고, 실제 Antigravity IDE 브릿지 어댑터(`antigravityAdapter.js`)를 통해 고성능 AI 모델들과의 양방향 통신을 성공적으로 구축했습니다.

## 2. 주요 작업 내용

### 2.1 프론트엔드 (Chrome Extension UI)
- **Model Switcher 구현**: 안티그래비티 브라우저 컨트롤 패널 상단에 동적 모델 선택 드롭다운 UI 추가.
- **지원 모델 리스트**:
  - `Gemini 3.1 Pro (High) New`
  - `Gemini 3.1 Pro (Low) New`
  - `Gemini 3 Flash`
  - `Claude Sonnet 4.6 (Thinking)`
  - `Claude Opus 4.6 (Thinking)`
  - `GPT-OSS 120B (Medium)`
- **UI/UX 개선**: 챗봇 응답 메시지의 좌측 여백을 최적화하여 텍스트 정렬을 사용자 버블과 대칭되도록 수정.
- **IME 버그 픽스**: 한글 입력 시 엔터(Enter) 키로 메시지를 전송할 때 발생하는 '마지막 글자 2중 전송 버그(`e.nativeEvent.isComposing`)' 원천 차단.

### 2.2 백엔드 (Ari Engine - `server.js`)
- **LLM 라우팅 로직 주입**: Socket.io의 `extension:chat` 이벤트 리스너를 고도화하여 가짜 응답을 제거.
- **Antigravity 어댑터 연동**: 
  - `model` 파라미터가 `anti-`로 시작할 경우, 즉시 `antigravityAdapter.generateResponse`를 호출하여 외부 브릿지로 프롬프트 릴레이.
  - 가상 에이전트 식별자(`extension`)를 사용하여 기존 워크플로우 칸반 로직과 격리된 독립적인 채팅 채널 확립.
  - 타임아웃 60초 지정 및 `systemPrompt`에 브라우저 어시스턴트 역할(Persona) 강제 주입 완료.
- **좀비 프로세스 해결**: 포트 충돌(`EADDRINUSE: 4007, 5050`)을 유발하는 고아 프로세스(`ariDaemon.js`) 식별 및 메모리 정리 후 안전한 재기동 확보.

## 3. 테스트 결과
- **연결 안정성**: 소켓 연결(Connected) 및 연결 유실 시 자동 재접속(Polling/Websocket 폴백) 정상 동작.
- **모델 스위칭 응답**: 프론트엔드에서 선택한 모델 파라미터가 백엔드로 정확히 전달되며, 브릿지 폴더(`.bridge/requests`)를 통한 파일 I/O 통신이 1초 이내로 매끄럽게 처리됨.
- **응답 품질**: `응답하라 루카` 입력 시, 주입된 페르소나에 맞춰 "MyCrew의 Senior AI, 루카입니다. Antigravity Browser Assistant로서..." 라는 정확한 역할 기반 응답 렌더링 확인 완료.

## 4. Next Steps (차기 스프린트 제안)
통신망과 LLM 두뇌가 완벽하게 결합되었습니다. 다음 단계로는 브라우저 제어의 핵심 기능들을 구현해야 합니다.
1. **DOM Parsing & Read**: 현재 탭의 웹페이지 DOM 트리를 읽어와 LLM에게 컨텍스트로 넘기는 기능 연동.
2. **Action Execution**: LLM의 응답(클릭, 스크롤, 타이핑 지시)을 프론트엔드 Content Script가 해석하여 브라우저에서 실제 액션으로 수행하는 파이프라인.
3. **Session Resume (기억 유지)**: 확장 프로그램을 껐다 켜도 과거 대화 내역(메모리)을 유지하도록 백엔드 세션 스토리지 연동.
