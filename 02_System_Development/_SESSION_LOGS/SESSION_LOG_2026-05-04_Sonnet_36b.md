# SESSION LOG — 2026-05-04 (Sonnet) — Phase 36b 카드링크 구현 세션 #2

## 세션 메타
- **일시**: 2026-05-04 (속행 세션)
- **에이전트**: Sonnet (Claude Sonnet 4.6)
- **Phase**: 36b — Card Link System 구현
- **PRD 참조**: `02_System_Development/00_아키텍처_문서/01_PRD/Phase36b_CardLink_기획서.md` (v3.0)

---

## 완료 작업

### ✅ Step 1 — database.js 마이그레이션
- `TaskComment.comment_idx` 컬럼 추가 (PRAGMA 기반 조건부 마이그레이션)
- 소급 적용 SQL: 기존 코멘트 카드별 생성 순서대로 순번 부여
- `task_attachments` 신규 테이블 생성 (task_id, file_idx, file_label, file_path, file_type, file_size)
- `idx_attachments_task` 인덱스 생성 (조회 성능)
- DB 메서드 6개 추가:
  - `getTaskByProjectNum(projectId, taskNum)` — 동일 프로젝트 내 카드번호 조회
  - `getTaskByProjectNumAcrossScopes(requestingProjectId, taskNum, isolationType)` — B/C 타입 격리 범위 내 타 프로젝트 탐색
  - `getTaskCommentByIndex(taskId, commentIdx)` — #카드C순번 조회
  - `getTaskAttachmentByIndex(taskId, fileIdx)` — #카드F순번 조회
  - `createTaskAttachment(...)` — 파일 등록 (file_idx 자동 부여)
  - `getTaskAttachments(taskId)` — 전체 첨부파일 목록
  - `deleteTaskAttachment(attachmentId)` — 첨부파일 삭제

### ✅ Step 2 — server.js API 엔드포인트
- `GET /api/tasks/:id/attachments` — 첨부파일 목록
- `POST /api/tasks/:id/attachments` — 첨부파일 등록
- `DELETE /api/tasks/:id/attachments/:attachmentId` — 첨부파일 삭제
- `GET /api/tasks/:id/comments/:idx` — 특정 순번 코멘트 조회 + 태그 포맷 반환

### ✅ Step 3 — buildLinkedContext() 엔진 로직
- `CARD_TAG_REGEX = /#(\d+)(C|F)(\d+)/g` — Q1 가변 자릿수 지원
- C타입: TaskComment DB 조회 → 작성자·시간·본문(최대 3000자) 컨텍스트 블록 삽입
- F타입: task_attachments DB 조회 → 이미지면 Vision 분석(Q2), 텍스트면 직접 읽기
- Q3: `isolation_scope` 파싱 → `strict_isolation`(A타입)은 동일 프로젝트만, B/C는 범위 탐색
- `forceRedispatchTask` 내 `enrichedContent` 앞에 자동 prepend
- 타임라인 로그에 `[카드링크 주입됨]` 표시

### ✅ Step 5 — TagRenderer.jsx 유틸 생성
- 파일: `src/utils/TagRenderer.jsx`
- `renderTaggedText(text, onTagClick)` — 태그를 언더라인+파란색(#3b82f6) span으로 변환 (Q4)
- `extractCardTags(text)` — 태그 파싱만 (API 없이 구조 추출용)
- RegExp 인스턴스 분리로 `lastIndex` 오염 방지

### ✅ Step 4/5 — TaskDetailModal.jsx TagRenderer 적용
- `renderTaggedText` import 추가
- 코멘트 렌더링 `ReactMarkdown` components prop에 `p` 오버라이드 추가
- 모든 코멘트 텍스트 내 `#NrC`, `#NF순` 태그가 언더라인+블루로 표시됨

---

## 미완료 / 다음 작업

### 🔲 Step 4 나머지 — 복사 아이콘 (📋) UI
- 코멘트 우상단에 `[📋 복사]` 아이콘 → 클릭 시 `#NrC` 태그 클립보드 복사
- 첨부파일 영역에도 동일한 `[📋 복사]` 아이콘
- `TaskDetailModal.jsx` 내 코멘트 렌더링 루프에 추가

### 🔲 Step 6 — TaskCard 태그 배지 (선택적)
- 카드 제목/설명에 태그 포함 시 뱃지 형태로 노출
- 우선순위 낮음 — 카드에 content가 표시되지 않아 현재 효과 없음

### 🔲 서버 재시작
- database.js 마이그레이션 자동 실행 확인 필요
- `npm run dev` 후 DB에 `task_attachments` 테이블 및 `comment_idx` 컬럼 존재 확인

---

## 아키텍처 결정 사항
- **Vision 분석 실패 시**: `imageAnalysisService.js` 없으면 graceful fallback (파일명만 표시)
- **격리 A타입**: `isolation_scope = {"type":"strict_isolation"}` 으로 판별
- **태그 클릭 핸들러**: 현재 Phase에서는 `null` (다음 Phase에서 카드 모달 연동 예정)
- **삭제 API**: `file_idx` 재순번 미지원 (기존 idx 유지, 빈 공간 발생 허용)
