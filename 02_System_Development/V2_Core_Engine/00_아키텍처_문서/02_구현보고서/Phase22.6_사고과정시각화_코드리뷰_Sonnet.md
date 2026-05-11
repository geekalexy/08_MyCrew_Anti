# Phase 22.6 사고과정 시각화 — 코드 리뷰 보고서

- **리뷰어**: Antigravity (Claude Sonnet)
- **리뷰 대상**: Phase22.6_사고과정_시각화_PRD_Luca.md + 실 구현 코드
- **리뷰 날짜**: 2026-04-29

---

## 1. 구현 완료 현황 (PRD vs 실제)

| PRD 항목 | 구현 상태 | 파일 |
|----------|-----------|------|
| `<thinking>`, `<working>` 정규식 파서 | ✅ 완료 | `antigravityAdapter.js:59-69`, `executor.js:518-525` |
| 파싱된 사고 과정 본문에서 제거 | ✅ 완료 | `antigravityAdapter.js:66-69` |
| DB `meta_data` 컬럼 추가 | ✅ 완료 | `database.js:74-76` (마이그레이션) |
| `createComment(metaData)` 저장 | ✅ 완료 | `database.js:474-486` |
| 소켓 `thought_process` 페이로드 전송 | ✅ 완료 | `server.js:145-148` |
| 프론트 `details/summary` 토글 UI | ✅ 완료 | `TaskDetailModal.jsx:890-908`, `LogDrawer.jsx:796-812` |
| Skeleton UI (에이전트 작업 중 표시) | ✅ 완료 | `TaskDetailModal.jsx:1022-1036` |
| 이모지 배제, 무채색 미니멀리즘 | ✅ 완료 | 인라인 스타일 준수 |

**전반 평가**: PRD의 모든 핵심 기능이 구현되었음. 기능 구현 자체는 완성도 있음.

---

## 2. 잘못된 설계 및 버그

### 🔴 [Critical] P0 — 파서 중복 실행 (Double Parsing)

**위치**: `antigravityAdapter.js:59-69` AND `executor.js:518-525`

```js
// antigravityAdapter.js — parseAndValidate() 내부
const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);
const workingMatch = finalText.match(/<working>([\s\S]*?)<\/working>/);
// → thought_process 객체 생성 후 _meta에 저장
```

```js
// executor.js — _extractThoughtProcess() 내부
const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);
const workingMatch = finalText.match(/<working>([\s\S]*?)<\/working>/);
// → 동일한 작업을 다시 수행
```

**문제**: antigravityAdapter가 이미 태그를 파싱·제거한 후 `_meta.thought_process`에 저장하여 반환하는데, executor.js의 `_extractThoughtProcess()`가 **한 번 더 동일한 정규식 파싱**을 시도한다.  
안티그래비티 어댑터 응답에는 이미 태그가 제거되어 있어 executor 파서는 아무것도 못 찾고 빈 값을 반환한다. 결과적으로 `antigravityAdapter._meta.thought_process`가 `executor._extractThoughtProcess`에 의해 덮어씌워지는 위험이 있다.

**수정 방향**:
```js
// executor.js _extractThoughtProcess() 수정
_extractThoughtProcess(result) {
  let _meta = result._meta || {};
  let finalText = result.text || '';
  let thoughtProcess = _meta.thought_process || {}; // 어댑터에서 이미 파싱된 값 우선 사용

  // 어댑터가 이미 파싱했으면 재파싱 생략
  if (!thoughtProcess.thinking && !thoughtProcess.working) {
    // geminiAdapter 등 직접 API 경로 응답에서만 파싱 시도
    const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const workingMatch = finalText.match(/<working>([\s\S]*?)<\/working>/);
    if (thinkingMatch) thoughtProcess.thinking = thinkingMatch[1].trim();
    if (workingMatch) thoughtProcess.working = workingMatch[1].trim();
    finalText = finalText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    finalText = finalText.replace(/<working>[\s\S]*?<\/working>/g, '').trim();
  }
  // ...
}
```
→ 사실 현재 코드도 `if (!thoughtProcess.thinking && !thoughtProcess.working)` 조건 분기가 있어 **상황에 따라 정상 작동하기도 하지만**, 이 조건이 `_meta.thought_process` 객체의 존재 유무만 체크할 뿐, 그 이후 `_meta` 재조합 로직에서 어댑터의 기존 `_meta` 필드들이 유실될 수 있음.

---

### 🔴 [Critical] P0 — getComments()가 meta_data를 파싱하지 않음

**위치**: `database.js:546-557`

```js
getComments(taskId) {
  // ...
  `SELECT id, author, content, meta_data, created_at FROM TaskComment WHERE task_id = ?`
  // ...
  else resolve(rows || []);  // ← meta_data를 그대로 JSON 문자열로 반환!
}
```

**문제**: `getCommentsWithTopology()`(line 764)와 `getRecentGlobalComments()`(line 519)는 `meta_data`를 `JSON.parse`하여 `thought_process`로 변환하지만, **기본 `getComments()`는 이 파싱 없이 원시 `meta_data` 문자열을 반환**한다.

`server.js`의 `GET /api/tasks/:id/comments` REST 엔드포인트가 이 `getComments()`를 호출하면 프론트엔드는 `thought_process` 필드를 받지 못하고 사고과정 UI가 표시되지 않는다.

**수정**:
```js
getComments(taskId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, author, content, meta_data, created_at FROM TaskComment WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId],
      (err, rows) => {
        if (err) return reject(err);
        const parsed = (rows || []).map(row => {
          let thoughtProcess = null;
          if (row.meta_data) {
            try { thoughtProcess = JSON.parse(row.meta_data); } catch (e) {}
          }
          return { ...row, thought_process: thoughtProcess };
        });
        resolve(parsed);
      }
    );
  });
}
```

---

### 🟠 [High] P1 — Skeleton UI 조건 오류 (항상 표시됨)

**위치**: `TaskDetailModal.jsx:1023`

```jsx
{task.column === 'in_progress' && task.assignee && task.assignee !== '미할당' && task.assignee !== '대표님' && (
  <div>... [LUMI] 님이 작업 중입니다...</div>
)}
```

**문제**: `task.column === 'in_progress'`이면 **에이전트가 실제로 AntiGravity 브릿지에서 작업 중인지와 무관하게 항상 Skeleton을 표시**한다. 드래그로 직접 `in_progress`로 옮겨 놓은 뒤 아직 에이전트가 응답하지 않은 상태에서도 동일하게 표시된다.

PRD 4.1항에서 정의한 "브릿지로 작업을 넘기면 Skeleton 표시"라는 트리거 조건이 실제로 서버 상태(`agentStates`)와 연결되지 않고 단순히 컬럼 값으로만 분기된다.

**수정 방향**: 소켓 `agent:status_change` 이벤트의 `status: 'active'` 상태를 프론트엔드 store에 저장하고, 해당 에이전트 `agentStatus === 'active'` 조건을 추가해야 함.

```jsx
// 예시
const agentIsActive = useAgentStore(s => s.agentMeta[task.assignee?.toLowerCase()]?.status === 'active');
{task.column === 'in_progress' && agentIsActive && task.assignee !== '대표님' && (
  <div>...</div>
)}
```

---

### 🟠 [High] P1 — database.js에 하드코딩 KNOWN_AGENTS 잔존

**위치**: `database.js:144`

```js
// [Phase 17-4 Opus 보완]
const KNOWN_AGENTS = ['ari', 'nova', 'lumi', 'pico', 'ollie', 'lily', 'luna'];
```

오늘 `server.js`와 `executor.js`에서 `agents.json` 기반 동적 Set으로 교체했지만, `database.js`의 AgentSkill 고아 레코드 클린업 로직은 여전히 하드코딩된 배열을 사용 중. `agents.json`에서 새 에이전트를 추가해도 이 클린업 쿼리에는 반영되지 않아 데이터가 부당하게 삭제될 수 있음.

또한 `getCommentsWithTopology()`(line 765)에도 동일한 하드코딩이 잔존:
```js
const KNOWN_AGENTS = ['ari','nova','lumi','pico','ollie','lily','luna','devteam','system'];
```

**수정 방향**: `database.js`는 서버 시작 시 `agents.json`을 읽기 어려운 구조이므로, `DatabaseManager`를 초기화할 때 `agentIds` 배열을 주입받는 방식이 적합.

---

### 🟠 [High] P1 — `working` 블록 미활용 (UI 렌더링은 있으나 실제 파싱 방치)

**위치**: PRD 3.1 정의 vs 실제 사용 패턴

PRD는 `<working>` 태그를 "파일 시스템 접근, 도구 사용, 데이터 처리 등 물리적 연산 단계"로 정의하지만, 실제로 AntiGravity IDE 세션에서 브릿지 운영자(소넷)가 이 태그를 직접 작성한 경우에만 파싱된다. 에이전트가 자체적으로 `<working>` 태그를 출력하도록 강제하는 **시스템 프롬프트 지시가 없음**.

`antigravityAdapter.js`의 `instructions` 필드(line 132-142)에는 JSON 포맷 예시만 있고 `<thinking>/<working>` 태그 사용 지시가 없어, 실 운영에서 `working` 블록이 수집될 확률이 낮음.

> ✅ **2026-04-30 수정 완료**: `antigravityAdapter.js` `instructions` 필드에 `[사고과정 출력 규칙 — Phase 22.6]` 섹션 추가. `<thinking>/<working>` 태그 사용 지시 및 포맷 예시 주입.

---

### 🟡 [Medium] P2 — Skeleton 텍스트 하드코딩

**위치**: `TaskDetailModal.jsx:1032`

```jsx
[{task.assignee.toUpperCase()}] 님이 작업 중입니다... (타임라인 입력 시 즉시 반영됨)
```

PRD 4.1의 예시 `[LUMI 님이 작업 중입니다...]`와 유사하나, 한글 조사 처리가 없음. `NOVA 님`은 맞지만 향후 에이전트 이름에 따라 어색해질 수 있음. 국제화(i18n) 관점에서 메시지 포맷을 템플릿화하는 것이 권장됨.

---

### 🟡 [Medium] P2 — PRD 4.2 (문맥 불일치 처리)가 미구현

PRD 4.2는 에이전트가 "20초 전의 문맥으로 답변을 생성했을 때, 중간에 쌓인 코멘트가 명령형이면 다음 큐로 자동 할당"하는 워크플로우를 기술하지만 현재 구현되지 않음.

현재는 에이전트 응답 후 단순히 `idle`로 돌아가고, 중간 코멘트의 성격(명령형/질문형)을 자동 감지하는 로직이 없음. 대표님이 직접 다시 지시해야 함.

---

### 🟡 [Medium] P2 — 편집 모드의 모델 선택 하드코딩 (칸반 설계 문제 10과 연동)

**위치**: `TaskDetailModal.jsx:706-711`

```jsx
<option value="Claude Opus 4.6 (Thinking)">Claude Opus 4.6 (Thinking)</option>
<option value="Claude Sonnet 4.6 (Thinking)">Claude Sonnet 4.6 (Thinking)</option>
<option value="Gemini 3.1 Pro (High)">Gemini 3.1 Pro (High)</option>
<option value="Gemini 3 Flash">Gemini 3 Flash</option>
```

`modelRegistry.js`의 `VALID_MODELS`나 `MODEL` 상수를 참조하지 않고 표시 이름을 하드코딩. 모델이 변경되면 이 드롭다운도 수동으로 업데이트해야 함. 또한 칸반 분석 보고서의 **UI-10 (편집 모드에 불필요한 모델 선택 필드)** 문제와 직결됨 — 에이전트가 이미 `agents.json`의 `antiModel`로 자동 라우팅되므로 이 선택 자체가 사실상 무의미할 수 있음.

---

## 3. 설계 개선 제안

### 제안 1 — 파서 단일화 (Single Parsing Layer)

```
[현재]
antigravityAdapter.parseAndValidate() → 파싱 ① (태그 제거 + _meta 저장)
    ↓
executor._extractThoughtProcess() → 파싱 ② (이미 제거된 태그 재탐색, 무효)

[개선]
antigravityAdapter.parseAndValidate() → 파싱 (태그 제거 + _meta 저장)
    ↓
executor._extractThoughtProcess() → _meta.thought_process 존재 시 바이패스
                                 → 미존재 시(geminiAdapter 경로)만 텍스트 파싱
```

### 제안 2 — DB 파싱 레이어 통일 (DRY 원칙)

`getComments`, `getCommentsWithTopology`, `getRecentGlobalComments` 세 함수 모두 `meta_data → thought_process` 변환 로직이 중복. 내부 private 헬퍼로 추출:

```js
// database.js 내부 헬퍼
_parseMetaData(row) {
  let thoughtProcess = null;
  if (row.meta_data) {
    try { thoughtProcess = JSON.parse(row.meta_data); } catch (e) {}
  }
  return { ...row, thought_process: thoughtProcess };
}
```

### 제안 3 — AntiGravity 브릿지 프롬프트에 사고과정 출력 지시 추가

`antigravityAdapter.js`의 `instructions` 필드에 아래 내용 추가:
```
사고 과정이 있다면 반드시 <thinking>...</thinking> 태그로 감싸서 JSON의 "text" 필드 안에 포함하라.
물리적 작업(파일 접근, 도구 사용)이 있다면 <working>...</working> 태그를 사용하라.
```

---

## 4. 총평

| 카테고리 | 점수 | 비고 |
|----------|------|------|
| PRD 이행률 | **85%** | Skeleton UI, 파서, DB 스키마, 소켓 모두 구현됨 |
| 코드 품질 | **72%** | 파서 중복, getComments 버그, 하드코딩 잔존 |
| 아키텍처 | **68%** | 레이어 책임 혼재(어댑터/executor 중복), DB DRY 위반 |
| UX 충실도 | **80%** | Skeleton/details 구현됨, but 트리거 조건 부정확 |

**핵심 수정 우선순위**:
1. 🔴 `getComments()` — meta_data 파싱 누락 (P0, 사고과정 UI가 모달 초기 로드 시 표시 안 됨)
2. 🔴 파서 중복 실행 — `_extractThoughtProcess` 바이패스 조건 보완 (P0)
3. 🟠 Skeleton UI 트리거 — `agentStates` 소켓 연동 (P1)
4. 🟠 `database.js` KNOWN_AGENTS 하드코딩 제거 (P1, 어제 작업과 연동)

---

*작성: Antigravity (Claude Sonnet) | 2026-04-29*
