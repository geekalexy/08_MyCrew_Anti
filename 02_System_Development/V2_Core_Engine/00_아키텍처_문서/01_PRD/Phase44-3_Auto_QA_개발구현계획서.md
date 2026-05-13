# Phase 44-3: 자율 QA 파이프라인 (G-Stack 통합) 개발 구현 계획서

**작성일**: 2026-05-14  
**목표**: 재정립된 Phase 44-2 PRD(자율 QA 파이프라인 및 G-Stack 아키텍처 통합)를 바탕으로, 실제 코드를 단계별로 구현하기 위한 상세 로드맵.

---

## 📅 스프린트 목표 요약
1. `bun` 기반의 AOM(접근성 트리) 브라우저 데몬 PoC 구축.
2. `server.js`와 `executor.js`의 `/auto_QA` 전용 라우팅 및 Immutable 포킹 로직 작성.
3. `toolExecutor.js` 내 Zero-MCP 파이프라인(STDIO 기반 통신) 구현.
4. UI/UX (`TaskDetailModal.jsx`) 연동 및 최종 테스트.

---

## ⚙️ 상세 개발 단계 (Implementation Steps)

### Step 1. 프론트엔드 및 태스크 워크플로우 셋업 (UI/DB)
- **1-1. DB Schema 및 서버 라우팅 업데이트**
  - [ ] `database.js`: `tasks` 테이블에 `last_autorun_status` 컨럼 추가. ENUM은 전체 파이프라인 단계를 포함하도록 확장 (`DEV_DONE`, `QA_RUNNING`, `QA_DONE`, `QA_FAILED`, `DBG_RUNNING`, `DBG_DONE`, `PIPELINE_DONE`, `FAILED`).
  - [ ] `database.js`: 불변성 보장을 위한 `task_snapshots` 테이블 신설. 컨럼: `task_id`, `snapshot_at`(timestamp), `content`, `linked_files`(JSON).
  - [ ] `server.js`: `/api/tasks/:id/auto_QA` 엔드포인트 신설 — `last_autorun_status = 'QA_RUNNING'` 전환 및 QA 루프 트리거.
  - [ ] **[GAP-002]** 서버 시작 시 `last_autorun_status`가 `*_RUNNING` 상태인 카드를 `'FAILED'`로 자동 복구하는 스타트업 훅 구현.
  - [ ] `status` vs `last_autorun_status` 충돌 시 배너 우선순위 정책 코드화: `FAILED` > `*_RUNNING` > `PIPELINE_DONE`.
- **1-2. DEV 완료 스냅샷 로직** (주: Immutable Fork 콴셈 포크는 **폐기**)
  - [ ] DEV 에이전트 완료 시 `last_autorun_status = 'DEV_DONE'` 전환 + **카드는 보드에 그대로 유지.**
  - [ ] 불변성은 `task_snapshots` 테이블에 DEV 완료 시점 스냅샷을 INSERT하여 보장. 새 카드 생성 없음.
  - [ ] `/api/tasks/:id/archive` 엔드포인트 신설: **사용자 수동** 호출 시에만 `status = 'ARCHIVED'` 전환.
- **1-3. 프론트엔드 배너 연동 (`TaskDetailModal.jsx`)**
  - [ ] `last_autorun_status`를 기준으로 아래 테이블에 따라 배너 + 버튼을 렌더링.

  | `last_autorun_status` | 배너 | 활성 버튼 |
  |---|---|---|
  | `DEV_DONE` | `✅ 개발 완료` | `[ 🧪 /auto_QA 시작 ]` |
  | `QA_RUNNING` | `⏳ QA 진행 중...` | 모든 버튼 비활성화 |
  | `QA_DONE` | `✅ QA 통과` | `[ 🗃️ 아카이브 ]` (수동) |
  | `QA_FAILED` | `❌ QA 실패` | `[ 📄 리포트 ]` `[ 🔧 /auto_debug ]` `[ 🔄 재시도 ]` |
  | `DBG_RUNNING` | `⏳ 디버깅 진행 중...` | 모든 버튼 비활성화 |
  | `DBG_DONE` | `✅ 디버깅 완료` | `[ 🧪 QA 재시도 ]` `[ 🗃️ 아카이브 ]` |
  | `PIPELINE_DONE` | `🎉 전 파이프라인 완료` | `[ 🗃️ 아카이브 ]` (수동) |
  | `FAILED` | `🚨 비정상 종료` | `[ 📄 리포트 ]` `[ 🔄 재시도 ]` |

  - `[ 🗃️ 아카이브 ]` 버튼: 사용자가 직접 클릭해야만 `/api/tasks/:id/archive` 호출. 시스템 자동 아카이브 없음.

### Step 2. G-Stack 기반 데몬 브라우저(Bun) PoC 개발
- **2-1. 독립 패키지 구조 셋업**
  - [ ] `ai-engine/tools/mycrew-browser/` 디렉토리 신설.
  - [ ] `bun init`을 통해 독자적인 런타임 환경 구성.
  - [ ] `playwright` 패키지 설치.
- **2-2. AOM 파싱 엔진 작성 (Dual-Track 검증)**
  - [ ] `daemon.ts` 작성: Playwright를 띄우고 `page.accessibility.snapshot()` API를 호출.
  - [ ] AOM 추출 결과를 순회하며 Playwright의 `locator.isVisible()` 및 `boundingBox()` 값을 교차 검증. (화면에 안 보이거나 가려진 요소 필터링)
  - [ ] 검증을 통과한 요소에만 순차적 ID(`@E1`, `@E2`) 부여.
- **2-3. NDJSON 기반 리스너(Listener) 구현**
  - [ ] 스트림 파편화 방지를 위해 STDIN으로 들어오는 데이터를 줄바꿈(`\n`) 기준으로 분리(NDJSON)하여 파싱.
  - [ ] 명령어(`BROWSE <url>`, `CLICK @E1`) 처리 후, 결과 트리 역시 NDJSON 포맷으로 STDOUT 반환.
  - [ ] STDIN Payload 파싱 시, 환경 변수(`process.env.DAEMON_UUID`)와 요청의 UUID 토큰 일치 여부 검증 로직 추가.

### Step 3. Zero-MCP 통신 파이프라인 통합
- **3-1. 데몬 라이프사이클 관리 (`toolExecutor.js`)**
  - [ ] `executeTool` 내부에서 QA 모드일 경우 Bun 데몬 프로세스 존재 여부 체크 (`.agents/browser_daemon.json` 참조).
  - [ ] 콜드 스타트 시 `pid`를 검사하여 잔존하는 좀비 프로세스가 있다면 `kill`로 일괄 정리(Cleanup).
  - [ ] 데몬이 없으면 랜덤 UUID를 생성하고, `env: { DAEMON_UUID: uuid }`를 주입하여 `child_process.spawn('bun', ...)` 부팅.
  - [ ] **[GAP-003]** 데몬 재시작 중 명령 충돌 방지: 연결 재시도 최대 3회, 각 500ms 간격. 3회 후에도 실패 시 해당 QA 루프를 `FAILED`로 강제 전환.
- **3-2. `contextInjector.js` QA 모드 프롬프트 수정**
  - [ ] 기존의 장황한 MCP 기반 도구 설명을 지우고, AOM 기반 텍스트 명령(Zero-MCP)의 사용법만 간결하게 주입.
  - [ ] "코드 조작 권한 없음", "AOM 트리 반환값에서 `@E` 레퍼런스를 참조하여 액션할 것" 등 엄격한 정책(Strict Policy) 명시.

### Step 4. Graphify 핀포인트 QA와의 시너지 연동
- **4-1. 정적 검사 + 동적 테스트의 루프화**
  - [ ] QA 에이전트(`dev_qa_auto`)는 UI를 탐색하다가 발생한 콘솔 에러나 런타임 에러를 확인하면, 기존 구축된 `query_graph` 도구를 사용해 해당 에러가 발생한 컴포넌트의 AST 노드(파급 반경)를 역추적하도록 유도.
  - [ ] 에이전트가 테스트 종료 시 `finish_task`를 호출하며 Markdown 형식의 최종 **"QA 리포트(Artifact)"**를 작성하여 `artifacts/` 폴더에 떨구도록 지시.

### Step 5. Auto Debug 파이프라인 연동 (`/auto_debug`)
- **5-1. 디버그 루프 진입 로직**
  - [ ] `server.js`에 `/api/tasks/:id/auto_debug` 엔드포인트 신설. (모델: `ANTI_GEMINI_PRO_HIGH`)
  - [ ] `contextInjector.js`에서 `artifact_url`을 읽어 `[QA 에러 진단서]`로 초기 프롬프트 주입.
  - [ ] **[GAP-006 & NEW-001]** Path Traversal 검증 후, 파일 읽기 시 `replace(/\[SYSTEM\]|\[INST\]/gi, '[BLOCKED]')`를 적용하여 악성 프롬프트 샌니타이즈(Sanitize) 및 8000자 길이 제한 수행.
- **5-2. 보안 인터셉터 (P1-001, NEW-002) 구현**
  - [ ] `toolExecutor.js`에 QA 모드 식별 로직 추가: QA 모드 시 `write_file` 등 모든 파일 쓰기 도구 강제 거부(Reject).
  - [ ] **[GAP-004 & NEW-002]** 확정 Allowlist 배열 정의: `['node --check', 'npx playwright test', 'bun run', 'graphify query', 'grep']`. 이외 명령어 즉시 Reject.
- **5-3. 루프 디커플링 및 인터페이스 (GAP-007, NEW-003)**
  - [ ] `ai-engine/loops/` 디렉토리 및 `qaLoop.js`, `debugLoop.js` 신설.
  - [ ] **[NEW-003]** `qaLoop.js` Export 계약: `export async function runQALoop(task, signal)` 형태로 작성. `activeAutoRuns`의 `AbortController.signal`을 넘겨 취소 이벤트 연동. 반환값은 순수 JSON 객체(`{ status: 'COMPLETED', artifact_url: '...' }`).
- **5-4. 데몬 Keychain 추상화 (GAP-008)**
  - [ ] `SecretProvider` 인터페이스 작성: macOS Keychain 및 Linux/Docker ENV 폴백 모두 지원.

---

## 🛡️ 품질 확보 및 보안 방어선 (Review Points)
1. **Crash & Fresh Restart 보장**: Bun 데몬이 어떠한 이유로든 예외를 던지면 무조건 프로세스를 강제 종료하고, `toolExecutor.js`에서 이를 감지해 다음 통신 시 새로 띄우는지 필히 테스트.
2. **권한 탈취(Escalation) 방지**: QA 에이전트가 Bun 데몬 통신망을 악용하여 OS의 다른 쉘 명령(`exec`)을 호출할 수 없도록, 도구 파라미터는 배열(Array) 형태의 엄격한 Whitelist를 거치게 설계.
