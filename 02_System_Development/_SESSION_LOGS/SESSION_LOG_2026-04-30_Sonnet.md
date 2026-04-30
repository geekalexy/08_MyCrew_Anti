# SESSION LOG — 2026-04-30 소넷 작업 완료

## ✅ 완료 항목 (Phase 28 IO Hub)

### Backend (`server.js`)
- `multer` import 추가
- `POST /api/input/:taskId` — 유저 첨부 인풋 저장 (`07_OUTPUT/inputs/{taskId}/`)
- `POST /api/output/:taskId` — 에이전트 결과물 저장 + `output:created` 소켓 emit
- `/io/inputs`, `/io/outputs` 정적 서빙 등록
- 허용 확장자 필터, 10MB 제한, 고유 파일명(`Date.now_원본명`)

### Frontend — 첨부 기능
- `TaskDetailModal.jsx` — 댓글 입력란 `📎 첨부` 버튼 추가, `/api/input/:taskId` 업로드
- `TaskCreateModal.jsx` — 완전 리빌드: 5개 필드(제목·내용·상태·우선순위·담당자) + 첨부 + CEO(나) 옵션
- `LogDrawer.jsx` — 드래그앤드롭/클립보드 붙여넣기 → 서버 실제 저장 연결 (`/api/input/{taskId}`)
  - 기존: base64 메모리 보관만 → 아리 분석 불가
  - 수정: 서버 저장 + `[첨부: 경로]` 태그 메시지에 삽입 → 아리 `analyzeLocalImage` 자율 호출 가능

### Frontend — Output 탭 (`TaskDetailModal.jsx`)
- Discussion / Activity 옆 **Output 탭** 신규 추가
- `output:created` 소켓 수신 → 결과물 파일 실시간 표시
- 이미지: 인라인 미리보기 / 기타: 다운로드 링크
- 결과물 도착 시 Output 탭 자동 전환

### 카드 만들기 개선 (`Column.jsx`)
- 인라인 폼 유지하면서, 폼 상단에 `[⊞ 상세 입력]` 버튼 추가
- 클릭 → `TaskCreateModal` 오픈 (현재 인라인 입력값 인계)
- 인라인 폼 담당자 셀렉트에 `CEO(나)` 추가

---

## 🐛 미해결 버그 — 루카 인계

### 증상
카드 클릭 시 `TaskDetailModal`이 열리지 않고 **화면 전체가 빈 흰색**으로 전환됨.

### 원인 추정
`Column.jsx`에서 `TaskCreateModal`을 import + 렌더링하면서 발생한 것으로 추정.  
`TaskCreateModal`이 `useSocket`, `useAgentStore` 훅을 직접 호출하는데,  
Column이 4개(todo/in_progress/review/done) 렌더링되므로 4개의 TaskCreateModal 인스턴스가 동시에 훅을 호출.  
브라우저 콘솔 에러 미확인 상태.

### 확인 필요 사항
1. 브라우저 콘솔 에러 메시지 확인
2. `TaskCreateModal.jsx`의 훅 호출 방식 점검
3. 가능하다면 `TaskCreateModal`을 `Column.jsx` 내부에서 import하지 않고, 상위 컴포넌트(KanbanBoard 또는 App)에서 단일 인스턴스로 관리하는 방식으로 리팩터링

### 관련 파일
- `src/components/Board/Column.jsx`
- `src/components/Modal/TaskCreateModal.jsx`
- `src/hooks/useSocket.js`
