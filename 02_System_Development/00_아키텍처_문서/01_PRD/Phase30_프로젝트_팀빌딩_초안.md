# Phase 30: Project Initialization & Autonomous Team Building Architecture

## 1. 배경 및 목적 (Background & Objective)
Phase 29에서 구축한 프로젝트 멀티테넌시(Multi-tenancy) 인프라를 바탕으로, 실제 사용자(CEO)가 프로젝트를 세팅하고 에이전트들이 투입되는 과정을 자동화합니다. 
프로젝트의 목적을 AI가 분석하여 적재적소에 에이전트를 배치(팀 빌딩)하고, 보안 및 컨텍스트 혼선을 막기 위한 데이터 격리 수준을 결정하는 완결성 있는 시작(Onboarding) 경험을 제공합니다.

---

## 2. 주요 기능 명세 (Key Features)

### 2.1. 프로젝트 생성 풀-모달 (Project Creation Modal)
기존의 단순 인풋 필드를 대체하여 명확한 의도를 수집하는 Full-size UI를 도입합니다.
- **진입점**: 사이드바 LNB 프로젝트 영역의 `[+]` 버튼 클릭 시 노출.
- **입력 필드**:
  1. **프로젝트 명 (Name)**: 필수값.
  2. **목적 및 개요 (Objective)**: 선택값이지만 강력히 권장. Ari가 프로젝트 성격을 파악하고 필요한 에이전트를 선발하기 위한 핵심 단서로 작용.
  3. **데이터 공유/격리 옵션 (Isolation Level)**:
     - 🛡️ `ISOLATED` (완전 분리): 이전 프로젝트나 다른 워크스페이스의 데이터(RAG, 파일)와 완전히 차단된 클린룸 환경. 기밀성이 높은 프로젝트에 적합.
     - 🔗 `SCOPED` (부분 공유): 전사 공통 지식(가이드라인, 공용 에셋)만 참조하고, 작업 결과물은 격리하는 하이브리드 환경.
     - 🌍 `GLOBAL` (완전 공유): 기존 워크스페이스의 모든 누적 데이터와 RAG 메모리를 제약 없이 자유롭게 참조.

### 2.2. 백엔드 연동 및 API 확장 (Backend Integration)
프론트엔드 로컬 상태에만 의존하던 로직을 서버와 DB로 완전히 이관합니다.
- **REST API**: `POST /api/projects` 신설
  - Request: `{ name, description, isolationLevel }`
  - Response: 생성된 Project 객체
- **Database**: `projects` 테이블에 생성 요청 적재 및 고유 `id` 발급.
- **Real-time Sync**: 생성이 완료되면 `io.emit('project:created', projectData)` 소켓 이벤트를 방출하여 접속된 모든 대시보드의 상태를 동기화.

### 2.3. 자율 팀 빌딩 로직 (Autonomous Team Building)
단순한 데이터 생성을 넘어, Ari 엔진이 주도적으로 에이전트를 편성합니다.
1. **의도 분석**: 사용자가 입력한 `Objective`를 Ari(Gemini)가 분석하여 프로젝트에 요구되는 핵심 직무(Skill)를 도출합니다.
2. **인력 선발**: `agents.json`에 등록된 전체 에이전트 풀 중에서 가장 적합한 에이전트 1~3명을 자율적으로 선발합니다. (예: 개발 위주면 Luca/Sonnet, 기획이면 Prime 등)
3. **팀 구성(TF)**: 선발된 에이전트들을 해당 프로젝트 전담 팀으로 바인딩합니다 (`team_agents` 테이블 또는 프로젝트-에이전트 매핑 사용).
4. **온보딩 태스크 자동 생성**: 팀 빌딩이 완료되면 텅 빈 칸반 보드가 아닌, 선발된 에이전트들이 스스로 "프로젝트 초기 세팅 완료했습니다. 다음 지시를 내려주세요"라고 보고하는 형태의 첫 번째 카드를 자동 생성합니다.

---

## 3. 데이터 흐름 (Data Flow)

1. **[사용자]** 대시보드에서 `ProjectCreateModal` 오픈 후 내용 작성 및 제출.
2. **[클라이언트 API]** `POST /api/projects`로 데이터 전송.
3. **[Ari 엔진]** DB에 `projects` 레코드 삽입 후 즉시 비동기 `TeamBuilder` 파이프라인 트리거.
4. **[TeamBuilder]** `Objective` 텍스트 기반 LLM 분석 수행 → 에이전트 선발 → 매핑 테이블 저장.
5. **[Ari 엔진]** 첫 번째 온보딩 태스크 카드(To Do) 자동 생성.
6. **[웹소켓]** 클라이언트 측에 `project:created` 및 `task:created` 브로드캐스트.
7. **[클라이언트 UI]** 사이드바 목록 갱신 및 생성된 프로젝트 보드로 뷰(View) 전환.

---

## 4. 기대 효과 및 향후 과제
- **기대 효과**: 사용자는 프로젝트 이름과 목표만 던져주면 시스템이 알아서 최적의 인공지능 실무진을 꾸려주는 진정한 '자율 에이전트 생태계'를 체감할 수 있습니다.
- **향후 과제**: `ISOLATED` 모드 설정 시, 파일 뷰어(07_OUTPUT) 및 RAG 검색 파이프라인 단에서 해당 `projectId`를 기준으로 철저한 접근 제어(Access Control)가 이루어지도록 파일 시스템 및 벡터 DB 쿼리에 필터 로직을 추가해야 합니다.
