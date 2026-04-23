# 🤝 AI 에이전트 판정 연동 시스템 (Agent Verdict Bridge)

> **구현일**: 2026-04-23  
> **구현자**: Sonnet  
> **Phase**: 25 — 멀티에이전트 비전 검수 시스템 일부  
> **상태**: ✅ 구현 완료

---

## 1. 개요

Prime, Sonnet, Luca 세 AI 에이전트가 Antigravity 내에서 VideoLab/ImageLab의 콘텐츠를 검수한 뒤, **추가 API 비용 없이** 판정 결과를 VideoLab 채팅 패널에 실시간으로 전달하는 시스템입니다.

```
Antigravity 세션 (Prime/Sonnet/Luca)
    ↓  분석 완료 후
    ↓  POST /api/videolab/review/agent-verdict
    ↓
Ari 서버 (server.js)
    ↓  판정 저장 + Socket.io 브로드캐스트
    ↓
VideoLab 채팅 패널 (VideoLabView.jsx)
    └─ PASS ✅ / FAIL ❌ / COMMENT 💬 뱃지와 함께 실시간 표시
```

---

## 2. 구현 파일 목록

| 파일 | 변경 유형 | 역할 |
|------|---------|------|
| `routes/videoLabRouter.js` | 신규 엔드포인트 추가 | 판정 수신 + 저장 + Socket 브로드캐스트 |
| `server.js` | 소켓 네임스페이스 추가 | `/review` 전용 실시간 채널 |
| `src/components/Views/VideoLabView.jsx` | 소켓 수신 + UI 추가 | 판정 버블 실시간 렌더링 |

---

## 3. API 스펙

### 3-1. 판정 전송

```
POST /api/videolab/review/agent-verdict
Content-Type: application/json
```

**Request Body:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `agent` | string | ✅ | `"Prime"` \| `"Sonnet"` \| `"Luca"` |
| `sessionId` | string | ✅ | 리뷰 세션 식별자 (VideoLab에서 자동 생성) |
| `verdict` | string | ✅ | `"PASS"` \| `"FAIL"` \| `"COMMENT"` |
| `content` | string | ✅ | 판정 내용 / 분석 메시지 |
| `focusedCard` | number\|null | - | 특정 씬/카드 타겟팅 (0-based), 전체는 null |
| `metadata` | object | - | 추가 데이터 (선택) |

**Response:**
```json
{
  "status": "ok",
  "verdictId": "verdict_1745382000_a3f2b",
  "record": {
    "id": "verdict_1745382000_a3f2b",
    "agent": "Prime",
    "sessionId": "session_1745381900",
    "focusedCard": 2,
    "verdict": "FAIL",
    "content": "Scene 3의 Proof 이미지 대비율이 부족합니다. 재생성 권고합니다.",
    "createdAt": "2026-04-23T08:10:00.000Z"
  }
}
```

### 3-2. 판정 이력 조회

```
GET /api/videolab/review/verdicts/:sessionId
```

---

## 4. 에이전트별 사용 예시

### curl 공통 포맷

```bash
curl -X POST http://localhost:4000/api/videolab/review/agent-verdict \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "에이전트명",
    "sessionId": "SESSION_ID",
    "focusedCard": null,
    "verdict": "PASS",
    "content": "판정 메시지"
  }'
```

### Prime — 콘텐츠 전략 검수

```bash
# 전체 PASS
curl -X POST http://localhost:4000/api/videolab/review/agent-verdict \
  -d '{"agent":"Prime","sessionId":"SESSION_ID","verdict":"PASS","content":"Hook 임팩트와 CTA 설득력 모두 기준 통과. 내일 게시 추천."}'

# 특정 씬 FAIL
curl -X POST http://localhost:4000/api/videolab/review/agent-verdict \
  -d '{"agent":"Prime","sessionId":"SESSION_ID","focusedCard":0,"verdict":"FAIL","content":"Scene 1 Hook 문장 18자 → 15자 이내 단축 필요."}'
```

### Luca — 디자인/레이아웃 검수

```bash
curl -X POST http://localhost:4000/api/videolab/review/agent-verdict \
  -d '{"agent":"Luca","sessionId":"SESSION_ID","focusedCard":2,"verdict":"COMMENT","content":"Scene 3 여백 32px — 최소 48px 권고. 가독성 저하 주의."}'
```

### Sonnet — 텍스트/톤앤매너 검수

```bash
curl -X POST http://localhost:4000/api/videolab/review/agent-verdict \
  -d '{"agent":"Sonnet","sessionId":"SESSION_ID","verdict":"PASS","content":"TTS A 운율 및 속도 적절. 전체 자막 가독성 기준 통과."}'
```

### JavaScript (Antigravity 내 코드 실행)

```js
async function sendVerdict({ agent, sessionId, focusedCard = null, verdict, content }) {
  const res = await fetch('http://localhost:4000/api/videolab/review/agent-verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, sessionId, focusedCard, verdict, content })
  });
  return res.json();
}

// 사용 예시
await sendVerdict({
  agent: 'Sonnet',
  sessionId: 'session_1745381900',
  focusedCard: 3,
  verdict: 'FAIL',
  content: 'Scene 4 Climax 반전 문장이 브랜드 보이스에서 벗어남. 수정 필요.'
});
```

---

## 5. 소켓 이벤트 구조

| 방향 | 이벤트 | 설명 |
|------|--------|------|
| 클→서 | `review:join_session` | 세션 룸 참여 + 이력 동기화 요청 |
| 서→클 | `review:history_sync` | 기존 판정 이력 일괄 전달 |
| 서→클 | `review:agent_verdict` | 새 판정 실시간 브로드캐스트 |
| 클→서 | `review:human_message` | 대표님 채팅 → 全참여자 전달 |

**소켓 네임스페이스**: `http://localhost:4000/review`

---

## 6. VideoLab UI 판정 표시

```
┌─────────────────────────────────────────────┐
│  🤝 AI Crew Feedback          🎯 Scene 3 PROOF │
├─────────────────────────────────────────────┤
│  🔵 Prime          PASS ✅                  │
│  "전체 흐름 완성도 높습니다"                 │
│                                             │
│  🟢 Luca           COMMENT 💬               │
│  "Scene 3 여백 32px → 48px 권고"            │
│                                             │
│  🟣 Sonnet         FAIL ❌                  │
│  "대비율 기준 미달. 재생성 권고"              │
│                                             │
│  대표님 ────────────────────────────────▶   │
│  "[Scene 3 포커스] 다시 만들어줘"           │
└─────────────────────────────────────────────┘
```

---

## 7. 판정 기준 가이드

| 판정 | 의미 | 사용 시점 |
|------|------|---------|
| `PASS ✅` | 기준 통과 | 담당 영역 모두 OK |
| `FAIL ❌` | 기준 미달, 수정 필요 | 재생성/수정 없이 업로드 불가 |
| `COMMENT 💬` | 의견/제안 (필수 아님) | 개선 권고 또는 참고용 |

**업로드 조건**: Prime + Luca + Sonnet **3인 모두 PASS** 시 발행 가능  
1인이라도 `FAIL` → 대표님 최종 판단 필요

---

## 8. 데이터 저장 위치

```
01_아리_엔진/
└── outputs/
    └── review_verdicts/
        └── session_XXXX.json   ← 세션별 판정 누적 저장
```

---

## 9. ImageLab 확장 방법

Phase 25 카드뉴스 검수에도 **동일 엔드포인트** 사용:

```js
// focusedCard에 카드 번호(0~4) 지정
await sendVerdict({
  agent: 'Luca',
  sessionId: 'cardnews_session_xxx',
  focusedCard: 1,          // Card 2 (problem 카드)
  verdict: 'FAIL',
  content: 'Card 2 대비율 3.2:1 — 4.5:1 이상 필요. HTML 재생성 요청.'
});
```

`sessionId`만 카드뉴스 전용으로 발급하면 완전히 동일하게 동작합니다.

---

*작성: Sonnet | 2026-04-23 17:12 KST*  
*연결 문서: Phase25_PRD.md | VideoLab_UI_PRD_v4.1.md*
