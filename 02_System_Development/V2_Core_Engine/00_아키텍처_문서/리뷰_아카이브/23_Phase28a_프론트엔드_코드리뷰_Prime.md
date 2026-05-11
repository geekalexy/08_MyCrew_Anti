# 🛡️ Supreme Advisor (Prime) 프론트엔드 설계 리뷰 결과서

**리뷰어:** Prime (Supreme Advisor)
**문서 번호:** RES-23
**리뷰 대상:** Phase 28a 프로젝트 기반 격리 프론트엔드 구현 PRD
**작성일:** 2026-05-02

---

## 1. 핵심 발견 사항 (치명적 결함 방지)

### 🔴 #1: 프론트엔드 ID `proj-1` ≠ 백엔드 ID `global_mycrew`
`projectStore.js`에 하드코딩된 `DEFAULT_PROJECTS`가 백엔드 DB의 실제 프로젝트 ID 구조와 완전히 다릅니다. 현재 localStorage에 `proj-1`이 남아 있으면, 백엔드 데이터 `fetchProjects()` 완료 전에 `?project_id=proj-1`로 API 요청이 전송되고, 결과적으로 빈 배열을 반환하여 칸반 보드가 텅 빈 상태가 됩니다.

**수정 지시:**
* `DEFAULT_PROJECTS` 하드코딩을 완전히 제거하십시오.
* `fetchProjects()`로 서버 동기화를 수행하며, 초기 로딩 상태를 알 수 있는 `isLoaded` 플래그를 도입하여 동기화 완료 전에 잘못된 API 호출이 발생하지 않도록 방어하십시오.

### 🔴 #2: `log:append`에 `projectId` 필터 없음 → 이중 수신
현재 백엔드가 과도기적 호환성을 위해 프로젝트 전용 Room과 전역 시스템(Global) 두 곳으로 이중 방출(`io.emit` & `io.to().emit`)을 수행 중입니다. 프론트엔드 `useSocket.js`는 수신되는 모든 `log:append`를 `appendLog` 하므로 같은 로그가 2번 표시되는 UI 버그가 발생합니다.

**수정 지시:**
* 수신부에서 `if (log.projectId && log.projectId !== selectedProjectId) return;`를 통해 필터링하십시오.
* 추가 방어를 위해 수신 배열의 최근 10건과 비교하여 중복(dedup) 처리 로직을 추가하십시오.

---

## 2. 3가지 질의에 대한 답변

| 질의 항목 | 결론 및 피드백 |
| :--- | :--- |
| **Zustand vs React Query** | ✅ **Zustand 유지 승인.** 현재 규모(2~3개 프로젝트 전환 수준)에서는 Zustand로도 충분히 견고함. 향후 캐싱이 매우 중요해지는 Phase에서 전환 고려. |
| **Socket Room 좀비 리스너** | ✅ **안전함.** Room은 서버 측 메모리 개념이므로 클라이언트 이벤트 리스너가 누적되는 것이 아님. `emit('join/leave')` 방식 승인. |
| **P1 핫픽스 완결 여부** | ⏳ 아직 코드 미확인. 코드가 작성되는 다음 리뷰 턴에서 교차 검증 예정. |

---

### Prime's Directive
> *"PRD 자체는 승인합니다. 지적한 두 가지 충돌 지점(#1, #2)은 실제 코딩 과정에서 로직으로 자연스럽게 해결 가능한 수준입니다. 즉시 프론트엔드 API 연동 및 Store 개조 작업에 착수하십시오."*
