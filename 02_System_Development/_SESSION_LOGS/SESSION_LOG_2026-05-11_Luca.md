# SESSION LOG — 2026-05-11 (Luca)

## 🎯 세션 목표
1. **Phase 39 Mode Auto-Routing 보완**: In Progress 상태에서도 기획 모드 및 `/plan_master` 커맨드 허용.
2. **Phase 40 My-Graph 내재화 아키텍처 기획**: 외부 통신 없이 로컬 Stdio 기반 초경량 파이썬 데몬(graphify_mcp.py) 통합 방식 정의.
3. **Phase 41 Project LLM Wiki 시스템 개발**: 프로젝트 문맥 자동 수집 및 위키 문서(PROJECT_WIKI.md) 자동 갱신 시스템 구축 및 안정화.

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

### 3. Phase 41: Project LLM Wiki 시스템 통합 및 긴급 버그 픽스
- `database.js`: `projects` 테이블에 `project_type` 컬럼을 추가하여 추후 다양한 Wiki 규칙 템플릿 대응 기반 마련.
- `wikiEngine.js` 구현: `raw/` 디렉토리 파일들을 읽어들여 3-Layer 규칙(`WIKI_RULES_{TYPE}.md`)을 바탕으로 자율적인 프로젝트 위키(`PROJECT_WIKI.md`)를 작성 및 갱신하는 엔진 개발.
- `server.js`: 첨부파일 API 호출 시 `raw/` 디렉토리 자동 복사 및 칸반 상태가 승인(approve) 시 Wiki 갱신 워치독 작동.
- `executor.js`: `executorPersona` 프롬프트에 `PROJECT_WIKI.md` 내용을 주입하여 Agent에게 프로젝트 히스토리를 자동으로 각인.
- **🚨 핫픽스 (모델 환각 버그)**:
  - 위키 생성 로직 호출 시 기존 에이전트(소넷)가 하드코딩한 무효 식별자(`gemini-1.5-pro`)로 인해 무한 대기(Stuck) 상태가 발생하는 치명적 오류를 발견.
  - 정책 `P-005`, `P-006`에 입각하여 `modelRegistry.js`의 공식 상수인 `MODEL.PRO`를 Import 하도록 수정해 안정적 작동 보장.

## 📌 다음 단계 (Next Steps)
- **Phase 41 잔여 과제 구현 (Project LLM Wiki 고도화)**:
  - **WikiCollector 통합 수집 연동**: 현재 생략/Mocking된 칸반 카드 및 댓글 DB 조회 로직 구현 및 `.mycrew/docs/roadmaps/` (PRD), `graph.json`, `리뷰_아카이브/` 문서 수집 파이프라인 추가 (P0).
  - **의사결정 기록 자동 추적**: `DECISION_LOG.md` 파일에 4단 ADR 구조(Context-Decision-Alternatives-Consequences) 기반 로그 자동 누적 생성 (P1).
  - **증분 업데이트 최적화**: SHA256 해시 기반(`wiki.json`)으로 변경된 소스만 감지하여 재생성하는 토큰 최적화 로직 (P2).
  - **Vision API 연동**: `raw/images/` 내 사용자 업로드 이미지에 대한 자동 캡션 생성 (P1).
- 서버 재시작 후 Phase 41 위키 갱신 파이프라인 안정화 테스트.
- Phase 40 기획서에 명시된 `graphify_mcp.py` 스크립트 및 `graphifyWatchdog.js` Stdio 브릿지 본격 연동 개발 착수.
