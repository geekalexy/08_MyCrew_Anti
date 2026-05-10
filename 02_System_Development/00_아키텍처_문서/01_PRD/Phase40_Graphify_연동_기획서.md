# Phase 40: Graphify(지식 그래프) 연동 기획서

**작성일**: 2026-05-10
**작성자**: Luca
**상태**: ✅ Draft

---

## 1. 개요 (Overview)
Phase 39에서 확립된 Zero-Command UX 및 MCP 아키텍처 기반 위에, Phase 40에서는 **Graphify(지식 신경망)** 엔진을 본격적으로 연동합니다.
기존처럼 코드를 분석하기 위해 수십 개의 텍스트 파일을 무식하게 읽어들여 토큰을 낭비하는 방식에서 벗어나, 코드를 노드(Node)와 엣지(Edge)로 추상화한 **지식 그래프(Graph.json)에 Cypher 쿼리를 날려 정밀 타격(Zero-Context Debugging)**을 수행하는 지능형 에이전트 시스템을 완성합니다.

## 2. 주요 기능 및 아키텍처 연동 계획

### 🚀 사전 이행 기록 (Pre-completed Foundation)
본 기획이 본격적으로 실행되기 앞서, 다음과 같은 기초 인프라(뼈대)가 이미 시스템 내에 구축되어 있습니다.
1. **`graphify_mcp.py` 구축**: Python 기반의 독립형 MCP 서버 데몬 코어가 작성되어 있으며, `query_graph`, `update_graph` 도구의 I/O 뼈대가 마련되어 있습니다.
2. **`graphifyWatchdog.js` 구축**: 카드가 완료될 때마다 백그라운드 갱신 프로세스를 담당할 워치독 Node 래퍼 모듈이 구현되어 있습니다.
3. **`executor.js` 페르소나 주입**: 에이전트가 코드를 탐색할 때 무식한 검색(grep)을 지양하고 무조건 **Graphify MCP 서버를 우선 호출**하도록 강력한 Rule 텍스트가 이미 주입되어 있습니다.

### A. Graphify 백엔드 인프라 파이프라인
1. **Graphify Watchdog 데몬 실체화**: 
   - 기 구축된 `graphifyWatchdog.js` 내의 주석 처리된 실제 쉘 명령어(`execPromise('graphify --update')`)의 봉인을 해제하여 파이프라인에 연결합니다.
   - 워크스페이스의 코드가 수정될 때마다 `graph.json`과 시각화 파일인 `graph.html`, 그리고 서머리 리포트인 `GRAPH_REPORT.md`를 자동으로 최신화합니다.
2. **단일 진실 공급원(SSOT)**: 
   - 에이전트는 더 이상 파일 시스템을 돌아다니며 길을 잃지 않고, 최신화된 `graph.json`만을 기준으로 의존성을 파악합니다.

### B. MCP 스킬의 MOCK 제거 및 실제 로직 매핑
기존 `mcp_server.js`에 Mock 형태로 등록해둔 2가지 핵심 스킬에 실제 Graphify 쿼리 로직을 연결합니다.
1. **`extract_graph` (리뷰 모드 전용)**: 
   - 호출 시 즉시 워크스페이스를 스캔하여 Graphify 군집화 알고리즘(Leiden 등)을 돌려 최신 지식망을 추출/저장합니다.
2. **`trace_bug` (디버그/개발 모드 전용)**: 
   - 에러 로그가 주어지면 Graphify MCP에 `shortest_path(ErrorNode, SuspectNode)` 형태의 Cypher 쿼리를 날려, 관련 없는 파일은 모두 배제하고 버그와 직접 연관된 AST(추상 구문 트리) 맥락만 핀포인트로 가져옵니다.

### C. 프론트엔드: 아카이브 허브 & 지식망 시각화 뷰어
1. **지식베이스 허브 (대시보드 GNB 추가)**:
   - 완료된 작업(아카이브)들을 단순 리스트가 아닌 지식 허브로 구성합니다.
2. **Iframe Graph HTML 렌더링**:
   - 아카이브 상세 페이지에 Graphify가 생성한 `graph.html`을 Iframe 뷰어로 띄워, 대표님이나 에이전트가 현재 프로젝트의 아키텍처 지형도를 한눈에 파악할 수 있는 시각적 통찰력을 제공합니다.

---

## 3. 기대 효과
- **비용/속도 혁신**: 토큰 소모량이 90% 이상 급감하며, 디버깅 시 응답 속도 및 원인 파악의 정확도가 극적으로 상승합니다.
- **문맥 손실(Hallucination) 방지**: 무한에 가까운 프로젝트 파일 컨텍스트를 그래프 좌표 기반으로 탐색하므로, 에이전트가 핵심을 놓치지 않습니다.
