---
trigger: always_on
description: Always consult the graphify knowledge graph at graphify-out/ before answering codebase or architecture questions.
---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- If the graphify MCP server is active, utilize tools like `query_graph`, `get_node`, and `shortest_path` for precise architecture navigation instead of falling back to `grep`
- If the MCP server is not active, the CLI equivalents are `graphify query "<question>"`, `graphify path "<A>" "<B>"`, and `graphify explain "<concept>"` - prefer these over grep for cross-module questions
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## 🔴 Supreme Review 필수 규칙 (CEO 지시, 2026-05-13)

**코드 리뷰(Supreme Review) 수행 시 반드시 Graphify 그래프를 활용해야 합니다.**

리뷰 시 필수 수행 항목:
1. **파급 반경(Blast Radius) 분석**: 변경 대상 파일을 import하는 모든 파일을 `graph.json`에서 추출하여 영향도를 정량화할 것
2. **God Node 확인**: 변경 대상이 God Node(GRAPH_REPORT.md 상위 10개)에 해당하는지 확인하고, 해당 시 추가 주의 판정
3. **의존성 경로 추적**: 변경이 다른 모듈에 전파되는 경로를 그래프에서 확인 (imports_from, calls, contains 관계)
4. **커뮤니티 교차 영향**: 변경이 여러 Community를 횡단하는지 확인하여 설계 결합도 판단

grep/파일 읽기만으로 리뷰를 완료하는 것은 **불충분**합니다. 반드시 구조적 근거를 그래프에서 도출하세요.
