# Phase 37: Zero-Base Project Initialization Architecture (0-Base 스타트)

## 1. 배경 및 목적 (Background & Objective)
- **기존 기획**: 사용자 회원가입 시 편의를 위해 '기본 프로젝트(Default Project)'를 자동 생성하여 제공.
- **발생 문제**: 아무런 사전 컨텍스트 없이 생성된 기본 프로젝트는 AI(루카, 소넷 등)에게 '빈 도화지(Blank Canvas)'로 작용함. 이는 첫 PRD 생성 및 아키텍처 설계 시 품질 저하(Garbage In, Garbage Out)를 유발.
- **해결 목표**: 가입 직후 어떠한 프로젝트도 존재하지 않는 **'0-Base (Empty State)'** 상태를 강제하고, 정교화된 [프로젝트 설정 폼]을 통해 사용자가 직접 명확한 컨텍스트(프로젝트 목적, 타겟, 스킬 등)를 입력하도록 유도. 이를 통해 AI 에이전트의 초기 산출물(PRD) 퀄리티를 극대화함.

---

## 2. 핵심 아키텍처 변경 사항 (Core Architecture Changes)

### 2.1 Backend & DB (Ari Engine)
1. **기본 프로젝트 생성 차단**
   - 회원가입 API 로직 내에 존재하던 `scaffoldDefaultProject()` 또는 더미 프로젝트 `INSERT` 로직 완전 제거.
   - 신규 유저 생성 시 `projects` 테이블은 0건, 파일시스템(`04_Users/{UserID}/`)은 최소 골격만 생성한 빈 상태로 둠.
2. **첫 프로젝트 생성 트랜잭션 최적화**
   - 폼 입력 데이터 ➔ `teamBuilder.js` (약 70초 소요, LLM 처리) ➔ `projectScaffolder.js` ➔ `DB Insert` 순서의 데이터 흐름 강화.
   - 프로젝트 ID 발급 시점과 파일시스템 폴더(`04_Users/{UserID}/01_Projects/{ProjectID}`) 스캐폴딩 동기화.

### 2.2 Frontend (Dashboard UX)
1. **Empty State 뷰 렌더링**
   - `selectedProjectId`가 없거나 `projects.length === 0`일 때, 기존 Kanban 보드와 Log 서랍을 블로킹(가림) 처리.
   - 중앙에 대형 빈 화면(Empty State) 디자인 노출: 
     - **문구**: "프로젝트를 만들면 AI 멀티 에이전트가 채용됩니다."
     - **CTA 버튼**: `[ 생성하기 ]`
2. **강제화된 Context Funnel**
   - CTA 버튼 클릭 시 ➔ 즉시 **`ProjectSettingsModal`** 팝업.
   - 모달 닫기(X)를 하더라도 뒤에는 빈 화면이 남아있어 반드시 폼을 작성해야만 시스템을 이용할 수 있도록 유도 (Context 강제화).

### 2.3 File System (Path Jailing)
- 이전 페이즈에서 확립된 `04_Users/01_Company/01_Projects/` 아키텍처와 시너지.
- 사용자가 폼을 제출하여 70초 로딩을 끝내야만, 해당 유저 폴더 하위에 실질적인 `01_Projects/{생성된_프로젝트명}` 폴더와 `07_OUTPUT` 공간이 비로소 물리적으로 할당됨.

---

## 3. 워크플로우(Workflow) 비교

### 기존 흐름 (AS-IS)
`회원가입` ➔ `DB(proj_default) 강제 생성` ➔ `빈 화면 대시보드 진입` ➔ `사용자가 막연하게 대화 시작` ➔ `AI가 맥락을 못 잡아 헤맴`

### 신규 흐름 (TO-BE)
`회원가입` ➔ `프로젝트 0건 (Empty State)` ➔ `새 프로젝트 버튼 클릭` ➔ `모달에서 '목적/요구사항' 상세 작성` ➔ `팀빌딩 파이프라인(70초) 가동` ➔ `완벽한 맥락을 갖춘 PRD 자동 도출 및 렌더링`

---

## 4. 기대 효과
1. **AI Output 퀄리티 상승**: 가장 강력한 초기 프롬프트(User Context)를 확보하여, 프로젝트 초반 헛돌기(Hallucination) 방지.
2. **인프라 자원 절약**: 사용하지 않는 더미 데이터/더미 폴더로 인한 스토리지 및 DB 낭비 방지.
3. **UX 전문성**: 사용자가 '내가 시스템을 통제하고 지시를 내린다'는 느낌을 명확히 받는 프로페셔널한 온보딩 경험 제공.
