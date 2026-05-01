# Phase 31: 프로젝트 기반 컨텍스트 격리(Project-Based Context Isolation) 기획서

## 1. 개요 및 기획 배경 (Background & Overview)
* **발단 (도그푸딩):** 에이전트(NOVA)가 소시안(Socian) 관련 아티클을 작성할 때, 워크스페이스 내에 압도적으로 누적된 마이크루(MyCrew) 관련 로그 및 문서에 의해 강하게 오염되는 **'컨텍스트 편향(Context Bias)'** 현상 발견.
* **해결의 단초:** AI 자신이 스스로 '정보량의 불균형'을 원인으로 지적하며 명시적 스코핑(Scoping)의 필요성 제기.
* **아키텍처 통합 (이중 개발 방지):** 단순히 태스크마다 스코프 태그를 다는 이중 작업을 피하고, 현재 개발 중인 **'멀티 프로젝트 분리(Phase 29~30)' 아키텍처와 통합**함. 
* **핵심 철학:** "프로젝트" 자체가 곧 "컨텍스트 스코프"가 되도록 설계하여, 유저가 프로젝트를 전환하는 순간 UI(패널/타임라인)뿐만 아니라 **AI의 단기 기억(Memory)과 주입되는 지식(RAG Context)까지 완벽히 격리(Isolation)**하는 강력한 B2B 엔터프라이즈급 시스템을 구축.

---

## 2. 핵심 컨셉: Project = Context Boundary
과거의 칸반 툴에서 '프로젝트'가 단순한 '게시판 분류'였다면, MyCrew에서의 프로젝트는 **AI의 '자아(Persona)와 지식(Knowledge)의 경계'**를 의미합니다.

### ⚙️ 동작 예시
* **프로젝트 A [MyCrew 개발]:** 
  * AI는 개발/기획 에이전트로서 `02_System_Development` 하위의 기술 스택, 칸반 DB, 시스템 아키텍처 문서를 집중적으로 RAG 주입받음.
* **프로젝트 B [Socian 브랜딩]:** 
  * AI는 기업 마케팅 에이전트로서 `socian_brand_context.md`와 브랜딩 에셋만 주입받음. 기존 MyCrew 코드는 철저히 망각하여 정보 오염을 원천 차단.

---

## 3. 시스템 구현 상세 (Implementation Details)

### 3.1 지식 및 프롬프트 격리 (RAG Context Isolation)
* **Project-Aware Context Injector (`server.js` & `context_injector.js`)**
  * AI에게 태스크를 할당할 때 해당 태스크가 속한 `projectId`를 기반으로 주입할 참조 문서(RAG Target Directory)를 다르게 매핑.
  * 태스크 실행 전 시스템 프롬프트 맨 앞에 **Hard Boundary Prompt** 강제 주입:
    > *"당신은 현재 [프로젝트명: Socian 브랜딩] 프로젝트를 수행 중입니다. 이 범위를 벗어나는 정보(예: MyCrew 시스템 코드 등)는 무시하고 오직 본 프로젝트의 목적과 컨텍스트 내에서만 사고하십시오."*

### 3.2 단기 기억(Memory) 및 UI 패널 격리
* **프로젝트 종속적 소켓 룸 분리 (Socket.io Rooms)**
  * 채팅(Chatting), 타임라인(LogDrawer) 이벤트 발생 시 `io.emit` 대신 `io.to(projectId).emit`을 사용하여 이벤트를 프로젝트 단위로 격리.
* **히스토리(History) 필터링**
  * `getCommentsWithTopology` 등 LLM에게 이전 대화 내역을 넘길 때, 오직 현재 프로젝트에 종속된 코멘트와 태스크만 필터링하여 제공. (A 프로젝트 수행 시 B 프로젝트의 기억 혼재 방지)

### 3.3 UI/UX 통합 (이중 개발 방지)
* **스코프 셀렉터의 흡수:** 태스크 상세 모달(`TaskDetailModal.jsx`)에 별도의 "Context Scope" 드롭다운을 만들지 않고, 기존의 **[프로젝트 이동/선택] 드롭다운이 스코프 제어 역할을 완전히 대체**함.
* **상속(Inheritance):** 유저가 특정 프로젝트 보드에 접속해 '카드 만들기'를 누르면, 해당 카드의 컨텍스트 스코프는 현재 프로젝트로 자동 상속됨 (UI 간소화).

---

## 4. 로드맵 및 개발 페이즈
* **Phase 31.1 DB 및 라우팅 보강:** `tasks`, `comments`, `timeline_logs` 테이블의 `project_id` 인덱싱 강화 및 조회 쿼리 최적화.
* **Phase 31.2 소켓(Socket) 아키텍처 격리:** 글로벌 브로드캐스트(`broadcastLog`) 로직에 `projectId` 매개변수를 필수화하고, 클라이언트의 리스너 구역화.
* **Phase 31.3 RAG 디렉토리 매핑:** 설정(Settings) 메뉴에 프로젝트별 'AI 참조 루트 폴더(Reference Root)'를 지정할 수 있는 UI/매핑 로직 추가.

---

## 5. 비즈니스 효과 (Marketing & B2B Sales Value)
* **세일즈 포인트:** "마이크루는 단순한 프롬프트 껍데기가 아닙니다. 고객사의 다양한 부서(인사, 마케팅, 개발)가 하나의 툴을 쓰더라도, 멀티 프로젝트 분리 기술을 통해 **AI의 두뇌(컨텍스트)를 완벽히 격리**시켜 부서 간 정보 유출이나 혼재, AI의 환각(Hallucination)을 100% 차단합니다."
* **Dogfooding 증명:** 마이크루 개발팀이 자체적으로 겪은 '컨텍스트 편향'을 어떻게 아키텍처적으로 우아하게 해결했는지를 블로그와 백서에 공개함으로써 기술적 신뢰도 대폭 상승.
