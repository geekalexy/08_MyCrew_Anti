# SESSION LOG — 2026-05-03 (Sonnet)

> 작성자: Sonnet (Claude Sonnet 4.6, Antigravity 기반)
> 세션 시간: 2026-05-02 23:30 ~ 05-03 09:00 KST (토큰 리밋으로 2회 중단)
> 세션 성격: Phase 32 사이드바 아키텍처 리팩토링 + 팀원 표시명 설계 + 개발팀 콘텐츠 기획

---

## 1. 사이드바 v8 리팩토링 — 프로젝트별 팀 독립 나열

**배경**: "프로젝트 클릭 시 같은 영역에 이름이 바뀌는 것이 아니라, 팀을 나열해서 보게 하는 것"이라는 CEO 의도 반영.

### 변경 내용
- `Sidebar.jsx` 전면 교체 (v8): 고정 'AI CREW' 섹션 → 프로젝트별 팀 독립 렌더링
- `projectStore.js`: `allCrews: {}` 상태 맵 + `fetchAllProjectCrews()` 병렬 fetch 추가
- `useSocket.js`: `project:ready` 이벤트 시 `fetchAllProjectCrews()` 추가 호출
- 팀 헤더 `+` 버튼 제거 (프로젝트 생성 시 자동 생성이므로 불필요)
- 팀별 독립 `collapsedTeams` 상태 맵으로 개별 접기/펼치기

---

## 2. 팀원 표시명 닉네임 설계 구현

**CEO 의도 정리**: agentId(LUMI 등)는 내부 식별자 — UI에 절대 노출 금지.  
닉네임 없을 때는 `experiment_role` 첫 절(역할명)이 표시명.

### 확정 설계
| 상황 | 표시명 | 서브텍스트 |
|:---|:---|:---|
| 닉네임 없음 | `experiment_role` 첫 절 (역할명) | 없음 |
| 닉네임 있음 | 닉네임 | 역할명 |

### 수정 파일
- `database.js`: `team_agents.nickname` 컬럼 마이그레이션 + `setCrewNickname()` 메서드 추가
- `server.js`: `PATCH /api/projects/:id/crew/:agentId/nickname` 엔드포인트 신설
- `Sidebar.jsx` + `AgentDetailView.jsx`: `displayName = nickname || roleTitle` 로직

---

## 3. AgentDetailView 백화(크래시) 버그 2건 수정

### 버그 1 — meta 호이스팅 오류
- `displayName = teamNickname || roleTitle || meta?.role` 에서 `meta`가 아직 선언 전
- 수정: `meta` 선언을 `displayName` 계산 이전으로 이동

### 버그 2 — meta.skills 크래시
- `meta.skills.map()` → `skills`가 `undefined`면 크래시 → 전체 백화
- 수정: `(meta.skills || []).map()`

### 추가 처리
- `agentMeta`에 없는 신규 팀원(Zero-Config 생성) → 백화 대신 "간략 프로필" 뷰 표시

---

## 4. 팀원 연동 버그 수정

- **원인**: `selectedAgentId === agentId`만 체크 → `ari`가 두 팀에 있으면 양쪽 동시 활성화
- **수정**: `selectedProjectId === project.id` 조건 추가

---

## 5. 아리 엔진팀 → Marketing Team 복원

- **경위**: `proj-1`(아리 엔진)에 dev 팀원 3명을 임의 추가했으나, 원래 소시안 마케팅 테스트 프로젝트였음
- **CEO 확인 후 복원**: 팀명 → "Marketing Team", 7명 (ari, nova, lumi, pico, ollie, lily, luna) 복원
- 각 마케팅 역할명으로 `experiment_role` 재세팅

---

## 6. 개발팀 콘텐츠 기획서 작성

**파일 경로**: `.gemini/antigravity/brain/5722442e.../Phase32_개발팀_콘텐츠_기획서.md`

### CEO 코멘트 4건 반영 완료
1. **ARI 제외**: 개발팀에서 제외, 전역 비서 역할로 한정
2. **모델 3종 한정**: Gemini 3.1 Pro / Claude Sonnet 4.6 / Claude Opus 4.6
3. **WF-01 재설계**: 10단계 + CEO 승인 게이트 2곳 (착수 승인, 최종 승인)
4. **DEV 스킬 자동 장착**: A타입(`strict_isolation`) 프로젝트 개발팀 채용 시 확정

### 루카 워크플로우 합산
- `mini_app_dev_workflow.md` 참조 → WF-01 Phase 1~5와 완전 매핑 확인
- `teamActivator.js` `development` 프리셋과 기획서 연동 확인

---

## 7. 잔존 과제 (Next Steps)

| 항목 | 우선순위 |
|:---|:---:|
| `skillRegistry.js` DEV 스킬 7종 추가 | **P0** |
| Task category 확장 (`FEATURE_DEV`, `BUG_FIX` 등) | **P0** |
| `teamActivator.js` `development` 프리셋에서 ARI 제거 | **P1** |
| Zero-Config → `strict_isolation` 감지 시 DEV 스킬 자동 장착 연동 | **P1** |
| 태스크 생성 모달 템플릿(TPL) 자동 로드 | **P1** |
| Performance KPI category 기반 세분화 | P2 |

---

## 8. 핵심 파일 경로

| 파일 | 주요 변경 |
|:---|:---|
| `src/components/Sidebar/Sidebar.jsx` | v8 전면 교체 — 프로젝트별 팀 나열 |
| `src/store/projectStore.js` | `allCrews` 맵 + `fetchAllProjectCrews()` |
| `src/hooks/useSocket.js` | `project:ready` 시 팀 전체 갱신 |
| `src/components/Views/AgentDetailView.jsx` | meta 호이스팅 수정 + skills null safety |
| `01_아리_엔진/database.js` | `team_agents.nickname` 컬럼 + `setCrewNickname()` |
| `01_아리_엔진/server.js` | `PATCH /crew/:agentId/nickname` 엔드포인트 |
| `.agents/workflows/mini_app_dev_workflow.md` | 루카 자율 개발 워크플로우 (참조) |
