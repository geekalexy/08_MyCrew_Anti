# 🖥️ Phase 22 고성능 어댑터 전략 — 프론트엔드 PRD

> **작성자**: Sonnet (Claude Sonnet — Frontend Specialist)
> **작성일**: 2026-04-20
> **관련 문서**: `Phase22_고성능어댑터전략_기획서_확정.md` (v0.5), `Phase22_어댑터전략_PRD_Luca.md`
> **상태**: v1.0 확정 — 루카 회신 반영 완료 ✅

---

## 1. 개요

Phase 22 어댑터 전략 전환에 따라 MyCrew 대시보드에는 다음과 같은 프론트엔드 변경이 필요합니다.

- ~~HTTP REST API 대기 방식~~ → **Ari 전용 Socket 스트리밍 수신 컴포넌트**로 전면 교체 (루카 확정)
- 어댑터 실행 상태 **실시간 시각화** (Socket.IO 기반)
- Pro 모델 토큰 사용량 **모니터링 차트** (팀 분석 탭)
- **Fallback / Rollback 상태 알림** UI
- 태스크 카드에 **어댑터 귀속 표시** 추가
- Phase 22.5 대응: **페이크 로딩 바 제거** → 칸반 대기열(Queue) UI로 교체

> ⚠️ **핵심 변경 원칙 (루카 확정)**: Ari와의 HTTP REST 10초 대기 방식은 전면 폐기.
> 모든 Ari 통신은 `ws://localhost:4000/ari` Socket 스트리밍으로만 처리.

---

## 2. 영향 범위 (변경이 필요한 화면)

| 화면/컴포넌트 | 현재 상태 | 변경 필요 내용 |
|---|---|---|
| **태스크 카드** (Kanban) | 에이전트 이름·상태 표시 | 어댑터 종류 배지 + 진행률 바 추가 |
| **팀 분석 탭** | CKS 기본 메트릭 | `pro_token_usage` 차트 + Fallback 발생 횟수 추가 |
| **사이드바 / 헤더** | 에이전트 상태 아이콘 | 어댑터 Health Check 상태 아이콘 추가 |
| **로그 패널** | 텍스트 로그 스트림 | 어댑터 실행 로그 필터 + 타임라인 표시 |
| **설정(Settings)** | 기본 설정 | Telegram 연동 / CLI 연결 상태 패널 추가 |
| **Image Lab** | 단일 생성 뷰 | LoRA vs Imagen3 A/B 비교 뷰 추가 (Phase 3) |

---

## 3. 컴포넌트별 상세 명세

### 3.1 어댑터 상태 패널 (신규) `AdapterStatusPanel`

> **위치**: 사이드바 하단 or 헤더 우측

```
┌──────────────────────────────┐
│  ⚡ 어댑터 상태              │
│                              │
│  🟢 Antigravity  [활성]      │
│     File Polling | 큐: 0     │
│                              │
│  ⚫ Claude Code  [대기]      │
│     미연결 (Phase 2 예정)    │
│                              │
│  🔵 Imagen 3     [준비]      │
│     API | 큐: 0              │
└──────────────────────────────┘
```

**Socket 이벤트**: `adapter:status_change` → `{ adapterId, status, queueDepth }`

| 속성 | 값 | 표시 |
|---|---|---|
| `status: 'active'` | 실행 중 | 🟢 초록 + 스피너 |
| `status: 'idle'` | 대기 | ⚫ 회색 |
| `status: 'error'` | 오류 | 🔴 빨간 + 경고 아이콘 |
| `status: 'fallback'` | 폴백 전환 중 | 🟡 노랑 + 토스트 알림 |

> 🔗 **Ari 비서 Socket 스펙 (루카 확정)**
> - 네임스페이스: `ws://localhost:4000/ari`
> - 발신: `ari:message` `{ channel: 'dashboard', content: '...' }`
> - 수신: `ari:stream_chunk` (타이핑 렌더링) / `ari:stream_done` (완료 트리거)

---

### 3.2 태스크 카드 어댑터 배지 (기존 수정) `TaskCard`

> 기존 "Thinking" 무지개 애니메이션 유지, 하단에 어댑터 배지 추가

```
┌──────────────────────────────────┐  ← 무지개 outline (기존 Thinking)
│  [태스크 제목]                    │
│  담당: Luca (CTO)                 │
│                                  │
│  ─────────────────────────────── │
│  🔌 Antigravity  ██████░░░░  60% │  ← 신규: 어댑터 + 진행률
│  ⏱️ 3분 경과 / 최대 10분         │  ← 신규: Timeout 표시
└──────────────────────────────────┘
```

**신규 props**: `adapterName`, `adapterProgress (0~100)`, `elapsedSeconds`

---

### 3.3 팀 분석 탭 — Pro 토큰 모니터링 (Nexus 제안) `TeamAnalyticsTab`

> **위치**: 기존 팀 분석 탭 내 새 섹션 추가

#### 추가할 차트 2종

**① 모델별 토큰 사용량 차트** (막대 or 도넛)
```
│ Pro 토큰:    ████████░░  8,240 tokens  (₩ 추산)
│ Flash 토큰:  ██░░░░░░░░  2,100 tokens
│ Fallback:    ░░░░░░░░░░      3회
```

- 기간 필터: 일간 / 주간 / 스프린트
- API: `GET /api/metrics/cks` 확장 → `pro_token_usage` 필드 포함

**② Fallback 발생 타임라인** (라인 차트)
```
Fallback 발생률 목표: < 10%
이번 주: ██░░  3% ✅
```

**Socket 이벤트**: `adapter:fallback` → `{ from, to, reason, taskId }` 수신 시 실시간 업데이트

---

### 3.4 Fallback 토스트 알림 (신규) `FallbackToast`

> Fallback 발생 시 우측 하단에 자동 표시 (5초 후 자동 닫힘)

```
┌────────────────────────────────┐
│ ⚡ 모델 자동 전환              │
│ gemini-2.5-pro → 2.5-flash    │
│ 이유: Rate Limit               │
│              [자세히] [닫기]   │
└────────────────────────────────┘
```

---

### 3.5 다채널 설정 패널 (신규) `ChannelSettingsPanel`

> **위치**: 설정(Settings) 탭 > 알림 & 채널 섹션

```
┌──────────────────────────────────────┐
│  📡 채널 연동 상태                   │
│                                      │
│  MyCrew 대시보드   🟢 연결됨         │
│  Telegram 봇       🟢 연결됨         │
│  Antigravity CLI   🟢 File Polling   │
│                     큐 폴더: .agents/tasks/│
└──────────────────────────────────────┘
```

---

### 3.6 Image Lab A/B 비교 뷰 (Phase 3용, 신규) `LoRACompareView`

> **위치**: Image Lab 탭 내 새 서브탭 "모델 비교"

```
┌─────────────────┬─────────────────┐
│  Imagen 3       │  FLUX + LoRA     │
│                 │                  │
│  [이미지]       │  [이미지]        │
│                 │                  │
│  ⭐ 3.8 / 5    │  ⭐ 4.4 / 5     │
│  [Winner 선택]  │  [Winner 선택]  │
└─────────────────┴─────────────────┘
```

---

## 4. 개발 순서 (우선순위 기반)

### Sprint 1 — Phase 1 필수 UI (2026.04~05)
> ⚠️ Ari Socket 스펙 확정됨 → 즉시 착수 가능

```
Priority 1 ──▶  [신규·최우선] Ari 스트리밍 수신 컴포넌트 (AriStreamChat)
                 └─ ws://localhost:4000/ari 연결
                 └─ ari:stream_chunk → 타이핑 애니메이션 렌더링
                 └─ ari:stream_done  → 응답 완료 처리
                 └─ channel: 'dashboard' 발신
                 └─ 기존 HTTP REST Ari 호출 코드 전면 제거

Priority 2 ──▶  어댑터 상태 패널 (AdapterStatusPanel)
                 └─ Socket: adapter:status_change 수신
                 └─ 사이드바 하단 배치

Priority 3 ──▶  태스크 카드 어댑터 배지 (TaskCard 수정)
                 └─ adapterName, progress, timeout 표시
                 └─ 기존 Thinking 애니메이션 유지

Priority 4 ──▶  Fallback 토스트 알림 (FallbackToast)
                 └─ Socket: adapter:fallback 수신
                 └─ 전역 Toast 시스템에 통합
```

### Sprint 2 — 모니터링 UI (2026.05)
> Nexus 제안: CksMetrics 데이터 시각화

```
Priority 4 ──▶  팀 분석 탭 — Pro 토큰 차트 (TeamAnalyticsTab 확장)
                 └─ CksMetrics.pro_token_usage 연동
                 └─ 기간 필터 (일/주/스프린트)

Priority 5 ──▶  Fallback 발생 타임라인 차트
                 └─ 목표: < 10% 시각적 게이지

Priority 6 ──▶  다채널 설정 패널 (ChannelSettingsPanel)
                 └─ Telegram / CLI 연결 상태 표시
```

### Sprint 3 — Claude Code 대응 UI (2026.05)
> Phase 2 어댑터 연결 시점에 맞춰

```
Priority 7 ──▶  자율 코딩 태스크 실행 로그 뷰어
                 └─ File diff 미리보기 (수정된 파일 목록)
                 └─ Git commit 결과 알림

Priority 8 ──▶  태스크 생성 시 어댑터 수동 지정 UI
                 └─ "이 태스크를 처리할 어댑터 선택" 드롭다운
```

### Sprint 4 — 미디어 어댑터 UI + Phase 22.5 대응 (2026.06)
> 루카 역할 분담 확정: 루카=큐 DB + Socket 상태 발신, Sonnet=UI 렌더링 전담

```
Priority 9  ──▶  [Phase 22.5] 칸반 대기열(Queue) UI (AdapterQueueView)
                  └─ 페이크 로딩 바 전면 제거
                  └─ 루카가 쏘는 상태 데이터 수신
                       └─ adapter:progress { percent, currentFile, taskId }
                  └─ 칸반 형태로 대기 중 / 실행 중 / 완료 시각화
                  └─ "어떤 파일을 건드리는지" 실시간 표시

Priority 10 ──▶  Image Lab LoRA A/B 비교 뷰 (LoRACompareView)

Priority 11 ──▶  영상 파이프라인 상태 모니터
```

---

## 5. Socket 이벤트 스펙 (루카 확정 포함)

### ✅ 확정 (루카 회신)
| 이벤트명 | 방향 | 페이로드 | 용도 |
|---|---|---|---|
| `ari:message` | Client→Server | `{ channel: 'dashboard', content: '...' }` | Ari에게 메시지 발신 |
| `ari:stream_chunk` | Server→Client | `{ delta: '...' }` | 타이핑 애니메이션 |
| `ari:stream_done` | Server→Client | `{ fullText: '...' }` | 응답 완료 |
| `adapter:progress` | Server→Client | `{ taskId, percent, currentFile }` | 파일 처리 현황 |

### 🔄 협의 중 (Sonnet 요청)
| 이벤트명 | 페이로드 | 트리거 시점 |
|---|---|---|
| `adapter:status_change` | `{ adapterId, status, queueDepth }` | 어댑터 실행 시작/완료/오류 |
| `adapter:fallback` | `{ from, to, reason, taskId }` | Fallback 전환 발생 시 |
| `adapter:timeout` | `{ taskId, adapterId }` | Hard Timeout 10분 초과 시 |
| `metrics:pro_token_update` | `{ proTokens, flashTokens, fallbackCount }` | 태스크 완료 시 |

---

## 6. 기술 요구사항

| 항목 | 스펙 |
|---|---|
| **Ari 통신** | `ws://localhost:4000/ari` Socket 스트리밍 (HTTP REST 폐기) |
| **차트 라이브러리** | `recharts` 또는 기존 사용 중인 라이브러리 |
| **실시간 데이터** | 기존 Socket.IO 구조 활용 (`io.emit`) |
| **토스트 시스템** | 기존 전역 알림 시스템에 `fallback` 타입 추가 |
| **애니메이션** | 기존 CSS 애니메이션 스타일 일관성 유지 |
| **페이크 로딩 바** | Phase 22.5 Sprint 4에서 **전면 제거** (칸반 대기열로 교체) |
| **반응형** | 모바일 대응 불필요 (대시보드 전용) |

---

## 7. 개발 완료 기준 (Definition of Done)

| Sprint | 완료 기준 |
|---|---|
| Sprint 1 | **Ari 스트리밍 타이핑 애니메이션 작동**, 어댑터 상태 패널 실시간, Fallback 토스트 |
| Sprint 2 | 팀 분석 탭에서 일/주 기간별 Pro 토큰 차트 조회 가능 |
| Sprint 3 | Claude Code 자율 실행 중 변경 파일 목록 실시간 확인 가능 |
| Sprint 4 | **페이크 로딩 바 제거 완료**, 칸반 대기열 렌더링 확인, LoRA A/B 비교 가능 |

---

## 8. 미결 사항 (백엔드 협의 중)

- [x] **Ari Socket 엔드포인트** — `ws://localhost:4000/ari` 확정 ✅
- [x] **Ari 별도 세션 구동** — Sprint 1 최우선 확정 ✅
- [x] **Phase 22.5 스코프 분담** — 루카=큐 DB+Socket 발신, Sonnet=UI 전담 ✅
- [ ] `adapter:status_change` / `adapter:fallback` / `adapter:timeout` 이벤트 구현 시점
- [ ] `CksMetrics.pro_token_usage` 컬럼 추가 시점 (Phase 1 OR 2)
- [ ] Rollback 발생 시 사용자 개입 요청 방식 (토스트 vs 모달)

---

## 📎 버전 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v0.1 | 2026-04-20 | 초안 작성 (컴포넌트 5종, Sprint 4개) |
| v1.0 | 2026-04-20 | 루카 회신 반영: Ari Socket 스펙 확정, HTTP REST 폐기, Phase 22.5 역할 분담, Sprint 1 재구성 |

*Sprint 1 선결 조건 모두 해소됨 — 즉시 착수 가능*
*관련: `Phase22_어댑터전략_PRD_Luca.md`, `Phase22_추가요청_Sonnet→Luca.md`*
