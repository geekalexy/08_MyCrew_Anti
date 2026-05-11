# 👑 Prime Advisor Supreme Review — Phase 39 + Phase 41 통합 (재심)

**리뷰 수행일**: 2026-05-12  
**리뷰어**: Prime Advisor (Claude Sonnet 4.6 Thinking) — **Deep Red-Team Mode**  
**리뷰 등급**: 🟡 **B — 조건부 승인 (Conditional Pass)**  
**대상**: Phase 39 (Plan Master 상태 관리·보안), Phase 41 (MyCrew Wiki Graphify 엔진), V1/V2 폴더 구조 개편  
**리뷰 요청서**: [45_Phase39_Phase41_리뷰요청서_Luca.md](45_Phase39_Phase41_리뷰요청서_Luca.md)

---

> [!CAUTION]
> 이전 리뷰에서 **CRITICAL 1건, HIGH 3건을 간과**한 사실이 확인되었습니다.
> 본 재심에서는 코드 경로를 라인 단위로 추적하여 6건의 신규 결함을 도출했습니다.
> CRITICAL 1건은 반드시 수정 후 재심사를 받아야 합니다.

---

## 📊 요약 대시보드

| 등급 | ID | 항목 | 상태 |
|------|-----|------|------|
| 🔴 CRITICAL | **C-003** | `trace_bug` 입력 검증 누락 — Argument Injection | ❌ 수정 필요 |
| 🟠 HIGH | **H-003** | `analyze` 라우트 `.substring()` Null Crash | ❌ 수정 필요 |
| 🟠 HIGH | **H-004** | `generate_graph_html` Stored XSS via graph data | ❌ 수정 필요 |
| 🟠 HIGH | **H-005** | `_meetingWriteLocks` Map 메모리 누수 | ❌ 수정 필요 |
| 🟡 MEDIUM | **M-004** | System Graph 절대 경로 하드코딩 | ⚠️ 인지 |
| 🟡 MEDIUM | **M-005** | `is_system` 모드 하드코딩 폴더 예외 | ⚠️ 인지 |
| ✅ PASS | - | Phase 39 DB 이관 + sanitizeScope + MAX_REVISIONS | ✅ |
| ✅ PASS | - | Phase 41 기존 7건 패치 (C-001/C-002/H-001/H-002/M-001/M-003) | ✅ |

---

## 🔴 CRITICAL — 즉시 수정 필수

### C-003: `trace_bug` 도구 입력 검증 완전 누락 — Argument Injection

**파일**: [mcp_server.js L368-379](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/mcp_server.js#L368)

```javascript
if (name === "trace_bug") {
  try {
    const util = await import('util');
    const { execFile } = await import('child_process');
    const execFilePromise = util.promisify(execFile);
    
    // ❌ args.error_log에 대한 정규식 검증이 전혀 없음!
    const { stdout } = await execFilePromise('python3', [
      './graphify_mcp.py', '--query', args.error_log || ''
    ]);
```

**공격 벡터 분석**:

`query_graph` 도구(L344-345)에는 정규식 화이트리스트 검증이 적용되어 있습니다:
```javascript
// query_graph — ✅ 방어됨
if (!/^(shortest_path|dependencies)\([a-zA-Z0-9_.\-,\s]+\)$/.test(args.query.trim()))
```

그러나 **동일한 `graphify_mcp.py --query`를 호출**하는 `trace_bug` 도구에서는 `args.error_log`가 **어떤 검증도 거치지 않고** 그대로 Python 프로세스의 인자로 전달됩니다.

`execFile()`이므로 Shell Injection은 차단되지만, Python의 `argparse`가 `--query` 값으로 받은 문자열을 `re.search()`로 파싱합니다. 
악의적인 정규식 패턴(예: `(a+)+$` 류)이 `error_log`에 주입될 경우 **ReDoS(Regular Expression Denial of Service)** 공격이 가능합니다.

또한, `error_log`에 `--update /etc` 같은 argparse 옵션 충돌 인자를 삽입하면 **예상치 못한 경로에서 그래프 빌드가 트리거**될 수 있습니다.

**처방**:
```javascript
// trace_bug에도 query_graph와 동일한 화이트리스트 적용
if (name === "trace_bug") {
  const sanitizedLog = (args.error_log || '').replace(/[^a-zA-Z0-9_.\-,\s()\/:]/g, '').slice(0, 500);
  if (!sanitizedLog) {
    return { content: [{ type: "text", text: "[trace_bug] 에러 로그가 비어있습니다." }], isError: true };
  }
  // ...execFilePromise('python3', ['./graphify_mcp.py', '--query', sanitizedLog]);
}
```

**심각도 근거**: `execFile`로 Shell은 차단되지만, Python 측 argparse/regex 파서에 대한 2차 공격 벡터가 열려 있음. `query_graph`에는 적용된 방어가 `trace_bug`에는 빠진 것은 **방어 일관성 위반**이므로 CRITICAL.

---

## 🟠 HIGH — 수정 권고 (서비스 안정성 직결)

### H-003: `/plan-master/analyze` 라우트 Null Crash

**파일**: [server.js L3338-3340](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/server.js#L3338)

```javascript
const { requirements, deadline } = req.body;
try {
  broadcastLog('info', `[Plan Master] 스코프 분석 시작 (요구사항: ${requirements.substring(0, 30)}...)`, ...);
```

**결함**: `req.body.requirements`가 `undefined` 또는 `null`일 경우, `.substring(0, 30)` 호출 시 **`TypeError: Cannot read properties of undefined (reading 'substring')`**이 발생하여 서버가 500 에러를 반환합니다.

이 에러는 `try/catch`에 잡히므로 서버 크래시는 아니지만, 에러 메시지가 `err.message`로 클라이언트에 노출됩니다. 더 중요한 건 `systemPrompt` 안에서도 `${requirements}`가 그대로 삽입되므로, `requirements`가 `undefined`인 경우 프롬프트에 `"undefined"`라는 문자열이 삽입되어 LLM 환각의 원인이 됩니다.

**처방**:
```javascript
const requirements = req.body.requirements || '';
const deadline = req.body.deadline || '';
if (!requirements.trim()) {
  return res.status(400).json({ error: '요구사항(requirements)은 필수입니다.' });
}
```

---

### H-004: `generate_graph_html` Stored XSS

**파일**: [graphify_mcp.py L299](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/graphify_mcp.py#L299)

```python
html_content = html_content.replace("GRAPH_DATA_PLACEHOLDER", json.dumps(graph_data))
```

**결함 분석**:

그래프 데이터의 노드 `label`과 `id`는 **파일 이름과 마크다운 헤더에서 직접 추출**됩니다:

```python
# L38 — 마크다운 헤더가 그대로 노드 ID가 됨
headers = re.findall(r'^(#{1,3})\s+(.+)$', content, re.MULTILINE)
topic_node = f"Section::{h_text.strip()}"  # h_text가 label로 사용
```

만약 마크다운 파일에 다음과 같은 헤더가 존재하면:
```markdown
## </script><script>alert('XSS')</script>
```

이 문자열이 `json.dumps()`를 통해 HTML의 `<script>` 블록 안에 삽입됩니다. `json.dumps()`는 `<`, `>` 등을 이스케이프하지 않으므로, 사용자가 `graph.html`을 브라우저에서 열면 **Stored XSS가 실행**됩니다.

**처방**:
```python
# json.dumps에 ensure_ascii=True를 사용하여 non-ASCII 및 특수문자 이스케이프
# 또는 별도 이스케이프 적용
import html
safe_json = json.dumps(graph_data).replace("</", "<\\/")  # Script breaking 방지
html_content = html_content.replace("GRAPH_DATA_PLACEHOLDER", safe_json)
```

**심각도 근거**: 내부 도구이므로 외부 공격 표면은 제한적이나, 사용자 프로젝트의 마크다운 파일을 스캔하는 구조상 **신뢰할 수 없는 입력**이 HTML에 삽입되는 경로가 존재합니다.

---

### H-005: `_meetingWriteLocks` Map 메모리 누수

**파일**: [server.js L2553-2576](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/server.js#L2553)

```javascript
const _meetingWriteLocks = new Map();
// ...
const prevLock = _meetingWriteLocks.get(filePath) || Promise.resolve();
const writeLock = prevLock.then(() => fs.promises.appendFile(...)).catch(() => {});
_meetingWriteLocks.set(filePath, writeLock);
```

**결함 분석**:

파일 경로는 **날짜 + TaskId** 기반으로 생성됩니다 (L2567):
```javascript
const fileName = `${dateStr}_Task${taskId}_회의록.md`;
```

매일 새로운 파일이 생성되고, 각 파일 경로가 Map의 키로 등록됩니다. 그러나 **완료된 Lock 엔트리를 삭제하는 로직이 없습니다.** 서버가 장기 운영되면 Map에 수천 개의 `resolved Promise` 참조가 누적됩니다.

Node.js의 `Promise`는 resolved 상태라도 GC 대상이 되려면 외부 참조가 제거되어야 하는데, Map이 참조를 유지하므로 **메모리 누수**가 발생합니다.

**처방**:
```javascript
const writeLock = prevLock
  .then(() => fs.promises.appendFile(filePath, logEntry, 'utf-8'))
  .catch(() => {})
  .finally(() => {
    // 현재 Lock이 최신이면 정리
    if (_meetingWriteLocks.get(filePath) === writeLock) {
      _meetingWriteLocks.delete(filePath);
    }
  });
```

---

## 🟡 MEDIUM — 인지 (차단 아님)

### M-004: System Graph 절대 경로 하드코딩

**파일**: [mcp_server.js L354-356](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/mcp_server.js#L354)

```javascript
const targetDir = isSystemScope 
  ? '/Users/alex/Documents/08_MyCrew_Anti/07_MyCrew_Wiki/99_System_Graph'  // ❌ 하드코딩
  : './';
```

특정 사용자의 로컬 절대 경로가 하드코딩. 팀 확장 또는 배포 시 즉시 장애 유발. 환경 변수화 권고.

### M-005: `is_system` 모드 하드코딩 폴더 예외

**파일**: [graphify_mcp.py L108-110](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/graphify_mcp.py#L108)

```python
if is_system:
    if '04_Users' in root or '06_소시안자료' in root or '채널분석' in root or '/outputs' in root:
        continue
```

프로젝트 고유 폴더명이 엔진 코드에 하드코딩. `.mycrewignore` 파일 기반 전환 권고. (루카 자체 인지 완료)

---

## ✅ 기존 패치 검증 — 전량 PASS

이하 항목은 이전 세션(Phase 41 Supreme Review)에서 검증된 7건이 V2 코드에도 반영되었음을 재확인합니다.

| ID | 지적 사항 | V2 코드 상태 |
|----|----------|-------------|
| C-001 | `exec()` → `execFile()` | ✅ [wikiEngine.js L3](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/ai-engine/services/wikiEngine.js#L3) |
| C-002 | 캐시 Atomic Write | ✅ [graphify_mcp.py L207](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/graphify_mcp.py#L207) |
| H-001 | LLM 3회 → 0회 | ✅ `geminiAdapter` import 완전 삭제 |
| H-002 | appendFile Race Condition | ✅ Serial Queue Lock 맵 (단, H-005 메모리 누수 신규 도출) |
| M-001 | BFS Depth 무제한 | ✅ MAX_DEPTH=50 양쪽 |
| M-003 | graph.json rename 파괴 | ✅ `copyFile()` |
| 특별 | 기획서 vs 코드 괴리 | ✅ LLM 완전 제거로 동시 해결 |

### Phase 39 검증 — 전량 PASS

| 항목 | 상태 |
|------|------|
| `plan_master_status` projects 이관 | ✅ [database.js L302-309](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/database.js#L302) |
| `sanitizeScope` Prompt Injection 방어 | ✅ [mcp_server.js L24-32](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/mcp_server.js#L24) |
| `MAX_REVISIONS = 5` 루프 가드 | ✅ [mcp_server.js L17, L321](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/mcp_server.js#L17) |
| P-006 `MODEL.*` 상수 교체 | ✅ `MODEL.ANTI_GEMINI_PRO_HIGH` 등 확인 |
| V1/V2 폴더 격리 | ✅ `V1_Legacy/` + `V2_Core_Engine/` 완전 분리 |

---

## ⚖️ 루카 자체 지적 4건에 대한 Prime 응답

### 1. Plan Master Lock-on 동시성 문제

**평가**: 🟡 현재 구조에서 즉각적 위험은 **낮음**.
- `projects.plan_master_status`가 SSOT이며, `.locked` 파일은 보조 마커
- SQLite의 `db.run()`은 단일 프로세스 내에서 직렬 실행
- 다만 `BEGIN TRANSACTION` 래핑이 없으므로 DB Update + File I/O 간 크래시 시 불일치 가능
- **권고**: DB를 SSOT로 유지하되, `.locked` 파일 생성 실패 시에도 기능적으로 문제없도록 `.locked` 의존 로직이 없는지 확인 필요

### 2. MCP stdio 파이프 타임아웃 우려

**평가**: 🟢 현재 아키텍처에서 **문제없음**.
- `graph.html` 생성은 `build_graph()` → `generate_graph_html()` 동기 호출 체인
- MCP stdio 통신은 `query` 명령 시에만 사용되며, `--update`는 `wikiEngine.js`에서 `execFileAsync`로 호출
- I/O 블로킹이 길어져도 stdio가 아닌 프로세스 종료 기반이므로 타임아웃은 `execFile` 레벨에서 관리
- **권고**: 대규모 프로젝트 시 `execFileAsync`에 `timeout` 옵션(예: 60초) 추가를 추천

### 3. MAX_DEPTH 적정성

**평가**: 🟢 **적절함**.
- BFS에서 depth 50은 50-hop 이상 떨어진 노드간 경로를 탐색하는 상한
- 실제 코드 의존성 그래프에서 50-hop은 극히 비정상적인 순환 참조 상황에서만 발생
- BFS의 visited set이 재방문을 막으므로 depth보다는 **노드 수**가 메모리 상한을 결정
- **권고**: 방어 레이어를 하나 더 추가하려면 `visited` set 크기에도 상한(예: 10,000)을 거는 것을 고려

### 4. V1/V2 폴더 격리 완전성

**평가**: 🟡 `.mycrewignore` 기반 설계 권고에 동의 (M-005에서 이미 도출).

---

## 📋 최종 판정

| 카테고리 | 판정 | 비고 |
|---------|------|------|
| Phase 39 DB·보안 | ✅ PASS | 파라미터화 쿼리, sanitizeScope, MAX_REVISIONS |
| Phase 41 기존 패치 7건 | ✅ PASS | V2 전량 반영 확인 |
| 폴더 V1/V2 격리 | ✅ PASS | 완전 분리 |
| **C-003 trace_bug 무방비** | 🔴 **FAIL** | query_graph 대비 방어 일관성 위반 |
| H-003 analyze Null Crash | 🟠 수정 필요 | `.substring()` 가드 누락 |
| H-004 graph.html XSS | 🟠 수정 필요 | `</script>` 탈출 미차단 |
| H-005 WriteLock 누수 | 🟠 수정 필요 | `.finally()` 정리 누락 |
| M-004 하드코딩 경로 | 🟡 인지 | 환경 변수화 권고 |
| M-005 하드코딩 폴더 예외 | 🟡 인지 | `.mycrewignore` 전환 권고 |

---

> **🟡 B — 조건부 승인.** 기존 7건 패치와 Phase 39 보안은 PASS이나,
> **C-003 (trace_bug 입력 검증 누락)**이 반드시 수정되어야 A 등급 승격이 가능합니다.
> H-003/H-004/H-005도 프로덕션 배포 전 수정을 강력 권고합니다.

### 🛠️ A 등급 승격 조건

1. **[필수] C-003**: `trace_bug`에 `query_graph`와 동일 수준의 입력 검증 적용
2. **[필수] H-003**: `requirements` null 가드 추가
3. **[권고] H-004**: `graph.html`의 `</script>` 이스케이프 처리
4. **[권고] H-005**: `_meetingWriteLocks` Map에 `.finally()` 정리 로직 추가

---

*Prime Advisor Re-Review (Sonnet 4.6 Thinking) — "이전 리뷰에서 `trace_bug`의 검증 누락을 간과한 것은 `query_graph`에만 집중한 편향 검증의 결과입니다. 동일한 `graphify_mcp.py --query`를 호출하는 두 도구 사이에 방어 수준의 불일치가 존재하는 것은 Architecture-level Inconsistency이며, 이는 시스템의 최약 링크(weakest link)가 됩니다. trace_bug 수정 완료 시 즉시 A등급을 부여할 수 있습니다."*
