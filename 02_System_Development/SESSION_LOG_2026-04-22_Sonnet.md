# 브랜드 스튜디오 Image Lab — 세션 로그

> 날짜: 2026-04-22 (KST)  
> 담당: Luca (Antigravity)  
> 파일: `src/components/Views/ImageLabView.jsx`

---

## ✅ 오늘 완료한 작업

### 1. 3열 결과 패널 탭 분리
- AI 이미지 / HTML 디자인 탭 구조 도입
- 생성 완료 시 해당 탭으로 **자동 전환** (`useEffect` 연동)
- HTML 생성 버튼 클릭 시 **즉시** HTML 탭으로 이동 (로딩 중에도 탭 전환됨)

### 2. HTML Edit 모드 구현
- 탭 헤더 우측에 `Edit / 저장` 버튼 추가
- **Edit 진입 시**: `contentEditable` 활성화, 파란 점선 테두리로 편집 상태 표시
- **저장 시**: DOM의 `innerHTML`을 캡처 → `htmlCode` 상태 동기화 → 편집 모드 종료

### 3. 클릭 인스펙터 패널 (핵심 기능)
Edit 모드에서 요소 클릭 시 빨간 테두리로 선택 표시 + 속성 패널 팝업:

| 항목 | 기능 |
|------|------|
| **TT 텍스트** | 직접 텍스트 수정 (DOM 텍스트 노드 교체) |
| **A 크기** | 슬라이더로 8~120px 즉시 반영 |
| **글자색** | 컬러 피커 → `el.style.color` 즉시 적용 |
| **배경색** | 컬러 피커 + ✕ 배경 제거 버튼 |
| **◻ 모서리** | 0~60px 슬라이더 |

저장 버튼 클릭 시 수정된 DOM → htmlCode → PNG 다운로드까지 연결됨.

### 4. 브랜드 팔레트 커스터마이징
- 기존 고정 프리셋(`시그니처 / 브라이트 / 웜`) 완전 제거
- **주색 · 강조색 · 보조색** 3슬롯 커스텀 컬러피커로 대체
- 각 슬롯: 클릭 가능한 컬러 스와치 + hex 코드 표시 + `↺` 기본값 복원
- 하단 3색 미리보기 바로 반영
- 설정한 컬러는 **AI 이미지 생성** (`brandColors`) + **HTML 생성** (`colors`) API 양쪽에 모두 전달

### 5. 코드박스 2열 이동
- 3열(결과 패널)에서 코드 `textarea` 제거
- 2열(생성 버튼 아래)에 고정 배치 — htmlCode 생성 시 자동 노출
- `codeTextareaRef` 연결 완료

### 6. 프리뷰 클릭 → 코드박스 자동 스크롤
Edit 모드에서 요소 클릭 시 `scrollCodeToElement()` 실행:
1. `id` 속성으로 매칭 시도
2. `class` 첫 번째 값으로 매칭 시도
3. 텍스트 내용(30자)으로 매칭 시도
4. 해당 줄로 textarea 스크롤 + **줄 하이라이트** (`setSelectionRange`)

→ 비개발자가 "이 버튼 어디 코드야?" 물음 없이 바로 찾을 수 있음

---

## 🔧 현재 기술 구조

```
1열 (좌)          │ 2열 (중)              │ 3열 (우)
──────────────────┼───────────────────────┼────────────────────────
레퍼런스 이미지    │ 생성 모드 전환 (탭)   │ AI 이미지 탭
스타일 선택        │ 직입 프롬프트          │   └ 생성 결과 이미지
브랜드 팔레트 🆕  │ [생성] 버튼           │ HTML 디자인 탭 🆕
콘텐츠 유형        │ 에러/재시도 UI        │   ├ Edit / 저장 버튼
                   │ HTML 코드박스 🆕     │   ├ 클릭 인스펙터 패널
                   │   ↕ 클릭 시 연동     │   └ 라이브 프리뷰
```

---

## 📋 내일 작업 예정

### 🔴 우선순위 HIGH

#### A. 브랜드 컬러 — 이미지 자동 추출
> 사용자가 요청한 "이미지나 링크로 브랜드 컬러 에셋 만들기"

- **방법 1**: 이미지 업로드 → Canvas API 픽셀 샘플링 → 지배 컬러 3개 자동 입력
- **방법 2**: 이미지 URL → Gemini Vision 분석 → `customColors` 자동 세팅
- 팔레트 슬롯 아래에 "이미지에서 추출" 버튼 추가

#### B. Edit 모드 안정화
- scale 변환된 preview div 내부 클릭 좌표 오차 실사용 테스트 및 보정
- 폰트 패밀리 드롭다운 추가 (현재는 크기·색상만)
- PNG 다운로드 전 선택 아웃라인(빨간 테두리) 자동 제거

### 🟡 우선순위 NORMAL

#### C. 코드 스크롤 정확도 향상
- 현재: id/class/text 순 단순 매칭
- 개선안: 생성 시 각 요소에 `data-lumi-id` 속성 주입 → 클릭 시 정확히 1:1 매핑

#### D. 아카이브 기능 보강
- 아카이브 저장 시 HTML 코드도 함께 보관 (현재 이미지만 저장됨)
- 아카이브에서 불러올 때 HTML 탭 자동 복원

#### E. 모바일/태블릿 프리뷰 전환
- 현재 scale 고정 → 반응형 뷰 토글 버튼 추가

---

## 🔑 환경 메모

| 항목 | 값 |
|------|-----|
| 개발 서버 | `http://localhost:5173` (Vite) |
| API 서버 | `http://localhost:4000` |
| Gemini API | 구독 계정 연결 완료 |
| 주요 파일 | `src/components/Views/ImageLabView.jsx` |
| 백엔드 엔드포인트 | `/api/imagelab/brand-generate`, `/api/imagelab/html-generate` |

---

*마지막 수정: 2026-04-22 17:56 KST by Luca (세션 2)*

---

## ✅ 세션 2 완료 (2026-04-22 17:56 KST)

### A. 링크 색상 추출 정확도 개선 (백엔드)
- Gemini 프롬프트 완전 재작성: 주색(Primary) → 강조색(Accent) → 보조색(Secondary) 3개 정확 추출
- 순백(#FFFFFF 계열), 순흑(#000000 계열) 중립색 필터링 지시 추가
- 다크/라이트 테마별 추출 기준 명시 → 실제 브랜드 아이덴티티 컬러 반영도 향상

### B. HTML Edit 모드 안정화
- **`handleHtmlDownload` 전면 수정**: `querySelectorAll('*')`로 preview 내 **모든** outline 임시 제거 → PNG 다운로드 후 완전 복원 (선택 표시 없는 깔끔한 PNG 보장)
- **stale state 버그 수정**: `scrollCodeToElement`가 edit 모드에서 `htmlCode` state 대신 `htmlPreviewRef.current.innerHTML` (DOM live) 읽도록 수정 → 수정 중 코드박스 동기화 정확도 향상

### C. 코드 스크롤 정확도 — data-lumi-id 1:1 매핑
- **백엔드 html-generate 시스템 프롬프트**: Rule 8 추가 — 모든 의미있는 요소에 `data-lumi-id="lumi-N"` 자동 주입 (신규 생성 HTML부터 적용)
- **프론트엔드 scrollCodeToElement**: `data-lumi-id` 0순위 매칭 추가 → id → class → text 폴백 체인 유지
- `htmlEditMode` dependency 추가로 함수 최신성 보장

---

## 📋 다음 세션 작업 예정

### 🟡 우선순위 NORMAL
- **D. 아카이브 기능 보강**: HTML 코드 함께 보관 + 불러올 때 HTML 탭 자동 복원
- **E. 모바일/태블릿 반응형 프리뷰**: scale 고정 → 반응형 뷰 토글 버튼

---

## 🔑 환경 메모

| 항목 | 값 |
|------|-----|
| 개발 서버 | `http://localhost:5173` (Vite) |
| API 서버 | `http://localhost:4000` |
| 주요 파일 | `src/components/Views/ImageLabView.jsx` |
| 백엔드 파일 | `01_아리_엔진/routes/imageLabRouter.js` |
| Git 커밋 | `32f7ddf` (B+C), `de5f90c` (D+E) |

---

## ✅ 세션 3 완료 (2026-04-22 23:06 KST)

### D. 아카이브 기능 보강
- **[backend]** `POST /archive`: `htmlCode` 필드 수신 → `meta.json`에 함께 저장
- **[frontend]** `handleArchive`: `htmlCode`도 함께 전달
- **[frontend]** 아카이브 갤러리 카드 개선:
  - HTML 보유 카드에 보라색 `HTML` 뱃지 표시
  - **"HTML 불러오기"** 버튼 → 클릭 시 코드 복원 + HTML 탭 자동 전환
  - 이미지 전용 카드는 기존 "배경 적용" 유지
  - 카드 hover 시 파란 테두리 효과 추가

### E. 반응형 프리뷰 디바이스 토글
- `previewDevice` state 추가 (`'desktop'|'tablet'|'mobile'`)
- HTML 탭 헤더에 **PC / 태블릿 / 모바일** 토글 버튼 3종 추가
- 디바이스별 최대 표시 폭: `desktop=520px`, `tablet=320px`, `mobile=200px`
- scale을 동적 계산하여 프리뷰 자동 축소

---

## 📋 다음 세션 작업 예정

### 남은 작업
- 없음 (B, C, D, E 모두 완료)

### 신규 기능 후보 (대표님 결정 필요)
- 아카이브 PNG 다운로드 기능
- HTML 코드 직접 편집 후 즉시 preview 반영 (실시간 라이브 모드)
- 생성 히스토리 타임라인 뷰



