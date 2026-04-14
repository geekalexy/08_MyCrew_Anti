---
name: 이미지 생성 PoC — 현재 단계 정리 (2026-04-09)
description: Content Marketer 이미지 결과물 개선을 위한 Gemini 기반 PoC. 팀 공유용 지식 문서.
type: knowledge
audience: CEO, CMO, Content Marketer, Designer, Image Generator
date: 2026-04-09
---

# 이미지 생성 PoC — 현재 단계 정리

> 작성: 아리 (보드 비서) | 2026-04-09
> 대상: 팀 전원 (특히 CMO, Content Marketer, Designer, Image Generator)

## 🎯 배경 & 목표

**문제**: Content Marketer 평가 결과 텍스트 84편은 양호하나 이미지 결과물은 사용 불가 판정.

**가설**: Claude 모델은 네이티브 이미지 생성 기능이 없음. Gemini 계열로 보완 필요.

**목표**: 텍스트는 Claude 강점 유지, 이미지는 Gemini로 보완하는 **하이브리드 워크플로우** 검증.

---

## 📋 진행 이슈

| 이슈 | 제목 | 상태 |
|---|---|---|
| **SOC-145** | [검토 요청] Content Marketer 모델 전략: Claude × Gemini 하이브리드 | in_progress |
| **SOC-146** | [채용] Image Generator 에이전트 (Gemini CLI 어댑터) | in_progress |
| 관련: SOC-139 | 디자이너 채용 — 한글 마케팅 콘텐츠 이미지 제작 | 진행 중 |

**참고 문서**: `01_전략/20260409_ContentMarketer_Gemini_하이브리드_제안.md`

---

## ⚙️ 완료된 인프라 설정

### 1. Gemini CLI 설치
- **패키지**: `@google/gemini-cli` v0.37.0
- **경로**: `/Users/alex-gracy/.nvm/versions/node/v24.14.1/bin/gemini`
- **설치 명령**: `npm install -g @google/gemini-cli`

### 2. API 키 설정
- **저장 위치**: `~/.zshrc` 의 `GEMINI_API_KEY` 환경변수
- **발급처**: https://aistudio.google.com/apikey
- **키 보유 모델 액세스**: 텍스트 모델 전체 + 이미지/영상 모델은 **유료 플랜 전용** (무료 limit: 0)

### 3. Paperclip 신규 에이전트
- **이름**: Image Generator
- **소속**: CMO 산하
- **어댑터**: Gemini CLI (local)
- **모델**: Gemini 2.5 Pro (텍스트 추론용 — 이미지는 별도 경로)
- **상태**: 생성 완료, 운영 정책 미확정

### 4. 텔레그램 브릿지 봇 신규 명령어
| 명령어 | 역할 |
|---|---|
| `/sendimg <경로>` | 이미지 텔레그램 전송 (압축, 10MB까지) |
| `/sendfile <경로>` | 파일 원본 전송 (50MB까지) |
| `/mute` | 자동 푸시 ON/OFF 토글 (인라인 버튼) |

→ 디자이너/Image Generator 결과물을 외출 중에도 폰으로 즉시 확인 가능

---

## 🚧 핵심 발견 (중요)

### 발견 1: Gemini 무료 티어는 이미지 생성 불가
- API 키 자체는 발급받았으나, `gemini-2.5-flash-image`, `imagen-4.0-*` 등 모든 이미지 생성 모델은 **유료 플랜 전용** (`limit: 0`)
- 즉, **Image Generator 에이전트의 자동 이미지 생성은 결제 등록 전까지 불가**

### 발견 2: 보드의 Gemini Pro 구독 ≠ API 유료 플랜
- Gemini Pro 구독(소비자용 Google One AI Premium)은 gemini.google.com 웹/앱에서만 사용 가능
- API 호출은 별도 결제 시스템(AI Studio Billing)이며 연동되지 않음
- 결정: **추가 결제 없이 진행** → gemini.google.com 수동 워크플로우 채택

### 🚨 발견 3: 브랜드 컬러 시스템 정정
보드 확정: 소시안 브랜드는 **블루 + 보라 듀얼 시스템**.

| 항목 | 실제 값 |
|---|---|
| **메인 컬러** | `#076CF0` (블루) |
| **서브 컬러** | `#8B5CF6` (보라) |
| **액센트** | `#FEB63A` (옐로우 — 쿠폰/CTA용) |
| **배경** | `#FFFFFF` (화이트) |
| **라이트 배경** | `#F2F7FE` (소프트 라이트 블루) |
| **텍스트** | `#1E2531` (네이비-그레이) |
| **메인 폰트** | Wanted Sans |
| **강조 폰트** | The Jamsil |
| **특수 폰트** | Darumadrop One |

→ 그동안 보라만 사용한 건 부분적 정답(서브 컬러). 메인 블루를 함께 써야 정식.

**출처**: https://socian.alocados.io/ 실제 브랜드 페이지 분석

### 발견 4: 메시지 포지셔닝도 재설정 필요
- 기존 가정: "팔로워를 고객으로 전환" (일반 인플루언서 타겟)
- **실제 소시안 핵심**:
  - 슬로건: **"인스타그램을 모두 닫고 Socian만 켜세요"**
  - 타겟: **공동구매(공구) 셀러, 인플루언서, N잡 직장인**
  - 차별점: **Smart Queue 알고리즘**, 시간당 700~750개 안전 발송, 스팸 차단 우회
  - 핵심 기능: 댓글 기반 자동 DM, 일괄 발송, AI 자동 설정

→ Content Marketer가 작성하는 모든 카피는 이 포지셔닝 기준으로 재정비 필요

### 발견 5: 브랜드 에셋 위치 확인
- **로고 폴더**: `/Users/alex-gracy/Documents/12_소시안_mycrew/10_소시안-보드-수작업/소시안아이콘`
- 메인 워드마크: `socian logo.png` (16KB) — 'oo'에 무한대 기호
- 심볼 아이콘: `socian_icon.png` / `socian_icon_bcak-white.png`

---

## 🔄 현재 PoC 워크플로우 (수정안)

```
[1] 카피 기획 (Content Marketer / CMO)
    ↓ 슬로건·타겟·핵심 메시지 확정
[2] 디자인 브리프 작성 (아리 또는 Designer)
    ↓ 브랜드 시스템 (#076CF0, Wanted Sans, 워드마크) 적용
[3] gemini.google.com 사고 모델로 이미지 생성 (보드 수동)
    ↓ 같은 채팅 안에서 7장 시리즈 일관성 유지
[4] 결과물 다운로드 → 04_이미지_소스/ 폴더 저장
    ↓
[5] 텔레그램으로 보드 검수 (/sendimg)
    ↓
[6] 승인/리테이크 결정
    ↓
[7] 발행 (03_발행_완료/)
```

### ⚠️ 자동화 한계
- 현재는 **3단계가 보드 수동 작업**. Image Generator 에이전트가 직접 이미지 생성 못함 (무료 티어 막힘)
- 자동화하려면: AI Studio Billing 결제 등록 → API로 Imagen/Veo 호출 가능

---

## 🎯 다음 액션 (팀별)

### CMO
- 소시안 실제 브랜드 시스템(#076CF0, "공구 셀러" 타겟) 기준으로 카피 톤앤매너 재확인
- Content Marketer 출력물 검수 시 브랜드 메시지 일치도 확인

### Content Marketer
- 카피 작성 시 핵심 키워드 사용:
  - "Smart Queue", "공동구매 필수 솔루션", "클릭 한 번에", "스팸 오인 없이 안전 전송"
- 타겟 명확히: **공구 셀러 / N잡 직장인** (일반 인플루언서가 아님)

### Designer (SOC-139)
- 캐러셀 시리즈 작업 시 브랜드 컬러 #076CF0 / #FEB63A 사용
- 폰트는 Wanted Sans 기준
- 워드마크 로고 활용 (`10_소시안-보드-수작업/소시안아이콘/socian logo.png`)

### Image Generator (신규)
- 현재 무료 티어 한계로 자동화 불가
- 결제 등록 전까지는 "프롬프트 기획·문서화" 역할 수행 가능
- 또는 보드의 gemini.google.com 워크플로우 보조

### 보드 (이사회)
- 02~07 캐러셀 수동 생성 진행 중 (gemini.google.com 사고 모델)
- 결과 검수 후 텔레그램으로 공유

---

## 📌 학습 정리 (다음에 같은 작업할 때 주의할 점)

1. **브랜드 에셋 먼저 확인하라** — 컬러·폰트·로고 검증 없이 작업 시작 금지
2. **API와 소비자 구독은 별개** — 자동화 가능 여부 사전 확인 필수
3. **무료 티어 한계 미리 테스트** — 모델 목록에 보여도 실제 호출 가능 여부 다름
4. **PoC는 작게, 빠르게** — 1장 먼저 검증 후 대량 생성
5. **수동 워크플로우도 가치 있음** — 완전 자동화 안 되어도 보드 1회 클릭으로 줄이면 큰 개선

---

> 본 문서는 진행 중 라이브 문서. 새 발견 시 업데이트.
> 마지막 업데이트: 2026-04-09 14:35
