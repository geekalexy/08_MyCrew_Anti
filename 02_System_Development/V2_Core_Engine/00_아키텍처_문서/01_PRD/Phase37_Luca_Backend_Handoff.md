# [리뷰 요청서] 라이브 스플릿 프리뷰 - 백엔드 파트 (by. Luca)

**To**: CEO (대표님) & Prime (아키텍처 리뷰어)
**From**: Luca (백엔드/인프라 담당)
**작업 내용**: 라이브 스플릿 프리뷰(Live Split Preview)를 위한 백엔드 라우팅 및 폴더 구조 정규화 작업 완료 보고 및 리뷰 요청

---

## 1. 백엔드 주요 변경 사항 (작업 완료)

### 1.1. 정적 파일 서빙 라우트 신설 (`server.js`)
프론트엔드 Iframe에서 프로젝트 결과물을 즉시 확인할 수 있도록 동적 라우팅을 뚫었습니다.
- **경로**: `/preview/:projectId`
- **구현 로직**: 
  - `projectId`로 DB를 조회하여 물리적 디스크 폴더(`projectRoot`) 매핑.
  - `express.static(projectRoot)`를 통해 폴더 접근 개방.
  - (보안 이슈 해결): 아웃풋 폴더만 열면 인풋 폴더(이미지 등)를 못 부르는 현상을 방지하기 위해, 프로젝트 루트 레벨에서 개방하고 프론트엔드가 `outputs/index.html`로 찌르도록 우회 설계.

### 1.2. 프로젝트 격리(Isolation) 아키텍처 주석 반영 (`server.js`)
Phase 29 기획에 맞춰 다중 테넌시(Multi-tenancy) 방어 로직의 뼈대를 구축했습니다.
- **Type A (Private)**: 소유자/초대멤버 + **작업 투입된 에이전트 허용** 예외 룰 정의.
- **Type B (Limited)**: **단방향 지정 참조 (Directed Reference)** 룰 적용. (A가 B를 참조 가능하나 B는 불가. 상호 지정 시 양방향 허용)
- **Type C (Public)**: 사내 전사 공개.

### 1.3. 폴더 구조 대대적 클린업 (Legacy Hardcoding 제거)
대표님의 지적에 따라 의미 없던 `07_OUTPUT` 및 `04_IO/inputs` 접두사를 모두 표준화했습니다.
- **대상 파일**: `projectScaffolder.js`, `executor.js`, `ariDaemon.js`, `antigravityAdapter.js`
- **변경 사항**: 
  - `07_OUTPUT` ➡️ `outputs`
  - `04_IO/inputs` ➡️ `inputs`
  - 엔진 파서 로직 및 에이전트 시스템 프롬프트(System Prompt)까지 모두 갱신 완료.

---

## 2. 파일 접근 보안 (Security) 
- Path Traversal(`../` 등)을 이용해 프로젝트 폴더 바깥으로 탈출하려는 에이전트나 유저의 시도는 `executor.js` 내부의 경로 탈출 방어 로직(`absolutePath.startsWith(projectRoot)`)에 의해 원천 차단됩니다.
- 추가 Auth 미들웨어(Company ID 검증)는 SaaS 배포 전 최종 검수 단계에서 활성화할 수 있도록 진입점을 마련했습니다.

---

**리뷰 요청 사항**:
위 백엔드 작업 내역 중 보안이나 확장성 측면에서 구조적으로 막히는 부분이 있을지 대표님(또는 Prime)의 검토를 요청합니다. 이상이 없다면 프론트엔드(소넷)가 이 API를 활용하여 UI를 얹도록 승인 부탁드립니다.
