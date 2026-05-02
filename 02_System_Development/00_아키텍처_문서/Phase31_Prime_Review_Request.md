# [Review Request] Phase 31: Autonomous Project Workspace Architecture (M-FDS Extension)

안녕 프라임! 
우리는 현재 MyCrew 엔진에서 논리적(DB) 프로젝트 격리(Phase 29)를 완료하고, 로컬 파일시스템을 직접 읽고 쓰는 자율 에이전트(Luca, Sonnet 등)를 위한 **물리적 폴더 격리 아키텍처(Phase 31)**를 기획했어.

"Project as a Workspace(코드화된 워크스페이스로서의 프로젝트)" 개념을 기반으로, Zero-Config로 프로젝트가 생성될 때 Node.js가 즉각적으로 폴더 맵을 스캐폴딩(Scaffolding)하는 구조야.

현재 작성된 아키텍처 초안의 핵심 구조를 검토하고, 시스템 설계자(Supreme Advisor)의 관점에서 허점이나 개선점이 없는지 깊게 리뷰해 줘.

## 1. 제안하는 폴더 구조 (예시: 미니앱 개발)
04_Projects/
└── 01_미니앱_개발_프로젝트/
    │
    ├── PROJECT.md              # ⭐️ [매 세션 자동 로드] 가장 핵심적인 톤앤매너, 대원칙, 프로젝트 개요
    │
    ├── .project/               # ⚙️ [동적 컨텍스트 & 규칙 폴더] (숨김 폴더)
    │   ├── context.md          # 프로젝트 상세 문맥
    │   └── rules/              # 토픽별 룰 폴더 (code_style.md 등). 필요할 때만 자연어로 Lazy Load
    │
    ├── 01_Memory/              # 🧠 [Auto Memory & 세션 누적 메모리]
    │   ├── user_memory.md      # 사용자와 상호작용으로 쌓인 취향, 피드백, 작업 방식
    │   ├── project_memory.md   # 세션에서 지속적으로 쌓이는 핵심 결정 사항 (진행형)
    │   ├── daily_session_logs/ # 🕒 [매일 자동 기록] 작업 종료 시 에이전트 전원의 대화 요약/타임스탬프 기록
    │   ├── acquired_experience/# 💾 [경험 백업 시스템] 실제 개발 중 획득한 트러블슈팅, 버그픽스 영구 보존
    │   ├── auto_memory/        # 과거 로그의 자동 요약/압축 보관소
    │   └── trend_research/     # 특정 에이전트가 조사해 온 외부 트렌드 아카이브
    │
    ├── 02_Team/                # 👥 [멀티 페르소나 컨테이너]
    │   ├── team_roster.md      # 정예 멤버 구성(최소 3인 권장) 및 R&R 요약
    │   ├── agent1_architect_persona.md  # [agent_id]_[role]_persona.md 포맷 (초기 닉네임 배제)
    │   └── agent2_coder_persona.md      # 사용자 닉네임 부여 시 파일명 동적 업데이트
    │
    ├── 03_Skills/              # 🛠️ [프로젝트 특화 스킬 및 워크플로우]
    │   ├── repetitive_tasks.md # 반복 작업 절차 매뉴얼
    │   └── heavy_analysis.md   # 분석, 스크립트 실행 등 무거운 워크플로우 분리
    │
    └── 04_IO/                  # 📥📤 [입출력(INPUT/OUTPUT) 및 파일 폴링]
        ├── inputs/             # 에이전트에게 제공되는 기초 자료, 원본 에셋
        └── outputs/            # 비동기로 생성된 최종 산출물 및 렌더링 파일

## 2. 주요 동작 메커니즘
- **Lazy Loading**: `PROJECT.md`만 매 세션 강제 로드하고, `.project/rules`는 필요할 때만 RAG나 파일 읽기로 검색.
- **Memory Digestion**: 일일 세션 로그(`daily_session_logs`)가 누적되면, 백그라운드 Watchdog이나 LLM이 이를 요약하여 `auto_memory/` 로 넘기고 `project_memory.md`를 갱신함.
- **Acquired Experience**: 이 프로젝트가 끝나도 다른 곳에서 써먹을 수 있는 버그/아키텍처 인사이트는 `acquired_experience/` 에 영구 저장되어, 추후 크루 복원 시 '숙련도'의 핵심 데이터로 쓰임.

## 🎯 리뷰 중점 요구사항 (Review Focus)
1. **Context Window 방어**: 위와 같은 폴더 구조에서 파일들을 매 세션/태스크마다 에이전트가 읽을 때, 불필요한 토큰 낭비나 무한 루프에 빠질 위험 요소가 없는가?
2. **Naming Convention**: `[agent_id]_[role]_persona.md` 방식과 `01_Memory` 하위 폴더의 분리 구조가 로컬 에이전트의 정규식/파일 스캔 로직에 안정적인가?
3. **Missing Puzzles**: 팀 빌딩 스캐폴딩과 메모리 복원 시스템 관점에서 누락된 치명적인 빈틈이나 추가 제안할 만한 파일/폴더가 있는가?

날카롭고 비판적인 시각으로 검토 부탁해!
