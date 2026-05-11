# Phase 28: 프로젝트 독립 환경 및 패널 연동 개발 스프린트 계획서

이 문서는 `Phase28_프로젝트_패널_연동_아키텍처.md` 및 `Phase28_프로젝트_영향도_분석.md` PRD를 기반으로, 실제 개발을 수행하기 위한 태스크 리스트를 스프린트와 우선순위에 따라 나눈 실행 계획서입니다.

---

## 🏃‍♂️ Sprint 1: DB & 백엔드 코어 인프라 격리
**목표**: 프로젝트 간 데이터 간섭을 물리적으로 차단하고, 소켓 통신을 다중 채널로 분리합니다.
**우선순위**: P0 (가장 먼저 수행되어야 할 병목 태스크)

*   [ ] **Task 1.1 [DB] Schema Migration & Soft Delete**
    *   `Task`, `Log`, `teams`, `TaskComment` 테이블에 `project_id` 및 `deleted_at` 컬럼 추가.
    *   휴지통 기능 및 30일 만료 시 영구 삭제(CASCADE)를 위한 CRON 워커 설정.
*   [ ] **Task 1.2 [DB] 익명 역할 기반 에이전트 스키마 재설계**
    *   기존 고정 이름 기반의 에이전트 테이블을 폐기하고, `[project_id, role_name, base_model, nickname]` 복합 객체 형태로 설계 변경.
*   [ ] **Task 1.3 [Backend] Socket.IO Room 멀티플렉싱 도입**
    *   기존 글로벌 브로드캐스트(`io.emit`)를 제거하고, 클라이언트에서 `project:join` 이벤트 수신 시 `io.to(\`project_\${id}\`)`로만 송출되도록 소켓 라우팅 전면 개편.
*   [ ] **Task 1.4 [API] 엔드포인트 필터링 강제화**
    *   모든 리소스 페치 및 생성 API(`GET /api/tasks`, `POST /api/logs` 등)에 `projectId` 쿼리 파라미터를 필수화.

---

## 🏃‍♂️ Sprint 2: 메인 대시보드 및 패널 UI 연동
**목표**: 사용자가 워크스페이스에서 프로젝트를 자유롭게 넘나들고, 화면의 모든 요소가 즉각 동기화되게 만듭니다.
**우선순위**: P1

*   [ ] **Task 2.1 [Store] Zustand `projectStore` 구축**
    *   `activeProjectId` 상태 관리 및 변경 시 Socket 재조인, API Re-fetch 동시 트리거 로직 구현.
*   [ ] **Task 2.2 [UI] LNB(좌측 사이드바) 프로젝트 스위처 구현**
    *   활성화된 프로젝트 목록 및 '역할명_모델명(예: 카피라이터_Sonnet 4.6)' 기반의 크루 리스트 렌더링.
*   [ ] **Task 2.3 [UI] 칸반 보드 및 우측 패널 동기화**
    *   `activeProjectId`에 따라 중앙 태스크 보드 및 우측 타임라인/채팅 데이터 Hydration.
    *   프로젝트 미선택 시 Empty State UI 제공.
*   [ ] **Task 2.4 [Backend] 글로벌 알림(2-Track) 연결**
    *   사용자가 A 프로젝트에 있어도 B 프로젝트의 딥워크 완료 알림을 받을 수 있도록 글로벌 뱃지 알림 소켓 연결.

---

## 🏃‍♂️ Sprint 3: Zero-Config 자율 팀 빌딩 & 텔레그램 연동
**목표**: 최소한의 입력으로 AI가 스스로 팀을 구성하고, 텔레그램을 메인 소통 채널로 통합합니다.
**우선순위**: P1

*   [ ] **Task 3.1 [UI/Backend] Zero-Config 프로젝트 생성 플로우**
    *   "프로젝트명" + "목적" 입력 UI 제공.
    *   입력 데이터를 Claude Opus로 전송하여 필요한 팀 구성(역할명, 모델)을 반환받는 브릿지 API 구축.
*   [ ] **Task 3.2 [AI] Ari 대화형 온보딩(Interactive Filling)**
    *   Opus가 분석한 누락 스킬/룰셋을 기반으로 Ari가 사용자에게 자연스럽게 채팅을 걸고, 피드백을 수집하여 초기 24시간 내 룰(Draft)을 세팅하는 프롬프트 체인.
*   [ ] **Task 3.3 [Telegram] 마스터 비서 기반 라우팅**
    *   텔레그램 인라인 키보드(버튼) 또는 Ari의 문맥 파싱을 통해 텔레그램 메시지가 알맞은 `project_id` 채팅방으로 인서트 되도록 라우터 구현.

---

## 🏃‍♂️ Sprint 4: 지식 격리(Namespace) 및 자가 진화(Evolution)
**목표**: 프로젝트별 지식을 안전하게 분리하고, 장기 운영 시 AI가 스스로 워크플로우를 진화시키도록 합니다.
**우선순위**: P2

*   [ ] **Task 4.1 [AI] `SKILL.md` 가상화 및 권한 제어**
    *   글로벌 지식과 프로젝트별 지식을 분리하는 네임스페이스 도입.
    *   M-FDS 파일 접근 시 에이전트의 `project_id` 기반 권한 체킹(Access Control).
*   [ ] **Task 4.2 [AI] 지속적 진화(Continuous Evolution) 파이프라인**
    *   작업 지연(Stall), 잦은 수정 지시 로그 수집 체계 구축.
    *   수집된 패턴을 분석하여 프로젝트 메모리에 '금지 룰'을 업데이트하고 워크플로우를 스스로 재조정하는 `executor.js` 심화 로직 반영.

---

## 🏃‍♂️ Sprint 5: 관리 및 모니터링 (Metrics & Ops)
**목표**: 멀티 프로젝트 환경에서의 평가, 모니터링, 복구를 지원합니다.
**우선순위**: P3

*   [ ] **Task 5.1 [UI] 휴지통(Trash Bin) 관리자 UI**
    *   30일 내 삭제된 프로젝트 리스트 표출 및 원클릭 복원(Restore) API 연동.
*   [ ] **Task 5.2 [UI/DB] 다차원 평가 지표(CKS Metrics)**
    *   에이전트 프로필 페이지에서 TEI, KSI 지표를 프로젝트별로 GROUP BY 하여 렌더링하는 그래프 개선.
*   [ ] **Task 5.3 [Ops] 프로젝트별 Token Billing 집계**
    *   어떤 프로젝트가 모델 API 비용을 얼마나 소진하는지 추적하는 리소스 모니터링 대시보드 추가.
