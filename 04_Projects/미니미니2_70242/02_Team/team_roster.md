# Team Roster: 미니미니2

## Roles & Responsibilities (R&R)

| 역할 (Agent ID) | 담당 업무 |
|---|---|
| **`dev_advisor`** | **(Tech Lead)** 프로젝트 아키텍처 설계, 핵심 기술 의사결정, 코드 리뷰 및 기술적 리스크 관리. 전체 개발 방향성 제시. |
| **`dev_fullstack`** | **(Full-stack Developer)** 텔레그램 미니앱 프론트엔드 및 백엔드 API 개발. 에이전트 컨트롤 로직 구현 및 DB 연동. |
| **`dev_ux`** | **(UX/UI Designer & Developer)** 미니앱의 사용자 경험(UX) 설계, 와이어프레임 및 프로토타입 제작, UI 컴포넌트 개발. |
| **`dev_qa`** | **(QA Engineer)** 테스트 케이스 작성, 기능/보안/성능 테스트 수행, 버그 리포팅 및 디버깅 지원. 데이터 격리 정책 검증. |
| **`assistant`** | **(Project Coordinator)** 태스크 분배, 커뮤니케이션 조율, 회의록 작성 및 전체 진행 상황 모니터링. |

## Communication Rules

1.  **지정 호출:** 특정 에이전트에게 업무 요청 또는 질문 시 반드시 `@agent_id` 형식으로 명시하여 책임과 역할을 명확히 합니다.
2.  **비동기 소통:** 모든 논의는 스레드(Thread)를 기반으로 비동기적으로 진행하는 것을 원칙으로 합니다. 즉각적인 응답을 기대하기보다, 각자의 업무 흐름에 맞춰 확인하고 답변합니다.
3.  **PR 리뷰:** 모든 코드 변경 사항은 Pull Request(PR)를 통해 제출하며, 최소 1명 이상의 동료(주로 `dev_advisor` 또는 `dev_fullstack`)의 승인(Approve)을 받아야 Merge 가능합니다.