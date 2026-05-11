# Phase 41: Project Wiki 개발구현계획서 (Task List)

**작성일**: 2026-05-11
**작성자**: Luca
**상태**: 🚧 진행 중 (In Progress)
**기준 문서**: [Phase41_Project_Wiki_기획서](Phase41_Project_Wiki_기획서.md)

---

## 1. 개요
본 문서는 `Phase41_Project_Wiki_기획서.md`를 바탕으로 Project Wiki 시스템(지식 통합, 메타인지 분석 등)을 실제 코드로 구현하기 위한 상세 개발 체크리스트입니다. 직전 세션에서 기반 아키텍처(WikiEngine, raw/ 디렉토리 등)가 구축되었으며, 본 계획서는 잔여 고도화 과제 및 사용자 피드백(메타인지 분석 폴더 연동 등)을 반영한 태스크 리스트입니다.

---

## 2. 개발 체크리스트 (Task List)

### 📌 2.1 백엔드: Graphify 기반 파이프라인 엔진 구축 (Wiki Graph Engine)
- [ ] **Detect & Extract 모듈 구현 (P0)**:
  - `raw/` 디렉토리를 스캔(`.mycrewignore` 적용)하여 파일 타입별 파서(Extractor) 라우팅.
  - 마크다운/문서/미팅 로그 파서는 `nodes`와 `edges` 딕셔너리를 추출 (엣지 스키마에 `relation`, `confidence` 필수 포함).
- [ ] **Build Graph & Cluster 모듈 (P0)**:
  - 추출된 데이터를 Python `NetworkX` (또는 Node.js 동급 라이브러리)를 통해 수학적 그래프로 결합.
  - Leiden 알고리즘(또는 유사 알고리즘) 기반 커뮤니티 군집화(Clustering) 로직 작성.
- [ ] **Analyze & Export 모듈 (P1)**:
  - 그래프에서 중심 허브(God Node) 및 의사결정 경로(ADR)를 판별.
  - 최종 분석된 그래프 객체를 `PROJECT_WIKI.md`, `graph.json` 등의 포맷으로 `00_Index/` 및 `99_Graph_Data/` 등에 Export.
- [ ] **증분 업데이트 (Incremental) 최적화 (P2)**:
  - SHA256 해시값 기반 캐시 로직 구현, `--update` 플래그 사용 시 변경된 파일의 엣지만 추출·재연결.

### 📌 2.2 메타인지 연동 및 "Read Graph First" 프롬프트 인젝션
- [ ] **`Project_WIKI/raw/meetings/` 폴더 자동 저장 (P0)**:
  - 사용자-비서(Agent) 간의 채팅, 코멘트 등을 `raw/meetings/YYYY-MM-DD_TaskID_회의록.md` 원본으로 덤프.
- [ ] **도메인 온톨로지(10~90) 파이프라인 (P0)**:
  - `raw/meetings/` 및 타 원본 데이터가 갱신될 경우 Watchdog을 통해 분석 파이프라인 트리거.
  - 알고리즘 및 모델을 통해 기획 의도는 `10_Product/`, 정책은 `50_Business_Rules/`, 의사결정은 `90_Decisions/` 등으로 자동 라우팅 및 Export.
- [ ] **에이전트 System Prompt 하드 인젝션 로직 (P0)**:
  - `executor.js` 실행 시 에이전트가 코드베이스를 탐색하기 전, 가장 먼저 `00_Index/PROJECT_WIKI.md`의 구조화된 지식 인덱스를 강제 주입(Install).
- [ ] **Graphify Query용 MCP 도구 연동 (P1)**:
  - 에이전트가 시스템 프롬프트를 읽은 후 특정 모듈 간의 경로나 의존성을 물어볼 수 있는 `mcp_mycrew_query_graph` 툴 제공.

---

## 3. 테스트 시나리오
- [ ] **시나리오 1 (레거시 코드베이스 온보딩)**: Graphify Query 툴을 통해 "authentication flow is connected to which modules?"를 물었을 때, `00_Index/PROJECT_WIKI.md`와 그래프 데이터를 기반으로 즉각적이고 정확한 답변이 나오는지 확인.
- [ ] **시나리오 B (메타인지 분석 루프)**: 비서와 주고받은 기획 관련 대화가 `raw/meetings/`에 저장되고, 분석을 거쳐 `10_Product`, `50_Business_Rules`, `90_Decisions` 등의 알맞은 온톨로지 폴더로 분배되어 Export 되는지 검증.
- [ ] **시나리오 3 (구조 기반 탐색)**: 에이전트 구동 시, 불필요하게 `raw` 폴더 전체를 `grep`하지 않고, 하드 인젝션된 `PROJECT_WIKI.md`를 우선적으로 읽어 전체 아키텍처 맥락을 파악하는지 테스트.
- [ ] **시나리오 4 (증분 업데이트 최적화)**: 파일 1개만 수정되었을 때 `--update` 트리거가 전체 토큰을 소모하지 않고 해당 노드의 엣지만 갱신하여 Export 하는지 검증.
