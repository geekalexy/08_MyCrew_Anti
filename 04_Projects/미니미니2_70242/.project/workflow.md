# Work Process: 미니미니2

## Sprint-based Autonomous Workflow

본 프로젝트는 1주일 단위의 스프린트로 운영되며, `/run` 명령을 통해 자율적으로 완주하는 것을 목표로 합니다.

### 1. 스프린트 시작 (`/run`)
- **입력**: `/run "이번 주 목표는 미니앱 기본 UI 구현과 에이전트 상태 조회 API 연동입니다."`
- **동작**: `assistant`가 `/run` 명령의 목표를 해석하여 칸반 보드의 'To Do' 목록에 핵심 태스크들을 생성하고 담당자를 1차 배정합니다.

### 2. 태스크 수행 (Task Execution)
- 각 담당자는 'To Do' 목록에서 자신의 태스크를 'In Progress'로 이동시키고 작업을 시작합니다.
- `dev_ux`가 UI 디자인을 Figma로 공유하면, `dev_fullstack`이 이를 기반으로 프론트엔드 코딩을 진행합니다.
- `dev_fullstack`은 백엔드 API 개발 시 `dev_advisor`에게 아키텍처 관련 질의를 통해 방향을 명확히 합니다. (`@dev_advisor API 보안 정책에 대해 조언 부탁드립니다.`)

### 3. 코드 리뷰 및 통합 (Review & Merge)
- `dev_fullstack`이 기능 개발을 완료하면, Pull Request(PR)를 생성하고 `@dev_advisor`에게 리뷰를 요청합니다.
- `dev_advisor`는 코드의 품질, 구조, 확장성을 검토하고 피드백을 남깁니다.
- 수정 및 승인(Approve)이 완료되면, 코드는 메인 브랜치에 병합(Merge)됩니다.

### 4. 테스트 및 검증 (QA & Validation)
- 코드가 병합되면, `dev_qa`는 'In Progress' 상태의 관련 테스트 태스크를 맡아 QA 서버에서 테스트를 수행합니다.
- `dev_qa`는 기능적 요구사항, UI 일관성, 그리고 `strict_isolation` 데이터 격리 정책이 준수되었는지 집중적으로 검증합니다.
- 버그 발견 시, 상세한 재현 경로와 함께 이슈를 등록하고 `@dev_fullstack`에게 알립니다.

### 5. 스프린트 완료
- 모든 태스크가 'Done' 상태로 이동하면 스프린트가 완료됩니다.
- `assistant`는 완료된 작업을 바탕으로 주간 진행 보고서를 자동 생성하고 다음 스프린트 계획의 기반으로 삼습니다.