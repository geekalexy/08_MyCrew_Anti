# Phase 35: Agent Schema Migration & Isolation

> **작성일**: 2026-05-03
> **목적**: 글로벌 `agents.json` 구조를 폐기하고, 프로젝트별로 완전히 격리된 에이전트 인스턴스(Agent Instances)를 생성·관리하기 위한 새로운 DB 스키마 설계 및 마이그레이션 명세.

---

## 1. 개요 (Overview)

기존 시스템은 `agents.json`에 정의된 정적인 글로벌 에이전트 목록(예: `dev_senior`, `mkt_lead`)을 모든 프로젝트가 공유(또는 참조)하는 구조였습니다.
이로 인해 프로젝트 간에 **에이전트 자아 혼란(Context Pollution)**이 발생할 수 있으며, 팀별 커스텀 닉네임이나 동적으로 생성된 아바타, 스킬, 역할을 반영하기가 구조적으로 매우 까다로웠습니다.

본 스키마 마이그레이션을 통해 `agents.json` 의존성을 제거하고, 오직 `roleRegistry`, `modelRegistry`라는 **'메타 사전(Dictionary)'**만을 참조하여 **프로젝트마다 고유한 에이전트 레코드**를 DB에 생성하는 동적 인스턴스 패러다임을 확립합니다.

---

## 2. To-Be DB 스키마 설계

### 2.1. `project_agents` 테이블 (신규)

프로젝트에 종속된 에이전트 인스턴스의 본체 테이블입니다.

```sql
CREATE TABLE IF NOT EXISTS project_agents (
  id              TEXT PRIMARY KEY,  -- 인스턴스 고유 ID (예: proj-123-dev_fullstack-456)
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id         TEXT NOT NULL,     -- roleRegistry.js 매핑용 (예: 'dev_fullstack', 'mkt_planner')
  model_id        TEXT NOT NULL,     -- modelRegistry.js 매핑용 (예: 'anti-gemini-3.1-pro-high')
  nickname        TEXT,              -- 사용자 지정 닉네임 (기본값: roleRegistry의 default 닉네임 또는 공백)
  avatar          TEXT,              -- 사용자 지정 이미지 URL 또는 이모지 (기본값: 플랫폼 제공 기본 아바타)
  role_description TEXT,             -- LLM(오퍼스)이 팀빌딩 시 동적으로 부여한 '이 프로젝트만을 위한 임무/설명'
  status          TEXT DEFAULT 'active', -- 'active', 'archived', 'deactivated'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**[설계 포인트]**
* **`id`의 고유성**: 글로벌 ID가 아닌, 프로젝트 ID가 결합된 고유 인스턴스 ID를 사용합니다.
* **Fluid Profile 지원**: `nickname`과 `avatar` 컬럼을 테이블에 직접 두어, 언제든 뷰에서 쉽게 수정할 수 있습니다.
* **동적 롤 지원**: `role_description`에 오퍼스가 기획한 디테일한 프롬프트용 롤 설명을 저장하여 환각을 방지합니다.

### 2.2. 기존 테이블과의 관계 (Relations)

* **`team_agents` 테이블 대체 또는 재정의**:
  기존의 `team_agents`는 `(team_id, agent_id)` 매핑을 위해 존재했습니다. 
  새로운 설계에서는 하나의 프로젝트(`project_id`)가 여러 하위 팀(`team_id`)을 가질 경우에 대비해 `project_agents.id`를 참조하는 형태로 변경해야 합니다.
  
  ```sql
  -- To-Be team_agents
  CREATE TABLE IF NOT EXISTS team_agents (
    team_id          TEXT REFERENCES teams(id) ON DELETE CASCADE,
    project_agent_id TEXT REFERENCES project_agents(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, project_agent_id)
  );
  ```

* **`AgentSkill` 테이블 업데이트**:
  기존 `AgentSkill.agent_id`는 글로벌 ID를 가리켰으나, 이제는 `project_agents.id`를 가리켜야 프로젝트별로 에이전트가 어떤 스킬을 장착했는지 격리 관리할 수 있습니다.

---

## 3. 마이그레이션 전략 (Migration Strategy)

### Phase 1: 스키마 생성 및 병행 운용 (Dual Write)
1. `database.js` 실행 시 `project_agents` 테이블을 `CREATE TABLE IF NOT EXISTS`로 생성.
2. 시스템 부팅 시 기존 `agents.json`과 `team_agents`를 분석하여, 현재 프로젝트에 배정된 구형 에이전트들을 `project_agents` 레코드로 자동 변환(Seed)하는 마이그레이션 스크립트 실행.
3. 구형 `agent_id`를 사용하는 모든 비즈니스 로직(예: Task 할당, Log 기록)을 일시적으로 하위 호환 모드로 유지.

### Phase 2: 비즈니스 로직 완전 이관 (Hard Cutover)
1. `zeroConfigService.js` (팀빌더) 로직 수정: 
   LLM이 생성한 JSON(`planData.assigned_crew`)을 받아 DB의 `project_agents`에 직접 Insert.
2. `useAgentStore.js` (프론트엔드 상태) 수정:
   초기화 시 로컬 `agents.json`을 읽지 않고, `GET /api/projects/:id/agents`를 호출하여 현재 프로젝트에 속한 `project_agents` 목록을 적재.
3. Task 담당자 지정 등 모든 로직에서 글로벌 ID가 아닌 `project_agent_id`를 사용하도록 수정.

### Phase 3: `agents.json` 폐기
1. 하위 호환성 확인 후 물리 파일인 `agents.json` 영구 삭제.
2. `ai-engine/policyGuard.js` 내의 하드코딩된 에이전트 ID 검증 로직 제거. (대신 `roleRegistry.js`의 Key값 검증으로 대체)

---

## 4. 프론트엔드 연동 명세

### API Endpoints
* **`GET /api/projects/:projectId/agents`**: 특정 프로젝트의 에이전트 인스턴스 목록 반환
* **`PUT /api/agents/:projectAgentId/profile`**: 닉네임 및 아바타 수정 (Fluid Profile)
* **`POST /api/projects/:projectId/agents`**: 팀 개편 시 수동/자율 에이전트 추가

### 데이터 바인딩 (Zustand Store)
* `useAgentStore`는 글로벌 상태가 아닌, `selectedProjectId`에 종속된 상태 관리를 해야 합니다. 프로젝트 전환 시 `clearAgents()` 후 새로 fetch 하는 로직이 필요합니다.

---

## 5. 결론 및 다음 액션 아이템
이 스키마가 반영되면 MyCrew 엔진은 **진정한 다중 프로젝트(Multi-Tenancy) & 동적 팀빌딩 시스템**으로 완성됩니다.
다음 액션으로는 바로 `database.js`에 `project_agents` 테이블을 추가하고, 기존 코드와의 연결 지점을 수정하는 코딩 작업을 착수합니다.
