# 🚀 MyCrew Onboarding Wizard UI/UX Design Specification
**대상:** Claude 3.5 Sonnet (UI/UX 구현 프론트엔드 엔지니어 역할)  
**작성일:** 2026-04-15  
**목적:** B2B SaaS 환경에 적합한 프리미엄 '온보딩 위저드' React 컴포넌트(`OnboardingWizard.jsx`) 디자인 및 구현

---

## 1. 프로젝트 개요 및 비주얼 컨셉 (Visual Concept)
MyCrew는 고급 AI 에이전트들을 즉시 업무에 투입할 수 있게 해주는 B2B SaaS 플랫폼입니다. 신규 가입자가 가장 처음 마주하게 되는 온보딩 화면이므로, **신뢰감과 프리미엄 느낌**을 동시에 주어야 합니다.

*   **테마 (Theme):** 다크 모드 (Dark Mode) 기반
*   **스타일 (Style):** 글래스모피즘 (Glassmorphism) 
    - 반투명 패널, 부드러운 블러 효과(`backdrop-filter: blur()`), 은은한 테두리(`border: 1px solid rgba(255,255,255,0.06)`)
*   **컬러 (Color Palette):**
    - 백그라운드: 깊고 어두운 무채색 계열 (`--bg-base`, `--bg-surface`)
    - 포인트 컬러: 브랜드 고유의 액센트 컬러 (`--brand`, 네온 느낌이 살짝 도는 블루/퍼플 계열 추천)
*   **애니메이션 (Animation):**
    - 단계 전환 시 부드러운 `Fade & Slide-up` 트랜지션
    - 로딩 상태를 보여주는 세련된 Spinner 및 성공 시 통통 튀는 피드백(Check icon)

---

## 2. 화면 구조 및 레이아웃 (Layout)
전체 화면을 덮는 오버레이(Overlay) 중앙에 모달 카드가 위치하는 형태입니다.

*   **상단 영역 (Header):**
    - `Progress Bar`: 전체 3단계 중 현재 위치를 나타내는 진행 안내바 (자동 애니메이션 포함)
    - `Back Button`: Step 2, 3에서 Step 1으로 돌아갈 수 있는 뒤로가기 아이콘 (`material-symbols-outlined`)
    - `Step Indicator`: "STEP 1 OF 3" 형태의 텍스트
    - `Title & Subtitle`: 각 단계별 명확한 지시문
*   **중앙 영역 (Body):** 단계별 폼 및 인터랙션 요소 (아래 [3. 상세 흐름] 참고)
*   **하단 영역 (Footer):** 
    - `Next / Submit Button`: "다음 단계로" 또는 "MyCrew 시작하기" (데이터 연동/API 호출 중에는 Disabled 및 '설정 중...' 스피너 표시)

---

## 3. 단계별 상세 흐름 정의 (Step-by-Step Flow)

### 📍 STEP 1. 워크스페이스(팀) 정보 입력 (Workspace Info)
*   **타이틀:** "팀의 이름을 정해주세요"
*   **서브타이틀:** "입력하신 팀명은 추후 고유한 접속 URL로 사용됩니다."
*   **UI 요소:**
    - 대형 텍스트 Input 창 (autofocus 적용)
    - **입력 힌트:** "나중에 `https://mycrew.ai/{입력중인_이름}` 으로 발급될 수 있어요." (입력 시 실시간 업데이트 효과)
*   **인터랙션:** Input 값이 비어있을 경우 "다음 단계" 버튼은 비활성화(Disabled) 상태 유지.

### 📍 STEP 2. AI 엔진 설정 (Engine Configuration) ★ 핵심 구간
*현업 B2B 벤치마킹(Paperclip AI) 포인트: 이중 지출 방지 및 실시간 연동 테스트 기능 지원*
*   **타이틀:** "AI 엔진 연결 설정"
*   **UI 요소 1 (초기 진입 시):** 두 가지 방식 중 하나를 고르는 **대형 선택 카드 2개** 노출
    1.  `[구독 연동]`: "모델 개별 구독 중 (Pro/Max)" (Gemini Advanced 등 기존 구독자용) → **추천 뱃지** 부착
    2.  `[개인 키 연결]`: "개별 API 키 연결 (Pay-as-you-go)" (개발자/파워유저용)
*   **UI 요소 2 (카드 선택 시 하단 확장 - Slide Down):**
    - 구독 연동 선택 → `구독 중인 계정 이메일 입력` Input 노출
    - 개인 키 연결 선택 → `Gemini API Key 입력 (sk-...)` Password Input 노출
*   **인터랙션 (Test 기능):**
    - Input 창 바로 옆에 **[Test] 버튼** 존재.
    - 버튼 클릭 시 상태 변화: `Idle` → `Testing (Spinner)` → `Success (녹색 체크) or Error (적색 텍스트)`
    - **반드시 Test 로직에서 성공 피드백을 받아야만 "다음 단계" 버튼이 활성화됨.**

### 📍 STEP 3. AI 팀 목표 배치 (Team Type Selection)
*   **타이틀:** "당신의 AI 팀 목표는 무엇인가요?"
*   **서브타이틀:** "목표에 맞춰 가장 유능한 에이전트들이 자동으로 배치됩니다."
*   **UI 요소:** 3개의 라디오-스타일 카드 컴포넌트
    1.  마케팅/분석 전문팀 (아이콘: campaign)
    2.  IT/프로덕트 개발팀 (아이콘: terminal)
    3.  범용 개인 비서팀 (아이콘: smart_toy)
*   **인터랙션:** 선택 시 카드의 보더/배경이 브랜드 컬러로 빛나는 액티브(Active) 효과.

---

## 4. 백엔드(API) 연동 명세표 (참고용)
Sonnet이 UI 로직을 작성할 때 `fetch` 코드를 구성하기 위한 참고 데이터입니다.
*상태 관리는 `zustand`의 `useUiStore`를 활용하여 `completeOnboarding()` 등을 호출.*

| 단계 | 발생 액션 | API Method/URL | Request Body (예시) | 비고 |
|:---|:---|:---|:---|:---|
| **Step 2** | Test 버튼 클릭 | POST `/api/onboarding/test-connection` | `{ type: 'key', value: 'sk-...' }` | 성공(res.ok) 시 UI 피드백 |
| **Step 3** | 최종 제출 버튼 클릭 | PUT `/api/settings` | `{ key: 'workspace_name', value: '팀명' }` | 워크스페이스 명 저장 |
| **Step 3** | 최종 제출 버튼 클릭 | POST `/api/secrets` | `{ key: 'GEMINI_API_KEY', value: '...' }` | (키 입력 모드일 경우) |
| **Step 3** | 최종 제출 버튼 클릭 | POST `/api/onboarding/activate-team` | `{ teamType: 'marketing' }` | 팀 활성화 |
| **Step 3** | 최종 제출 버튼 클릭 | POST `/api/onboarding/finish` | `{ userName: '대표님', teamName: '팀명' }` | 튜토리얼 퀘스트 자동 생성 |

---

## 5. 지시사항 요약
Sonnet, 이 문서를 바탕으로 하나의 파일(`OnboardingWizard.jsx`) 안에 모든 상위 레벨 로직과 깔끔한 인라인 스타일(`styled-jsx` 또는 `dangerouslySetInnerHTML` 내 CSS)을 포함하여 구현해 줘. 특히 Step 2의 **"선택 → 입력 → 실시간 Test 피드백"**으로 이어지는 부드러운 모션과 마이크로 인터랙션을 극대화해서, 고객이 서비스 가입 과정에서 막힘을 느끼지 않고 오히려 기대감을 가질 수 있도록 디자인을 완성해 주길 바란다.
