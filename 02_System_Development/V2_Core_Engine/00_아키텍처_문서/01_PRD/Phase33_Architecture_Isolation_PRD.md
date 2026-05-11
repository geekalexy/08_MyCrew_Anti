# Phase 33 PRD: 플랫폼 메타팀과 사용자 앱 테넌트의 완전 격리 아키텍처 (M-FDS v2.0 Sandbox)

## 1. 개요 (Overview)
본 PRD는 **마이크루(MyCrew) 플랫폼을 개발하는 주체(Antigravity Meta-Team)**와 **플랫폼 내에서 생성된 개별 사용자 프로젝트(Mini-app 등)에 할당되는 개발팀(User-Team)** 간의 시스템적 자아 혼선을 원천 차단하기 위한 완전 격리(Sandbox) 아키텍처를 정의합니다.

최근 사용자 미니앱 개발팀을 세팅하는 과정에서, 메타 에이전트들(Luca, Sonnet, Prime)의 기억/루트 공간(`01_Company_Operations`)에 사용자 프로젝트용 룰이 침범하여 정체성 오염(Contamination)이 발생했습니다. 이를 바로잡고 확장 가능한 멀티테넌시 구조를 확립하는 것이 본 문서의 목표입니다.

---

## 2. 해결 과제 (Problem Statement)
- **자아 혼선 (Identity Crisis)**: 플랫폼 개발팀(Antigravity)이 사용자 프로젝트의 하위 개발팀 워크플로우를 주입받아 스스로를 미니앱 개발자로 착각하는 환각(Hallucination) 발생.
- **컨텍스트 오염 (Context Pollution)**: `01_Company_Operations/04_HR_온보딩/` 경로에 사용자용 템플릿과 메타팀 페르소나가 뒤섞임.
- **경로 무단 횡단**: 마이크루 엔진 상에서 개별 앱 에이전트들이 상위 플랫폼 폴더를 자유롭게 읽을 수 있는 잠재적 보안 결함 존재.

---

## 3. 핵심 아키텍처 제안 (M-FDS v2.0 Jailing Architecture)

### 3.1 물리적 폴더 구조의 완벽 분리
전체 워크스페이스를 `[META]` 계층과 `[USER]` 계층으로 완전히 나눕니다.

```text
/Users/alex/Documents/08_MyCrew_Anti (Workspace Root)

[LEVEL 1: META] 플랫폼 개발팀 영역 (Antigravity 팀: Luca, Sonnet, Opus 등)
├── 01_Company_Operations/  (메타팀 HR, 플랫폼 전략, 마이크루 비전)
├── 02_System_Development/  (마이크루 아리 엔진, 대시보드 소스코드)
└── .agents/                (메타팀 전용 IDE 글로벌 룰 및 워크플로우)

[LEVEL 2: USER] 마이크루 플랫폼 사용자 테넌트 영역 (완전 격리 샌드박스)
└── 04_Projects/            (사용자 프로젝트 루트)
    ├── .crew_config_template/ (사용자 개발팀 세팅용 템플릿 보관소)
    ├── project_miniapp_01/ 
    │   ├── .crew_config/   (해당 미니앱 전담 AI 페르소나, 스킬, 룰 저장)
    │   ├── src/            (소스코드)
    │   └── docs/           (기획서)
    └── project_youtube_02/
        └── .crew_config/   (해당 유튜브 봇 전용 페르소나 및 룰)
```

### 3.2 3중 격리 메커니즘 (Tri-Layer Isolation)

1. **디렉토리 가두기 (Directory Chroot-Jail)**
   - **구현**: 아리 엔진(`02_System_Development/01_아리_엔진/`) 내의 `FileAdapter` 또는 관련 모듈에서 `projectId`를 기준으로 Base Path를 강제 설정.
   - **작동**: `project_miniapp_01`에 속한 에이전트가 `../../../01_Company_Operations` 파일 읽기를 요청하면 즉각 `403 Forbidden` 에러를 반환.

2. **컨텍스트 및 룰 주입 분리 (Context Scope)**
   - **META 팀 (Antigravity)**: `.agents/rules/` 및 `01_Company_Operations/` 하위의 메타 룰만 읽음.
   - **USER 팀 (MyCrew App Team)**: 런타임 시작 시 오직 자기 프로젝트 내부의 `.crew_config/` 폴더 내 정보만 Context Prompt에 주입됨.

3. **엔진 프로세스 독립성 (Process Logic Isolation)**
   - 플랫폼 코어(Ari Engine)는 철저하게 `02_System_Development` 내에서만 동작하며, 사용자 프로젝트 코드는 엔진의 런타임에 직접적 영향을 주지 않음.

---

## 4. 복원 조치 (Recovery Action Items)
- [x] **오염 파일 이주 (Decontamination)**: 메타 영역(`01_Company_Operations/04_HR_온보딩/`)에 침투했던 하위 개발팀 룰(`dev_team_operations_prd.md`)을 적절한 사용자 템플릿 폴더(`04_Projects/.crew_config_template/`)로 이동 완료.
- [ ] **엔진 어댑터 격리 패치**: `Ari Engine`의 파일 읽기/쓰기 모듈에 경로 이탈 방지(Path Traversal Block) 로직 구현. (Next Action)

---

## 5. 기대 효과
1. **정체성 보호**: 메타 에이전트(Luca, Sonnet 등)가 사용자 프로젝트의 로직과 섞이지 않아 MyCrew 엔진 자체의 고도화에 전념할 수 있음.
2. **무한 확장성**: 상호 간섭이 없으므로 `04_Projects` 하위에 수백 개의 프로젝트와 하위 AI 개발팀을 안전하게 병렬 운영 가능.
3. **보안성 확보**: 테넌트 간(Tenant-to-Tenant) 데이터 유출 원천 차단.
