# Phase 31: Autonomous Project Workspace Architecture (M-FDS Extension)

## 1. 기획 배경 및 개요 (Background & Overview)
기존 MyCrew 아키텍처는 데이터베이스(SQLite) 기반의 논리적 데이터 격리(Phase 29)를 달성했습니다. 이는 API로 동작하는 대화형 에이전트(아리, 피코 등)에게는 유효하지만, **물리적인 파일시스템을 읽고 쓰며 코딩과 기획을 수행하는 워크스페이스 에이전트(루카, 소넷 등)** 에게는 치명적인 한계가 있습니다. 
에이전트가 진입한 프로젝트가 무엇인지, 자신이 어떤 역할을 맡았는지 알 수 있는 물리적 '닻(Anchor)'이 없기 때문입니다.

본 기획은 **"Project as a Workspace(코드화된 워크스페이스로서의 프로젝트)"** 개념을 도입하여, Zero-Config 파이프라인 구동 시 물리적 폴더 트리를 스캐폴딩(Scaffolding)하고, 에이전트들의 두뇌(Memory)와 룰(Rule)을 파일 형태로 완벽히 격리하는 것을 목표로 합니다.

---

## 2. 고도화된 프로젝트 폴더 맵 (M-FDS Extension)

### 2.1. 프로젝트 루트 경로 (결정 사항: 옵션 A + C)
- **로컬 워크스페이스 직관성 보장 (옵션 A)**: `08_MyCrew_Anti/04_Projects/` 하위에 프로젝트들이 생성됩니다. 이를 위해 기존 `04_Dual-Model Insights_v1`은 `03_Reference_IP/` 하위로 편입됩니다.
- **환경변수 기반 유연성 (옵션 C)**: `.env` 파일에 `PROJECTS_ROOT_PATH` 변수를 선언하여, 개발/운영 서버 환경에 따라 물리적 저장 위치를 유연하게 맵핑합니다.

### 2.2. 폴더 트리 상세
새로운 프로젝트 생성 시 자동 스캐폴딩되는 폴더 맵입니다. 대표님의 코멘트를 반영하여 **메모리의 계층화**, **동적 룰 로딩**, **입출력(I/O) 파일 폴링**을 최적화했습니다.

```text
04_Projects/
└── 01_미니앱_개발_프로젝트/
    │
    ├── PROJECT.md              # ⭐️ [매 세션 자동 로드]
    │                           # 프로젝트의 가장 핵심적인 톤앤매너, 대원칙, 헌장
    │                           # 로컬 에이전트가 세션을 시작할 때 반드시 최우선으로 읽는 파일
    │
    ├── .project/               # ⚙️ [동적 컨텍스트 & 규칙 폴더] (숨김 폴더 처리로 시각적 피로도 감소)
    │   ├── context.md          # 프로젝트 상세 문맥 및 기반 지식
    │   └── rules/              # 토픽별 룰 폴더. 
    │       ├── code_style.md   # 전체를 다 읽지 않고, 필요할 때만 자연어로 빠르게 검색하여 
    │       └── design_guide.md # 동적으로 꺼내 쓰는 세부 규칙 모음
    │
    ├── 01_Memory/              # 🧠 [Auto Memory & 세션 누적 메모리]
    │   ├── user_memory.md      # 사용자와 상호작용으로 쌓인 취향, 피드백, 작업 방식으로 프로젝트 맥락 이해
    │   ├── project_memory.md   # 세션에서 지속적으로 쌓이는 프로젝트의 핵심 결정 사항 및 맥락
    │   ├── daily_session_logs/ # 🕒 [매일 자동 기록] 작업 종료 시 에이전트 전원의 활동/대화를 요약한 일일 세션 로그
    │   │   ├── 20260501_lucas_log.md
    │   │   └── 20260502_team_sync.md
    │   ├── acquired_experience/# 💾 [경험 백업 시스템] 실제 개발/기획 중 획득한 트러블슈팅, 버그 픽스, 깨달음을 영구 보존
    │   │   └── dev_troubleshooting.md
    │   ├── auto_memory/        # 백그라운드에서 자동 요약, 분류, 압축된 과거 로그 보관소
    │   └── trend_research/     # Nova 등 리서치 에이전트가 조사해 온 '프로젝트 스코프 한정' 외부 정보 메모리
    │
    ├── 02_Team/                # 👥 [멀티 페르소나 컨테이너]
    │   ├── team_roster.md      # 정예 멤버(최소 3인 권장)의 구성 및 통신 프로토콜
    │   ├── agent1_architect_persona.md # [agent_id]_[role]_persona.md 포맷 (초기 닉네임 없음)
    │   └── agent2_coder_persona.md     # 이후 사용자가 닉네임을 부여하면 폴더명/파일명 자동 업데이트
    │
    ├── 03_Skills/              # 🛠️ [프로젝트 특화 스킬 및 워크플로우]
    │   ├── repetitive_tasks.md # 반복 작업 절차 (예: 데일리 리포트, 빌드 배포 파이프라인)
    │   └── heavy_analysis.md   # 무거운 데이터 분석, 스크립트 실행 등 복잡한 워크플로우 분리 위임장
    │
    └── 04_IO/                  # 📥📤 [입출력(INPUT/OUTPUT) 및 파일 폴링]
        ├── inputs/             # 에이전트에게 제공되는 기초 자료, 원본 데이터, 기획안 초안
        └── outputs/            # 파일 폴링 어댑터를 통해 비동기로 생성된 최종 산출물 및 에셋 저장소
```

---

## 3. 핵심 메커니즘 (How it Works)

### 3.1. PROJECT.md 의 Mandatory Load
기존에는 수많은 룰을 한 파일에 몰아넣어 LLM의 토큰 낭비와 망각을 유도했습니다. 
이제 `PROJECT.md`에는 **절대 잊어서는 안 되는 최고 존엄의 톤앤매너와 원칙**만 간략히 적어둡니다. 에이전트가 프로젝트에 개입할 때 이 파일은 항상 자동 로드(Auto-load)됩니다.

### 3.2. .project/rules 의 동적 검색 (Lazy Loading)
세세한 코딩 규칙, 디자인 규칙, 마케팅 문구 규칙 등은 `.project/rules` 하위에 토픽별로 쪼개어 저장됩니다. 
에이전트는 작업 중 구체적인 가이드가 필요할 때만 RAG(검색)나 디렉토리 읽기 도구를 통해 특정 룰을 자연어로 찾아 읽습니다. 이를 통해 프롬프트 오버헤드를 대폭 줄입니다.

### 3.3. Memory의 자동 누적과 경험 백업 (Memory & Backup)
메모리는 단순 로그가 아닌 강력한 지식 자산으로 관리됩니다.
1. **User Memory**: 사용자와 상호작용으로 쌓인 취향, 피드백, 작업 방식으로 프로젝트 맥락을 깊이 이해하는 데 사용되는 초개인화 메모리.
2. **Daily Session Logs**: 매일 작업이 종료되면 스크립트(또는 시스템)가 하루 동안의 **모든 에이전트의 활동과 대화를 요약하여 `daily_session_logs/` 에 타임스탬프 파일로 자동 기록**합니다.
3. **Acquired Experience (경험 백업 시스템)**: 실제 개발 중 발생한 버그, 해결 과정, 새롭게 알게 된 아키텍처적 깨달음을 에이전트가 자율적으로 `acquired_experience/` 에 백업합니다. 이는 추후 다른 프로젝트에서도 꺼내어 쓸 수 있는 '시스템의 지혜'가 됩니다.
4. **Auto Memory & Research**: 오래된 일일 로그는 `auto_memory/` 로 이동하고, 리서치 전담 에이전트가 수집한 자료는 `trend_research/` 에 쌓입니다.

### 3.4. Input / Output 기반의 비동기 파일 폴링
기존 `07_OUTPUT`의 글로벌 폴더를 탈피하여, 프로젝트마다 독립된 `04_IO/` 구역을 가집니다.
대표님이 `inputs/` 에 기획서나 이미지를 던져두면, 파일 폴링 에이전트가 이를 감지하여 비동기로 분석하거나 무거운 작업을 처리한 뒤 `outputs/`에 결과물을 깔끔하게 떨어뜨립니다.

---

## 4. 단계별 구현 마일스톤 (Milestones)

* **Step 1 (Scaffolding Engine)**: `zeroConfigService.js`에 위 폴더 맵(`PROJECT.md`, `.project/`, `Memory`, `Team`, `Skills`, `IO`)을 생성하는 Node.js `fs` 스캐폴딩 로직 구현.
* **Step 2 (Prompt Expansion)**: Zero-Config LLM이 팀을 구성할 때, 단순 JSON 응답이 아닌 `PROJECT.md` 초안과 `[agent]_persona.md`까지 함께 작성해 내도록 프롬프트 튜닝.
* **Step 3 (Context Injection Sync)**: 아리(Ari) 등 API 에이전트가 글로벌 DB가 아닌 `PROJECT.md`와 `project_memory.md`를 최우선으로 읽도록 `ContextInjector` 및 `executor.js` 라우팅 변경.
* **Step 4 (Memory Digest & Lazy Load)**: 주기적으로 세션 로그를 읽어 `auto_memory/` 로 요약 압축하는 Watchdog 파이프라인 완성 및 에이전트의 `.project/rules` 동적 검색 스킬 부여.
