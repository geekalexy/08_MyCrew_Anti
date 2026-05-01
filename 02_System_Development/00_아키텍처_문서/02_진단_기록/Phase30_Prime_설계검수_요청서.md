# [Prime 설계 검수 요청] Phase 30 — 에이전트 객체 DB 설계

> 요청일: 2026-05-01  
> 요청자: Sonnet (소넷)  
> 검수 대상: Prime (Claude Opus)  
> 우선순위: 🔴 High — 코딩 착수 전 설계 확정 필요

---

## 검수 목적

에이전트(PICO, NOVA 등) 객체의 속성(model, role, nickname)을 현재 `agents.json` + 메모리 방식에서 **SQLite DB 기반**으로 전환하는 설계에 대해 구조적 검토를 요청합니다.

DB 스키마 변경은 마이그레이션 순서, 참조 무결성, 재시작 안전성 등 코딩 후 되돌리기 어려운 사안이므로 코딩 착수 전 검수를 진행합니다.

---

## 1. 현재 구조 (AS-IS)

### 에이전트 정보 저장 방식

```
agents.json (파일)
  → executor.js (부팅 시 파일 로드 → 메모리 AGENT_SIGNATURE_MODELS)
  → /api/agents/:id/model PATCH → 파일 수정 + 메모리 업데이트
```

### 기존 DB 스키마 (관련 테이블만)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  name TEXT NOT NULL,
  group_type TEXT,
  icon TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_agents (
  team_id TEXT REFERENCES teams(id),
  agent_id TEXT NOT NULL,
  experiment_role TEXT,          -- CKS 실험 문자열로 하드코딩됨
  PRIMARY KEY (team_id, agent_id)
);
```

### 현재 구조의 문제점

| 문제 | 설명 |
|---|---|
| **model DB 미저장** | 서버 재시작 시 `agents.json` 파일 기준으로 초기화. DB와 동기화 없음 |
| **role 수정 불가** | `team_agents.experiment_role`이 CKS 실험 레이블로 고정 (예: "Team B — 영상 담당 (Claude Sonnet)") |
| **nickname 없음** | 사용자가 직접 지정한 닉네임 저장 구조 없음 |
| **에이전트 → 프로젝트 직접 연결 없음** | `agent → team → project` 2단계 JOIN 필요 |
| **SSOT 분열** | `agents.json`(파일)과 DB(`team_agents`)가 분리 운영 → 정합성 위험 |

---

## 2. 제안 설계 (TO-BE)

### 신설 테이블: `agent_profiles`

```sql
CREATE TABLE IF NOT EXISTS agent_profiles (
  id          TEXT PRIMARY KEY,
  nickname    TEXT,
  role        TEXT,
  model       TEXT,
  team_id     TEXT REFERENCES teams(id) ON DELETE SET NULL,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 데이터 예시

| id | nickname | role | model | team_id | project_id |
|---|---|---|---|---|---|
| pico | PICO | 영상 프로듀서 | anti-claude-sonnet-4.6-thinking | team_B | sosiann_planC |
| nova | NOVA | 브랜드 마케터 | anti-gemini-3.1-pro-high | team_A | sosiann_cks |
| ari | ARI | 공유 라우터 | gemini-2.5-pro | team_independent | null |

### 변경되는 API 흐름

```
프로필 변경 (model / role / nickname)
  → PATCH /api/agents/:id/profile
    → DB agent_profiles UPDATE
    → executor.js 메모리 캐시 즉시 갱신 (updateAgentSignatureModel)
    → io.emit('agent:profile_updated') 소켓 → 전체 클라이언트 반영
```

### 마이그레이션 전략 (서버 부팅 시 1회 실행)

```js
// database.js 부팅 로직 (의사 코드)
// 1. agent_profiles 테이블 생성 (없을 때만)
// 2. agents.json 데이터 → INSERT OR IGNORE (기존 레코드 보존)
// 3. team_agents.experiment_role → agent_profiles.role 로 시드 복사
// 4. agents.json은 폴백 전용으로 유지 (삭제 안 함)
```

### 조회 뷰 (선택사항)

```sql
CREATE VIEW IF NOT EXISTS v_agent_full AS
SELECT 
  ap.id,
  ap.nickname,
  ap.role,
  ap.model,
  ap.team_id,
  ap.project_id,
  t.name   AS team_name,
  p.name   AS project_name
FROM agent_profiles ap
LEFT JOIN teams    t ON t.id = ap.team_id
LEFT JOIN projects p ON p.id = ap.project_id;
```

---

## 3. 영향 범위

| 파일 | 변경 내용 |
|---|---|
| `database.js` | `agent_profiles` 테이블 CREATE + 마이그레이션 시드 로직 |
| `server.js` | `/api/agents/:id/model` → `/api/agents/:id/profile` 확장. DB 조회/업데이트 |
| `executor.js` | 부팅 시 `agents.json` 대신 `agent_profiles` DB에서 모델 로드 |
| `agentStore.js` | `updateAgent()` PATCH 엔드포인트 경로 변경 |
| `TaskCard.jsx` | 변경 없음 (이미 `agentMeta.model` 우선 로직 적용됨) |
| `TaskDetailModal.jsx` | 변경 없음 (동일) |

---

## 4. 검수 요청 사항 (Prime에게 확인 요청)

1. **스키마 설계 적합성**  
   `agent_profiles` 테이블이 `team_agents`와 중복되는 부분이 없는지. `team_agents` 테이블을 확장하는 방식(ALTER TABLE ADD COLUMN)이 더 나은지, 아니면 별도 테이블 신설이 맞는지.

2. **참조 무결성**  
   `team_id`, `project_id`에 `ON DELETE SET NULL`이 적절한지. 팀이 삭제될 때 에이전트 프로필을 남겨야 하는지 함께 삭제해야 하는지.

3. **마이그레이션 안전성**  
   기존 `team_agents.experiment_role` 데이터를 `agent_profiles.role`로 시드할 때 데이터 손실 위험이 없는지. `INSERT OR IGNORE` 전략으로 충분한지.

4. **`agents.json` 처리 방향**  
   마이그레이션 완료 후 `agents.json`을 (A) 완전 폐기할지, (B) 폴백으로 유지할지, (C) 읽기 전용 초기 설정 파일로 역할을 재정의할지.

5. **동시성 이슈**  
   `executor.js` 메모리 캐시와 DB가 비동기로 업데이트될 때, 짧은 시간 동안 불일치가 발생할 수 있음. 이 구간의 처리 방식에 대한 의견.

6. **뷰(View) 필요성**  
   `v_agent_full` 뷰 생성이 실질적으로 필요한지, 아니면 API 레이어에서 JOIN으로 처리하는 것이 더 유연한지.

---

## 5. 참고 파일

| 파일 | 설명 |
|---|---|
| `02_System_Development/01_아리_엔진/database.js` | 현재 DB 스키마 전체 |
| `02_System_Development/01_아리_엔진/ai-engine/executor.js` | `AGENT_SIGNATURE_MODELS`, `updateAgentSignatureModel`, `getAgentSignatureModel` |
| `02_System_Development/01_아리_엔진/server.js` | `/api/agents/:id/model` PATCH 구현 (L2116~) |
| `00_아키텍처_문서/02_진단_기록/Phase30_에이전트_객체_DB_설계_진단.md` | 진단 문서 (소넷 작성) |

---

## 6. 기대 산출물

Prime의 검수 결과:
- [ ] 스키마 설계 승인 또는 수정 의견
- [ ] 마이그레이션 전략 검토 의견
- [ ] `agents.json` 처리 방향 권고
- [ ] 추가 위험 요소 식별 시 명시

검수 완료 후 루카(Luca)가 코딩을 착수하며, 코드 완성 후 Prime 코드 리뷰를 1회 추가로 진행합니다.
