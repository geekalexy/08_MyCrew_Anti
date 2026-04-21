# 🧠 아리(Ari) 지능 설계서 v1.0
> **작성자**: Luca (CTO / System Architect)  
> **최초 작성**: 2026-04-21  
> **분류**: `02_System_Development/01_아리_엔진/docs`  
> **목표**: "진짜 비서보다 똑똑한 비서" — 단순 응답 봇이 아닌 MyCrew의 자율 지능형 비서실장

---

## 1. 📊 현재 상태 진단 (As-Is)

### 이미 잘 되어 있는 것 ✅

| 항목 | 구현 파일 | 상태 |
|---|---|---|
| 독립 Port 5050 Daemon | `ariDaemon.js` | ✅ 존재 |
| SSE 스트리밍 응답 | `ariDaemon.js` | ✅ 작동 중 |
| 대화 히스토리 보존 (in-memory) | `ariDaemon.js` L40 | ✅ 작동 중 |
| API 키 로테이션 (2키) | `ariDaemon.js` L16-37 | ✅ 구현됨 |
| Google Search (Grounding) | `ariDaemon.js` L122 | ✅ 연결됨 |
| MyCrew 컨텍스트 주입 | `contextInjector.js` | ✅ 존재 |
| 모델 레지스트리 SSOT | `modelRegistry.js` | ✅ 검증 완료 |
| 메타인지 시스템 프롬프트 | `ariDaemon.js` L49-92 | ✅ 기본 설계됨 |

### 갭(Gap) — 현재 Intelligence를 제한하는 요소 ❌

| 갭 | 문제 | 임팩트 |
|---|---|---|
| **도구가 없음** | 검색 외 아리가 실제로 '행동'하는 도구가 없음 | 대화만 하고 아무것도 못 시킴 |
| **컨텍스트 압축 전략 없음** | 20턴 초과 시 단순 slice(-40) 처리 | 중요 맥락 유실 위험 |
| **캘린더/태스크 인식 없음** | 현재 칸반 보드 상태를 아리가 모름 | "루카가 지금 뭐 하는지" 모름 |
| **파일 읽기 도구 없음** | 대표님 문서를 참조 못 함 | "이 문서 분석해줘" 불가능 |
| **자율 태스크 생성 없음** | 대화 중 루카/피코에게 직접 위임 불가 | 수동 칸반 등록 필요 |
| **응답 스타일 고정** | 모든 대화가 동일한 톤/형식 | 상황별 유연성 부족 |

---

## 2. 🎯 목표 설계 (To-Be): "진짜 비서보다 똑똑한 비서"

```
대표님 메시지
      │
      ▼
┌─────────────────────────────────────────────┐
│           아리 지능 레이어 (5050)             │
│                                             │
│  ┌──────────┐   ┌────────────────────────┐  │
│  │ 의도 분류 │──▶│   도구 선택 & 실행      │  │
│  │(intent)  │   │  - Google Search       │  │
│  └──────────┘   │  - 칸반 태스크 생성     │  │
│                 │  - 파일 읽기/분석       │  │
│  ┌──────────┐   │  - 크루 현황 조회       │  │
│  │ 장기 기억 │   │  - 캘린더 조회         │  │
│  │(DB 저장) │   └────────────────────────┘  │
│  └──────────┘                               │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ 지능형 시스템 프롬프트 (Dynamic)      │   │
│  │ strategic_memory + 실시간 상황 주입  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
      │
      ▼
   스트리밍 응답 → 대표님
```

---

## 3. 🔧 도구(Tool) 설계 — 핵심

아리가 말만 하는 것이 아니라 **행동**하려면 Function Calling 도구가 필요합니다.
Gemini 2.5 Flash는 이를 완전히 지원합니다.

### 3-1. 장착할 도구 목록 (우선순위순)

#### [도구 1] `googleSearch` — 이미 존재 ✅ (유지)
- **용도**: 실시간 뉴스, 날씨, 환율, 주가 등
- **상태**: 구현됨

#### [도구 2] `createKanbanTask` — ❌ 신규 구현 필요
```javascript
// 아리가 대화 중에 "루카, 이 작업 맡아줘"를 실행 가능하게
{
  name: "createKanbanTask",
  description: "특정 크루원에게 업무를 위임하는 칸반 태스크를 생성합니다. 사용자가 '루카한테 시켜', '이거 태스크로 만들어줘'라고 하면 호출합니다.",
  parameters: {
    title: String,        // 태스크 제목
    assigneeId: String,   // 담당자 (luca, nova, pico 등)
    description: String,  // 태스크 상세 내용
    priority: String,     // high / medium / low
    taskType: String      // DEEP_WORK / CONTENT / MEDIA / RESEARCH
  }
}
```

#### [도구 3] `getCrewStatus` — ❌ 신규 구현 필요
```javascript
// 아리가 현재 크루원들의 업무 상태를 실시간으로 파악
{
  name: "getCrewStatus",
  description: "크루원의 현재 진행 중인 태스크와 상태를 조회합니다. '루카 지금 뭐 해?', '대기 중인 태스크 있어?' 등에 호출합니다.",
  parameters: {
    agentId: String   // 선택적. 없으면 전체 크루 조회
  }
}
```

#### [도구 4] `readWorkspaceFile` — ❌ 신규 구현 필요
```javascript
// 대표님 문서를 아리가 직접 읽고 분석
{
  name: "readWorkspaceFile",
  description: "MyCrew 워크스페이스의 특정 파일을 읽어 분석합니다. '이 문서 요약해줘', '기획안 검토해줘' 등에 활용합니다.",
  parameters: {
    filePath: String   // 파일 경로
  }
}
```

#### [도구 5] `saveToMemory` — ❌ 신규 구현 필요
```javascript
// 중요한 정보를 영구 DB에 저장 (대화 종료 후에도 기억)
{
  name: "saveToMemory",
  description: "대표님이 중요하게 언급한 내용, 결정 사항, 업무 맥락을 장기 기억 DB에 저장합니다.",
  parameters: {
    category: String,  // strategy / decision / preference / task
    content: String    // 저장할 내용
  }
}
```

---

## 4. 🧩 지능형 시스템 프롬프트 설계

현재 시스템 프롬프트의 문제: **`strategic_memory.md` 전체를 슬라이스해서 붙여넣는 방식**  
→ 중요한 내용이 3,000자 제한으로 잘림 (contextInjector.js L46)

### 4-1. 개선안: Dynamic Context Assembly

```
[FIXED LAYER] — 절대 변하지 않는 아리의 정체성 (500자 이내)
  - 아리가 누구인가
  - 소통 스타일 원칙
  - 도구 사용 판단 기준

[DYNAMIC LAYER 1] — 오늘의 상황 (매 대화마다 갱신)
  - 현재 날짜/시각 (KST)
  - 대기 중인 태스크 수
  - 최근 완료된 태스크

[DYNAMIC LAYER 2] — 프로젝트 맥락 (세션 시작 시 1회 로드)
  - strategic_memory.md 핵심 요약 (전체가 아닌 압축본)
  - 크루원 명단 및 역할
  - 현재 진행 중인 Phase

[DYNAMIC LAYER 3] — 장기 기억 (DB에서 관련 기억 검색)
  - 이전 대화에서 저장된 대표님 선호/결정 사항
  - 반복되는 패턴 및 요청 유형
```

### 4-2. strategic_memory 압축본 (아리 전용)

> strategic_memory.md가 아리를 제한하는 이유: 전체 문서가 인프라 용어로 가득해 너무 기술적이며, 
> 아리가 일상 대화 중 불필요한 정보를 처리하게 함.

**해결**: `strategic_memory.md`와 별도로 `ARI_BRAIN.md` 파일 생성  
→ 아리에게 주입할 **압축된 세계관**만 담는 전용 파일

---

## 5. 💾 컨텍스트 관리 전략 (기억력)

### 현재 문제
```javascript
// ariDaemon.js L142
if (conversationHistory.length > 40) {
  conversationHistory = conversationHistory.slice(-40);  // ❌ 단순 자르기
}
```

### 개선안: 3-tier 기억 구조

```
[Tier 1] 즉각 메모리 (In-Memory)
  - 현재 대화 세션의 최근 10턴 (빠른 접근)

[Tier 2] 세션 요약 (DB)
  - 세션 종료 시 Gemini에게 요약 생성 요청 → SQLite 저장
  - 다음 세션 시작 시 요약본 자동 주입

[Tier 3] 장기 기억 (DB - 영구)
  - saveToMemory 도구로 명시적으로 저장한 내용
  - 전략적 결정, 대표님 선호도, 중요 합의 사항
```

**구현 파일**: `ai-engine/services/memoryService.js` (신규)

---

## 6. 🗣️ 응답 스타일 매트릭스

아리가 상황에 따라 다르게 반응해야 합니다:

| 상황 | 응답 스타일 | 예시 |
|---|---|---|
| 일상 대화 | 짧고 친근 | "네, 바로 찾아볼게요 😊" |
| 실시간 정보 요청 | 검색 후 결과 요약 | "방금 검색했는데요, 오늘 원/달러 환율은 ~" |
| 작업 위임 요청 | 확인 + 즉시 처리 | "루카에게 '~' 태스크를 방금 등록했습니다" |
| 복잡한 분석 요청 | 칸반 위임 안내 | "깊이 있는 분석이 필요한 작업이네요. 루카 보드에 등록할까요?" |
| 긴급/우선순위 높음 | 빠르고 명확 | "즉시 처리하겠습니다. [결론]" |
| 모호한 요청 | 핵심 질문 1개 | "혹시 A를 원하시는 건가요, B인가요?" |

---

## 7. 📁 구현 파일 계획

### 신규 생성 파일

| 파일 | 역할 |
|---|---|
| `ai-engine/services/memoryService.js` | 3-tier 기억 관리 (Tier 2, 3 담당) |
| `ai-engine/tools/kanbanTool.js` | createKanbanTask 도구 구현 |
| `ai-engine/tools/crewStatusTool.js` | getCrewStatus 도구 구현 |
| `ai-engine/tools/fileReaderTool.js` | readWorkspaceFile 도구 구현 |
| `docs/ARI_BRAIN.md` | 아리 전용 압축 세계관 (시스템 프롬프트 원본) |

### 수정 파일

| 파일 | 수정 내용 |
|---|---|
| `ai-engine/ariDaemon.js` | 도구 통합, 동적 시스템 프롬프트 레이어 적용, 컨텍스트 압축 전략 |
| `ai-engine/tools/contextInjector.js` | 3,000자 제한 해제, ARI_BRAIN.md 주입으로 교체 |

---

## 8. 🚀 구현 우선순위 (Sprint 계획)

### Sprint 2-A (이번 주, 임팩트 최고)
1. **`ARI_BRAIN.md` 작성** — 아리 전용 압축 세계관 (코드 없음, 문서 작업)
2. **`kanbanTool.js` 구현 + ariDaemon.js 연결** — 즉각 위임 능력 부여
3. **`getCrewStatus` 구현** — 아리가 팀 현황 파악 가능

### Sprint 2-B (다음 주)
4. **`memoryService.js` 구현** — 3-tier 기억 구조 (세션 요약 저장)
5. **동적 시스템 프롬프트 레이어** — Fixed + Dynamic 분리
6. **`fileReaderTool.js`** — 문서 분석 능력

### Sprint 3 (추후)
- 음성 입력 연동 (Gemini Live API)
- 이미지 분석 (Vision 실시간)
- 캘린더 연동 (Google Calendar API)

---

## 9. ✅ 성공 기준 ("완성" 판정 조건)

- [ ] "오늘 트렌드 뉴스 알려줘" → 구글 검색 후 요약 응답
- [ ] "루카한테 시스템 리팩토링 시켜줘" → 칸반 태스크 자동 생성 + 확인 메시지
- [ ] "루카 지금 뭐 하고 있어?" → 칸반 보드 실시간 조회 후 답변
- [ ] "저번에 내가 아리한테 한 얘기 기억해?" → 세션 간 기억 유지 확인
- [ ] 세션 재시작 후에도 이전 합의 사항 / 선호도 기억

---

*루카(Luca) 작성 — 아리는 말만 하는 봇이 아니라, 행동하고 기억하는 비서실장이 되어야 합니다.*
