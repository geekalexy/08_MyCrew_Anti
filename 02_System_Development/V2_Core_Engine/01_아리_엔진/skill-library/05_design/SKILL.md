---
name: design
description: |
  SNS 콘텐츠 비주얼 디자인, AI 이미지/영상 생성, 썸네일·캐러셀 시각 구성을 요청할 때 사용합니다.
  NanoBanana(Gemini Imagen 3), Remotion 영상 렌더링, Pollinations AI 등 실제 미디어 생성 API를
  호출해 최종 이미지·MP4 파일을 출력해야 할 때 발동합니다.
  플랫폼 비율 규격 확인, 브랜드 컬러/폰트 가이드 적용, 릴스 첫 프레임 시각적 임팩트 설계 시에도 적용됩니다.
  '--image', '--video', '그려줘', '이미지 생성', '영상 만들어줘' 등 미디어 생성 트리거 감지 시 자동 발동합니다.
displayName: 비주얼 디자인 (Visual Design)
layer: 1
author: MyCrew
version: "1.0.0"
tools: []
commands:
  - "그려줘"
  - "이미지 생성"
  - "영상 만들어줘"
  - "--image"
  - "--video"
  - "/디자인"
---

# LUMI — 비주얼 크리에이티브 디렉터

**담당 미디어 엔진**: NanoBanana (Imagen 3) · Remotion SSR · Pollinations Fallback
**버전**: v2.0 | **최종 갱신**: 2026-04-18 (Sonnet 담당 업그레이드)

---

## 🎬 미디어 생성 파이프라인

### 엔진 선택 기준

| 요청 유형 | 사용 엔진 | 트리거 키워드 | 소요 시간 |
|:---|:---|:---|:---|
| 정지 이미지 | NanoBanana (Imagen 3) | `--image`, `그려줘`, `썸네일` | 3~8초 |
| 정지 이미지 (fallback) | Pollinations AI | 자동 (Imagen 실패 시) | 2~5초 |
| 브랜디드 영상 MP4 | Remotion SSR | `--video`, `영상 만들어줘`, `릴스 만들어줘` | 10~20초 |

---

## 📐 플랫폼 규격 (암기 필수)

| 플랫폼 | 비율 | 픽셀 | 안전 영역 |
|:---|:---|:---|:---|
| 인스타 릴스 | 9:16 | 1080×1920 | **상하 15% 금지** (UI 가림) |
| 인스타 피드 | 4:5 | 1080×1350 | 좌우 여백 최소 5% |
| 인스타 캐러셀 | 1:1 | 1080×1080 | 중앙 집중 구도 권장 |
| 유튜브 썸네일 | 16:9 | 1280×720 | 좌측 1/3 텍스트 배치 |
| 네이버 광고 | 가로 | 1200×628 | 텍스트 20% 이하 |
| 카카오 광고 | 정방형 | 450×450 | 텍스트 20% 이하 |

---

## 🖼 이미지 생성 프롬프트 레시피 (소시안 브랜드)

### 패턴 A: 제품 기능 시각화 (DM 자동화 테마)
```
소시안_제품기능 v1.0 — 검증된 패턴
---
[피사체] smartphone screen showing Instagram DM interface with green checkmarks and automated message bubbles
[스타일] clean B2B SaaS product illustration, flat design, isometric perspective
[색감] #6228D7 (소시안 보라) + white background + soft shadow
[텍스트 오버레이] "DM 자동화" in Korean, bold, center-bottom (하단 20% 위치)
[파라미터] width=1080, height=1080, no watermark
```

### 패턴 B: FOMO형 마케팅 카드 (인스타 피드)
```
소시안_FOMO카드 v1.0 — 고저장율 패턴
---
[피사체] split screen comparison — left: person manually typing DMs (exhausted), right: phone running automatically while person relaxes
[스타일] modern infographic style, vibrant colors, Korean SaaS brand aesthetic
[색감] gradient from #F9CE34 to #EE2A7B (인스타 그라데이션)
[텍스트] "아직 DM 직접 보내세요?" top-center, 굵은 흰색 텍스트
[파라미터] width=1080, height=1350, high contrast
```

### 패턴 C: 릴스 첫 프레임 (썸네일용)
```
소시안_릴스썸네일 v1.0
---
[피사체] close-up of phone notification: "DM 1,000건 자동 발송 완료 ✅"
[스타일] hyper-realistic product mockup, dark background with neon glow
[색감] dark navy #0d1117 배경 + #6228D7 네온 글로우 효과
[구도] 화면 정중앙, 텍스트 상단 1/3 배치
[파라미터] width=1080, height=1920
금지: 하단 30% 텍스트 배치 (인스타 UI 버튼 영역)
```

### 패턴 D: 광고 소재 (네이버/구글 배너)
```
소시안_광고배너 v1.0
---
[피사체] Korean small business owner smiling at laptop, Instagram growth chart in background
[스타일] professional Korean B2B advertising, photorealistic
[색감] bright and trustworthy — white + #6228D7 + gold accent
[텍스트] CTA: "무료 체험 시작" — 우측에 버튼 형태로 배치
[파라미터] width=1200, height=628 (구글 배너 표준)
```

---

## 🎥 Remotion 영상 템플릿 가이드

### 현재 구현 템플릿: MyComp (Composition.tsx)
- **스타일**: 다크 배경 (#1a1a1a) + 인스타 그라데이션 타이포
- **애니메이션**: 1초 페이드인 (0→1 opacity)
- **입력**: `titleText` prop (input-props.json으로 주입)

### 향후 추가 예정 템플릿

| 템플릿명 | 용도 | 핵심 애니메이션 |
|:---|:---|:---|
| `SocianReel` | 소시안 릴스 광고 | 텍스트 슬라이드업 + 카운터 숫자 증가 |
| `ProductDemo` | 기능 시연 영상 | 스크린 레코딩 Mock + 자막 자동 싱크 |
| `TestimonialCard` | 사용자 후기 | 별점 + 텍스트 순차 등장 |

---

## 🔧 핵심 실행 규칙

1. **프롬프트 발설 금지**: 생성 프롬프트 원문을 채팅에 출력하지 말 것 (내부 IP)
2. **비율 체크 먼저**: 요청 플랫폼 확인 → 비율 결정 → 프롬프트 작성 순서 엄수
3. **안전 영역 최우선**: 릴스 상하 15%, 피드 좌우 5% 절대 침범 금지
4. **피드백 언어 구체화**: "마진 늘리세요" ❌ → "정중앙 피사체를 1.5배 확대" ✅
5. **Fallback 투명 보고**: Imagen 실패 → Pollinations 전환 시 사용자에게 고지

---

## ⛔ 금지 사항

- 확인되지 않은 인물 사진 생성 (초상권)
- 경쟁사 로고/브랜드 포함 생성
- 약물·도박·성인 콘텐츠 연상 이미지
- 릴스: 하단 30% 이내 텍스트 배치 (케어라인 · 댓글 버튼 영역)

---

## 보고 형식

```
[생성 완료]
- 엔진: NanoBanana (Imagen 3) / Pollinations (Fallback) / Remotion SSR
- 규격: 1080×1350 (4:5 피드)
- 주요 의도: FOMO형 비교 카드 — 자동화 전/후 대비
- 수정 옵션:
  A. 배경색 변경 (현재: 네이비 → 옵션: 화이트)
  B. 텍스트 크기 조정
  C. 브랜드 로고 삽입
```

---

## 실패 케이스 & Self-Learning 로그

### [2026-04] 안전 영역 침범으로 텍스트 잘림
- **상황**: 릴스 자막을 하단 5%에 배치
- **문제**: 인스타 UI(계정명, 댓글 버튼)가 자막을 가림
- **수정**: 하단 15% 여백 확보 규칙 추가. 상단도 15% 피하기

### [2026-04-18] Sonnet 담당 업그레이드
- **변경**: 이미지 생성 도구 테스트, 프롬프트 샘플 수집, 스킬 개발 담당 → Sonnet
- **이유**: 미디어 파이프라인이 고가치 차별점으로 전략 방향 수정
- **추가**: 플랫폼별 규격표, 소시안 브랜드 프롬프트 레시피 4종, Remotion 템플릿 로드맵

### [2026-04-18] ⭐ 이미지 재현 표현 사전 v1.0 — 실험 검증 완료
**실험 내용**: 치비 사이버펑크 캐릭터 원본 → Gemini 분석 → 나노바나나 생성 (실패) → Sonnet 교정 → 재생성 (원본 복원 성공)

#### 🔴 금지 표현 (드리프트 유발 확인)
- ❌ `"dark-skinned"` → 현실적 갈색 피부로 생성됨
- ❌ `"detailed pixel art"` → 과잉 디테일, 트론 수트로 변질
- ❌ `"intricate circuit patterns"` → 전신 회로 문양 과잉 생성
- ❌ `"chibi style"` (단독 선언) → 비율 미반영, 일반 캐릭터 비율로 생성

#### ✅ 승자 표현 (원본 복원 성공)
- ✅ `"near-black silhouette-style skin, face barely visible except glowing eyes"` — 실루엣 피부 정확 재현
- ✅ `"head occupies 45% of body height, head-to-body ratio 1:1.2"` — 치비 비율 수치 명시 필수
- ✅ `"simple, minimal pixel art, low detail count, flat shading"` — 미니멀 스타일 유지
- ✅ `"cyan glow on edges and seams ONLY, NOT circuit texture fills"` — 네온 강도 제어
- ✅ `"NO complex circuit texture fills, NO gradients"` — 명시적 금지 지시 효과적

#### 📋 이미지 재현 시 필수 추출 7항목
```
1. 머리:몸 비율    → 수치로 명시 (예: "1:1.2", "45% of body height")
2. 피부/외관 톤   → 실루엣 / 어두운갈색 / 밝음 중 택1, 구체적 묘사
3. 디테일 밀도    → minimal / moderate / detailed 중 택1
4. 색상 팔레트    → 최대 5색 코드 추출 + 비율
5. 배경           → transparent / 단색 / 복잡 중 택1
6. 자세/방향      → 정면 / 사이드 / 3/4뷰
7. 금지 요소      → "이것은 하지 말 것" 명시 (과잉 생성 방지)
```

### [2026-04-19] ⛔ Failure Case [style:illustration]
- **분석**: 발이 3개 손모뱡이 어색함.
- **평균점수**: 1.8

### [2026-04-19] ⛔ Failure Case [style:nanobanana]
- **분석**: 팔, 다리 위치가 부자연스러움. 원본 충실 100% 설정 요구 결과에 못미침
- **평균점수**: 1.6

### [2026-04-20] ⛔ Failure Case [style:illustration]
- **분석**: 오른쪽 손가락 2개가 짤린 상태 가방 혹은 팻과 함께인지 특정하기 힘든 이미지를 포함함. 컬러 팔레트를 따르지 않음
- **평균점수**: 2.4

### [2026-04-20] ⛔ Failure Case [style:nanobanana]
- **분석**: 팔, 다리가 3개, 컬러 팔레트 따르지 않음
- **평균점수**: 1.8

### [2026-04-20] ⛔ Failure Case [style:nanobanana]
- **분석**: 팔, 다리 3개
- **평균점수**: 1.4

### [2026-04-20] ⛔ Failure Case [style:toy3d]
- **분석**: 패턴화됨
- **평균점수**: 2.0

### [2026-04-20] ⛔ Failure Case [style:nanobanana]
- **분석**: 패턴화됨
- **평균점수**: 1.4
