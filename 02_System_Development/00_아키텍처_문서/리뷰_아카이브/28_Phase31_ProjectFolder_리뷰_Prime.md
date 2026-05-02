# Phase 31 Project Folder Architecture - Prime Review

**등급**: 🟢 A — 전면 승인.

## 핵심 요약
이 기획은 MyCrew 격리 아키텍처의 마지막 퍼즐입니다:
Phase 28a: DB 격리 → Phase 29: 인지적 격리 → Phase 31: 물리적 폴더 격리 = 완전 격리 완성

## 3가지 질의 답변
1. **Context Window 방어**: ✅ Lazy Loading 올바름. PROJECT.md에 읽기 순서 규약(L1~L5) 명시하여 에이전트가 daily_session_logs/ 전체 읽기 방지
2. **Naming Convention**: ✅ 안정적. 에이전트 ID가 단일 단어이므로 첫 번째 언더스코어 분할로 충분
3. **Missing Puzzles**: 🟡 2건 발견 (아래 참조)

## 발견된 보강 사항 2건
- **🟡 #1: zeroConfigService.js에 폴더 스캐폴딩 코드가 없다**
현재 DB INSERT만 수행. `projectScaffolder.js` 독립 모듈 신설하여 `fs.mkdir` + `PROJECT.md` 초안 + 팀 페르소나 파일 자동 생성 필요.
- **🟡 #2: 04_Projects 폴더 번호 충돌**
워크스페이스 루트에 `04_Dual-Model Insights_v1`이 이미 존재합니다. 기존 폴더를 `03_Reference_IP/` 하위로 이동하고 `04_Projects/`를 신설하는 것을 권고합니다.

## 특별 평가
`acquired_experience/`(경험 백업 시스템)은 MyCrew의 킬러 피처입니다. 프로젝트가 종료되어도 에이전트의 숙련도가 초기화되지 않는 구조 — 경쟁사 대비 명확한 차별화 포인트.

---

### [소넷 보충 의견]
**핵심 포인트 3가지**
1. **zeroConfigService.js 현재 상태**: 코드를 보면 DB INSERT만 수행하고 있고, fs.mkdir 계열 코드가 전혀 없습니다. 즉 Phase31 폴더 스캐폴딩은 아직 미구현 상태이며, 구현이 필요합니다.
2. **04_Dual-Model Insights_v1 충돌 지적**: `04_Projects/`가 생성될 실제 루트 경로가 기획서에 명시되지 않아 워크스페이스 루트 기준으로 충돌이 발생합니다.
3. **해결해야 할 실제 질문**: `04_Projects/`는 어디에 생성됩니까?
   - **옵션 A**: 개발 워크스페이스 루트 (`08_MyCrew_Anti/04_Projects/`) - 기존 폴더 이동 필요
   - **옵션 B**: 엔진 서버 내 별도 경로 (`01_아리_엔진/projects/`) - 기존 구조 무관
   - **옵션 C**: 설정값(`.env` 등) - 유연함
