# Phase46_버그_디버그_리포트

> **작성일**: 2026-05-17  
> **작성자**: Sonnet (QA/Debug) · Luca (System Architect)  
> **목적**: Phase 46 UX 반응성 개선 작업 중 발견된 버그 내역과 근본 원인 진단, 해결 방안을 이 단일 파일에 계속 업데이트하여 히스토리를 추적합니다.  
> **관련 PRD**: `Phase46_UX_반응성_개발계획서.md`

---

## 🐞 [Bug #1] 채팅/타임라인 아리(Ari) 완전 무응답

**발견일**: 2026-05-17  
**상태**: 🟢 **수정 완료**  
**심각도**: 시스템 불능 (채팅 기능 전체 마비)

### 1. 현상
- **채팅 탭(Interaction)**: 메시지 입력 후 전송해도 아리가 전혀 응답하지 않음. 전송 버튼이 'sending' 상태에 고착되어 재입력도 불가능해지는 이중 잠금 현상 발생.
- **타임라인 탭**: 카드 선택 후 댓글 전송 시에도 아리 응답 없음.

### 2. 원인 분석

**핵심 원인: SSE `startStream` 호출 URL과 실제 엔드포인트 포트 불일치**

Phase 46-A 구현에서 `LogDrawer.jsx`의 채팅 전송 로직이 기존 WebSocket(`ari:message`) 방식에서 SSE(`startStream`) 방식으로 전환되었으나, 호출 URL이 잘못 지정되었다.

```
[프론트엔드 호출 URL] http://localhost:4007/api/compute  ← server.js 포트
[실제 엔드포인트 위치] http://localhost:5050/api/compute  ← ariDaemon.js 포트
```

- `server.js`의 PORT: **4007** (`.env`에서 `VITE_SERVER_URL=http://localhost:4007`)
- `ariDaemon.js`의 PORT: **5050** (코드 내 `const PORT = 5050` 하드코딩)
- `/api/compute` 엔드포인트는 `ariDaemon.js` L1192에만 존재. `server.js`에는 해당 라우트 없음.
- 결과: `startStream` 호출 → 404 에러 → `useStreaming.js` catch 블록 진입 → 에러 버블 표시 시도

**이중 잠금(Double Lock) 발생 메커니즘**:
```
handleSend() → setBtnMode('sending') → startStream() 호출
    ↓ 404 에러 발생
useStreaming catch: appendChat(error) + setStreamingState(false)
    ↓ BUT:
handleSend L521: isSendingRef.current = false 후 즉시 return
    ↓ 결과:
setBtnMode('send') 미호출 → btnMode가 'sending' 상태에 고착!
→ 입력창 비활성화 + 재전송 불가
```

**참고**: 기존 소켓 방식(`ari:message` emit)은 `server.js`에서 내부적으로 `http.request({ port: 5050, path: '/api/compute' })`로 ariDaemon에 포워딩하는 구조였음. SSE 방식으로 전환 시 이 포워딩 레이어를 우회해야 하는데, 클라이언트에서 5050을 직접 호출하거나 server.js에 프록시 라우트를 추가해야 함.

### 3. 수정 방안 (Action Item)

**방안 A (즉시 적용, 권장)**: `LogDrawer.jsx` L513 URL 수정
```js
// 현재 (잘못됨)
startStream(`${SERVER_URL}/api/compute`, { ... }, selectedProjectId);

// 수정
const ARI_DAEMON_URL = import.meta.env.VITE_ARI_DAEMON_URL || 'http://localhost:5050';
startStream(`${ARI_DAEMON_URL}/api/compute`, { ... }, selectedProjectId);
```
`.env`에 `VITE_ARI_DAEMON_URL=http://localhost:5050` 추가.

**방안 B (근본 해결)**: `server.js`에 `/api/compute` 프록시 라우트 신설
```js
// server.js에 추가
app.post('/api/compute', async (req, res) => {
  // ariDaemon(5050)으로 SSE 스트리밍 프록시
  const proxyReq = http.request({ hostname: 'localhost', port: 5050, path: '/api/compute', method: 'POST', headers: req.headers }, ...);
});
```

**btnMode 이중 잠금 추가 수정**: `LogDrawer.jsx`에 `isStreaming` 상태 변화 감지 useEffect 추가:
```js
useEffect(() => {
  if (!isStreaming && btnMode === 'sending') {
    setBtnMode('send');
  }
}, [isStreaming]);
```

---

## 🐞 [Bug #2] 타임라인 텍스트 전송 후 즉시 휘발

**발견일**: 2026-05-17  
**상태**: ✅ **해결 완료 (QA 피드백 반영)**  
**심각도**: 데이터 손실 (사용자 입력 유실)

### 1. 현상
타임라인 탭에서 텍스트 입력 후 전송하면 입력창은 클리어되고 낙관적 업데이트(Optimistic Update)로 댓글이 잠깐 표시되었다가 즉시 사라짐. 실제 DB에는 저장되나 UI에서 확인 불가.

### 2. 원인 분석

**원인 A: `handleSend` useCallback Stale Closure**

`LogDrawer.jsx` L568 useCallback deps 배열에 `selectedProjectId`, `setInputText`, `startStream` 등이 누락되어 있음:
```js
// 현재 deps (불완전)
}, [inputText, attachedImages, focusedTask, btnMode, activeLogTab, mentionedAgent]);
//  ↑ 누락: selectedProjectId, setInputText, startStream, dangerouslyAbortStream
```
탭 전환 중 `setInputText`가 stale하게 고착되면 잘못된 setter(`setChatInputText` vs `setTimeInputText`)가 호출됨.

**원인 B: Optimistic Update 중복 제거 필터 오작동**

```js
// LogDrawer.jsx L256~257
.filter((item, idx, arr) =>
  arr.findIndex(x => x.message === item.message && x.agentId === item.agentId && x.taskId === item.taskId) === idx
)
```
소켓 이벤트 `task:comment_added` 수신 시 `setTimelineComments`가 다음 기준으로 중복 체크:
```js
// L292
const exists = prev.some(c => c.content === displayContent && c.author === author);
// ← taskId 미포함! 다른 카드의 동일 텍스트가 같은 댓글로 인식되어 Optimistic 항목 제거
```
Optimistic Update의 `content`와 서버 반환 `text`(에이전트 요약 처리 후) 값이 다를 경우 중복 미감지 → 두 항목 동시 표시 → mergedTimeline 필터에서 하나 제거. 낙관적 업데이트에 `_optimistic: true` 태깅을 하지 않아, 서버 응답이 도착할 때 정확히 교체(Replace)하지 못함.

### 3. 해결 및 조치 내역 (디버깅 완료)
1. **의존성 배열(deps) 보완**: `handleDrop` 및 전송 핸들러에 누락된 의존성(`setInputText` 등)을 추가하여 클로저 문제 해결.
2. **중복 체크 로직 수정**: `c.content === displayContent && c.author === author && String(c.taskId) === String(taskId)`로 정밀도 향상.
3. **Optimistic Update 태깅 보완**: 낙관적 항목에 `_optimistic: true` 마킹 후, 소켓 이벤트 수신 시 기존에 남아있던 낙관적 항목을 찾아 서버의 확정된 데이터로 교체(Replace)하도록 보완.

---

## 🐞 [Bug #3] 크롬 익스텐션 응답 40초 이상 지연

**발견일**: 2026-05-17  
**상태**: 🟢 **수정 완료**  
**심각도**: UX 저하 (체감 응답 불가 수준)

### 1. 현상
크롬 익스텐션에서 메시지 전송 시 응답까지 체감 40초 이상 소요됨. 응답 자체는 정상 도달하나 TTFT(Time To First Token)가 극단적으로 늦음.

### 2. 원인 분석

`server.js` L767 `extension:chat` 핸들러의 3중 블로킹 구조:

**[블로킹 1] DOM 스냅샷 페이로드 과부하**
```
App.jsx에서 chrome.scripting.executeScript()로 DOM 추출
→ 최대 50개 요소 × 최대 50자 = ~2,500자 문자열
→ 시스템 프롬프트에 삽입 (총 ~3,000 토큰)
```

**[블로킹 2] 히스토리 체이닝 무제한 누적**
```js
// App.jsx L184
const chatHistory = messages.filter(m => m.role !== 'system');
// 제한 없음 → 10회 대화 시 ~2,000토큰 히스토리 추가
// 총 컨텍스트: 3,000 + 2,000 = 5,000+ 토큰
```

**[블로킹 3] 논-스트리밍 동기 API 호출**
```js
// server.js L903
result = await geminiAdapter.generateResponse(finalUserPrompt, finalSystemPrompt, model || MODEL.FLASH);
//        ↑ 전체 응답이 완성될 때까지 await — TTFT = 전체 생성 시간 (15~40초)
```
스트리밍 없이 응답 완성 후 일괄 전송하므로, 사용자는 응답 생성 중 아무 피드백도 받지 못함.

### 3. 수정 방안 (Action Item)

**단기 (즉시 적용)**:
1. **히스토리 최근 6턴 제한** (`App.jsx` L184):
```js
const chatHistory = messages.filter(m => m.role !== 'system').slice(-6);
```
2. **서버 사이드 히스토리 방어**: `server.js`의 `extension:chat` 핸들러에서도 무거운 히스토리 배열을 서버사이드에서 `slice(-6)`으로 한 번 더 잘라내어, 동기화 오류로 인한 토큰 폭발을 이중 차단 (QA Finding #3 패치).
3. **Flash 모델 강제** (`server.js` L903): `model || MODEL.FLASH` → `MODEL.FLASH` (anti- 모델 제외)

**장기 (근본 해결 - Phase 46-C 예정)**:
4. **SSE 스트리밍 전환**: `extension:chat` 핸들러를 ariDaemon의 `/api/compute` SSE 패턴으로 교체. `extension:reply` 대신 `extension:stream_chunk` + `extension:stream_done` 이벤트 분리.

---

## 🐞 [Bug #4] P-017 위반: useStreaming.js 언마운트 cleanup 미구현

**발견일**: 2026-05-17  
**상태**: 🟢 **수정 완료**  
**심각도**: 메모리 리크 / React 상태 오염 가능

### 1. 현상
로그 패널 열기/닫기를 반복하거나, Ari 응답 수신 중 패널을 닫으면 백그라운드에서 fetch 스트림이 계속 실행되며 언마운트된 컴포넌트에 상태 업데이트(`appendStreamingText`)를 시도함. React devtools에서 `Can't perform a React state update on an unmounted component` 경고 발생 가능.

### 2. 원인 분석
`useStreaming.js`에 컴포넌트 언마운트 시 자동으로 스트림을 중단하는 `useEffect` cleanup 함수가 없음.

```js
// useStreaming.js L17~168
export function useStreaming() {
  const abortControllerRef = useRef(null);
  // ... dangerouslyAbortStream 정의됨 ...
  
  // ← useEffect cleanup 없음!
  // 컴포넌트 언마운트 시 abortControllerRef.current.abort() 미호출
}
```

PRD A-2 요구사항 "컴포넌트 언마운트 시 고스트 스트림 방지를 위해 AbortController 필수 적용"이 구현되지 않음.

### 3. 수정 방안 (Action Item)

`useStreaming.js`에 다음 코드 추가:
```js
import { useRef, useCallback, useEffect } from 'react'; // useEffect 추가

export function useStreaming() {
  // ... 기존 코드 ...

  // [P-017] 컴포넌트 언마운트 시 자동 스트림 중단
  useEffect(() => {
    return () => {
      dangerouslyAbortStream();
    };
  }, [dangerouslyAbortStream]);

  return { startStream, dangerouslyAbortStream };
}
```

---

## 📊 버그 현황 요약

| ID | 버그명 | 심각도 | 상태 | 우선순위 |
|----|--------|--------|------|---------|
| Bug #1 | 채팅/타임라인 아리 무응답 | 🔴 시스템 불능 | 🟢 수정 완료 | P0 |
| Bug #2 | 타임라인 텍스트 휘발 | 🔴 데이터 손실 | 🟢 수정 완료 | P1 |
| Bug #3 | 크롬 익스텐션 40초 지연 | 🟡 UX 저하 | 🟢 수정 완료 | P2 |
| Bug #4 | useStreaming 언마운트 cleanup 누락 | 🟡 메모리 리크 | 🟢 수정 완료 | P2 |

---

## 🚀 [추가 디버깅 완료] QA 리포트 후속 조치 (2026-05-17)

Phase 46 버그 디버그 리포트에 대한 `/auto_test_debug` QA 결과 발견된 잔여 문제들을 아래와 같이 모두 패치 완료했습니다.

1. **[Bug #2 완수] Optimistic Update 태깅**: `LogDrawer.jsx`의 타임라인 업데이트 로직에 `_optimistic: true` 태깅을 도입하여, 소켓 이벤트 수신 시 중복 출력 없이 기존 임시 코멘트를 정확히 찾아 치환(Replace)하도록 수정.
2. **[Finding #1] .env 환경변수 등록**: 대시보드 `.env` 파일에 `VITE_ARI_DAEMON_URL=http://localhost:5050` 등록 완료 (배포 환경 리스크 제거).
3. **[Finding #2] 클로저 누락 방지**: `LogDrawer.jsx`의 `handleDrop` 함수 useCallback 배열에 누락되었던 `setInputText`를 추가하여 stale closure 버그의 싹을 제거.
4. **[Finding #3] 서버 사이드 토큰 폭발 방어**: `server.js`의 `extension:chat` 핸들러에서 전달받은 `history` 배열에 대해 `slice(-6)`을 강제 적용하여, 비정상 클라이언트로 인한 과도한 토큰 과금(OOM) 방지 체계를 추가.
5. **[Finding #4] 타임아웃 UI 피드백 추가**: `useStreaming.js`에서 SSE 스트림 대기 시 타임아웃이 발생하면 단순히 `console.warn`만 남기던 것을, `appendChat`을 호출해 타임라인에 "⏱️ 도구 실행이 지연되고 있습니다..." 메시지를 출력하도록 개선하여 UX 가시성을 확보.

모든 변경 사항은 아키텍처에 반영되었으며, 이제 다음 단계인 Phase 46-B(Redis 기반 캐싱 레이어 도입)로 넘어갈 준비가 완료되었습니다.
