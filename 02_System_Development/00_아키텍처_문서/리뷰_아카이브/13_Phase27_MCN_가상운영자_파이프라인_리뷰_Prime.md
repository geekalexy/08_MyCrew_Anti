# 🛡️ Supreme Advisor (Prime) — Phase 27 MCN형 가상 운영자 파이프라인 리뷰 (13th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**대상:** Phase 27 — MCN형 가상 운영자 파이프라인 고도화 설계서
**일시:** 2026-04-24
**등급:** ⚠️ B- (비전은 훌륭하나, 실행 리스크 높음 — 분할 필수)

---

## 📊 총평: 비전은 S급, 설계서는 C급

대표님, 솔직하게 말씀드립니다.

이 기획의 **방향성**은 대단합니다. MCN형 다채널 가상 운영자, 동적 리듬 패턴, 실사 B-Roll 자동 수집, 단어 단위 오디오 싱크 — 이것들이 모두 구현되면 시장에서 독보적인 포지션을 잡습니다.

하지만 현재 이 설계서는 **"4개의 Phase를 하나에 우겨넣은 위시리스트"**입니다. Phase 24.5의 CurationAgent에서 아직 구버전 SDK가 살아있고, Fallback이 3개 씬만 있는 상황에서, 이 전체를 한 번에 구현하면 **4월 15일의 전면 마비가 반복**될 수 있습니다.

---

## 🔴 Critical Issue #1: `assetImage` → `assetImages` 전환은 파이프라인 전체 파괴

### 현재 데이터 계약

```
ImageLabAgent → scene.assetImage (string, 단일 경로)
    ↓
TTSAgent → scene.audioFile (추가)
    ↓
VideoAdapter → Remotion → <Img src={scene.assetImage} />
```

### Phase 27이 요구하는 변경

```
AssetFetcher → scene.assetImages (string[], 복수 경로)  ← 호환 파괴!
    ↓
VideoAdapter → Remotion → rhythmPattern에 따라 동적 <Sequence> 분할
```

**이건 단순한 필드 추가가 아닙니다.** `assetImage`(단수) → `assetImages`(복수)로 바뀌는 순간:

| 영향 범위 | 수정 필요 |
|:---|:---|
| `ImageLabAgent.js` L74 | `assetImage` → `assetImages` 배열 반환 |
| `VideoAdapter.js` | 단일 이미지 경로 → 배열 처리 |
| `Composition.tsx` L131, L154-155 | `scene.assetImage` → `scene.assetImages[0]` 최소 변경 |
| `CurationAgent.js` Fallback | JSON 스키마 전면 변경 |
| `VideoLabView.jsx` | 미리보기 UI 변경 |
| `index.js` orchestrator | 데이터 검증 로직 추가 |
| 기존 JSON 시나리오 파일들 | 전부 마이그레이션 |

> [!CAUTION]
> **하위 호환성 없이 필드명을 바꾸면, 기존에 작동하던 모든 시나리오가 즉사합니다.**

### Prime 권고: 하위 호환 유지 전략

```javascript
// Composition.tsx에서 양쪽 다 지원
const images = scene.assetImages || (scene.assetImage ? [scene.assetImage] : []);
```

이렇게 하면 기존 `assetImage` 단일 필드 시나리오도 계속 작동하면서, 새로운 `assetImages` 배열도 지원됩니다.

---

## 🔴 Critical Issue #2: 범위 과잉 — 4개 Phase를 1개로 압축

이 설계서에는 **독립적으로 구현·검증해야 할 4가지 기능**이 뒤섞여 있습니다:

| 기능 | 복잡도 | 의존성 |
|:---|:---|:---|
| A. AssetFetcher (Pexels/Google API) | 🟡 중간 | 외부 API 키, 캐싱 |
| B. 3가지 리듬 패턴 (Remotion 템플릿) | 🔴 높음 | Composition.tsx 전면 재설계 |
| C. 채널별 브랜드 분리 (페르소나) | 🟡 중간 | CurationAgent 프롬프트, theme 확장 |
| D. wordTimings 오디오 싱크 | 🔴 높음 | TTS API 응답 구조 변경, Remotion 프레임 로직 |

**이것들을 동시에 구현하면:**
- AssetFetcher가 실패할 때 → 리듬 패턴 B(Ken Burns)가 이미지 없이 작동해야 하는데, 이 케이스의 Fallback이 정의 안 됨
- 리듬 패턴이 잘못되면 → wordTimings 싱크까지 깨짐
- 하나의 버그가 **전체 파이프라인을 다운**시킴

### Prime 권고: 4단계 분할 출시

```
Phase 27a: AssetFetcher + 로컬 캐싱 (1주)
  → 기존 파이프라인에 "실사 이미지 수집" 기능만 추가
  → assetImages 배열 + 하위호환 유지
  → 검증: 5개 시나리오 테스트

Phase 27b: 리듬 패턴 A/B/C (1주)
  → Composition.tsx에 3가지 <Sequence> 동적 분할 추가
  → CurationAgent가 씬별 rhythmPattern 지정
  → 검증: 각 패턴별 1개씩 총 3개 영상 렌더링

Phase 27c: 채널 페르소나 분리 (3일)
  → theme 객체에 channelBrand 추가
  → CSS 오버레이, 폰트, 컬러 동적 매핑
  → 검증: 금융/잡학/AI 3채널 각 1개 영상

Phase 27d: wordTimings 정밀 싱크 (1주)
  → TTS 응답에서 타이밍 메타데이터 추출
  → Remotion에 키워드 프레임 타겟팅
  → 검증: 오디오-영상 싱크 오차 0.2초 이내
```

---

## 🟡 Important Issue #3: AssetFetcher의 누락된 설계

설계서에서 AssetFetcher를 "신설 모듈"로 언급하지만, 핵심적인 구현 세부사항이 빠져 있습니다:

### 누락된 항목

| 항목 | 현재 상태 | 필요한 정의 |
|:---|:---|:---|
| **키워드 추출 로직** | "명사 키워드 추출"이라고만 언급 | 형태소 분석기 사용? LLM 호출? 정규식? |
| **이미지 선별 기준** | 미정의 | 해상도 최소값? 가로/세로 비율? NSFW 필터? |
| **배열 길이** | `[url1, url2, url3]`이라고만 예시 | 항상 3개? 씬 타입에 따라 가변? 패턴 A는 3~4장, 패턴 B는 1장 |
| **Pexels vs Google 우선순위** | 미정의 | 어느 것을 먼저 조회? 둘 다 실패하면? |
| **라이선스 검증** | Pexels는 무료라고만 언급 | Google 이미지 검색 결과의 저작권은? |

### Prime 권고: AssetFetcher 데이터 계약 먼저 확정

```javascript
// AssetFetcher 반환값 스키마 (확정 필요)
{
  images: [
    {
      url: string,           // 로컬 캐시 경로 or 원본 URL
      source: 'pexels' | 'google' | 'local-fallback',
      width: number,
      height: number,
      license: 'free' | 'unknown',
    }
  ],
  keyword: string,           // 검색에 사용된 키워드
  cached: boolean,           // 캐시 히트 여부
}
```

---

## 🟡 Important Issue #4: 리듬 패턴과 Composition.tsx의 현실

현재 `Composition.tsx`는 이미 **4가지 layoutType**을 갖고 있습니다:

| 기존 layoutType | 용도 |
|:---|:---|
| `notification` | iOS 알림 팝업 (Hook) |
| `chat-bubble` | DM 대화형 (Solution) |
| `split-impact` | 금융/지식 채널 (메가 바이럴) |
| default (Centered) | 타이포그래피 모션 |

Phase 27의 리듬 패턴 3가지를 추가하면 **layoutType이 7가지**로 폭발합니다. 이것은 단일 `SceneContent` 컴포넌트가 감당할 수 있는 범위를 넘습니다.

### Prime 권고: 컴포넌트 분리

```
src/
├── Composition.tsx              (오케스트레이터만 유지)
├── layouts/
│   ├── NotificationLayout.tsx
│   ├── ChatBubbleLayout.tsx
│   ├── SplitImpactLayout.tsx
│   ├── CenteredLayout.tsx
│   ├── FastImpactLayout.tsx     (Phase 27 — 패턴 A)
│   ├── KenBurnsLayout.tsx       (Phase 27 — 패턴 B)
│   └── SplitArrayLayout.tsx     (Phase 27 — 패턴 C)
```

이 리팩토링을 **리듬 패턴 추가 전에** 먼저 하지 않으면, 500줄+ 단일 파일이 되어 유지보수가 불가능해집니다.

---

## 🟡 Important Issue #5: wordTimings는 별도 Phase로 분리해야

설계서의 §4.1에서 언급된 `wordTimings` 정밀 싱크는:

1. Google Cloud TTS API의 `timepoints` 응답을 파싱해야 하고
2. TTSAgent의 반환 스키마가 바뀌고
3. Remotion에서 프레임 단위로 텍스트 하이라이트를 구현해야 하며
4. 현재 `durationFrames` 추정식을 완전히 대체해야 합니다

**이것만으로도 1주일 분량의 독립 Phase입니다.** AssetFetcher나 리듬 패턴과 동시에 진행하면 디버깅이 불가능해집니다.

---

## 🟢 잘된 것

1. **캐싱 전략 (§4.2)**: 24시간 해시 캐싱은 올바른 방어. API 비용 제어의 핵심
2. **Fallback 범퍼 영상 10종 (§4.3)**: "네트워크 단절 시 그라데이션 모션 범퍼"는 무중단 발행의 마지막 방어선으로 훌륭
3. **채널별 페르소나 분리 (§1)**: B급 바이럴 vs 진중한 금융 vs 트렌디 AI — 차별화 전략이 명확
4. **리듬 패턴 컨셉 (§2)**: Fast Impact / Ken Burns / Split Array 3가지 교차 적용은 채널 퀄리티를 전문가 수준으로 올릴 수 있는 핵심 차별화

---

## 🔧 Google Image 저작권 경고

> [!WARNING]
> **Google Search API로 수집한 이미지는 저작권 문제가 있습니다.**
> Pexels는 무료 라이선스가 보장되지만, Google 이미지 검색 결과물은 저작권자가 별도로 존재합니다.
> MCN 채널에서 이를 사용하면 **저작권 신고 → 채널 정지** 위험이 있습니다.
>
> **대안:**
> - Pexels 단독 사용 (비디오 + 이미지 모두 제공)
> - Unsplash API 추가 (무료 고화질)
> - Pixabay API 추가 (무료 상업용)
> - Google Search는 "뉴스 기사 링크" 수집에만 사용하고, 이미지는 무료 스톡 API에서만 수집

---

## 📊 최종 수정 우선순위

```
┌──────────────────────────────────────────────────────────────┐
│  Phase 27 실행 로드맵 — Prime 권고                            │
│                                                              │
│  [선행 조건] CurationAgent P0 수정 완료 (12th Review 지적)     │
│      ↓                                                       │
│  [27a] AssetFetcher + 캐싱 ─────────────────── 1주           │
│      ↓                                                       │
│  [27b] Composition.tsx 컴포넌트 분리 ──────── 2일            │
│      ↓                                                       │
│  [27b] 리듬 패턴 A/B/C ─────────────────────── 1주           │
│      ↓                                                       │
│  [27c] 채널 페르소나 통합 ──────────────────── 3일           │
│      ↓                                                       │
│  [27d] wordTimings 정밀 싱크 ───────────────── 1주           │
│      ↓                                                       │
│  [검증] 3채널 × 3패턴 × 3보이스 = 27개 조합 E2E 테스트       │
│                                                              │
│  총 실행 예산: 약 4주                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 💬 솔직한 조언

대표님, 이 기획서는 **"우리가 어디로 가야 하는가"에 대한 답**은 완벽합니다. MCN형 다채널 자동화는 시장에서 아직 아무도 제대로 못 한 영역이고, 이 방향이 맞습니다.

하지만 **"이번 주에 무엇을 먼저 만들 것인가"에 대한 답**이 빠져 있습니다. 4가지를 동시에 착수하면, 4월 15일처럼 전부 깨집니다.

**제가 권고하는 이번 주의 단 하나:**

> **AssetFetcher만 만들어서, 기존 파이프라인에 실사 이미지를 끼워넣고, 영상 1개를 뽑아보세요.**
> 그게 성공하면 리듬 패턴으로 넘어가고, 그게 성공하면 페르소나로 넘어갑니다.

한 번에 하나씩. 매번 검증. 이것이 4월 15일의 교훈입니다.

---

**— Prime (Supreme Advisor)**
