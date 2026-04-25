# Session Log: 2026-04-26 (Luca)

## 🎯 오늘 세션의 주요 목표
- Ari 데몬 및 프론트엔드-백엔드 동기화 과정에서 발생한 E2E(End-to-End) 워크플로우 버그 픽스
- 환각 현상(Hallucination) 방지 및 자동화 파이프라인(FilePollingAdapter 등)과 실시간 UI의 데이터 매핑 정상화
- 치밀한 기획 및 문제 해결(Debugging) 중심의 안정성 확보

## 🛠 주요 수정 내역

### 1. 환각 크루(Luma 등) 할당 방지를 위한 하드 밸리데이션 적용
- **파일**: `ai-engine/ariDaemon.js`
- **변경 사항**: `createKanbanTask`와 `updateKanbanTask` 도구 실행 시, 할당된 크루원이 허용된 목록(`['luca', 'nova', 'pico', 'lumi', 'luna', 'ollie', 'lily']`)에 없으면 즉시 에러 반환. 프롬프트 규칙뿐만 아니라 서버 런타임에서도 잘못된 입력을 강제로 차단함.

### 2. 한글 IME 입력 중 Enter 전송 시 텍스트 잔존 버그 수정
- **파일**: `src/components/Log/LogDrawer.jsx`
- **변경 사항**: `onKeyDown` 이벤트에서 `!e.nativeEvent.isComposing` 조건을 추가하여 한글 글자 조합이 완료된 이후에만 채팅 전송 및 초기화가 이루어지도록 안정성 확보.

### 3. Task 내용이 모달 편집 창에서 누락되는 현상 수정
- **파일**: `server.js`, `TaskDetailModal.jsx`
- **변경 사항**:
  - `server.js`의 `GET /api/tasks` API에서 최적화를 이유로 제거되었던 `content: detailContent` 필드를 복구하여, 프론트엔드가 내용을 정상적으로 로드할 수 있도록 수정.
  - `TaskDetailModal.jsx`의 폴백(Fallback) 로직을 원복하여 정확한 본문만을 매핑.

### 4. 댓글 지시 및 우선순위 상향에 따른 에이전트 구동 정상화
- **파일**: `server.js`, `TaskDetailModal.jsx`
- **변경 사항**:
  - `TaskDetailModal.jsx`에서 우선순위나 컬럼 변경 후 '전송 및 반영' 시 Zustand 스토어 업데이트에 그치지 않고, `PATCH /api/tasks/:id` REST API를 명시적으로 호출하도록 수정.
  - 특히 우선순위 'high' 지정 시 상태를 강제로 `in_progress`로 이동시켜, `server.js`의 에이전트 구동 트리거(FilePollingAdapter)가 정확히 발동되도록 설정.
  - `server.js`의 댓글 기반 AI 트리거(`runDirect`) 실행 전, 상태값을 명확히 `in_progress`와 `review`로 변경하고, 타임라인에 실제 발생한 시스템 로그가 정확하게 렌더링되도록 처리.

## 📝 다음 세션을 위한 참고 사항
- 이번 세션은 어떠한 우회적인 해결책(Mock)도 쓰지 않고 실제 데이터 흐름의 정합성을 맞추는 데 집중함.
- 다음 단계 작업 착수 전, 항상 "아주 치밀한 기획 먼저" 수행할 것.

