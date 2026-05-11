# Phase31 Zero-Config 프로젝트 생성 QA 버그 리포트

**문서 유형:** QA 버그 리포트  
**테스트 일시:** 2026-05-02  
**테스트 케이스:** 프로젝트 A 타입(독립형, strict_isolation) 신규 생성  
**테스트 프로젝트명:** Mycrew_Miniapp (텔레그램 미니앱 개발)  
**작성자:** Sonnet (대표님 발견 항목 통합)  

---

## 📊 버그 총람

| # | 영역 | 심각도 | 발견자 | 상태 | 담당 |
|:---|:---|:---|:---|:---|:---|
| B-01 | 폴더명 이중접두사 | 🔴 HIGH | Sonnet | ✅ 완료 | 소넷 |
| B-02 | 폴더명 가독성 | 🔴 HIGH | 대표님+Sonnet | ✅ 완료 | 소넷 |
| B-03 | rootPath Fallback | 🟡 MED | Sonnet | ✅ 완료 | 소넷 |
| B-04 | 타임라인/채팅 격리 | 🔴 HIGH | 대표님 | ✅ 완료 | 루카 |
| B-05 | TO DO 카드 격리 | 🔴 HIGH | Sonnet | ✅ 완료 | 루카 |
| B-06 | 팀 구성 — 아리 포함 | 🟡 MED | 대표님 | ✅ 완료 | 소넷 |
| B-07 | 팀 구성 — 역할명 표기 | 🟡 MED | 대표님 | ✅ 완료 | 소넷 |
| B-08 | 카드 — 아리 리서치 할당 | 🟡 MED | 대표님 | ✅ 완료 | 소넷 |
| B-09 | PROJECT.md 대원칙 미생성 | 🟡 MED | Sonnet | ✅ 완료 | 소넷 |
| B-10 | AI Crew 팀 메뉴 미생성 | 🟡 MED | 대표님 | ✅ 완료 | 루카 |
| B-11 | 담당자 표시 깨짐 | 🟡 MED | Sonnet | ✅ 완료 | 소넷 |
| **추가** | **팀명 네이밍 개선** | 🟡 MED | 대표님 | ✅ 완료 | 소넷 |
| **Prime#1** | 아리 필터 — 한국어 의존 | 🔴 HIGH | Prime | ✅ 완료 | 소넷 |
| **Prime#5** | Race Condition 방어 | 🔴 HIGH | Prime | ✅ 완료 | 소넷 |

---

## 🔴 HIGH — 즉시 수정 필요

---

### B-01: 폴더명 `proj_` 이중 접두사

**현상:**
```
생성된 폴더: 04_Projects/proj_proj-1777724585406_Mycrew_Miniapp/
기대값:      04_Projects/proj-1777724585406_Mycrew_Miniapp/
```

**원인:**
```js
// zeroConfigService.js L104
const projectId = `proj-${Date.now()}`;  // → "proj-177772..."

// projectScaffolder.js L20 — 또 한 번 proj_ 접두사 추가
const projectDirName = `proj_${projectId}_${safeName}`;  // → "proj_proj-177772..."
```

**수정 방향:**
- `projectScaffolder.js`에서 `proj_` 접두사 제거
- `const projectDirName = \`${projectId}_${safeName}\`` 로 변경

---

### B-02: 폴더명 — 프로젝트명으로 생성 안 됨 (복수 프로젝트 구분 불가)

**현상:**
```
생성된 폴더: proj_proj-1777724585406_Mycrew_Miniapp  ← 타임스탬프로 구분
기대값:      Mycrew_Miniapp  ← 프로젝트명으로 직관적 구분
```

**대표님 의견:**  
복수 프로젝트 생성 시 타임스탬프만으로는 어느 폴더가 어떤 프로젝트인지 구분 불가. 파일 탐색기에서 즉각 인식 불가능.

**수정 방향:**
```
옵션 A: {safeName}/                           → 가장 직관적 (중복명 충돌 위험)
옵션 B: {safeName}_{short_id}/                → 안전 + 가독성 균형
옵션 C: {YYYYMMDD}_{safeName}/                → 날짜 기준 정렬 가능
```
→ **옵션 B 권고**: `Mycrew_Miniapp_p17777/` 형식 (타임스탬프 앞 5자리만 사용)

---

### B-03: rootPath Fallback 경로 오류

**현상:**  
`.env`에 `PROJECTS_ROOT_PATH` 미설정 시 `01_아리_엔진/projects/` 에 생성됨.

**원인:**
```js
// projectScaffolder.js L6
this.rootPath = process.env.PROJECTS_ROOT_PATH 
  || path.join(process.cwd(), 'projects');  // ← 엔진 내부에 생성됨 (잘못된 fallback)
```

**수정 방향:**  
`.env` 필수값으로 지정하거나, fallback을 `08_MyCrew_Anti/04_Projects/`로 하드코딩 명시.

---

### B-04: 타임라인 / 채팅 패널이 이전 프로젝트에서 상속됨

**현상:**  
신규 프로젝트(Mycrew_Miniapp) 생성 후 열었을 때, 타임라인과 채팅 패널에 **이전 프로젝트의 로그 및 대화가 그대로 표시**됨. 프로젝트 간 격리가 LogDrawer/패널 레벨에서 동작하지 않음.

**영향:** 에이전트가 다른 프로젝트의 컨텍스트를 읽을 수 있어 Phase 31의 격리 목표 자체가 무효화됨.

**수정 방향:**  
프로젝트 전환 시 LogDrawer가 `projectId` 기준으로 로그를 재필터링하도록 소켓 구독 갱신 로직 확인 필요.

---

### B-05: TO DO 카드 54개 — 프로젝트 격리 미적용

**현상:**  
신규 프로젝트 칸반 보드 TO DO 컬럼에 54개 카드 표시.  
Zero-Config 초기 백로그는 최대 5개 안팎이어야 함.

**원인 추정:**  
`GET /api/tasks?projectId=...` 쿼리 파라미터가 누락되거나, 프론트엔드가 전체 태스크를 불러온 후 클라이언트 사이드 필터링에 실패하고 있는 것으로 추정.

**수정 방향:**  
- 프론트엔드가 프로젝트 전환 시 `projectId`를 API 쿼리에 올바르게 전달하는지 확인
- `projectStore`의 `selectedProjectId` → `useTask` 훅 → API 호출 체인 점검

---

## 🟡 MED — 기능 미완성 / UX 개선 필요

---

### B-06: 팀 구성에 아리(비서)가 포함됨

**현상:**  
Zero-Config LLM이 배정한 팀: **ARI, LUCA, LUMI**  
→ 아리는 프론트데스크 비서이며, 개발/기획 프로젝트 팀원이 아님.

**원인:**  
Zero-Config 프롬프트의 에이전트 풀(Agent Pool)에 아리가 포함되어 있으며, LLM이 아리를 일반 팀원으로 인식.

**수정 방향:**  
`zeroConfigService.js`의 에이전트 풀 구성 시 `agent.id === 'ari'` 또는 `agent.role === '비서'` 조건으로 **아리를 풀에서 제외**.

---

### B-07: 팀 구성 — 역할명이 아닌 에이전트 이름으로 표기

**현상:**  
팀 파일: `ari_persona.md`, `luca_persona.md`, `lumi_persona.md`  
기획서 포맷: `agent1_architect_persona.md`, `agent2_coder_persona.md`

**대표님 의견:**  
역할명(architect, coder 등)이 아닌 에이전트 이름으로만 저장되어 팀 구성 의도 파악 불가.  

**수정 방향:**  
파일명 포맷을 `{agent_id}_{role}_persona.md` 으로 변경.  
예: `luca_architect_persona.md`, `lumi_media_creator_persona.md`

---

### B-08: 카드 — 아리(비서)가 리서치 태스크에 할당됨

**현상:**  
`[Research] 텔레그램 미니앱 개발을 위한 최적 기술 스택(프론트엔드...)` 카드의 담당자가 **ARI**로 배정됨.

**원인:**  
B-06과 동일. 아리가 팀원으로 포함되어 LLM이 리서치 역할에 배정.

**수정 방향:** B-06 수정 시 연동 해결.

---

### B-09: `PROJECT.md` 대원칙이 플레이스홀더로 생성됨

**현상:**
```md
## 🛑 대원칙 및 톤앤매너
- (LLM이 작성한 대원칙이 이곳에 누적됩니다.)  ← 실제 LLM 작성 내용 없음
```

**원인:**  
Phase 31 기획 Step 2 (Prompt Expansion)가 미구현.  
Zero-Config LLM이 팀/백로그 JSON만 생성하고, PROJECT.md 초안은 생성하지 않음.

**수정 방향:**  
`zeroConfigService.js` 프롬프트에 `project_charter` 필드를 JSON 출력에 추가하고, 스캐폴딩 시 PROJECT.md에 기록.

---

### B-10: 좌측 메뉴바 > AI Crew > 프로젝트 팀 미생성

**현상:**  
프로젝트 생성 후 좌측 메뉴 `AI Crew` 섹션에 해당 프로젝트의 팀(개발팀 등)이 표시되지 않음.

**대표님 의견:**
- 팀 빌딩 과정이 사용자에게 전혀 보이지 않음
- 사용자가 이 프로젝트의 팀 구성(스킬, 능력)을 알 수 없음
- "어떤 에이전트가 왜 선발됐는가"에 대한 투명성 부재

**수정 방향:**  
프로젝트 생성 완료(`project:ready` 이벤트) 시 프론트엔드가 해당 프로젝트의 배정 크루를 AI Crew 사이드바에 동적으로 렌더링하도록 처리.  
또는 팀 빌딩 진행 상황을 로그 스트리밍으로 사용자에게 실시간 노출.

---

### B-11: 담당자 표시 — 역할 텍스트 overflow

**현상:**  
스크린샷의 Task #1 카드: `ARI - 올해 의사 · 하쿠리`  
"올해 의사 · 하쿠리"는 agent의 `role` 필드가 카드 UI의 assignee 영역에 overflow되어 표시되는 것으로 추정.

**수정 방향:**  
카드 컴포넌트에서 `assigned_agent` 필드만 표시하도록 수정. role 필드는 hover tooltip 또는 모달에서만 노출.

---

## 📋 수정 완료 이력

| 일자 | 수정 항목 | 파일 | 비고 |
|:---|:---|:---|:---|
| 2026-05-02 | B-01~03, B-06~09, B-11 (7건) | `zeroConfigService.js`, `projectScaffolder.js`, `TaskCard.jsx` | Sprint 1+3 소넷 |
| 2026-05-02 | B-04, B-05, B-10 (3건) | `useSocket.js`, `KanbanBoard.jsx`, `server.js`, `projectStore.js`, `Sidebar.jsx` | Sprint 2 루카 |
| 2026-05-02 | Prime Fix #1: SYSTEM_AGENTS 배열 필터 | `zeroConfigService.js` | `role !== '비서'` → `!SYSTEM_AGENTS.includes(id)` |
| 2026-05-02 | Prime Fix #5: AbortController Race Condition | `KanbanBoard.jsx` | useEffect cleanup 패턴 |
| 2026-05-02 | 팀명 네이밍: `${name}팀` | `database.js`, `projectScaffolder.js` | `[미니앱 개발] 전담팀` → `미니앱 개발팀` |

---

## 🔬 테스트 준비 체크리스트

- [ ] 기존 테스트 프로젝트 DB 레코드 삭제 (또는 대시보드 삭제 기능 사용)
- [ ] `04_Projects/proj_proj-177.../` 폴더 삭제
- [ ] 서버 재시작
- [ ] 새 프로젝트 A타입(독립형) 생성
- [ ] 폴더명 형식 확인: `{프로젝트명}_{shortId}/`
- [ ] AI Crew 사이드바 팀명 확인: `{프로젝트명}팀`
- [ ] TO DO 카드 수 확인: 3~5개 (LLM 초기 태스크)
- [ ] PROJECT.md 대원칙 LLM 생성 여부 확인
- [ ] 페르소나 파일명 형식 확인: `{id}_{role}_persona.md`
- [ ] 아리 팀원 미포함 확인

---

*작성: Sonnet (2026-05-02) | 테스트 주체: 대표님 (직접 검증)*  
*최종 업데이트: 2026-05-02 — Prime 30th Review + 팀명 네이밍 반영*
