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

### 2.2. MyCrew 프로젝트 지식 그래프 빌드 (`graphify . wiki`)
- Antigravity 안에서 스킬을 호출하여, MyCrew 프로젝트(특히 `02_System_Development` 폴더)를 대상으로 `graphify . wiki` 명령을 실행합니다.
- **출력물**:
  1. `graph.json` (쿼리 가능한 엣지/노드 데이터)
  2. `graph.html` (Vis.js 기반 인터랙티브 시각화)
  3. `graph_report.md` (커뮤니티 감지, God Node, 서프라이징 커넥션 등의 분석 결과)
  4. `Obsidian Vault / 마크다운 위키` (에이전트 크롤링 전용)

### 2.3. Antigravity의 컨텍스트 탐색 방식 혁신
- 앞으로 Antigravity(Luca)가 MyCrew 코드를 수정하거나 디버깅할 때, 무식하게 프로젝트 전체 코드나 `find`, `grep`을 남발하지 않습니다.
- 대신 Graphify가 생성한 **지식 그래프 지도(마크다운 위키 및 리포트)**를 먼저 참조(Read Graph First)하여:
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
- [ ] **Step 1**: Antigravity에 공식 Graphify MCP 스킬 설치.
- [ ] **Step 2**: MyCrew 코드베이스에 `graphify . wiki` 명령 실행 및 결과물(`graph_report.md` 등) 생성 확인.
- [ ] **Step 3**: Antigravity가 Graphify 결과물을 활용해 특정 버그(혹은 기술 부채)를 효율적으로 추적하는 실전 테스트 진행.
- [ ] **Step 4**: (위 단계가 완벽히 성공한 후) MyCrew 내부 시스템(아리 엔진)에 사용자용 Graphify 연동 기획 확장.
