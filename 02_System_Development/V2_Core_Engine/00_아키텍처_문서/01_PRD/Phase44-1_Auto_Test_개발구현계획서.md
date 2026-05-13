# 🚀 Phase 44-1: `/auto_test` 및 자율 주행 불변성 아키텍처 개발 구현 계획서

**작성일**: 2026-05-13  
**작성자**: 루카 (Luca)  
**상태**: 📝 Draft (진행 중)  
**연관 문서**: [Phase44_Auto_Test_QA_Pipeline_PRD.md](Phase44_Auto_Test_QA_Pipeline_PRD.md)

---

## 🛠️ 1. 개발 구현 태스크 리스트 (Task List)

본 개발은 데이터 영속성부터 프론트엔드 UI, 그리고 새로운 QA 파이프라인으로 이어지는 상향식(Bottom-up) 순서로 진행됩니다.

### Step 1. DB 스키마 마이그레이션 (데이터 영속성 기반)
- [ ] **`tasks` 테이블 컬럼 신설**: 
  - `last_autorun_status` (TEXT)
  - `last_autorun_step` (INTEGER)
  - `last_autorun_max_steps` (INTEGER)
  - `last_autorun_at` (DATETIME)
- [ ] **`database.js` 수정**: 
  - `getTasks`, `getTaskById` 반환값에 신규 컬럼 포함.
  - Auto Run 상태를 DB에 저장하는 전용 메서드 `updateAutoRunStatus(taskId, status, step, maxSteps)` 신설.
- [ ] **`executor.js` 연동**: 
  - Auto Run 루프 종료 시점(완료, 에러, Abort)에 `updateAutoRunStatus`를 호출하여 상태를 영구 저장하도록 연동.

### Step 2. 백엔드 Immutable Fork 로직 구현 (가장 중요)
- [ ] **재작업 분기 처리 (`server.js`)**: 
  - 클라이언트에서 `/auto_run` 또는 `/run` 요청이 왔을 때, 타겟 카드의 `last_autorun_status === 'COMPLETED'` 인지 검사.
- [ ] **아카이빙 및 Fork 로직**:
  - 조건 만족 시 원본 카드를 즉시 아카이브(`status = 'ARCHIVED'`) 처리하고 읽기 전용으로 락(Lock).
  - 원본 카드의 메타데이터(프로젝트 ID, 제목, 기획서 등)를 복사하여 **새로운 태스크 카드를 DB에 INSERT (Fork)**.
- [ ] **리다이렉트 실행**: 새로 생성된 카드의 ID로 Auto Run 파이프라인을 재가동하도록 로직 연결.

### Step 3. 프론트엔드 완료 배너 및 게이트웨이 연동
- [ ] **React 상태 의존도 제거 (`TaskDetailModal.jsx`)**: 
  - 새로고침 시 날아가는 임시 상태 대신, DB에서 넘어온 `task.last_autorun_status` 속성 기반으로 배너를 렌더링.
- [ ] **완료 배너 상시 노출**: 
  - `last_autorun_status === 'COMPLETED'` 일 경우, `✅ Auto Run 완료 — Step 15/15` 정적 배너를 상시 렌더링.
- [ ] **게이트웨이 UI 구축**: 
  - 완료 배너 우측에 **[ 🧪 /auto_test 시작 ]** 버튼 배치. (클릭 시 Step 4의 엔드포인트 트리거)

### Step 4. `/auto_test` QA 파이프라인 신규 구축
- [ ] **QA 카드 분리 생성**: 
  - `/auto_test` 버튼 클릭 시, 시스템이 QA 전용 자식 태스크 카드를 자동 생성.
- [ ] **QA 프롬프트 모듈 (`contextInjector.js`)**: 
  - 기획서 원문(PRD) 및 DEV 에이전트가 생성한 코드베이스를 조회하여 검증 시나리오를 작성하는 3단 프롬프트 신설.
- [ ] **QA 실행 모드 (`executor.js`)**: 
  - 코드 작성/수정 툴 접근을 차단하고, `read_file`, `grep_search`, `run_command`(테스트 스크립트 실행) 등 검증 권한만 부여된 QA 전용 브랜치 실행.
