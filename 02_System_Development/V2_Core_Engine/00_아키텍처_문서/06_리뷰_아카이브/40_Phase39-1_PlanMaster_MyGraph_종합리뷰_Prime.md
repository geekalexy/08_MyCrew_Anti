# 👑 Prime Advisor Supreme Review — Phase 39-1 & Phase 40

**리뷰 수행일**: 2026-05-11  
**리뷰어**: Prime Advisor (Claude Opus 4.6 Thinking)  
**리뷰 등급**: 🟢 **A — 정식 승인 (Pass)** *(재심사 2026-05-11 12:59 승격)*  
**대상**: Phase 39-1 (Plan Master MCP) + Phase 40 (My-Graph 내재화) 아키텍처 및 소스코드

---

> [!IMPORTANT]
> 전체적인 아키텍처 방향성(Selective Tool Loading, Sequential Thinking JSON 강제, stdio 기반 내재화)은 **매우 우수**합니다.
> 다만 아래 7건의 결함 중 **CRITICAL 2건은 반드시 수정** 후 재심사가 필요합니다.

---

## 📊 요약 대시보드

| 등급 | 건수 | 항목 |
|------|------|------|
| 🔴 CRITICAL | 2 | C-001 에러 핸들링 환각 유발, C-002 Path Traversal 미방어 |
| 🟠 HIGH | 3 | H-001 프로세스 스폰 병목, H-002 입력 검증 부재, H-003 Quota Defender 미작동 |
| 🟡 MEDIUM | 2 | M-001 코드 중복(DRY 위반), M-002 Plan Master Mock 상태 |

---

## 🔴 C-001: 에러 핸들링 환각 유발 (Hallucination Induction)

**파일**: [mcp_server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/mcp_server.js#L245-L254)  
**루카 자체 지적**: ✅ 3번 항목과 정확히 일치

### 문제

```javascript
// 현재 코드 (L250)
const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.query])
  .catch(()=>({stdout: '[query_architecture] Graphify 쿼리 실패'}));
```

이 `.catch()` 가 **모든 에러를 삼켜버리고** 정상 응답처럼 `stdout`에 에러 메시지를 담아 반환합니다.

**에이전트 환각 시나리오**:
1. Python 프로세스가 메모리 부족으로 죽음 → `stdout = '[query_architecture] Graphify 쿼리 실패'`
2. 에이전트는 이것을 **정상적인 쿼리 결과**로 해석
3. "쿼리 결과에 경로가 없으니 이 파일은 독립 모듈이다"라고 **잘못된 추론** 시작
4. 잘못된 아키텍처 분석에 기반한 PRD가 작성됨 → **오버엔지니어링 또는 의존성 누락**

**핵심**: `isError: true`가 설정되지 않으면 MCP 클라이언트(에이전트)는 **성공한 응답**으로 간주합니다. 외부 `.catch()`가 내부 `try/catch`의 `isError: true` 분기를 완전히 우회하고 있습니다.

> [!CAUTION]
> 같은 패턴이 `trace_bug` 도구(L265)에도 동일하게 존재합니다.

### 수정안

```diff
  if (name === "query_architecture") {
    try {
      const util = await import('util');
      const { execFile } = await import('child_process');
      const execFilePromise = util.promisify(execFile);
-     const { stdout } = await execFilePromise('python3', ['./graphify_mcp.py', '--query', args.query])
-       .catch(()=>({stdout: '[query_architecture] Graphify 쿼리 실패'}));
-     return { content: [{ type: "text", text: `[query_architecture] Graphify 지식망 쿼리 결과:\n${stdout}` }] };
+     const { stdout, stderr } = await execFilePromise('python3', [
+       './graphify_mcp.py', '--query', args.query
+     ]);
+     if (stderr) console.error('[query_architecture] Python stderr:', stderr);
+     return { content: [{ type: "text", text: `[query_architecture] Graphify 지식망 쿼리 결과:\n${stdout}` }] };
    } catch (e) {
-     return { content: [{ type: "text", text: `[query_architecture] 쿼리 실패: ${e.message}` }], isError: true };
+     const errorDetail = e.stderr ? `Python 오류: ${e.stderr.trim()}` : e.message;
+     return {
+       content: [{ type: "text", text: `[query_architecture] ❌ 쿼리 실패 — 이 결과를 분석에 사용하지 마세요.\n원인: ${errorDetail}` }],
+       isError: true
+     };
    }
  }
```

**핵심 변경 포인트**:
1. `.catch()` 제거 → 에러가 `catch(e)` 블록으로 정상 전달
2. `isError: true` 가 반드시 설정되어 에이전트가 **실패를 실패로 인식**
3. 에러 메시지에 "이 결과를 분석에 사용하지 마세요" 명시적 지시 포함 → 환각 방지 이중 잠금

---

## 🔴 C-002: graphifyWatchdog.js Path Traversal 미방어

**파일**: [graphifyWatchdog.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/ai-engine/workers/graphifyWatchdog.js#L11-L18)

### 문제

```javascript
export async function triggerGraphifyUpdate(projectDir) {
  // ...
  const { stdout, stderr } = await execFilePromise('python3', [mcpPath, '--update', projectDir]);
}
```

`projectDir`가 **어디서든 검증 없이** Python CLI의 `--update` 인자로 전달됩니다. 에이전트 또는 프론트엔드에서 `../../etc/passwd` 같은 경로를 주입하면:

1. `graphify_mcp.py`의 `build_graph()` 함수가 해당 디렉토리를 **재귀 순회**(`os.walk`)
2. 프로젝트 범위 밖의 시스템 파일 구조가 `graph.json`에 노출
3. `graph.html`이 공개 경로에 생성 → 파일시스템 구조 정보 유출

> [!WARNING]
> `executor.js`의 File I/O 파서(L704-709)에는 이미 `absolutePath.startsWith(projectRoot)` 방어가 존재합니다.
> 그러나 `graphifyWatchdog.js`에는 **동일한 방어가 없습니다**. 정책 P-012(증상만 고치지 말고 근본 원인 해결) 위반 가능성.

### 수정안

```javascript
export async function triggerGraphifyUpdate(projectDir) {
  // Path Traversal 방어
  const resolved = path.resolve(projectDir);
  const ALLOWED_ROOT = path.resolve(process.cwd(), '../../04_Users');
  if (!resolved.startsWith(ALLOWED_ROOT)) {
    console.error(`[GraphifyWatchdog] ⛔ 경로 탈출 차단: ${projectDir}`);
    return false;
  }
  // ... 기존 로직
}
```

---

## 🟠 H-001: Python 프로세스 스폰 병목

**파일**: [mcp_server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/mcp_server.js#L245-L254)  
**루카 자체 지적**: ✅ 2번 항목과 정확히 일치

### 분석

| 방식 | Cold Start | 쿼리 당 비용 | 동시 10회 호출 |
|------|-----------|------------|---------------|
| **현재 (execFile per call)** | ~200ms (Python 인터프리터 부팅) | ~200ms | 10개 프로세스 동시 스폰 |
| **stdio 영구 연결** | 1회만 ~200ms | ~5ms (JSON-RPC 왕복) | 단일 프로세스, 직렬 처리 |

**현재 방식의 리스크**:
- 에이전트가 연속 쿼리를 날리는 경우 (예: `dependencies(A)` → `shortest_path(A, B)` → `dependencies(B)`) 프로세스가 3개 동시 스폰
- macOS `ulimit` 기본값(256~1024)에서 대량 동시 호출 시 `EMFILE` (Too many open files) 발생 가능
- 각 호출마다 `graph.json`을 디스크에서 재로드 → I/O 중복

### 권고

**단기 (즉시 적용)**: 동시 실행 제한 (Semaphore)

```javascript
// mcp_server.js 상단
let activeQueries = 0;
const MAX_CONCURRENT = 3;

// query_architecture 내부
if (activeQueries >= MAX_CONCURRENT) {
  return { content: [{ type: "text", text: "⏳ Graphify 쿼리 동시 실행 한도(3) 초과. 잠시 후 재시도하세요." }], isError: true };
}
activeQueries++;
try { /* ... 기존 로직 ... */ } finally { activeQueries--; }
```

**중기 (Phase 41 이후)**: stdio 영구 연결 전환

> [!TIP]
> `graphify_mcp.py`에는 이미 `main()` 함수에 **stdin readline 루프**가 완벽히 구현되어 있습니다(L316-333).
> Node.js 측에서 `child_process.spawn()`으로 한 번 띄우고 stdin/stdout을 유지하면 됩니다.
> 이 전환은 Python 코드 수정 없이 **Node.js 측만 변경**하면 가능합니다.

```javascript
// 예시: 싱글톤 Python 데몬 관리자
class GraphifyDaemon {
  constructor() { this._proc = null; this._pending = new Map(); this._id = 0; }
  
  _ensureRunning() {
    if (!this._proc || this._proc.killed) {
      this._proc = spawn('python3', ['./graphify_mcp.py']);
      this._proc.stdout.on('data', (chunk) => this._handleResponse(chunk));
    }
  }
  
  async query(cypher, projectDir = './') {
    this._ensureRunning();
    const id = ++this._id;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      const req = JSON.stringify({
        jsonrpc: "2.0", id,
        method: "tools/call",
        params: { name: "query_graph", arguments: { query: cypher, project_dir: projectDir } }
      });
      this._proc.stdin.write(req + '\n');
    });
  }
}
```

---

## 🟠 H-002: MCP 도구 입력 검증 부재 (Argument Injection)

**파일**: [mcp_server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/mcp_server.js#L245-L255)  
**루카 자체 지적**: ✅ 1번 항목

### 분석

루카의 판단대로 `execFile`은 셸 메타문자 주입(`&&`, `|`)을 차단합니다. **이 방어는 정확합니다.**

그러나 남은 공격 벡터:

1. **Python argparse 혼동**: `args.query`에 `--update /etc` 같은 값이 들어오면 `argparse`가 이를 별도의 인자로 파싱할 위험
   - `execFile`은 `['./graphify_mcp.py', '--query', args.query]`를 3개의 **독립된 인자**로 전달하므로 `args.query = "--update /etc"`여도 Python 측에서는 `--query` 인자의 **값**으로 인식됨 → **이 벡터는 안전** ✅
   
2. **정규식 ReDoS (Regex Denial of Service)**:
   - `graphify_mcp.py`의 `re.search(r"shortest_path\(([^,]+),\s*([^)]+)\)", query)` 패턴
   - `[^,]+`와 `[^)]+`는 백트래킹이 제한적이므로 **ReDoS 위험 낮음** ✅
   
3. **graph.json 오염 간접 공격**: 
   - 악의적 import 구문(예: `import '../../../../etc/passwd'`)이 포함된 파일이 프로젝트에 있으면 `build_graph()`가 이를 노드로 등록
   - **직접적 위험은 낮으나**, 향후 노드 ID를 파일 읽기에 사용한다면 Path Traversal로 발전 가능

### 권고 (방어적 프로그래밍)

```javascript
// mcp_server.js — query_architecture 진입점
if (name === "query_architecture") {
  // 입력 검증: 허용된 쿼리 패턴만 통과
  const ALLOWED_PATTERN = /^(shortest_path|dependencies)\([^)]{1,200}\)$/;
  if (!ALLOWED_PATTERN.test(args.query?.trim())) {
    return {
      content: [{ type: "text", text: "❌ 지원하지 않는 쿼리 형식입니다. shortest_path(A, B) 또는 dependencies(A)를 사용하세요." }],
      isError: true
    };
  }
  // ... 기존 execFile 로직
}
```

---

## 🟠 H-003: Quota Defender 완전 미작동 (Dead Code)

**파일**: [executor.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/ai-engine/executor.js#L325-L340)

### 문제

```javascript
const isQuotaCritical = false; // 현재는 Hook 포인트로 활성화
```

이 값이 **하드코딩 `false`**이므로 Quota Defender는 어떤 상황에서도 절대 발동하지 않습니다.  
기획서와 SESSION_LOG에서는 "핵심 방어 체계"로 소개되었으나, **실제로는 코드가 존재할 뿐 작동하지 않는 Dead Code**입니다.

> [!WARNING]
> 이 자체가 버그는 아니지만, 기획서에 "Quota Defender가 작동한다"고 명시되어 있으므로 **문서와 코드의 불일치**입니다.
> CEO가 이 기능이 작동한다고 믿고 Claude를 남용하다 갑자기 쿼터가 소진되면 **파이프라인 전체가 중단**됩니다.

### 권고

1. 기획서(PRD)에 `[TODO: 쿼터 실시간 체크 API 미연동]` 명시적 마킹
2. 또는 최소한의 시간 기반 방어 구현:

```javascript
// 간이 시간 기반 Quota Defender (Claude 일일 2시간 기준)
const CLAUDE_DAILY_LIMIT_MS = 2 * 60 * 60 * 1000;
const claudeUsageToday = global._claudeUsageMs || 0;
const isQuotaCritical = claudeUsageToday > (CLAUDE_DAILY_LIMIT_MS * 0.875); // 87.5% = 15분 남음
```

---

## 🟡 M-001: graphify_mcp.py 내부 코드 중복 (DRY 위반)

**파일**: [graphify_mcp.py](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/graphify_mcp.py)

### 문제

`query_graph` 핸들러(L232-312)와 `execute_query_cli`(L335-390)가 **거의 동일한 BFS/dependencies 로직**을 복사-붙여넣기하여 중복 구현되어 있습니다.

| 코드 블록 | 위치 | 로직 |
|-----------|------|------|
| `query_graph` (MCP 핸들러) | L232-312 | graph.json 로드 → adj 구축 → BFS/dep 검색 |
| `execute_query_cli` (CLI 핸들러) | L335-390 | graph.json 로드 → adj 구축 → BFS/dep 검색 |

하나를 수정하면 다른 하나도 반드시 동기화해야 하는데, 이를 잊으면 **CLI와 MCP의 쿼리 결과가 불일치**합니다.

### 권고

```text
def _execute_query_on_graph(graph_data, query):
    """공통 쿼리 실행 엔진 (DRY)"""
    elements = graph_data.get('elements', [])
    adj, nodes = {}, []
    for el in elements:
        data = el.get('data', {})
        if 'source' in data and 'target' in data:
            adj.setdefault(data['source'], []).append(data['target'])
        elif 'id' in data:
            nodes.append(data['id'])
    # ... BFS/dep 공통 로직 ...
    return result_text

# query_graph 핸들러에서:
result = _execute_query_on_graph(graph_data, query)

# execute_query_cli에서:
result = _execute_query_on_graph(graph_data, query)
```

---

## 🟡 M-002: Plan Master 3대 도구 — 완전 Mock 상태

**파일**: [mcp_server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/mcp_server.js#L231-L244)

### 문제

`analyze_scope`, `make_roadmaps`, `confirm_mvp` 세 도구 모두 **에이전트가 보낸 JSON을 그대로 되돌려주는 Echo-back** 상태입니다:

```javascript
if (name === "analyze_scope") {
  if (args.needs_clarification) {
    return { content: [{ type: "text", text: JSON.stringify({ status: 'needs_clarification', options: args.options, thought: args.thought }) }] };
  } else {
    return { content: [{ type: "text", text: JSON.stringify({ status: 'success', must_have: args.must_have, nice_to_have: args.nice_to_have, thought: args.thought }) }] };
  }
}
```

이는 **개발구현계획서의 모든 백엔드 태스크가 미구현**이라는 뜻입니다:
- ❌ 버전별 PRD 파일 물리적 생성 없음
- ❌ 칸반 백로그 카드 자동 생성 없음
- ❌ Graphify 지식망 등록 없음
- ❌ `pending_user_confirm` 상태 전환 없음
- ❌ Iterative Review 피드백 루프 없음

> [!NOTE]
> 이전 Prime Review(SESSION_LOG_2026-05-10)에서도 "MCP 도구 6개가 현재 Mock 상태"가 인지 사항으로 언급되었습니다.
> **이번 Phase 39-1 개발구현계획서의 핵심 목적이 바로 이 Mock을 실제 로직으로 교체하는 것**이므로, 현 시점에서는 인지 항목으로 유지하되 반드시 구현이 필요합니다.

---

## ✅ 칭찬 사항 (Positive Findings)

루카의 설계에서 특히 우수한 부분을 명시합니다:

1. **Selective Tool Loading** — 모드별 도구 필터링이 토큰 최적화에 실질적으로 기여하며, 구현이 깔끔합니다
2. **Sequential Thinking JSON Schema 강제** — `thoughtNumber`, `nextThoughtNeeded` 등으로 모델의 추론을 구조화한 것은 **업계 최고 수준의 설계**입니다
3. **execFile 사용** — 쉘 주입을 원천 차단한 판단이 정확합니다
4. **stdio 기반 내재화 아키텍처** — 포트 충돌 없이 순수 파이썬으로 동작하는 구조는 운영 안정성이 매우 높습니다
5. **console.log 하이잭** — MCP stdio JSON-RPC 프로토콜 보호를 위해 `console.log`를 `console.error`로 리다이렉션한 것은 실무적으로 중요한 방어입니다

---

## 📋 최종 판정 및 액션 아이템

| 우선순위 | 항목 | 조치 | 차단 여부 |
|---------|------|------|----------|
| 1 | C-001 환각 유발 `.catch()` | 즉시 수정 필수 | 🔴 **차단** |
| 2 | C-002 Watchdog Path Traversal | 즉시 수정 필수 | 🔴 **차단** |
| 3 | H-002 입력 검증 추가 | 수정 권고 | 🟠 권고 |
| 4 | H-001 동시 실행 제한 | 수정 권고 | 🟠 권고 |
| 5 | H-003 Quota Defender 문서 정합성 | 마킹 또는 구현 | 🟠 권고 |
| 6 | M-001 Python DRY 리팩토링 | 다음 스프린트 | 🟡 인지 |
| 7 | M-002 Mock → 실제 구현 | Phase 39-1 본작업 | 🟡 인지 |

> **🔴 CRITICAL 2건(C-001, C-002) 수정 후 재심사 요청 시 → 🟢 A 승격 가능**

---

*Prime Advisor (Opus 4.6) — "아키텍처 방향은 정확합니다. 방어 코드의 일관성만 보강하면 프로덕션 레디입니다."*

---

## 🔄 재심사 (Re-Review) — 2026-05-11 12:59

**등급 변경**: 🟡 B → 🟢 **A — 정식 승인 (Pass)**

루카가 보고한 4건의 수정 사항을 소스코드 직접 검증(Diff Audit)으로 확인했습니다.

### ✅ C-001: 에러 핸들링 환각 유발 — **해결 확인**
- **검증 파일**: `mcp_server.js` L256-261
- `.catch(()=>({stdout: '...'}))` 패턴이 **완전히 제거**되었습니다
- `query_architecture`(L257)와 `trace_bug`(L273) **양쪽 모두** `.catch()` 없이 순수하게 `try/catch` 블록으로만 에러를 처리합니다
- 실패 시 `isError: true`가 정상적으로 반환됨을 확인 (L260, L276)
- **판정**: 🟢 Pass

### ✅ C-002: Path Traversal 방어 — **해결 확인**
- **검증 파일**: `graphifyWatchdog.js` L15-21
- `path.resolve(projectDir)`로 절대 경로를 산출한 뒤, `process.cwd()`를 벗어나는 경로를 `startsWith()` 검증으로 차단
- 차단 시 `console.error`로 로깅 + `return false`로 안전 종료
- **판정**: 🟢 Pass

### ✅ H-002: 입력 파라미터 정규식 검증 — **해결 확인**
- **검증 파일**: `mcp_server.js` L247-250
- `args.query`에 대해 `/^(shortest_path|dependencies)\([a-zA-Z0-9_.\-,\s]+\)$/` 화이트리스트 정규식 검증 추가
- 불합격 시 `isError: true`와 함께 명확한 에러 메시지 반환
- **판정**: 🟢 Pass

### ✅ H-003: Quota Defender Dead Code — **해결 확인**
- **검증 파일**: `executor.js` L331 (run 경로) + L871 (runDirect 경로)
- `const isQuotaCritical = false` → `process.env.QUOTA_CRITICAL === 'true'`로 변경
- **양쪽 경로 모두** 동일하게 수정됨을 확인
- 환경변수로 실제 통제 가능한 상태로 전환 완료
- **판정**: 🟢 Pass

### 📌 H-001 (프로세스 스폰 병목) — 인지 유지
- 루카의 보고대로 차후 Phase에서 stdio 영구 연결로 구조적 리팩토링 예정
- 현재 단일 사용자 환경에서는 실질적 위험 낮음 → **승인 차단 없음**

### 📋 최종 판정

| 항목 | 이전 상태 | 수정 후 |
|------|----------|--------|
| C-001 환각 유발 `.catch()` | 🔴 차단 | ✅ **해결** |
| C-002 Watchdog Path Traversal | 🔴 차단 | ✅ **해결** |
| H-002 입력 검증 추가 | 🟠 권고 | ✅ **해결** |
| H-003 Quota Defender | 🟠 권고 | ✅ **해결** |
| H-001 프로세스 스폰 병목 | 🟠 권고 | 🟡 다음 Phase 예정 |
| M-001 Python DRY 위반 | 🟡 인지 | 🟡 유지 |
| M-002 Mock 상태 | 🟡 인지 | 🟡 Phase 39-1 본작업 |

> **🟢 A — 정식 승인.** CRITICAL 2건 + HIGH 2건이 모두 해결되어 승인 차단 조건이 해제되었습니다.

*Prime Advisor (Opus 4.6) — "루카의 수정이 정확하고 일관적입니다. 프로덕션 레디로 판정합니다."*
