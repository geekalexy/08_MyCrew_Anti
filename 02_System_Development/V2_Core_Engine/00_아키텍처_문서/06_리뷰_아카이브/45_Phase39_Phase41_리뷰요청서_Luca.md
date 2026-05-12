# Opus Review Target

## 1. 개요 (Overview)
본 리뷰 요청은 **Phase 39 (Plan Master 상태 관리 버그 픽스 및 보안 패치)**와 **Phase 41 (MyCrew Wiki Graphify 엔진 구축 및 폴더 아키텍처 재정비)**에 대해 Prime Advisor(Opus)의 레드팀 관점 교차 검증을 받기 위함입니다. 
AI 의존도를 낮춘 수학적 파서 기반의 그래프 생성 모듈, 그리고 DB 마이그레이션 교정 내역을 포함합니다.

## 2. 리뷰 타겟 소스코드

### 2.1. Phase 39 BugFix & Security Patch (`database.js` & `server.js`)
* **수정 내용**: `plan_master_status` 상태를 `Task` 테이블에서 `projects` 테이블로 옮기는 구조적 버그 픽스.
* **보안 패치**: `sanitizeScope`를 통한 Prompt Injection 방어, `MAX_REVISIONS` 루프 가드 적용. P-006 준수를 위한 모델 상수(`MODEL.FLASH`, `MODEL.OPUS`, `MODEL.ANTI_GEMINI_PRO_HIGH`) 일괄 교체.

```javascript
// database.js (수정된 projects 테이블 마이그레이션)
if (!names.includes('plan_master_status')) {
  db.run(`ALTER TABLE projects ADD COLUMN plan_master_status TEXT DEFAULT NULL`);
}
if (!names.includes('plan_master_revision_count')) {
  db.run(`ALTER TABLE projects ADD COLUMN plan_master_revision_count INTEGER DEFAULT 0`);
}

updateProjectPlanMasterStatus(projectId, status, incrementRevision = false) {
  return new Promise((resolve, reject) => {
    let query = `UPDATE projects SET plan_master_status = ?`;
    let params = [status];
    if (incrementRevision) {
      query += `, plan_master_revision_count = plan_master_revision_count + 1`;
    }
    query += ` WHERE id = ?`;
    params.push(projectId);
    db.run(query, params, function (err) {
      if (err) reject(err); else resolve(this.changes);
    });
  });
}

// server.js (/api/projects/:id/plan-master/confirm 라우트 로직)
app.post('/api/projects/:id/plan-master/confirm', async (req, res) => {
  const { action } = req.body;
  if (action === 'confirm') {
    await dbManager.updateProjectPlanMasterStatus(projectId, 'LOCKED', false);
    // ... 생략 ...
  } else if (action === 'revise') {
    await dbManager.updateProjectPlanMasterStatus(projectId, 'REVISING', true);
    // ... 생략 ...
  }
});
```

### 2.2. Phase 41 MyCrew Wiki 엔진 (`graphify_mcp.py`)
* **수정 내용**: LLM 토큰 소모를 방지하기 위해 정규식 기반으로 마크다운과 JS Imports를 추출하는 로직 구현.
* **아키텍처**: 증분 업데이트 캐싱(`wiki_cache.json`) 지원 및 원자적 쓰기(`os.replace()`)로 파일 손상 방지 처리.
* **OOM 방어**: `shortest_path` 그래프 쿼리에서 `MAX_DEPTH=50`을 주어 행(Hang) 발생 방어.

```text
# graphify_mcp.py (원자적 쓰기 & 캐시 저장부)
try:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    tmp_path = cache_path + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(new_cache, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, cache_path)  # POSIX atomic rename
except Exception:
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

# graphify_mcp.py (쿼리 BFS 탐색부 - M-001 Fix: 무한루프 방지)
MAX_DEPTH = 50
queue = [(src, [src])]
visited = set([src])
while queue:
    curr, p = queue.pop(0)
    if len(p) > MAX_DEPTH:
        return f"⚠️ 최대 탐색 깊이({MAX_DEPTH})를 초과했습니다. 경로가 너무 깊습니다."
    if curr == dst:
        return " -> ".join(p)
    # ...
```

### 2.3. 폴더 아키텍처 Restructuring 내역
과거 데모 및 불필요 폴더를 정리하고 1급 루트 폴더(`01`~`08`) 체계를 확립.
특히 **`02_System_Development` 내 V1(레거시) / V2(코어엔진) 완전 분리** 및 **`07_MyCrew_Wiki` 승격**을 통해 에이전트 지식 수집기의 컨텍스트 오염을 원천 차단함.

---

## 3. 작업자(Luca)가 고민하는 취약점 및 Edge Case (리뷰 요청 포인트)

1. **Plan Master Lock-on 해제 및 동시성 문제**
   - 현재 `updateProjectPlanMasterStatus`를 통한 DB 갱신과 `.locked` 파일 생성이 트랜잭션으로 묶여있지 않습니다. 만약 서버가 재시작되거나, 동시에 다중 클라이언트가 `confirm` API를 쏠 경우 Race Condition(동시성 충돌) 가능성이 있습니까?

2. **Graphify MCP 증분 캐시(Incremental Cache) 무결성**
   - `os.replace(tmp_path, cache_path)`를 사용하여 Atomic Write를 보장했지만, 만약 `graph.html` 렌더링 도중 I/O 블로킹이 길어지면 MCP stdio 파이프 통신 타임아웃이 날 우려가 있습니다. 비동기 처리가 필요할까요?

3. **MAX_DEPTH (OOM 방어) 한계점**
   - `graphify_mcp.py` 쿼리 탐색 깊이를 50으로 제한했습니다. 거대한 코드베이스에서는 50단계가 부족할 수도, 오히려 너무 커서 CPU 부하를 일으킬 수도 있습니다. 적정성에 대한 조언 부탁드립니다.

4. **폴더 V1/V2 격리의 완전성**
   - `graphify_mcp.py`의 `os.walk`에서 `is_system=True`일 때 `06_소시안자료` 같은 하드코딩된 폴더만 예외처리하고 있는데, 보다 근본적으로 `.mycrewignore` 정규 표현식 기반 필터링으로 뺄 수 있는 설계 방안이 있을까요?

Prime Advisor 님의 깊이 있는 보안·아키텍처 멘토링을 부탁드립니다.
