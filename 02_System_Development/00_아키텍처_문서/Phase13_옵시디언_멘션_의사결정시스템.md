# Phase 13 옵시디언 네이티브 워크스페이스 및 멘션 기반 의사결정 파이프라인

## 1. 개요 및 목적
본 문서는 MyCrew 프로젝트 Phase 13에서 구현된 **3대 우선순위 과제**의 아키텍처 및 시스템 레이어 구조를 정의한다. 
본 페이즈의 핵심 도입 목적은 기존에 파편화되었던 '외부 UI 대시보드'와 '개발자 로컬 워크스페이스(Obsidian)'의 경계를 완전히 허물고, 대시보드 내의 채팅(Mention) 한 번으로 타겟 에이전트가 로컬 파일시스템에 물리적인 작업을 즉시 수행하는 **Native ChatOps**를 실현하는 데에 있다.

## 2. 3대 핵심 아키텍처 

### 2.1. Obsidian Native Workspace 매핑 (Local-to-Dashboard Sync)
브라우저 샌드박스로 인해 프론트엔드(`SettingsView`)가 로컬 절대 경로에 직접 접근하지 못하는 한계점을 극복하기 위해, **Engine Execution Context(CLI)** 방식을 도입했다.
- **방식**: 사용자가 아리 엔진(`server.js`)을 구동한 현재 경로(`process.cwd()`)를 시스템의 루트 워크스페이스로 매핑.
- **Obsidian 감지 로직**: 엔진은 구동 즉시 해당 경로 최상단에 `.obsidian` 폴더가 존재하는지 탐색하여 API(`GET /api/system/workspace`)로 반환. 프론트엔드는 이 플래그를 받아 `SettingsView`에 보라색 **[Obsidian Vault]** 뱃지를 점등한다.
- **효과**: 아리 엔진이 생성하는 모든 출력 문서, 태스크 기록이 옵시디언 볼트(`01_Notes` 등 지정 폴더)로 다이렉트 아카이빙되며 볼트 내에서 즉각적으로 상호참조(Wiki-link)가 가능해진다.

### 2.2. 타임라인(Timeline) `@멘션` 기반 즉각 업무 지시 구조
기존 `TaskCard` 중심의 수동 업무 할당 방식을 개선하여, 텔레그램 메신저나 글로벌 채팅 라인에서 `@[에이전트명] [지시내용]`을 입력하면 곧바로 태스크가 생성되고 담당자가 할당되는 시스템.

- **파싱 로직**: 프론트엔드의 `LogDrawer.jsx`에서 정규식 `/^@([a-zA-Z가-힣]+)\s+(.*)/`을 통해 에이전트 이름과 지시어를 파싱.
- **Backend API**: `POST /api/tasks/mention` 라우터가 이를 수신하여, `createTask`를 호출하고 즉시 소켓 통신을 통해 카드 상태를 `To Do` ➔ `In Progress`로 강제 전이시킨다.
- **Fallback**: 사용자가 오타를 내거나 잘못된 이름을 멘션했을 경우, `agentMap` 규칙에 따라 기본 에이전트인 **'ari(아리)'**에게 Fallback 처리하여 Flow의 중단을 방지한다.

### 2.3. 의사결정 파이프라인 (Review 컬럼 도입)
인간(대표)과 다수의 에이전트가 협업하는 과정에서 에이전트의 단독 결정을 제어하는 '결재(Approval)' 단계를 칸반 보드에 신설.
- **구조**: `To Do` ➔ `In Progress` ➔ **`Review`** ➔ `Done` 의 4열 직렬 파이프라인.
- **Trigger**: 에이전트(`devteam` 등)가 백그라운드 작업을 정상 종료(Exit Code 0)하면 그 즉시 카드가 `REVIEW` 상태로 세팅되며 Review 열로 떨어짐.
- **병목 방지 원칙 (Agent Monologue Rule)**: 에이전트는 완료 시 대표자에게 결과물을 보고하고 리뷰 열에서 멈추며, 대표의 수동 승인(Phase 14 구현 예정)이 있어야만 비로소 `Done`으로 넘어갈 수 있다.

---

## 3. 기술적 한계점 및 향후 과제 (Tech Debt - Prime Review W1/W2/S2)

프라임(Claude Opus) 리뷰 결과, 현재 아키텍처에는 조속히 리팩터링해야 할 기술 부채가 존재한다.

1. **[W1] `Model` 필드의 Semantics 오용**
   - 현재 `createTask` 시 파라미터 `model` 필드에 `'ari'`, `'devteam'`과 같은 에이전트 ID를 덮어쓰고 있다. 
   - **해결 방안(Phase 14)**: DB 스키마를 업데이트하여 `assigned_agent` 컬럼을 완전히 분리하고, `model` 컬럼은 실제 연산 모델명(예: `gemini-2.5-flash`, `claude-3.5-sonnet`)만 담도록 정규화해야 한다.

2. **[W2] 멘션 소켓 이벤트(생성/이동) 레이스 컨디션 우려**
   - `task:created(todo)` 이후 `300ms` 뒤 `task:moved(in_progress)`를 쏘는 2단계 로직은 네트워크 지연 시 UI 깜빡임이나 영구 To Do 잔류 현상을 유발할 수 있다.
   - **해결 방안**: API 계층에서 `task:created` 호출부터 `in_progress` 상태로 쏴서 한 단계로 동기화.

3. **[S2] 승인(승인/반려) UX 결여**
   - 현재 REVIEW 열로 잘 모이고 있으나, 이를 검토하고 결과적으로 `DONE`으로 보내거나 `TODO`로 다시 돌려보낼 전용 버튼 UX가 없다. 드래그 앤 드롭으로 기능은 하지만 아키텍처 흐름상 불완전하다.
   - **해결 방안(Phase 14)**: 카드 UI 내부에 `[✅ 승인 (Archive Trigger)]`, `[🔄 재작업 지시]` 액션 버튼을 생성해야 한다.

---

## 4. 모바일 호환성 (Phase 13 Base Fixes)
- 모바일 뷰버그 해결: `LogDrawer`의 좌우 너비 및 입력창이 하단 Safe-area에 가리는 문제를 해결하기 위해 `safe-area-inset-bottom` 속성을 App.css에 부여했으며, `<aside>` 태그 width 계산식을 `window.innerWidth * 0.65` 최댓값으로 강제 대응했다.
