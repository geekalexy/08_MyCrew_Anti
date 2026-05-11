# Phase 12: 맥락 인지형 에이전트 피드백 시스템

> **문서 분류**: 기술 아키텍처 / 시스템 설계  
> **작성자**: Luca (MyCrew CTO, Antigravity 상주)  
> **작성일**: 2026-04-12  
> **상태**: ✅ 구현 완료 (v2.1 — 에이전트 애니메이션 위계 및 텔레그램 설정 통합 완료)

---

## 배경 및 문제 인식

MyCrew 아리 엔진(v2)이 본격 가동되면서 예기치 못한 UX 문제가 수면 위로 올라왔다.

대표님이 대시보드 앞에 앉아 직접 태스크를 다루고 있는데도, 텔레그램이 아리의 활동 알림을 계속 뱉어냈다. 화면에서 이미 보고 있는 내용을 핸드폰에서 또 읽어야 하는 상황. **알림이 정보가 아니라 소음이 된 것**이다.

반대 상황도 문제였다. 외출 중에 텔레그램으로 지시를 내리면, 아리가 처리 중이라는 피드백이 없어서 제대로 접수됐는지 알 수 없었다. 에이전트는 열심히 일하는데, 대표님 입장에서는 블랙박스였다.

결론은 하나다. **"사용자가 어디 있는지에 따라 알림 채널을 달리해야 한다."**

---

## 설계 원칙

### 원칙 1: 컨텍스트가 채널을 결정한다

| 사용자 위치 | 에이전트 반응 | 텔레그램 알림 |
|---|---|---|
| 대시보드 앞 | 타임라인 + 인터랙션 패널에 즉각 노출 | **무음 처리** |
| 텔레그램 외부 | 실시간 확인 불가 | **즉각 피드백 발송** |

### 원칙 2: 알림은 압축해서 전달한다

에이전트의 날것 로그를 그대로 텔레그램에 뱉으면 안 된다. 대표님이 받아야 할 건 **"Task #65 처리 시작"** 같은 1~2줄짜리 결론이지, 500줄짜리 stdout이 아니다.

### 원칙 3: API 비용을 낭비하지 않는다

AI 요약은 에이전트 상태 전이(idle→active, active→done) 시점에만 호출한다. 매 로그마다 API를 호출하는 것은 무료 한도를 하루 만에 소진하는 자살행위다.

---

## 구현 내역 (v1.0)

### 1. Source 판별 자동화 (C3 해결)

```
POST /api/tasks/:id/comments  → source = 'DASHBOARD' (자동 주입)
socket.on('task:comment')     → source = 'DASHBOARD' (소켓 = 웹 클라이언트)
bot.on('message')             → source = 'TELEGRAM'  (봇 핸들러)
```

클라이언트가 source를 스스로 주장하게 하면 위장 공격에 취약하다. **서버가 요청 경로를 보고 자동으로 결정**하도록 설계했다.

### 2. broadcastLog 업그레이드

**이전**: 로그를 인메모리(Socket.io)로만 송출 → 1시간 후 요약할 데이터가 없음

**이후**: 
```js
export function broadcastLog(level, message, agentId, taskId, source = 'DASHBOARD') {
  dbManager.insertLog(level, message, agentId, taskId, source); // DB 영구 기록
  io.emit('log:append', { ... });                               // 실시간 대시보드
}
```

### 3. statusReporter.js (신규 엔진)

에이전트 시작 알림 전용 경량 보고기. 핵심 로직:

```
[에이전트 시작 감지]
   ↓
source === 'DASHBOARD' → 텔레그램 발송 스킵
source === 'TELEGRAM'  → 30초 쿨타임 확인
   ↓ (쿨타임 통과 시)
Gemini Flash → 1~2줄 요약 생성
   ↓
텔레그램 발송
```

**쿨타임 이유**: OMO 딥워크 태스크는 초 단위로 수십 줄의 stdout을 스트리밍한다. 이벤트 드리븐으로 짜면 단일 태스크 하나에 수백 회의 API 콜이 발생한다. 30초 쿨타임으로 완전 차단.

### 4. 일간 배치 보고 (매일 오전 8:30)

기존 와치독 스케줄러(5분 주기, 고착 태스크 감지)에 일간 보고 기능을 통합했다. **별도 스케줄러를 추가하지 않았다.** 두 개의 독립 setTimeout 체인이 돌면 타이밍 충돌과 중복 보고가 발생하기 때문이다.

```js
function isDailyReportTime() {
  const now = new Date();
  return now.getHours() === 8 && now.getMinutes() >= 30 && now.getMinutes() < 35;
}

async function runWatchdog() {
  // ... 고착 태스크 감지 (기존 동작 유지)

  // 일간 보고: 오늘 이미 보냈으면 스킵
  const today = new Date().toDateString();
  if (isDailyReportTime() && runWatchdog._lastBatchDate !== today) {
    await sendBatchReport();
    runWatchdog._lastBatchDate = today;
  }
}
```

### 5. DB 마이그레이션

`Log` 테이블 신설:
```sql
CREATE TABLE IF NOT EXISTS Log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT,
  message    TEXT NOT NULL,
  agent_id   TEXT,
  task_id    TEXT,
  source     TEXT,           -- 'DASHBOARD' | 'TELEGRAM' | 'SYSTEM'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 검증 결과 (2026-04-12 테스트)

| 테스트 케이스 | 결과 |
|---|---|
| 텔레그램 → "아리 소시안 기억나나?" 발송 | ✅ `🤖 ari 에이전트가 Task #65 작업을 시작했습니다.` 수신 확인 |
| 1시간 배치 보고 자동 발송 | ✅ Case A 고착 태스크 2건 + 활동 16건 집계 정상 수신 |
| Gemini Flash 요약 API 429 에러 시 | ✅ 템플릿 Fallback 자동 전환 (`(AI 요약 실패)` → 개선 완료) |

**발견된 이슈 및 조치:**
- `gemini-3-flash` 무료 플랜 일일 한도(RPD 20회) 초과 → **일간 보고에서 AI 요약 제거, 템플릿 기반 집계로 대체** (Quota 절약)
- `EADDRINUSE` 좀비 프로세스 → **`lsof -ti:4000 | xargs kill -9` 로 정리**

### Prime Review 후속 패치 (2026-04-12, v1.0 → v1.0.1)

> Prime(Opus) 교차 검증에서 발견된 W1/W2 이슈를 즉시 패치했습니다.

**[W1] 서버 재시작 시 6h/12h 모드 중복 발송 방지**

`_lastBatchAt`이 인메모리 변수라 서버 재시작 시 `0`으로 초기화되어 첫 와치독 사이클에 즉시 발송되는 버그 수정:

```js
// server.js — httpServer.listen() 내부 (부팅 시 1회 실행)
runWatchdog._lastBatchAt = Date.now(); // 재시작 직후 즉시 발송 방지
```

**[W2] 함수명·출력 텍스트 불일치 수정**

일간(24h) 데이터를 처리하면서 함수명이 `Hourly`로 남아있던 불일치 해소:

```js
// 이전
async generateHourlySummary(activities) { ... }
// 이후
async generateActivitySummary(activities) { ... }
```

출력 텍스트: `📋 [지난 1시간 활동 보고]` → `📋 [일간 활동 보고]`



---

## v1.1 개발 예정: 보고 주기 설정 UI

### 배경

현재 보고 시각(매일 08:30)이 코드에 하드코딩되어 있다. 대표님의 맥락에 따라 유연하게 바꿀 수 있어야 한다.

### 설계

**대시보드 Settings 페이지 → 텔레그램 알림 카드 추가**

```
[ 보고 모드 선택 ]
○ 보고 안 함
○ 6시간마다
○ 12시간마다
● 매일 지정 시각  → [08]시 [30]분

[ 💾 저장 ]
```

**데이터 흐름:**
```
[Settings UI 저장]
   → PUT /api/settings { key: 'telegram_report_mode', value: 'daily' }
   → PUT /api/settings { key: 'telegram_report_hour', value: '8' }
   → PUT /api/settings { key: 'telegram_report_minute', value: '30' }

[runWatchdog, 5분 주기]
   → getAllSettings() 로 설정값 로드  
   → mode에 따라 발송 조건 동적 판단
```

**변경 파일:**
- `SettingsView.jsx` — 텔레그램 알림 카드 신규 추가
- `server.js` — 허용 설정 키 추가 + 동적 주기 로직
- `database.js` — 추가 변경 불필요 (getAllSettings 재사용)

---

## 아키텍처 다이어그램

```
[대표님 - 대시보드]         [대표님 - 텔레그램]
       │                           │
       ▼                           ▼
[POST /api/tasks/:id/comments]  [bot.on('message')]
  source = DASHBOARD               source = TELEGRAM
       │                           │
       └──────────┬────────────────┘
                  ▼
           [broadcastLog]
                  │
          ┌───────┴──────────┐
          ▼                  ▼
    [DB에 저장]       [io.emit → 대시보드 타임라인]
    (Log 테이블)
          │
          ▼
   [statusReporter]
          │
   source === 'DASHBOARD'? ──→ 텔레그램 발송 건너뜀
          │
   source === 'TELEGRAM'?  ──→ 30초 쿨타임 체크
                                      │
                               [텔레그램 발송]
                           "🤖 ari 에이전트가 작업 시작"

[runWatchdog - 5분 주기]
   → 고착 태스크 감지 (Case A/B/C)
   → 오전 8:30 도달 시 일간 배치 보고 발송
       "📋 총 N건 | 에이전트: ari(X건), devteam(Y건)"
```

---

**[문서 버전 히스토리]**
- `v1.0` — 2026-04-12: Phase 12 초기 구현 완료 (Luca)
- `v1.0.1` — 2026-04-12: Prime Review W1/W2 패치 적용 (Sonnet → 즉시 대응)
  - W1: 서버 재시작 시 6h/12h 모드 중복 발송 방지 (`_lastBatchAt` 부팅 초기화)
  - W2: `generateHourlySummary` → `generateActivitySummary` 함수명 정확화
- `v1.1` — 2026-04-12: 보고 주기 설정 UI 추가 (SettingsView.jsx + server.js)
- `v2.0` — 2026-04-12: Agent Activity 상태 코드 세분화 (THINKING/EXPLORED/EDIT/WORKED) 및 핑퐁(할당자 복귀) 로직 구현
- `v2.1` — 2026-04-12: 2단계 애니메이션 위계(무지개 효과 클라이막스 적용) 설계 및 핑퐁 DB 성능 최적화 (Luca & Sonnet 릴레이)
