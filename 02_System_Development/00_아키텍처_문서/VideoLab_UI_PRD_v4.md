# 📐 PRD: Video Lab UI/UX 전면 개선안 (v4.1)

> **작성자**: Sonnet  
> **날짜**: 2026-04-23 (v4.1 — Prime 코드리뷰 반영)  
> **기준 파일**: `VideoLabView.jsx` (현재 v3.0, 루카 작업 대기 중)  
> **참조 기획**: 대표님 기획안 v3.2 + Prime 코드리뷰 #12  
> **상태**: Draft — Luca 리뷰 후 확정

> [!NOTE]
> **루카 작업 현황 (2026-04-23 14:43)**: VideoLabView.jsx 원본과 동일 확인 — 작업 미반영 상태. 루카 완료 후 재확인 필요.

---

## 1. 현재 상태 분석 (As-Is)

### 1-1. 뷰 흐름 (현재 4단계)

```
CHANNELS → AUTOMATING → REVIEW → RESULT
```

### 1-2. 현재 구조의 문제점

**[프론트엔드 — VideoLabView.jsx]**

| 영역 | 문제 |
|------|------|
| **CHANNELS** | 채널 카드 3개뿐 — 실제 파이프라인과 연결 없는 목업 상태 |
| **AUTOMATING** | 하드코딩 `setTimeout` 시뮬레이션 — 실제 서버 로그 미수신 |
| **REVIEW** | 씬 3개 고정 목업 — 실제 시나리오 JSON 미연동 |
| **REVIEW** | 오디오 파형 `Math.random()` 랜덤값 — 실제 TTS 데이터 미반영 |
| **REVIEW** | 챗 전송 버튼 — 실제 AI 크루 호출 로직 없음 |
| **RESULT** | 유튜브 업로드 버튼 — 실제 API 연결 없음 |
| **전체** | 현재 진행 중인 파이프라인 상태 재진입 불가 |

**[백엔드 — Prime 코드리뷰 #12 발견 이슈]**

| 파일 | 이슈 | 심각도 |
|------|------|--------|
| `CurationAgent.js L1` | 구버전 SDK `@google/generative-ai` 사용 — 엔진 나머지는 `@google/genai` 통일됨 | 🔴 P0 |
| `CurationAgent.js L54` | `gemini-1.5-flash` — strategic_memory 금지 식별자, 언제든 404 가능 | 🔴 P0 |
| `CurationAgent.js L67` | Fallback이 **3개 씬**만 포함 — 5개 씬 필수인데 불완전한 영상 생성 위험 | 🔴 P0 |
| `CurationAgent.js L67` | Fallback이 항상 "엔비디아 젠슨황" 동일 뉴스 — 날짜 로테이션 없음 | 🔴 P0 |
| `TTSAgent.js L23` | `GEMINI_API_KEY`로 GCP TTS 호출 — 별개 서비스 키 혼용 | 🟡 P1 |
| `TTSAgent.js L94` | `scene.durationFrames` 직접 덮어쓰기 — 원본값 영구 소실, 규칙 2 위배 | 🟡 P1 |
| `TTSAgent.js L90` | 글자 수 기반 프레임 추정 (0.19초/글자) — 실제 오차 최대 30%+ | 🟡 P1 |
| `index.js L59` | `publicDir` 절대 경로 하드코딩 `/Users/alex/Documents/...` | 🟢 P2 |
| `index.js L115` | 모듈 import 시 파이프라인 즉시 가동 (ESM 사이드이펙트) | 🟢 P2 |
| `DataHarvester.js L37` | `engagementScore` 완전 랜덤 — AI 판단 오염 | 🟢 P2 |

---

## 2. 목표 아키텍처 (To-Be)

### 2-1. 뷰 흐름 재설계 (6단계)

```
HOME
  ↓
[1] CHANNEL_SELECT    채널 포맷 선택
  ↓
[2] PIPELINE_LIVE     실시간 파이프라인 진행 (실제 서버 연동)
  ↓
[3] REVIEW_STUDIO     사전 리뷰 스튜디오 (3패널 레이아웃)
  ↓
[4] AI_FEEDBACK       AI 크루 피드백 수신 & 재렌더 지시
  ↓
[5] PUBLISH_CONFIRM   업로드 최종 확인 및 스케줄 설정
  ↓
[6] DONE              완료 + 채널 분석 링크
```

### 2-2. 핵심 설계 원칙

1. **실제 데이터 연동 우선** — 목업/하드코딩 제거, 파이프라인 JSON 직접 바인딩
2. **씬(Scene) 중심 인터랙션** — 모든 피드백은 씬 단위로 태깅
3. **비동기 상태 보존** — 렌더링 중 탭 이동해도 상태 복귀 가능
4. **AI 크루 존재감** — Prime/Sonnet/Luca 각자의 역할이 UI에 드러남

---

## 3. 뷰별 상세 스펙

---

### [VIEW 1] CHANNEL_SELECT

**현재**: 채널 카드 3개, 목업  
**개선**: 실제 채널 상태 표시 + 최근 실행 이력 추가

#### 추가 기능
- **최근 실행 이력**: 채널별 마지막 생성 시각 표시
- **현재 실행 중 배지**: 파이프라인 진행 중이면 `● 진행 중` 표시
- **이어 보기**: 진행 중인 파이프라인 있으면 `[이어서 리뷰하기]` 버튼 노출

---

### [VIEW 2] PIPELINE_LIVE (현 AUTOMATING 개선)

**현재**: `setTimeout` 시뮬레이션  
**개선**: 실제 서버 이벤트 수신 + 단계별 실물 산출물 표시

#### 레이아웃 요소
- **5단계 프로그레스 바**: DataHarvester → CurationAgent → ImageLabAgent → TTSAgent → VideoAdapter
- **현재 작업 인디케이터**: "Scene 2 proof 이미지 생성 중..."
- **실시간 생성 이미지**: ImageLabAgent 출력 썸네일 순서대로 노출
- **채택 시나리오 미리보기**: CurationAgent 완료 시 Rank1 제목 노출
- **터미널 로그**: 접기/펼치기 가능한 실 로그 스트림

#### 연동 스펙
- **Socket.IO**: `pipeline:step_update`, `pipeline:image_ready`, `pipeline:done`
- 중단 버튼 → VideoAdapter 종료 신호

---

### [VIEW 3] REVIEW_STUDIO (핵심 개선)

**현재**: 3패널 골격만 있음, 목업 데이터  
**개선**: 실제 시나리오 JSON 연동 + 씬 타겟팅 완성

#### 좌측 패널: 모바일 시뮬레이터 (320px)
- 스마트폰 목업 프레임 (9:16)
- 실제 MP4 파일 재생 (`<video>` 태그, 로컬 URL)
- 재생/일시정지/배속 컨트롤 (×0.5, ×1, ×1.5, ×2)
- 자막 오버레이: 현재 씬 `textLines` 싱크
- **양방향 연동**: 재생 씬 ↔ 중앙 스토리보드 하이라이트

#### 중앙 패널: 스토리보드 타임라인

```
SceneCard 구성:
┌─────────────────────────────────────────┐
│ [씬 타입 뱃지]           [Focused 뱃지] │
│ ┌──────────┐  텍스트 라인 1              │
│ │  이미지  │  텍스트 라인 2              │
│ │ 썸네일   │                             │
│ └──────────┘  ██████░░ (24px 오디오 파형)│
│               0:08s ~ 0:14s             │
└─────────────────────────────────────────┘
```

씬 타입 뱃지:
- `hook` 🔥 레드 / `problem` ⚠️ 오렌지
- `proof` 📊 블루  / `climax` ⚡ 퍼플 / `cta` 🔔 그린

인터랙션:
- **클릭** → `focusedScene` 변경 → 레드 보더 + 우측 챗 컨텍스트 변경
- **더블클릭** → 해당 씬 시간대로 좌측 플레이어 점프
- **이미지 클릭** → Brand Studio 재생성 인라인 모달

#### 우측 패널: TTS & AI 크루 챗 (360px)

**TTS 버전 스왑:**
```
[A] 여성 꿀보이스  (Neural2-A, rate 1.2)
[B] 남성 극초저음  (Neural2-C, rate 1.0, pitch -2)
[C] 표준           (Neural2-C, rate 1.25, pitch 1.5)  ← 현재 기본
```
→ 클릭 시 백엔드 TTS 재합성 → 좌측 플레이어 오디오 교체

**AI Crew 챗:**
- 아바타: Prime(파랑/P), Sonnet(보라/S), Luca(에메랄드/L)
- 포커스 상태에 따라 입력창 컨텍스트 뱃지 자동 표시
- 전송 시 `[Scene N 포커스]` 태그 자동 첨부
- Ari 소켓으로 AI 응답 수신

---

### [VIEW 4] AI_FEEDBACK (신규)

**현재**: 없음 (REVIEW → RESULT 직행)  
**개선**: 크루별 수정 작업 시각화

각 크루의 실행 상태 독립 표시:
- 🔵 Luca: 이미지 재생성 진행률
- 🟣 Sonnet: TTS 재합성 상태
- ⚙️ VideoAdapter: 재렌더 대기/진행

---

### [VIEW 5] PUBLISH_CONFIRM (현 RESULT 개선)

**현재**: 업로드 버튼(비연동) + 다운로드만  
**개선**: 업로드 전 메타데이터 확인 + 예약 발행 옵션 + **품질 게이트 통과 여부 표시**

- **품질 게이트 결과 배너** (Prime 권고 반영)
  ```
  ✅ 품질 게이트 통과 — 업로드 가능
  또는
  ⚠️ 불합격: 씬 수 불일치, 길이 부적합 (38초)
  ```
- 편집 가능한 제목 필드 (90자 이내 카운터)
- 해시태그 편집
- 공개 범위: 공개/비공개/일부공개
- 예약 발행: 즉시 / 날짜+시각 선택
- [🚀 유튜브 업로드] / [⬇ MP4 다운로드] / [↺ 다시 검토]

---

### [VIEW 6] DONE (현 RESULT에서 분리)

- 업로드 완료 + 유튜브 URL 노출
- 24시간 후 Analytics 자동 수집 예고 표시
- [유튜브에서 보기] [대시보드로] [다음 영상 만들기]

---

## 4. 신규 컴포넌트 설계

| 컴포넌트 | 역할 | Props 핵심 |
|----------|------|-----------|
| `SceneCard.jsx` | 씬 카드 공용 | scene, isFocused, onClick, onImageClick |
| `PhoneSimulator.jsx` | 좌측 모바일 목업 | videoSrc, currentScene, ttsVersion |
| `AiCrewChat.jsx` | 우측 챗 패널 | focusedScene, sceneName, onSend, messages |
| `TtsSwap.jsx` | TTS 버전 선택 | active, onChange, isLoading |
| `PipelineProgress.jsx` | 5단계 프로그레스 | status, currentStep, logs |

---

## 5. 상태(State) 설계

```js
{
  viewState: 'CHANNEL_SELECT' | 'PIPELINE_LIVE' | 'REVIEW_STUDIO' |
             'AI_FEEDBACK' | 'PUBLISH_CONFIRM' | 'DONE',
  selectedChannel: Channel | null,

  // 파이프라인 데이터
  pipelineStatus: { step: number, totalSteps: 5, currentTask: string },
  scenarioData: Scenario | null,   // CurationAgent 출력
  generatedAssets: AssetMap | null, // ImageLabAgent 출력

  // 리뷰 스튜디오
  focusedScene: number | null,   // 0-based index
  activeTTS: 'A' | 'B' | 'C',
  chatMessages: Message[],
  currentPlayingScene: number,

  // 발행 설정
  publishTitle: string,
  publishPrivacy: 'public' | 'private' | 'unlisted',
  publishScheduled: Date | null,
}
```

---

## 6. 백엔드 수정 요구사항 (Prime 코드리뷰 → 프론트 연동 전 선행 필요)

> [!CAUTION]
> 아래 백엔드 이슈는 프론트 실데이터 연동 **이전에** 반드시 해결해야 합니다. 특히 P0 항목은 UI가 제대로 작동해도 영상 품질이 보장되지 않습니다.

### P0 — 즉시 해결 (Sonnet 담당)

| 파일 | 수정 내용 |
|------|----------|
| `CurationAgent.js` | SDK `@google/generative-ai` → `@google/genai` 통일 |
| `CurationAgent.js` | 모델명 `gemini-1.5-flash` → `MODEL.FLASH` (modelRegistry) |
| `CurationAgent.js` | Fallback 5개 씬 완비 + 날짜 로테이션 다변화 |

### P1 — 품질 개선 (Sonnet 담당)

| 파일 | 수정 내용 |
|------|----------|
| `TTSAgent.js` | API 키 `GOOGLE_CLOUD_TTS_KEY \|\| GEMINI_API_KEY` 분리 |
| `TTSAgent.js` | `scene.originalDurationFrames` 원본 보존 후 재계산 |
| `TTSAgent.js` | ffprobe 실측 도입 → 글자 수 추정식 Fallback |
| `index.js` | `publicDir` 절대경로 → `path.resolve(process.cwd(), ...)` |
| `index.js` | `import.meta.url` 가드 → import 시 파이프라인 즉시 가동 방지 |

### P2 — 중장기 (스프린트 2)

| 파일 | 수정 내용 |
|------|----------|
| `index.js` | `qualityGate()` 함수 추가 — 씬 수, 길이, 오디오 자동 검증 |
| `DataHarvester.js` | `engagementScore` 실제 파싱 or CurationAgent에 제목만 전달 |

---

## 7. API 연동 계획

| 뷰 | API | 역할 |
|----|-----|------|
| PIPELINE_LIVE | Socket `pipeline:step_update` | 단계 실시간 수신 |
| PIPELINE_LIVE | Socket `pipeline:image_ready` | 생성 이미지 수신 |
| REVIEW_STUDIO | `GET /api/pipeline/latest-scenario` | 시나리오 로드 |
| REVIEW_STUDIO | `POST /api/pipeline/tts-swap` | TTS 버전 교체 |
| REVIEW_STUDIO | `POST /api/ari/chat` | AI 크루 피드백 |
| PUBLISH_CONFIRM | `GET /api/pipeline/quality-gate` | 품질 게이트 결과 |
| PUBLISH_CONFIRM | `POST /api/pipeline/upload` | 유튜브 업로드 |

---

## 8. 구현 우선순위 (백엔드 선행 → 프론트 순)

### Sprint 1 — 백엔드 안정화 (Sonnet)

| 우선순위 | 작업 | 파일 |
|---------|------|------|
| **P0** | SDK + 모델명 + keyProvider 통합 | CurationAgent.js |
| **P0** | Fallback 5개 씬 완비 + 날짜 로테이션 | CurationAgent.js |
| **P1** | TTS API 키 분리 + originalDurationFrames 보존 | TTSAgent.js |
| **P1** | ffprobe 실측 도입 (Fallback: 추정식) | TTSAgent.js |
| **P1** | 경로 하드코딩 제거 + import 가드 | index.js |
| **P2** | qualityGate() 함수 추가 | index.js |

### Sprint 2 — 프론트 실데이터 연동 (Sonnet + Luca)

| 우선순위 | 작업 | 담당 |
|---------|------|------|
| **P0** | REVIEW 씬 실제 JSON 연동 + SceneCard 컴포넌트 | Sonnet |
| **P0** | 씬 타겟팅 + 챗 `[Scene N]` 태그 자동 첨부 | Sonnet |
| **P0** | TTS A/B/C 스왑 UI (여성 꿀보이스/남성 극초저음/표준) | Sonnet |
| **P1** | PIPELINE_LIVE Socket 이벤트 연동 | Sonnet |
| **P1** | PhoneSimulator MP4 실재생 | Sonnet |
| **P1** | PUBLISH_CONFIRM 품질 게이트 배너 + 메타데이터 폼 | Sonnet |
| **P2** | AI_FEEDBACK 크루별 작업 시각화 | Sonnet |
| **P2** | AiCrewChat Ari 소켓 연동 | Sonnet |
| **P2** | 씬 이미지 인라인 교체 모달 | Luca 리뷰 후 |

---

## 9. 콘텐츠 전략 개선 (Prime 권고 반영)

> [!TIP]
> CurationAgent 프롬프트에 아래 방향을 반영하면 Hook 클릭률이 높아집니다.

| 씬 | 현재 방향 | → 개선 방향 |
|----|----------|-------------|
| **Hook** (0~3초) | 텍스트 2줄 | 숫자+감정 공식: "87%가 모르는 사실..." |
| **Problem** (3~10초) | 문제 제기 | 대비 구조: "어제까지 vs 오늘" 시각적 대비 |
| **Proof** (10~18초) | 데이터 제시 | 출처 명시: "JP모건 리포트" 신뢰성 강화 |
| **Climax** (18~25초) | AI 이미지 | 반전: 예상과 반대되는 결론 |
| **CTA** (25~30초) | 구독 유도 | 다음 편 예고: "내일은 더 충격적인..." 시리즈 후킹 |

---

## 10. 품질 게이트 체크리스트 (Prime 설계)

업로드 전 모든 항목이 통과되어야 합니다. 프론트엔드 PUBLISH_CONFIRM 뷰에서 시각적으로 표시됩니다.

| # | 항목 | 기준 | 자동 검증 |
|---|------|------|----------|
| 1 | 영상 길이 | 15~58초 (Shorts 규격) | ✅ ffprobe |
| 2 | 음성-영상 싱크 | 오차 0.5초 이내 | ✅ ffprobe vs frames |
| 3 | 씬 수 | 정확히 5개 | ✅ scenes.length |
| 4 | Hook 텍스트 | 15자 이내 | ✅ textLines[0].length |
| 5 | 이미지 해상도 | 1080×1080 이상 | ✅ 파일 메타 |
| 6 | 제목 길이 | 90자 이내 | ✅ title.length |
| 7 | Fallback 사용 여부 | 경고 표시 | ⚠️ UI 배너 |

---

## 11. 미결 사항 (검토 요청)

> [!IMPORTANT]
> **Luca**: PhoneSimulator 목업 프레임 CSS 디자인 + SceneCard 레이아웃 리뷰 요청

> [!IMPORTANT]
> **Prime**: AI_FEEDBACK 뷰에서 크루별 작업 시각화 UX — 전략 관점 의견 요청

> [!NOTE]
> TTS A/B/C 병렬 생성 vs 온디맨드 생성 — 결정 필요  
> 씬 이미지 교체 → MP4 재렌더 자동 트리거 vs 수동 확인 — 결정 필요  
> Sprint 1 백엔드 완료 후 파이프라인 2차 사이클 실행 → 품질 비교 진행 예정

---

*작성: Sonnet | v4.1 업데이트: 2026-04-23 14:43 KST (Prime 코드리뷰 #12 반영)*  
*대상 파일: `02_워크스페이스_대시보드/src/components/Views/VideoLabView.jsx`*  
*백엔드 대상: `CurationAgent.js`, `TTSAgent.js`, `index.js`*
