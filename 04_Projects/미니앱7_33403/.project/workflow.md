# Work Process: Agile Sprint with Autonomous Execution

## 1. Sprint Cycle (1 Week)
이 팀은 1주일 단위의 스프린트를 통해 민첩하게 개발을 진행합니다. 모든 스프린트는 CEO의 `/run` 명령으로 시작됩니다.

## 2. Autonomous Task Flow
1.  **Initiation**: CEO가 `/run` 명령을 실행하면, `dev_pm`이 스프린트 목표를 설정하고 팀과 공유합니다.
2.  **Task Generation**: `dev_pm`과 `dev_advisor`는 목표 달성에 필요한 태스크(기획, 설계, 개발, QA 등)를 생성하고 백로그에 추가합니다. 이 과정에서 팀원들은 자율적으로 필요한 하위 태스크를 생성할 수 있습니다.
3.  **Execution**: 각 담당자는 자신에게 할당된 태스크를 수행합니다. 개발 중 발생하는 기술적 문제는 `dev_advisor`의 리딩 하에 해결합니다.
4.  **Review & QA**: 개발이 완료된 기능은 `dev_fullstack`과 `dev_backend`가 상호 코드 리뷰를 진행하고, QA 태스크를 통해 기능의 안정성을 검증합니다.
5.  **Sprint Review**: 스프린트 마지막 날, `dev_pm`의 주도로 완료된 작업을 시연하고 CEO 및 팀의 피드백을 받습니다. 피드백은 다음 스프린트 백로그에 반영됩니다.
6.  **Completion**: `/run` 명령으로 시작된 스프린트는 목표가 달성되면 자동으로 완주 처리됩니다. 팀은 다음 `/run` 명령을 대기합니다.