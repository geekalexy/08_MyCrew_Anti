# SESSION LOG — 2026-05-07 (Sonnet) — Phase 37 Live Split Preview 프론트엔드 완료

## 세션 메타
- **일시**: 2026-05-07 00:15 ~ 01:43 KST
- **에이전트**: Sonnet (Claude Sonnet 4.6, Antigravity)
- **이어받은 세션**: `SESSION_LOG_2026-05-06_Luca.md` (Luca 백엔드 완료 + Supreme Review A등급 승인)
- **주요 Phase**: Phase 37 — Live Split Preview 프론트엔드 구현

---

## 완료 작업

### ✅ 1. Phase 37 핸드오프 문서 파악 및 컨텍스트 복구

루카가 완성한 백엔드 라우트(`/preview/:projectId`) 및 Supreme Review 결과 확인.

| 항목 | 상태 |
|------|------|
| 백엔드 `/preview/:projectId` 라우트 | ✅ Luca 완료 |
| Supreme Review 등급 | ✅ 🟢 A — 승인 |
| 프론트엔드 핸드오프 PRD | `Phase37_Sonnet_Frontend_Handoff.md` 확인 완료 |

---

### ✅ 2. Live Split Preview — `TaskDetailModal.jsx` 구현

#### 2-1. 상태(State) 및 Ref 추가

```jsx
const [isPreviewMode, setIsPreviewMode] = useState(false);
const [splitRatio, setSplitRatio] = useState(50);      // 좌측 패널 % 비율
const [previewError, setPreviewError] = useState(false);
const [hasPreviewData, setHasPreviewData] = useState(false); // HEAD 체크 결과
const iframeRef  = useRef(null);
const resizerRef = useRef(null);
const isDragging = useRef(false);
```

#### 2-2. 프리뷰 데이터 사전 체크 (HEAD Request)

태스크 로드 시 `outputs/index.html` 존재 여부를 HEAD 요청으로 사전 확인.
- 200 OK → `hasPreviewData = true` → 버튼 활성
- 실패 → `hasPreviewData = false` → 버튼 숨김

```js
fetch(`http://localhost:4007/preview/${projectId}/outputs/index.html`, { method: 'HEAD' })
  .then((r) => setHasPreviewData(r.ok))
  .catch(() => setHasPreviewData(false));
```

#### 2-3. 👀 프리뷰 버튼 (헤더 우상단)

- `previewUrl && hasPreviewData` 조건부 렌더링
- 활성 시 브랜드 색상(`rgba(100,135,242,0.15)`) 배경
- 아이콘: `preview` ↔ `close_fullscreen` 토글

#### 2-4. Split View 컨테이너

```jsx
<div style={{
  flex: 1, display: 'flex', overflow: 'hidden',
  flexDirection: isPreviewMode ? 'row' : 'column',
}}>
  {/* Left Pane — 기존 본문 */}
  <div style={{ flex: isPreviewMode ? `0 0 ${splitRatio}%` : '1 1 auto', overflowY: 'auto' }}>
    {/* 기존 내용 */}
  </div>

  {/* Resizer */}
  {isPreviewMode && <div ref={resizerRef} onMouseDown={handleResizerMouseDown} />}

  {/* Right Pane — iframe */}
  {isPreviewMode && <div style={{ flex: `0 0 ${100 - splitRatio}%` }}>...</div>}
</div>
```

#### 2-5. Resizer 드래그 핸들러

- `mousedown` → iframe `pointer-events: none` (드래그 중 iframe 이벤트 흡수 차단)
- `mousemove` → `splitRatio` 20~80% 클램핑
- `mouseup` → iframe `pointer-events: auto` 복원

#### 2-6. iframe 구성

```jsx
<iframe
  ref={iframeRef}
  src={previewUrl}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  onError={() => setPreviewError(true)}
/>
```

- **`onLoad` 핸들러 제거** (핵심 버그 수정 — 아래 버그 섹션 참조)
- `sandbox` 속성에 `allow-popups` 추가

#### 2-7. 프리뷰 툴바

| 요소 | 기능 |
|------|------|
| URL 바 | `localhost:4007/preview/{id}/outputs/index.html` 표시 |
| 새로고침 버튼 (`#btn-preview-refresh`) | `iframeRef.current.src = iframeRef.current.src` |
| 새 탭 버튼 (`#btn-preview-new-tab`) | `window.open(previewUrl, '_blank')` |

#### 2-8. Empty State

`previewError === true` 시 "아직 outputs/index.html이 없어요" 안내 + 다시 시도 버튼.

#### 2-9. CSS — `modal--preview` 클래스 (`app.css`)

```css
.modal--preview {
  max-width: 90vw !important;
  width: 90vw !important;
  max-height: 95dvh !important;
}
```

---

### 🐛 발생 버그 및 해결

#### 버그 1 — 프리뷰가 잠깐 보였다가 꺼지는 현상

**원인**: `onLoad` 핸들러에서 `contentDocument`에 접근 시, 브라우저·포트 설정에 따라 same-origin으로 처리되면 `doc`가 접근 가능해짐 → 예상치 못한 조건(`!doc` 혹은 `textContent` 체크)에 걸려 `setPreviewError(true)` 잘못 호출.

**해결**: `onLoad` 핸들러 완전 제거. HEAD 체크가 파일 존재를 이미 보장하므로 `onLoad` 감지는 중복이자 위험 요소. `onError`만 유지.

#### 버그 2 — JSX div 태그 불균형

**원인**: Right Pane 삽입 시 Left Pane 닫는 `</div>` 2개가 중복 삽입됨.

**해결**: 불필요한 `</div>` 제거. 최종 `<div>` opens=91, self-closing=5, `</div>` closes=86 → diff=0 확인.

---

### ✅ 3. 테스트용 샘플 파일 생성

**경로**: `04_Users/01_Company/01_Projects/미니앱_71480/outputs/index.html`

- 다크 테마, MyCrew 브랜딩
- 실시간 시계 (1초 업데이트)
- 클릭 카운터 + 리셋
- `프리뷰 URL`: `http://localhost:4007/preview/proj-1777986471480/outputs/index.html`

---

## 수정된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `TaskDetailModal.jsx` | Live Split Preview 전체 구현 (상태, 리사이저, iframe, 툴바, 버튼) |
| `app.css` | `.modal--preview` 클래스 추가 |
| `04_Users/.../미니앱_71480/outputs/index.html` | 테스트용 샘플 HTML 생성 |

---

## 다음 세션 작업 목록

### 🔲 프리뷰 실시간 갱신 (선택)
에이전트가 파일을 업데이트하면 자동으로 iframe을 새로고침하는 폴링 로직 추가 고려.

### 🔲 다른 프로젝트 outputs 폴더 정비
`미니미니_18838`, `마케팅_84752` 프로젝트에도 `outputs/` 폴더 구조 적용 필요.

### 🔲 Phase 37 구현 보고서 작성
`02_System_Development/00_아키텍처_문서/02_구현보고서/Phase37_Sprint1_보고서.md`

---

## Phase 37 완성도

```
백엔드 라우팅 (/preview/:id):     ✅ Luca 완료
보안 (Path Traversal 차단):       ✅ Luca 완료
07_OUTPUT → outputs 표준화:       ✅ Luca 완료
Supreme Review:                   ✅ 🟢 A등급 승인

프리뷰 버튼 UI:                   ✅ Sonnet 완료
Split View 레이아웃:              ✅ Sonnet 완료
Resizer 드래그:                   ✅ Sonnet 완료
iframe 연동:                      ✅ Sonnet 완료
프리뷰 툴바:                      ✅ Sonnet 완료
Empty State:                      ✅ Sonnet 완료
outputs 존재 여부 사전 체크:       ✅ Sonnet 완료
버튼 조건부 표시:                  ✅ Sonnet 완료
테스트 샘플 HTML:                  ✅ Sonnet 완료
```
