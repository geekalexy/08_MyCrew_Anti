# Phase 46 — UX 반응성(Latency) 및 통신 아키텍처 개선 개발계획서

> 작성자: 루카 (Luca)  
> 작성일: 2026-05-16  
> 관련 문서: `Phase46_UI_반응성_및_통신_아키텍처_개선_PRD.md`  
> 상태: **최종 확정 (Supreme Review 3중 검증 및 결함 보완 완료)**

---

## 1. 개요 및 구현 전략

본 개발계획서는 `Phase 46 PRD`에 명시된 UX 지연(TTFT 병목) 해소와 통신 아키텍처 개선을 목적으로 합니다. Supreme Review에서 도출된 결함과 선결 과제를 전면 수용하여 설계가 보강되었습니다.

> **핵심 전략**: 크롬 익스텐션의 MV3 제약(Service Worker SSE 수신 불가)과 소켓 이벤트 강한 결합도를 고려하여, **백엔드/프론트엔드 통신 최적화(Phase 46-A)**를 먼저 완성한 뒤 크롬 익스텐션 구조 재설계(Phase 46-C)를 완전히 분리된 스프린트로 진행합니다.

---

## 2. 구현 전 선결 체크리스트 (Phase 46-A 착수 전)

- [ ] `modelRegistry.js`에 `ARI_GEMINI_MODELS` 상수를 신설하고 `ariDaemon.js` L1197 참조 교체 (P-006 준수).
- [ ] `useStreaming.js` 생성 위치 확정 (`src/hooks/` 디렉토리).
- [ ] `chatStore.js` 내에 스트림 진행 상태 필드(`isStreaming: false`, `streamingText: ''`) 추가.

---

## 3. 개발 단계 및 태스크 리스트

### 🏁 Phase 46-A: 백엔드 SSE 파이프라인 및 프론트 통신 분리 (우선 구현)

**목표**: `ariDaemon.js`의 연쇄 블로킹 구간 해소, `useStreaming.js` 훅 신설을 통한 프론트엔드 God Node 방지 및 상태 지시자 노출.

- [ ] **A-1. `ariDaemon.js` 도구 이벤트 래핑 및 SSE 연동**
  - [ ] `L1286` `for` 루프 내부 `L1288 await executeTool()` 호출 직전과 직후에 각각 `tool:start` 및 `tool:end`를 `res.write`로 개별 발송하는 패턴 적용.
  - [ ] `tool:end` 이벤트에 `durationMs` 필드(도구 실행 시간)를 포함시켜 UI에 "실행 완료 (3.2초)" 형태로 표시 가능하도록 구현.
  - [ ] 도구별 내부 식별자(`toolName`)를 사용자 친화적 표시명(예: `run_command` → `터미널 명령어 실행`)으로 변환하는 매핑 테이블 적용.
  - [ ] `/api/compute` 엔드포인트의 SSE 헤더 설정(L1226) 직후 `req.on('close')` 핸들러를 바인딩하여 브라우저 종료 시 스트림과 워커 즉각 중단(Abort).
  - [ ] 서버 재시작 시 유실 방지를 위해, `conversationHistory` 업데이트 로직을 `res.on('finish')` (정상 종료) 콜백 내로 이동.

- [ ] **A-2. 프론트엔드 `useStreaming.js` 신설 및 `chatStore` 연동**
  - [ ] SSE 수신/파싱을 전담하는 `useStreaming.js` 훅 개발 (기존 WebSocket 통신과 분리).
  - [ ] P-017 준수: 컴포넌트 언마운트 시 고스트 스트림 방지를 위해 `AbortController` 필수 적용 및 스트림 강제 중단 함수명을 `dangerouslyAbortStream()`으로 명명.
  - [ ] WebSocket과 SSE 병행 운용 기간 동안 발생하는 이중 이벤트 중복 렌더링 방지용 Feature Flag 추가.

- [ ] **A-3. UI 타임아웃 차등 적용 및 상태 인디케이터**
  - [ ] `TaskDetailModal` / `ChatPanel`에 `tool:start` 수신 시 애니메이션 인디케이터 컴포넌트 추가.
  - [ ] `useStreaming.js` 내부에 카테고리별 타임아웃 매핑 테이블 적용 (거짓 양성 에러 방지):
    - 경량 (읽기/조회): 15초
    - 중량 (파일/DB 쓰기): 30초
    - 무거운 외부 호출: 60초
    - 장기 실행 (터미널, Graphify 스캔): 120초

---

### 🚀 Phase 46-B: 인메모리 캐싱 시스템 (Redis + File Watcher)

**목표**: 에이전트의 워크스페이스 상태 파악에 소모되는 Reasoning Time 제로화.

- [ ] **B-1. Redis 캐시 인프라 구축 및 격리**
  - [ ] 워크스페이스 디렉토리 캐시 저장 시 `projectId` 접두사를 포함한 Key 설계로 Tenant Isolation 보장.
  - [ ] 기동 순서 및 Circuit Breaker 패턴: `ioredis`의 `reconnectOnError` + `retryStrategy` 옵션을 활용하여 Redis 미연결/장애 시 실시간 파일 I/O로 즉시 우회(Fallback)하고, 복구 시 캐시 모드로 전환되는 Half-Open 상태 관리 구현.

- [ ] **B-2. 워처(Watcher) 유실 대응 구조**
  - [ ] Chokidar 파일 감시 이벤트 발생 시 캐시 무효화/업데이트 로직 작성.
  - [ ] 이벤트를 놓쳤을 경우에 대비한 Redis TTL 적용 및 백그라운드 주기적 해시 검증 데몬 추가.

---

### 🧩 Phase 46-C: 크롬 익스텐션 MV3 구조 재설계 (별도 스프린트)

**목표**: 소켓 하드코딩 완전 제거 및 AOM 기반 동적 추출 파이프라인.  
*(※ 프론트 대시보드 쪽 SSE 릴레이 안정화 후 후속 진행)*

- [ ] **C-1. 크롬 익스텐션 SSE 수신 아키텍처 개편**
  - [ ] Background Service Worker의 EventSource 수신 제약을 극복하기 위해 Offscreen Document 릴레이 구조 또는 Content Script 직접 수신 패턴 도입.
  - [ ] `manifest.json` `permissions` 배열에 `"offscreen"` 권한 추가 및 다중 Offscreen Document 충돌 방지 설계 적용.
  - [ ] 익스텐션 `App.jsx` 내부에 하드코딩된 6개 소켓 의존성 제거 및 SSE 기반 전면 전환.

- [ ] **C-2. AOM 민감 정보 보안 필터 (Security)**
  - [ ] Content Script DOM 트리 추출 시 `input[type=password]`, `input[type=hidden]`, `[autocomplete*="cc-"]` 등 원천 필터링.
  - [ ] `[contenteditable]` 요소 및 `textarea`의 `innerHTML` 마스킹 또는 길이 제한(100자) 적용.
  - [ ] `title`, `placeholder` 속성에서 발생할 수 있는 데이터 유출 방지를 위한 속성 화이트리스트 파싱 적용.

---

## 4. 진행 시 주의사항

1. **God Node 폭발 주의**: 현재 통신 계층의 God Node인 `TaskDetailModal()`(Rank 9, 22 edges)과 `useSocket()`(Rank 7, 23 edges)을 직접 수정하지 마십시오. 새로운 통신 계층인 `useStreaming.js`가 기존 컴포넌트 로직을 최대한 오염시키지 않도록 파서데(Facade) 역할을 해야 합니다. (edges가 25+로 증가하지 않도록 격리)
2. **Blast Radius (영향 반경)**: Phase 46-A 백엔드 변경 직후 프론트엔드의 `ChatMessage` 렌더링 방식 파편화에 대비해야 합니다. 스트리밍 텍스트 렌더링 중 커서 포커스 유실, 스크롤 튀팅 현상 방지에 유의하십시오.

---

## 5. 즉시 다음 행동 (Next Action)

선결 체크리스트 완료 후, **"Phase 46-A (백엔드 SSE 및 프론트 통신 분리)"** 태스크부터 구현을 착수합니다. 가장 먼저 `ariDaemon.js` 루프 내부에 `tool:start` / `tool:end` 이벤트를 삽입하는 작업부터 시작합니다.
