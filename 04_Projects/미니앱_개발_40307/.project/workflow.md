# Work Process: Autonomous Sprint Workflow

본 팀은 사용자의 `/run '스프린트 목표'` 명령어 하나로 전체 스프린트를 자율적으로 수행합니다.

### Phase 1: 기획 및 설계 (Planning & Design)
1.  **Trigger:** 사용자의 `/run` 명령어 수신.
2.  `dev_senior`는 스프린트 목표를 분석하여 구체적인 PRD와 시스템 아키텍처를 설계합니다.
3.  설계에 기반하여 하위 태스크를 생성하고, 칸반 보드에 각 담당자에게 할당합니다. (`[TASK_UPDATE]`)

### Phase 2: 개발 및 동료 리뷰 (Development & Peer Review)
1.  `dev_fullstack`, `dev_backend`는 할당된 태스크를 인지하고 개발을 시작합니다. (`[IN_PROGRESS]`)
2.  개발 완료 후, `develop` 브랜치로 Pull Request(PR)를 생성합니다.
3.  PR 생성 시, `dev_senior`와 상호 개발자에게 자동으로 리뷰가 요청됩니다. (`[PR_REVIEW_REQUEST]`)
4.  리뷰어는 코드 품질, 아키텍처 부합성 등을 검토하고 승인(Approve)합니다.
5.  승인된 PR은 `develop` 브랜치에 자동으로 병합됩니다.

### Phase 3: 통합 및 품질 보증 (Integration & QA)
1.  `develop` 브랜치 병합 시, Staging 환경으로 자동 배포(CI/CD)가 실행됩니다.
2.  배포 성공 시, `dev_qa`에게 테스트가 자동으로 요청됩니다. (`[QA_REQUEST]`)
3.  `dev_qa`는 E2E 테스트 시나리오를 기반으로 시스템을 검증합니다.
4.  **버그 발견 시:** 버그 티켓을 생성하여 담당 개발자에게 할당합니다. 개발자는 Phase 2부터 다시 시작합니다.
5.  **테스트 통과 시:** QA 완료를 선언하고 `dev_senior`에게 최종 배포 승인을 요청합니다.

### Phase 4: 최종 승인 및 보고 (Final Approval & Report)
1.  `dev_senior`는 QA 결과를 최종 확인하고 Production 배포를 승인합니다.
2.  배포 완료 후, `dev_senior`는 이번 스프린트의 성과를 요약하여 보고합니다. (`[SPRINT_REPORT]`)
3.  하나의 스프린트 사이클이 종료됩니다.