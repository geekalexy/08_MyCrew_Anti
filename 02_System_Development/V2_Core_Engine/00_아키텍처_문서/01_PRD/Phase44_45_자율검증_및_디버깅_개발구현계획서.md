# 🚀 Phase 44 & 45: 자율 검증 및 디버깅 파이프라인 개발 구현 계획서

**작성일**: 2026-05-13  
**작성자**: Luca (System Architect)  
**상태**: 🟢 A 최종 승인 (Prime 리뷰 통과, 개발 대기 중)  
**연관 PRD**: [Phase44_45_자율검증_및_디버깅_파이프라인_PRD.md](Phase44_45_자율검증_및_디버깅_파이프라인_PRD.md)  
**Prime 리뷰**: [44_Phase44_45_AutoTest_Debug_Prime_Review.md](../리뷰_아카이브/44_Phase44_45_AutoTest_Debug_Prime_Review.md)

---

## 🛠️ 1. 개발 구현 태스크 리스트 (Task List & Priority)

본 개발 계획서는 "에이전트 권한 분리"와 "Graphify 기반 에러 역추적"을 구현하는 상향식(Bottom-up) 로드맵입니다.
*(참고: Phase 44-1의 이력 영속성 및 Immutable Rerun Forking 로직은 이전 세션에서 개발 완료되었습니다.)*

### 🔴 [Priority: Critical] Phase 44-2: QA 에이전트 인프라 및 권한 통제
QA 에이전트가 코드를 쓰지 못하고 오직 조회 및 실행만 하도록 통제하는 기반을 마련합니다.
- [ ] **[W-001 보정] 에이전트 ID 정규화 (`AGENT_ID_SPEC.md`, `roleRegistry.js`)**: 
  - `dev_qa_auto` (QA) 및 `dev_debug_auto` (Debug) 역할 정의. P-002 `{팀코드}_{역할코드}` 형식 준수.
  - 모델 배정: QA = `MODEL.SONNET` (`claude-sonnet-4-6`), Debug = `MODEL.ANTI_GEMINI_PRO_HIGH` (`anti-gemini-3.1-pro-high`).
- [ ] **Context Injector 수정 (`contextInjector.js`)**: 
  - `mode === 'QA'`일 때, `replace_file_content`, `multi_replace_file_content`, `write_to_file` 도구에 대한 **시스템 프롬프트 상의 Strict Policy** 주입.
- [ ] **[P1-001 보정] toolExecutor Interceptor 구현 (`toolExecutor.js`)**: 
  - 프롬프트 지시만으로는 LLM이 무시할 수 있으므로, **프로그래밍 레벨의 2중 방어** 추가.
  - QA 모드일 때 `executeTool()` 함수 진입시, 도구명이 차단 목록(`WRITE_TOOLS`)'에 해당하면 즉시 `{ action: 'REJECTED', reason: 'QA는 파일 수정 불가' }` 반환.
- [ ] **[P1-002 보정] `run_command` 화이트리스트 필터 (`toolExecutor.js`)**:
  - QA 모드에서 `run_command` 호출 시, 명령어 문자열에서 `>`, `>>`, `tee`, `mv`, `cp`, `rm`, `sed -i` 등 파일 쓰기 패턴을 Regex로 검사. 발견 시 즉시 거부.
- [ ] **[P1-003 보정] QA 핵심 도구 3종 구현 (`toolExecutor.js`)**:
  - `run_command`: `execFileSync` / `execSync`를 래핑하되, 위 화이트리스트 필터 적용.
  - `view_file`: `fs.readFileSync`로 파일 읽기 전용.
  - `grep_search`: ripgrep(`rg`) CLI 래퍼.
- [ ] **Zero-Command 라우팅 연동 (`server.js`)**:
  - `/api/tasks/:id/run` 트리거 시 `mode: 'QA'`이면 모델을 `Claude Sonnet 4.6`으로 통일하고 담당자를 `dev_qa_auto`로 자동 배정.

### 🟠 [Priority: High] Phase 44-3: `/auto_test` 실행 루프 & 리포트 생성
코드를 실행하고 Graphify를 조회해 결함을 찾아내는 2-Track QA 루프를 구현합니다.
- [ ] **Executor 분기 (`executor.js`)**: 
  - `isQAMode` 플래그를 도입하여, QA 모드일 때는 목표 달성 조건이 "코드 작성이 아닌, **에러 탐색 및 [QA 리포트] 작성 완료**"로 변경되도록 루프 종료 조건 조정.
- [ ] **Graphify 정적 스캔 쿼리 연동**:
  - `query_graph` 툴을 사용해 `Dead Code`, `Circular Dependency` 등 구조적 에러를 사전 스캔하는 프롬프트 시퀀스 추가.
- [ ] **Artifact 작성 로직**: 
  - 에러나 경고를 발견했을 때 반드시 `[QA_Report_TaskID.md]` 아티팩트 파일을 생성하고, 발견된 에러 로그(터미널 출력)를 박제.
  - 성공/실패 여부에 따라 태스크 상태를 `REVIEW`로 변경.

### 🟡 [Priority: Medium] Phase 45-1: `/auto_debug` 실행 루프 (Fix 파이프라인)
QA 리포트를 바탕으로 에러를 수정하는 디버그 에이전트를 개발합니다.
- [ ] **디버그 모드 라우팅 (`server.js`)**: 
  - QA 리포트가 있는 태스크에서 `/auto_debug`를 호출할 경우 `mode: 'DEBUG'`로 진입. 담당자 `dev_debug_auto` 자동 배정.
- [ ] **[W-003 보정] 디버그 초기 컨텍스트 주입 (`contextInjector.js`)**:
  - 태스크의 `artifact_url` 필드를 조회하여 QA 리포트 파일을 읽어들이고, 첫 시스템 프롬프트에 **[QA 에러 진단서]**로 강제 주입.
- [ ] **Graphify 기반 역추적 (Blast Radius)**:
  - 디버그 에이전트가 코드를 수정하기 **직전**에, `shortest_path` 및 `query_graph` 도구를 사용해 에러 진원지와 목표 코드 간의 연관관계를 의무적으로 조회하도록 프롬프팅.
- [ ] **[W-004 보정] P-016 정책 명시**:
  - 파괴적 수정(파일 삭제, DB Drop 등) 수행 시 `dangerously` 접두사 함수만 사용하도록 프롬프트에 강제 주입.
- [ ] **[W-002 대응] Executor 구조 분리 (`executor.js` → `loops/`)**:
  - `ai-engine/loops/` 디렉토리 신설 검토: `autoRunLoop.js`, `qaLoop.js`, `debugLoop.js`로 원파일의 루프 로직을 분리하여 God Node(#8) 비대화 억제.
- [ ] **Executor 루프 수정**:
  - 코드 패치 후 백그라운드 터미널(run_command)로 검증(Build/Test)을 재실행하여 에러가 사라졌는지 Self-Check 한 뒤 `DONE` 처리.

### 🟢 [Priority: Low] Phase 45-2: E2E 통합 테스트 및 UI 폴리싱
- [ ] **게이트웨이 UI 연동 (`TaskDetailModal.jsx`)**: 
  - QA 모달 내에서 `[ 🐛 /auto_debug 시작 ]` 버튼 구축 (QA 완료 배너 상태와 연동).
- [ ] **End-to-End 시뮬레이션**: 
  - 고의적인 순환 참조나 런타임 에러 코드를 삽입 후, `/auto_test` -> `QA 리포트` -> `/auto_debug` -> `패치 및 해결`의 전 과정이 사람의 개입 없이 자율적으로 흐르는지 입증.

---

## 2. 작업 브랜치 및 안전 장치 (Safety Constraints)
- **STRICT 정책 (P-020)**: 권한 없는 무단 코딩은 즉시 실패 처리. QA 에이전트가 파일 수정 툴을 사용하려 시도하면 강제로 에러를 반환하는 `Executor` 레벨의 Interceptor 로직이 필요함.
- **아티팩트 의존성**: 디버깅 에이전트는 환각으로 에러 원인을 추측해선 안 되며, 오직 주입된 [QA 리포트]와 Graphify 최단 경로 데이터에만 의존하여 수정 계획(Plan)을 세워야 함.
