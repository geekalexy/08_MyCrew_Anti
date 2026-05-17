# 45_버그_디버그_리포트

> **작성일**: 2026-05-17  
> **작성자**: Luca (System Architect)  
> **목적**: 시스템 전반에서 발생하는 버그 내역과 진단, 그리고 해결 방안을 이 단일 파일에 계속 업데이트하여 히스토리를 추적합니다.

---

## 🐞 [Bug #1] 휴먼 할당 카드 강제 오토런 버그
**발견일**: 2026-05-17
**상태**: ✅ **해결 완료**

### 1. 현상
칸반 보드에서 대표님(CEO) 명의로 새로운 카드 타이틀을 입력하고 Enter를 누르면, 카드가 'To-Do(할 일)'에 머물지 않고 즉시 'In Progress(진행 중)' 컬럼으로 넘어갑니다. 이후 지시하지도 않은 임의의 코드를 코멘트로 남기며 'Review(승인 대기)' 컬럼으로 넘어가버리는 현상이 발생했습니다.

### 2. 원인 분석
- 새로운 카드를 생성(`task:create`)하거나 드래그(`task:move`)할 때 서버의 이벤트-구동 파이프라인인 `dispatchNextTaskForAgent`와 `forceRedispatchTask`가 호출됩니다.
- 이 두 함수 내부에서 담당자(Assignee)가 **휴먼 에이전트(`CEO`, `대표님`)인지 판별하는 가드 로직이 누락**되어 있었습니다.
- 시스템은 "CEO"조차 하나의 자율 실행 봇으로 착각하여, 기본 탑재 모델(Gemini Flash)을 억지로 가동해 작업을 수행하고 코멘트를 다는 기현상을 만들어냈습니다.

### 3. 해결 및 조치 내역
- `server.js`의 `dispatchNextTaskForAgent` 및 `forceRedispatchTask` 함수 상단에 휴먼 역할(`CEO`, `대표님`, `extension_user`)일 경우 `executor.runDirect`를 발동시키지 않고 즉시 `return` 하도록 예외 처리 방어 코드를 추가했습니다.
- **결과**: теперь 카드를 만들어도 정상적으로 `To-Do` 상태에 안정적으로 머무르게 됩니다.

---

## 🐞 [Bug #2] 오토런(Auto-Run) 전역 강제 트리거 문제
**발견일**: 2026-05-17
**상태**: 🟡 **진단 완료 (수정 대기)**

### 1. 현상
현재 시스템의 오토런 메커니즘은 대표님이 `/run` 명령어 입력이나 "Auto Run 모드"를 켰을 때만 작동해야 함에도 불구하고, AI 에이전트(예: `dev_fullstack`)에게 카드가 할당되기만 하면 무조건 발동하고 있습니다.

### 2. 원인 분석
- `server.js`의 디스패치 함수(`dispatchNextTaskForAgent`, `forceRedispatchTask`) 내부에 현재 프로젝트의 **오토런 모드(Pipeline Mode) 상태를 확인하는 가드(Guard)가 전혀 없습니다.**
- 그 결과 아래의 3가지 경로에서 무조건 오토런이 발동하게 됩니다.
  1. 봇이 할당된 새 카드 생성 (`task:create`)
  2. 사용자가 카드를 마우스로 In Progress로 이동 (`task:move`)
  3. 에이전트가 이전 작업을 마치고 다음 작업으로 바통 터치 시

### 3. 수정 방안 (Action Item)
다음 세션 또는 코딩 지시 시 아래 3가지 조치를 수행해야 합니다.
1. **전역 모드 가드 적용**: `dbManager.getProjectPipelineMode(projectId) === 'run'` 일 때만 `executor.runDirect()`가 호출되도록 가드 로직 삽입.
2. **수동 트리거(Bypass) 신설**: 
모드가 OFF이더라도 `/run`이나 UI 실행 버튼, 댓글 전송 버튼 등 수동 트리거일 경우엔 예외적으로 실행되도록 파라미터(`isManualTrigger`) 설계.
3. **과잉 이벤트 억제**: 마우스로 드래그(`task:move`) 시 inprogress로 이동하면 실행 의도로 AI 엔진 On 로직 유지. 나머지 무조건 AI 엔진을 켜는 로직을 제거하고, 상태(DB)만 변경되도록 디커플링.

---

## 🏗️ [Design #1] 오토런 기본값 설계 역전 (철학적 설계 결함)
**발견일**: 2026-05-17  
**상태**: 🟢 **재설계 완료**  
**분류**: 버그가 아닌 근본 설계 철학 오류

### 1. 현상 및 문제 제기
Bug #1, #2가 반복적으로 발생하는 근본 원인. 시스템의 **기본값(Default)이 오토런 ON**으로 설계되어 있고, 수동 작업(CEO 할당, 비오토런 상황)을 예외(Exception)로 처리하고 있음.

대표님 의도한 설계:
> "기본은 모두 수동 모드. 슬래시 명령어(`/plan_master`, `/auto_run`, `/auto_qa`) 또는 모드 설정 시에만 AI 파이프라인이 작동해야 한다."

### 2. 현재 설계 구조 (잘못됨)

```
기본값: 오토런 ON ← 문제의 핵심
  │
  ├─ CEO 할당?               → 예외처리(return)  ← Bug #1의 원인
  ├─ 미할당?                 → 예외처리(return)
  ├─ pipelineMode != 'run'?  → 예외처리(return)  ← Bug #2의 원인
  └─ 나머지                  → 자동 실행
```

**실증 코드** (`server.js` 기준):
- `dispatchNextTaskForAgent`: `pipelineMode !== 'run'` 가드 존재 ✅
- `forceRedispatchTask`: **pipelineMode 가드 없음** ❌
- `task:move` 핸들러: `in_progress` 드래그 시 `forceRedispatchTask` 직접 호출, pipelineMode 확인 없음 ❌
- 수십 곳의 `forceRedispatchTask` 직접 호출 → 새 진입점마다 가드 누락 위험 상존

**구조적 취약점**: 가드를 추가할수록 예외 구멍이 늘어나는 패턴. 이 방향으로는 버그를 막을 수 없음.

### 3. 올바른 설계 구조 (재설계 방향)

```
기본값: 수동 모드 (DB 상태 변경만, AI 실행 없음) ← 기본값 역전
  │
  ├─ /plan_master 명령  → PlanMaster 1회 실행 (Stateless)
  ├─ /auto_run 명령     → 오토런 파이프라인 ON (Stateful)
  ├─ /auto_qa 명령      → AutoQA 1회 실행 (Stateless)
  │
  └─ 카드 생성/드래그/댓글 이벤트
      → DB 상태 변경만, executor 호출 없음
      → pipelineMode = 'run' 일 때만 Dispatcher 트리거 허용
```

| 이벤트 | 현재 | 재설계 후 |
|--------|------|----------|
| `task:create` (봇 할당) | dispatch 자동 트리거 | DB 저장만, dispatch 없음 |
| `task:move` → `in_progress` | `forceRedispatchTask` 무조건 호출 | `pipelineMode === 'run'`일 때만 |
| CEO 예외처리 코드 | 필수 방어 코드 | **불필요** (기본이 수동이므로) |
| 새 진입점 추가 시 | 가드 누락 → 즉시 버그 | 기본이 잠김, 안전 |

### 4. 수정 방안 (Action Item)

**[단기 패치]** `forceRedispatchTask` 상단에 pipelineMode 가드 추가:
```js
async function forceRedispatchTask(taskId, agentId, ...) {
  if (!agentId || agentId === '미할당' || ...) return;
  // [재설계 패치] pipelineMode 가드 추가
  const taskRow = await dbManager.getTaskById(taskId);
  const pipelineMode = taskRow?.project_id
    ? await dbManager.getProjectPipelineMode(taskRow.project_id).catch(() => 'none')
    : 'none';
  if (pipelineMode !== 'run') return; // Bug #1, #2 동시 해결
  // ...
}
```

**[중기]** `task:move` 핸들러: `in_progress` 드래그 시 pipelineMode 확인 후 실행:
```js
if (toColumn === 'in_progress' && fromColumn === 'todo') {
  const mode = await dbManager.getProjectPipelineMode(task.project_id);
  if (mode === 'run') {
    forceRedispatchTask(task.id, agentId, '', 'START'); // 오토런 ON일 때만
  }
  // 오토런 OFF: 드래그로 상태만 변경, AI 실행 없음
}
```

**[장기]** 전체 파이프라인 철학 재설계: 모든 AI 실행 진입점을 `pipelineMode` 단일 게이트로 일원화.
