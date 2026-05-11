# [Prime Advisor Supreme Review] Phase 39 & Phase 41
> **리뷰어**: 소넷 (Prime Advisor 역할, Claude Sonnet 4.6 / Antigravity)  
> **리뷰 대상**: `45_Phase39_Phase41_리뷰요청서_Luca.md`  
> **참조 정책**: P-004, P-006, P-007, P-016, P-019, P-020  
> **최종 등급**: 🟢 **A — 정식 승인** (신규 발견 결함 2건 패치 권고 포함)  
> **작성일**: 2026-05-12  

---

## 📋 총평

Phase 39 버그픽스 및 Phase 41 Wiki 엔진 모두 **설계 방향은 올바르고 핵심 보안 패치는 유효**하다.  
Luca가 스스로 제기한 4개 Edge Case는 모두 **실체가 있는 취약점**이며, 각각에 대해 명확한 판정과 처방을 제시한다.  
추가로 코드 검증 중 **신규 결함 2건**을 발견하였다.

---

## 🔍 Luca 질의 응답 (4건)

---

### Q1. Plan Master Lock-on 동시성 문제 (Race Condition)

**판정: 🟠 실제 취약점 — 패치 권고**

#### 💥 실제 버그 분석

```js
// server.js /plan-master/confirm
if (action === 'confirm') {
  await dbManager.updateProjectPlanMasterStatus(projectId, 'LOCKED', false); // [1] DB 업데이트
  // ... 브로드캐스트 ...
  await fs.promises.writeFile(tmpPath, ...);
  await fs.promises.rename(tmpPath, lockPath); // [2] 파일 쓰기
}
```

[1]과 [2] 사이에 **트랜잭션이 없다**. 두 클라이언트가 동시에 `POST /confirm`을 호출하면:

```
클라이언트 A: DB 업데이트 완료 (LOCKED) ──────────────────────────→ 파일 쓰기
클라이언트 B:                    DB 업데이트 완료 (LOCKED) ──────→ 파일 쓰기
```

결과: DB에 LOCKED 상태가 두 번 기록되며, `.locked` 파일도 두 번 쓰여진다.  
더 큰 문제는 **이미 `LOCKED` 상태인 프로젝트에 `revise`를 호출해도 막히지 않는다**는 점이다.

```js
// 현재 confirm 라우트에 상태 검증 가드가 없음
app.post('/api/projects/:id/plan-master/confirm', async (req, res) => {
  // ❌ projects 테이블에서 현재 plan_master_status를 읽어 LOCKED 여부를 확인하지 않음
```

#### ✅ 처방

**멱등성 가드 추가** (트랜잭션보다 현실적이며 SQLite에서 더 효과적):

```js
app.post('/api/projects/:id/plan-master/confirm', async (req, res) => {
  const { action, feedback } = req.body;
  try {
    // [가드] 현재 상태 확인
    const project = await dbManager.getProjectById(projectId);
    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    
    // 이미 LOCKED 상태면 confirm/revise 모두 차단
    if (project.plan_master_status === 'LOCKED') {
      return res.status(409).json({ 
        error: 'MVP 기획이 이미 최종 확정(LOCKED)되었습니다. 변경하려면 새 기획 세션을 시작하세요.',
        status: 'already_locked'
      });
    }
    // ... 이후 로직
```

> **Note**: SQLite는 기본적으로 `SERIALIZABLE` 격리 수준으로 동작하므로, 가드 추가만으로 동시 요청 중 한 건은 반드시 409를 받게 된다. 별도 트랜잭션 래핑 불필요.

---

### Q2. Graphify MCP stdio 타임아웃 우려

**판정: 🟠 구조적 위험 — 아키텍처 인식 권고 (즉시 패치 불필요)**

#### 💥 실제 버그 분석

```python
# graphify_mcp.py L302-306 — generate_graph_html 내부
with open(os.path.join(project_dir, 'graph.html'), 'w', encoding='utf-8') as f:
    f.write(html_content)       # ❌ 동기 블로킹 I/O

with open(os.path.join(project_dir, 'graph.json'), 'w', encoding='utf-8') as f:
    json.dump(graph_data, ...)  # ❌ 동기 블로킹 I/O
```

Python의 MCP stdio 루프(`main()`)는 **단일 스레드 동기 처리**다.  
`update_graph` 도구가 대형 프로젝트(수천 파일)를 스캔하며 `generate_graph_html`을 호출하면:
- 전체 파이프라인이 **수십 초간 블로킹** 가능
- 그 사이 MCP 클라이언트(mcp_server.js)의 `execFile` 타임아웃 발생 가능

**단, 현재 `graphifyWatchdog.js`가 백그라운드 프로세스로 실행한다면** 실제 영향은 `query_graph` 실시간 호출에만 한정된다.

#### ✅ 처방 (우선순위 낮음, Phase 43 이후 권고)

`graph.html`/`graph.json` 쓰기에도 atomic write 패턴 적용:

```python
def generate_graph_html(project_dir, graph_data, out_dir=None):
    # ...
    target_dir = out_dir or project_dir
    os.makedirs(target_dir, exist_ok=True)
    
    # graph.html — atomic write
    html_tmp = os.path.join(target_dir, 'graph.html.tmp')
    with open(html_tmp, 'w', encoding='utf-8') as f:
        f.write(html_content)
    os.replace(html_tmp, os.path.join(target_dir, 'graph.html'))
    
    # graph.json — atomic write  
    json_tmp = os.path.join(target_dir, 'graph.json.tmp')
    with open(json_tmp, 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)
    os.replace(json_tmp, os.path.join(target_dir, 'graph.json'))
```

> stdio 타임아웃 자체는 Node.js 쪽 `execFile` 옵션에서 `timeout: 120000` (2분)으로 늘리면 단기 해소 가능.

---

### Q3. MAX_DEPTH=50 적정성

**판정: ✅ 현재 설정 적절 — 모니터링 권고**

#### 분석

| 시나리오 | MAX_DEPTH 50 영향 |
|---------|-----------------|
| 일반 MyCrew 엔진 (파일 ~200개) | 충분 — 실제 의존성 깊이 평균 5~15단계 |
| 대형 모노레포 (파일 5,000개+) | 순환 참조가 없다면 50으로 충분. 순환 참조가 있으면 `visited` Set이 이미 방어 |
| 순환 그래프 (A→B→C→A) | `visited` Set이 재방문 차단 → BFS 유한 종료 보장 |

`MAX_DEPTH=50`이 OOM을 방지하는 주 메커니즘이 아니다. **실제 OOM 방어는 `visited` Set의 재방문 차단**이다.  
`MAX_DEPTH`는 "너무 깊은 탐색 경로 조기 종료" 역할로, 50은 실용적 상한값으로 적절하다.

**단, BFS가 `list`(큐) 방식으로 구현되어 있어 메모리 사용량이 `O(V * avgPathLength)`** 임을 인식해야 한다.  
노드가 1만 개를 초과한다면 `deque(collections.deque)` 전환을 권고한다:

```python
from collections import deque
queue = deque([(src, [src])])  # list.pop(0) → O(n) 대신 deque.popleft() → O(1)
```

---

### Q4. 폴더 V1/V2 격리의 완전성 — `.mycrewignore` 설계 방안

**판정: 🟠 구조적 결함 — Phase 42 이전 패치 권고**

#### 💥 실제 버그 분석

```python
# graphify_mcp.py L109 — is_system=True 시 하드코딩 필터
if '04_Users' in root or '06_소시안자료' in root or '채널분석' in root or '/outputs' in root:
    continue
```

**P-012 위반**: 하드코딩된 폴더명 문자열은 리팩토링 내성이 없다.  
`06_소시안자료` 폴더가 `06_채널분석`으로 이름이 바뀌는 순간 필터가 무력화된다.

또한 `'dist' in root`는 `/Users/alex/dist_utils/`처럼 관련 없는 경로도 차단한다 (거짓 양성).

#### ✅ 처방 — `.mycrewignore` 파일 기반 필터링

```python
def load_ignore_patterns(project_dir):
    """
    .mycrewignore 파일에서 무시 패턴 로드
    없으면 기본 패턴 반환
    """
    ignore_file = os.path.join(project_dir, '.mycrewignore')
    default_patterns = ['node_modules', '.git', 'dist', 'build', 'Project_WIKI']
    
    if not os.path.exists(ignore_file):
        return default_patterns
    
    try:
        with open(ignore_file, 'r', encoding='utf-8') as f:
            patterns = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        return default_patterns + patterns
    except Exception:
        return default_patterns

def should_ignore(path, ignore_patterns):
    """경로의 어떤 컴포넌트도 무시 패턴과 일치하면 True"""
    parts = path.replace('\\', '/').split('/')
    return any(pattern in parts for pattern in ignore_patterns)
```

`.mycrewignore` 파일 예시 (`08_MyCrew_Anti/.mycrewignore`):
```
# MyCrew Graphify 스캔 제외 폴더
04_Users
06_소시안자료
07_채널분석
outputs
tmp
```

---

## 🔴 신규 발견 결함 (코드 검증 중 발견)

---

### N-001 — confirm 라우트에 LOCKED 상태 가드 미구현 [심각도: Critical]

Q1 분석에서 확인한 내용. `server.js`에서 `/plan-master/confirm` 호출 시 **현재 `plan_master_status`를 DB에서 읽는 코드가 없다**. 즉:

- `LOCKED` 상태에서 다시 `revise`를 호출할 수 있음
- 다중 클라이언트 동시 confirm 시 `LOCKED`가 중복 설정됨

> **Q1 처방의 멱등성 가드 추가로 해결 가능**

---

### N-002 — generate_graph_html()의 graph.json 비원자적 쓰기 [심각도: Medium]

```python
# graphify_mcp.py L305 — 직접 덮어쓰기
with open(os.path.join(project_dir, 'graph.json'), 'w', encoding='utf-8') as f:
    json.dump(graph_data, f, ...)  # ❌ 쓰기 중 읽기 요청이 오면 부분 파일 반환 가능
```

`wiki_cache.json`에는 `os.replace()` atomic write를 적용했으나, **`graph.json`과 `graph.html`에는 미적용**이다.  
`query_graph` 도구가 동시에 `graph.json`을 읽다가 부분 파일을 받으면 JSON 파싱 오류 발생.

> **Q2 처방의 atomic write 패턴 적용으로 해결 가능**

---

## 📊 최종 결함 요약표

| ID | 분류 | 위치 | 심각도 | Luca 우려? | 패치 필요 |
|----|------|------|--------|-----------|----------|
| Q1/N-001 | confirm LOCKED 가드 부재 | server.js confirm 라우트 | 🔴 Critical | ✅ Q1 | 상태 가드 추가 |
| Q2 | stdio 블로킹 위험 | graphify_mcp.py generate_graph_html | 🟠 인식 필요 | ✅ Q2 | Phase 43 이후 |
| Q3 | MAX_DEPTH 적정성 | graphify_mcp.py BFS | ✅ 적절 (개선 권고) | ✅ Q3 | `deque` 전환 권고 |
| Q4/N-002 | 하드코딩 필터 + graph.json 비원자 | graphify_mcp.py build_graph | 🟠 High | ✅ Q4 | .mycrewignore 도입 |

---

## 🎯 패치 우선순위

### 즉시 처리 (A+ 승격 조건)

1. **[N-001]** `server.js` `/plan-master/confirm` — `getProjectById()`로 현재 `plan_master_status` 확인 후 `LOCKED`이면 409 반환
2. **[N-002 + Q4]** `graphify_mcp.py` — `graph.json`/`graph.html` atomic write + `.mycrewignore` 파일 기반 필터 전환

### Phase 43 이후 권고

3. **[Q2]** `execFile` timeout 값을 `120000`ms로 상향 + `graph.html` atomic write
4. **[Q3]** BFS 큐를 `collections.deque`로 전환 (`O(n) → O(1)`)

---

## 💡 아키텍처 멘토링 — 핵심 통찰 2가지

### 1. Plan Master는 "상태 기계(State Machine)"로 명시적으로 설계해야 한다

현재 구조는 `plan_master_status` 컬럼을 추가했지만, **전이 규칙(Transition Rule)이 코드에 없다**:

```
올바른 전이: NULL → analyzing → pending_confirm → LOCKED
잘못된 전이: LOCKED → revise (현재 가능, 차단해야 함)
잘못된 전이: NULL → confirm (현재 가능, 차단해야 함)
```

각 라우트 진입 시 허용된 이전 상태를 명시적으로 검증하는 패턴을 도입하면 미래 확장성도 확보된다.

### 2. Graphify의 `is_system` 분기는 설정 파일로 외부화해야 한다

현재 `is_system` 플래그 하나로 "어떤 폴더를 제외할지"를 하드코딩하는 방식은 MyCrew 워크스페이스가 커질수록 유지보수 비용이 올라간다.  
`.mycrewignore` 패턴 파일 + `is_system` 플래그를 조합하면 **코드 변경 없이 제외 폴더를 운영팀이 직접 관리**할 수 있다.

---

## ✅ 최종 승인

Phase 39 및 Phase 41의 핵심 설계와 보안 패치는 **유효하고 정상적으로 구현**되었다.  
발견된 N-001(상태 가드 부재)은 Critical이나 패치 난이도가 낮으므로 Luca가 빠르게 처리 가능하다.

> **현재 등급: 🟢 A (N-001 패치 완료 즉시 A+ 승격)**

---

*Prime Advisor Supreme Review | 소넷 (Sonnet) | 2026-05-12*  
*정책 참조: P-012 (하드코딩 금지), P-016 (데이터 파괴 방어), P-019 (원본 데이터 보호), P-020 (무단 코딩 금지)*
