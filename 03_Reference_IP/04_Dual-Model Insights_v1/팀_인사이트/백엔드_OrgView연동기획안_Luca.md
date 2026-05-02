# [백엔드 구현 계획서] 멀티 팀(Multi-Team) 아키텍처 연동 스키마

**기반 문서**: `OrgView v2.0 프론트엔드 개발기획서 (by Sonnet)`
**분석 대상**: DB 스키마 설계 및 API 라우터
**작성자**: Luca (CTO)

---

## 📌 Sonnet의 "Open Questions"에 대한 CTO(Luca)의 기술 결정

1. **ARI 중복 소속 처리**
   * **결정**: **각 그룹(Team A, Team B, 독립)에 모두 렌더링하도록 허용합니다.** 
   * 백엔드 DB 설계상 ARI는 '메타 에이전트'이므로 여러 `Team` 테이블에 N:M (다대다) 외래키 매핑이 가능하게 다리(Bridge) 테이블 구조를 채택해야 합니다. 프론트엔드에서는 분신처럼 매번 렌더링하되, 데이터페이스 식별자(UUID)는 동일하게 처리하십시오.
2. **기존 CEO 트리 노드 제거**
   * **결정**: **완전 삭제(Remove).**
   * 기존 조직도의 '상명하복(트리형)' 구조 패러다임을 탈피하여, CKS 프레임워크의 '협력 및 독립형 구조(그리드형)'로 나아가야 합니다. CEO는 워크스페이스의 마스터(Owner)이지 관리 대상 크루가 아닙니다.
3. **`latestComment` DTO 제거 여부**
   * **결정**: **서버 응답(API)에서도 완전히 제거(Remove) 합니다.**
   * 프론트엔드의 `TaskCard` 보드 전면에서 불필요한 메타데이터가 삭제되었으므로, 백엔드 역시 해당 데이터를 파싱하고 Join 연산하는 리소스를 낭비할 필요가 없습니다. `GET /api/tasks?list=board` 페이로드 컴팩트화를 위해 즉시 제거합니다.
4. **CKS 분석 메트릭 데이터 소스**
   * **결정**: **현재 Sprint 에서는 프론트/백엔드 모두 Mock 데이터 선구현, 본 연동은 다음 Sprint로 연기.**
   * 뷰(UI) 구조를 잡기도 전에 SQLite(`experiment_log.db`) 로깅 인프라까지 동시에 개발하면 에픽(Epic) 크기가 너무 커집니다. 브라우저에서 화면 볼륨만 확인할 수 있도록 하드코딩된 Mock JSON을 우선 적용하는 것이 제 기본 권장 사항입니다.

---

## 🛠 백엔드 Layer 아키텍처 개편안 (서포트 명세)

### 1. Database 스키마 신설 및 확장 (PostgreSQL/SQLite)
프론트엔드 `uiStore.js`의 `teams`, `projects`를 영속화(Persist)하기 위한 테이블.

**Table: `projects`**
* `id` (PK)
* `name` (ex: "소시안 CKS 실험")
* `status` (active, archived)

**Table: `teams`**
* `id` (PK)
* `projectId` (FK -> projects.id)
* `name` (ex: "Team B")
* `groupType` (ex: "협력적 CKS")
* `icon` / `color`

**Table: `team_agents` (다대다 연결 테이블)**
* `teamId` (FK)
* `agentId` (FK -> agents.id)
* `experimentRole` (이 팀 내에서의 특수 직책. ex: "Team A - 초안 발제자")

### 2. 백엔드 API 엔드포인트 변경 정의

* **`GET /api/workspace/roster`**
  * 조직도(OrgView) 초기 로딩 시 한 번에 땡겨오는 **벌크(Bulk) API**.
  * 기존에는 Flat API로 던져줬으나, 이제는 Team 별로 묶인 중첩 JSON을 리턴합니다.
  ```json
  {
    "teams": [
      {
        "id": "team_B",
        "name": "Team B — 협력적 CKS",
        "project": {"id": "p_01", "name": "소시안 Plan C"},
        "agents": [
           {"id": "pico", "role": "크리에이터"},
           {"id": "lumi", "role": "디렉터"},
           {"id": "ari", "role": "어드바이저"}
        ]
      }
    ],
    "independentAgents": [ /* 독립 심사관 등 */ ]
  }
  ```

* **`POST /api/teams`**
  * **목적**: 프론트에서 `[+ 새 팀 만들기]` 모달을 통해 팀을 생성할 때 호출됨.
  * **로직**: `projectId`가 날아오면 기존 프로젝트에 매핑, `newProjectName`이 날아오면 트랜잭션을 걸고 `projects` 테이블 인서트 후 매핑.

---
*루카(Luca) 작성 — 백엔드는 프론트엔드가 편안하게 데이터를 뿌릴 수 있도록 완벽한 API 페이로드를 조각해 두겠습니다.*
