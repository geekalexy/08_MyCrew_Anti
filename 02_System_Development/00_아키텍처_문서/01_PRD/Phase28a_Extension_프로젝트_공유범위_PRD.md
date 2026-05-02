# Phase 28a Extension: 프로젝트 데이터 격리 및 공유 범위 설정 (PRD)

**문서 버전**: v1.0
**작성일**: 2026-05-02
**작성자**: Luca (System Architect)
**위치**: Phase 28a(격리 아키텍처)의 연장선이자 Phase 28b(Zero-Config)의 사전 필수 기반

---

## 1. 🎯 배경 및 목적

**배경**:
Phase 28a를 통해 소켓과 DB 레벨에서 완벽한 "물리적 프로젝트 격리"가 완료되었습니다. 그러나 실무 환경에서는 프로젝트 간 완전히 단절되기보다는, 공통 브랜드 에셋이나 과거 레퍼런스 프로젝트를 "참조"해야 하는 경우가 빈번합니다. Phase 28b(Zero-Config 자동 생성)로 넘어가기 전, 이러한 **공유 및 격리 수준(Scope)을 제어할 수 있는 인프라와 UI 패널**이 먼저 확립되어야 합니다.

**목적**:
사용자(CEO)가 프로젝트(워크스페이스) 설정 패널에서 해당 프로젝트의 데이터 접근 권한과 타 프로젝트 참조 허용 목록을 명시적으로 설정할 수 있도록 합니다. 이를 통해 에이전트들이 어떤 맥락(Context)을 공유받을지 통제하는 견고한 기반을 마련합니다.

---

## 2. 🧩 핵심 기능 요건

### 2.1. 프로젝트 설정 패널 UI (Project Panel Extension)
*   **기본 정보 항목 추가**: 기존 모달에 `프로젝트 타이틀(Title)` 및 `목적(Objective)` 입력 필드를 추가.
*   **위치 및 동작**: 대시보드의 "프로젝트 설정" 모달. 모달에서 타이틀, 목적, 공유 범위 설정을 모두 완료(저장)해야만 새 프로젝트가 생성되고, 해당 워크스페이스(Room)로 진입(열리도록)하는 UX 플로우.
*   **공유 범위 설정 항목 (Isolation & Sharing Scope)**:
    1.  `완전 격리 (Strict Isolation)`: 기본값. 다른 프로젝트의 데이터, 로그, 태스크를 전혀 참조하지 않는 독립된 보안 공간.
    2.  `글로벌 지식 공유 (Global Knowledge)`: 시스템 레벨의 공통 가이드라인 및 공용 메모리(예: `socian_brand_context.md`)에만 접근 허용.
    3.  `특정 프로젝트 참조 (Cross-Project Link)`: 기존에 생성된 타 프로젝트 목록 중 참조를 허용할 프로젝트를 체크박스 다중 선택(Select) 형태로 제공.

### 2.2. Backend & DB 마이그레이션
*   **DB 스키마 확장**: SQLite `projects` 테이블에 `isolation_scope` 컬럼(JSON 형식) 추가.
    ```json
    {
      "type": "cross_project_link",
      "shared_projects": ["proj-123", "proj-456"]
    }
    ```
*   **API 업데이트**:
    *   `PUT /api/projects/:id` - 프로젝트 설정 수정 엔드포인트에 `isolation_scope` (및 타이틀, 목적) 업데이트 로직 추가.
    *   에이전트가 컨텍스트를 수집할 때(FilePollingAdapter 등), 해당 프로젝트의 `isolation_scope`를 1순위로 조회하여 참조 가능한 프로젝트 ID 배열만 추출하는 검증 로직 추가.
*   **팀과 크루의 프로젝트 종속성 구조 (Project-Team-Agent Dependency)**:
    *   `Project 1 : N Team` 맵핑 구조 유지: 공통 프론트데스크 비서인 ARI(독립 에이전트)의 글로벌 처리를 고려하여, 프로젝트-팀 관계는 1:N으로 유지 가능하도록 설계. 공유 범위(Isolation Scope)는 이 프로젝트 내 소속된 팀/에이전트들이 타 프로젝트의 에셋에 접근 가능한지를 통제하는 핵심 룰(Rule)로 작용함.

### 2.3. Agent Context Middleware
*   현재 Ari Engine의 에이전트 워크플로우에 컨텍스트를 주입할 때, `isolation_scope.shared_projects` 배열에 포함된 타 프로젝트의 `log`나 `tasks` 중 공개된 데이터를 함께 Context Window에 주입하는 미들웨어 파이프라인 개설.

---

## 3. 🚀 구현 스프린트 계획

### Sprint 1: DB 마이그레이션 및 API 업데이트
*   [ ] `projects` 테이블에 `isolation_scope` JSON 컬럼 추가.
*   [ ] 프로젝트 조회 및 수정 API에 해당 필드 반영.

### Sprint 2: 프론트엔드 프로젝트 패널 UI 반영
*   [ ] 프론트엔드 프로젝트 설정(Setting) 모달에 3가지 라디오 버튼 및 의존성 프로젝트 다중 선택(Select) UI 추가.
*   [ ] 변경 사항 Backend 연동.

### Sprint 3: 에이전트 컨텍스트 미들웨어 개조
*   [ ] 에이전트(아리 엔진)가 태스크 실행 전 컨텍스트를 수집할 때, 허용된 `shared_projects`의 특정 지식(예: 완료된 태스크 내용 등)을 함께 긁어오는 보안 뷰어(Security Viewer) 로직 연동.
*   [ ] 해당 스프린트 완료 후 **Phase 28b (Zero-Config 빌딩)** 단계로 안전하게 이행.
