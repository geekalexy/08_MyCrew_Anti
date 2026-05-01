# Phase 30 — 에이전트 객체 DB 설계 진단 및 해결 방안

> 작성일: 2026-05-01  
> 작성자: Sonnet (소넷)  
> 관련 요청: 에이전트 DB = `project_id` + `team_id` + `model` + `role명` + `nickname(사용자 지정)` + 모델 수정 시 UI 전반 실시간 반영

---

## 1. 요구사항 정의

사용자가 요청한 에이전트 객체의 속성 구조:

| 필드 | 설명 | 변경 주체 |
|---|---|---|
| `project_id` | 소속 프로젝트 ID | 시스템 (팀 배정 시) |
| `team_id` | 소속 팀 ID | 시스템 (팀 배정 시) |
| `model` | 현재 사용 모델 | **사용자 (프로필 페이지에서 수정 가능)** |
| `role` | 역할명 (예: 영상 프로듀서) | 사용자 |
| `nickname` | 사용자 지정 닉네임 | 사용자 |

**핵심 UX 요건**: 사용자가 프로필 페이지에서 에이전트 모델을 변경하면, 모달·카드·프로필 등 **전체 UI에 즉시 반영**되어야 한다.

---

## 2. 현재 구현 상태 진단 (2026-05-01 기준)

### 2-1. DB 스키마 현황

```sql
-- 현재 존재하는 관련 테이블

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  group_type TEXT,
  icon TEXT,
  color TEXT
);

CREATE TABLE team_agents (
  team_id TEXT REFERENCES teams(id),
  agent_id TEXT NOT NULL,
  experiment_role TEXT,           -- ⚠️ CKS 실험 용어로 하드코딩됨
  PRIMARY KEY (team_id, agent_id)
);
```

### 2-2. 갭(Gap) 분석

| 요구 필드 | 저장 위치 | 상태 | 문제점 |
|---|---|---|---|
| `project_id` | `teams.project_id` → `team_agents`로 간접 연결 | ⚠️ 에이전트에 직접 없음 | JOIN 없이 에이전트 → 프로젝트 조회 불가 |
| `team_id` | `team_agents.team_id` | ✅ 있음 | — |
| `model` | `agents.json` + `executor.js` **메모리 캐시** | ❌ DB에 없음 | 서버 재시작 시 초기화, DB 영속성 없음 |
| `role` | `team_agents.experiment_role` | ⚠️ 편집 불가 | CKS 실험용 문자열 하드코딩, 사용자 수정 경로 없음 |
| `nickname` | `agents.json`의 `name` 필드 | ⚠️ DB에 없음 | 파일 직접 수정 외 변경 방법 없음 |
| 모델 실시간 반영 | `/api/agents/:id/model` PATCH | ⚠️ 불완전 | `agents.json` 파일 + 메모리만 업데이트, DB 미반영 |

### 2-3. 루카(Luca)의 1차 구현 방식 (2026-05-01)

루카가 오늘 구현한 모델 관리 방식:

```
프로필 변경
  → /api/agents/:id/model PATCH
    → agents.json 파일 수정 (디스크 영속)
    → executor.js AGENT_SIGNATURE_MODELS 메모리 업데이트
    → io.emit('agent:model_updated') 소켓 발송
```

**장점**: 빠른 구현, 기존 구조 유지  
**단점**:
- `agents.json`이 SSOT(단일 진실 공급원)와 DB가 분리되어 정합성 위험
- DB `team_agents` 테이블과 독립적으로 관리 → 장기적 데이터 불일치

### 2-4. UX 버그: 모델 변경이 기존 카드에 미반영

**원인**: `TaskCard`, `TaskDetailModal`이 `task.model`(태스크 생성 시점의 스냅샷)을 표시했기 때문.

**결과**: 사용자가 프로필에서 모델을 바꿔도, 이미 생성된 카드는 여전히 이전 모델을 표시.

---

## 3. 해결 방안

### 3-1. 즉시 적용 (2026-05-01 완료) — 프론트엔드 우선순위 변경

> **"에이전트 현재 프로필 모델"을 `task.model`보다 우선 표시**

```js
// TaskCard.jsx / TaskDetailModal.jsx 공통 로직
const profileModel = agentMeta[assignee]?.model;  // 현재 프로필 (실시간)
const displayModel = profileModel || task.model;   // 없으면 기록값 폴백
```

- `agentStore.updateAgent()` 호출 → `agentMeta` 상태 업데이트 → 전체 카드 즉시 리렌더링
- `task.model`은 audit 기록(실행 이력)으로만 보존

**적용 파일**: `TaskCard.jsx`, `TaskDetailModal.jsx`

---

### 3-2. 중기 과제 — `agent_profiles` DB 테이블 신설

현재 `agents.json` 기반 관리의 한계를 해결하려면 DB에 에이전트 프로필 테이블이 필요하다.

```sql
-- 신설 필요 테이블 (database.js에 추가 예정)
CREATE TABLE IF NOT EXISTS agent_profiles (
  id          TEXT PRIMARY KEY,       -- 에이전트 ID (pico, nova, lumi...)
  nickname    TEXT,                   -- 사용자 지정 닉네임
  role        TEXT,                   -- 역할명 (예: 영상 프로듀서)
  model       TEXT,                   -- 현재 사용 모델 (사용자 변경 가능)
  team_id     TEXT REFERENCES teams(id),
  project_id  TEXT REFERENCES projects(id),
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**마이그레이션 전략**:
1. `database.js`에 `agent_profiles` 테이블 추가
2. 서버 시작 시 `agents.json` → `agent_profiles` 시드 데이터 삽입 (`INSERT OR IGNORE`)
3. `/api/agents/:id/model` PATCH: `agents.json` 대신 `agent_profiles` 테이블 업데이트
4. `executor.js` 부팅 시 `agents.json` 대신 `agent_profiles` 테이블에서 모델 로드

---

### 3-3. 장기 과제 — 전체 에이전트 뷰(View) 통합

```sql
-- agent_profiles + team_agents + teams + projects JOIN 뷰
CREATE VIEW v_agent_full AS
SELECT 
  ap.id,
  ap.nickname,
  ap.role,
  ap.model,
  ta.team_id,
  t.project_id,
  t.name   AS team_name,
  p.name   AS project_name
FROM agent_profiles ap
LEFT JOIN team_agents ta ON ta.agent_id = ap.id
LEFT JOIN teams t        ON t.id = ta.team_id
LEFT JOIN projects p     ON p.id = t.project_id;
```

---

## 4. 실시간 반영 데이터 흐름 (목표 상태)

```
사용자 프로필 페이지에서 모델 변경
  │
  ├─ [즉시] agentStore.updateAgent() → agentMeta 리액트 상태 갱신
  │         → 모든 TaskCard, TaskDetailModal 리렌더 → 뱃지 즉시 변경 ✅
  │
  ├─ [비동기] PATCH /api/agents/:id/model
  │         → DB agent_profiles.model 업데이트 (중기 과제)
  │         → executor.js AGENT_SIGNATURE_MODELS 메모리 업데이트 ✅
  │         → io.emit('agent:model_updated') 소켓 → 타 클라이언트 동기화
  │
  └─ [신규 태스크 생성 시] getAgentSignatureModel(agentId) 호출
            → 변경된 모델로 Task.model 기록 ✅
```

---

## 5. 구현 완료 체크리스트

- [x] 카드 모델 뱃지: `agentMeta.model` 우선 표시 (기존 카드 포함 즉시 반영)
- [x] 모달 모델 뱃지: 동일 로직 적용
- [x] `/api/agents/:id/model` PATCH API 구현
- [x] `executor.js` 메모리 캐시 실시간 업데이트
- [x] `agents.json` 파일 영속 저장 (루카 구현)
- [ ] `agent_profiles` DB 테이블 신설 (중기 과제)
- [ ] `nickname`, `role` 사용자 편집 API 및 UI (중기 과제)
- [ ] `team_agents.experiment_role` → `agent_profiles.role` 마이그레이션 (장기 과제)

---

## 6. 개발자 노트

> **`task.model` vs `agentMeta.model` 의미 구분**
>
> | | `task.model` | `agentMeta[id].model` |
> |---|---|---|
> | 의미 | 해당 태스크 처리 당시 사용된 모델 | 에이전트의 현재 설정 모델 |
> | 목적 | 실행 이력(audit) | 현재 상태 표시 |
> | 변경 | 변경 안 됨 (기록값) | 프로필 변경 시 즉시 갱신 |
> | UI 역할 | 향후 "실행 이력 보기" 기능 | 카드·모달 모델 뱃지 표시 |

---

*다음 관련 Phase: Phase 31 — 에이전트 프로필 DB 전환 및 닉네임/역할명 편집 UI*
