# Phase31 Zero-Config 버그 수정 작업 계획서

**문서 유형:** 스프린트 작업 계획서  
**작성자:** Sonnet  
**기반 자료:**
- QA 버그 리포트: `Phase31_ZeroConfig_QA_버그리포트_20260502.md`
- 루카 인계서: `Phase31_Luca_Self_Reflection.md`
- 대표님 현장 발견 5건

**총 버그:** 11건 | **소넷 담당:** 8건 | **루카 담당:** 3건

---

## 📋 담당 분배 기준

| 담당 | 기준 |
|:---|:---|
| **소넷** | 백엔드 서비스 로직, LLM 프롬프트, 스캐폴딩 파일 처리, UI 표시 버그 |
| **루카** | 프론트엔드 소켓 아키텍처, 멀티 프로젝트 상태 격리, 신규 사이드바 컴포넌트 |

---

## 🏃 Sprint 1 — 스캐폴딩 엔진 수정 (소넷, 우선순위 최고)

> **목표:** 폴더 구조와 파일이 기획서 의도대로 정확히 생성되도록 수정  
> **수정 파일:** `zeroConfigService.js`, `projectScaffolder.js`

---

### Task 1-A: `zeroConfigService.js` LLM 프롬프트 & JSON 스키마 전면 개편 ⭐

**버그:** B-09 (PROJECT.md 플레이스홀더), 루카 인계서 Action 1  
**담당:** 소넷  
**난이도:** 🟡 중간

**작업 내용:**
현재 LLM이 `assigned_crew` + `initial_tasks`만 반환하는 JSON 스키마를 아래와 같이 확장.

```json
// 변경 후 JSON 스키마
{
  "project_charter_md": "# PROJECT: ...\n## 🎯 프로젝트 개요\n...\n## 🛑 대원칙 및 톤앤매너\n...",
  "assigned_crew": [
    {
      "agent_id": "luca",
      "short_role": "architect",
      "role_description": "시스템 아키텍처 설계 및 백엔드 리드",
      "persona_md": "# Persona: LUCA\n## 이 프로젝트에서의 임무\n...\n## 행동 지침\n..."
    }
  ],
  "initial_tasks": [ ... ]
}
```

- 프롬프트에 `project_charter_md`, `persona_md` 생성 지시 추가
- 아리(비서) 에이전트를 가용 풀에서 제외하는 로직 추가 → **B-06/B-08 동시 해결**

---

### Task 1-B: `projectScaffolder.js` 리팩토링 ⭐

**버그:** B-01, B-02, B-07, 루카 인계서 Action 2  
**담당:** 소넷  
**난이도:** 🟢 쉬움

**작업 내용:**
1. **B-01 폴더명 이중접두사 제거**
   ```js
   // Before
   const projectDirName = `proj_${projectId}_${safeName}`;  // proj_proj-177...
   // After
   const projectDirName = `${projectId}_${safeName}`;       // proj-177..._Mycrew_Miniapp
   ```

2. **B-02 폴더명 가독성 개선** — 타임스탬프 뒤 5자리만 사용
   ```js
   const shortId = projectId.slice(-5);  // proj-17777 → 17777
   const projectDirName = `${safeName}_${shortId}`;  // Mycrew_Miniapp_17777
   ```

3. **B-07 페르소나 파일명 포맷** — `{agent_id}_{short_role}_persona.md`
   ```js
   // Before: luca_persona.md
   // After:  luca_architect_persona.md
   const personaFileName = `${agentId}_${shortRole}_persona.md`;
   ```

4. **하드코딩 텍스트 제거** — Task 1-A에서 받은 LLM 결과물을 파일에 직접 Write

---

### Task 1-C: 에러 핸들링 & 롤백 로직 강화

**버그:** 루카 인계서 Action 3  
**담당:** 소넷  
**난이도:** 🟡 중간

**작업 내용:**
- DB 트랜잭션 완료 후 스캐폴딩 실패 시 생성된 폴더 자동 삭제(롤백)
  ```js
  try {
    await scaffoldProjectWorkspace(...);
  } catch (scaffoldErr) {
    // 부분 생성된 폴더 삭제 (불완전 상태 방지)
    await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {});
    throw scaffoldErr;
  }
  ```
- `B-03` rootPath fallback 명확화: 절대경로 명시 또는 시작 시 경로 검증 로직 추가

---

## 🏃 Sprint 2 — 프론트엔드 프로젝트 격리 (루카 담당)

> **목표:** 프로젝트 전환 시 UI 데이터(태스크, 로그)가 완벽히 격리되어 표시되도록  
> **수정 파일:** `LogDrawer.jsx`, `useSocket.js`, `projectStore.js` 및 관련 훅

---

### Task 2-A: 타임라인/채팅 패널 격리 수정 【루카】

**버그:** B-04  
**담당:** 루카 ← **소켓 아키텍처 전문성 필요**  
**난이도:** 🔴 복잡

**루카 작업 내용:**
- 프로젝트 전환 시 LogDrawer가 이전 프로젝트 로그를 즉시 비우고 새 프로젝트 로그를 로드하는 재구독 로직 검증
- `project:join` / `project:leave` 소켓 이벤트 후 로그 상태 초기화 확인
- 채팅(CHATTING) 패널도 동일하게 프로젝트 컨텍스트 격리 적용

---

### Task 2-B: TO DO 카드 54개 — projectId 필터링 수정 【루카】

**버그:** B-05  
**담당:** 루카 ← **프론트+백 멀티 레이어, 상태 관리 복잡**  
**난이도:** 🔴 복잡

**루카 작업 내용:**
- 프론트엔드 태스크 로드 시 `projectId` 쿼리 파라미터가 `GET /api/tasks?projectId=...`에 정확히 전달되는지 추적
- `projectStore`의 `selectedProjectId` → 태스크 fetch 훅 → API 호출 체인 전체 점검
- 프로젝트 전환 시 칸반 보드 태스크 전체 재로드 트리거 확인

---

### Task 2-C: AI Crew 사이드바 — 프로젝트 팀 동적 렌더링 【루카】

**버그:** B-10  
**담당:** 루카 ← **신규 컴포넌트 + 이벤트 시스템 통합**  
**난이도:** 🔴 복잡

**루카 작업 내용:**
- `project:ready` 이벤트 수신 시 해당 프로젝트의 `assigned_crew`를 AI Crew 사이드바에 표시
- 팀 빌딩 진행 과정을 로그 스트림으로 사용자에게 실시간 노출 (UX 투명성)
- 사용자가 팀원 이름·역할·스킬을 사이드바에서 확인 가능하도록 렌더링

---

## 🏃 Sprint 3 — UI 버그 수정 (소넷)

> **목표:** 카드 표시 및 담당자 표기 UI 버그 수정

---

### Task 3-A: 담당자 표시 overflow 수정

**버그:** B-11  
**담당:** 소넷  
**난이도:** 🟢 쉬움

**작업 내용:**
- 칸반 카드 컴포넌트에서 `assigned_agent` ID만 표시하고 role 필드가 overflow되지 않도록 수정
- 역할 정보는 hover tooltip 또는 카드 클릭 시 모달에서만 노출

---

## 📊 전체 일정 요약

```
Sprint 1 (소넷, 백엔드 우선)
├── Task 1-A: zeroConfigService.js 프롬프트 & 스키마 개편   [B-06/B-08/B-09]
├── Task 1-B: projectScaffolder.js 리팩토링                [B-01/B-02/B-07]
└── Task 1-C: 에러 핸들링 & rootPath 검증                  [B-03 + 롤백]

Sprint 2 (루카, 프론트엔드 격리)
├── Task 2-A: 타임라인/채팅 패널 격리                      [B-04]
├── Task 2-B: TO DO 카드 projectId 필터링                  [B-05]
└── Task 2-C: AI Crew 사이드바 팀 동적 렌더링              [B-10]

Sprint 3 (소넷, UI 버그)
└── Task 3-A: 담당자 표시 overflow 수정                   [B-11]
```

| Sprint | 담당 | 버그 해결 수 | 예상 소요 |
|:---|:---|:---|:---|
| Sprint 1 | 소넷 | 7건 (B-01,02,03,06,07,08,09) | 1세션 |
| Sprint 2 | 루카 | 3건 (B-04,05,10) | 별도 루카 세션 |
| Sprint 3 | 소넷 | 1건 (B-11) | Sprint 1 완료 후 즉시 |

---

## ✅ Sprint 1 착수 전 체크리스트 (소넷 자체 확인)

- [ ] `zeroConfigService.js` 현재 프롬프트 구조 파악 완료
- [ ] `projectScaffolder.js` 스캐폴딩 흐름 파악 완료
- [ ] `agents.json`에서 아리 `role` 필드 확인 (풀 제외 기준)
- [ ] 테스트용 기존 프로젝트 폴더 (`proj_proj-177...`) 정리 여부 대표님 확인

---

*작성: Sonnet (2026-05-02)*  
*루카 인계서(Phase31_Luca_Self_Reflection.md) 기반 통합 작업 계획*
