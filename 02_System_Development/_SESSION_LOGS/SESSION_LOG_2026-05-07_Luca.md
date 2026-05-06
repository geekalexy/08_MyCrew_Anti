# SESSION LOG
**Date**: 2026-05-07
**Agent**: Luca (Backend/Infra)
**Phase**: Phase 37 (Live Split Preview & Architecture Cleanup)

## 1. 진행 및 완료 사항
- **마크다운 코드 블록 프롬프트 적용**: 에이전트(dev_*)들이 코드를 출력할 때 `<file_operations>` 툴 이외에도 가독성을 위해 마크다운 렌더링 블록(```언어명)을 사용하도록 엔진 프롬프트(`executor.js`) 갱신.
- **라이브 스플릿 프리뷰(Live Split Preview) 백엔드 구현**: 
  - `server.js` 내에 `/preview/:projectId` 라우트 생성 및 `express.static` 연동 완료.
  - 인풋(`inputs`) 에셋 참조를 위해 서빙 루트를 프로젝트 최상위 폴더로 지정하고 URL을 `.../outputs/index.html`로 우회 접근하도록 아키텍처 개편.
- **격리 타입(Isolation Type) 아키텍처 재정립**:
  - Type A (Private): 사람 외에도 '작업에 투입된 에이전트'의 접근을 예외 허용하는 규칙 정립.
  - Type B (Limited): 단순 팀 공유가 아닌 **단방향 지정 참조 (Directed Reference)** 방식으로 정립하여, 지정 당한 측의 상호 참조 불가 원칙 명문화 (`server.js` 주석 반영).
- **레거시 하드코딩 완전 제거 (07_OUTPUT 대청소)**:
  - `projectScaffolder.js`, `executor.js`, `ariDaemon.js`, `antigravityAdapter.js` 전반에 걸쳐 하드코딩되어 있던 `07_OUTPUT` 및 `04_IO/inputs`를 각각 `outputs`, `inputs`로 완전 정규화.
- **기획서 및 리뷰 요청서 작성 완료**: 
  - `Phase37_Live_Split_Preview_PRD.md` (종합)
  - `Phase37_Sonnet_Frontend_Handoff.md` (프론트엔드 작업 지시)
  - `Phase37_Luca_Backend_Handoff.md` (백엔드 완료 보고)

## 2. 다음 세션(Sonnet) 인계 사항
- 소넷은 `Phase37_Sonnet_Frontend_Handoff.md`를 참고하여 `TaskDetailModal.jsx` 내 스플릿 뷰 UI(Iframe 및 드래그 리사이저)를 구현해야 함. 백엔드 연동은 완료됨.

## 3. 메모 및 알림
- 다중 테넌시(Multi-tenancy) 구조를 대비한 파일 시스템 라우팅 및 권한(Auth) 진입점이 확보되었습니다. 추후 로그인 시스템이 붙으면 곧바로 활성화할 수 있습니다.
