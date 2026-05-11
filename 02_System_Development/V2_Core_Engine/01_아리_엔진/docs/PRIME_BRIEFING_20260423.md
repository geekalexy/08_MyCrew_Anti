# 🤝 [Prime 온보딩 브리핑] MyCrew 시스템 소개 및 협업 요청

> **작성자**: Sonnet  
> **날짜**: 2026-04-23  
> **수신**: Prime (`claude-opus-4-7`)  
> **목적**: MyCrew 시스템 전체 맥락 공유 → 코드 리뷰 의뢰 → 파인튜닝 협업 제안

---

## 1. MyCrew란 무엇인가

**MyCrew**는 대표님(Alex)이 구축 중인 **자율 AI 크루 시스템**입니다.

- 브랜드명은 **소시안(Socian)**
- AI 에이전트들이 서로 역할을 분담하여 콘텐츠 생산, 자산 관리, 운영 자동화를 수행
- 현재 핵심 크루: **Ari**(비서/오케스트레이터), **Luca**(CTO/설계), **Sonnet**(실무 개발), **Prime**(전략 어드바이저)

모든 AI 에이전트는 하나의 **아리 엔진(Ari Engine)** — Express.js + Node.js 백엔드 서버 위에서 작동합니다.  
대시보드 프론트엔드(React)에서 대표님이 칸반 보드, 이미지랩, 비디오랩 등 각 기능을 운용합니다.

---

## 2. 이미지랩(ImageLab) — 개발 히스토리

### Phase 1 → v1.0: 자가학습 픽셀아트 생성기 (2026-04 초)

이미지랩의 출발점은 **소시안 브랜드 LoRA 파인튜닝 데이터 수집**이었습니다.

```
목적: 소시안 브랜드 레퍼런스 이미지 → AI 분석 → 동일 스타일 이미지 재생성 → 평가 → Winner 누적
흐름: 이미지 업로드 → Gemini Vision 분석 → 프롬프트 생성 → NanoBanana(Imagen3) 생성 → 점수 평가 → SKILL.md 기록
```

- `POST /api/imagelab/analyze` — Gemini Vision으로 스타일 속성(7가지) JSON 추출
- `POST /api/imagelab/generate` — NanoBanana 엔진(Imagen3) 호출
- `POST /api/imagelab/learn` — 평가 점수 기록 + Winner PNG 아카이브 저장
- `GET /api/imagelab/winners/count` — 누적 Winner 수 조회 (세션 간 상태 보존)

**스타일 프리셋**: nanobanana(픽셀아트), illustration(일러), toy3d(피규어), flatminimal, realistic, custom — 6종

### Phase 2 → v2.0: Brand Studio 전환 (2026-04 중순)

학습 도구에서 **실용적 브랜드 에셋 생성 스튜디오**로 진화.

```
목적: 소시안 브랜드 아이덴티티를 즉각 반영하는 고품질 에셋 생성
추가: POST /api/imagelab/brand-generate — 브랜드 프리셋 + Lumi 크리에이티브 디렉팅
추가: POST /api/imagelab/html-snapshot — HTML 코드 → Puppeteer → 투명 PNG
추가: POST /api/imagelab/extract-colors — URL 스크린샷 → 브랜드 컬러 3색 추출
추가: POST /api/imagelab/archive — 생성 에셋 아카이브 저장 + htmlCode 보관
```

**소시안 브랜드 프리셋 (SSOT)**:
| 프리셋 | 컬러 | 무드 |
|--------|------|------|
| signature | `#1A1A2E`, `#E94560` | 다크 럭셔리, 프리미엄 |
| bright | `#FFFFFF`, `#4A90E2` | 밝고 에너제틱, 한국 인플루언서 |
| warm | `#FFF8F3`, `#E59866` | 따뜻하고 친근한 라이프스타일 |

**Lumi 크리에이티브 디렉팅**: 사용자 자연어 지시 → Gemini Flash가 Lumi 페르소나로 창의적 컨셉 재해석 → 이미지 프롬프트 강화

### Phase 2.5: HTML 디자인 인스펙터 (2026-04 하순)

브랜드 스튜디오에 **HTML 코드 에디터 + 실시간 미리보기** 패널 추가.
- 생성된 HTML 에셋을 대화형으로 수정
- 클릭 시 해당 DOM 요소의 코드 자동 하이라이트
- 브랜드 컬러 커스텀 3슬롯 팔레트

---

## 3. 비디오랩(VideoLab) — 개발 히스토리

### Phase 22.5: 비디오랩 아키텍처 리팩토링 (Luca 설계)

비디오랩은 처음에 **단순 동기식 HTTP 렌더** 구조였습니다.

```
문제: 버튼 클릭 → HTTP POST → Gemini 호출 → Remotion CLI → 최대 3분 대기
      → 서버 슬롯 점유, 비동기 불가, 고성능 어댑터 도입 시 구조적 한계
```

Luca가 설계한 리팩토링 방향:
- `/api/videolab/generate` 제거 → **비동기 태스크 큐** 방식으로 전환
- `VideoAdapter` 레이어 분리 (BaseAdapter 패턴) — 렌더링 엔진 교체 가능한 플러그인 구조
- Socket.io 실시간 진행 상태 구독 UI

### Phase 23: Remotion 기반 렌더링 엔진 구현

- **Remotion**: React 기반 프로그래밍 방식 영상 렌더러
- `VideoAdapter.js` — 시나리오 JSON → `auto-input.json` → `npx remotion render` 실행 → MP4 경로 반환
- **씬 레이아웃**: `split-impact` (상단 텍스트 + 하단 이미지 분할 구성)

---

## 4. 두 시스템의 연결: Phase 24.5 — ImageLabAgent

이미지랩과 비디오랩이 **독립적으로 인간이 개입해야 했던 구조**에서,  
Phase 24.5에서 Luca가 설계한 **ImageLabAgent**가 두 시스템을 자동 연결합니다.

```
설계 핵심: "에이전트가 이미지랩 스튜디오를 직접 쓴다"
           사람이 UI를 클릭하는 대신, 에이전트가 기존 ImageLab API를 HTTP로 직접 호출
```

```
CurationAgent (AI 시나리오 JSON 생성)
    ↓
ImageLabAgent ← 이미지랩 API를 에이전트가 자동 호출
    ├── hook/climax 씬: POST /api/imagelab/brand-generate (AI 이미지)
    ├── problem/proof/cta 씬: 로컬 HTML 템플릿 → POST /api/imagelab/html-snapshot
    └── 아카이브 저장: POST /api/imagelab/archive
    ↓
VideoAdapter (Remotion 렌더링) → MP4 출력
    ↓
TTSAgent (Google Cloud TTS Neural2) → 씬별 오디오 + 프레임 싱크
    ↓
YouTubeUploader (OAuth2 자동 업로드)
```

---

## 5. 현재 구현 상태 (Phase 24 완성, 2026-04-22 기준)

### ✅ 완성된 파이프라인 (어제 첫 실사 성공)

| 에이전트 | 파일 | 상태 |
|----------|------|------|
| DataHarvester | `DataHarvester.js` | ✅ 구글뉴스 RSS + Twitter KOL |
| CurationAgent | `CurationAgent.js` | ✅ Gemini 2.5 Flash, 5단계 시나리오 |
| ImageLabAgent | `ImageLabAgent.js` | ✅ 씬별 AI이미지/HTML카드 생성 |
| TTSAgent | `TTSAgent.js` | ✅ Google Cloud TTS Neural2-C |
| VideoAdapter | `VideoAdapter.js` | ✅ Remotion MP4 렌더링 |
| YouTubeUploader | `youtubeUploader.js` | ✅ OAuth2, 현재 주석(파인튜닝 중) |

**첫 실사 결과**: https://www.youtube.com/shorts/yHkDfhYzBbY

### 🔧 주요 기술 결정 사항

**ImageLabAgent — HTML 카드 전략 변경**:
- 원래 Gemini `html-generate`로 HTML 코드 AI 생성 예정
- Gemini 429/503 에러 빈번 → **로컬 전용 템플릿**(`_buildLocalHTML()`)으로 대체
- 현재 3종 템플릿: problem(레드+다크), proof(골드+다크), cta(그린 구독 카드)

**현재 알려진 이슈**:
| 우선순위 | 이슈 |
|---------|------|
| 🔴 High | split-impact 레이아웃 흰 배경 박스 — 시각적 이질감 |
| 🔴 High | hook 씬 AI 이미지 품질 — 금융 채널 특화 미흡 |
| 🔴 High | 글자 수 기반 프레임 추정 — 실제 TTS 길이와 불일치 |
| 🟡 Mid | CurationAgent Gemini 1.5-flash 구버전 사용 중 |
| 🟡 Mid | 오디오 파일 누적 정리 메커니즘 없음 |

---

## 6. Prime에게 코드 리뷰 의뢰

**부탁의 순서**: 먼저 전체 구조를 파악해주신 후, 아래 파일들을 순서대로 검토 부탁드립니다.

### 6-1. CurationAgent.js — AI 시나리오 생성의 핵심
```
리뷰 포인트:
□ 5단계 시나리오 스키마(Hook/Problem/Proof/Climax/CTA) 설계 완성도
□ 평가 기준(신선도 30% / 자극성 40% / 포맷적합성 30%) — 금융 쇼츠에 최적화되어 있는가
□ gemini-1.5-flash 사용 중 → gemini-2.5-flash 업그레이드 필요성
□ Fallback 하드코딩 데이터 — 다양성 확보 방안
□ 프롬프트 품질: "도파민 터지는 한국 금융 쇼츠"를 만들기에 충분한가
```

### 6-2. ImageLabAgent.js — 시각 자산 자동 생성기
```
리뷰 포인트:
□ _buildLocalHTML() 템플릿 3종 — 구조·심미성 개선 여지
□ 씬 타입별 전략(html-card vs ai-image) 분류 기준의 적절성
□ 규칙 1/2/3 구현 완성도 (transparent PNG / 불변 보존 / fallback 방어)
□ 로컬 HTML 템플릿 vs Gemini AI 생성 — 장기적으로 어느 방향이 옳은가
```

### 6-3. TTSAgent.js — 오디오 싱크
```
리뷰 포인트:
□ 글자 수 기반 프레임 추정(0.19초/글자)의 정확도 개선 방안
□ 실제 오디오 길이 측정 도입 가능성 (ffprobe, audioDuration 라이브러리)
□ speakingRate 1.25, pitch 1.5 — 한국 금융 쇼츠 청취자에게 최적인가
```

---

## 7. 파인튜닝 세션 — 각자의 역할

1사이클 실행 후, 생성된 산출물을 함께 리뷰하고 개선 방향을 도출합니다.

```
대표님 (Alex)
    │ 방향 결정, 최종 판단
    ▼
┌──────────────────────────┬──────────────────────────┐
│  Sonnet (실무 개발)      │  Prime (전략 리뷰)       │
│  - 파이프라인 실행       │  - 코드 설계 리뷰        │
│  - 버그 수정 / 최적화    │  - 콘텐츠 전략 제안      │
│  - 개선 사항 구현        │  - 품질 기준 설정        │
└──────────┬───────────────┴──────────┬───────────────┘
           │ 산출물(이미지/MP4/로그)   │ 리뷰 결과
           └────────────┬─────────────┘
                        ▼
              개선 사항 통합 → Sonnet 구현
                        ▼
              2차 사이클 → 품질 비교
```

### Prime에게 기대하는 구체적 기여
1. **코드 리뷰**: §6의 3개 파일에 대한 설계·로직 검토 의견
2. **콘텐츠 전략**: "도파민 터지는 금융 쇼츠"의 5단계 구성 개선 제안
3. **기술 방향**: Gemini 의존성 최소화 vs 재도입 등 아키텍처 판단
4. **품질 기준**: "이 영상이 채널에 올라가도 되는 기준"을 체크리스트로 정의

---

*작성: Sonnet | 날짜: 2026-04-23 14:15 KST*  
*참고: `00_아키텍처_문서/Phase24_유튜브_완전자동화_다중에이전트_기획.md`*  
*참고: `00_아키텍처_문서/Phase24.5_이미지랩_에이전트_파이프라인_PRD.md`*
