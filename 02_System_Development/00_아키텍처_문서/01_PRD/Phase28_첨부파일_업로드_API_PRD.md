# Phase 28: MyCrew 첨부파일 업로드 API 및 UI 확장 PRD

## 1. 개요 (Background & Objective)
현재 아리(Ari)의 비전(`analyzeLocalImage`) 스킬 및 파일 탐색 도구는 로컬 디스크의 물리적 경로 기반으로 동작합니다. 유저가 채팅, 타임라인, 태스크 모달 등에서 이미지를 첨부할 때 이를 데이터베이스에 직접 주입(Base64 등)하지 않고 물리적 파일로 안전하게 관리하기 위해 **전용 파일 업로드 API**가 필요합니다. 

본 기획은 업로드된 파일을 아키텍처 규칙에 따라 **`07_OUTPUT/inputs`** 경로에 안전하게 저장하고, 아리가 이를 자유롭게 분석할 수 있도록 프론트엔드 UI/UX 흐름을 확장하는 데 목적이 있습니다.

---

## 2. 주요 기능 요구사항 (Core Features)

### 2.1 Backend: Task 기반 대칭형(Symmetric) 멀티파트 업로드 API
- **엔드포인트**: 
  - `POST /api/input/:taskId` (유저가 첨부하는 인풋용 소스)
  - `POST /api/output/:taskId` (에이전트가 생성하는 아웃풋 결과물)
- **구현 방식**: `multer` 라이브러리를 활용한 `multipart/form-data` 처리
- **저장 위치**: 
  - 인풋: `/08_MyCrew_Anti/07_OUTPUT/inputs/{taskId}/`
  - 아웃풋: `/08_MyCrew_Anti/07_OUTPUT/outputs/{taskId}/`
- **보안 및 정책**:
  - 최대 파일 크기: 10MB (필요 시 확장)
  - 허용 확장자: `.png, .jpg, .jpeg, .pdf, .txt, .csv, .md` 등 에이전트 분석 가능 포맷
  - 중복 파일명 방지: 저장 시 `Date.now()_originalName` 형태의 고유 해시명 부여

### 2.2 Frontend: 기존 UI 연동 (Chat & Timeline)
- **현황**: 이미 구현된 첨부 아이콘 및 기능 UI 존재.
- **연동 로직**:
  1. 유저가 특정 태스크에서 파일 선택 시 `POST /api/input/:taskId` 호출. (채팅창의 경우 taskId가 없으면 `global` 또는 임시 ID 할당)
  2. 서버로부터 저장된 파일 경로(`07_OUTPUT/inputs/{taskId}/파일명.png`) 응답 수신.
  3. 채팅창 또는 타임라인 입력창(textarea) 커서 위치에 경로 자동 삽입.
     - 예: `[이미지 첨부: 07_OUTPUT/inputs/{taskId}/171452301_test.png]`
  4. 유저가 추가 텍스트 입력 후 전송(Enter)하면 그대로 백엔드에 텍스트로 전달됨.
  5. 아리(Ari)는 텍스트 내의 해당 경로를 인식하고 `analyzeLocalImage` 도구를 자율적으로 호출.

### 2.3 Frontend: 신규 UI 확장 (Task Modal)
- **현황**: 모달(Modal) 내의 첨부 UI가 부재함.
- **요구사항 1: 카드 만들기(Create Task) 뷰**
  - 제목/내용 입력란 하단(혹은 에디터 툴바)에 [첨부 아이콘] 추가.
  - 기능은 채팅부와 동일하게 동작 (업로드 후 내용 본문에 경로 삽입).
- **요구사항 2: 모달 상세 내 댓글 입력(Add Comment) 뷰**
  - 타임라인과 동일한 UI 규격의 [첨부 아이콘] 추가.
  - 업로드 완료 시 댓글 입력창에 파일 경로 삽입.

---

## 3. API 명세 (API Specifications)

### `POST /api/input/:taskId` 및 `POST /api/output/:taskId`
- **Request Header**: `Content-Type: multipart/form-data`
- **Request Body**:
  - `file`: (Binary File)
- **Response (Success)**:
  ```json
  {
    "success": true,
    "taskId": "task_12345",
    "fileName": "171452301_design_draft.png",
    "filePath": "07_OUTPUT/inputs/task_12345/171452301_design_draft.png"
  }
  ```
- **Response (Error)**:
  ```json
  {
    "success": false,
    "message": "허용되지 않는 확장자입니다."
  }
  ```

---

## 4. 데이터 플로우 (Data Flow)

1. **Upload Trigger**: 유저가 UI(채팅/타임라인/모달)에서 이미지 선택.
2. **Store to Disk**: 클라이언트가 서버로 전송 → `server.js`의 multer가 API에 따라 `07_OUTPUT/inputs/{taskId}/` 또는 `outputs/{taskId}/` 폴더를 자동 생성하고 물리 파일로 저장.
3. **Text Injection**: 서버가 반환한 `filePath`를 클라이언트가 입력창 텍스트에 조합 (`"이 로고 어때? [첨부: 07_OUTPUT/inputs/logo.png]"`)
4. **Message Send**: 텍스트 형태의 메시지 혹은 댓글로 DB에 저장됨. (무거운 바이너리 DB 적재 없음)
5. **Agent Execution**: 아리가 해당 메시지를 수신. 프롬프트 상의 경로(`07_OUTPUT/...`)를 발견하면 물리적 보안 차단벽 통과. Vision 모델 활용을 위해 `analyzeLocalImage` Tool 자율 호출 및 시각 분석 완료.

---

## 5. 개발 스프린트 태스크 리스트 (Sprint Tasks)

- [ ] **[Backend]** `server.js` 내에 `multer` 패키지 설치 및 초기화.
- [ ] **[Backend]** `07_OUTPUT/inputs/` 및 `07_OUTPUT/outputs/` 기본 폴더 생성기 추가.
- [ ] **[Backend]** `POST /api/input/:taskId` 및 `/api/output/:taskId` 라우트 구현 (폴더가 없으면 자동 생성).
- [ ] **[Frontend]** `RightPanel.jsx` (채팅/타임라인)의 기존 첨부 아이콘에 API 업로드 로직(fetch) 연결 및 textarea 텍스트 주입 기능 개발.
- [ ] **[Frontend]** `TaskCreateModal.jsx` 내용 입력란 부근에 첨부 아이콘 신규 배치 및 업로드 로직 이식.
- [ ] **[Frontend]** `TaskDetailModal.jsx` 하단 댓글 입력란에 첨부 아이콘 신규 배치 및 업로드 로직 이식.
- [ ] **[QA]** 실제 이미지 첨부 후 아리가 정상적으로 `analyzeLocalImage`를 호출해 결과물을 대답하는지 End-to-End 테스트 진행.
