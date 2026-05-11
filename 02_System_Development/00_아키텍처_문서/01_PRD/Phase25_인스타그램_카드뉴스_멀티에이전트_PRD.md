# 📐 PRD: Phase 25 — 인스타그램 카드뉴스 자동화 + 멀티에이전트 비전 검수 시스템

> **작성자**: Sonnet | **날짜**: 2026-04-23 | **이전**: Phase 24 YouTube 완성

---

## 1. 전략 배경

> "카드뉴스가 먼저 완성되어야 유튜브 이미지도 완성된다."

- **인스타그램 카드뉴스 → 유튜브 Shorts** 순서로 생산 흐름 역전
- 카드뉴스 품질 기준 = 영상 이미지 품질 기준 (자동 격상)
- 동일 채널명 인스타 + 유튜브 동시 운영 → 크로스 팔로워 유입
- 이미지 1회 생성 → 2채널 게시 (비용 50% 절감)

---

## 2. 새로운 파이프라인

```
DataHarvester → CurationAgent
    ↓
InstagramCardAgent (NEW ⭐)
    카드 1: hook    — AI 이미지 + 충격 헤드라인
    카드 2: problem — 대비 Split HTML 카드
    카드 3: proof   — 데이터 인포그래픽 HTML 카드
    카드 4: climax  — AI 이미지 + 반전 텍스트
    카드 5: cta     — 팔로우 유도 브랜드 카드
    ↓
이미지랩 멀티에이전트 비전 검수 스튜디오
    Prime  🔵 콘텐츠 전략 비전 분석
    Luca   🟢 디자인/레이아웃 비전 분석
    Sonnet 🟣 텍스트/톤앤매너 비전 분석
    대표님 👑 포커스 + 채팅 → 최종 결재
    ↓ 검수 통과
Instagram Graph API → Carousel 자동 게시
    ↓
[동일 이미지 재활용] → TTSAgent → VideoAdapter → YouTube
```

---

## 3. InstagramCardAgent 설계

| 카드 | 씬 | 생성 방식 | 핵심 |
|------|-----|---------|------|
| 1 | hook | `brand-generate` | AI 이미지 + 대형 숫자/감정어 |
| 2 | problem | `html-template` | 좌/우 대비 레이아웃 |
| 3 | proof | `html-template` | 출처 명시 데이터 인포그래픽 |
| 4 | climax | `brand-generate` | 반전 텍스트 + 강조색 배경 |
| 5 | cta | `html-template` | 채널로고 + 팔로우 유도 |
| 6~7 | (옵션) | `html-template` | 보너스 인사이트 / 저장 유도 |

**포맷**: 1080×1080 PNG, 불투명, 소시안 signature 프리셋

---

## 4. 멀티에이전트 비전 검수 시스템

### 4-1. 참여자 역할

| 참여자 | 담당 | 체크 포인트 |
|--------|------|------------|
| **Prime** 🔵 | 콘텐츠 전략 | Hook 임팩트, CTA 설득력, 시리즈 흐름 |
| **Luca** 🟢 | 디자인/레이아웃 | 여백, 컬러 대비(4.5:1↑), 폰트 계층, 해상도 |
| **Sonnet** 🟣 | 텍스트/톤앤매너 | 글자 수(카드당 20자↓), 가독성, 브랜드 보이스 |
| **대표님** 👑 | 최종 결재 | 포커스 + 채팅으로 수정 지시 |

### 4-2. 비전 분석 흐름

카드뉴스 생성 완료 시 3인 에이전트가 자동으로 이미지를 비전 분석하여  
채팅 버블로 분석 결과를 전송합니다. 대표님은 추가 지시 후 최종 승인.

---

## 5. 이미지랩 리뷰 스튜디오 UI (신규 탭)

### 5-1. 레이아웃

```
┌── Image Lab ─────────────────────────────────────────┐
│  [Brand Studio]  [📋 카드뉴스 검수 ●]  [Archive]     │ ← 탭 추가
├──────────────────────────────────────────────────────┤
│                                                      │
│  카드 갤러리 (중앙)                                  │
│  [Card1] [Card2] [Card3] [Card4] [Card5]            │
│   🔥hook  ⚠️prob  📊proof ⚡climax 🔔cta            │
│                                                      │
│  ┌── 확대 미리보기 ─────────────┐  ┌── AI Chat ───┐ │
│  │  (클릭된 카드 1080×1080)     │  │ 🔵 Prime: …  │ │
│  │  🎯 TARGET FOCUSED (포커스)  │  │ 🟢 Luca: …   │ │
│  │                              │  │ 🟣 Sonnet: … │ │
│  └──────────────────────────────┘  │              │ │
│                                    │ [Card3 포커스]│ │
│                                    │ 입력창…      │ │
│                                    │              │ │
│                                    │ [재생성]     │ │
│                                    │ [✅ 전체 승인]│ │
│                                    └──────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 5-2. 포커스 기능 (VideoLab과 동일 메커니즘)

```
카드 클릭 → 레드 보더 + 🎯 TARGET FOCUSED 뱃지
    ↓
입력창 placeholder: "[Card 3 · proof] 에 대한 수정 지시..."
    ↓
전송 시 자동 태그: "[Card 3 · proof 포커스] 대비율 올려줘"
    ↓
Luca → 해당 카드만 재생성 → 갤러리 이미지 교체
```

### 5-3. 신규 State

```js
{
    labMode: 'BRAND_STUDIO' | 'CARD_NEWS_REVIEW' | 'ARCHIVE',
    cardSet: CardImage[],
    focusedCard: number | null,
    visionReviews: Review[],
    chatMessages: Message[],
    reviewStatus: 'PENDING'|'IN_REVIEW'|'APPROVED'|'PUBLISHED',
    publishCaption: string,
    publishHashtags: string[],
}
```

---

## 6. Instagram Graph API 연동

```js
// InstagramPublisher.js (NEW)
const CHANNEL_INSTAGRAM_MAP = {
    'finance-viral': { username: '@pico.finance' },
    'ai-tips':       { username: '@flo.aitips'  }
};

class InstagramPublisher {
    async publishCarousel(cardSet, caption, hashtags) {
        const mediaIds = await Promise.all(cardSet.map(c => this.createMediaContainer(c.imageUrl)));
        const carouselId = await this.createCarouselContainer(mediaIds, caption + '\n\n' + hashtags.map(h=>`#${h}`).join(' '));
        return await this.publishMedia(carouselId);
    }
}
```

---

## 7. YouTube 이미지 재활용

```js
// 카드뉴스 승인 이미지 → YouTube scenes 주입 (재생성 없음)
scenes: scenario.scenes.map((scene, i) => ({
    ...scene,
    assetImage:      approvedCardSet[i]?.filePath,
    assetImageLocal: true
}))
// → TTSAgent → VideoAdapter → YouTube Shorts
```

---

## 8. 구현 우선순위

### Sprint 1 — 카드뉴스 생성 엔진 (Sonnet)
| 순위 | 작업 | 파일 |
|------|------|------|
| P0 | InstagramCardAgent.js | 신규 |
| P0 | CurationAgent 카드뉴스 스키마 | CurationAgent.js |
| P0 | HTML 템플릿 3종 (problem/proof/cta 카드) | imageLabRouter.js |
| P1 | InstagramPublisher.js | 신규 |
| P1 | index.js 파이프라인 삽입 | index.js |

### Sprint 2 — 이미지랩 비전 검수 스튜디오 (Sonnet + Luca)
| 순위 | 작업 | 파일 |
|------|------|------|
| P0 | CARD_NEWS_REVIEW 탭 추가 | ImageLabView.jsx |
| P0 | 카드 포커스 + TARGET 뱃지 + 채팅 태그 | ImageLabView.jsx |
| P0 | AI Crew Vision Review Chat 패널 | ImageLabView.jsx |
| P1 | /api/ari/vision-review 엔드포인트 | 신규 |
| P1 | 카드별 개별 재생성 | ImageLabView.jsx |
| P2 | 검수 승인 → 인스타 게시 연동 | ImageLabView.jsx |

### Sprint 3 — YouTube 재활용 (Sonnet)
| 순위 | 작업 | 파일 |
|------|------|------|
| P0 | 카드뉴스 승인 → assetImage 자동 주입 | index.js |
| P1 | 발행 이력 관리 | 신규 |
| P2 | 인스타 반응 → YouTube 발행 최적화 | 고도화 |

---

## 9. 미결 사항

> [!IMPORTANT]
> **대표님**: Instagram 계정 실제 생성 + Graph API 토큰 발급 필요. 채널별 계정명(@) 확정 요청.

> [!IMPORTANT]
> **Prime**: 비전 검수 3인 분석 프롬프트 초안 설계 요청.

> [!NOTE]
> 검수 통과 기준: 3인 모두 PASS → 자동 게시 OR 1인 FAIL → 대표님 중재  
> 선발행 후 YouTube 대기: 즉시 OR 인스타 반응 24시간 확인 후  
> 해시태그: CurationAgent 통합 OR 별도 HashtagAgent

---

*작성: Sonnet | 2026-04-23 15:17 KST*  
*Phase 24 → Phase 25 → Phase 26 (인스타 반응 기반 YouTube 최적화)*
