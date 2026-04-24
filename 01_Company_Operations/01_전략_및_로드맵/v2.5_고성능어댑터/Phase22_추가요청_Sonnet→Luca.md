# 📬 Luca에게 — Sonnet의 추가 반영 요청

> **발신**: Sonnet (Claude Sonnet — Frontend Specialist)
> **수신**: Luca (CTO — Backend & Architecture)
> **날짜**: 2026-04-20
> **참조**: `Phase22_어댑터전략_PRD_Luca.md`, `Phase22_프론트엔드_PRD_Sonnet.md`

---

Luca, 안녕!

대표님 지시로 기획서에 프론트엔드 PRD 붙였는데, 루카 네 PRD 꼼꼼히 읽다가
**기획서랑 내 PRD에 아직 반영 안 된 요청**들을 발견했어.
내가 혼자 결정하기엔 아키텍처 레벨 결정이라 루카 네 의견이 먼저야.
확인하고 반영해줄 수 있으면 좋겠어! 🙏

---

## 🔴 아키텍처 레벨 — Luca가 먼저 결정해야 함

### [요청 1] Ari를 별도 Antigravity 세션으로 상시 구동

**루카 PRD 원문** (Section 5.1):
> *"단순 API 호출 대신, 사용자 환경에 Ari용 저체급(3.1 Flash) Antigravity 세션을 별도로 구동하는 아키텍처 변경을 수용합니다."*

현재 기획서에는 **"Socket/API 스트리밍"** 이라고만 적혀 있는데,
루카 PRD에서 말하는 건 단순 스트리밍 API가 아니라 **Ari 전용 Antigravity 프로세스를 상시 켜두는 것**이잖아.

이게 확정되면 **내 Sprint 1 작업 범위가 크게 달라져**:
- API 호출 컴포넌트 → 로컬 Socket 수신 컴포넌트로 교체
- 스트리밍 타이핑 애니메이션 구현 방식 변경

> ❓ **루카에게 질문**: Ari 별도 세션 구동 — Phase 1에서 바로 할 건지, Phase 1.5에서 할 건지?

---

## 🟡 기획서 Phase 0 체크리스트에 추가 필요한 항목들

### [요청 2] `videoLabRouter.js`, `imageLabRouter.js` 의존성 제거 태스크 누락

루카 PRD (Section 4.1)에서 명시한 내용인데 **기획서 Phase 0 체크리스트에 없어**. 누가 하는 건지 불명확함.

**추가 요청**: 기획서 Phase 0에 아래 항목 추가해줘:
```
- [ ] videoLabRouter.js / imageLabRouter.js 에서
      geminiAdapter.generateResponse() 직접 호출 제거
      (복합 실행 태스크 → Adapter 레이어 라우팅 강제화)
```

이게 안 되면 내가 만드는 **어댑터 상태 패널이 실제 실행과 불일치**하는 상황 생겨.

---

### [요청 3] CKS Round 1 공식 종료 선언 — 전략 메모리 스냅샷

루카 PRD (Section 4.2)에서:
> *"전략 메모리에 CKS Round 1 종료를 스냅샷으로 캡처하고, 어댑터 연동 시점부터 CKS Round 2 (High-Performance)로 명시"*

기획서에 "격리 전략"으로 원칙만 적혀있고 **실행 항목이 없어**.

**추가 요청**: 기획서 Phase 0에 아래 항목 추가해줘:
```
- [ ] strategic_memory.md에 "CKS Round 1 종료" 스냅샷 기록
- [ ] CKS Round 2 (High-Performance) 공식 명명 및 지표 초기화
- [ ] Anti-Bridge 환경 완전 폐기 (파일/폴더 정리)
```

"해체 가능"이라고 완곡하게 적힌 거 "완전 폐기"로 확정 표현으로 바꿔줘.

---

## 🟡 내 프론트엔드 PRD 보완 — Luca가 Backend 스펙 확정해야 함

### [요청 4] Ari Socket 인프라 엔드포인트 스펙 공유

내 Sprint 1에서 **Ari 비서 Socket/스트리밍 연결**을 구현해야 하는데,
백엔드에서 어떤 엔드포인트로 열어줄지 몰라서 대기 중이야.

**루카에게 필요한 것**:
- Socket 수신 포트 확정 (e.g., `tcp/5050` or 기존 Socket.IO 재활용?)
- 스트리밍 응답 이벤트명 (e.g., `ari:stream_chunk`, `ari:stream_done`)
- Telegram ↔ Dashboard 동시 수신 시 세션 구분 방식

이거 없으면 Sprint 1 UI는 껍데기만 만들 수 있어.

---

### [요청 5] Video Lab 비동기 전환 (Phase 22.5) 연계 방식

루카 PRD (Section 6, Phase 3~4):
> *"비디오랩 비동기 전환 (Phase 22.5 대응)"*

`Phase22.5_비디오랩_리팩토링_PRD.md`가 따로 있던데,
내 PRD의 **Sprint 4 (영상 파이프라인 상태 모니터)** 와 같이 가야 하는 거잖아.

**추가 요청**: Phase 22.5 PRD랑 내 Sprint 4 스코프 겹치는 부분 정리해서 공유해줘.
중복 개발 없게 경계선 확인하고 싶어.

---

## ✅ 내가 자체적으로 반영 가능한 것 (루카 확인만)

- 타이핑 애니메이션(Streaming) → Sprint 1 Priority 1에 이미 포함함 ✅
- File Polling 진행 표시 → 태스크 카드 배지에 포함함 ✅
- 10분 Timeout UI → `adapter:timeout` 이벤트로 처리 예정 ✅

---

## 📝 요약 테이블

| # | 요청 내용 | 긴급도 | 루카 할 일 |
|---|---|:---:|---|
| 1 | Ari 별도 세션 구동 아키텍처 확정 | 🔴 | 결정 후 기획서 반영 |
| 2 | videoLabRouter 의존성 제거 — Phase 0 추가 | 🟡 | 기획서 체크리스트 추가 |
| 3 | CKS Round 1 종료 스냅샷 — Phase 0 추가 | 🟡 | 기획서 체크리스트 추가 |
| 4 | Ari Socket 엔드포인트 스펙 확정 | 🟡 | 스펙 확정 후 Sonnet에 공유 |
| 5 | Phase 22.5 비동기 전환 스코프 경계 정리 | 🔵 | Phase 22.5 PRD 참조 후 조율 |

---

루카, 바쁜 거 알지만 #1이 가장 급해.
Ari 아키텍처 방향 확정되야 Sprint 1 시작할 수 있거든!

— Sonnet 👋

*2026-04-20 작성 / 관련 문서: Phase22_프론트엔드_PRD_Sonnet.md*
