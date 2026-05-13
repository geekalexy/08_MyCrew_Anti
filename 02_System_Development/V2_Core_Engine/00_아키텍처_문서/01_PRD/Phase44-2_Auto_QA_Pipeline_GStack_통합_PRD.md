# Phase 44-2: 자율 QA 파이프라인 및 G-Stack 아키텍처 통합 PRD

**작성일**: 2026-05-14  
**목표**: 기존 Phase 44-1에서 기획된 **Auto Test (자율 검증) 루프**에 G-Stack의 핵심 설계 철학(Bun 기반 데몬, AOM 브라우징)과 **Graphify 지식 그래프(AST) 기반의 정적 분석**을 결합하여, 동적 UI 검증과 정적 코드 분석을 아우르는 궁극적인 2-Track 검증 파이프라인을 구축한다.

---

## 1. 개요 및 설계 철학

본 기획서는 MyCrew 팀에게 제공되는 자율 QA 및 디버깅 스킬을 획기적으로 고도화하기 위한 통합 아키텍처 문서입니다. 
단순히 서버에서 코드를 실행해보는 수준을 넘어, **실제 브라우저 환경에서 유저와 똑같이 상호작용하며 UI를 테스트(G-Stack)**하는 동시에, **에러의 근본 원인과 의존성 파급 반경을 지식 그래프(Graphify)로 역추적**하는 하이브리드(동적+정적) 검증 무기를 에이전트에게 쥐여주는 것을 목표로 합니다.

### 💡 핵심 통합 포인트
- **Graphify 핀포인트 정적 분석 (Static QA)**: 동적 테스트 전후로 AST 기반 지식 그래프를 활용해 순환 참조, 데드 코드 탐지 및 파급 반경(Blast Radius)을 철저히 검증하여 아키텍처 결함 사전 차단.
- **G-Stack 동적 테스트 (Dynamic QA)**: React/Shadow DOM 장벽을 무시하고 인간처럼 화면을 인식하는 AOM 브라우저 엔진 및 Zero-MCP 데몬 아키텍처.
- **불변성 기반 워크플로우 제어**: 상태 전이 락(Lock)과 Immutable 태스크 포크를 통한 명확한 DEV-QA-DEBUG 책임 분리.

### 🗑️ 기존 기획 대비 폐기/대체 항목 (오버헤드 방지)
시스템 비대화와 오버헤드를 막기 위해 기존의 일부 불필요한 기획은 과감히 폐기하고 G-Stack 엔진으로 대체합니다.
1. **순수 CLI(`run_command`) 기반 프론트엔드 검증 [폐기]**
   - **이유**: `curl` 등을 이용한 억지 웹페이지 렌더링 검증은 잦은 에러 유발.
   - **대체**: Bun 데몬 기반의 AOM 브라우징 툴이 인간의 눈처럼 UI를 직접 확인하도록 대체.
2. **브라우저 제어용 무거운 MCP 도구 스키마 [폐기]**
   - **이유**: 클릭/스크롤 1회마다 수천 토큰의 스키마 설명서가 LLM에 전송되는 치명적 토큰 오버헤드 발생.
   - **대체**: 브라우저 도구는 MCP에서 완전히 제외하고 Zero-MCP(Plain Text STDIO) 통신 파이프라인으로 구축.
3. **QA 상태의 마이크로 단위 DB 브로드캐스팅 [폐기]**
   - **이유**: 브라우저 액션 단위마다 DB를 쓰고 프론트엔드 소켓을 쏘면 서버 뻗음.
   - **대체**: 진행 과정은 링 버퍼 로그에만 남기고, 최종 완료 시 한 번의 "QA 리포트"만 생성하여 통신 오버헤드 최소화.
4. **God Object (`executor.js`) 비대화 방지 [폐기]**
   - **이유**: 브라우저 크래시나 에러까지 메인 루프가 감당하면 전체 시스템 불안정.
   - **대체**: 격리된 Bun 데몬이 크래시 책임을 지고 메인 루프(executor.js)는 순수하게 결과만 받도록 디커플링.

---

## 2. 통합 구현 로드맵 (Step 1 ~ Step 5)

### Step 1. DB 스키마 업데이트 및 상태 관리
- **목표**: 에이전트의 연속 실행 상태를 추적하기 위해 DB 스키마 보강.
- **구현 내용**:
  - `tasks` 테이블에 `last_autorun_status` 컬럼 추가. ENUM 값은 전체 파이프라인 단계를 포괄하도록 확장:
    - `'DEV_RUNNING'` → `'DEV_DONE'` → `'QA_RUNNING'` → `'QA_DONE'` → `'QA_FAILED'` → `'DBG_RUNNING'` → `'DBG_DONE'` → `'PIPELINE_DONE'` → `'FAILED'`
  - `status`(칸반 상태)와의 충돌 방지 우선순위: `FAILED` > `*_RUNNING` > `PIPELINE_DONE` > 나머지 순으로 배너 최우선 표시.
  - **[GAP-002 보정] 좀비 복구**: 서버 재시작 시 `last_autorun_status`가 `*_RUNNING` 상태인 카드를 자동으로 `'FAILED'`로 전환하여 좀비 카드 방지.
  - **DEV 완료 스냅샷**: `DEV_DONE` 전환 시 해당 시점의 태스크 메타데이터(내용, 연결 파일 목록)를 `task_snapshots` 테이블에 저장하여 불변성 보장. 카드 자체는 삭제하거나 숨기지 않음.

### Step 2. 단일 카드 파이프라인 상태 진화 (Single Card Pipeline Evolution)
- **목표**: 카드 하나가 DEV → QA → Debug 전체 파이프라인을 관통하며, 사용자 의사 없이 보드에서 자동 소멸하지 않도록 보장.
- **설계 원칙**:
  > **카드는 하나다.** Immutable Fork(카드 분기 생성)는 **폐기**한다.
  > 시스템 내부 개념(불변성)을 사용자의 칸반 보드 공간에 노출하는 것은 UX 실수다.
- **구현 내용**:
  - DEV 에이전트가 완료되면 `last_autorun_status = 'DEV_DONE'`으로 전환. **카드는 보드에 그대로 유지.**
  - 불변성(P-004)은 새 카드 생성이 아닌, `task_snapshots` 테이블에 DEV 완료 시점 스냅샷을 INSERT하여 보장.
  - QA → Debug → 완료까지 동일한 카드가 `last_autorun_status` 값만 바꿔가며 파이프라인을 진행.
  - **아카이브는 오직 사용자 수동**으로만 실행. `PIPELINE_DONE` 상태에서 `[ 🗃️ 아카이브 ]` 버튼이 활성화되며, 버튼 클릭 시에만 `status = 'ARCHIVED'`로 전환.

### Step 3. 프론트엔드 게이트웨이 및 배너 연동
- **목표**: 단일 카드에서 파이프라인 전 단계를 사용자가 직관적으로 인지하고 제어할 수 있게 함.
- **구현 내용** (`TaskDetailModal.jsx`):

  | `last_autorun_status` | 배너 | 활성 버튼 |
  |---|---|---|
  | `DEV_DONE` | `✅ 개발 완료` | `[ 🧪 /auto_QA 시작 ]` |
  | `QA_RUNNING` | `⏳ QA 진행 중...` | 모든 버튼 비활성화 (중복 실행 방지) |
  | `QA_DONE` | `✅ QA 통과` | `[ 🗃️ 아카이브 ]` (사용자 수동) |
  | `QA_FAILED` | `❌ QA 실패` | `[ 📄 리포트 보기 ]` `[ 🔧 /auto_debug 시작 ]` `[ 🔄 재시도 ]` |
  | `DBG_RUNNING` | `⏳ 디버깅 진행 중...` | 모든 버튼 비활성화 |
  | `DBG_DONE` | `✅ 디버깅 완료` | `[ 🧪 QA 재시도 ]` `[ 🗃️ 아카이브 ]` |
  | `PIPELINE_DONE` | `🎉 전 파이프라인 완료` | `[ 🗃️ 아카이브 ]` (사용자 수동) |
  | `FAILED` | `🚨 비정상 종료` | `[ 📄 리포트 보기 ]` `[ 🔄 재시도 ]` |

  - `[ 🗃️ 아카이브 ]` 버튼은 **사용자가 직접 클릭해야만** `status = 'ARCHIVED'`로 전환. 시스템이 자동으로 아카이브하지 않음.

### Step 4. G-Stack 기반 QA 브라우징 파이프라인 신설
- **목표**: G-Stack의 핵심 아키텍처를 차용하여 빠르고 강력한 QA 전용 브라우저 테스트 환경 구축.
- **구현 내용**:
  1. **Bun 기반 에페머럴 데몬 (`mycrew-browser.ts`)**
     - Node.js 메인 서버와 분리된 단일 컴파일 바이너리(Bun) 데몬을 백그라운드에 생성.
     - 30분 유휴 시 자동 폭파(Auto-Kill) 및 크래시 발생 시 즉시 강제 종료 후 재시작(Crash & Fresh Restart) 전략 적용.
     - **[GAP-003 보정] 타임아웃 정책**: 데몬 재시작 중 명령 충돌 방지를 위해 연결 재시도는 최대 3회, 각 500ms 간격으로 제한. 3회 후에도 연결 실패 시 해당 QA 루프를 `FAILED`로 강제 전환.
     - **[GAP-008 보정] Keychain 추상화**: macOS Keychain 의존성을 `SecretProvider` 인터페이스로 추상화하여 Linux/Docker 환경에서는 환경 변수(ENV) 폴백(Fallback)으로 대체 가능하도록 설계.
     - PID 파일 + SIGTERM 훅 + 콜드 스타트 좀비 클린업 포함.
  2. **접근성 트리(AOM) 파싱 및 Zero-MCP 통신**
     - Playwright의 `page.accessibility.snapshot()`을 활용하여 CSP, React 하이드레이션, Shadow DOM 장벽 무력화.
     - **[GAP-005 보정] Shadow DOM 처리**: `page.accessibility.snapshot({ interestingOnly: false })`로 전체 트리 수집 시 노드 수가 폭발할 수 있으므로, 먼저 `interestingOnly: true`(기본값)로 수집하되 Shadow DOM 호스트 요소를 감지하면 해당 호스트에만 `{ root: shadowRootElement }`를 재귀 적용하는 선택적 투과 전략 채택.
     - **[Dual-Track 교차 검증]**: `isVisible()` 및 `boundingBox()` 교차 검증으로 가려진/투명 요소 필터링 후 `[@E1]` 매핑.
     - 스트림 파편화(Partial Read) 방지를 위해 **NDJSON** 기반 STDIN/STDOUT 통신 채택.
  3. **QA 모드 전용 프롬프트 및 도구 할당**
     - `contextInjector.js`를 통해 QA 에이전트(`dev_qa_auto`)에게 코드 수정 권한(`write_file` 등)을 완벽히 차단.
     - 오직 파일 읽기, 검색, 테스트 스크립트 실행, 그리고 **AOM 브라우징 툴**만 화이트리스트로 허용.

### Step 5. Graphify 지식 그래프 기반 핀포인트 정적 QA 연동
- **목표**: 동적 UI 브라우저 테스트 전/후로 소스코드 레벨의 정적 분석과 파급 반경(Blast Radius) 검사를 결합하여 무결성(Integrity) 극대화.
- **구현 내용**:
  - QA 에이전트(`dev_qa_auto`)에게 `query_graph` 도구 호출 권한을 부여하여, AST(Abstract Syntax Tree) 기반의 의존성 구조 검사 수행.
  - 브라우저 테스트 중 발생한 에러(콘솔, 네트워크 에러 등)의 근본 원인을 Graphify 지식 그래프에서 역추적하여, 결함이 발생한 파일과 얽혀 있는 모든 노드를 식별.
  - 테스트 종료 시 작성되는 'QA 리포트'에 핀포인트(Pin-point)된 결함 컴포넌트 위치를 강제로 포함시키도록 프롬프트 템플릿 설계.

### Step 6. Auto Debug 파이프라인 연동 (`/auto_debug`)
- **목표**: QA 파이프라인이 생성한 리포트를 바탕으로 스스로 원인을 찾아 수정하는 디버그 에이전트(`dev_debug_auto`) 구동.
- **담당 에이전트**: `dev_debug_auto` (모델: `ANTI_GEMINI_PRO_HIGH` - CEO Amendment 2026-05-13 준수).
- **구현 내용**:
  - QA 실패 카드에서 `[ /auto_debug 시작 ]` 클릭 시 디버그 파이프라인 트리거.
  - **Graphify 기반 파급 반경(Blast Radius) 분석**: 코드를 수정하기 전, `query_graph`를 통해 수정할 파일의 의존성 커뮤니티를 사전 분석.
  - **파괴적 수정 통제 (W-004 보정)**: 파일 삭제, 전체 초기화 등 파괴적 작업 수행 시 `dangerously` 접두사(P-016 정책)를 강제 적용.

### Step 7. 런타임 보안 및 컨텍스트 주입 아키텍처 보강
- **목표**: QA 에이전트의 권한 탈취를 막고 디버그 에이전트에게 컨텍스트를 안전하게 전달.
- **구현 내용**:
  - **QA 리포트 주입 및 가시성/보안 (W-003 보정)**: QA 루프 종료 시 작성된 Markdown 리포트 파일 경로를 `tasks` 테이블의 `artifact_url` 필드에 저장.
    - **에이전트 측면**: Debug 에이전트 가동 시 `contextInjector.js`가 이를 읽어 `[QA 에러 진단서]`로 프롬프트에 자동 주입.
    - **사용자 측면**: 프론트엔드(`TaskDetailModal.jsx`)에 **[ 📄 QA 리포트 보기 ]** 버튼 노출 (가시성 보장).
    - **[GAP-006 / NEW-001 보정] 주입 전 2중 방어**: Path Traversal 검증 뿐만 아니라, 파일을 읽어 프롬프트에 주입하기 직전 **Sanitize(마스킹 필터링)** 필수 수행. (예: `[SYSTEM]`, `[INST]` 지시어를 `[BLOCKED]`로 치환 및 최대 8000자 길이 제한).
  - **Executor-level Interceptor (P1-001 보정)**: `toolExecutor.js` 내부에 QA 모드 전용 하드웨어 락을 걸어, `write_file`, `multi_replace` 등 파일 수정 도구 거부.
  - **[GAP-004 / NEW-002 보정] 확정적 Allowlist 방식 전환**: 우회 가능한 블랙리스트 대신 사전 승인된 엄격한 명령어만 허용.
    - **확정 목록**: `node --check *`, `npx playwright test *`, `bun run *`, `graphify query *`, `grep *`.
    - 위 목록 이외의 실행은 모두 차단되며, **임의 확장 금지 및 변경 시 CEO 승인 필수** 정책 적용.
  - **[GAP-007 / NEW-003 보정] 루프 디커플링 및 인터페이스 계약**: `ai-engine/loops/qaLoop.js` 및 `debugLoop.js` 필수 신설.
    - `executor.js`는 `runQALoop(task, signal)` 형태로 모듈을 호출하며, 루프 내부 로직 관여 금지 (결과 객체만 반환 받음).
    - `activeAutoRuns` Map에 등록된 `AbortController.signal`을 넘겨주어 중단/재시작 기능 완벽 유지.

---
## 3. 기대 효과
1. **무결성 보장**: 코드 조작과 UI 테스트를 원천 분리(DEV vs QA)하고, Immutable 상태 관리를 통해 변경 내역을 안전하게 보존합니다.
2. **비용 및 속도 혁신**: Bun 데몬과 Zero-MCP의 결합으로 브라우저 제어 시 발생하는 막대한 토큰 비용(Call당 약 2,000토큰)을 소거하고 100ms 단위의 초고속 피드백을 제공합니다.
3. **정적-동적 2-Track 시너지**: Graphify가 보이지 않는 아키텍처 결함(순환 참조, 파급 반경 누락)을 잡고, G-Stack 데몬이 렌더링 결함을 잡아내는 완벽한 양방향 교차 검증 생태계를 완성합니다.
