# Phase 42: MyCrew Self-Graphify (에이전트 전용 시스템 지식망) 기획서

**작성일**: 2026-05-11  
**작성자**: Luca (CTO)  
**상태**: 📝 기획 중 (Draft)  

---

## 1. 개요 및 목적 (Dogfooding 전략)
지금까지 구현된 Graphify Native Wiki(Phase 41)는 사용자의 개별 프로젝트(`04_Users/01_Company/01_Projects/...`)를 분석하는 데 사용되었습니다. 
하지만 에이전트(Luca, Sonnet 등)들이 직접 **MyCrew 코어 엔진(`02_System_Development/`)**을 개발하고 유지보수할 때도 전체 아키텍처 맥락을 완벽히 파악해야 합니다.

Phase 42의 핵심은 **"우리가 만든 무기를 우리 스스로에게 적용(Dogfooding)하는 것"**입니다. MyCrew 소스 코드와 아키텍처 문서 자체를 Graphify 엔진으로 스캔하여 **AI 에이전트 전용 시스템 지식망(System Wiki)**을 구축합니다.

---

## 2. 핵심 아키텍처 변경점

### 2.1. System Graph 스캔 대상 및 타겟
- **스캔 대상 경로**: `/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/`
  - `01_아리_엔진/` (Node.js 백엔드, MCP 서버)
  - `00_아키텍처_문서/` (PRD, 정책 문서, 리뷰 아카이브)
  - `_SESSION_LOGS/` (작업 히스토리)
- **제외 대상**: `node_modules`, `dist`, `.git` 등 (기존 로직 재활용)
- **저장 위치**: `02_System_Development/00_아키텍처_문서/99_System_Graph/`

### 2.2. 에이전트 컨텍스트 주입 (Read Graph First for System)
- 현재 Antigravity 시스템에서 에이전트가 깨어날 때 `auto-context-load.md` 규칙에 의해 `strategic_memory.md`와 `POLICY_INDEX.md`를 읽습니다.
- 여기에 추가로, 생성된 **`SYSTEM_INDEX.md` (또는 System Graph 요약본)**을 읽도록 규칙을 업데이트하여, 코어 엔진의 전체 의존성(ex. `server.js` ↔ `wikiEngine.js` ↔ `graphify_mcp.py`)을 단번에 파악하게 만듭니다.

### 2.3. System Watchdog (자동 갱신 루프)
- 사용자 프로젝트는 칸반 코멘트/채팅 시 워치독이 돌지만, 시스템 개발은 주로 터미널 커밋(Git)이나 파일 직접 수정으로 이루어집니다.
- **방안**: 파일 시스템 변경을 감지하는 Node.js 기반 `systemWatchdog.js`를 백그라운드로 띄우거나, 간단하게 `npm run dev` 스크립트 실행 시 1회 갱신되도록 파이프라인을 구축합니다.

---

## 3. 구현 마일스톤 (Task List)

### [Phase 42-1] System Graphify 엔진 라우팅 
- `graphify_mcp.py`가 사용자 프로젝트 폴더뿐만 아니라, 환경 변수나 인자를 통해 `02_System_Development/` 폴더를 스캔할 수 있도록 유연성 확보 (현재도 디렉토리 인자로 작동하므로 즉시 적용 가능).
- 시스템 전용 `wikiEngine.js` 스크립트 작성 (혹은 CLI 명령어 구성)하여 `00_아키텍처_문서/` 내부에 온톨로지 렌더링.

### [Phase 42-2] 시스템 에이전트 도구 연동 (Dogfooding)
- `mcp_server.js`의 `query_graph` 툴이 현재 활성화된 프로젝트뿐만 아니라, **"시스템(MyCrew 엔진) 코드 쿼리"** 모드를 지원하도록 개선.
- 에이전트가 `query_graph("dependencies(server.js)", scope="system")` 형태로 아리 엔진 내부의 결합도를 조회할 수 있게 확장.

### [Phase 42-3] 메타인지 룰(Rule) 업데이트
- `.agents/rules/` 하위의 컨텍스트 로드 규칙(`luca-context-load.md` 등)에 System Graph Index 파일을 필수 참조 항목으로 편입.

---

## 4. 기대 효과
1. **환각(Hallucination) 제로화**: 에이전트가 옛날 파일(`ariDaemon.js`)이나 삭제된 로직을 환각으로 참조하는 현상을 원천 차단합니다.
2. **리팩토링 안정성 극대화**: 아리 엔진 코어 구조를 변경할 때, `query_graph`를 통해 영향도(Impact Analysis)를 100% 수학적으로 파악한 후 코딩에 돌입합니다.
3. **새로운 에이전트 온보딩 단축**: 향후 합류할 Nexus, Prime 등의 에이전트가 거대한 MyCrew 코드를 단 몇 초 만에 파악할 수 있는 뇌(Brain)가 완성됩니다.
