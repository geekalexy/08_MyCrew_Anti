---
name: instagram-analysis
displayName: Instagram 프로필 분석
description: |
  Instagram 공개 계정의 프로필을 분석할 때 사용합니다.
  팔로워 수, 팔로잉, 게시물 수, 바이오, 최근 게시물 캡션을 수집합니다.
  경쟁사 SNS 파악, 레퍼런스 계정 벤치마킹, 마케팅 전략 수립 시 발동합니다.
layer: 1
author: MyCrew
version: "1.1.0"
scope: global
tools:
  - instagramAnalyze
  - instagramBatchAnalyze
commands:
  - "인스타 분석해줘"
  - "이 계정 팔로워"
  - "경쟁사 SNS 파악"
  - "인스타그램 벤치마킹"
  - "/ig"
---

# Instagram 분석 스킬 — 아리 행동 규칙

## 도구 선택 기준
- **계정 1개**: `instagramAnalyze` 호출
- **계정 2개 이상**: `instagramBatchAnalyze` 호출 (브라우저 1회만 실행, 더 빠름)
- **최대**: 10개 계정까지 한 번에 처리 가능

## 입력 전처리
- `@` 기호가 있어도 자동 제거됨 (그대로 전달해도 됨)
- Instagram URL 입력 시 → ID만 추출 후 호출
  - 예: `https://www.instagram.com/socian_official/` → `socian_official`

## 결과 활용
- 수집된 팔로워 수, 바이오, 게시물 캡션을 mkt_analyst에게 전달 시
  → 태스크 카드 content에 결과 데이터 전체 포함하여 생성

## 세션 안내 (유저별 격리)
이 스킬은 사용자별로 독립된 로그인 세션을 사용합니다.
세션 파일: `05_Output_v1/ig_session/` (사용자 엔진 인스턴스 내부)

세션 초기화 방법 (최초 1회 또는 만료 시):
```bash
node tests/test_ig_login_scrape.js <계정명>
```

세션 만료 에러 수신 시 아리 안내:
> "Instagram 세션이 만료되었습니다. 터미널에서 `node tests/test_ig_login_scrape.js 계정명`을 실행해 재로그인 후 다시 요청해주세요."

## 비공개 계정 안내
비공개 계정 감지 시:
> "비공개 계정이라 수집이 불가합니다. 공개 계정 ID를 알려주세요."

## 참고 문서
- 기획서: `02_System_Development/00_아키텍처_문서/스킬_기획서/Instagram_스크래핑_스킬_기획서_v1.md`
- 어댑터: `ai-engine/tools/instagramAdapter.js`
