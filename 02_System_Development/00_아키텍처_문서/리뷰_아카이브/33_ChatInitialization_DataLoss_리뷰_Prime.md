# Prime (Opus) Review - Chat Initialization Data Loss (Phase B)

## 1. 개요
* **리뷰어:** Prime (Opus)
* **리뷰 대상:** 핫픽스 처리된 채팅/타임라인 초기화 버그 대응 방안
* **평가:** 🟡 B — 핫픽스 방향은 올바르나 근본적인 아키텍처 결함 3건 존재

## 2. 리뷰에서 지적된 3대 결함 및 조치 결과

### 🔴 결함 1: taskId 기준 분류가 불완전
* **지적 사항:** 채팅 탭에서도 칸반 카드가 포커스된 상태면 `taskId`가 할당되므로, 단순히 `!l.taskId`로 채팅과 타임라인을 구분하면 포커스된 채팅이 타임라인으로 오인되어 삭제되지 않는 버그 잔존.
* **조치 결과 (완료):** Phase B 분리를 통해 `useChatStore`와 `useTimelineStore`로 물리적으로 격리 완료. `useSocket.js`에서 라우팅 시 `log.type === 'agent_communication'` 또는 `(!log.taskId && log.agentId !== 'system')` 기준으로 명확하게 Chat Store로 분기하여 근본 해결.

### 🔴 결함 2: 핵폭탄 함수 `clearLogs`의 방치
* **지적 사항:** 단일 Store(`logStore`)에 남아있던 `clearLogs` (logs: [])는 여전히 타임라인까지 싹 밀어버릴 위험 내포.
* **조치 결과 (완료):** `logStore.js`를 완전히 폐기(`rm src/store/logStore.js`)하고, `chatStore.js`에 `clearChatLogs(projectId)`를 구현. `LogDrawer`의 삭제 버튼은 이제 안전하게 `chatStore.clearChatLogs`만 호출하며, 타임라인 데이터에는 어떠한 영향도 줄 수 없음.

### 🔴 결함 3: Auto-save 디바운스 `stale closure` + 브라우저 종료 방어 부재
* **지적 사항:** `TeamGuidelinesEditor.jsx`의 `handleSaveClick`이 이전 렌더의 클로저에 갇힘(deps 부재). 사용자가 창을 그냥 닫을 경우 미저장 데이터 유실.
* **조치 결과 (완료):**
  1. `handleSaveClick`을 `useCallback`으로 감싸고 `[isDirty, content, selectedProjectId]` 의존성 배열 명시.
  2. `useEffect`에 `handleSaveClick` 의존성 추가하여 최신 클로저 바인딩 보장.
  3. `beforeunload` 이벤트 리스너를 추가하여, `isDirty === true`일 때 브라우저 탭을 닫으려 하면 경고창("You have unsaved changes") 발생하도록 보호 장치 구현.

## 3. 종합 결과 (Phase B 달성)
단일 `logStore.js`로 인한 데이터 오염 및 대량 학살 취약점이 완전히 해소되었습니다. 프론트엔드 상태 아키텍처는 채팅(휘발성)과 타임라인(감사/불변)으로 완벽하게 분리되었으며, 향후 Phase C (서버 검증 레이어) 도입 전까지 안전하게 운영 가능한 튼튼한 기반을 갖추었습니다.
