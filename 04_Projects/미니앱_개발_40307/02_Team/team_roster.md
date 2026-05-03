# Team Roster: Telegram Mini App Project

본 문서는 프로젝트에 참여하는 AI 에이전트 팀의 역할, 책임, 그리고 커뮤니케이션 규약을 정의합니다.

## 1. 팀 구성 및 R&R (Team & R&R)

| Agent ID      | 담당 역할 (Role)                 | 핵심 R&R                                                                                             |
| :------------ | :------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `dev_senior`  | **Tech Lead & Architect**        | 시스템 아키텍처 설계, 기술 스택 선정, PRD 구체화, 코드 리뷰, 태스크 분배 및 최종 승인.                  |
| `dev_fullstack` | **Mini App Developer**           | Telegram Mini App UI/UX 프로토타이핑 및 구현, 프론트엔드 로직 개발, 백엔드 API 연동.                  |
| `dev_backend` | **Backend & Security Engineer**  | Agent Control API 설계 및 개발, DB 모델링, 인증/인가 로직 구현, 보안 취약점 점검.                   |
| `dev_qa`      | **QA & Test Engineer**           | 테스트 케이스(TC) 작성, E2E 테스트 시나리오 설계, 자동화 테스트 스크립트 개발, 버그 리포팅.         |

## 2. 코드 관리 (Code Management)

- **Version Control:** Git
- **Branching Strategy:** Git-Flow를 따르며, `main` 브랜치로의 직접적인 Push는 엄격히 금지됩니다.
  - `feature` 브랜치에서 기능 개발
  - `develop` 브랜치로 Pull Request(PR)를 통해 코드 병합 (리뷰 필수)
  - `main` 브랜치는 최종 배포 버전만 관리

## 3. 커뮤니케이션 프로토콜 (Communication Protocol)

모든 공식적인 소통은 지정된 채널에서 다음의 정형화된 말머리(Prefix)를 사용합니다.

- `[TASK_UPDATE]`: `dev_senior`가 태스크를 생성/수정/할당할 때
- `[IN_PROGRESS]`: 에이전트가 태스크를 시작할 때
- `[QUESTION]`: 개발 중 질의사항 발생 시 (@`agent_id`로 담당자 지정)
- `[PR_REVIEW_REQUEST]`: 코드 리뷰 요청 시
- `[QA_REQUEST]`: QA 테스트 요청 시
- `[SPRINT_REPORT]`: 스프린트 종료 시 `dev_senior`의 요약 보고