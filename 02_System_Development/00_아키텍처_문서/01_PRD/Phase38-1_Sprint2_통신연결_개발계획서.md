# Phase 38-1: Sprint 2 통신망 연결 개발 계획서

**문서 버전**: v1.0  
**작성일**: 2026-05-08  
**작성자**: 루카 (Luca, CTO)  
**상태**: 🟡 진행 대기 (In Progress)

---

## 1. 개발 목표 (Objective)
크롬 확장 프로그램(Client)과 마이크루의 백엔드 `server.js` (Ari 엔진, Server) 간에 **Socket.io 기반의 양방향 실시간 통신망(Websocket)**을 개통합니다. 프론트엔드의 텍스트 입력이 서버로 전달되고, 서버의 응답(Echo)이 실시간으로 프론트엔드 UI에 렌더링되는 **End-to-End 통신 검증**이 핵심입니다.

---

## 2. 개발 체크리스트 (Task Checklist)

### 📌 프론트엔드 (03_크롬_익스텐션)
- [x] `socket.io-client` 패키지 설치 (`npm install socket.io-client`).
- [x] `src/App.jsx` 내부에 Socket.io 클라이언트 인스턴스 초기화 로직 작성 (`http://localhost:3000` 타겟팅).
- [x] 채팅 전송 버튼 클릭 시, 임시 메시지(Mock) 출력 로직을 제거하고 `socket.emit('extension:chat', text)`로 서버에 데이터 전송 로직 구현.
- [x] 서버로부터 `extension:reply` 이벤트를 수신받아, `messages` 상태(State) 배열에 에이전트 응답으로 업데이트하는 훅(`useEffect`) 구현.

### 📌 백엔드 (01_아리_엔진/server.js)
- [x] `server.js`의 CORS(Cross-Origin Resource Sharing) 설정에 크롬 익스텐션의 오리진(`chrome-extension://*` 또는 허용 정책)을 추가하여 소켓 접속 차단 방지.
- [x] `io.on('connection')` 블록 내부에 확장 프로그램 전용 이벤트 리스너(`socket.on('extension:chat')`) 개설.
- [x] 수신받은 텍스트를 터미널 콘솔에 출력(`console.log`)하여 수신 여부 확인.
- [x] (Sprint 4 전까지 임시로) 수신한 메시지에 "Ari Engine 수신 완료:" 접두사를 붙여 `socket.emit('extension:reply', 응답)` 형태로 즉시 메아리(Echo) 반환.

---

## 3. 핵심 테스트 지점 (Test Points & QA 시나리오)

안정적인 릴리즈를 위해 다음 4가지 테스트 지점(Test Points)을 반드시 통과해야 합니다.

1. **[TP-01] CORS 보안 통과 테스트**
   - **방법**: 크롬 브라우저에서 익스텐션을 열고 '검사(F12)' 패널 확인.
   - **통과 기준**: Console 탭에 `Access-Control-Allow-Origin` 에러 등 빨간색 웹소켓 연결 거부 에러가 뜨지 않아야 함.

2. **[TP-02] 백엔드 수신 (Upstream) 테스트**
   - **방법**: 익스텐션 입력창에 `통신 테스트 123` 입력 후 전송.
   - **통과 기준**: 마이크루 백엔드 터미널 창에 `[Extension] Received chat: 통신 테스트 123` 로그가 즉시 출력되어야 함.

3. **[TP-03] 프론트엔드 렌더링 (Downstream) 테스트**
   - **방법**: TP-02 진행 직후 익스텐션 UI 확인.
   - **통과 기준**: 익스텐션 채팅창에 0.1초 내로 `Ari Engine 수신 완료: 통신 테스트 123` 메시지가 새 말풍선으로 렌더링되어야 함.

4. **[TP-04] 연결 탄력성 (Resilience) 테스트**
   - **방법**: 익스텐션 패널을 닫았다가 다시 열거나, `server.js`를 재시작해봄.
   - **통과 기준**: 서버가 재시작되더라도 익스텐션이 자동으로 재연결을 시도하여 통신이 정상적으로 복구되어야 함.

---
**[다음 단계]**
본 계획서의 모든 체크리스트 및 테스트 지점을 통과하면 즉시 Sprint 2가 완료되며, 이후 실제 LLM 모델을 릴레이하는 Sprint 4 통합 작업으로 이행합니다.
