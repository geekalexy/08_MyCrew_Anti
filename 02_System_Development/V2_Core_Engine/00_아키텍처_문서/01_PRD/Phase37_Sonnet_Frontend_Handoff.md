# [작업 지시서/리뷰 요청서] 라이브 스플릿 프리뷰 프론트엔드 구현 (to. Sonnet)

**To**: Sonnet (UI/UX 담당)
**From**: Luca (백엔드/인프라 담당)
**목표**: 에이전트 생성 결과물을 실시간으로 확인하는 [Live Split Preview] 기능의 프론트엔드 구현

---

## 1. 개요 및 백엔드 준비 상태
현재 개발 중인 프로젝트 파일들(`outputs` 폴더)을 브라우저에서 즉각 확인할 수 있는 프리뷰 기능을 구축합니다.

✅ **백엔드(Luca) 지원 완료 사항**:
- 아리 엔진(`server.js`)에 정적 라우팅 설정 완료 (또는 즉시 완료 예정).
- 프론트엔드에서 아래 Iframe URL을 호출하면, 해당 프로젝트의 결과물이 렌더링됩니다.
  👉 **Iframe URL 형식**: `http://localhost:4007/preview/{task.project_id}/OUTPUT/index.html`

---

## 2. 프론트엔드(Sonnet) 작업 요청 사항

소넷, 아래 명세에 따라 대시보드 컴포넌트(`TaskDetailModal.jsx` 중심)를 업데이트해 주세요.

### 🎯 2.1. UI 트리거 버튼 추가
- `TaskDetailModal` 우측 상단 메뉴 혹은 코드가 포함된 코멘트 영역 근처에 `[👀 프리뷰]` 버튼을 추가해 주세요.
- (선택 사항) `ReactMarkdown` 렌더러에서 HTML/CSS/JS 코드 블록이 감지될 때만 버튼이 노출되면 더욱 좋습니다.

### 🖥️ 2.2. 모달 확장 및 스플릿 뷰 (Split View) 상태 관리
- 버튼 클릭 시 `isPreviewMode` 상태가 `true`가 되면서, 기존 중앙 집중형 모달을 **화면 전체 너비의 90% 크기**로 넓혀 주세요.
- 화면 레이아웃을 좌/우로 분할합니다.
  - **Left Pane**: 기존 Task 상세 내용, 코멘트 등.
  - **Right Pane**: `iframe`이 포함된 렌더링 화면.

### 🖱️ 2.3. 좌우 크기 조절 (Resizer) 구현
- 좌우 패널 사이에 드래그 가능한 얇은 핸들(Resizer 막대)을 추가해 주세요.
- 마우스 드래그를 통해 좌우 비율(기본 50:50)을 동적으로 조절해야 합니다 (`splitRatio` 상태 활용).
- **⚠️ 중요 트러블슈팅**: 드래그할 때 마우스가 우측 Iframe 영역에 진입하면 `mousemove` 이벤트가 끊깁니다. 드래그 이벤트가 시작될 때(`onMouseDown`) Iframe에 CSS로 `pointer-events: none`을 임시 적용하고, 드래그가 끝나면 복구하는 로직을 반드시 포함해 주세요.

### 🔄 2.4. 프리뷰 툴바 (Iframe Header)
- 우측 Iframe 상단에 얇은 헤더 바를 배치해 주세요.
- **[새로고침]** 버튼: 에이전트가 코드를 덮어썼을 때 즉각 반영하기 위함 (`iframe.src` reload).
- **[새 창 열기]** 버튼: `target="_blank"`로 해당 프리뷰 링크를 독립된 탭에서 열 수 있게 지원.

---

## 3. 참조 파일
- `src/components/Modal/TaskDetailModal.jsx`
- `src/styles/modal.css` (필요 시 확장 모달용 CSS 추가)

> **Message from Luca**:
> 소넷, 백엔드는 포트 4007번에서 `express.static`으로 정적 서빙 라우트를 깔끔하게 뚫어두겠습니다. 리사이저블 드래그 로직은 까다로울 수 있으니 `useRef`와 `window` 이벤트 리스너를 조합하여 구현해 주면 완벽할 것 같습니다. 설계서 확인 후, 코드 구현을 시작해 주세요!
