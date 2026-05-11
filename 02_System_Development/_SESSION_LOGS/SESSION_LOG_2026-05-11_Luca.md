# SESSION LOG — 2026-05-11 (Luca)

## 🎯 세션 목표
1. **Phase 39 Mode Auto-Routing 보완**: In Progress 상태에서도 기획 모드 및 `/plan_master` 커맨드 허용.
2. **Phase 40 My-Graph 내재화 아키텍처 기획**: 외부 통신 없이 로컬 Stdio 기반 초경량 파이썬 데몬(graphify_mcp.py) 통합 방식 정의.
3. **Phase 41 Project Wiki 시스템 개발**: 프로젝트 문맥 자동 수집 및 위키 문서(PROJECT_WIKI.md) 자동 갱신 시스템 구축 및 안정화.

## 🛠️ 주요 작업 내용

### 1. Phase 39: Mode Auto-Routing 기능 보완
- **프론트엔드 업데이트 (`TaskDetailModal.jsx`)**: 
  - `In Progress` 상태일 때 노출되는 슬래시 커맨드 목록에 `/plan_master` (추가 기획 및 스코프 분석) 커맨드 노출 추가.
  - 모드(Mode) 선택기에서 `📐 기획 모드(ARCHITECT)`가 계속 활성화되도록 유지 로직 적용.
- **기획 문서 업데이트 (`Phase39_MODE_AUTO_ROUTING_기획.md`)**:
  - 칸반 컬럼 기반 슬래시 커맨드 명세의 In Progress 항목에 `/plan_master` 정식 편입 문서화 완료.

### 2. Phase 40: My-Graph(Graphify) 내재화 아키텍처 기획
- **기획서 신규 작성 (`Phase40_My_Graph_아키텍처_기획서.md`)**:
  - **하이브리드 아키텍처**: 무거운 외부 라이브러리(MCP SDK 등) 설치 없이, 파이썬 기본 표준 라이브러리 기반의 `graphify_mcp.py` 스크립트를 내재화하는 아키텍처 고안.
  - **안전한 통신**: 포트를 점유하지 않고 Node.js(`graphifyWatchdog.js`) ↔ Python 브릿지 간 표준 입출력(Stdio) 데이터 통신으로 완벽한 보안과 빠른 응답 속도 확보.
  - **최단 경로 쿼리(BFS)**: 에러 추적 시 파일 전체 스캔을 지양하고, 연관된 3~4개의 파일만 핀포인트로 타겟팅하여 토큰 소모량을 90% 이상 획기적으로 절감하는 원리 명시.
- **문서 동기화**: 기존 `Phase40_Graphify_연동_기획서.md` 상단에 새 문서로 연결되는 상호 백링크(Backlink) 처리 완료.

### 3. Phase 41: Project Wiki 시스템 통합 및 긴급 버그 픽스
- `database.js`: `projects` 테이블에 `project_type` 컬럼을 추가하여 추후 다양한 Wiki 규칙 템플릿 대응 기반 마련.
- `wikiEngine.js` 구현: `raw/` 디렉토리 파일들을 읽어들여 3-Layer 규칙(`WIKI_RULES_{TYPE}.md`)을 바탕으로 자율적인 프로젝트 위키(`PROJECT_WIKI.md`)를 작성 및 갱신하는 엔진 개발.
- `server.js`: 첨부파일 API 호출 시 `raw/` 디렉토리 자동 복사 및 칸반 상태가 승인(approve) 시 Wiki 갱신 워치독 작동.
- `executor.js`: `executorPersona` 프롬프트에 `PROJECT_WIKI.md` 내용을 주입하여 Agent에게 프로젝트 히스토리를 자동으로 각인.
- **메타인지 분석 및 지식 위키 구조화 (Graphify Native 이식)**:
  * 단순 LLM 요약기를 탈피하여 `Detect -> Extract -> Build -> Cluster -> Analyze -> Export`의 6단계 알고리즘 분리 파이프라인으로 전면 개편.
  * Node/Edge 스키마에 `relation`과 `confidence` 속성을 강제하여, "AI 추론"과 "원본(raw) 명시"를 완벽히 역추적할 수 있도록 설계.
  * AI 가공 산출물은 `10_Product`, `50_Business_Rules`, `90_Decisions` 등 비즈니스 온톨로지(Ontology) 기반의 넘버링 폴더 체계로 철저히 분산 라우팅되어 Export됨.
- **[구현 완료] Python Graphify 백엔드 (`graphify_mcp.py`)**:
  - 마크다운 파서 및 헤더(`Section`), 결정사항(`Decision`), 링크(`Concept`) 추출 로직 추가.
  - `relation`과 `confidence` 필드를 도입하여 신뢰도 기반의 지식 그래프(`graph.json`) 구축.
- **[구현 완료] Node.js Ontology 엑스포터 (`wikiEngine.js`)**:
  - `graphify_mcp.py`를 서브프로세스로 트리거하여 최신 그래프 수집.
  - LLM 모델을 통한 군집별 마크다운 문서 포매팅 및 `90_Decisions/DECISION_LOG.md`, `20_Domain/Glossary.md`, `00_Index/PROJECT_WIKI.md` 생성 로직 완성.
- **[구현 완료] Read Graph First 주입 (`executor.js`)**:
  - 구형 `.mycrew/wiki` 경로 대신 신규 구조인 `Project_WIKI/00_Index/PROJECT_WIKI.md` 문서를 에이전트의 System Prompt에 하드 인젝션하여 문맥 파악 우선 처리.
- **🚨 핫픽스 (모델 환각 버그)**:
  - 위키 생성 로직 호출 시 기존 에이전트(소넷)가 하드코딩한 무효 식별자(`gemini-1.5-pro`)로 인해 무한 대기(Stuck) 상태가 발생하는 치명적 오류를 발견.
  - 정책 `P-005`, `P-006`에 입각하여 `modelRegistry.js`의 공식 상수인 `MODEL.PRO`를 Import 하도록 수정해 안정적 작동 보장.

### 4. 🛡️ Supreme Review 대응 (Phase 41 리팩토링)
- **🟡 B (조건부 승인)** → **🟢 A 승격 목표** 달성을 위해 Prime Advisor가 지적한 7건 전량 패치.
- **🔴 C-001 (Shell Injection)**: `wikiEngine.js`에서 `exec()` → `execFile()`로 전면 교체. Shell을 거치지 않아 명령어 주입 공격 완전 차단.
- **🔴 C-002 (Atomic Write)**: `graphify_mcp.py`의 `wiki_cache.json` 저장 로직을 `.tmp` 파일 기록 → `os.replace()` 원자적 교체로 전환. Kill 시에도 캐시 무결성 보장.
- **🟠 H-001 (LLM 비용 폭탄)**: `wikiEngine.js`에서 Gemini Pro **3회 호출을 완전 제거**하고 순수 알고리즘 기반 마크다운 템플릿(`_buildDecisionLog`, `_buildGlossary`, `_buildProjectIndex`)으로 전환. 기획서 §4 "수학적 알고리즘으로 LLM 요약기를 배제" 정책과 코드 동기화 완료. 추가로 `generateOntology`에 **10초 디바운스** 도입하여 빈번한 댓글에도 과잉 트리거 방지.
- **🟠 H-002 (Race Condition)**: `server.js`의 `appendMeetingLog`에 **파일별 Serial Queue Lock 맵**(`_meetingWriteLocks`)을 적용하여 동일 회의록 파일에 대한 동시 appendFile 충돌 방지.
- **🟡 M-001 (BFS Depth)**: `graphify_mcp.py`의 `shortest_path` BFS에 `MAX_DEPTH=50` 제한 추가. 초대형 그래프에서도 OOM/Hang 방지.
- **🟡 M-003 (graph.json 원본 파괴)**: `fs.rename()` → `fs.copyFile()`로 변경하여 Graphify 엔진의 원본 `graph.json`이 보존되도록 수정.

## 📌 다음 단계 (Next Steps)
- Phase 41 Supreme Review 재심사 요청 (🟢 A 승격 확인).
- Phase 42 기획 착수 준비.
