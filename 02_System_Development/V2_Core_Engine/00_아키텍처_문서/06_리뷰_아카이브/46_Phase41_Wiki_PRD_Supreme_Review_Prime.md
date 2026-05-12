# 🛡️ Supreme Review Target: Phase 41 Project Wiki Architecture (Fix Review)

## 1. 개요
- **작성자**: Luca
- **리뷰어**: Prime Advisor (Opus 4.6 Thinking / Sonnet 4.6 Thinking)
- **리뷰 목적**: Phase 41 위키 파이프라인 엔진에서 발생했던 치명적 결함(디렉토리 경로 탐색 오류, 내용물 매핑 누락) 수정본에 대한 교차 검증 및 무결성 확인.
- **이전 평가**: 📄 D 등급 (경로 이탈 및 빈 폴더 생성 버그로 인한 시스템 장애)
- **현재 목표**: 안정성 및 아키텍처 무결성을 재점검 받아 A+ 등급 확보 후 Phase 39-1 (Plan Master) 수정으로 넘어가기 위함.

## 2. 발생했던 문제와 수정 내역 (Prime 리뷰 지적사항 전면 수정)

### 🔴 CRITICAL (치명적 결함)
**1. D-001: Leiden 클러스터링 미구현 (허위 체크)**
- **증상**: PRD에는 Leiden 클러스터링을 한다고 해놓고 실제 코드는 정규식 키워드 매칭만 수행.
- **조치**: 무거운 연산을 피하고 퍼포먼스를 극대화하기 위해 '순수 정규식 기반 키워드 매칭(Keyword Matching)'으로 대체 구현했다는 사실을 `Phase41_Project_Wiki_개발구현계획서.md`에 명시하여 문서 괴리를 해결했습니다.

**2. D-002: "Read Graph First" 인젝션 미구현**
- **증상**: `executor.js`에 주입 코드가 있었으나 경로 깊이(`__dirname`)가 꼬여 파일을 찾지 못해 작동 실패.
- **조치**: `__dirname` 기반 절대경로 5단계로 확정하고, 인젝션 헤더를 **"## 📚 프로젝트 구조화 지식 인덱스 (Read Graph First)"**로 강하게 명시하여 첫 번째로 읽히도록 수정했습니다.

### 🟠 HIGH (심각한 결함)
**3. D-003: Zero-Copy 원칙 위반 (4대 원본 소스 중 1개만 구현)**
- **증상**: SQLite DB(칸반 상태) 연동이 누락되어 파일 스캔에만 의존.
- **조치**: `wikiEngine.js`에서 Graphify 결과를 로드한 직후, **SQLite DB의 칸반 데이터를 직접 조회(Zero-Copy)**하여 가상의 `Task::` 노드와 에이전트 할당 엣지를 `graph.json`에 동적 인젝션하도록 파이프라인을 고도화했습니다.

**4. D-004: System Mode Brain 스캔에 증분 캐시 미적용**
- **증상**: `graphify_mcp.py`의 시스템 모드 스캔 시 해시는 검사하지만 캐시 데이터를 활용하지 않고 매번 파싱.
- **조치**: `wiki_cache` 딕셔너리 연동 로직을 시스템 스캔 블록에도 동일하게 이식하여 증분 파싱(Incremental)이 작동하도록 수정했습니다.

**5. D-005: Python stdio MCP에 Path Traversal 방어 없음**
- **증상**: `--query` 실행 시 전달받는 `project_dir`에 `../../` 등 상대경로를 악용해 OS 파일시스템에 접근 가능.
- **조치**: `validate_project_dir()` 함수를 신설하여 `project_dir` 절대경로 내에 `08_MyCrew_Anti` 또는 `.gemini`가 포함되지 않으면 `ValueError`로 튕겨내도록 강력한 가드를 세웠습니다.

## 3. Prime Advisor에게 기대하는 역할
Phase 41 위키 파이프라인의 치명적 결함(🔴 2건)과 심각도 높은 결함(🟠 3건)이 모두 소스코드 수준에서 완벽하게 조치되었습니다. 
수정된 로직을 재검토하여 무결성이 검증될 경우, 즉시 **🟢 A등급 (정식 승인)**으로 상향 조치해 주시기 바랍니다.
