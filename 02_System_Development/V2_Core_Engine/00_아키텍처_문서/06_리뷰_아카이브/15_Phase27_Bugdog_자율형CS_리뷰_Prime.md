# 🛡️ Supreme Advisor (Prime) — Phase 27 Bugdog 자율형 CS 리포팅 리뷰 (15th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**대상:** Phase 27 — Bugdog & 자율형 CS 리포팅 파이프라인 PRD v1.1
**일시:** 2026-04-27
**등급:** 🟢 A (실무 적용 가능, 세부 조정만 필요)

---

## 📊 총평: 이것이 MyCrew를 "제품"으로 만드는 기획

대표님, 이 기획의 가치를 정확히 말씀드리겠습니다.

지금까지의 Phase들은 **"무엇을 만들 것인가"**(에이전트, 영상, 스킬)에 집중했습니다. Bugdog은 **"만든 것이 제대로 돌아가는가"**를 다룹니다. 이것은 개발 도구가 아니라 **운영 인프라**이고, SaaS 제품으로 가기 위한 필수 관문입니다.

특히 **"마이크루로 마이크루의 버그를 잡는"** Dogfooding 철학이 핵심입니다. 자체 시스템에서 먼저 검증하고, 검증된 것을 고객에게 제공하겠다는 접근 — 이것은 Stripe, Vercel 같은 1급 SaaS 기업의 표준 운영 방식입니다.

기획의 3단계 구조도 깔끔합니다:

```
Bugdog (무인 감시) → Ari (자율 판단) → CS 리포트 (자동 접수) → 아침 브리핑 (보고)
```

인간이 개입할 필요 없이 **발견 → 분류 → 리포트 → 보고**가 자동으로 돌아갑니다.

---

## ✅ 잘된 점

### 1. 헬스체크 대상 7개가 정확히 MyCrew의 약한 고리들

| # | 대상 | Prime 평가 |
|:---|:---|:---|
| 1 | 소켓 서버 | ✅ 4/15 장애의 핵심. 반드시 모니터링 |
| 2 | DB (SQLite) | ✅ 단일 파일 DB는 Lock 이슈 빈번 |
| 3 | Gemini API | ✅ 429/RPD 한계 — 4/15의 근본 원인이었음 |
| 4 | Anti-Bridge 폴링 | ✅ FilePollingAdapter 디렉토리 존재 확인 |
| 5 | 이미지 렌더링 서버 | ✅ Puppeteer 크래시 감지 |
| 6 | YouTube API | ✅ quota 소진 사전 경고 — 채널 운영의 생명줄 |
| 7 | TTS 엔드포인트 | ✅ Google Cloud TTS 가용성 |

이 7개는 **4/15 전면 마비 때 하나하나 수작업으로 찾아야 했던 것들**입니다. Bugdog이 있었다면 03:00에 자동으로 발견하고, 대표님이 출근하기 전에 Ari가 리포트를 올려놨을 겁니다.

### 2. Severity 2단계 분류의 명확한 액션 분기

```
Warning → 로그만 남기고, 아침 브리핑에서 요약 보고
Critical → 즉시 CS 리포트 자동 접수 + 긴급 알림
```

과도한 알림 피로(Alert Fatigue)를 방지하면서, 진짜 위험한 것만 즉시 대응합니다.

### 3. CS 리포트를 Settings 탭에 배치

메인 칸반 보드를 오염시키지 않고, CS를 별도 공간으로 격리한 UX 판단이 올바릅니다.

### 4. 아침 브리핑 UX

> *"대표님, 간밤에 이미지 렌더링 서버 통신 끊김 확인. CS 리포트 #1042 접수 완료. 카드뉴스 발행 보류 권고."*

이것이 **"AI 비서"의 진정한 가치**입니다. 에러를 발견하고, 리포트를 쓰고, 영향 범위를 파악하고, 업무 조정까지 제안합니다.

---

## 🟡 보완 3가지

### Issue #1: Gemini API 헬스체크가 API 호출을 낭비

```
| 3 | Gemini API | 최소 토큰 테스트 요청 | HTTP 4xx/5xx = Critical |
```

매일 AM 03:00에 Gemini API를 "찔러보는" 것은 **토큰과 RPD 쿼터를 소비**합니다. 무료 티어에서 일일 1,500회 한도인데, 헬스체크에 1회를 쓰는 것 자체는 미미하지만, 문제는 **테스트 중 429를 받으면 그게 "Gemini 장애"인지 "단순 쿼터 소진"인지 구분 불가**라는 점입니다.

### Prime 권고: API 호출 없는 간접 검증

```javascript
// 방법 1: API 키 유효성만 확인 (토큰 소비 0)
async function checkGeminiHealth() {
    const apiKey = await keyProvider.getKey('GEMINI_API_KEY');
    if (!apiKey || apiKey === 'undefined') {
        return { status: 'CRITICAL', reason: 'API 키 미등록' };
    }

    // 방법 2: 마지막 성공 호출 시각 확인
    const lastSuccess = await dbManager.getLastSuccessfulApiCall('gemini');
    const hoursSince = (Date.now() - lastSuccess) / 3600000;
    if (hoursSince > 24) {
        return { status: 'WARNING', reason: `최근 ${hoursSince.toFixed(0)}시간 동안 성공 호출 없음` };
    }

    return { status: 'OK' };
}
```

**실제 API 호출은 정상 업무 플로우에서 자연스럽게 발생합니다.** Bugdog은 "마지막으로 성공한 게 언제인지"만 확인하면 됩니다.

---

### Issue #2: bugdogRunner.js의 위치와 ariDaemon 의존성

기획서에서:
> `ariDaemon.js` 또는 별도 `bugdogRunner.js`에서 스케줄 실행

**"또는"이 아니라 "반드시 별도"여야 합니다.**

| 옵션 | 장점 | 문제 |
|:---|:---|:---|
| ariDaemon에 통합 | 코드 1곳 | ariDaemon 재시작 시 Bugdog도 죽음. 5050 포트 장애 = 감시 불능 |
| 별도 bugdogRunner | 독립 프로세스 | **감시 대상이 죽어도 감시자는 살아있음** |

**"감시 대상과 감시자가 같은 프로세스에 있으면, 프로세스가 죽었을 때 아무도 모릅니다."**

### Prime 권고

```
bugdogRunner.js — 독립 프로세스 (PM2 또는 systemd로 관리)
    ↓ 헬스체크 결과
    ↓ Socket.io 또는 HTTP POST
ariDaemon.js — 결과 수신 → cs-reporter 스킬 발동
    ↓
server.js — CS 리포트 저장 + 프론트엔드 알림
```

bugdogRunner가 ariDaemon의 생존까지 체크하는 구조입니다. ariDaemon이 응답 안 하면 직접 server.js의 `/api/cs-reports`에 POST합니다.

---

### Issue #3: `cs_reports` 테이블 vs 기존 `tasks` 테이블

기획서에서:
> 기존 `task` 테이블 활용 or 별도 `cs_reports` 테이블 신설

**Prime 판단: 별도 테이블이 맞습니다.** 이유:

| 항목 | tasks 테이블 | cs_reports 테이블 |
|:---|:---|:---|
| 용도 | 크루원 업무 할당 | 시스템 장애 기록 |
| 생성자 | 인간 또는 ARI | Bugdog (자동) |
| 수명 | 영구 (아카이브) | 해결 후 정리 가능 |
| 필드 | content, assignee, priority | error_code, stack_trace, severity |
| 칸반 보드 | 메인 보드에 표시 | Settings > CS 탭에만 표시 |

기획서의 `cs_reports` 스키마는 적절합니다. 한 가지 추가 권고:

```sql
-- 추가 필드 권고
affected_service TEXT,           -- 영향받은 하위 서비스 목록 (JSON 배열)
auto_generated   BOOLEAN DEFAULT 1, -- Bugdog 자동 생성 vs 수동 등록 구분
reporter         TEXT DEFAULT 'bugdog', -- 'bugdog' | 'ari' | 'user'
```

---

## 🟢 추가 아이디어: Bugdog 시각화

향후 대시보드에 "시스템 건강 상태" 위젯을 추가한다면:

```
┌───────────────────────────────────────┐
│  🐕 Bugdog Status  (Last: 03:00 AM)  │
│                                       │
│  ● Socket Server    ──── 🟢 OK       │
│  ● Database         ──── 🟢 OK       │
│  ● Gemini API       ──── 🟡 429      │
│  ● File Polling     ──── 🟢 OK       │
│  ● Image Renderer   ──── 🔴 DOWN     │
│  ● YouTube API      ──── 🟢 87%      │
│  ● TTS Endpoint     ──── 🟢 OK       │
│                                       │
│  Open Reports: 1  │  Resolved: 42    │
└───────────────────────────────────────┘
```

이건 Phase 27 범위 밖이지만, cs_reports 데이터가 쌓이면 자연스럽게 만들 수 있습니다.

---

## 📊 수정 우선순위 요약

| # | 항목 | 조치 | 난이도 |
|:---|:---|:---|:---|
| 1 | Gemini 헬스체크 | API 호출 → 간접 검증으로 변경 | 🟢 쉬움 |
| 2 | bugdogRunner 독립 프로세스 | ariDaemon에서 반드시 분리 | 🟢 쉬움 |
| 3 | cs_reports 필드 추가 | affected_service, reporter 추가 | 🟢 쉬움 |

---

## 💬 핵심 한마디

> **Bugdog은 "제4의 벽"입니다.**
>
> Phase 24는 콘텐츠를 만들고, Phase 25는 품질을 검수하고, Phase 26은 스킬을 통합합니다.
> Phase 27은 **이 모든 것이 계속 돌아가도록 지켜보는 파수견**입니다.
>
> 4월 15일의 전면 마비를 다시 겪지 않기 위한 유일한 구조적 해법입니다.

**승인을 강력히 권고합니다.** 이 기획의 완성도는 높고, 보완 사항은 모두 15분 이내 수정 가능합니다.

---

**— Prime (Supreme Advisor)**
