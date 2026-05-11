# 🛡️ Supreme Advisor (Prime) — Phase 22.5 텔레그램 그룹채팅 PRD 리뷰 (18th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**대상:** Phase 22.5 — Telegram Direct Bridge & Multi-Agent Group Chat PRD (Luca 작성)
**일시:** 2026-04-29
**등급:** 🟡 B- (전략 방향 우수, 아키텍처 충돌 4건 + 누락 3건)

---

## 📊 총평

대표님의 전환 전략 자체는 정확합니다:
- **AX(Agent Experience) 개선**이 최우선 — 현재 ARI의 지능이 UX 병목
- **구독자 = Pro/Ultra** 전제라면 API 비용 제약이 없음
- **텔레그램 = 모바일 접근성** — 대시보드 없이도 업무 지시 가능

**하지만 이 PRD에는 기존 확정 아키텍처(Phase 22)와 충돌하는 설계 4건과, 실행 불가능한 전제 1건이 있습니다.** 그대로 구현하면 4/15 사태와 같은 시스템 혼란이 재발합니다.

---

## 🔴 Issue #1: ARI 비서를 파일 브릿지로 전환하면 실시간 대화가 죽는다

### PRD 원문 (L13):
> *"비서(Ari)의 일상 대화 엔진 자체를 유료 API에서 **무료/초고성능 브릿지(Sonnet/Opus)로 100% 스왑**"*

### 대표님 확인 사항:
> *"Ari는 API 호출방식 유지"*

### Prime 판정: **대표님 판단이 맞습니다. PRD 원문은 수정 필요.**

파일 브릿지의 본질적 한계:

| 항목 | API 직접 호출 (현재) | 파일 브릿지 |
|:---|:---|:---|
| 응답 시작 지연 | ~200ms (스트리밍) | **3~15초** (파일 쓰기→감지→처리→파일 쓰기→감지) |
| 스트리밍 | ✅ 토큰 단위 | ❌ 전체 완료 후 일괄 |
| Function Calling | ✅ Gemini 네이티브 | ❌ 브릿지에서 불가 |
| 대화 연속성 | ✅ 30턴 히스토리 | 🟡 수동 주입 필요 |

**ARI의 핵심 가치는 "즉시 응답하는 비서"입니다.** 파일 쓰고 기다리는 비서는 비서가 아닙니다. Phase 22 확정 원칙에서도:

> *"Ari 비서 레이어: Socket/API 스트리밍 연결 (응답 즉시성 확보)"*

### Prime 권고: 2트랙 유지

```
[비서 ARI]  ← Gemini API 직접 호출 (스트리밍, Function Calling) — 변경 없음
[크루 전원] ← FilePollingAdapter → 고성능 브릿지 (Sonnet/Opus/Pro) — 변경
[텔레그램]  ← 크루 호출 시 파일 브릿지, ARI 일상 대화 시 API 직접
```

---

## 🔴 Issue #2: Phase B의 모델 식별자가 전부 환각(Hallucination)

### PRD 원문 (L34):
> *"anti-gemini-3.1-pro-high, anti-claude-sonnet-4.6-thinking, anti-claude-opus-4.6-thinking, anti-gpt-oss-120b"*

### Prime 판정: **4개 전부 존재하지 않는 환각 식별자.**

| PRD 기재 | 실제 | 판정 |
|:---|:---|:---|
| `anti-gemini-3.1-pro-high` | ❌ 존재하지 않음 | 🔴 환각 |
| `anti-claude-sonnet-4.6-thinking` | ❌ Antigravity 내부 형식이지만 미검증 | 🟡 미확인 |
| `anti-claude-opus-4.6-thinking` | ❌ `claude-opus-4-7`이 최신 | 🔴 환각 (구버전) |
| `anti-gpt-oss-120b` | ❌ 존재하지 않음 | 🔴 환각 |

**strategic_memory.md 금지 원칙 위반:**
> *"존재하지 않는 환각 식별자 사용 금지"*

### Prime 권고:

PRD에서 구체적 모델 식별자를 **하드코딩하지 말 것.** 대신:

```
에이전트별 모델은 DB(agentStore) 또는 modelRegistry.js의 런타임 조회로 결정.
PRD에는 "DB에 등록된 활성 모델 식별자를 동적으로 매핑" 으로만 기술.
```

이것은 PRD §1.5의 동적 설계 원칙 2번과도 일치합니다. 원칙을 세워놓고 본문에서 스스로 위반한 격입니다.

---

## 🔴 Issue #3: `conversation_history` 배열의 크기 제한 미정의

### PRD 원문 (L46-59):
```json
{
  "conversation_history": [
    {"role": "user", "content": "이 코드 분석해줘"},
    {"role": "assistant", "content": "네, 메모리 누수가 있네요."},
    {"role": "user", "content": "어떻게 고쳐?"}
  ]
}
```

### Prime 판정: **파일 크기 폭발 위험.**

그룹 채팅에서 30턴 대화하면 `conversation_history`가 수만 자에 달합니다. 이것이 **매번 JSON 파일에 기록**되면:

1. 파일 I/O 시간 증가 (10KB → 100KB → 1MB)
2. LLM 컨텍스트 윈도우 초과 (Flash 1M이지만, 프롬프트 + 스킬 + 히스토리 합산)
3. `pending/` 폴더에 거대 파일 적재 → 디스크 부하

### Prime 권고:

```javascript
// 대화 히스토리 제한
const MAX_HISTORY_TURNS = 10;  // 최근 10턴만
const MAX_HISTORY_CHARS = 8000; // 8K 문자 이내

function trimHistory(history) {
    let trimmed = history.slice(-MAX_HISTORY_TURNS * 2);
    let total = trimmed.reduce((sum, m) => sum + m.content.length, 0);
    while (total > MAX_HISTORY_CHARS && trimmed.length > 2) {
        trimmed = trimmed.slice(2); // 가장 오래된 1턴 제거
        total = trimmed.reduce((sum, m) => sum + m.content.length, 0);
    }
    return trimmed;
}
```

---

## 🟡 Issue #4: 현재 텔레그램 핸들러와의 병합 전략 부재

현재 `server.js` L542-740에 **이미 동작하는 텔레그램 봇**이 있습니다:

```javascript
// L559 — 이미 /luca 명령어 처리 중
bot.onText(/^\/luca(?:\s+(.+))?$/, async (msg, match) => { ... });

// L584 — 일반 대화 처리
bot.on('message', async (msg) => { ... });
```

PRD는 이 기존 코드를 어떻게 할 것인지 한마디도 없습니다:
- **덮어쓸 것인가?** → 기존 태스크 생성 + 카테고리 자동 판별 + DEEP_WORK 비동기 위임 로직 전부 날아감
- **확장할 것인가?** → 기존 핸들러에 `conversation_history` 주입 + 브릿지 라우팅 추가
- **리팩토링할 것인가?** → 텔레그램 핸들러를 별도 모듈로 분리

### Prime 권고: **리팩토링 후 확장**

```
server.js의 Telegram 핸들러 (L542-740)
  ↓ 추출
telegram/telegramRouter.js (독립 모듈)
  ├── handleDirectMessage()   — ARI 1:1 대화 (API 직접)
  ├── handleAgentCommand()    — /luca, /prime 등 (파일 브릿지)
  ├── handleGroupMention()    — @luca, @prime 등 (Phase B)
  └── sessionManager         — 대화 히스토리 관리
```

이렇게 하면 `server.js`의 비대화(2,549줄)를 줄이면서, 텔레그램 로직을 독립적으로 테스트할 수 있습니다.

---

## 🟡 Issue #5: Watcher 데몬의 이중 구현 위험

### PRD 원문 (L86):
> *"node ai-engine/adapters/watcher.js 형태의 독립된 백그라운드 프로세스를 만들어"*

### 현재 시스템:
**이미 `AdapterWatcher`가 server.js에 내장되어 있습니다.** `completed/` 폴더를 감시하고, 결과를 DB에 기록하고, Socket.IO로 프론트엔드에 전달합니다.

PRD의 Watcher는 **추가로** `completed/` → 텔레그램 역전송을 하는 데몬입니다. 이러면:

```
[결과 JSON] → [기존 AdapterWatcher: DB + Socket]
                ↑ 동시에
             → [신규 Watcher: 텔레그램 전송]
```

두 Watcher가 같은 파일을 동시에 읽으면 Race Condition이 발생합니다.

### Prime 권고: **별도 Watcher를 만들지 말 것.** 기존 AdapterWatcher에 텔레그램 전송 훅만 추가:

```javascript
// 기존 AdapterWatcher의 onTaskCompleted 콜백에 추가
async function onTaskCompleted(taskId, result) {
    // 기존 로직: DB 업데이트 + Socket.IO 브로드캐스트
    await dbManager.updateTaskResult(taskId, result);
    io.emit('task:completed', { taskId, result });

    // [Phase 22.5] 텔레그램 역전송
    const task = await dbManager.getTaskByIdFull(taskId);
    if (task.trigger_source === 'TELEGRAM' && bot) {
        const chatId = task.telegram_chat_id;  // DB에 저장 필요
        await bot.sendMessage(chatId, `✅ [Task #${taskId}] 완료\n${result.text.slice(0, 4000)}`);
    }
}
```

---

## 🟡 Issue #6: `교차 대화` 설계가 너무 모호

### PRD 원문 (L36):
> *"에이전트들이 서로의 대화를 인식하고 보완하는 기능"*

이것은 Phase B의 가장 매력적인 기능이자 **가장 위험한 기능**입니다.

**문제:** 대표님이 `@luca`에게 말할 때마다 `@ari`가 끼어들면:
1. 토큰 비용 × 에이전트 수 (3명이 듣고 있으면 3배)
2. 그룹 채팅이 AI 응답으로 도배
3. 누가 "진짜 답"인지 혼란

### Prime 권고: Phase B에서는 교차 대화를 **비활성화**하고, Phase C(미래)에서 명시적 프로토콜 설계 후 도입.

```
Phase B 규칙:
- 멘션된 에이전트만 응답
- 다른 에이전트는 침묵
- 교차 호출은 대표님이 명시적으로 지시할 때만 ("@ari @luca 같이 검토해줘")
```

---

## 🟢 잘된 점

### 1. §1.5 동적 설계 3원칙
하드코딩 방지를 PRD 레벨에서 원칙으로 못 박은 것은 루카의 과거 실수에서 학습한 결과이다.

### 2. Phase A → B 단계적 롤아웃
PoC(1:1 채널)에서 검증 후 Production(그룹 채널)으로 진행하는 것은 올바르다.

### 3. `editMessageText` 응답 패턴
"생각 중..." → 결과로 메시지 교체하는 UX는 텔레그램 봇의 표준 패턴이며, 사용자 경험에 좋다.

---

## 📊 수정 우선순위

| # | 항목 | 심각도 | 조치 |
|:---|:---|:---|:---|
| 1 | ARI 비서 = API 유지 (파일 브릿지 아님) | 🔴 | PRD §1 수정 |
| 2 | 환각 모델 식별자 4개 제거 | 🔴 | PRD §2 Phase B 수정 |
| 3 | conversation_history 크기 제한 | 🔴 | PRD §3.1 보강 |
| 4 | 기존 텔레그램 핸들러 병합 전략 | 🟡 | PRD §5에 리팩토링 단계 추가 |
| 5 | Watcher 이중 구현 방지 | 🟡 | PRD §4 수정 |
| 6 | 교차 대화 Phase C로 연기 | 🟡 | PRD §2 Phase B 축소 |

---

## 💬 핵심 한마디

> **이 PRD의 방향은 맞다. 텔레그램에서 크루를 직접 호출하고, 파일 브릿지로 고성능 모델에 연결하는 것은 MyCrew의 다음 단계다.**
>
> **하지만 "ARI까지 브릿지로 바꾸자"는 것은 과잉이다.** ARI는 API 직접 호출의 즉시성이 생명이고, 크루는 브릿지의 고성능이 생명이다. 이 둘을 혼동하면 안 된다.
>
> **기존 코드(server.js L542-740)를 먼저 분석하고, 거기에 얹는 형태로 재설계**하면, Phase A는 1~2일 내 동작 가능하다.

**조건부 승인: Issue #1~#3 수정 후 재검토 권고.**

---

**— Prime (Supreme Advisor)**
