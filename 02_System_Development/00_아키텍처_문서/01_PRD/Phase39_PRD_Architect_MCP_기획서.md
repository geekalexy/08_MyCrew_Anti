# Phase 39: PRD Architect MCP (가칭) 기획서
**작성일**: 2026-05-09  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft

---

## 1. 개요 (Overview)
본 기획서는 사용자의 파편화된 요구사항을 입력받아 **"이번에 만들 것(MVP)"**과 **"나중에 만들 것(Roadmap)"**을 스스로 분리하고, 버전별 기획서(PRD)를 작성 및 보관한 뒤 사용자와 최종 확정하는 **'AI 기획자(Product Manager)'** 역할의 MCP 아키텍처를 정의합니다.

이 설계는 우리가 분석한 **Shrimp(협상/개입), Claude Task Master(PRD 중심주의), Sequential Thinking(다각도 추론)**의 장점들을 완벽하게 융합한 결과물입니다.

---

## 2. 코어 워크플로우 (Core Workflow)

### Step 1: 요구사항 분석 및 추론 (by Sequential Thinking)
사용자가 "이런 앱 만들어줘"라고 요구사항을 텍스트로 던집니다.
*   **Sequential Thinking 발동**: MCP는 즉시 코딩에 들어가지 않고, 스스로 생각의 가지(Branch)를 뻗습니다.
    *   *Thought 1*: "사용자가 요구한 결제, 소셜 로그인, 게시판, 채팅 중 핵심 가치는 무엇인가?"
    *   *Thought 2*: "채팅은 개발 코스트가 높다. MVP(v1.0)에서는 게시판 댓글로 대체하는 것이 좋다."
    *   *Thought 3 (Branch A)*: "만약 채팅이 필수라면 결제를 v1.1로 미루자."

### Step 2: 버전별 PRD 초안 생성 및 보관 (by Claude Task Master)
추론이 끝나면, 요구사항을 잘라 **버전별 PRD 파일**을 물리적으로 분리 생성하여 시스템에 보관합니다.
*   📁 `.mycrew/docs/roadmaps/`
    *   📄 `v1.0_MVP_PRD.txt`: 즉시 개발에 들어갈 최소 기능 명세.
    *   📄 `v1.1_FastFollow_PRD.txt`: 출시 직후 붙일 2차 기능 (예: 소셜 로그인).
    *   📄 `v2.0_ScaleUp_PRD.txt`: 장기 비전 기능 (예: 실시간 채팅, AI 추천).
*   **효과**: 단일 진실 공급원(PRD.txt)을 강제하여 개발 단계에서 에이전트가 오버엔지니어링(Over-engineering)하는 것을 원천 차단합니다.

### Step 3: 사용자와의 스코프 협상 및 확정 (by Shrimp UX)
버전별 분리가 끝나면, MCP는 사용자에게 협상(Intervention)을 시도합니다.
*   **AI**: *"대표님, 제안하신 기능 중 '채팅'은 v1.0(MVP)에 넣기엔 일정 리스크가 큽니다. v1.0은 '게시판'까지만 구현하고, 채팅은 작성해둔 `v2.0_PRD.txt`로 이관하여 보관해 두었습니다. 이렇게 v1.0 개발을 확정(Confirm)하고 시작할까요? 아니면 채팅을 v1.0으로 다시 가져올까요?"*
*   **사용자 개입**: 사용자는 동의하거나(`Yes`), 일부 기능을 버전에 맞게 수정 지시합니다.
*   **최종 락온(Lock-on)**: 확정된 `v1.0_MVP_PRD.txt`만을 기반으로 **개발 에이전트(Claude Sonnet 4.6)**에게 컨텍스트를 넘기고 코딩을 시작합니다.

---

## 3. MCP 도구 스펙 (Tool Specifications)

이 기획자 MCP 서버가 제공해야 할 핵심 도구(Tools)는 다음과 같습니다.

### 1) `analyze_product_scope`
*   **기능**: 사용자 입력 텍스트를 분석하여 핵심(Must-have)과 부가(Nice-to-have) 기능으로 분류.
*   **내부 로직**: Sequential Thinking 스키마를 상속받아, 기능별 구현 난이도와 예상 시간을 스스로 평가함.

### 2) `generate_versioned_roadmap`
*   **기능**: 분류된 기능을 바탕으로 v1.0, v1.1, v2.0 파일들을 물리적으로 생성하여 `.mycrew/docs/roadmaps/` 디렉토리에 저장.
*   **연동**: MyCrew의 Graphify(지식망)에 "이 프로젝트의 미래 로드맵" 메타데이터로 등록.

### 3) `propose_and_confirm_mvp`
*   **기능**: 사용자에게 v1.0의 범위를 브리핑하고 승인을 대기(Wait for approval)하는 도구.
*   **상태 제어**: 사용자가 확정하기 전까지는 절대 코딩 파이프라인(Task Generator)으로 넘어가지 못하도록 블로킹(Blocking)합니다.

---

## 4. 다중 모델 라우팅 전략 (Multi-Model Strategy)

Claude Task Master의 철학을 빌려, 이 단계에서는 코딩 머신이 아닌 **추론 머신**을 사용합니다.
*   **기획/분석 단계 (해당 MCP)**: 뛰어난 논리력과 기획력을 가진 **Claude Opus 4.6 (Thinking)** 또는 **Gemini 3.1 Pro (High)** 모델을 `Main Model`로 라우팅하여 PRD를 분할합니다.
*   **시장/기술 리서치**: 기획 중 최신 트렌드나 API 비용 확인이 필요하면 **Perplexity API**(`Research Model`)를 찔러 데이터를 보강합니다.
*   **개발 확정 이후**: 기획이 픽스되면 Opus/Pro High 모델은 퇴장하고, **Claude Sonnet 4.6 (Thinking)**(`Execution Model`)이 바통을 이어받아 코딩을 시작합니다.

---

## 5. 기대 효과 (Why this is powerful)
1.  **AI의 오버엔지니어링 방지**: 비개발자 사용자가 "이것도 저것도 다 넣어줘"라고 했을 때, AI가 전부 다 짜려다가 코드가 꼬이고 에러가 폭발하는 고질적 문제를 **'버전 분리'**를 통해 완벽히 해결합니다.
2.  **기획 자산화**: "언젠간 해야지" 했던 아이디어들이 공중으로 증발하지 않고 `v2.0_PRD.txt`로 시스템 지식베이스에 영구 보존됩니다.
3.  **마이크루의 PM 화**: 마이크루가 단순한 '코딩 머신'을 넘어, 사용자의 사업적 리스크를 관리해주는 '프로덕트 매니저' 포지션으로 격상됩니다.
