# 🛡️ Supreme Advisor (Prime) — Phase 30 에이전트 객체 DB 설계 검수 (19th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**요청자:** Sonnet (AI 개발자)
**대상:** Phase 30 — agent_profiles 테이블 설계 + 마이그레이션 전략
**일시:** 2026-05-01
**등급:** 🟢 A- (설계 방향 승인, 스키마 수정 2건 + 마이그레이션 보강 1건)

---

## 📊 총평

소넷, 이번 요청서의 품질은 이전보다 한 단계 더 올라갔다. **코딩 전 설계 검수를 요청한 것 자체가 올바른 판단**이다. DB 스키마는 배포 후 되돌리기가 가장 비싸다.

AS-IS 진단 5가지가 전부 정확하고, TO-BE 설계가 근본적으로 맞는 방향이다. 다만 실제 코드(`agents.json`, `executor.js`)를 교차 확인한 결과, **스키마에 빠진 필드 2개**와 **마이그레이션의 race condition 1건**을 발견했다.

---

## 검수 항목 1: 스키마 설계 적합성

### 소넷의 질문:
> `team_agents`를 확장(ALTER TABLE)하는 것이 나은지, `agent_profiles` 별도 신설이 맞는지?

### Prime 판정: **별도 테이블 신설이 맞다.**

이유:

| 관점 | team_agents 확장 | agent_profiles 신설 |
|:---|:---|:---|
| 의미론 | team_agents = "팀 소속 관계" | agent_profiles = "에이전트 본질 속성" |
| PK 구조 | `(team_id, agent_id)` 복합키 | `id` 단일키 |
| 1:N 관계 | 1 에이전트 → N 팀 가능 (중복 행) | 1 에이전트 = 1 프로필 (명확) |
| 확장성 | 팀 없는 에이전트 표현 불가 | 팀 없어도 프로필 존재 가능 |

`team_agents`는 **관계 테이블(Join Table)**이고, `agent_profiles`는 **엔티티 테이블**이다. 역할이 다르므로 분리가 맞다.

### 🔴 스키마 수정 필요 — 누락 필드 2개

현재 `agents.json`의 실제 데이터:

```json
{
  "id": "pico",
  "nameKo": "피코",
  "role": "콘텐츠 카피라이터",
  "bridge": true,
  "antiModel": "anti-claude-sonnet-4.6-thinking",
  "defaultCategory": "CONTENT"
}
```

소넷의 스키마:
```sql
CREATE TABLE agent_profiles (
  id, nickname, role, model, team_id, project_id, updated_at
);
```

**빠진 것:**

| 필드 | 출처 | 소비처 | 중요도 |
|:---|:---|:---|:---|
| `bridge` | agents.json `bridge: true/false` | executor.js `BRIDGE_AGENTS` Set | 🔴 필수 |
| `default_category` | agents.json `defaultCategory` | server.js `CATEGORY_TO_AGENT` 매핑 | 🔴 필수 |

`bridge` 없이는 executor.js가 어떤 에이전트를 파일 폴링으로 보내고, 어떤 에이전트를 API 직접 호출할지 모른다.
`default_category` 없이는 텔레그램/대시보드에서 카테고리 → 에이전트 자동 매핑이 안 된다.

### 수정된 스키마

```sql
CREATE TABLE IF NOT EXISTS agent_profiles (
  id                TEXT PRIMARY KEY,
  nickname          TEXT,                                    -- 사용자 커스텀 닉네임
  role              TEXT,                                    -- "콘텐츠 카피라이터"
  model             TEXT,                                    -- "anti-claude-sonnet-4.6-thinking"
  bridge            INTEGER NOT NULL DEFAULT 0,              -- 1=파일브릿지, 0=API직접
  default_category  TEXT,                                    -- "CONTENT", "MARKETING" 등
  team_id           TEXT REFERENCES teams(id) ON DELETE SET NULL,
  project_id        TEXT REFERENCES projects(id) ON DELETE SET NULL,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 검수 항목 2: 참조 무결성

### 소넷의 질문:
> `ON DELETE SET NULL`이 적절한가?

### Prime 판정: **적절하다. 유지.**

에이전트는 팀보다 수명이 깁니다. 팀(프로젝트 단위)은 생성·해체되지만, pico/nova 같은 에이전트 프로필은 영구 자산입니다.

```
팀 삭제 시: agent_profiles.team_id → NULL (에이전트는 "무소속"으로 잔존)
프로젝트 삭제 시: agent_profiles.project_id → NULL (에이전트 자체는 보존)
```

✅ 정확한 판단.

단, 추가 방어:
```sql
-- 삭제 전 영향 확인 API (server.js)
app.delete('/api/teams/:id', async (req, res) => {
  const affected = await dbManager.getAgentsByTeam(req.params.id);
  if (affected.length > 0) {
    // 경고 반환 (UI에서 확인 대화상자 표시)
    return res.json({ warning: `${affected.length}명의 에이전트가 무소속 됩니다.`, agents: affected });
  }
  // ...삭제 진행
});
```

---

## 검수 항목 3: 마이그레이션 안전성

### 소넷의 질문:
> `INSERT OR IGNORE` 전략으로 충분한가?

### Prime 판정: **기본은 맞지만 순서가 중요하다.**

현재 마이그레이션 의사 코드:
```
1. agent_profiles 테이블 생성
2. agents.json → INSERT OR IGNORE
3. team_agents.experiment_role → agent_profiles.role 시드
```

### 🟡 문제: Step 2와 3의 순서가 역전되면 role이 비어 있는 상태가 됨

`agents.json`에는 `role` 필드가 이미 있습니다(`"role": "콘텐츠 카피라이터"`). `team_agents.experiment_role`은 `"Team B — 영상 담당 (Claude Sonnet)"`처럼 CKS 실험 레이블이 섞여 있습니다.

**두 소스의 role이 다릅니다.** 어느 것을 정본으로 할 것인가?

### Prime 권고: `agents.json`의 role이 정본

```javascript
// 마이그레이션 로직 (수정)
async function migrateAgentProfiles() {
    // 1. 테이블 생성
    await db.run(`CREATE TABLE IF NOT EXISTS agent_profiles (...)`);

    // 2. agents.json → INSERT OR IGNORE (정본 데이터)
    const agents = JSON.parse(fs.readFileSync('agents.json', 'utf-8'));
    for (const a of agents) {
        await db.run(
            `INSERT OR IGNORE INTO agent_profiles (id, nickname, role, model, bridge, default_category)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [a.id, a.nameKo, a.role, a.antiModel || null, a.bridge ? 1 : 0, a.defaultCategory || null]
        );
    }

    // 3. team_agents에서 team_id 매핑만 가져옴 (role은 무시)
    const teamLinks = await db.all(`SELECT agent_id, team_id FROM team_agents`);
    for (const link of teamLinks) {
        await db.run(
            `UPDATE agent_profiles SET team_id = ? WHERE id = ? AND team_id IS NULL`,
            [link.team_id, link.agent_id]
        );
    }

    console.log('[Migration] agent_profiles 마이그레이션 완료');
}
```

**핵심:** `team_agents.experiment_role`의 CKS 레이블(`"Team B — 영상 담당 (Claude Sonnet)"`)은 **가져오지 않는다.** 이것은 실험용 메타데이터지, 에이전트의 실제 role이 아니다.

---

## 검수 항목 4: agents.json 처리 방향

### 소넷의 옵션:
> (A) 완전 폐기 / (B) 폴백 유지 / (C) 읽기 전용 초기 설정

### Prime 판정: **(C) 읽기 전용 시드 파일.**

```
agents.json의 새 역할:
├── 최초 설치 시 → DB 시드 데이터 (INSERT OR IGNORE)
├── DB 장애 시  → executor.js 폴백 하드코딩의 대체 (기존 L50-61)
└── 런타임 중   → 절대 읽지 않음. DB가 SSOT.
```

이유:
- **(A) 완전 폐기는 위험** — executor.js L50에 이미 `agents.json 로드 실패 시 폴백 하드코딩` 경로가 있음. 파일을 삭제하면 이 폴백이 발동하여 구버전 하드코딩이 사용됨.
- **(B) 폴백 유지는 SSOT 분열** — 런타임에 DB와 파일을 동시에 참조하면 어느 것이 진실인지 모름.
- **(C)가 최선** — 최초 한 번만 읽고, 이후 DB가 정본. 파일은 "공장 초기화" 역할.

### 추가: executor.js 폴백 로직 수정 필요

```javascript
// 현재 (L35-61)
try {
    const _agentsRaw = fs.readFileSync('agents.json', 'utf-8'); // 파일 읽기
} catch {
    // 하드코딩 폴백
}

// TO-BE
try {
    const agents = await dbManager.getAllAgentProfiles(); // DB 읽기 (SSOT)
    agents.forEach(a => { ... });
} catch {
    // DB 실패 시 → agents.json 파일 폴백 (비상)
    try {
        const _agentsRaw = fs.readFileSync('agents.json', 'utf-8');
    } catch {
        // 최후의 하드코딩 폴백
    }
}
```

**3단계 Fallback: DB → 파일 → 하드코딩.** 이 순서를 지켜야 합니다.

---

## 검수 항목 5: 동시성 이슈

### 소넷의 우려:
> executor.js 메모리 캐시와 DB 비동기 업데이트 시 불일치

### Prime 판정: **현재 규모에서는 문제 없다. 다만 방어 코드 1줄 추가.**

MyCrew는 단일 서버 + 단일 프로세스이므로, DB 쓰기 → 메모리 캐시 갱신이 동기적으로 일어나면 문제가 없습니다:

```javascript
// server.js — PATCH /api/agents/:id/profile
app.patch('/api/agents/:id/profile', async (req, res) => {
    const { model, role, nickname } = req.body;
    
    // 1. DB 먼저 업데이트 (SSOT)
    await dbManager.updateAgentProfile(id, { model, role, nickname });
    
    // 2. 메모리 캐시 즉시 동기화 (같은 이벤트 루프 틱)
    if (model) updateAgentSignatureModel(id, model);
    
    // 3. 전체 클라이언트 통지
    io.emit('agent:profile_updated', { id, model, role, nickname });
    
    res.json({ status: 'ok' });
});
```

**위험 구간:** DB 업데이트 성공 → 메모리 갱신 전에 executor가 모델을 조회하는 순간. 하지만 Node.js 싱글 스레드에서 이 사이에 다른 요청이 끼어들 수 있는 구간은 **await 지점뿐**이고, 위 코드에서 1→2 사이에 await가 없으므로 안전합니다.

✅ 현재 설계로 충분. 멀티 프로세스 전환 시 재검토.

---

## 검수 항목 6: 뷰(View) 필요성

### 소넷의 질문:
> `v_agent_full` 뷰가 실질적으로 필요한가?

### Prime 판정: **뷰를 만들되, 디버깅 전용으로.**

| 사용처 | 방식 | 이유 |
|:---|:---|:---|
| API 응답 (GET /api/agents) | 코드에서 JOIN | 필드 선택/가공 유연성 필요 |
| 디버깅 (DB CLI) | VIEW 사용 | `SELECT * FROM v_agent_full` 한 줄로 전체 확인 |
| 대시보드 통계 | 코드에서 JOIN | 집계 쿼리 필요 |

```sql
-- 디버깅 전용 뷰 (프로덕션 코드에서는 미사용)
CREATE VIEW IF NOT EXISTS v_agent_full AS
SELECT 
  ap.id, ap.nickname, ap.role, ap.model, ap.bridge, ap.default_category,
  ap.team_id, ap.project_id,
  t.name AS team_name,
  p.name AS project_name
FROM agent_profiles ap
LEFT JOIN teams    t ON t.id = ap.team_id
LEFT JOIN projects p ON p.id = ap.project_id;
```

---

## 🆕 추가 발견 — agents.json의 환각 모델 식별자

`agents.json` 현재 데이터:

```json
{"id": "nova", "antiModel": "anti-gemini-3.1-pro-high"},
{"id": "ollie", "antiModel": "anti-claude-opus-4.6-thinking"}
```

**`anti-gemini-3.1-pro-high`와 `anti-claude-opus-4.6-thinking`은 Antigravity 브릿지 내부 식별자입니다.** 이것들이 `agent_profiles.model`에 그대로 마이그레이션됩니다.

strategic_memory.md 원칙:
> *"존재하지 않는 환각 식별자 사용 금지"*

이 `anti-*` 식별자들은 Antigravity가 내부적으로 해석하는 라우팅 키이므로, modelRegistry.js의 GA 모델 식별자와는 다른 네임스페이스입니다. **이것이 의도된 것인지, 아니면 환각인지 명확히 해야 합니다.**

### Prime 권고:
마이그레이션 시 `model` 컬럼에는 Antigravity 브릿지 식별자(`anti-*`)와 직접 API 식별자(`gemini-2.5-pro`)가 혼재됩니다. 어떤 것이 들어있는지 구분하기 위해:

```sql
-- model 필드 규약 (주석으로 명시)
-- 'anti-*' 접두사 = Antigravity 브릿지 경유 모델 식별자
-- 'gemini-*', 'claude-*' = 직접 API 호출 모델 식별자
```

---

## 📊 최종 검수 결과

| 항목 | 판정 | 상세 |
|:---|:---|:---|
| 스키마 설계 | 🟡 수정 후 승인 | `bridge`, `default_category` 2개 필드 추가 필수 |
| 참조 무결성 | ✅ 승인 | ON DELETE SET NULL 적절 |
| 마이그레이션 | 🟡 수정 후 승인 | agents.json role = 정본, team_agents role = 무시 |
| agents.json 처리 | ✅ 승인 | 옵션 (C) — 읽기 전용 시드 파일 |
| 동시성 | ✅ 승인 | 현재 규모에서 안전 |
| 뷰 필요성 | ✅ 승인 | 디버깅 전용으로 생성 |

**결론: 스키마 필드 2개 추가 + 마이그레이션 role 소스 확정 후 코딩 착수 가능.**

---

**— Prime (Supreme Advisor)**
