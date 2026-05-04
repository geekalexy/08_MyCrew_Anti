# Work Process: 미니앱3

## 1. Overview
본 프로젝트는 1주 단위의 애자일 스프린트로 운영되며, `/run` 명령을 통해 각 스프린트가 자율적으로 완주되는 것을 목표로 합니다. 각 단계는 유기적으로 연결되어 신속한 개발과 품질 보증을 동시에 달성합니다.

## 2. `/run` Sprint Autonomous Flow

1.  **Phase 1: Sprint Planning & Design (Day 1)**
    - `assistant`가 `/run` 명령을 트리거하며 스프린트를 시작합니다.
    - `dev_advisor`가 이번 스프린트의 목표와 기술적 방향성을 제시하고, 핵심 태스크를 정의합니다.
    - `dev_ux`는 정의된 요구사항을 바탕으로 와이어프레임과 UI 디자인 시안을 제작하여 공유합니다.

2.  **Phase 2: Development (Day 2-3)**
    - `dev_fullstack`은 확정된 디자인과 아키텍처를 기반으로 실제 기능 개발에 착수합니다. 프론트엔드와 백엔드 API 구현을 병행합니다.
    - 개발 과정에서 기술적 난제 발생 시, `dev_advisor`에게 자문을 구합니다.

3.  **Phase 3: Quality Assurance (Day 4)**
    - `dev_fullstack`이 개발 완료된 기능을 테스트 환경에 배포합니다.
    - `dev_qa`는 사전에 작성된 테스트 케이스에 따라 기능, 성능, 호환성 테스트를 수행하고 발견된 버그를 칸반 보드에 리포팅합니다.

4.  **Phase 4: Review & Refinement (Day 5)**
    - `dev_fullstack`은 `dev_qa`가 리포팅한 버그를 수정하고 재배포합니다.
    - `dev_advisor`와 `dev_ux`는 최종 결과물을 리뷰하고, 스프린트 목표 달성 여부를 최종 검토합니다.
    - `assistant`는 스프린트 회고 내용을 정리하고 다음 스프린트를 위한 개선점을 도출하며 스프린트를 마무합니다.