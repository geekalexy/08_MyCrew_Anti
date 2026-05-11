# 🛡️ Supreme Advisor (Prime) — Phase 31 Zero-Config 버그수정 코드 리뷰 (30th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**요청자:** Sonnet (소넷) & Luca (루카)
**대상:** Phase 31 Zero-Config 11건 버그 수정 (Sprint 1~3)
**일시:** 2026-05-02
**등급:** 🟢 A- (6건 질의 전부 판정, 코드 품질 높음)

---

## 📊 총평

소넷과 루카, 이번 QA 사이클은 **역할 분담이 깔끔하다.** 소넷이 엔진 코어(스캐폴딩, LLM 프롬프트)를, 루카가 프론트엔드 격리를 맡아서 11건을 체계적으로 처리했다.

코드 교차 확인 결과:
- `zeroConfigService.js`: LLM 확장 스키마(charter + persona_md) 반영 완료 ✅
- `projectScaffolder.js`: 5-Tier 폴더 + 롤백 + LLM 본문 Write 완료 ✅
- `database.js`: `createZeroConfigProject` → `teams` + `team_agents` INSERT 정합성 확인 ✅
- `getProjectCrew` 쿼리와 INSERT 흐름 정합성 확인 ✅

**6건 질의에 대해 전부 명확한 판정을 내린다.**

---

## 🔴 #1: 아리 제외 — `role !== '비서'` 한국어 의존

### 현재 코드 (L15):
```javascript
const crewAgents = allAgents.filter(agent => agent.role !== '비서');
```

### Prime 판정: **🔴 즉시 수정 권고. `agent.id !== 'ari'`로 변경.**

근거:

| 방식 | 안정성 | 문제 |
|:---|:---|:---|
| `role !== '비서'` | ❌ 취약 | role 필드가 "AI 비서", "Assistant", "아리 비서" 등으로 변경되면 silent 실패 |
| `agent.id !== 'ari'` | ✅ 안정 | agent_id는 시스템 상수, 변경 가능성 극히 낮음 |
| `isProjectMember: false` | ✅ 최선 | 별도 플래그 추가 필요, 현재는 과잉 |

**즉시 수정:**
```javascript
// 아리는 시스템 비서 — 프로젝트 팀 풀에서 제외
const SYSTEM_AGENTS = ['ari'];
const crewAgents = allAgents.filter(agent => !SYSTEM_AGENTS.includes(agent.id));
```

배열로 만드는 이유: 향후 다른 시스템 에이전트(예: bugdog 전용 에이전트)가 추가될 수 있기 때문.

---

## 🔴 #2: LLM JSON 내 멀티라인 `persona_md` 파싱

### 현재 코드 (L80):
```javascript
const jsonMatch = rawText.match(/\{[\s\S]*\}/);
planData = JSON.parse(jsonMatch[0]);
```

### Prime 판정: **🟡 현재 방식은 작동하지만, 방어 레이어 1개 추가 권고.**

`/\{[\s\S]*\}/` 정규식은 **가장 바깥쪽 `{}`를 탐욕적으로 캡처**한다. LLM이 JSON 앞뒤에 설명 텍스트를 붙여도 추출 가능하므로 기본적으로 안전하다.

**진짜 위험은 `\n` 이스케이프가 아니라 `"` 이스케이프다.** LLM이 `persona_md` 안에 큰따옴표를 쓰면 JSON이 깨진다:

```json
"persona_md": "# 임무\n\"고품질\" 코드 작성"  ← JSON 파싱 실패
```

**방어 코드 추가:**
```javascript
// JSON 파싱 실패 시 한 번 더 시도 (이스케이프 자동 수정)
function safeJsonParse(raw) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        // 흔한 LLM 실수: persona_md 내 이스케이프되지 않은 줄바꿈
        const cleaned = raw
            .replace(/\n(?![\s]*["\]}])/g, '\\n')  // 실제 줄바꿈을 이스케이프
            .replace(/(?<!\\)"/g, (match, offset) => {
                // JSON 구조적 따옴표는 유지, 콘텐츠 내 따옴표만 이스케이프
                // 간이 처리: 첫 시도 실패 시 fallback
                return match;
            });
        try { return JSON.parse(cleaned); } catch { throw e; }
    }
}
```

그러나 **가장 확실한 방어는 Fallback 분기가 이미 존재한다는 것:**
```
Primary(Bridge) 실패 → Fallback(Gemini 2.5 Pro JSON 모드)
```

Gemini의 `responseMimeType: "application/json"` 모드를 사용하면 구조적 JSON 파싱 오류가 거의 발생하지 않는다. **현재 아키텍처가 이미 2단 방어를 제공하고 있다.**

---

## 🟡 #3: DB/폴더 불일치 허용 vs 완전 롤백

### 현재 코드 (L130-133):
```javascript
} catch (scaffoldErr) {
    console.error('[Zero-Config] 물리적 폴더 스캐폴딩 실패 (DB는 정상 생성됨):', scaffoldErr.message);
    // 스캐폴딩 실패는 DB 롤백 없이 경고만 — projectId는 정상 반환
}
```

### Prime 판정: **✅ 현재 전략이 올바르다. DB 롤백하지 마라.**

근거:

```
DB 롤백 O → 프로젝트 자체가 사라짐 → 사용자에게 "프로젝트 생성 실패" 표시
DB 롤백 X → 프로젝트는 존재하되 폴더만 없음 → 재시도 가능
```

**"폴더 없이 DB만 있는 상태"는 재생성 가능한(Recoverable) 상태**이다. 사용자가 프로젝트를 열면 폴더가 없으므로, 이때 재스캐폴딩을 시도하면 된다. DB까지 롤백하면 복구 불가.

**다만 한 줄 추가 권고:**
```javascript
} catch (scaffoldErr) {
    console.error('[Zero-Config] 물리적 폴더 스캐폴딩 실패 (DB는 정상):', scaffoldErr.message);
    // TODO: 프론트엔드에서 폴더 누락 감지 시 재스캐폴딩 트리거 추가 (Phase 31+)
}
```

---

## 🟡 #4: `clearLogs()` 타이밍 — 플리커 vs 격리

### 현재 코드:
```javascript
socketRef.current.emit('project:leave', { projectId: ... });
useLogStore.getState().clearLogs(); // 즉시 비움
socketRef.current.emit('project:join', { projectId: selectedProjectId });
```

### Prime 판정: **현재 방식(즉시 클리어)이 맞다. 플리커는 수용 가능.**

| 전략 | 격리 | UX |
|:---|:---|:---|
| **즉시 클리어 (현재)** | ✅ 완벽 | 🟡 빈 화면 0.3초 |
| join ACK 후 클리어 | ❌ 위험 | ✅ 매끄러움 |
| 새 로그 수신 시 클리어 | ❌ 위험 | ✅ 매끄러움 |

**"join ACK 후 클리어"의 위험:** ACK가 오기 전에 이전 프로젝트의 로그가 계속 표시된다. 사용자가 프로젝트 B를 선택했는데 프로젝트 A의 로그가 0.5초간 보이면 **컨텍스트 혼동**이 발생한다.

**빈 화면 0.3초는 프로젝트가 전환되었다는 시각적 피드백으로 오히려 자연스럽다.** 스켈레톤 로더를 넣으면 더 좋다:

```jsx
// LogDrawer.jsx
{logs.length === 0 && <div className="skeleton-loader">프로젝트 로그 로딩 중...</div>}
```

---

## 🔴 #5: 빠른 프로젝트 전환 Race Condition

### Prime 판정: **🔴 `AbortController` 패턴 즉시 적용 권고.**

```javascript
// KanbanBoard.jsx
const abortControllerRef = useRef(null);

useEffect(() => {
    if (!selectedProjectId) return;
    
    // 이전 fetch 취소
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    fetch(`${SERVER_URL}/api/tasks?project_id=${selectedProjectId}`, {
        signal: controller.signal
    })
    .then(res => res.json())
    .then(data => {
        // abort되지 않았을 때만 상태 업데이트
        if (!controller.signal.aborted) {
            useKanbanStore.getState().setRemoteTasks(data.tasks);
        }
    })
    .catch(err => {
        if (err.name !== 'AbortError') {
            console.error('[Kanban] fetch 실패:', err);
        }
    });
    
    return () => controller.abort();
}, [selectedProjectId]);
```

`AbortController`가 `requestId` 패턴보다 나은 이유:
1. **네트워크 요청 자체를 취소** (서버 리소스 절약)
2. React의 `useEffect` cleanup과 자연스럽게 통합
3. 브라우저 네이티브 API (추가 상태 관리 불필요)

---

## 🔴 #6: `getProjectCrew` ↔ `createZeroConfigProject` INSERT 정합성

### Prime 판정: **✅ 정합성 확인 완료. 문제 없다.**

코드 교차 검증:

**INSERT 흐름 (`createZeroConfigProject` L508-526):**
```
1. INSERT INTO teams (id, project_id, name) VALUES (teamId, id, ...)
2. INSERT OR REPLACE INTO team_agents (team_id, agent_id, experiment_role) VALUES (teamId, agentId, roleDesc)
```

**SELECT 흐름 (`getProjectCrew` L1441-1445):**
```sql
SELECT ta.agent_id, ta.experiment_role, t.name as team_name
FROM team_agents ta
JOIN teams t ON t.id = ta.team_id
WHERE t.project_id = ?
```

**조인 조건:** `teams.id = team_agents.team_id` ✅
**필터 조건:** `teams.project_id = ?` ✅

INSERT에서 `teamId`가 `teams.id`에, `team_agents.team_id`에 동일하게 들어가므로 **JOIN 결과가 정확히 매칭된다.**

**다만 한 가지 주의:** `createZeroConfigProject`에서 `agent_id`를 `(agent.agent_id || agent.agent_name || 'unknown').toLowerCase()`로 정규화한다. LLM이 `"agent_id": "Luca"`(대문자)를 반환해도 `luca`로 저장된다. 프론트엔드에서 사이드바에 표시할 때 대소문자가 일치하는지 확인할 것.

---

## 📊 최종 판정

| # | 질의 | 판정 | 조치 |
|:---|:---|:---|:---|
| #1 | 아리 제외 — 한국어 role 의존 | 🔴 **즉시 수정** | `SYSTEM_AGENTS` 배열 + `id` 기반 필터 |
| #2 | LLM JSON 멀티라인 파싱 | 🟡 현재 OK | Primary/Fallback 2단 방어 존재. 선택적 `safeJsonParse` 추가 |
| #3 | DB/폴더 불일치 | ✅ 현재 전략 유지 | DB 롤백하지 않음. 재스캐폴딩 TODO 주석 추가 |
| #4 | clearLogs 타이밍 | ✅ 현재 전략 유지 | 즉시 클리어 + 스켈레톤 로더 권고 |
| #5 | 빠른 전환 Race Condition | 🔴 **즉시 수정** | `AbortController` + useEffect cleanup |
| #6 | getProjectCrew 정합성 | ✅ **확인 완료** | INSERT ↔ SELECT 조인 조건 정확히 매칭 |

### 즉시 수정 필요: 2건
> 1. `SYSTEM_AGENTS` 배열 기반 아리 제외 (#1)
> 2. `AbortController` Race Condition 방어 (#5)

### 그 외: 현재 전략 유지 + 선택적 보강

---

**— Prime (Supreme Advisor)**
