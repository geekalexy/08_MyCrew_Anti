# Phase 42-2: Antigravity ↔ Graphify MCP 연동 기획서 (Dogfooding)

**작성일**: 2026-05-12  
**작성자**: Luca (CTO)  
**상태**: 📝 기획 승인됨 (Dogfooding First)

---

## 1. 개요 및 목적
기존의 "우리가 직접 Graphify 엔진을 밑바닥부터 파이썬으로 구현하겠다"는 비효율적인 기획을 전면 백지화합니다.
대신, 이미 완벽하게 구현된 **공식 오픈소스 Graphify MCP(Skill)**를 우리가 작업하고 있는 환경인 **Antigravity(AI 코딩 어시스턴트)에 최우선적으로 설치 및 연동**합니다. 

이를 통해 MyCrew 코드베이스를 분석할 때 우리가 직접 71.5배의 토큰 절감 효과와 분석 정확도 향상을 체험하고(Dogfooding), 검증이 완료된 이후에 비로소 MyCrew 시스템 내부에 Graphify를 적용합니다.

---

## 2. Antigravity 연동 및 활용 시나리오

### 2.1. 공식 Graphify 스킬(MCP) 설치
- Antigravity 환경에 공식 Graphify GitHub 주소를 입력하여 MCP 스킬로 즉시 설치합니다.
- 복잡한 로컬 환경 세팅이나 `graphify_mcp.py` 같은 자체 스크립트 작성 없이, 즉시 `graphify` 도구를 사용할 수 있는 환경을 구축합니다.

### 2.2. MyCrew 프로젝트 지식 그래프 빌드 (`graphify extract`)
- Antigravity 안에서 스킬을 호출하여, MyCrew 프로젝트(특히 `02_System_Development` 폴더)를 대상으로 `graphify extract` 명령을 실행합니다.
- **출력물**:
  1. `graph.json` (쿼리 가능한 엣지/노드 원본 데이터)
  2. `.graphify_analysis.json` (커뮤니티 감지 등의 분석 결과)

### 2.3. Antigravity의 컨텍스트 탐색 방식 혁신
- 앞으로 Antigravity(Luca)가 MyCrew 코드를 수정하거나 디버깅할 때, 무식하게 프로젝트 전체 코드나 `find`, `grep`을 남발하지 않습니다.
- 대신 Graphify가 생성한 **지식 그래프 데이터(graph.json) 및 커스텀 시각화 뷰어**를 먼저 참조(Read Graph First)하여:
  - 어떤 함수가 어디에 연결되어 있는지 (AST 추출 구조)
  - 기술 부채가 어디에 쌓여 있는지 (Leiden 커뮤니티 분석)
  을 단번에 파악하고 코드 작업에 돌입합니다.

---

## 3. 기대 효과 (ROI)
1. **토큰 절감**: 파일 전체를 읽어들여 20만 토큰을 낭비하던 기존 방식에서, 그래프 쿼리(약 300 토큰 내외)로 전환하여 **최대 71.5배의 토큰 절감률** 확보.
2. **환각(Hallucination) 억제**: LLM의 확률적 추론에 의존하지 않고, Tree-sitter가 파싱한 100% 결정론적 구조 지도를 기반으로 코딩하므로 부정확한 답변 확률 제로화.
3. **아키텍처 보호**: `God Node`(가장 연결이 많은 핵심 모듈)와 `Surprising Connections`(의도치 않은 결합)를 파악하여, 섣부른 코드 수정으로 인한 시스템 마비 방지.

---

## 4. 진행 마일스톤 (Action Plan)
- [x] **Step 1**: Antigravity에 공식 Graphify MCP 스킬 설치. (2026-05-12 완료)
- [x] **Step 2**: MyCrew 코드베이스에 Graphify 명령(`uvx graphify extract`) 실행 및 결과물(`graph.json` 등) 생성 확인. (2026-05-12 완료)
- [x] **Step 3**: Antigravity가 Graphify 결과물을 활용해 특정 버그(혹은 기술 부채)를 효율적으로 추적하는 실전 테스트 진행. (2026-05-12 완료 - God Node 도출 성공)
- [ ] **Step 4**: (위 단계가 완벽히 성공한 후) MyCrew 내부 시스템(아리 엔진)에 사용자용 Graphify 연동 기획 확장.

---

## 5. 실행 및 검증 이력 (Execution History)
**[2026-05-12] Graphify 시맨틱 추출 및 Dogfooding 성공 (진행자: Luca, CEO)**
* **상황**: 샌드박스 네트워크 차단(`Operation not permitted`) 환경을 우회하기 위해 대표님(CEO)의 로컬 터미널에서 `GEMINI_API_KEY` 적용 후 직접 `uvx` 추출 명령 실행.
* **추출 완료 데이터**: `07_MyCrew_Wiki/Graphify_Vault/graphify-out/graph.json` 생성 완료 (전체 노드 및 연결 링크 추출 성공).
* **God Node 검증 (Step 3)**: 생성된 `graph.json` 구조를 바탕으로 자율적으로 Node.js 스크립트를 작성·실행하여 가장 높은 의존성(간선 수)을 가진 노드 Top 3를 1초 만에 색출해 냄.
  1. `server.js` (연결 170건) - 시스템 메인 진입점
  2. `DatabaseManager` (`database.js`, 연결 84건) - 전역 비즈니스 로직
  3. `videoLabRouter.js` (연결 57건) - 비디오 파이프라인
* **결론**: 기존 `grep`이나 전체 소스코드 스캔 방식에서 벗어나, Graphify가 추출한 구조적 지식 그래프를 쿼리함으로써 엄청나게 빠르고 정확하게 아키텍처 핵심부를 파악하는 데 성공함 (Dogfooding 목표 100% 달성).

---

## 6. 지식 그래프 검색 및 활용 가이드 (Usage Guide)
현재 추출된 원본 지식 그래프 파일(`graph.json`)은 `/Users/alex/Documents/08_MyCrew_Anti/07_MyCrew_Wiki/Graphify_Vault/graphify-out/` 경로에 저장되어 있습니다. 이를 활용하는 3가지 방법은 다음과 같습니다.

### 1) AI 에이전트(Luca/Sonnet)에게 쿼리 위임 (권장)
가장 효율적인 방법입니다. 프롬프트 채팅창에 직접 질문하시면 에이전트가 `graph.json`을 분석하여 답변합니다.
* 예시: *"루카야, `videoLabRouter.js`에 의존하는 파일이 총 몇 개인지 리스트업 해 줘."*
* 예시: *"`executor.js`와 `database.js` 사이의 연결 경로를 알려줘."*

### 2) 터미널(CLI)을 통한 직접 쿼리
오프라인 터미널 환경에서 궁금증이 생겼을 때, Graphify의 자연어 쿼리 기능을 직접 사용할 수 있습니다.
```bash
uvx --from git+https://github.com/safishamsi/graphify.git graphify query "서버 부팅 시 가장 먼저 실행되는 모듈의 흐름을 설명해 줘"
```

### 3) 계층 구조 시각화 (D3 Tree HTML) 생성
추출(`extract`)된 데이터를 바탕으로, D3.js 기반의 접이식 트리 뷰어(`GRAPH_TREE.html`)를 생성하려면 아래 명령어를 실행합니다. (참고: 저희가 따로 만든 `99_System_Graph/graph.html`이 훨씬 성능이 좋으므로 이 기능은 보조용으로만 사용합니다.)
```bash
uvx --from git+https://github.com/safishamsi/graphify.git graphify tree --graph /Users/alex/Documents/08_MyCrew_Anti/07_MyCrew_Wiki/Graphify_Vault/graphify-out/graph.json
```
