# SESSION LOG — 2026-05-02 (Sonnet)

> 작성자: Sonnet (Claude Sonnet 4.6, Antigravity 기반)
> 세션 시간: 2026-05-01 저녁 ~ 2026-05-02 01:46 KST
> 세션 성격: Phase 30 시스템 안정화 + 전략적 Dogfooding 프레임워크 채택 + Dogfooding 케이스 아카이빙

---

## 1. 세션 전반부 — Phase 30 긴급 안정화

### executor.js 레이스 컨디션 수정
- **발견된 버그:** Phase 30 작업 중 루카가 `const BRIDGE_AGENTS = new Set()`와 `const AGENT_SIGNATURE_MODELS = {}` 선언을 실수로 삭제
- **증상:** 태스크 코멘트 AI 호출 시 `ReferenceError` → 서버 크래시
- **루카 핫픽스:** 삭제된 선언 2줄 즉시 원복
- **소넷 추가 수정:** 비동기 DB 초기화 타이밍 버그 해결
  - 기존: `_initAgentProfiles()` async → 서버 시작 직후 `BRIDGE_AGENTS` 비어있음
  - 수정: **2단계 초기화 구조**
    - 1단계(동기): `agents.json` 즉시 로드 → 서버 시작 즉시 라우팅 가능
    - 2단계(async): DB `agent_profiles` 갱신 → 사용자 설정 모델 반영

### TIMELINE 입력 UX 설계 확정
- 루카가 최종 설계 확립: TIMELINE = 태스크 중심 대화 전용
  - 카드 미선택 + `#번호` 입력 시 전송 버튼 활성화 (카드 포커스 전환)
  - 카드 미선택 + 일반 텍스트 → 입력 가능하나 전송 불가
  - 카드 포커스 상태 → 모든 입력 활성화
- `textarea` 비활성화 → 활성화 (UX 개선), 플레이스홀더 "번호(#)를 입력하여 카드를 찾으세요..."

---

## 2. 세션 중반부 — 컨텍스트 혼재 → 전략적 Dogfooding 전환

### 사건의 발단
- NOVA가 모기업 소시안 PR 아티클 작성 지시를 받았으나, MyCrew 스펙 문서를 서술하는 오작동 발생
- NOVA 자가 진단: "컨텍스트 편향 — 시스템 문서 90% 이상이 MyCrew에 집중"
- 대표님의 결정: 버그로 분류하지 않고 **전략적 Dogfooding의 기회**로 공식 전환

### Prime 검수 (20th Review, 등급 A)
- 전략 승인: "자사 AI가 자사 시스템의 결함을 자가 진단했다" — 강력한 세일즈 포인트
- 3대 보강 권고:
  1. Dogfooding 케이스 구조화 (`03_Dogfooding_케이스/` 폴더 신설)
  2. `@bugdog 기록` 파이프라인 자동화
  3. 포지셔닝: "버그 수정" → "자가 진화 플랫폼"

---

## 3. 세션 후반부 — Dogfooding 아카이빙 + TaskDetailModal UX 개편

### Dogfooding 케이스 아카이빙 (소넷 담당 확정)
루카가 구조 신설 → 소넷이 전체 케이스 작성 완료:

| 파일 | 내용 | 파생 Phase |
|---|---|---|
| `CASE_001` 수정 | NOVA 컨텍스트 편향 (오늘 사건) | Phase 31 |
| `CASE_002` 신규 | ARI "아니" → 태스크 생성 오작동 | Phase 26 |
| `CASE_003` 신규 | 4월 15일 서버 전면 마비 / Bugdog 탄생 | Phase 27 |
| `CASE_004` 신규 | Orchestrator-Secretary 페르소나 충돌 | 브릿지 라우팅 |
| `CASE_005` 신규 | agents.json SSOT 분열 사태 | Phase 30 |

### TaskDetailModal UX 대규모 개편 (루카 주도)
- **인라인 메타 컨트롤 패널 신설:** 담당자·모델·상태·우선순위를 편집 모드 없이 즉시 변경 + PATCH 즉시 전송
- **마크다운 렌더링 도입:** 커스텀 토크나이저(~100줄) → `ReactMarkdown + remarkGfm + rehypeRaw`로 대체
- **노션 스타일 전체화면 확장 버튼** 추가 (`open_in_full`)
- **CEO 담당자 처리:** 실행 버튼 disabled + 안내 메시지 / server.js CEO 시 `forceRedispatchTask` 차단
- **채팅탭 노이즈 제거:** `>` 로 시작하는 system 로그 채팅탭에서 숨김

### Bugdog 확장 기획서 작성 (소넷)
- `Phase32_Bugdog_Dogfooding_파이프라인_기획서.md` 작성
- `@bugdog 기록` 트리거 → 컨텍스트 자동 수집 → LLM 초안 생성 → CASE 파일 저장 → 칸반 카드 자동 생성
- 구현 전 Prime 검수 권고 명시

---

## 4. 잔존 과제 (Next Steps)

- [ ] Dogfooding 케이스 캡처 에셋 수집 (대표님이 직접)
- [ ] `Phase32_Bugdog_파이프라인_기획서.md` → Prime 검수 요청
- [ ] Phase 31 (프로젝트 기반 컨텍스트 격리) 설계 착수
- [ ] 노바에게 CASE 파일 기반 마케팅 소재화 지시

---

## 5. 핵심 파일 경로

| 파일 | 주요 변경 |
|---|---|
| `ai-engine/executor.js` | BRIDGE_AGENTS 선언 원복 + 2단계 초기화 구조 |
| `src/components/Log/LogDrawer.jsx` | TIMELINE 입력 UX 확정 + 채팅탭 노이즈 필터 |
| `src/components/Modal/TaskDetailModal.jsx` | 인라인 메타 컨트롤 + ReactMarkdown + CEO 처리 |
| `server.js` | CEO assignee 시 AI 실행 차단 |
| `01_Company_Operations/05_PR_마케팅/03_Dogfooding_케이스/` | CASE_001~005 + INDEX |
| `00_아키텍처_문서/01_PRD/Phase32_Bugdog_Dogfooding_파이프라인_기획서.md` | Bugdog 확장 기획서 |
| `00_아키텍처_문서/리뷰_아카이브/20_전략적_Dogfooding_프레임워크_리뷰_Prime.md` | Prime 20th 리뷰 (등급 A) |
