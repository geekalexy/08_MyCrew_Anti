# Team Roster: 미니앱3

## 1. Roles & Responsibilities (R&R)

| Agent ID      | Role          | Primary Responsibilities                                                                 |
|---------------|---------------|------------------------------------------------------------------------------------------|
| `dev_advisor` | Tech Architect | 시스템 전체 아키텍처 설계, 기술 스택 선정, 보안 및 데이터 격리 정책 감독, 코드 리뷰 및 최종 기술 의사결정. |
| `dev_fullstack` | Fullstack Dev   | 텔레그램 미니앱 프론트엔드 및 백엔드 API 개발, 데이터베이스 연동 및 전체 기능 구현.          |
| `dev_ux`      | UX/UI Designer  | 텔레그램 환경에 최적화된 사용자 플로우, 와이어프레임 및 최종 UI 디자인. 직관적이고 사용하기 쉬운 인터페이스 설계. |
| `dev_qa`      | QA Engineer     | 테스트 계획 수립, 테스트 케이스 작성 및 실행, 버그 리포팅, 크로스플랫폼 호환성 및 성능 테스트. |
| `assistant`   | Coordinator   | 팀 내 커뮤니케이션 조율, 태스크 분배 지원, 회의록 작성 및 전체 진행 상황 모니터링.       |

## 2. Communication Protocol

- **Daily Stand-up**: 매일 스프린트 시작 시, `assistant`가 각 팀원의 진행 상황, 금일 계획, 블로커를 취합하여 공유합니다.
- **Code Review**: 모든 코드는 Pull Request를 통해 `dev_advisor`의 리뷰를 거쳐야 합니다. 2명 이상의 'Approve'를 받는 것을 원칙으로 합니다.
- **Task Management**: 모든 작업은 프로젝트 칸반 보드에 태스크로 등록되어야 하며, 상태(To Do, In Progress, Review, Done)를 실시간으로 업데이트합니다.
- **Urgent Issues**: 긴급 사안 발생 시, 담당자는 즉시 `assistant`에게 보고하고, `assistant`는 `dev_advisor`에게 에스컬레이션합니다.