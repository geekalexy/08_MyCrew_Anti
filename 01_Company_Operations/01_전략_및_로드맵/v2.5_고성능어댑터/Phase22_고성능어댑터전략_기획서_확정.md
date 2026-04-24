# 🚀 MyCrew Phase 22: 고성능 어댑터 전략 기획서
> 작성일: 2026-04-20 | 작성자: Luca (CTO) | 결재: 대표님 검토 요  
> 분류: 전략 기획 | 상태: v0.5 — Nexus 검토의견 반영 완료
> 변경 이력: v0.4 → v0.5 자동 Fallback, Hybrid 라우팅, Rollback 플랜, Pro 토큰 모니터링 추가

---

## 1. 🎯 전략 전환 배경 및 목적

### 현재 시스템의 근본 한계

MyCrew는 현재 **Ari 엔진(컨트롤 플레인)** 이 Claude / Gemini Flash API를 통해 크루를 운영하는 구조다.  
이 구조에서 크루의 "지능 수준"은 항상 연결된 모델의 성능에 종속된다.

**핵심 인사이트 (2026-04-20 대표님 발견):**
> "성능이 높은 크루라면 우리가 개발한 플러그인(스킬+워크플로우+룰+템플릿)을  
> 그대로 더 잘 수행하고, 지시 프롬프트 의도를 더 잘 해석해서  
> 어떤 워크플로우를 누구에게 할당하고, 어떤 스킬로 다음 단계를 수행할지 추론할 것이다."

이는 곧 **크루 자체를 훈련시키는 것보다, 더 강력한 모델을 어댑터로 연결하는 것이  
전 영역에서 압도적 성능 향상을 가져온다**는 결론이다.

---

## 2. 📐 새 아키텍처: 고성능 어댑터 전략

### 2.1 개념 구조 (Prime 보완 — Ari 레이어 명확화)

> ⚠️ **[Prime 이슈 1 반영]** 전환 후 Ari는 순수 컨트롤 플레인으로 역할이 분리된다.  
> 현재 `executor.js`의 Flash 직접 응답 경로는 **비서 응대(대화)에만 잔존**시키고,  
> 실여 작업은 반드시 어댑터로 위임한다. 이중 경로(Flash 직접 실행 + 어댑터) 혼재 금지.

```
┌─────────────────────────────────────────────────────┐
│              Ari 엔진 (컨트롤 플레인)                   │
│                                                     │
│  [비서 레이어]  Ari Flash — 대화 응대, 의도 파악,         │
│                            태스크 생성 (소통 전용)        │
│                         ↓                           │
│  [실행 레이어]  BaseAdapter 라우터 — 어댑터 선택 및 위임    │
└──────────────────────────┬──────────────────────────┘
                           │
     ┌─────────┬───────────┼───────────┬─────────────┐
     │         │           │           │             │
  ┌──▼──┐  ┌──▼──┐    ┌───▼───┐   ┌───▼───┐   ┌────▼────┐
  │텍스트│  │코드  │    │이미지  │   │영상    │   │(추가    │
  │추론  │  │개발  │    │생성   │   │생성    │   │가능)    │
  │어댑터│  │어댑터│    │어댑터  │   │어댑터  │   │         │
  │     │  │     │    │       │   │       │   │         │
  │Pro  │  │Code │    │Imagen │   │Kling  │   │         │
  │모델  │  │CLI  │    │+LoRA  │   │+LoRA  │   │         │
  └─────┘  └─────┘    └───────┘   └───────┘   └─────────┘
```

### 2.2 핵심 원칙

| 원칙 | 내용 |
|---|---|
| **고성능 모델 우선** | 모든 크루 역할에 가능한 최고 성능 모델 연결 |
| **플러그인 자산 재사용** | 기존 스킬·워크플로우·룰·템플릿은 그대로 유지. 실행자만 업그레이드 |
| **영역별 전문 어댑터** | 텍스트/코드/이미지/영상 각 영역마다 최적 모델·학습 조합 |
| **점진적 전환** | 기존 Flash 기반 운영을 유지하면서 영역별 단계적 어댑터 교체 |
| **Ari 레이어 분리** | Ari = 비서+라우터, 어댑터 = 실행자. 이중 경로 혼재 금지 |

---

## 3. 🗂️ 영역별 어댑터 전략

### 3.1 텍스트·추론 어댑터

**대상 크루**: Luma(마케팅), Aria(운영), 보고서 생성, 콘텐츠 기획 등  
**현재**: Gemini 2.5 Flash  
**목표**: Claude Sonnet 4.6 / Gemini 2.5 Pro

| 항목 | 현재 | 목표 |
|---|---|---|
| 지시 해석 정확도 | 70% | 90%+ |
| 워크플로우 자동 추론 | 제한적 | 다단계 자율 추론 |
| 스킬 선택 정확도 | 수동 매핑 의존 | 의도 기반 자동 선택 |
| RPM 한도 | 10 RPM | 150 RPM (유료) |

**구현 방향**:
- `modelRegistry.js`에서 역할별 모델 매핑 분리
- 고복잡도 태스크 →  Pro 모델 자동 라우팅
- 저복잡도 반복 태스크 → Flash 유지 (비용 최적화)

---

### 3.2 코드 개발 어댑터

**대상 크루**: Luca(CTO), 개발 태스크, 버그 픽스, 기능 구현  
**현재**: Claude Sonnet API (대화형)  
**목표**: **Claude Code CLI 어댑터** (자율 코드 에이전트)

```
현재 방식:
사용자 → Luca(Claude Sonnet 대화) → 코드 제안 → 사용자가 직접 적용

목표 방식:
사용자(요구사항) → Ari 엔진 → Claude Code 어댑터
                                     ↓
                          파일 읽기 → 코드 작성 → 테스트 → 커밋
                                     ↓
                          Ari 엔진에 완료 보고
```

**핵심 차이점:**
- Claude Sonnet (현재): "이렇게 하면 어때요?" → 사람이 실행
- Claude Code (목표): "완료했습니다" → 에이전트가 직접 파일 수정·실행·검증

**구현 계획**:
```
Phase 1: Claude Code CLI를 Shell 어댑터로 연결
         → Ari 엔진이 태스크를 Claude Code에게 위임
         → 결과를 Paperclip 방식으로 보고

Phase 2: MyCrew 코드베이스 전용 컨텍스트 주입
         → AGENTS.md / strategic_memory 자동 주입
         → MyCrew 컨벤션 자동 준수
```

---

### 3.3 이미지 생성 어댑터 (특수 학습 병행)

**현재**: Imagen 3 → Pollinations Fallback  
**목표**: **Imagen 3 + 소시안 FLUX LoRA 병행**

```
입력 프롬프트
    ↓
[고성능 어댑터 결정 로직]
    ├─ 소시안 브랜드 이미지 → FLUX + 소시안 LoRA (맞춤 학습)
    ├─ 일반 일러스트 → Imagen 3 (Google 최신 모델)
    └─ 빠른 프로토타입 → Pollinations Seed (flux-schnell)
```

**LoRA 학습 로드맵**:
- 현재: Winner 이미지 수집 중 (Image Lab 자동 루프)
- 목표 수집량: **200장** (소시안 스타일 LoRA 학습 최소 기준)
- 학습 플랫폼: Replicate / RunPod (GPU 온디맨드)
- 배포: FLUX API + 커스텀 LoRA 가중치 자동 주입

---

### 3.4 영상 생성 어댑터 (특수 학습 병행)

**현재**: Remotion(프레임 렌더) + Gemini Flash(스크립트 생성)  
**목표**: **Kling API + 캐릭터 LoRA** + Gemini Pro(연출 기획)

```
연출 기획 단계:
  Gemini Pro → 장면 구성·스크립트·타임라인 생성 (고성능 모델)

영상 렌더 단계:
  Kling API + 소시안 캐릭터 LoRA → 일관된 캐릭터 등장 영상

후편집 단계:
  Remotion → 자막·브랜드 요소·CTA 오버레이 (현행 유지)
```

**LoRA 학습 로드맵**:
- 대상: 소시안 캐릭터 일관성 (등장인물 외형 고정)
- 베이스 모델: CogVideoX 또는 Wan-Video
- 수집 데이터: Image Lab Winner + 추가 캐릭터 시트
- 예상 달성 시점: Image LoRA 완성 후 착수

---

## 4. 📋 기존 플러그인 자산 처리 방침 (Prime 최종 판정)

> Prime 표현: *"집은 잘 지었다. 문제는 거기 살던 입주자(Flash)가 약했다. 더 강한 입주자를 들이면 된다."*

| 자산 | 처리 | 이유 |
|---|:---:|---|
| 스킬 라이브러리 | ❌ **유지** | 고성능 모델이 더 정확하게 활용 |
| 워크플로우 오케스트레이터 | ❌ **유지** | 고성능 모델이 단계를 더 정확히 추론 |
| 룰 하베스터 | ❌ **유지** | 고성능 모델이 룰을 더 정확히 준수 |
| Self-Learning 루프 | ❌ **유지** | 어떤 모델이든 경험 축적은 유효 |
| CKS 프레임워크 | ❌ **유지** | 모델 수준과 무관한 협업 프로세스 |
| Anti-Bridge | ✅ **해체 가능** | 직접 API 호출 어댑터로 대체 |
| Flash 직접 응답 경로 | ✅ **축소** | 비서 대화 응대에만 잔존 허용 |

---

## 5. 🔗 어댑터 연결 순서 (확정)

> 대표님 지시 (2026-04-20): 순차적으로 연결, 각 어댑터 안정화 후 다음 단계 진행

```
Step 1 ──▶ Antigravity (Gemini CLI) 어댑터        ← 현재 구독 중, 최우선
Step 2 ──▶ Claude Code 어댑터                    ← 자율 코딩 에이전트
Step 3 ──▶ 이미지 LoRA 어댑터 (FLUX + 소시안)     ← Winner 200장 수집 완료 후
Step 4 ──▶ 영상 어댑터 (Kling + 캐릭터 LoRA)     ← Image LoRA 완성 후
```

### Step 1 상세: Antigravity (Gemini CLI) 어댑터

**Antigravity란?**: 대표님이 현재 구독 중인 Gemini 기반 AI CLI 도구 (= 루카 본체).  
현재는 **대화형 인터페이스**로만 사용 중이나,  
Ari 엔진과 공식 연결하면 **태스크를 위임받아 자율 실행하는 에이전트**로 동작 가능.

```
현재:
대표님 → (직접 대화) → Antigravity → 코드/분석 결과 → 대표님이 적용

연결 후:
대표님 → Ari 엔진 태스크 생성 → Antigravity 어댑터 자동 호출
                                    ↓
               스킬·워크플로우 실행 → 결과를 Ari 엔진에 자동 보고
```

**[Luca PRD 반영] Step 1 구현 방식 — 투트랙 전략:**

> 💡 구독 방식(Antigravity CLI)과 API 방식의 비용 구조가 다르므로 역할별로 분리 채택

| 역할 | 연결 방식 | Step 1 채택 | 프로덕션 목표 |
|---|---|:---:|:---:|
| **Ari 비서 레이어** | A. Local Socket/API 스트리밍 | ✅ 즉시 | — |
| **Luca·실행자 어댑터** | B. File Polling (폴더 감시) | ✅ 1단계 | A. Socket 고도화 |
| ~~C. Child Process spawn~~ | ~~세션 유지 불가, 오버헤드~~  | ❌ | ❌ 비추천 |

> **핵심 원칙 (Luca PRD)**:  
> - **Ari(비서)** = Socket/API 스트리밍 → 0.5초 이내 응답, 타이핑 애니메이션 지원  
> - **실행자(Luca 등)** = File Polling → 10분+ 백그라운드 태스크 안정성 우선  
> - ⏱️ **Hard Timeout = 10분** — 초과 시 `Failed` 마킹 + 사용자 수동 개입 요청

**기대 효과**:  
Anttigravity 구독 인증으로 별도 API 과금 없이 즉시 고성능 에이전트 운영 시작.

---

## 6. 🗓️ 실행 로드맵

### 📋 실행 전 필수 단계: 팀 리뷰 & 기획 고도화

> 대표님 지시: "실행 전 팀원들과 공유하고 조언을 추가로 받아 기획을 고도화한다"

```
[현재] v0.4 기획서 완성
    ↓
[다음] 팀원 공유 → 각 영역 전문가 의견 수렴
    │
    ├─ Luca (CTO): 기술 구현 검토 ✅ PRD 작성 완료
    └─ Prime (전략): 아키텍처 방향성 리뷰 ✅ 검토의견 반영 완료
    ↓
[이후] v1.0 확정 기획서 → 실행 승인
```

**팀 공유 방법**: 기획서를 Paperclip 게시판 or MyCrew 태스크로 등록,  
각 팀원에게 어사인 → 코멘트로 의견 수집

---

### Phase 0 — 기반 사전 작업 (실행 전)
- [ ] **BaseAdapter 공통 인터페이스 정의** (Prime 이슈 3)
  ```js
  class BaseAdapter {
    async execute(task)   → { result, tokenUsage, _meta }
    async healthCheck()   → { status: 'ok' | 'error' }
    async abort(taskId)   → void
    getCapabilities()     → ['text', 'code', 'image', 'video']
  }
  ```
- [ ] `executor.js` Flash 직접 응답 경로 → 비서 레이어로 격리 (Prime 이슈 1)
- [ ] **[Sonnet 요청 반영]** `videoLabRouter.js` / `imageLabRouter.js` 내 `geminiAdapter` API 직접 호출 의존성 완전 제거 (실행은 어댑터로 강제 위임).
- [ ] **[Sonnet 요청 반영]** `strategic_memory.md`에 "CKS Round 1 종료" 스냅샷 기록 및 Round 2 (High-Performance) 지표 명명.
- [ ] **[Sonnet 요청 반영]** 구형 Anti-Bridge 통신 환경 파일 완전 폐기.

#### ✅ [Nexus 통합 채택] 자동 Fallback + Hybrid 라우팅
- [ ] **Auto Fallback 로직 구현** (`geminiAdapter.js`)
  ```
  gemini-2.5-pro-preview → gemini-2.0-pro → gemini-2.5-flash
  Rate Limit/에러 발생 시 자동 하위 모델 전환
  ```
- [ ] **Hybrid 라우팅 우선순위 매트릭스** (`modelSelector.js` 신규)
  ```js
  // 고난이도 (코드/영상) → Pro 모델
  // 일상 (텍스트/요약) → Flash (비용 절감)
  const modelMatrix = {
    high:   'gemini-2.5-pro-preview',
    normal: 'gemini-2.5-flash'
  };
  ```
- [ ] **Step-by-Step Rollback 플랜 몥시** (Nexus 제안)
  - Rate Limit 발생 → Fallback 자동 전환
  - 성공률 < 70% → Sonnet/Flash 유지 (롤백)
  - 결과 → CksMetrics 자동 기록
- [ ] `requestQueue` 동시 호출 제한 어댑터 레벨로 확장 (max 5)

### Phase 1 — Antigravity 어댑터 연결 (2026.04~05 / Q2)
> 🎯 목표: File Polling 방식으로 Ari ↔ Antigravity CLI 연동, Ari 비서는 Socket/Streaming
- [ ] Ari 비서 레이어: Socket/API 스트리밍 연결 (응답 즉시성 확보)
- [ ] 실행 레이어: `.agents/tasks/` File Polling 폴더 구조 구현
- [ ] BaseAdapter 인터페이스 상속 적용 + Hard Timeout 10분 방어 로직
- [ ] Ari 엔진 → Pro 모델 태스크 위임 프로토콜 설계
- [ ] 스킬·워크플로우·룰 컨텍스트 자동 주입 구조 구현
- [ ] 다채널 연동: MyCrew 대시보드 웹챗 + Telegram + CLI 3채널
- [ ] 파일럿 태스크: 마케팅 콘텐츠 자동 생성 루프 테스트
- [ ] 결과 → 대시보드 실시간 보고 검증
- [ ] **Pro 토큰 모니터링**: `CksMetrics.pro_token_usage` 콜럼 추가 + **팀 분석 탭 UI 구현** (Nexus 제안 개선)

### Phase 2 — Claude Code 어댑터 (2026.05 / Q2)
> 🎯 목표: Claude Code 자율 코딩 에이전트 연결, File Polling 방식 동일 적용
- [ ] Claude Code File Polling 어댑터 구현 (BaseAdapter 상속)
- [ ] Ari 엔진 → Claude Code 태스크 위임 프로토콜
- [ ] MyCrew 전용 AGENTS.md 작성 (컨텍스트 자동 주입)
- [ ] 첫 자율 코딩 태스크 파일럿 (버그 픽스 → 커밋)

### Phase 3 — 이미지 LoRA 어댑터 (2026.05~06 / Q2)
> 🎯 목표: 소시안 FLUX LoRA 학습 완료 + Imagen 어댑터 통합
- [ ] CKS Round 1 완료 확인 후 착수 (데이터 격리)
- [ ] Image Lab Winner 200장 수집 완료
- [ ] Replicate / RunPod FLUX LoRA 학습 (비용 결정 후)
- [ ] 소시안 LoRA 가중치 → Imagen 어댑터 통합
- [ ] A/B 테스트: Imagen3 vs FLUX+LoRA

### Phase 4 — 영상 어댑터 (2026.06 / Q2)
> 🎯 목표: 비용 검토 후 Kling API 또는 MCP 대안 도구로 영상 파이프라인 완성
- [ ] 비용 검토: Kling API vs Antigravity 플러그인/MCP 대안 도구 최종 선택
- [ ] 선택 방식으로 영상 어댑터 구현
- [ ] 캐릭터 일관성 LoRA 학습
- [ ] 자율 영상 생성 → 후편집 → 게시 파이프라인 완성

---

## 6-A. 🔬 CKS 실험 데이터 격리 전략 (Prime 이슈 2 반영)

> CKS 실험 진행 중 어댑터 교체 시 베이스라인 오염 위험 → 격리 필요

| CKS 구성 요소 | 어댑터 교체 영향 | 대응 전략 |
|---|---|---|
| Team A/B 크루 | 모델 변경 | **양 팀 동시 교체** (Mirror Design 유지) |
| TEI 측정 | 토큰 비용 베이스라인 변경 | **Round 분리** — 교체 전/후 라운드 구분 |
| Anti-Bridge | 불필요해짐 | **Step 1 완료 후 해체** |
| KSI-S | 의미론적 유사도 기준선 변동 | **라운드 초기 신규 베이스라인 측정** |

> **원칙**: CKS Round 1은 현재 Flash 모델로 완료 → Round 2부터 고성능 어댑터 적용.  
> 이로써 "동일 프로세스 + 모델만 교체" 효과를 독립 변수로 측정 가능.

---

## 7. 💰 비용 구조 변화 예측 (현실 기준 재산정)

> 현재 **Gemini Ultra 구독 중** (₩180,000~360,000/월) → Antigravity CLI 포함

| 항목 | 현재 월 비용 | 전환 후 예상 | 비고 |
|---|---|---|---|
| **Gemini Ultra 구독** | ₩180k~360k | 유지 | Antigravity CLI 포함. **구독 인증으로 API 과금 대체 검토** |
| Gemini API (Flash) | 무료 (한도 내) | 구독으로 대체 or 소량 유지 | 구독 방식 연동 시 추가 API 과금 없음 |
| Claude Sonnet API | 종량제 | 유지 | |
| Claude Code | 없음 | 비용 과다 시 → **Antigravity 플러그인/MCP 도구로 대체** | ⚠️ 비용 과다 시 불가 |
| GPU (LoRA 학습) | 없음 | 1회성 ~₩30k~50k (RunPod) | 예산 승인 후 집행 |
| Kling API (영상) | 없음 | 비용 과다 시 → **MCP 대안 도구 검토** | ⚠️ 비용 과다 시 불가 |
| **추가 예산 목표** | **₩0** | **최소화 (구독 최대 활용)** | |

> 📌 **핵심 전략**: 기존 Gemini Ultra 구독을 API 인증 수단으로 최대 활용.  
> Claude Code, Kling 등 고비용 외부 서비스는 **Antigravity 플러그인·MCP 도구로 우선 대체 검토 후** 도입 결정.

---

## 7. 🎯 성공 지표 (KPI)

| 지표 | 현재 기준 | 6개월 목표 |
|---|---|---|
| 태스크 자동 완료율 | ~30% | **70%+** |
| 워크플로우 의도 해석 정확도 | ~60% | **90%+** |
| 이미지 브랜드 일치도 (평균점수) | 3.2/5 | **4.2/5** |
| 영상 캐릭터 일관성 | 없음 | **측정 지표 수립** |
| 코드 태스크 자율 완료 비율 | 0% | **40%+** |
| **Pro 토큰 사용량** (신규) | 미측정 | **팀 분석 탭 차트로 실시간 모니터링** |
| Fallback 발생률 | 미측정 | **< 10%** (Pro 안정화 지표) |

---

## 9. 📌 의사결정 필요 항목

> 대표님 확인 및 결정 요청 사항

- [x] **어댑터 연결 순서 확정**: Antigravity → Claude Code → Image LoRA → 영상 LoRA ✅
- [x] **팀 리뷰 선행**: 실행 전 팀원 공유 및 의견 수렴 ✅
- [x] **전체 일정**: 2026 Q2(4~6월) 내 Phase 1~4 완료 목표 ✅
- [x] **팀 리뷰 기한**: 2026-04-20 (오늘) — Prime ✅ / Luca ✅ / Nexus ✅ 완료
- [ ] **Gemini Ultra 구독 인증 방식**: 구독으로 API 과금 대체 가능 범위 확인 필요
- [ ] **Claude Code 도입 여부**: 비용 과다 시 → Antigravity 플러그인·MCP 도구 대체 검토
- [ ] **Kling API 도입 여부**: 비용 과다 시 → MCP 대안 영상 도구 검토
- [ ] **LoRA 학습 GPU 예산**: RunPod 1회성 ~$30~50 집행 승인

---

---

## 📎 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|---|---|---|---|
| v0.1 | 2026-04-20 | 초안 작성 (전략 방향 + 4개 어댑터 영역) | Luca |
| v0.2 | 2026-04-20 | 어댑터 연결 순서 확정 + 팀 리뷰 프로세스 추가 | Luca |
| v0.3 | 2026-04-20 | Prime(Claude Opus) 피어 리뷰 4건 전면 반영 | Luca |
| v0.4 | 2026-04-20 | 대표님 지시사항 + Luca PRD 반영 (일정 Q2 통합, 투트랙 통신, 비용 현실화) | Luca |
| v0.5 | 2026-04-20 | Nexus 검토의견 반영 (Auto Fallback, Hybrid 라우팅, Rollback 플랜, Pro 토큰 모니터링) | Luca |
| v1.0 | 2026-04-20 예정 | 대표님 최종 승인 → 실행 확정본 | 대표님 |

**v0.5 반영 항목 체크 (Nexus 채택 의견):**
- [x] ✅ Auto Fallback 로직: `gemini-2.5-pro → 2.0-pro → 2.5-flash` 자동 전환
- [x] ✅ Hybrid 라우팅 매트릭스: `modelSelector.js` 고/일상 태스크 분리
- [x] ✅ Step-by-Step Rollback 플랜: Rate Limit → fallback, 성공률 <70% → Sonnet 유지
- [x] ✅ Pro 토큰 모니터링: `CksMetrics.pro_token_usage` + **팀 분석 탭 차트** 구현
- [x] ✅ requestQueue 동시 호출 제한 어댑터 레벨 확장 (max 5)
- [x] ❌ 월간 워크숍: 불채택 (조직 규모 과도)
- [x] ❌ SKILL.md 템플릿: 보류 (어댑터 완성 후 자연 추가)
- [x] Nexus 팀 리뷰 완료 마킹

*본 기획서는 대표님 최종 승인 후 v1.0으로 확정되며, 실행은 v1.0 승인 이후 시작됨.*
