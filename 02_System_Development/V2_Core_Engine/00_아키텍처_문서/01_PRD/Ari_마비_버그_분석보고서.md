# 🚨 Ari 행동 마비 버그 — 원인 분석 및 해결책 보고서

> **작성자**: Sonnet (Claude Sonnet 4.6 / Antigravity)  
> **작성일**: 2026-04-25 18:10 KST  
> **심각도**: High — 대표님이 지시해도 Ari가 아무것도 실행하지 못하는 상태

---

## 1. 현상 요약 (텔레그램 대화 기반)

| 대표님 지시 | Ari 실제 반응 | 올바른 반응 |
|------------|-------------|-----------|
| "#93 카드 봐봐" | "어떤 투두리스트인지 알 수 없어요" | `getCrewStatus` 호출 → #93 내용 보고 |
| "할당된 크루 진행시켜줘" | "어떤 크루와 업무인지 알려주세요" | `updateKanbanTask({taskId:93, status:'in_progress'})` 즉시 실행 |
| "직접 못 가는 곳 목록 알려줘" | Ollie에게 리서치 위임 | 자신의 권한을 직접 답변 |
| "Ari_brain.md 읽고 와" | Ollie에게 위임 | 이미 자신이 부팅 시 로드함 → 내용 직접 보고 |

**결론**: Ari는 자신이 가진 도구를 사용하지 않고 모든 것을 Ollie에게 위임하는 패턴 → **시스템이 사실상 멈춤**

---

## 2. 근본 원인 3가지 (코드 레벨 분석)

### 🔴 원인 1: `getTaskByIdFull` 도구 미존재 (가장 직접적 원인)

**위치**: `ai-engine/ariDaemon.js` → `ARI_TOOLS` 배열

```
현재 존재하는 도구:
  ✅ createKanbanTask
  ✅ updateKanbanTask
  ✅ deleteKanbanTask
  ✅ getCrewStatus       ← 태스크 목록(요약) 조회
  ✅ listDirectoryContents
  ✅ analyzeLocalImage
  ✅ manageAgentSkills
  ✅ writeCEOLog

  ❌ getTaskByIdFull     ← 특정 카드 상세 내용 조회 도구 없음!
```

**결과**: Alex가 "#93 봐봐" 라고 해도, Ari는 `getCrewStatus`로 요약만 볼 수 있고
카드의 **전체 본문**을 읽는 도구가 없다. 그래서 "직접 확인할 수 있는 시스템이 없다"고 말한 것.

> `getCrewStatus`는 `title + status`만 반환 (light data). 카드 body/담당자/지시 내용은 못 읽음.

---

### 🔴 원인 2: ARI_BRAIN.md에 칸반 핵심 도구가 누락됨

**위치**: `docs/ARI_BRAIN.md` 섹션 5 (인지 권한 및 장기 기억 구조)

```
현재 문서화된 도구 (4개):
  1. listDirectoryContents
  2. analyzeLocalImage
  3. manageAgentSkills
  4. writeCEOLog

문서에서 빠진 핵심 도구 (4개):
  ❌ createKanbanTask    ← 없음
  ❌ updateKanbanTask    ← 없음! "진행시켜줘 = 이 도구 호출" 연결 끊김
  ❌ deleteKanbanTask    ← 없음
  ❌ getCrewStatus       ← 없음
```

**결과**: Gemini 2.5 Pro는 function declarations에 도구가 정의되어 있어 호출은 가능하지만,
ARI_BRAIN.md에 "언제 무엇을 쓸지" 가이드가 없으므로 **도구가 있어도 상황에 맞게 안 쓴다**.

특히 **`updateKanbanTask(status:'in_progress')` = 담당 에이전트 실행 트리거** 라는 연결 고리가
시스템 프롬프트 어디에도 명시되지 않음 → Ari가 카드를 in_progress로 옮기면 Antigravity가 실행된다는
사실 자체를 모름.

---

### 🔴 원인 3: "실행 레이어 분리 원칙"을 Ari가 잘못 해석

**위치**: `contextInjector.getGlobalContext()` → `strategic_memory.md` 내용이 시스템 프롬프트에 주입됨

strategic_memory.md의 이 구절:
```
[구조 1] Ari 비서 레이어 ↔ 실행 레이어 완전 분리
```

**설계 의도 (올바른 해석):**
> Ari의 AI 모델이 직접 쉘 명령, 코드 실행, 외부 API를 raw call 하지 않음
> → 복잡한 작업은 FilePollingAdapter → Antigravity로 위임

**Ari의 실제 해석 (잘못된 해석):**
> 나는 아무것도 직접 하면 안 된다
> → 파일도 못 읽음, 카드 내용도 못 확인함, 심지어 내 권한을 설명하는 것도 Ollie에 위임

**결과**: Ari 스스로 자신의 Function Calling 도구조차 "직접 접근"이라고 오해 →
모든 행동을 Ollie에게 위임 → **Ari가 껍데기만 남는 상태**

---

## 3. 왜 "Ari_brain.md 읽고 와"가 안 됐나

`ariDaemon.js` 코드:
```javascript
// ─── ARI_BRAIN.md 로드 (아리의 핵심 두뇌) ──
const ARI_BRAIN_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs/ARI_BRAIN.md'   // ← 정상적으로 존재하고 로드됨
);
let ARI_BRAIN = '';
try {
  ARI_BRAIN = fs.readFileSync(ARI_BRAIN_PATH, 'utf-8');
  // ✅ 파일은 성공적으로 로드됨 (부팅 시 매번)
```

**실제 상황**: ARI_BRAIN.md는 **이미 Ari의 시스템 프롬프트에 포함**되어 있음.
→ "Ari_brain.md 읽고 와"라고 하면 Ari가 "저는 이미 알고 있습니다, 내용은..."이라고 답해야 정상.

**Ari가 Ollie에게 위임한 이유**:
ARI_BRAIN.md 어디에도 "나는 내 brain 파일을 이미 로드했다"는 자기 인식(self-awareness) 안내가 없음.
→ Ari가 "파일을 읽어오라는 요청 = 외부 파일 접근 = 실행 레이어 위임"으로 오해.

---

## 4. 해결책 (3단계)

### ✅ Fix 1: `getTaskByIdFull` 도구 추가 (ariDaemon.js)

ARI_TOOLS 배열에 추가할 내용:
```javascript
{
  name: 'getTaskByIdFull',
  description: `특정 칸반 카드의 전체 내용(본문, 담당자, 상태, 카테고리)을 조회합니다.
사용자가 "#93 봐봐", "93번 카드 내용 확인해줘" 등을 말할 때 호출합니다.
카드 번호(ID)를 알고 있을 때 상세 내용을 확인하려면 반드시 이 도구를 사용하세요.`,
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'number', description: '조회할 태스크 ID (숫자)' },
    },
    required: ['taskId'],
  },
},
```

executeTool 핸들러에 추가할 내용:
```javascript
if (toolName === 'getTaskByIdFull') {
  const { taskId } = args;
  const task = await dbManager.getTaskByIdFull(taskId);
  if (!task) return { success: false, message: `#${taskId} 태스크를 찾을 수 없습니다.` };
  const crewName = CREW_INFO[task.assigned_agent]?.name || task.assigned_agent;
  return {
    success: true,
    message: `📋 **#${task.id} 태스크 상세**\n\n**상태**: ${task.status}\n**담당**: ${crewName}\n**카테고리**: ${task.category}\n\n${task.content}`,
    task,
  };
}
```

---

### ✅ Fix 2: ARI_BRAIN.md 섹션 5 — 칸반 도구 추가 + 실행 연결 명시

현재 4개만 있는 도구 목록을 아래로 교체:

```markdown
### [도구 및 권한 (Capabilities)] — 전체 9종

**[칸반 보드 — 핵심 업무 관리 도구]**
1. `createKanbanTask`: 새 태스크 카드 생성 및 크루원 할당
2. `updateKanbanTask`: 카드 내용/담당자/상태 수정
   ⚡ 중요: status를 `in_progress`로 변경하면 담당 에이전트(Antigravity)가
   즉시 해당 업무를 실행 시작함. "진행시켜줘" = 이 도구 즉시 호출.
3. `getTaskByIdFull`: 특정 카드 전체 내용 조회 (ID로 상세 확인)
4. `getCrewStatus`: 크루 전체 또는 특정 크루원의 태스크 목록 조회
5. `deleteKanbanTask`: 태스크 삭제

**[로컬 시스템 — 보조 도구]**
6. `listDirectoryContents`: 로컬 폴더 파일 목록 조회
7. `analyzeLocalImage`: 이미지 비전 분석
8. `manageAgentSkills`: 에이전트 스킬 장착/해제
9. `writeCEOLog`: 대표님 관찰 에세이 기록

**[자기 인식 — Self-Awareness 규칙]**
- 나는 부팅 시 `ARI_BRAIN.md`를 자동으로 로드하여 내 두뇌로 사용 중이다.
  "Ari_brain.md 읽어봐"라는 요청은 Ollie에게 위임하지 말고
  "저는 이미 로드했습니다. 내용은..." 으로 직접 답한다.
- 나 자신의 접근 권한, 한계, 도구에 대한 질문은 직접 답한다. Ollie에게 위임하지 않는다.
```

---

### ✅ Fix 3: ARI_BRAIN.md — "실행 분리 원칙" 올바른 해석 섹션 추가

```markdown
## 6. 실행 레이어 분리 원칙 — 올바른 해석 (중요)

MyCrew 아키텍처에는 "비서 레이어 ↔ 실행 레이어 분리" 원칙이 있다.
이 원칙을 오해하면 아무것도 못 하는 무기력한 비서가 된다.

**이 원칙의 실제 의미:**
- ✅ 나는 내 Function Calling 도구(9종)를 직접 사용한다 → 이것은 "직접 실행"이 아님
- ✅ 나는 파일 목록 조회, 카드 조회, 카드 상태 변경을 직접 한다
- ❌ 내가 하지 않는 것: 쉘 명령 실행, raw 코드 실행, 외부 API 직접 호출

**올바른 행동 패턴:**
- "93번 카드 봐봐" → getTaskByIdFull(93) 즉시 호출 (위임 X)
- "진행시켜줘" → updateKanbanTask({taskId:93, status:'in_progress'}) 즉시 호출 (위임 X)
- "내 권한이 뭐야" → 이 문서 기반으로 직접 답변 (Ollie 위임 X)
- "복잡한 코드 작업해줘" → 칸반 카드 생성 후 Antigravity에 위임 (O)
```

---

## 5. 수정 파일 및 우선순위

| 파일 | 변경 내용 | 우선순위 |
|------|----------|---------|
| `ai-engine/ariDaemon.js` | `getTaskByIdFull` 도구 추가 | 🔴 즉시 |
| `docs/ARI_BRAIN.md` | 칸반 도구 4개 + 자기인식 + 실행원칙 해석 추가 | 🔴 즉시 |

---

## 6. 수정 후 예상 동작

```
Alex: "93번 카드 봐봐"
Ari:  [getTaskByIdFull(93) 호출]
      → "네 대표님! #93 카드 내용입니다..."  ✅

Alex: "할당된 크루 진행시켜줘"
Ari:  [updateKanbanTask({taskId:93, status:'in_progress'}) 호출]
      → "✅ #93 이동 완료, Luca가 곧 시작합니다."  ✅

Alex: "직접 못 가는 곳 알려줘"
Ari:  "저는 쉘 명령, 외부 DB 직접 접근은 못 합니다.
       하지만 칸반 카드 조회/수정, 파일 목록, 이미지 분석은 직접 합니다."  ✅

Alex: "Ari_brain.md 읽고 와"
Ari:  "저는 부팅 시 이미 로드했습니다. 내용은..."  ✅
```

---

*분석: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25 18:10 KST*
