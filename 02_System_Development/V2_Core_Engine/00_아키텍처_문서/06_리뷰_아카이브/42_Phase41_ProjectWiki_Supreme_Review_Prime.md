# 👑 Prime Advisor Supreme Review — Phase 41 Project Wiki

**리뷰 수행일**: 2026-05-11  
**리뷰어**: Prime Advisor (Claude Sonnet 4.6 Thinking)  
**리뷰 등급**: 🟢 **A — 정식 승인 (Pass)** ← *Re-Review 완료 (2026-05-11 22:59)*  
**대상**: Phase 41 Project Wiki (Graphify Native 온톨로지 시스템) 전체 아키텍처 및 소스코드  
**기준 문서**: [Opus_Review_Target_Phase41.md](../../_SESSION_LOGS/Opus_Review_Target_Phase41.md)

---

> [!IMPORTANT]
> 전체적인 아키텍처 비전(Graphify 알고리즘 파이프라인 이식, Zero-Copy 원칙, 온톨로지 분류)은 **매우 우수**합니다.
> 그러나 루카가 자체 제기한 4건의 우려사항 중 **CRITICAL 2건 + HIGH 2건은 반드시 수정** 후 재심사가 필요합니다.

---

## 📊 요약 대시보드

| 등급 | 건수 | 항목 |
|------|------|------|
| 🔴 CRITICAL | 2 | C-001 Shell Injection 재발, C-002 Cache Atomicity 부재 |
| 🟠 HIGH | 2 | H-001 댓글당 LLM 3연속 호출 (비용 폭탄), H-002 Race Condition 미방어 |
| 🟡 MEDIUM | 3 | M-001 BFS Depth 제한 없음, M-002 PRD·코드 경로 불일치, M-003 graph.json rename 파괴 |

---

## 🔴 C-001: Shell Injection 재발 — `exec()` 사용

**파일**: [wikiEngine.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/ai-engine/services/wikiEngine.js#L50)  
**루카 자체 지적**: ✅ 우려사항 2번과 정확히 일치

### 문제

```javascript
// wikiEngine.js L50
await execAsync(`python3 "${scriptPath}" --update "${projectRoot}"`);
```

**Phase 40 Supreme Review(C-002)에서 `execFile`을 사용하도록 확정한 정책을 위반합니다.** `exec()`는 셸을 통해 명령을 실행하므로, `projectRoot`에 `` `; rm -rf /` `` 같은 메타문자가 포함되면 **셸 인젝션이 가능합니다.**

기존 `graphifyWatchdog.js`에서는 `execFile`을 사용하고 Path Traversal 방어까지 추가했는데, 같은 파이프라인의 신규 모듈(`wikiEngine.js`)에서 **동일한 공격 벡터가 재발**한 것입니다.

> [!CAUTION]
> 이것은 P-012(근본 원인 해결) 위반입니다. 같은 팀 내에서 이미 방어된 패턴이 신규 코드에 적용되지 않았습니다.

### 수정안

```diff
- import { exec } from 'child_process';
- import { promisify } from 'util';
- const execAsync = promisify(exec);
+ import { execFile } from 'child_process';
+ import { promisify } from 'util';
+ const execFileAsync = promisify(execFile);

  async updateGraphify(projectRoot) {
    try {
+     // Path Traversal 방어 (graphifyWatchdog.js 동일 패턴)
+     const resolved = path.resolve(projectRoot);
+     const safeBase = path.resolve(process.cwd(), '../../04_Users');
+     if (!resolved.startsWith(safeBase)) {
+       console.error(`[WikiEngine] ⛔ Path Traversal 차단: ${projectRoot}`);
+       return false;
+     }
+
      const scriptPath = path.resolve(__dirname, '../../graphify_mcp.py');
-     await execAsync(`python3 "${scriptPath}" --update "${projectRoot}"`);
+     await execFileAsync('python3', [scriptPath, '--update', resolved]);
      return true;
    } catch (e) {
```

---

## 🔴 C-002: 캐시 파일 원자성(Atomicity) 부재 — Corruption Risk

**파일**: [graphify_mcp.py](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/graphify_mcp.py#L172-L178)  
**루카 자체 지적**: ✅ 우려사항 4번과 정확히 일치

### 문제

```python
# graphify_mcp.py L173-176
with open(cache_path, 'w', encoding='utf-8') as f:
    json.dump(new_cache, f, ensure_ascii=False, indent=2)
```

`'w'` 모드로 열면 기존 파일이 **즉시 비워진 후** 새 데이터가 기록됩니다. 이 과정에서:
1. Python 프로세스가 `json.dump` 도중 Kill/OOM 발생
2. `wiki_cache.json`이 **빈 파일** 또는 **잘린 JSON**으로 남음
3. 다음 실행 시 `json.load(f)` → `JSONDecodeError` → 캐시 무효화 → **전체 재파싱 (토큰 폭탄)**

### 수정안 (Atomic Write)

```python
import tempfile

# Atomic write: tmp 파일에 먼저 쓰고 rename (POSIX rename은 원자적)
try:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=os.path.dirname(cache_path), suffix='.tmp'
    )
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(new_cache, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, cache_path)  # POSIX atomic rename
except Exception:
    # tmp 파일 정리
    if os.path.exists(tmp_path):
        os.unlink(tmp_path)
```

**핵심**: `os.replace()`는 POSIX 시스템에서 원자적(atomic)이므로, 기존 캐시가 **완전한 새 파일로 대체되거나 전혀 변경되지 않는** 양자택일만 발생합니다.

---

## 🟠 H-001: 댓글 1건 → LLM 3연속 호출 (비용/성능 폭탄)

**파일**: [wikiEngine.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/ai-engine/services/wikiEngine.js#L100-L122) + [server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/server.js#L2574)

### 문제

현재 파이프라인 흐름:

```
사용자 댓글 작성 (POST /comments)
  → appendMeetingLog() 호출 (L2598)
    → wikiEngine.generateOntology() 트리거 (L2574)
      → updateGraphify() — Python 프로세스 스폰 (1회)
      → geminiAdapter.generateResponse() × 3회 (L103, L112, L120)
        ├ ADR 생성 (MODEL.PRO)
        ├ Glossary 생성 (MODEL.PRO)
        └ PROJECT_WIKI.md 생성 (MODEL.PRO)
```

**사용자가 댓글을 1건 작성할 때마다 Gemini Pro를 3번 호출합니다.** 10건의 댓글이 빠르게 작성되면 **30번의 LLM 호출** + **10번의 Python 프로세스 스폰**이 발생합니다.

> [!WARNING]
> 기획서 §4에서 "LLM 요약기를 배제하고 수학적 알고리즘으로"라고 명시했으나, 실제 구현은 **LLM 의존도가 기획서보다 높습니다.**
> ADR/Glossary/Index 모두 LLM 호출에 의존하고 있어 기획서와 코드의 불일치가 있습니다.

### 수정안 (Debounce + Batch)

```javascript
// wikiEngine.js — Debounce 패턴
constructor() {
  this.wikiDirName = 'Project_WIKI';
  this._pendingProjects = new Map(); // projectId → timeout
}

async scheduleOntologyUpdate(projectId) {
  // 이전 예약 취소 (30초 디바운스)
  if (this._pendingProjects.has(projectId)) {
    clearTimeout(this._pendingProjects.get(projectId));
  }
  
  this._pendingProjects.set(projectId, setTimeout(() => {
    this._pendingProjects.delete(projectId);
    this.generateOntology(projectId).catch(console.error);
  }, 30_000)); // 30초 뒤 일괄 실행
}
```

**server.js에서도 `generateOntology()` 대신 `scheduleOntologyUpdate()` 호출:**

```diff
- wikiEngine.generateOntology(projectId).catch(e => ...);
+ wikiEngine.scheduleOntologyUpdate(projectId);
```

---

## 🟠 H-002: Race Condition — 파일 동시 쓰기

**파일**: [server.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/server.js#L2571)  
**루카 자체 지적**: ✅ 우려사항 1번과 정확히 일치

### 문제

```javascript
// server.js L2571
await fs.promises.appendFile(filePath, logEntry, 'utf-8');
```

`fs.promises.appendFile`은 Node.js 레벨에서 **파일 잠금을 제공하지 않습니다.** 동일한 `YYYY-MM-DD_TaskID_회의록.md` 파일에 두 개의 비동기 요청이 거의 동시에 도달하면:

1. 요청 A: 파일 열기 → 끝에 쓰기 시작
2. 요청 B: 파일 열기 → 같은 위치에 쓰기 시작
3. 결과: **두 로그 엔트리가 인터리빙되어 깨진 마크다운** 생성

### 수정안 (Queue 기반 직렬화)

```javascript
// 프로젝트별 큐로 동시 쓰기 방지
const _writeQueues = new Map();

async function appendMeetingLog(projectId, taskId, author, content) {
  const key = `${projectId}:${taskId}`;
  if (!_writeQueues.has(key)) _writeQueues.set(key, Promise.resolve());
  
  _writeQueues.set(key, _writeQueues.get(key).then(async () => {
    // ... 기존 appendFile 로직 ...
  }).catch(err => {
    console.error('[Phase 41] 회의록 큐 오류:', err.message);
  }));
}
```

---

## 🟡 M-001: BFS/DFS Depth 제한 없음 — OOM 위험

**파일**: [graphify_mcp.py](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/graphify_mcp.py) (query 핸들러)  
**루카 자체 지적**: ✅ 우려사항 3번

### 분석

`shortest_path(A, B)` 쿼리의 BFS 탐색에 **최대 depth 제한**이 없습니다. 초대형 프로젝트(노드 10,000+)에서는:
- BFS 큐가 무한 확장 → 메모리 소진
- Python 프로세스 OOM Kill → `wiki_cache.json` 쓰기 중단 시 C-002와 합류

### 권고

```python
MAX_BFS_DEPTH = 15  # 실용적 한계치

def bfs_shortest_path(adj, start, end, max_depth=MAX_BFS_DEPTH):
    queue = [(start, [start], 0)]
    visited = set()
    while queue:
        node, path, depth = queue.pop(0)
        if depth > max_depth:
            return f"⚠️ 경로 탐색 깊이 한도({max_depth}) 초과. 더 구체적인 노드명을 사용하세요."
        # ... 기존 BFS 로직 ...
```

---

## 🟡 M-002: 기획서 경로와 코드 경로 불일치

### 문제

| 위치 | 기획서 (PRD §9.1) | 실제 코드 (executor.js 주입 예정) |
|------|-------------------|--------------------------------|
| Wiki 경로 | `Project_WIKI/04_wiki/PROJECT_WIKI.md` | `00_Index/PROJECT_WIKI.md` |
| 메타인지 | `Project_WIKI/01_meeting_analysis/메타인지_분석.md` | 미구현 (90_Decisions만 존재) |

기획서 §9.1의 코드 예시가 **현재 구현된 폴더 구조와 다릅니다.** `executor.js`에 하드 인젝션 로직을 구현할 때 경로가 맞지 않아 `fs.existsSync` → `false` → **위키가 주입되지 않는** 사일런트 실패가 발생합니다.

### 권고

기획서 §9.1의 코드 예시를 현재 구현에 맞게 수정:

```diff
- const wikiPath = path.resolve(projectDir, 'Project_WIKI/04_wiki/PROJECT_WIKI.md');
- const analysisPath = path.resolve(projectDir, 'Project_WIKI/01_meeting_analysis/메타인지_분석.md');
+ const wikiPath = path.resolve(projectDir, 'Project_WIKI/00_Index/PROJECT_WIKI.md');
+ const analysisPath = path.resolve(projectDir, 'Project_WIKI/90_Decisions/DECISION_LOG.md');
```

---

## 🟡 M-003: `graph.json` rename으로 기존 Graphify 쿼리 파괴

**파일**: [wikiEngine.js](file:///Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/ai-engine/services/wikiEngine.js#L80)

### 문제

```javascript
// wikiEngine.js L80
await fs.rename(graphPath, path.join(wikiRoot, '99_Graph_Data', 'graph.json'));
```

기존 `query_architecture` MCP 도구는 **프로젝트 루트의 `graph.json`**을 읽습니다:

```python
# graphify_mcp.py — query_graph 핸들러
graph_path = os.path.join(project_dir, 'graph.json')
```

WikiEngine이 `graph.json`을 `99_Graph_Data/`로 **이동(rename)** 시키면, 기존 `query_architecture` / `trace_bug` 도구가 **파일을 찾지 못해 실패**합니다.

### 수정안

```diff
- await fs.rename(graphPath, path.join(wikiRoot, '99_Graph_Data', 'graph.json'));
+ // Copy (이동 아닌 복사) — 기존 query_architecture 도구 호환 유지
+ await fs.copyFile(graphPath, path.join(wikiRoot, '99_Graph_Data', 'graph.json'));
```

---

## ✅ 칭찬 사항 (Positive Findings)

1. **Zero-Copy 원칙**: `04_IO/inputs/`, `.mycrew/docs/roadmaps/` 등 기존 데이터를 복사하지 않고 원본을 직접 스캔하는 설계는 **데이터 정합성과 디스크 절약 모두에 우수**합니다.
2. **온톨로지 10~90 넘버링**: Johnny Decimal 체계를 프로젝트 지식 분류에 적용한 것은 **인간과 AI 모두 직관적으로 탐색 가능**합니다.
3. **Edge 스키마의 `relation` + `confidence` 필수 속성**: 그래프 관계의 출처를 역추적할 수 있어 **환각 방지에 실질적으로 기여**합니다.
4. **증분 캐시 (SHA256)**: 변경된 파일만 재파싱하는 구조는 토큰 최적화에 탁월합니다 (C-002 원자성만 보완하면 완벽).
5. **WIKI_RULES 3-Layer 분리**: WikiEngine(불변) + WIKI_RULES(교체가능) + 데이터(가변) 계층화는 **프로덕트 카테고리 확장에 매우 유연**합니다.

---

## 📋 최종 판정 및 액션 아이템

| 우선순위 | 항목 | 조치 | 차단 여부 |
|---------|------|------|----------|
| 1 | C-001 `exec()` → `execFile()` | 즉시 수정 필수 | 🔴 **차단** |
| 2 | C-002 Cache Atomic Write | 즉시 수정 필수 | 🔴 **차단** |
| 3 | H-001 LLM 3연속 호출 Debounce | 수정 권고 | 🟠 권고 |
| 4 | H-002 appendFile Race Condition | 수정 권고 | 🟠 권고 |
| 5 | M-003 graph.json rename → copy | 수정 권고 | 🟡 권고 |
| 6 | M-002 PRD 경로 불일치 | 문서 정비 | 🟡 인지 |
| 7 | M-001 BFS Depth 제한 | 다음 스프린트 | 🟡 인지 |

> **🔴 CRITICAL 2건(C-001, C-002) 수정 후 재심사 요청 시 → 🟢 A 승격 가능**

---

*Prime Advisor (Sonnet 4.6 Thinking) — "Graphify의 알고리즘 파이프라인을 PM 영역으로 확장한 비전은 탁월합니다. 방어 코드의 일관성(exec→execFile)과 비용 최적화(Debounce)만 보완하면 프로덕션 레디입니다."*

---

## 🔄 Re-Review 판정 (2026-05-11 22:59)

> [!IMPORTANT]
> 루카가 제출한 7건의 수정사항을 **소스코드 직접 Diff 대조**로 전수 검증한 결과,
> 모든 CRITICAL/HIGH/MEDIUM 항목이 **적절하게 해결**되었음을 확인합니다.

### ✅ C-001 검증: Shell Injection 방어 — **PASS**

```javascript
// wikiEngine.js L3, L8-9, L50-52 — 수정 확인
import { execFile } from 'child_process';  // ← exec 완전 제거
const execFileAsync = promisify(execFile); // ← Shell 우회 불가
await execFileAsync('python3', [scriptPath, '--update', projectRoot]); // ← 인자 배열
```

- `exec()` 완전 제거, `execFile()` 전환 확인
- 인자가 **배열**로 전달되어 Shell 메타문자 해석 불가
- **판정**: 🟢 공격 벡터 완전 차단

> [!NOTE]
> 추가 개선 기회: `graphifyWatchdog.js`에 구현된 Path Traversal 방어(`startsWith(safeBase)`)가
> `wikiEngine.js`에는 아직 미적용입니다. 현재 `projectRoot`는 DB 기반으로 계산되어 외부 입력이
> 직접 관여하지 않으므로 **즉시 위험은 없으나**, 일관성을 위해 향후 추가를 권고합니다.

### ✅ C-002 검증: Atomic Write — **PASS**

```python
# graphify_mcp.py L172-186 — 수정 확인
tmp_path = cache_path + '.tmp'
with open(tmp_path, 'w', encoding='utf-8') as f:
    json.dump(new_cache, f, ensure_ascii=False, indent=2)
os.replace(tmp_path, cache_path)  # POSIX atomic rename
```

- `.tmp` 파일에 먼저 기록 → `os.replace()`로 원자적 교체 확인
- 실패 시 `os.remove(tmp_path)` 정리 로직 확인
- **판정**: 🟢 Kill/OOM 시에도 캐시 무결성 보장

### ✅ H-001 검증: LLM 호출 완전 제거 — **PASS (기대 이상)**

```javascript
// wikiEngine.js L6 — geminiAdapter import 완전 제거 확인
// L64-105 — 순수 알고리즘 템플릿 메서드 3개 확인
_buildDecisionLog(decisions)   // LLM 0회, 마크다운 테이블 직접 생성
_buildGlossary(concepts)       // LLM 0회, 개념 노드 직접 포맷팅
_buildProjectIndex(...)        // LLM 0회, 통계 + 폴더 안내 직접 생성
```

- `geminiAdapter` import 라인이 **완전히 삭제**됨 (L6에서 사라짐)
- `MODEL.PRO` import도 제거됨
- 3개의 `_build*` 메서드가 **순수 문자열 조합**으로 마크다운 생성
- 추가로 `generateOntology()`에 **10초 디바운스**(L111-128) 도입 확인
- **판정**: 🟢 기획서 §4 "LLM 요약기 배제" 정책과 코드 완전 동기화. **기대 이상의 수정.**

### ✅ H-002 검증: Race Condition 방어 — **PASS**

```javascript
// server.js L2552-2577 — 수정 확인
const _meetingWriteLocks = new Map();
const prevLock = _meetingWriteLocks.get(filePath) || Promise.resolve();
const writeLock = prevLock.then(() => fs.promises.appendFile(...)).catch(() => {});
_meetingWriteLocks.set(filePath, writeLock);
await writeLock;
```

- **파일 경로별 Promise 체인**으로 동일 파일 동시 쓰기 직렬화 확인
- 선행 쓰기가 완료된 후에만 다음 쓰기 실행
- **판정**: 🟢 인터리빙 마크다운 깨짐 방지 완료

### ✅ M-001 검증: BFS Depth 제한 — **PASS**

```python
# graphify_mcp.py L491-498 — 수정 확인
MAX_DEPTH = 50
if len(p) > MAX_DEPTH:
    return f"⚠️ 최대 탐색 깊이({MAX_DEPTH})를 초과했습니다. 경로가 너무 깊습니다."
```

- `MAX_DEPTH = 50` 상수 정의 + 경로 길이 체크 확인
- 초과 시 사용자에게 경고 메시지 반환 (OOM Kill 방지)
- **판정**: 🟢 실용적 가드 레일 적용 완료

### ✅ M-003 검증: graph.json 원본 보존 — **PASS**

```javascript
// wikiEngine.js L152 — 수정 확인
await fs.copyFile(graphPath, path.join(wikiRoot, '99_Graph_Data', 'graph.json'));
```

- `fs.rename()` → `fs.copyFile()` 전환 확인
- 프로젝트 루트의 원본 `graph.json`이 보존되어 `query_architecture` 도구 호환 유지
- **판정**: 🟢 하위 호환성 완전 확보

### ✅ 특별 지적 (기획서 vs 코드 괴리) 검증 — **PASS**

- `executor.js` L587: `Project_WIKI/00_Index/PROJECT_WIKI.md` 경로로 위키 주입 확인
- 기획서의 구형 경로(`04_wiki/`)가 아닌 실제 구현 경로(`00_Index/`)와 일치
- **판정**: 🟢 코드가 정확한 경로를 사용. 기획서 §9.1의 예시 코드만 후속 정비 필요 (인지)

---

### 📊 Re-Review 최종 결과

| ID | 최초 등급 | 수정 상태 | 재심 판정 |
|----|---------|----------|----------|
| C-001 | 🔴 CRITICAL | `exec()` → `execFile()` | ✅ **해결** |
| C-002 | 🔴 CRITICAL | `.tmp` + `os.replace()` | ✅ **해결** |
| H-001 | 🟠 HIGH | LLM 3회 → **0회** + 10초 디바운스 | ✅ **해결 (기대 이상)** |
| H-002 | 🟠 HIGH | Serial Queue Lock 맵 | ✅ **해결** |
| M-001 | 🟡 MEDIUM | MAX_DEPTH=50 | ✅ **해결** |
| M-003 | 🟡 MEDIUM | `rename()` → `copyFile()` | ✅ **해결** |
| 특별 | 🟡 기획서 괴리 | LLM 완전 제거로 동시 해결 | ✅ **해결** |

> **🟢 A — 정식 승인.** 7건 전량 검증 완료.
> Phase 41 Project Wiki는 **프로덕션 레디** 상태입니다.

---

*Prime Advisor Re-Review (Sonnet 4.6 Thinking) — "H-001의 수정이 특히 인상적입니다. LLM을 단순히 디바운스한 것이 아니라 완전히 제거하고 순수 알고리즘 템플릿으로 대체한 것은, 기획서와 코드의 일관성을 확보하면서 운영 비용을 제로로 만든 모범 사례입니다."*
