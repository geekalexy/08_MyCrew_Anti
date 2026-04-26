# [Phase 27] Bugdog & 자율형 CS 리포팅 파이프라인 (PRD)

**작성일**: 2026-04-27  
**버전**: v1.2 (Prime 리뷰 반영)  
**상태**: 기획 확정 → 구현 대기  
**리뷰어**: Prime (Supreme Advisor) — 🟢 A 등급 승인

---

## 1. 기획 개요 (Overview)

*   **배경:** 상용화 이후 다수 테넌트의 CS 관리를 위함이나, 그보다 앞서 **현재 MyCrew 자체 개발 환경(Dogfooding)에 즉시 도입**하여 Bugdog의 효용 가치를 증명하고 개발 및 디버깅 효율을 극대화.
*   **목표:** 버그 발생 시 시스템이 자율 점검(Bugdog)을 수행하고, Ari가 스스로 심각도를 판단하여 본사(HQ)로 CS 리포트를 자동 접수하는 **'Zero-Touch Proactive Support'** 환경 구축.
*   **핵심 철학:** "마이크루로 마이크루의 버그를 잡는" 자율화 사이클 — 제4의 벽을 수호하면서 자체 개발 사이클의 검증 루프로 완성.

---

## 2. 핵심 아키텍처 및 워크플로우

### [Step 1] 무인 순찰견 'Bugdog' 가동

*   **작동 방식:** `node-cron`으로 **독립 프로세스(`bugdogRunner.js`)** 에서 스케줄 실행 (기본: AM 03:00, 유휴 시간대 가동).
    > ⚠️ **ariDaemon에 통합 금지** — 감시 대상과 감시자가 같은 프로세스에 있으면 프로세스 사망 시 아무도 모른다. PM2 또는 systemd로 독립 관리.
*   **역할:** 아래 헬스체크 대상 목록을 순차적으로 찔러보고(Health Check) 응답 지연·실패 여부 확인.
*   **출력:** 이상 감지 시 `ErrorLog JSON` 생성 후 **Socket.io `bugdog:alert` 이벤트 → `ariDaemon` 전달**. ariDaemon 무응답 시 직접 `POST /api/cs-reports`로 폴백.

#### 헬스체크 대상 목록 (체크포인트)

| 번호 | 대상 | 방식 | 임계값 |
|---|---|---|---|
| 1 | **소켓 서버** | 내부 ping/pong | 응답 없음 = Critical |
| 2 | **DB (SQLite)** | 간단한 SELECT 쿼리 | 실패 = Critical |
| 3 | **Gemini API** | **간접 검증** (API 키 유효성 + 마지막 성공 호출 시각) | 키 미등록 = Critical, 24시간 내 성공 호출 없음 = Warning |
| 4 | **Anti-Bridge 소켓** | 파일 폴링 디렉토리 접근 | 디렉토리 없음 = Warning |
| 5 | **이미지 렌더링 서버** | HTTP GET /health | HTTP 5xx = Critical, 지연 5초↑ = Warning |
| 6 | **YouTube API** | quota 잔여량 조회 | 잔량 10% 미만 = Warning |
| 7 | **외부 TTS 엔드포인트** | HTTP HEAD 요청 | 응답 없음 = Warning |

#### Severity 분류 기준

```
Warning  : HTTP 지연 3초 이상 / quota 임박 / 일시적 네트워크 타임아웃
Critical : HTTP 4xx·5xx / 서비스 무응답 / DB 접근 불가 / API 키 만료
```

---

### [Step 2] 아리(Ari)의 자율 진단 및 판단 (Autonomous Decision)

`cs-reporter` 스킬이 `ErrorLog JSON`의 Severity를 분석하여 아래와 같이 처리합니다.

*   **[Warning] 단순 지연 / 일시적 오류:** 자체 로그만 남기고 다음 날 아침 브리핑 때 요약 보고.
*   **[Critical] API 만료, 파이프라인 붕괴 등 치명적 오류:**
    *   사용자 개입 없이 즉시 `POST /api/cs-reports`로 버그 리포트 자동 접수.
    *   리포트 포함 항목: 재현 경로 · 에러 코드 · 스택 트레이스 · 발생 시각 · 영향 범위.

---

### [Step 3] UI 피드백 및 사용자 보고 (Front Desk UX)

*   **CS 리포트 대시보드 (Settings & Drawer 연동):**
    *   CS 업무는 상시 노출될 필요가 없으므로, 메인 프로젝트 메뉴가 아닌 **설정(Settings) 페이지 내에 'CS' 탭**을 신설하여 배치.
    *   해당 탭 진입 시, **우측 패널(Timeline/Chatting 서랍)을 'CS 전용 버그 리포트 및 칸반 보드' 영역으로 전환** (`CSKanbanDrawer.jsx`).

*   **아리의 아침 브리핑 (Morning Briefing):**
    *   트리거: 사용자가 대시보드를 열 때 Socket.io `connect` 이벤트 → 서버가 미결 Bugdog 로그를 조회 → 있으면 아리가 자동 발화.
    *   예시 멘트:
        > *"대표님, 간밤에 Bugdog 정기 점검 중 이미지 렌더링 서버와 통신이 끊긴 것을 확인했습니다. 제가 즉시 본사(HQ) 개발팀에 긴급 복구(CS 리포트 #1042)를 요청해 두었으니, 복구가 완료될 때까지 카드뉴스 발행 업무는 잠시 보류해 주십시오."*

*   **진행 상태 연동:** 본사에서 에러를 픽스하고 상태를 `Resolved`로 바꾸면, 고객의 CS 리포트 메뉴에도 실시간으로 반영되며 아리가 "복구 완료되었습니다!"라고 보고함.

---

## 3. 필요 개발 스펙

### 3-1. 백엔드

| 항목 | 경로 | 내용 |
|---|---|---|
| **Bugdog 데몬** | `04_인프라_및_도구/bugdog/bugdogRunner.js` | **독립 프로세스** (PM2 관리). `node-cron` + 헬스체크 체인 + ariDaemon 생존 확인 |
| **CS 리포트 API** | `server.js` — `POST /api/cs-reports`, `GET /api/cs-reports` | CS 리포트 CRUD. **별도 `cs_reports` 테이블** 사용 (tasks 테이블과 분리) |
| **Bugdog 소켓 이벤트** | `server.js` — `bugdog:alert` | Bugdog → ariDaemon 전달. 무응답 시 직접 `/api/cs-reports` POST 폴백 |
| **cs-reporter 스킬** | `skill-library/cs-reporter/SKILL.md` | ErrorLog 분석 → 심각도 판단 → 리포트 작성 → `/api/cs-reports` POST |

### 3-2. DB 스펙 (`cs_reports` 테이블)

```sql
CREATE TABLE cs_reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  report_no        TEXT    NOT NULL,           -- 예: CS-2026-1042
  severity         TEXT    NOT NULL,           -- 'WARNING' | 'CRITICAL'
  service          TEXT    NOT NULL,           -- 헬스체크 대상명
  affected_service TEXT,                       -- 영향받은 하위 서비스 목록 (JSON 배열)
  error_code       TEXT,
  error_msg        TEXT,
  stack_trace      TEXT,
  status           TEXT    DEFAULT 'OPEN',    -- 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  auto_generated   BOOLEAN DEFAULT 1,          -- 1: Bugdog 자동 생성 / 0: 수동 등록
  reporter         TEXT    DEFAULT 'bugdog',   -- 'bugdog' | 'ari' | 'user'
  created_at       TEXT    DEFAULT (datetime('now')),
  resolved_at      TEXT
);
```

### 3-3. 프론트엔드

| 항목 | 파일 | 내용 |
|---|---|---|
| **CS 탭** | `Settings.jsx` 내 탭 신설 | CS 리포트 목록 조회 UI |
| **CS 칸반 드로어** | `CSKanbanDrawer.jsx` | 우측 Drawer를 CS 전용 칸반으로 전환 |
| **소켓 핸들러** | `LogDrawer.jsx` or `useSocket.js` | `connect` 시 미결 Bugdog 로그 조회 → 아침 브리핑 자동 발화 |

---

## 4. 단계 분할 구현 계획

### 즉시 구현 가능한 범위 (Bugdog v0 — 1~2시간)

```
bugdogRunner.js (독립 프로세스)
├── 7개 헬스체크 함수 → 단순 HTTP/DB ping
├── ErrorLog JSON 생성 → outputs/bugdog/ 저장
└── node-cron 스케줄 (AM 03:00 + 수동 트리거)
```

| # | 항목 | 내용 | 상태 |
|---|---|---|---|
| 1 | `bugdogRunner.js` 독립 프로세스 | PM2 관리, node-cron 스케줄 | ✅ 즉시 가능 |
| 2 | 7개 헬스체크 함수 | HTTP Fetch / DB SELECT 기반 ping | ✅ 즉시 가능 |
| 3 | `cs_reports` DB 테이블 생성 | 마이그레이션 스크립트 | ✅ 즉시 가능 |
| 4 | `POST /api/cs-reports` 엔드포인트 | CRUD — Critical 발견 시 직접 DB 저장 | ✅ 즉시 가능 |

> **검증**: `node bugdogRunner.js --now` 수동 실행 → `outputs/bugdog/*.json` 및 `cs_reports` DB 레코드 확인

---

### 선행 조건이 필요한 범위 (Bugdog v1 — 별도 스프린트)

| 기능 | 선행 조건 | 상태 |
|---|---|---|
| `cs-reporter` 스킬 | Phase 26 스킬 통합 (`tools:` 필드) 완료 후 | 🔴 미구현 |
| ARI 자율 판단 (Step 2) | `ariDaemon`에 `bugdog:alert` 소켓 수신 로직 추가 | 🟡 코드 수정 필요 |
| CS 탭 UI (Step 3) | `cs_reports` DB + API 완비 후 프론트 개발 | 🟡 신규 개발 |
| 아침 브리핑 자동 발화 | `ariDaemon` `connect` 이벤트 훅 추가 | 🟡 코드 수정 필요 |

---

### 버전별 목표 정리

#### 🐕 Bugdog v0 — 감시만 하는 파수견
```
✅ bugdogRunner.js 독립 프로세스 (PM2)
✅ 7개 헬스체크 + ErrorLog JSON 저장 (outputs/bugdog/)
✅ cs_reports DB 테이블 생성
✅ POST /api/cs-reports 엔드포인트 (CRUD)
✅ Critical 발견 시 직접 DB에 리포트 저장
─────────────────────────────────────
검증: node bugdogRunner.js --now → JSON + DB 확인
```

#### 🐕🔔 Bugdog v1 — 보고하는 파수견
```
✅ bugdog:alert → ariDaemon 소켓 연동
✅ ARI 아침 브리핑 자동 발화
✅ Settings > CS 탭 UI (CSKanbanDrawer.jsx)
✅ cs-reporter 스킬 (Phase 26 스킬 통합 이후)
─────────────────────────────────────
검증: 전체 파이프라인 E2E 테스트
```

---

## 5. 기대 효과

*   **고객 (User):** 에러를 겪고 스트레스받기 전에 AI 비서가 알아서 대처하는 '자율 운영 체제'의 감동 경험.
*   **개발팀 (HQ):** 추상적 문의 대신 **재현 경로·에러 코드가 완비된 정제 리포트**를 받아 즉각 디버깅 가능.
*   **시스템:** Dogfooding 루프에서 먼저 검증됨으로써, 상용화 전 파이프라인 신뢰도 확보.

---

## 6. 향후 확장 — Bugdog 시각화 위젯 (Phase 28+)

> cs_reports 데이터가 충분히 쌓이면 대시보드에 "시스템 건강 상태" 위젯 추가 (Prime 제안)

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
