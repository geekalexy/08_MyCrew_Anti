# [Supreme Review Target] Phase 41 - Project Wiki (Graphify Native) 

## 1. 개요 및 설계 의도
MyCrew 시스템의 위키 아키텍처를 기존 단순 LLM 요약 방식에서 **수학적 Graph 기반 온톨로지(Ontology) 라우팅 시스템**으로 전면 전환했습니다.
Python(`graphify_mcp.py`)을 활용해 마크다운 및 코드 파일에서 Node(Concept, Decision, Section 등)와 Edge(Relation, Confidence)를 추출하고, Node.js(`wikiEngine.js`)가 이를 비즈니스 도메인별 폴더(10~90)로 엑스포트(Export)하도록 설계되었습니다. 또한, 채팅 로그가 자동으로 회의록으로 덤프되고 증분 해시(Incremental Hash) 캐싱이 적용되었습니다.

## 2. 변경된 주요 아키텍처 및 로직 (검토 대상)

### 2.1. Python Graph 추출 엔진 (`graphify_mcp.py`)
- Incremental 해시 캐싱 (`wiki_cache.json`) 적용. 변경된 파일의 해시값만 비교해 파싱 비용 최소화.
- 마크다운 파서: `[결정사항]`, `[[Concept]]` 위키 링크, `### Section` 헤더 기반 NetworkX 구조의 딕셔너리 추출.

### 2.2. Node.js 온톨로지 라우터 (`wikiEngine.js`)
- `exec('python3 ./graphify_mcp.py --update')` 서브프로세스 실행 및 결과 수집.
- `10_Product`, `20_Domain`, `90_Decisions` 등 온톨로지 폴더 생성 및 라우팅.
- Gemini LLM을 통한 Graph Node 군집화 기반 마크다운 변환 및 `DECISION_LOG.md` Export.

### 2.3. 회의록 덤프 로직 (`server.js`의 `appendMeetingLog`)
- 사용자와 에이전트의 대화가 발생할 때마다 `Project_WIKI/raw/meetings/YYYY-MM-DD_TaskID_회의록.md` 에 물리적 Append 저장.
- 파일 저장 직후 `wikiEngine.generateOntology()`를 백그라운드 비동기로 트리거.

### 2.4. Zero-Hallucination 프롬프트 주입 (`executor.js`)
- 에이전트 시스템 프롬프트 조립 시, `00_Index/PROJECT_WIKI.md` 구조를 맨 처음 읽도록 강제 인젝션 (`Read Graph First` 패턴).

---

## 3. 작업자(Luca) 자체 우려사항 및 엣지 케이스 (Red Teaming 포인트)

1. **동시성(Concurrency) 및 Race Condition 병목**
   - 채팅(`server.js`)이 빈번하게 발생할 경우, `appendMeetingLog`가 짧은 간격으로 여러 번 호출됩니다. 이때 `fs.appendFile` 및 Python의 `wiki_cache.json` Read/Write 시 파일 락(Lock) 충돌이 발생할 우려가 있습니다.
2. **명령어 주입(Command Injection) 방어 확인**
   - `wikiEngine.js`나 MCP 툴에서 `exec`로 `python3` 스크립트를 호출할 때, `projectDir` 변수가 외부 입력으로 조작될 경우 Path Traversal 또는 Shell Injection이 완벽히 방어되고 있는지 재검증이 필요합니다.
3. **Graph 순환 참조 루프 및 OOM (Out of Memory) 방어**
   - 쿼리 `shortest_path(A,B)`를 탐색할 때 큐를 사용한 DFS/BFS 사이클 방지 처리는 되어있으나, 초대형 프로젝트에서 최대 Depth 제한(Limit)이 없어 OOM이나 타임아웃 뻗음(Hang) 가능성을 검토해 주십시오.
4. **증분 캐시 업데이트 (Incremental Cache)의 원자성(Atomicity)**
   - Python 스크립트가 `wiki_cache.json`을 덮어쓰는(`json.dump`) 도중 에이전트 프로세스가 종료(Kill)될 경우 캐시 파일이 깨질(Corrupted) 수 있습니다. `tmp` 파일을 활용한 Atomic Write 등의 보완이 필요한지 검토 바랍니다.

---

**[Prime Advisor 지시사항]**
위 설계 명세서와 구현된 코드를 바탕으로, **Prime Advisor(Opus/Sonnet)**로서 해당 아키텍처의 보안적 결함, 리소스 한계점(메모리 누수 등), 그리고 더 나은 Best Practice 대안을 비판적으로 도출해 주십시오.
특히 Luca가 자체적으로 제기한 **4가지 우려사항**을 집중적으로 검증하여 Refactoring 전략을 수립해 주십시오.
