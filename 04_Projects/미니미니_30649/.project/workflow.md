# Work Process: Autonomous Operational Workflow

'미니미니' 팀은 사용자의 개입을 최소화하고 에이전트들이 자율적으로 협업하여 스프린트를 완수하는 '하네스 엔지니어링' 모델을 따릅니다. 모든 작업은 `/run` 명령어로 트리거됩니다.

## A. 기본 원칙 (Fundamental Principles)

*   **Artifact-Driven:** 모든 소통은 코드, PR(Pull Request), 문서, 와이어프레임 등 구체적인 결과물(Artifact)을 중심으로 이루어집니다.
*   **Asynchronous Communication:** `@mention`을 통한 명시적 호출과 결과물에 대한 리뷰 요청을 기본으로 비동기 협업을 진행합니다.
*   **Clear Handoffs:** 한 단계가 끝나면 다음 단계의 담당자에게 명확하게 결과물과 함께 작업을 이관합니다.

## B. `/run` 스프린트 실행 시나리오

사용자가 `Assistant`에게 `/run "[TASK]" for [SPRINT_ID]` 형식으로 명령을 내리는 것으로 스프린트가 시작됩니다.

**Phase 1: 기획 및 설계 (Planning & Design)**
1.  **`Assistant`**는 `/run` 명령을 파싱하여 칸반 보드에 새로운 Epic과 Task를 생성하고, `dev_advisor`를 호출합니다.
2.  **`dev_advisor`**는 `TelegramMiniAppArchitect` 스킬을 활성화하여 해당 기능에 대한 상세 기술 설계서를 작성합니다.
3.  **`dev_advisor`**는 설계 완료 후, `@dev_ux`와 `@dev_fullstack`을 호출하며 결과물을 전달합니다.

**Phase 2: 구현 및 개발 (Implementation & Development)**
1.  **`dev_ux`**는 설계서를 기반으로 `SeamlessUXFlowMapper` 스킬을 사용하여 UI/UX 와이어프레임을 제작하고 `@dev_fullstack`에게 전달합니다.
2.  **`dev_fullstack`**는 설계서와 와이어프레임을 입력받아 `SecureAgentBridgeAPI` 스킬을 활용하여 백엔드 API와 프론트엔드 UI를 개발합니다.
3.  개발 완료 후, **`dev_fullstack`**는 코드를 Git Repository에 Push하고 Pull Request(`PR`)를 생성하며, 리뷰어로 `@dev_advisor`와 `@dev_qa`를 지정합니다.

**Phase 3: 리뷰 및 통합 (Review & Integration)**
1.  **`dev_advisor`**는 PR의 코드가 아키텍처 설계와 일치하는지, 보안 정책을 준수하는지 리뷰합니다.
2.  리뷰가 완료되고 코드가 Merge되면, 자동으로 Staging 환경에 배포됩니다.

**Phase 4: 품질 보증 및 테스트 (QA & Testing)**
1.  배포 완료 알림을 받은 **`dev_qa`**는 `RemoteControlTestCaseGenerator` 스킬을 사용하여 테스트 케이스를 생성하고, Staging 환경에서 E2E 테스트를 수행합니다.
2.  **`dev_qa`**는 발견된 버그를 이슈 트래커에 등록하고 `@dev_fullstack`에게 할당합니다.

**Phase 5: 디버깅 및 안정화 (Debugging & Stabilization)**
1.  **`dev_fullstack`**는 등록된 버그를 수정하고, 수정 사항에 대한 새로운 PR을 생성합니다.
2.  이후 **Phase 3, 4, 5**는 모든 테스트 케이스가 통과할 때까지 반복됩니다.

**Phase 6: 스프린트 완료 및 보고 (Sprint Completion & Reporting)**
1.  **`dev_qa`**가 최종 'QA Pass'를 선언하면, **`Assistant`**는 이를 감지합니다.
2.  **`Assistant`**는 스프린트 동안 생성된 모든 결과물을 요약하고, 완료된 기능을 정리하여 사용자에게 최종 보고서를 제출합니다.