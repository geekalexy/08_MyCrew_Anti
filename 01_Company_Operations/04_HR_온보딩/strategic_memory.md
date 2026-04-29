# 🧠 MyCrew Strategic Memory (Luca & Representative)

이 문서는 MyCrew 프로젝트의 핵심 업무 규칙(IP)을 기록하는 **공식 메모리**입니다.

---

## 1. 🏗️ 아키텍처 v4.0 핵심 원칙 (Phase 22 확정판)

### [원칙 1] 지능형 계층화 및 모델 운영 — 공식 API 식별자 SSOT

> **2026-04-20 Sonnet 이중검증 완료** (공식 문서 직접 조회 확인)
> 검증 출처: https://ai.google.dev/gemini-api/docs/models · https://docs.anthropic.com/en/docs/about-claude/models

* **초고속/창의 모델 (Flash)**: `gemini-2.5-flash` — GA Stable
* **경량 Fallback**: `gemini-2.5-flash-lite` — GA Stable (2.0-flash 대체)
* **고성능 추론 (Pro)**: `gemini-2.5-pro` — GA Stable
* **전문 실무 모델 (Sonnet)**: `claude-sonnet-4-6` — GA Stable
* **최고 지성 모델 (Opus)**: `claude-opus-4-6` — Antigravity IDE 제공 모델 기준 확정

**금지 사항 (Forbidden)**:
- ❌ `-preview`, `-exp`, `-experimental` 접미사 모델 사용 절대 금지
- ❌ 존재하지 않는 환각 식별자 사용 금지
  - 사례: `gemini-3.1-pro-preview` (루카 환각, 2026-04-20 발견·수정)
  - 사례: `gemini-3-flash-preview` (루카 환각, 2026-04-20 발견·수정)
  - 사례: `gemini-2.5-pro-preview` (루카 환각, 2026-04-20 발견·수정, 이 식별자는 존재하지 않음)
- ❌ `gemini-2.0-flash` — **공식 Deprecated** 판정 (2026-04-20 확인), Fallback 체인 사용 금지


**Fallback 체인 (확정)**:
```
Pro 요청:   gemini-2.5-pro → gemini-2.5-flash → gemini-2.5-flash-lite
Flash 요청: gemini-2.5-flash → gemini-2.5-flash-lite
```

**운영 원칙**: 모든 지능은 `ai-engine/modelRegistry.js`의 상수를 참조하며, 대표님의 명시적 허가 없이 식별자를 변경할 수 없음.

---

## 2. 🏛️ 아키텍처 v4.0 — Phase 22 확정 구조

### [구조 1] Ari 비서 레이어 ↔ 실행 레이어 완전 분리 (2026-04-20 확정)

```
[프론트엔드 Socket] ──► [Ari 비서 레이어 / Port 5050 독립 Daemon]
                              │
                    ┌─────────┴──────────┐
                    │ 일상 대화/지식     │ 복잡한 작업
                    │ (즉각 스트리밍)    │ (DEEP_WORK/CONTENT/MEDIA 등)
                    ▼                   ▼
              [Gemini 2.5 Flash]  [FilePollingAdapter]
                                        │
                              [칸반 태스크 자동 파생]
                                        │
                              [Antigravity / Claude Code]
                              (외부 자율 에이전트 실행)
```

**핵심 원칙**:
- 프론트엔드 새로고침/재연결과 **무관하게** Ari의 맥락(Context)이 독립 데몬에서 영구 보존됨
- 서버 재시작 시 5050 포트 자동 Fallback → 로컬 executor 직접 실행으로 무중단 운영

### [구조 2] 통신 규격 (하이브리드, 확정)

| 레이어 | 방식 | 이유 |
|---|---|---|
| Ari 비서 (대화) | Socket.IO 실시간 스트리밍 | 저지연, 타이핑 애니메이션 |
| 실행 레이어 (태스크) | FilePollingAdapter 비동기 큐 | 장시간 작업, 외부 에이전트 |
| 이미지 분석 (Vision) | 동기 HTTP (ImageAnalysisService) | 즉각 결과 필요, 2~5초 |

---

## 3. 🗑️ 폐기 선언 (Deprecated & Decommissioned)

### [폐기 1] 구형 Anti-Bridge (로컬 파이썬 통신망) — 2026-04-20 완전 폐기

**폐기 이유**: 병목의 주범이었던 레거시 로컬 파이썬 브릿지(Anti-Bridge)
- 동기식 REST 통신으로 인한 10초+ 응답 지연
- 파이썬-Node.js 혼합 통신 스택의 불안정성
- 확장 불가능한 단일 프로세스 구조

**대체 확정**: `FilePollingAdapter` (Node.js 기반 비동기 JSON 큐)
- `.agents/tasks/pending/` → `.agents/tasks/completed/` 파일 폴링
- 10분 Hard Timeout 방어 (AdapterWatcher.js)
- `adapter:status_change` Socket 이벤트로 실시간 상태 프론트엔드 전달

### [폐기 2] 채팅 멘션/에이전트 직접 호출 기능 — 2026-04-20 완전 제거

**폐기 이유**: `@루카`, `@아리` 등 멘션 기반 다중 에이전트 동시 호출 방식
- 대화 채널 혼재로 인한 UX 복잡성
- 에이전트별 응답 충돌 가능성
- Phase 22 아키텍처와 구조적 불일치

**대체 확정**: **1:1 프런트 데스크 — 백오피스 보드 아키텍처**
- 모든 대화는 Ari(현관)와의 단독 1:1 스트리밍으로 수렴
- 타 에이전트 업무 위임은 칸반 태스크 보드 비동기 파생으로 단일화
- "대표님 → Ari → 칸반 → 에이전트" 단방향 지휘 체계 확립

---

## 4. 📂 파일 및 폴더 생성 강제 규칙 (M-FDS)
**[원칙 3] 문서 작성 및 폴더 생성 시 M-FDS 규정 엄수**
*   **주의:** 어떤 AI 에이전트든 새로운 세션 로그, 기획서(PRD), 테스트 코드 등을 작성하거나 새 폴더를 생성할 때는 임의로 만들지 마십시오.
*   **필수 행동:** 반드시 `01_Company_Operations/04_HR_온보딩/rule_document_structure.md` 문서를 먼저 읽고(`view_file`), 해당 규칙(폴더 넘버링, 파일 네이밍, 저장 위치)을 100% 준수한 상태에서만 파일을 생성/저장해야 합니다.
*   *위반 시 대표님(CEO)의 엄격한 제재가 따릅니다.*

---

## 5. 📝 실시간 지시 및 합의 히스토리


### [2026-04-23] Prime(Opus 4.7) 코드 리뷰 기반 시스템 안전장치 의무화 (Luca 실수 방지)

**의무 적용 원칙 (시한폭탄 방지 규칙):**
1. **[SDK 및 모델 강제 통일]**: 구형 `@google/generative-ai` 모듈 혼용 절대 금지. 모든 코드 베이스는 `@google/genai` (v1.49+)로 통일하며, `gemini-1.5-flash` 같은 하드코딩된 모델 식별자는 사용 불가. 무조건 `modelRegistry`의 상수를 통해 `keyProvider`와 결합해 호출.
2. **[서비스 키 완전 분리]**: 구글 클라우드 관련 API(예: TTS)와 제미나이 언어모델 API 섞어 쓰기 금지. `GOOGLE_CLOUD_TTS_KEY` 등 명시적으로 분리된 환경변수 적용. (다만 긴급 시 fallback은 유지 권장)
3. **[사이드이펙트(Side Effect) 원천 차단]**: Node.js 환경에서 ESM 모듈 작성 시 최하단에 무조건 실행 구문 작성 금지. 오직 CLI에서 직접 스크립트를 구동할 때만 작동하도록 ESM 가드 (`if (process.argv[1] && __filename === process.argv[1])`) 필수 부착.
4. **[원본 데이터 훼손 금지]**: 에이전트 다중 협업 시, 다른 에이전트가 만든 원본 값(`originalDurationFrames` 등)을 임의로 덮어쓰지 말고 필드를 복제/우회하여 규칙 2번(객체 불변성)을 엄격히 준수할 것.

### [2026-04-20] Phase 22 고성능 어댑터 전환 완료 (Sprint 1 종료)

**완료 사항:**
- ✅ Ari 비서 레이어(5050 Daemon) ↔ Ari 엔진(4000 Server) 물리적·논리적 분리 달성
- ✅ Ari Context Memory 메커니즘 구축 (독립 프로세스 → 세션 영구 보존)
- ✅ 구형 Anti-Bridge 완전 폐기 + FilePollingAdapter 100% 대체 확정
- ✅ 채팅 멘션 파싱 제거 → 1:1 프런트데스크 아키텍처 일원화
- ✅ HTTP REST `/api/chat` 블로킹 호출 폐기 → Socket.IO 스트리밍 전환
- ✅ `imageLabRouter` geminiAdapter 직접 의존성 제거 → `imageAnalysisService` 분리
- ✅ 모델 환각 식별자 5건 수정 (루카 전수조사)
- ✅ `modelRegistry.js` 공식 API 문서 이중검증 재작성
- ✅ AdapterWatcher.js 10분 Hard Timeout 방어 로직 추가

**다음 단계 (Phase 1 ~ 2):**
- Ari Daemon(5050) 실제 프로세스 구현 및 안정화
- Claude Code 에이전트 연동 (Phase 2)
- CKS Round 2 측정 격리 시작

---

### [2026-04-20] 모델 식별자 이중검증 및 교정 (Sonnet 직접 검증)

- **[claude-opus-4-6 기준 확정]**: Antigravity 어댑터 제공 모델(Claude Opus 4.6 (Thinking)) 기준으로 `claude-opus-4-6` 고정 완료.
- **[gemini-2.5-flash-lite 추가]**: GA Stable 확인, `gemini-2.0-flash` Deprecated 대체용으로 Fallback 체인 최하단 등록.
- **[gemini-2.0-flash 제거]**: 공식 Deprecated 판정 확인, 전체 Fallback 체인 및 코드베이스에서 제거 완료.

---

### [2026-04-18] 이전 모델 전략 (참고 기록 — 현재 v4.0으로 교체됨)

- Flash/Pro/Sonnet/Opus 4세대 전략 수립 (v3.2).
- Preview 모델 금지 원칙 최초 수립.

---

**[Backup Status]**
- **마지막 업데이트**: 2026-04-28 (ARI 지능 업그레이드 옵션 기록)
- **저장 경로**: `/Users/alex/Documents/08_MyCrew_Anti/01_Company_Operations/04_HR_온보딩/strategic_memory.md`
- **버전**: v4.3 (Phase 27 진행 중)

---

## 7. 🧠 ARI 지능 업그레이드 전략 (2026-04-28 기록, 미결정)

**배경**: ARI(Gemini Flash)가 Sonnet급 경쟁 에이전트(소놀봇-Claude) 대비 지능이 낮아  
대표님 구상(비서는 Sonnet급)과 간극이 있음. 당장 결정하지 않고 단계적 검토.

**현재 결정**: Gemini 2.5 Pro로 먼저 시도 → 가망 없다 판단되면 아래 대안 검토.

### Option A: Gemini 2.5 Pro (즉시 적용 완료 — 2026-04-28)
```
ARI 기본 모델: gemini-2.5-flash → gemini-2.5-pro 변경
추가 비용: 없음 (AntiGravity 구독 OAuth 인증)
스트리밍: 유지 (WebSocket 구조 그대로)
판단 기준: Pro로 운영 후 지능 체감이 여전히 부족하면 → Option B/C 검토
```

### Option B: ARI 브릿지 전환 (소놀봇 방식)
```
ARI가 파일 브릿지를 통해 Sonnet(Claude) 호출
타이핑 스트리밍 UX 포기 → "ARI가 고민 중..." 대기 애니메이션으로 대체
응답 지연: 3초~30초
장점: Sonnet급 지능, 추가 과금 없음 (AntiGravity 구독)
단점: 실시간 스트리밍 UX 사라짐
```

### Option C: 하이브리드 — 복잡도별 분기
```
단순 질문 (QUICK_CHAT)   → Flash 스트리밍 (즉시 응답)
복잡 질문 (DEEP_WORK 등) → Sonnet 브릿지 → 완성 응답 일괄 전달
UI: "💭 깊이 생각하는 중..." 표시 (대기 허용)
장점: 상황별 최적 모델, UX 균형
단점: 구현 복잡도 증가
```

### 판단 기준 (언제 대안으로 넘어가나)
- [ ] Gemini Pro 운영 2주 후 체감 지능 평가
- [ ] "ARI가 의도를 못 잡아서 재질문 3회 이상" 사례 누적 시 → 대안 검토
- [ ] 소놀봇 대비 실무 처리 품질 비교 테스트


---

## 6. 🚀 고성능 어댑터 전략 로드맵 (Phase 22 확정, 2026-04-20)

**핵심 인사이트 (대표님 발견):**
> 크루를 훈련시키는 것보다, **더 강력한 모델을 어댑터로 연결**하는 것이 전 영역에서 압도적 성능 향상을 가져온다.
> 기존 스킬·워크플로우·룰·템플릿 자산은 그대로 유지 — 실행자(모델)만 업그레이드.

**어댑터 연결 확정 순서:**

```
Step 1 ✅ AntiGravity 어댑터 (파일 브릿지)    ← 2026-04-28 구축 완료
           구독 인증으로 추가 API 과금 없이
           Gemini 3.1 Pro (High), Claude Opus 4.6 (Thinking) 등 고성능 모델 활용

Step 2    Claude Code 어댑터                  ← 다음 목표
           자율 코딩 에이전트 / File Polling 방식 동일 적용

Step 3    이미지 LoRA 어댑터                   ← Image Winner 200장 수집 후
Step 4    영상 어댑터 (Kling + 캐릭터 LoRA)    ← Image LoRA 완성 후
```

**비용 전략:**
- Gemini Ultra 구독(₩180k~360k/월) → 구독 인증으로 API 과금 대체
- 추가 비용 없이 고성능 모델 운영

**CLI/IDE 확장 전략 (2026-04-28 합의):**
> Step 2(Claude Code)는 시류에 따라 가장 인기 있는 CLI/IDE로 확장하는 개념.
> Claude Code → Codex / Cursor 등 인기 IDE/CLI 에이전트로 File Polling 방식 동일 적용.
> **MyCrew의 스킬·워크플로우 플러그인 자산이 어떤 CLI/IDE 에이전트에도 재사용된다는 것이 핵심.**

---

