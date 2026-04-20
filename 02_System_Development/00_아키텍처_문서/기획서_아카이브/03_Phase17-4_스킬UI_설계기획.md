# [03] Phase 17-4: 스킬 관리 UI 및 실시간 상태 동기화 계획서

**작성:** Luca | **Phase:** 17-4 | **Prime 참조 리뷰:** 3차

---

## 목표
사용자가 에이전트의 스킬 목록을 **대시보드에서 직접 시각적으로 확인하고 활성화/비활성화**할 수 있는 인터랙티브 UI 섹션을 구축한다.

---

## 핵심 설계

### 1. AgentDetailView 탭 확장
- 기존 `에이전트 정보`, `태스크 이력` 탭 외에 **`스킬 라이브러리`** 탭 신설.
- 탭 내부: 카드 형태의 스킬 목록 + 각 스킬별 ON/OFF 토글 스위치.

### 2. 스킬 토글 흐름
```
User Click Toggle
  → PATCH /api/agents/:id/skills (skillId, active)
  → DB 업데이트 (agent_skills)
  → Socket.io emit('agent:skill_updated')
  → UI 즉시 반영 (낙관적 업데이트)
```

### 3. TDZ 에러 방지 (이슈 해결 기록)
- `SKILL_REGISTRY`를 Top-Level에서 const로 선언하여 Temporal Dead Zone(TDZ) 에러 원천 방지.
- `registry.get(skillId)` 패턴으로 함수 내 참조 방식 통일.
