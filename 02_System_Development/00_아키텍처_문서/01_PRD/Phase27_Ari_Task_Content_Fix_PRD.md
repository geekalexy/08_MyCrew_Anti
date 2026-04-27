# [Phase 27] 아리 칸반 태스크 내용 미입력 및 중복 노출 해결 (디버깅 기획서)

**작성일**: 2026-04-28
**작성자**: Luca (Gemini 3.1 Pro - System Architect)
**목표**: 아리가 태스크 생성 시 내용을 제대로 입력하지 못하고 제목이 두 번 노출되는 문제(시스템 및 DB 결함)를 해결하고, 에이전트가 "묻고 답하며" 맥락을 파악하도록 스킬 프롬프트를 전면 개편한다.

---

## 1. 문제 정의 및 근본 원인 (Root Causes)

### 1-1. 시스템 아키텍처 결함 (System & DB)
1. **DB 스키마 결함**: `Task` 테이블에 `title` 컬럼이 없어, 서버가 강제로 `# 제목 \n\n 본문` 형태로 `content` 필드에 병합 저장함.
2. **API & 프론트엔드 파싱 결함**: 프론트엔드는 통짜 `content`를 받아 `split('\n')[0]`으로 잘라서 제목으로 표시함. 이로 인해 편집 모드에서 제목과 본문이 중복 나열됨.
3. **소켓 통신 방어코드 오작동**: 프론트엔드 `useSocket.js`에서 빈 값이 올 경우 `content: content || title` 처럼 강제로 제목을 복제해버리는 악성 폴백 로직 존재.

### 1-2. 프롬프트 및 에이전트 인지 결함 (LLM)
* `createKanbanTask` 도구 설명서가 "무조건 상세하고 풍부하게 당장 작성해라"라고 강요(Hardcoding)하고 있음.
* 아리는 릴스 제작 등 정보가 턱없이 부족한 지시를 받아도 억지로 만들어내야 하므로, 환각(Hallucination) 방지 본능에 의해 '제목'을 본문에 그대로 반복하는 방어 기제를 보임.

---

## 2. 해결 방안 및 구현 계획 (Implementation Plan)

### Step 1: 데이터베이스 스키마 마이그레이션 (DB)
* `database.js` 수정
  * `PRAGMA table_info`를 활용해 `Task` 테이블에 `title TEXT DEFAULT ''` 컬럼 신규 추가.
  * `createTask`, `updateTaskDetails`, `getAllTasksLight`, `getTaskByIdFull` 등의 SQL 쿼리에 `title` 필드 분리 적용.

### Step 2: 백엔드 병합 로직 제거 및 통신 규격 분리 (Server & Daemon)
* `ariDaemon.js`
  * `createKanbanTask` 도구 실행 시 `# ${title}\n\n${content}` 병합 로직 완전 삭제.
  * DB에 `title`과 `content`를 각각 별도 파라미터로 저장하도록 수정.
* `server.js`
  * `POST /api/tasks/notify-created` 등 소켓/API 페이로드에서 `title`과 `content` 독립 전송 보장.

### Step 3: 프론트엔드 데이터 바인딩 및 악성 폴백 제거 (UI)
* `src/hooks/useSocket.js`
  * `content: content || title` 악성 폴백 제거. 값이 없으면 빈 문자열(`""`)로 렌더링하도록 처리.
* `src/components/Modal/TaskDetailModal.jsx` & `TaskCreateModal.jsx`
  * `content.split('\n')[0]` 형태의 하드코딩 파싱 제거.
  * DB에서 넘어온 `title`과 `content`를 독립적인 Input/Textarea에 1:1 바인딩.

### Step 4: 대화형 맥락 수집 스킬 룰(Prompt) 주입 (LLM)
* `ariDaemon.js` 내부 `createKanbanTask` description 전면 수정.
* **수정 방향**: "지시 내용의 맥락(목적, 타겟 등)이 부족하다면 절대 이 도구를 바로 호출하지 말고, 대표님께 역으로 질문하여 부연 설명을 받아라. 충분한 대화 후 알맹이가 채워졌을 때만 지시서를 작성하라."

---

## 3. 기대 효과
1. **데이터 무결성 확보**: 제목과 본문이 완벽하게 분리되어 편집 버그 및 UI 중복 노출 100% 차단.
2. **에이전트 지능화**: 명령 수행 자판기에서 벗어나, 대표님의 의도를 파악하고 질문하는 '진짜 비서'의 컨텍스트 수집 루프 완성.
