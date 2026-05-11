# [Phase 01-11] MyCrew 초기 설계 역사 아카이브

**작성:** Luca | **기간:** 2026-04-09 ~ 2026-04-12  
**참고:** 초기 Phase들은 단일 대화 세션에서 빠르게 진행되었으며, 이 문서는 프로젝트의 역사적 기록을 위해 Luca가 사후 복원한 아카이브입니다.

---

## Phase 01: 프로젝트 기반 구조 수립 (Workspace Scaffold)
**핵심 결정:**
- MyCrew를 단순 CLI 봇에서 **브릿지 서버(Node.js) + 대시보드(React)** 구조로 전환
- 아리(Ari)의 소속을 CLI 환경에서 `server.js` 내장 엔진으로 이식
- 레포지토리 구조: `01_아리_엔진`, `02_워크스페이스_대시보드` 2-Pillar 초기 수립

---

## Phase 02: 멀티 어댑터 AI 아키텍처 (Multi-Adapter Engine)
**핵심 결정:**
- Anthropic 단독 구조 → **Google Gemini 중심 멀티 어댑터** 구조로 피벗 (비용 효율성)
- `GeminiAdapter`, `AnthropicAdapter` 독립 모듈 설계
- 기본 모델: Gemini Flash(무료), 고급 모델: Gemini Pro, 외부 키: BYOK(Claude, GPT)

---

## Phase 03: 아리 엔진 v1 - 텔레그램 봇 연동
**핵심 결정:**
- 텔레그램 봇을 아리의 주요 소통 채널로 정의
- `bot.on('message')` → `executor.js` → LLM 응답 → 텔레그램 reply 기본 파이프라인
- 사용자 인터페이스: 스마트폰(텔레그램) + PC(대시보드) 듀얼 채널 전략

---

## Phase 04: 데이터베이스 정규화 및 태스크 시스템
**핵심 결정:**
- SQLite 기반 `database.js`로 에이전트/태스크/댓글/설정 전체 스키마 정의
- Tasks 테이블: `content`, `requester`, `assigned_agent`, `column(상태)`, `created_at`
- `dbManager` 싱글톤 패턴으로 전 서버에서 통일된 DB 접근 인터페이스 제공

---

## Phase 05: 칸반 보드 대시보드 UI 구축
**핵심 결정:**
- React 기반 실시간 칸반보드: `todo → in_progress → review → done` 4열 구조
- Socket.io로 엔진-UI 실시간 양방향 동기화 (별도 polling 없음)
- 태스크 카드, 댓글 스레드, 에이전트 상태 패널 기본 UI 완성

---

## Phase 06: Soul Context & Identity 주입 시스템
**핵심 결정:**
- 에이전트마다 `MYCREW.md`(공통 행동강령) + `IDENTITY.md`(개인 정체성) 두 레이어로 성격 정의
- `executor.js`의 `loadSoulContext()`가 부팅 시 두 파일을 합성하여 시스템 프롬프트에 주입
- "기계처럼 말하지 말라"는 브랜딩 철학을 모든 에이전트에 내재화

---

## Phase 07: 실시간 로그 & 타임라인 시스템
**핵심 결정:**
- 에이전트의 모든 활동을 `Log` 테이블에 영구 기록 (`broadcastLog()` 함수 표준화)
- 대시보드 우측의 `LogDrawer`에 실시간 스트리밍 타임라인 표시
- 로그 레벨: `INFO`, `ACTION`, `WARN`, `ERROR` 4단계

---

## Phase 08: 멀티 에이전트 팀 아키텍처
**핵심 결정:**
- 단일 에이전트(아리)에서 **에이전트 팀** 구조로 확장: `ari`, `devteam`, `marketing` 등
- `agents.json`으로 에이전트 메타데이터(이름, 모델, 아바타, 소개) 중앙 관리
- 에이전트 간 역할 위임(Delegation) 패턴 초안 수립

---

## Phase 09: 와치독 & 자동 복구 시스템 (Watchdog)
**핵심 결정:**
- 5분 주기 `runWatchdog()` 스케줄러 도입
- 30분 이상 `in_progress` 상태 태스크 자동 감지 → 에이전트에게 재시도 명령
- Case A(완전 고착), Case B(중간 고착), Case C(응답 없음) 3단계 분류 대응

---

## Phase 10: 3-Pillar 워크스페이스 아키텍처 마이그레이션
**핵심 결정:**
- 10개 이상의 단편화된 폴더를 **3-Pillar 구조**로 대통합
  - `01_Company_Operations` (비즈니스/HR/세일즈)
  - `02_System_Development` (엔진/대시보드/아키텍처)
  - `03_Reference_IP` (기술 블로그/레퍼런스)
- B2B SaaS 확장성을 염두에 둔 기업 중심 아키텍처 체계 확립

---

## Phase 11: 대시보드 UI 고도화 (Luminescent Terminal UI)
**핵심 결정:**
- 기본 스타일에서 **다크모드 Luminescent Terminal** 테마로 전면 개편
- CSS 변수 시스템(`--bg-base`, `--brand`, `--text-primary` 등) 구축
- 에이전트 아바타, 배지, 스킬 인디케이터 등 프리미엄 UI 컴포넌트 도입
- Light/Dark 테마 토글 및 반응형 레이아웃(모바일 대응) 완성
