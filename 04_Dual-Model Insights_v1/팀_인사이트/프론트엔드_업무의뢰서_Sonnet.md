# [프론트엔드 업무 의뢰서] MyCrew 칸반 및 뷰어 UI 전면 개편

> **작성자**: Claude Sonnet (UI/UX 디렉터 & 프론트엔드 담당)
> **수신자**: MyCrew Frontend Engineering Team
> **기획 원안**: `칸반카드_UIUX_개편기획안_Luca.md` (by Luca)
> **작성일**: 2026-04-17
> **목적**: 기획된 UX 와이어프레임을 실제 React 컴포넌트와 CSS로 정확하게 구현하기 위한 개발 기술 명세서(PRD)입니다.

---

## 1. 컴포넌트: `TaskCard.jsx` (보드 전면 카드)
**📍 목표: 미니멀리즘과 렌더링 최적화**
*   **DOM 구조 단순화**:
    *   기존에 표시되던 날짜, 작업 유형 태그 등 부차적인 메타데이터 렌더링 로직 제거.
    *   오직 `{Task Title}`, `{Assignee Avatar}`, `{Priority Badge}` 3개의 Prop만 렌더링할 것.
*   **아이콘 제거**: 카드 우측 상/하단에 배치된 확장 아이콘(`<ExpandIcon />`) 컴포넌트 마운트 해제.
*   **CSS 처리**: `padidng`을 타이트하게 잡고 `box-shadow`를 완전히 빼거나 옅게(sm) 처리하여 Flat 스타일 유지.

---

## 2. 컴포넌트: `TaskDetailModal.jsx` (상세 팝업)
**📍 목표: 노션 스타일의 시원한 개방감 및 가독성 확보**
*   **사이즈 및 레이아웃**:
    *   모달 컨테이너의 최상단 CSS: `width: 90vw; max-width: 900px;` 등 노션 팝업과 동일한 비율의 가로폭 하드코딩.
    *   좌측 상단 네비게이션(헤더) 영역에 `전체화면 확장(<ArrowsExpandIcon />)` 재배치.
*   **Borderless 본문 (가독성 패치)**:
    *   본문을 감싸고 있던 Box 컨테이너의 `border`, `bg-color(음영)` 속성 전부 `transparent` 또는 제거.
    *   `ContentBody` 내부의 전역 폰트 타이포그래피 재설정:
        *   `line-height: min(1.6, 28px);` 필수 적용.
        *   문단(`.paragraph`, `p`) 간 `margin-bottom: 20px;` 설정하여 AI 텍스트의 숨통 트기.

---

## 3. UI 컴포넌트: `TaskHistory.jsx` (히스토리/댓글)
**📍 목표: 지시 흐름 시각화 위상(Topology) 표시**
*   **Arrow 아이콘 주입**:
    *   작업 내역/댓글 헤더 부분에 `[명령자 컴포넌트] + <ArrowRight className="w-4 h-4 text-gray-400 mx-2" /> + [수행자 컴포넌트]` 형태로 DOM 구조를 변경하여 데이터 시각적 흐름 보장.

---

## 4. 신규 컴포넌트: `ArtifactPreviewModal.jsx` (풀스크린 뷰어)
**📍 목표: 방해 요소 없는 미디어 몰입 및 인라인 수정(Click-To-Edit)**
*   **진입점**: `TaskDetailModal.jsx` 상단 컨트롤러 구역에 명시적인 `[프리뷰(아티팩트) 보기]` 버튼 생성.
*   **구조**:
    *   배경(Backdrop)은 `bg-black/90` 수준으로 어둡게 처리.
    *   렌더링되는 자식 요소는 오직 `Title(h1)`과 `Media/Image` 단 두 가지.
*   **인라인 에디팅(Inline Editing) 로직**:
    *   결과물 텍스트에 덧대어진 `onClick` 핸들러 구현. 클릭 시 `<p>` 태그가 `<textarea>` 나 Content Editable `<div>`로 상태 토글(State Toggle)되게 상태 관리(`isEditing`).
    *   수정 모드 진입 시, 우측에 `SubAgentChatPanel.jsx` (채팅 팝업)이 슬라이드-인 하도록 트리거 이벤트 발생시켜 AI와 즉시 협업 지원.

---

## 5. 라이브러리 교체 연기: 마크다운 WYSIWYG 렌더러
**📍 목표: 별표(*), 해시태그(#) 블라인드 처리**
*   **개발팀 피드백**: Tiptap이나 Slate.js 코어를 전면 도입하여 노션 스타일의 WYSIWYG 에디터로 마이그레이션하는 것은 결합도와 공수가 매우 큰 대형 컴포넌트 교체 작업임.
*   **작업 지시 (우회안)**:
    *   에디터 전면 마이그레이션은 안정성을 위해 **별도 전용 Sprint로 분리하여 후순위로 진행**할 것을 권장.
    *   **단기 대안 액션**: 4번 항목에서 신설되는 `[ArtifactPreviewModal]`의 **클릭 투 에딧 (Click-to-Edit)** 방식을 단기 대안으로 적극 활용. (마크다운 기호가 눈에 띄지 않게끔 풀스크린 뷰어로 전환한 뒤, 해당 뷰어 안에서 직관적으로 텍스트나 결과물을 바로 수정하는 경험으로 WYSIWYG의 빈자리를 커버함).

---
*소넷(Claude Sonnet) 작성 — 프론트엔드 본부*
*UI/UX의 악마는 디테일에 있습니다. 위 명세서대로 컴포넌트를 분리하여 State 오염 없이 개발 바랍니다.*
