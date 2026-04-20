# Sonnet 개발 시 반복 실수 패턴 & 방지 규칙

> 이 문서는 기존 컴포넌트에 새 UI 구조(탭, 섹션 등)를 추가할 때 발생한  
> 반복 오류 패턴을 기록하고, 이를 방지하기 위한 체크리스트를 정의합니다.

---

## ❌ 반복 실수 패턴

### 패턴 1. 기존 닫는 태그 + 새로 추가한 닫는 태그 중복
기존 컴포넌트에 탭 구조를 추가할 때,  
**이미 닫혀 있는 `</div>`** 뒤에 의미 없는 `</div>{/* /board-header */}` 를 하나 더 추가하여 JSX 파싱 에러 발생.

```jsx
// ❌ 잘못된 패턴
      </div>  {/* workspace-settings 닫힘 */}
    </div>    {/* board-header 닫힘 ← 이미 여기서 완전히 닫힘 */}

    </div>{/* /board-header */}  {/* ← 오류: 중복 닫는 태그 */}
```

```jsx
// ✅ 올바른 패턴
      </div>  {/* workspace-settings */}
    </div>    {/* board-header — 여기서 끝 */}

    {/* ── 탭 네비게이션 ── */}
    <div className="agent-detail-tabs">
```

---

### 패턴 2. 기존 컴포넌트 구조를 완전히 파악하지 않고 삽입
기존 파일의 태그 트리(열고/닫는 div 구조)를 end-to-end 확인하지 않고  
섹션 중간에 새 JSX를 삽입해서 트리가 깨지는 경우.

**방지 규칙:** 탭/섹션 추가 전 반드시 해당 파일의 return 블록 **전체**를 한 번 view_file로 확인한다.

---

### 패턴 3. 배치 위치 오류 (잘못된 View에 컴포넌트 추가)
의뢰서에 "팀 상세 페이지"라고 명시돼 있어도,  
습관적으로 AgentDetailView(에이전트 프로필)에 붙이는 실수.

**방지 규칙:**
| 페이지 명칭 | 해당 컴포넌트 |
|------------|--------------|
| 에이전트/프로필 상세 | `AgentDetailView.jsx` |
| **팀 상세 / 조직도** | **`OrgView.jsx`** |
| 설정 | `SettingsView.jsx` |
| 칸반/프로젝트 보드 | `KanbanBoard.jsx` |
| 아카이브 | `ArchiveView.jsx` |

---

## ✅ 기존 컴포넌트 탭 추가 시 체크리스트

1. **`view_file` 전체 확인**: return() 안의 div 트리를 전부 훑어본다
2. **닫는 태그 카운트**: 추가 전 열린 div 개수와 닫힌 div 개수를 맞춘다
3. **배치 위치 확인**: 기능 명세의 "위치: ..."를 컴포넌트 맵과 대조한다
4. **추가 후 즉시 검증**: 새 코드 작성 후 view_file로 삽입 전후 10줄을 재확인한다
5. **중복 import 제거**: 파일 상단의 import를 합칠 때 기존 import 라인 삭제 확인

---

## 📌 현재 View-컴포넌트 구조 요약

```
App.jsx
├── OnboardingWizard  (hasCompletedOnboarding === false)
├── ArtifactViewer    (activeArtifact !== null) — fullscreen overlay
└── 일반 레이아웃
    ├── Sidebar
    └── Main Area (currentView 기반 라우팅)
        ├── projects      → KanbanBoard
        ├── agent-detail  → AgentDetailView   (개인 에이전트 프로필)
        ├── organization  → OrgView            (팀 조직도 + 가이드라인)
        ├── archive       → ArchiveView
        └── settings      → SettingsView
                              ├── General 탭
                              └── Integrations 탭 → IntegrationVault
```
