# Phase 39: Claude Task Master 심층 벤치마킹 분석서
**작성일**: 2026-05-09  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft (리뷰 대기)

---

## 1. 개요 (Overview)
본 문서는 Cursor, Windsurf 등 다양한 AI IDE에 이식할 수 있는 강력한 작업 관리 MCP 서버인 **[claude-task-master]**의 아키텍처와 UX 철학을 분석합니다. 
앞서 분석한 Shrimp 시스템과 유사한 목적(칸반/태스크 관리)을 가지지만, **다중 모델(Multi-Model) 라우팅**과 **컨텍스트 윈도우(토큰) 최적화** 측면에서 MyCrew가 반드시 배워야 할 탁월한 설계 철학을 보여줍니다.

---

## 2. 문서 및 아키텍처 구조화 (Document Structure & Roles)

Claude Task Master는 룰셋을 파편화하기보다는 **PRD(Product Requirements Document)** 하나를 '단일 진실 공급원(Single Source of Truth)'으로 강제하는 구조를 취합니다.

*   **`.taskmaster/docs/prd.txt`**: 프로젝트 초기화 시 가장 먼저 작성하도록 강제되는 요구사항 정의서입니다. 에이전트는 이 문서만을 기준으로 전체 태스크를 파싱(Parse)하고 의존성을 부여합니다.
*   **다중 모델 라우팅 구조 (Model Orchestration)**:
    이 서버의 가장 큰 아키텍처적 특징은 목적에 따라 **3가지 모델 역할**을 강제 분리한다는 점입니다.
    1.  `Main Model`: 실제 코드를 짜고 태스크를 수행하는 주력 모델 (주로 Claude Sonnet 4.6 (Thinking))
    2.  `Research Model`: 코드 작성 전, 외부 지식이나 최신 마이그레이션 문서를 검색해오는 전담 모델 (Perplexity, xAI 등 외부 API 연동)
    3.  `Fallback Model`: 주력 모델이 에러를 뱉거나 Rate Limit에 걸렸을 때 백업으로 도는 모델

---

## 3. UX와 워크플로우의 연결 (User Experience Flow)

채팅창에서 인간과 AI가 소통하며 태스크를 진행하는 방식이 매우 직관적이고 실용적입니다.

### 💡 3.1. 채팅 기반의 자연스러운 상태 제어
*   **UX 흐름**: 슬래시 명령어가 아니라 자연어로 "Can you parse my PRD?" → "What's the next task?" → "Can you help me implement task 3?"와 같이 대화하듯 워크플로우를 넘깁니다. 
*   **배울 점**: `parse_prd`, `next_task` 같은 MCP 도구를 시스템이 백그라운드에서 적절히 트리거해주어, 사용자는 복잡한 UI 클릭 없이도 칸반을 제어하는 매끄러운 UX를 경험합니다.

### 💡 3.2. 실시간 모델 교체 (Dynamic Model Switching)
*   **UX 흐름**: 작업 도중 채팅창에 "Change the main model to claude-code/sonnet"이라고 치면, 즉각적으로 시스템 환경 변수가 업데이트되며 주력 모델이 교체됩니다.
*   **배울 점**: 개발자가 별도의 설정(Settings) 창에 들어갈 필요 없이, 대화의 맥락(Context) 안에서 모델을 핫스왑(Hot-swap)할 수 있는 극강의 편의성입니다.

### 💡 3.3. '리서치'의 독립적 워크플로우 (Research Command)
*   **UX 흐름**: "Research React Query v5 migration strategies for our current API in src/api.js" 라고 지시하면, `Main Model`이 멈추고 `Research Model`(예: Perplexity)이 호출되어 최신 문서를 긁어온 뒤, 그 결과를 바탕으로 `Main Model`이 코드를 짭니다.
*   **배울 점**: 코딩과 검색의 역할을 분리하여 환각(Hallucination)을 없애고 최신 기술 스택 도입을 안전하게 수행합니다.

---

## 4. 핵심 특징 및 배울 점 (Insights for MyCrew)

이 MCP 서버에서 MyCrew가 즉각적으로 흡수해야 할 두 가지 핵심 무기가 있습니다.

1.  **"토큰 최적화를 위한 도구 모듈화 (Selective Tool Loading)"**
    *   Claude Task Master는 총 36개의 도구를 제공하지만, 이들을 한 번에 LLM에게 주입하면 프롬프트 토큰만 약 21,000개가 소모됩니다.
    *   이를 막기 위해 사용자가 환경 변수(`TASK_MASTER_TOOLS`)로 `core`(7개), `standard`(15개), `all`(36개) 모드를 선택할 수 있게 했습니다. 
    *   **MyCrew 적용**: 우리도 아리 엔진이 수많은 스킬(Tool)을 가지게 될 텐데, 현재 Phase(기획, 코딩, 테스트)에 따라 LLM에게 주입하는 **MCP 도구의 개수를 동적으로 제한**하여 토큰 낭비를 막고 에이전트의 집중력을 높여야 합니다.
2.  **"멀티 API Key 오케스트레이션 (Routing Engine)"**
    *   하나의 MCP 서버가 내부적으로 Anthropic, OpenAI, Perplexity의 API 키를 모두 품고, 작업의 성격(코딩 vs 검색)에 따라 알아서 API를 바꿔가며 쏩니다.
    *   **MyCrew 적용**: 우리가 앞서 기획한 **Opus/Pro High(기획) - Sonnet(실행) - Gemini Pro(리뷰/검증)** 3종 시너지를 이 저장소의 라우팅 구조처럼 완벽하게 백엔드에서 오케스트레이션(분배)할 수 있다는 훌륭한 레퍼런스입니다.

---

## 5. 결론 및 적용 방향
Claude Task Master는 **"에이전트의 효율(Token) 관리"**와 **"다중 모델(Multi-Model) 협업"** 측면에서 가장 실용적인 답안지를 제시하고 있습니다. 

특히 36개의 도구를 `core` / `standard`로 묶어서 토큰을 아끼는 기법은 MyCrew의 MCP 서버 아키텍처에도 반드시 도입해야 합니다. 다음 스텝으로, MyCrew의 도구들을 Phase별로 묶어(Grouping) 동적으로 로드하는 **'Dynamic Tool Injector'** 설계를 진행하는 것을 제안합니다.
