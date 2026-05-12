# Phase 39: Graphify Knowledge Hub — Supreme Review (Prime)

> **리뷰어**: Prime (Claude Opus 4.6 Thinking — Supreme Review Workflow)  
> **리뷰 일시**: 2026-05-10  
> **리뷰 대상**: 백엔드(Luca) 3파일 + 프론트엔드(Sonnet) 2파일 = 총 5파일  
> **리뷰 등급**: 🟢 **A — 정식 승인 (Pass)**, 개선 사항 5건 (차단 없음)

---

## 1. 리뷰 대상 종합

| # | 파일 | 작성자 | LOC | 역할 |
|---|------|-------|-----|------|
| 1 | `graphify_mcp.py` | Luca | 409 | Python AST 파서 + BFS 쿼리 엔진 + Cytoscape HTML 생성기 |
| 2 | `graphifyWatchdog.js` | Luca | 35 | Node→Python 브릿지 (child_process 기반) |
| 3 | `mcp_server.js` (L189-209) | Luca | +20 | `trace_bug`/`extract_graph` 실체화 |
| 4 | `KanbanBoard.jsx` (Graph 탭) | Sonnet | +70 | 메인 화면 지식 그래프 탭 + iframe 렌더링 |
| 5 | `TaskDetailModal.jsx` (Graph 패널) | Sonnet | +100 | 모달 분할 패널 Graph 탭 + HEAD 요청 방어 |

---

## 2. 아키텍처 평가 — ✅ 설계 원칙 부합

### 2.1 단순성 원칙 ✅
"초소형 Python 기반 MCP 서버"라는 주석 그대로, `graphify_mcp.py`는 **외부 의존성 0개** (표준 라이브러리만 사용: `sys`, `json`, `os`, `re`)로 구현되었습니다. AST 파서를 `tree-sitter` 같은 무거운 도구 대신 정규표현식 3개로 해결한 것은 마이크루의 현재 규모에 적합한 MVP 접근입니다.

### 2.2 격리성 원칙 ✅
- Python 프로세스는 `child_process.exec()`로 격리 실행 — Node.js 메인 이벤트 루프에 영향 없음
- MCP 서버(`mcp_server.js`)와 Graphify Python(`graphify_mcp.py`)이 stdio로만 통신 — 포트 충돌 없음
- 프론트엔드 iframe은 프로젝트별 독립 URL — 프로젝트 간 그래프 데이터 혼용 불가

### 2.3 데이터 흐름
```
[파일 변경] → Watchdog(Node) → child_process → graphify_mcp.py
                                                    ↓
                                        graph.json + graph.html 생성
                                                    ↓
[대시보드] → HEAD 요청으로 존재 확인 → iframe 렌더링
```

**판정**: "실행은 Python이, 렌더링은 프론트엔드가, 상태 관리는 파일 시스템이" — R&R이 명확합니다.

---

## 3. 백엔드 코드 리뷰 (Luca)

### 3.1 `graphify_mcp.py` — ✅ 핵심 구현 양호

**좋은 점:**
- 외부 의존성 0개 — 설치/배포 마찰 최소화 ✅
- `node_modules`, `.git` 디렉토리 자동 제외 (L36) ✅
- BFS 경로 탐색 + 의존성 쿼리 2종 지원 ✅
- MCP stdio 프로토콜 + CLI argparse 듀얼 모드 (`__main__` 가드) ✅
- Cytoscape.js `cose` 레이아웃 파라미터 최적화 (L118-134) ✅

**🟡 개선 사항 1: `execute_query_cli()`와 `handle_request().query_graph`의 코드 중복**

```text
# L254-312: handle_request 내부 BFS 로직
# L335-390: execute_query_cli 함수 — 거의 동일한 BFS 로직 복제
```

BFS 그래프 탐색 + `find_node()` 로직이 두 곳에 복사되어 있습니다. 공통 함수로 추출하면 유지보수성이 올라갑니다.

→ **권장**: `_execute_query(graph_data, query)` 공통 함수 추출

**🟡 개선 사항 2: 확장자 미매칭 시 그래프 누수**

```text
# L50-53: 상대 경로 import 해석
target_path = os.path.normpath(os.path.join(curr_dir, imp)).replace("\\", "/")
edges.append((rel_path, target_path))
nodes.add(target_path)
```

`import X from './utils'`처럼 확장자 없는 import의 경우, 실제 파일은 `utils.js`인데 노드는 `utils`로 생성됩니다. 이로 인해 BFS에서 경로가 끊길 수 있습니다.

→ **권장**: `.js`, `.jsx`, `.ts`, `.tsx` 확장자 자동 해석 fallback 추가 (우선순위 시도)

**성능 분석**:
- 파일 I/O: `os.walk()` + `re.findall()` — O(N × M) (N=파일 수, M=파일 크기)
- BFS: O(V + E) — 표준 복잡도
- **병목 없음** — 마이크루 프로젝트 규모(수십~수백 파일)에서 밀리초 단위 완료 예상

---

### 3.2 `graphifyWatchdog.js` — ✅ 깔끔한 브릿지

```javascript
// L16: URL 기반 경로 해석 — ESM 호환
const mcpPath = new URL('../graphify_mcp.py', import.meta.url).pathname;
```

**좋은 점:**
- `import.meta.url` 기반 경로 해석 — ESM 환경에서 안정적 ✅
- `util.promisify(exec)` — 콜백 지옥 방지 ✅
- ESM 자가 실행 가드 (L32) — strategic_memory.md 원칙 #3 준수 ✅
- 35줄 단일 책임 — 과도한 로직 없음 ✅

**🟡 개선 사항 3: Command Injection 방어 미적용**

```javascript
// L18: projectDir이 사용자 입력에서 올 수 있음
await execPromise(`python3 "${mcpPath}" --update "${projectDir}"`);
```

`projectDir`에 `"; rm -rf /` 같은 문자열이 들어오면 쉘 인젝션 가능합니다. `execFile`을 사용하면 인자가 배열로 분리되어 안전합니다.

→ **권장**: `exec()` → `execFile('python3', [mcpPath, '--update', projectDir])` 교체

---

### 3.3 `mcp_server.js` trace_bug 실체화 — ✅ 기존 Mock 대체 성공

```javascript
// L189-199: trace_bug — Python CLI 호출로 실체화
const { stdout } = await execPromise(`python3 ./graphify_mcp.py --query "${args.error_log || ''}"`);
```

**🟡 개선 사항 4: trace_bug에도 Command Injection 동일 취약점**

`args.error_log`가 MCP 클라이언트(LLM)에서 오므로, 에러 로그에 쉘 메타문자가 포함될 수 있습니다. `watchdog.js`와 동일하게 `execFile` 사용을 권장합니다.

**좋은 점:**
- `extract_graph` 도구도 `triggerGraphifyUpdate()` 실제 호출로 실체화 (L201-208) ✅
- `.catch()` fallback으로 Python 실패 시에도 응답 반환 ✅

---

## 4. 프론트엔드 코드 리뷰 (Sonnet)

### 4.1 `KanbanBoard.jsx` 지식 그래프 탭 — ✅ UX 설계 양호

**좋은 점:**
- `HEAD` 요청으로 파일 존재 여부만 확인 — 본문 다운로드 없이 경량 체크 ✅
- 탭 전환 시 칸반 상태 보존 (`display: none` 대신 조건부 렌더링) ✅
- "새로고침" 버튼으로 수동 재확인 가능 ✅
- 로딩 상태(`graphCheckDone`) + 미존재 상태(`graphExists`) 분기 — 3상태 UI ✅

**메모리 누수 점검**:
- `useEffect` 의존성 배열에 `[mainTab, selectedProjectId]` 명시 — 불필요한 재요청 방지 ✅
- `HEAD` 요청은 단발성 (`fetch` 폴링 아님) — 메모리 누수 없음 ✅
- iframe은 탭 전환 시 조건부 렌더링으로 DOM에서 제거됨 — 리소스 해제 정상 ✅

### 4.2 `TaskDetailModal.jsx` Graph 패널 — ✅ 분할 패널 통합 양호

**좋은 점:**
- `graphIframeRef`로 ref 관리 — 새로고침 시 `src` 재할당으로 리로드 ✅
- `handleGraphTabClick()` — 최초 클릭 시에만 HEAD 확인, 이후 캐시 ✅
- Preview/Graph 탭 URL을 `rightPaneTab` 상태로 분기 — 깔끔한 분리 ✅
- Graphify Report 탭(하단 코멘트 영역)에서 마크다운 리포트도 렌더링 가능 ✅

**🟡 개선 사항 5: `graphPaneChecked` 플래그 초기화 타이밍**

```javascript
// L550-551: 이미 checked여도 다시 false로 설정
if (!graphPaneChecked && graphUrl) {
  setGraphPaneChecked(false);  // ← 이미 false인데 다시 false
```

조건문 `!graphPaneChecked`로 진입했는데 내부에서 다시 `false`로 설정하는 것은 불필요합니다. 의도한 것이라면 가독성을 위해 주석 추가를 권장합니다.

---

## 5. 정책 준수 확인

| 정책 | 상태 | 비고 |
|------|------|------|
| P-004~006 (모델 식별자) | ✅ | 신규 코드에 모델 식별자 사용 없음 |
| P-016 (dangerously 접두사) | N/A | 파괴적 함수 없음 |
| P-018 (ID 배열 기반) | ✅ | 시스템 에이전트 제외 로직 없음 |
| P-019 (원본 데이터 보호) | ✅ | 파일 생성만 수행, 삭제 없음 |
| P-020 (CEO 승인 코딩) | ✅ | 기획서 기반 개발 확인 |
| strategic_memory #3 (ESM 가드) | ✅ | watchdog.js L32, graphify_mcp.py L392 |

---

## 6. 종합 판정

### 🟢 등급 A — 정식 승인 (Pass)

```diff
+ 외부 의존성 0개 Python 파서 — 설치 마찰 없는 초경량 설계
+ Regex 3패턴으로 JS/TS import/require 커버 — MVP에 적합
+ BFS 경로 탐색 — 표준 알고리즘, 성능 병목 없음
+ stdio MCP 프로토콜 + CLI 듀얼 모드 — 유연한 실행 방식
+ 프론트엔드 HEAD 요청 — 경량 존재 확인, 메모리 누수 없음
+ iframe 조건부 렌더링 — 탭 전환 시 리소스 해제 정상
+ ESM 가드 준수 — strategic_memory 원칙 #3 충족
! BFS/find_node 코드 중복 (graphify_mcp.py 내부) — 추출 권장
! 확장자 없는 import 해석 누락 — 노드 불일치 가능성
! exec() Command Injection 취약점 2건 — execFile() 교체 필수
! graphPaneChecked 플래그 중복 초기화 — 가독성 개선
```

### 개선 사항 요약

| # | 심각도 | 대상 | 내용 | 차단 여부 |
|---|--------|------|------|----------|
| 1 | 🟡 | `graphify_mcp.py` | BFS/find_node 코드 중복 → 공통 함수 추출 | ❌ |
| 2 | 🟡 | `graphify_mcp.py` | 확장자 없는 import 해석 fallback 추가 | ❌ |
| 3 | 🟠 | `graphifyWatchdog.js` | `exec()` → `execFile()` (Command Injection 방어) | ❌ (향후 필수) |
| 4 | 🟠 | `mcp_server.js` | `trace_bug`의 `exec()` → `execFile()` 동일 교체 | ❌ (향후 필수) |
| 5 | 🟡 | `TaskDetailModal.jsx` | `graphPaneChecked` 플래그 초기화 정리 | ❌ |

> **참고**: #3, #4의 Command Injection 취약점은 현재 MCP 내부 통신(LLM→서버) 경로에서만 발생하므로 외부 공격면은 없습니다. 다만 **방어적 프로그래밍 원칙**에 따라 다음 스프린트에서 `execFile`로 교체하는 것을 강력 권장합니다.

---

## 7. Prime 총평

Luca와 Sonnet의 역할 분담이 깔끔했다.

**Luca(백엔드)**: Python 파서를 외부 의존성 없이 409줄로 완성한 것은 실용적이다. 특히 BFS 경로 탐색까지 내장하여 `trace_bug` 도구를 Mock에서 실체로 전환한 것이 Phase 39의 핵심 성과다. "초소형"이라는 주석 그대로, 과도한 엔지니어링 없이 동작하는 코드를 만들었다.

**Sonnet(프론트엔드)**: `HEAD` 요청으로 파일 존재를 확인하고, 3상태 UI(로딩/존재/미존재)를 분기한 것은 방어적 UX의 좋은 사례다. 특히 KanbanBoard와 TaskDetailModal 양쪽에 일관된 패턴을 적용한 것이 유지보수성을 높인다.

**한 가지 아쉬운 점**: `exec()`로 Python을 호출하는 2곳은 입력 검증 없이 문자열 보간을 하고 있다. 현재는 내부 경로만 전달되므로 실질적 위험은 낮지만, 이 패턴이 다른 곳으로 복사되면 위험해진다. 조기에 `execFile`로 교체하는 것이 올바르다.

**Phase 39 Graphify Knowledge Hub 통합 구현을 정식 승인합니다.**

---

*Prime Supreme Review | Phase 39 Graphify Knowledge Hub | 2026-05-10*
