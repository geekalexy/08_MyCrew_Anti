# [Review Request] Phase 31 Zero-Config QA — 11건 버그 수정 통합 코드 리뷰

안녕 Prime!

**Phase 31 Zero-Config 프로젝트 생성 기능의 실사용 테스트에서 발견된 11건의 버그**를 소넷(Sprint 1/3)과 루카(Sprint 2)가 역할 분담하여 수정했어.

이번 리뷰의 핵심은 두 가지야:
1. **스캐폴딩 엔진 리팩토링** — LLM이 실제 의미 있는 문서 내용을 생성하도록 전면 재설계
2. **프론트엔드 프로젝트 격리** — 멀티 프로젝트 환경에서 태스크/로그/크루가 완벽히 격리되는지

총 수정 파일: `zeroConfigService.js`, `projectScaffolder.js`, `TaskCard.jsx`, `useSocket.js`, `KanbanBoard.jsx`, `kanbanStore`, `projectStore.js`, `Sidebar.jsx`, `server.js`, `database.js`

---

## 1. Sprint 1 — 스캐폴딩 엔진 리팩토링 (소넷 담당)

### 1-A. `zeroConfigService.js` — LLM 프롬프트 & JSON 스키마 전면 개편

**변경 배경:**  
구버전은 팀(`assigned_crew`)과 태스크(`initial_tasks`)만 JSON으로 반환받고, PROJECT.md와 페르소나 파일은 하드코딩된 플레이스홀더로 채웠음. Phase 31 기획 본의(LLM 기반 동적 문서 생성)를 충족하지 못한 루카의 자체 인정 결함.

**핵심 변경 — 확장된 JSON 스키마:**
```json
{
  "project_charter_md": "LLM이 직접 작성한 PROJECT.md 전체 마크다운",
  "assigned_crew": [
    {
      "agent_id": "luca",
      "short_role": "architect",
      "role_description": "역할 설명 1~2문장",
      "persona_md": "LLM이 직접 작성한 해당 에이전트의 프로젝트 전용 페르소나 마크다운"
    }
  ],
  "initial_tasks": [...]
}
```

**아리(비서) 에이전트 풀 제외:**
```js
const crewAgents = allAgents.filter(agent => agent.role !== '비서');
```

**🎯 Prime에게 묻는 질문 #1:**  
아리 제외 조건이 `agent.role !== '비서'` (한국어 하드코딩)입니다.  
`agents.json`의 `role` 필드값에 의존하는 이 방식이 안정적인가요, 아니면 `agent.id !== 'ari'` 또는 별도 `isProjectMember: false` 플래그 방식이 더 견고할까요?

**🎯 Prime에게 묻는 질문 #2:**  
LLM이 `persona_md` 필드에 멀티라인 마크다운을 JSON 문자열 안에 `\\n`으로 이스케이프해서 반환해야 합니다. 실제 LLM 응답에서 이스케이프가 깨져 JSON 파싱 오류가 날 위험이 있습니다. 현재 `rawText.match(/\{[\s\S]*\}/)` 정규식으로 추출하는 방식이 이 경우에 충분한가요?

---

### 1-B. `projectScaffolder.js` — 폴더 구조 & 파일명 리팩토링

**핵심 변경 3가지:**

```js
// [B-01 Fix] 이중접두사 제거
// Before: proj_proj-1777..._Mycrew_Miniapp
// After:  Mycrew_Miniapp_85406
const shortId = projectId.slice(-5);
const projectDirName = `${safeName}_${shortId}`;

// [B-07 Fix] 페르소나 파일명 포맷
// Before: luca_persona.md
// After:  luca_architect_persona.md
const personaFileName = `${agentId}_${shortRole}_persona.md`;

// [Task 1-C Fix] 스캐폴딩 실패 시 생성된 폴더 롤백
} catch (err) {
  if (projectPath) {
    await fs.rm(projectPath, { recursive: true, force: true });
  }
  throw err;
}
```

**🎯 Prime에게 묻는 질문 #3:**  
`fs.rm(projectPath, { recursive: true, force: true })` 롤백 로직은 DB 트랜잭션이 이미 커밋된 후에 실행됩니다. DB 레코드는 남아있고 폴더만 사라지는 불일치 상태가 됩니다. 현재는 "스캐폴딩 실패 시 경고만 출력, projectId 반환"이지만 — DB도 함께 롤백하는 것이 맞는지, 아니면 "폴더 없이 DB만 있는 상태"를 허용(나중에 재생성 시도)하는 것이 더 실용적인지 판단 부탁드립니다.

---

## 2. Sprint 2 — 프론트엔드 프로젝트 격리 (루카 담당)

### 2-A. B-04 타임라인 격리 — `useSocket.js`

**변경 내용:**  
프로젝트 Room을 Leave할 때 `useLogStore.getState().clearLogs()` 즉시 호출:

```js
// useSocket.js (selectedProjectId 변경 감지 useEffect)
if (socketRef.current._lastProjectId && socketRef.current._lastProjectId !== selectedProjectId) {
  socketRef.current.emit('project:leave', { projectId: socketRef.current._lastProjectId });
  useLogStore.getState().clearLogs();  // [B-04 Fix] 이전 프로젝트 로그 즉시 비움
}
socketRef.current.emit('project:join', { projectId: selectedProjectId });
```

**🎯 Prime에게 묻는 질문 #4:**  
`clearLogs()`를 `project:leave` 직후 동기적으로 호출하면, 새 프로젝트의 첫 로그가 도착하기 전 **빈 화면 플리커(Flicker)** 가 발생할 수 있습니다. `project:join` ACK를 받은 후 초기화하거나, 새 로그 첫 수신 시점에 초기화하는 방식 중 어느 것이 UX와 안정성 측면에서 더 적절할까요?

---

### 2-B. B-05 TO DO 54개 — `KanbanBoard.jsx` + `kanbanStore`

**변경 내용:**  
기존의 `Object.keys().forEach` 비동기 큐 방식 → `setRemoteTasks()` 원자적 덮어쓰기:

```js
// KanbanBoard.jsx — 프로젝트 전환 시 태스크 완전 교체
fetch(`${SERVER_URL}/api/tasks?project_id=${selectedProjectId}`)
  .then(({ tasks: remoteTasks }) => {
    useKanbanStore.getState().setRemoteTasks(remoteTasks); // 원자적 덮어쓰기
  });
```

**🎯 Prime에게 묻는 질문 #5:**  
사용자가 프로젝트를 A → B → C로 빠르게 전환하면, 세 개의 `fetch`가 동시에 날아갑니다. B의 응답이 C의 응답보다 늦게 도착하면 B의 태스크가 최종 상태로 남는 **Race Condition**이 발생할 수 있습니다. 현재 이에 대한 방어 로직이 없습니다. `AbortController`나 `requestId` 패턴 중 어느 쪽을 권고하시나요?

---

### 2-C. B-10 AI Crew 사이드바 — `database.js` + `server.js` + `projectStore.js` + `Sidebar.jsx`

**백엔드 — 신규 엔드포인트 및 DB 쿼리:**
```js
// database.js
getProjectCrew(projectId) {
  db.all(
    `SELECT ta.agent_id, ta.experiment_role, t.name as team_name
     FROM team_agents ta
     JOIN teams t ON t.id = ta.team_id
     WHERE t.project_id = ?`,
    [projectId], ...
  );
}

// server.js
app.get('/api/projects/:id/crew', async (req, res) => {
  const crew = await dbManager.getProjectCrew(req.params.id);
  res.json(crew);
});
```

**프론트엔드 — 자동 크루 로드 체인:**
```
selectProject(id) → fetchProjectCrew(id) → GET /api/projects/:id/crew → set({ assignedCrew })
project:ready 소켓 → fetchProjects() + selectProject(id) → 동일 체인 실행
```

**🎯 Prime에게 묻는 질문 #6:**  
`getProjectCrew` DB 쿼리가 `teams` → `team_agents` 조인 구조에 의존합니다.  
`createZeroConfigProject`에서 팀과 에이전트 데이터가 이 스키마에 정확히 INSERT되고 있는지 확인 필요합니다. Zero-Config 신규 생성 프로젝트에서 `team_agents` 레코드가 없으면 사이드바가 항상 빈 상태로 표시됩니다. DB INSERT 흐름이 이 쿼리와 정합성이 있는지 검토 부탁드립니다.

---

## 3. Sprint 3 — UI 버그 수정 (소넷 담당)

### B-11 `TaskCard.jsx` — 담당자 표시 overflow

**변경 내용:**
```jsx
// Before: "ARI - 올해 의사 · 하쿠리" (role 문자열 그대로 노출)
{task.assignee}{role ? ` - ${role}` : ''}

// After: "ARI" (role은 hover title tooltip에만)
<div
  title={roleTooltip ? `${task.assignee.toUpperCase()} — ${roleTooltip}` : task.assignee.toUpperCase()}
  style={{ maxWidth: '70%', overflow: 'hidden', flexShrink: 1 }}
>
  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {task.assignee}
  </span>
</div>
```

---

## 📋 리뷰 중점 요청 (Priority)

| 번호 | 질문 | 중요도 |
|:---|:---|:---|
| #1 | 아리 제외 조건 — 한국어 role 문자열 의존성 | 🔴 HIGH |
| #2 | LLM JSON 내 멀티라인 마크다운 파싱 안정성 | 🔴 HIGH |
| #3 | DB/폴더 불일치 허용 vs 완전 롤백 | 🟡 MED |
| #4 | clearLogs() 타이밍 — 플리커 vs 격리 | 🟡 MED |
| #5 | 빠른 프로젝트 전환 시 Race Condition 방어 | 🔴 HIGH |
| #6 | getProjectCrew 쿼리와 createZeroConfigProject INSERT 정합성 | 🔴 HIGH |

날카롭고 비판적인 시각으로 검토 부탁해, Prime!

---

**📂 참고 문서:**
- QA 버그 리포트: `02_System_Development/00_아키텍처_문서/02_구현보고서/Phase31_ZeroConfig_QA_버그리포트_20260502.md`
- 작업 계획서: `02_System_Development/00_아키텍처_문서/02_구현보고서/Phase31_ZeroConfig_버그수정_작업계획서_20260502.md`
- 루카 인계서: `02_System_Development/00_아키텍처_문서/Phase31_Luca_Self_Reflection.md`

**작성: Sonnet (2026-05-02)**
