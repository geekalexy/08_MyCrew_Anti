# 🛡️ Prime Advisor (Prime) — Phase 17-4 스킬 섹션 아키텍처 리뷰

**리뷰어:** Prime (Claude Opus) — Prime Advisor  
**대상:** Phase 17-4 Agent Skill Section Architecture  
**일시:** 2026-04-13 (3rd Review Session)  

---

## 📊 총평: A- (승인 권고 — 조건부 보완 2건)

Luca, 이번 설계는 지금까지 리뷰한 것 중 가장 **코드와 밀착된 기획**입니다. `skillRegistry.js` 분리, `agentStore.js`에 `fetchAgentSkills`/`toggleAgentSkill` 이미 구현, DB 테이블 명세까지 — 이전에 지적했던 "기획서만 있고 코드 없음" 문제가 해결되었습니다.

3가지 검증 요청에 대해 하나씩 판정합니다.

---

## 🟡 검증 항목 1: Optimistic UI + 롤백 처리

> **Q: 에러 발생 시의 롤백 처리가 필수적인 수준인가?**

### Prime 판정: ⚠️ 필수 — 현재 코드에 롤백이 없습니다

현재 `agentStore.js` L128~L156의 `toggleAgentSkill()`:

```javascript
// L154: 단순화를 위해 롤백 생략 (실수일 확률 적음)
```

이 주석이 문제입니다. "실수일 확률"의 문제가 아니라, **서버가 다운되어 있을 때**의 문제입니다.

### 실패 시나리오

```
1. 유저가 NOVA의 "marketing" 스킬 토글 OFF 클릭
2. Optimistic UI: 즉시 UI에서 스킬 비활성화 표시
3. POST /api/agents/nova/skills → 서버 4000번 미응답 (브릿지 서버 재기동 중)
4. catch 블록: console.error만 출력하고 끝
5. 결과: UI에는 "marketing OFF"로 보이지만, DB에는 여전히 ON
6. 페이지 새로고침 → fetchAgentSkills()로 DB 데이터 재로드 → 다시 ON으로 복귀
7. 유저 혼란: "분명 껐는데 왜 다시 켜져 있지?"
```

**이것은 단순한 "실수"가 아니라 신뢰성 문제입니다.**

### Prime 권고 — 경량 롤백 패턴 (3줄 추가):

```javascript
toggleAgentSkill: async (agentId, skillId, isActive) => {
  // 롤백을 위한 이전 상태 캡처
  const prevConfig = useAgentStore.getState().agentMeta[agentId]?.skillConfig;
  
  try {
    // Optimistic update (기존 코드 그대로)
    set((s) => { /* ... */ });

    const res = await fetch(`http://localhost:4000/api/agents/${agentId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, active: isActive })
    });
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);
  } catch (err) {
    console.error('[Store] 스킬 토글 실패, 롤백:', err);
    // ★ 3줄 롤백: 이전 상태로 복원
    set((s) => ({
      agentMeta: {
        ...s.agentMeta,
        [agentId]: { ...s.agentMeta[agentId], skillConfig: prevConfig }
      }
    }));
  }
},
```

**비용: 3줄.** 이것을 생략할 이유가 없습니다.

---

## 🔴 검증 항목 2: 고아 레코드(Orphan Record) 위험

> **Q: `agentMeta`는 프론트, `AgentSkill`은 SQLite인 이원 구조가 장기적으로 안전한가?**

### Prime 판정: 🔴 구조적 결함 — 장기적으로 반드시 문제 발생

현재 아키텍처를 도식화하면:

```
[프론트엔드 — Zustand (휘발성)]        [백엔드 — SQLite (영구)]
┌─────────────────────┐                ┌──────────────────────┐
│ agentMeta: {        │                │ AgentSkill 테이블:    │
│   ari: { name, ... }│                │   agent_id: "ari"    │
│   nova: { ... }     │  ──→ 참조 ──→  │   skill_id: "mktg"   │
│   crew_1713042...: {}│               │   agent_id: "crew_..." │
│ }                   │                │                      │
└─────────────────────┘                └──────────────────────┘
         ↑ 새로고침 시 초기화                    ↑ 영구 보존
```

### 고아 레코드 발생 시나리오

```
1. 대표님이 UI에서 "새 에이전트 추가" 클릭
   → agentStore.addAgent() 호출 → agentMeta에 crew_1713042000 생성
   → UI에서 스킬 3개 장착 → AgentSkill 테이블에 3행 INSERT

2. 페이지 새로고침
   → Zustand는 INITIAL_AGENT_META(ari, nova, lumi, pico, ollie 5인)로 초기화
   → crew_1713042000은 agentMeta에서 사라짐 (휘발)
   → 하지만 AgentSkill 테이블에는 agent_id="crew_1713042000"인 3행이 영원히 남음
   → 이것이 고아 레코드(Orphan Record)
```

> [!CAUTION]
> **더 심각한 문제: 에이전트 삭제가 없습니다.**
> 
> 현재 `agentStore.js`에는 `addAgent()`만 있고 `deleteAgent()`가 없습니다. UI에서 에이전트를 제거할 방법이 없으므로, 만약 추가된다면 DB의 `AgentSkill` 행도 함께 삭제해야 하는데 **CASCADE 트리거가 불가능합니다** — 왜냐하면 에이전트 본체가 DB에 없고 프론트에만 있기 때문입니다.

### Prime 권고 — 2단계 해법

```
[MVP 단계 — 지금 즉시]
1. AgentSkill 테이블의 agent_id에 검증 레이어 추가:
   GET /api/agents/:agentId/skills 호출 시,
   프론트에서 보낸 agentId가 KNOWN_AGENTS에 포함되는지 서버에서 검증

2. 서버 부팅 시 클린업 스크립트:
   const KNOWN_AGENTS = ['ari','nova','lumi','pico','ollie'];
   DELETE FROM AgentSkill WHERE agent_id NOT IN (?, ?, ?, ?, ?);
   → 알려지지 않은 에이전트의 스킬 레코드 자동 삭제

[SaaS 확장 단계 — 2번째 고객 확보 시]
3. Agent 테이블 신설:
   CREATE TABLE Agent (
     id TEXT PRIMARY KEY,       -- 'ari', 'nova', etc.
     name TEXT,
     role TEXT,
     model TEXT,
     avatar TEXT,
     tenant_id TEXT,            -- 멀티테넌트용
     created_at DATETIME
   );
   
   → agentMeta를 DB로 이관
   → AgentSkill.agent_id에 FOREIGN KEY 설정 가능
   → ON DELETE CASCADE로 고아 레코드 원천 차단
```

**MVP 단계에서는 위의 1+2만 구현하면 충분합니다.** Agent 테이블은 과잉입니다.

---

## 🟢 검증 항목 3: z-index 계층 충돌

> **Q: LogDrawer와 SkillAddDrawer 간의 z-index 충돌 위험?**

### Prime 판정: ✅ 관리 가능 — 단, z-index 맵 공식화 필요

현재 프로젝트의 z-index를 전수 조사한 결과:

```
[현재 z-index 맵 — app.css 기준]

z: -1    →  데코레이션 (글로우 이펙트 등)
z:  5    →  상태 바 도트
z: 40    →  LogDrawer backdrop (투명 클릭 차단)
z: 50    →  LogDrawer aside (우측 고정, width: 340px)
z: 50    →  모바일 하단 네비게이션
z: 55    →  모바일 LogDrawer (nav 위에)
z: 60    →  FAB 버튼 (우하단)
z: 100   →  LogDrawer 내부 리사이즈 핸들
z: 200   →  LogDrawer 내부 드래그 오버레이
z: 900   →  태스크 상세 모달 (TaskDetailModal)
z: 1000  →  스킬 상세 팝업 (AgentDetailView 내부)
```

### SkillAddDrawer 배치 전략

```
[글로벌 LogDrawer]        [SkillAddDrawer (신규)]
위치: position: fixed     위치: position: absolute (AgentDetailView 내부)
방향: 우측에서 진입         방향: 좌측 또는 우측에서 진입
z:    50                  z:    30 (LogDrawer보다 아래)
범위: 전체 뷰포트          범위: AgentDetailView 컨텐츠 영역 한정
```

> [!TIP]
> **핵심 원칙: SkillAddDrawer는 `position: fixed`가 아닌 `position: absolute`로 구현**

LogDrawer가 `fixed`로 전체 뷰포트를 점유하므로, SkillAddDrawer를 같은 방식으로 만들면 반드시 충돌합니다.

대신 SkillAddDrawer를 **AgentDetailView 내부의 `position: absolute` 또는 `position: relative`한 부모 안에서 슬라이드** 시키면:
- LogDrawer와 stacking context가 완전히 분리됩니다
- z-index 경쟁 자체가 발생하지 않습니다
- `agent-detail-view`에 `overflow: hidden`만 추가하면 Drawer가 부모 영역을 벗어나지 않습니다

### Prime 권고 — z-index 토큰 시스템 (CSS 변수화)

```css
/* app.css 최상단에 추가 — z-index 레지스트리 */
:root {
  --z-base:         1;
  --z-sticky:        10;
  --z-drawer-local:  30;   /* SkillAddDrawer (뷰 로컬) */
  --z-drawer-backdrop: 40; /* LogDrawer 백드롭 */
  --z-drawer-global: 50;   /* LogDrawer 본체 */
  --z-fab:           60;
  --z-modal:         900;
  --z-popup:         1000;
}
```

이렇게 하면 향후 새 컴포넌트가 추가되어도 **매직 넘버 없이 계층 관리**가 가능합니다. 현재 인라인 스타일과 CSS에 산재된 z-index 값들을 이 변수로 통일하세요.

---

## 🔵 추가 발견사항 (요청 외)

### 발견 1: `AgentDetailView.jsx` L63-65 — LogPanel 강제 열기 부작용

```javascript
useEffect(() => {
  setLogPanelOpen(true);  // ← 에이전트 상세 뷰 진입 시 무조건 LogPanel 열림
}, []);
```

기획서에서는 "프로필 뷰 한정 LogPanel = **Collapsed** 기본값 적용"이라고 했는데, **현재 코드는 정반대로 `setLogPanelOpen(true)`를 호출**하고 있습니다.

```diff
 useEffect(() => {
-  setLogPanelOpen(true);
+  setLogPanelOpen(false);  // Phase 17-4: 프로필 뷰에서는 기본 접힘
 }, []);
```

### 발견 2: `skillRegistry.js`와 `agentStore.js`의 스킬 데이터 이중 관리

```javascript
// agentStore.js — INITIAL_AGENT_META
ari: {
  skills: ['업무 라우팅', '태스크 큐 관리', '엔진 조율'],  // 한글 문자열 배열
}

// skillRegistry.js — SKILL_REGISTRY
"routing": {
  id: "routing", name: "Task Routing",  // 영문 ID 기반 객체
}
```

**이 두 체계가 연결되지 않습니다.** `agentMeta.skills`는 한글 문자열 배열이고, `SKILL_REGISTRY`는 영문 ID 기반 객체입니다. Phase 17-4에서 `skillConfig`를 도입하면서 `SKILL_REGISTRY`의 ID와 매칭해야 하는데, 기존 `skills` 배열과의 관계가 불명확합니다.

**Prime 권고:**
```javascript
// Phase 17-4에서 agentMeta.skills 배열은 deprecated 처리
// skillConfig가 유일한 스킬 상태 관리자가 되어야 합니다
ari: {
  name: 'ARI (비서)',
  role: 'AI 오케스트레이터',
  // skills: [...],  ← 제거 또는 UI 표시용 레거시로만 유지
  skillConfig: { routing: { active: true }, ... },  // ← 이것이 SSOT
  avatar: '/avatars/ari.svg',
  model: 'Gemini 3.1 Pro (High)',
},
```

### 발견 3: 인라인 스타일 폭발

`AgentDetailView.jsx`는 488줄인데, **인라인 `style={{...}}`이 약 70개** 이상 산재합니다. 이것은:
- 렌더링 시마다 새 객체 생성 (미세한 성능 손실)
- 스타일 일관성 관리 불가능
- 다크/라이트 테마 전환 시 누락 위험

**이 파일을 컴포넌트 분리(`SkillSection.jsx`, `SkillCard.jsx`)할 때 반드시 CSS 클래스로 마이그레이션하세요.** 이번 Phase 17-4가 그 적기입니다.

---

## ✅ 최종 판정

| 항목 | 판정 | 조건 |
|:---|:---|:---|
| **Q1. Optimistic 롤백** | ⚠️ 보완 필수 | `toggleAgentSkill`에 3줄 롤백 추가 |
| **Q2. Orphan Record** | 🔴 구조적 결함 | MVP: 부팅 시 클린업 스크립트. SaaS: Agent 테이블 신설 |
| **Q3. z-index 충돌** | ✅ 승인 | SkillAddDrawer를 `position: absolute`로 구현, z-index 토큰 도입 |

### 최종 등급: A- | 조건부 승인

**조건 1:** `toggleAgentSkill` 롤백 3줄 추가 (10분 작업)  
**조건 2:** `setLogPanelOpen(true)` → `false` 수정 (기획서와 코드 불일치)  
**조건 3:** 기존 `agentMeta.skills` 배열과 새로운 `skillConfig`의 관계 정의 (둘 다 유지할 건지, 하나를 deprecated할 건지 결정)

위 3개 조건 해소 후 구현 착수를 승인합니다.

---

**— Prime (Prime Advisor)**  
**Phase 17-4 리뷰 완료. 보드 판단 대기.**
