# Phase 39: Sequential Thinking MCP 심층 벤치마킹 분석서
**작성일**: 2026-05-09  
**작성자**: 루카 (Luca)  
**상태**: ✅ Draft (리뷰 대기)

---

## 1. 개요 (Overview)
본 문서는 Model Context Protocol 공식 레포지토리에서 제공하는 **[sequentialthinking]** MCP 서버의 아키텍처와 설계 철학을 분석합니다. 
앞서 수립한 학습 원칙에 따라, 이 서버가 LLM의 '추론(Reasoning)' 과정을 어떻게 구조화하고 사용자와 상호작용하게 만드는지 순수하게 벤치마킹하여 MyCrew에 적용할 인사이트를 도출합니다.

---

## 2. 도구(Tool) 및 스키마 구조화 분석

`sequentialthinking` MCP는 매우 단순하지만 강력한 단 1개의 도구(`sequential_thinking`)만을 제공하며, 프롬프트나 룰셋 문서 대신 **엄격하게 설계된 JSON 스키마(Input Parameters)**를 통해 모델의 사고를 강제합니다.

### 💡 입력 스키마(Schema)의 역할과 의미
이 도구는 LLM이 "혼잣말(Monologue)"로 사고하는 것을 방지하고, 자신의 생각을 **명시적인 데이터 구조**로 저장하도록 만듭니다.

*   `thought` (문자열): 현재 단계의 생각이나 추론 내용.
*   `thoughtNumber` / `totalThoughts` (정수): "내가 지금 몇 번째 단계의 생각을 하고 있고, 앞으로 몇 단계가 더 남았는가?"를 모델 스스로 메타 인지(Meta-cognition)하게 만듭니다.
*   `nextThoughtNeeded` (불리언): 이 값이 `true`이면, 클라이언트(Host)는 응답을 멈추지 않고 모델에게 "다음 생각을 계속해"라고 트리거하여 사고 루프를 유지합니다.
*   `branchFromThought` / `branchId`: 여러 대안(A안, B안)을 두고 고민해야 할 때, 생각의 가지(Branch)를 뻗을 수 있게 해줍니다.

### 💡 문서 및 스킬(Prompt) 파일이 없는 이유 (Shrimp와의 아키텍처 차이)
대표님께서 날카롭게 짚어주셨듯, 이 MCP 저장소에는 Shrimp Task Manager처럼 `system.md`, `tools.md`, `rules.md` 같은 **프롬프트나 에이전트 페르소나 문서가 아예 존재하지 않습니다.**
*   **Shrimp의 접근법 (Agent System)**: 자신이 직접 에이전트를 정의하고, 시스템 프롬프트와 룰을 주입하여 LLM을 조종하려는 "독립적인 에이전트 시스템"입니다.
*   **Sequential Thinking의 접근법 (Pure Tooling)**: 자신은 에이전트가 아니며, 단순히 LLM(클라이언트)이 **"생각을 정리할 때 쓰는 도구(Tool)이자 빈 노트"**일 뿐입니다. 따라서 어떤 페르소나나 룰도 주입하지 않고, 오직 JSON 스키마 구조만을 제공하여 어떤 에이전트든 범용적으로 가져다 쓸 수 있도록 극한의 추상화를 이뤄냈습니다.

---

## 3. UX와 기능의 연결 (User Experience Flow)

이 서버는 사용자가 직접 호출하는 것이 아니라, **LLM이 문제를 풀기 위해 스스로 반복 호출하는 내부 도구(Internal Tool)**로 설계되어 특유의 투명한 UX를 만듭니다.

### 🔄 자율적인 추론 루프 (Autonomous Reasoning Loop)
*   **흐름**: 사용자가 "DB 마이그레이션 계획 짜줘"라고 하면, 모델은 즉시 답을 내뱉지 않고 `sequential_thinking` 도구를 1번 호출합니다. 그리고 `nextThoughtNeeded: true`를 반환합니다. 이를 받은 호스트(Claude 등)는 모델에게 다시 빈 화면을 넘겨주어 2번 생각을 유도합니다.
*   **UX**: 사용자는 모델이 멈춰있는 것이 아니라, 백그라운드에서 "1단계: 리스크 분석 중...", "2단계: 아키텍처 구상 중..." 이라며 **도구를 반복 호출하는 과정(투명한 사고 과정)**을 실시간 UI로 지켜보게 됩니다. (최근 고성능 Thinking 모델들의 `<think>` 애니메이션과 동일한 UX를 API 레벨에서 구현).

### 🔄 유연한 자기 교정 (Self-Correction)
*   **흐름**: 모델이 3단계 생각을 하다가 1단계의 가정이 틀렸음을 깨달으면, `isRevision: true`를 날려 1단계의 생각을 덮어씁니다.
*   **UX**: 사용자는 결과물만 보는 것이 아니라, 모델이 "어떤 시행착오를 거쳐 정답에 도달했는지" 논리적 분기점을 모두 추적(Audit)할 수 있어 결과에 대한 신뢰도가 극상승합니다.

---

## 4. 핵심 특징 및 배울 점 (Insights for MyCrew)

이 MCP 서버에서 배울 수 있는 핵심 철학은 **"추론 과정을 상태 기반의 API(Stateful API)로 만들었다"**는 점입니다.

1.  **"사고의 강제 구조화 (Forced Structured Thinking)"**
    *   기존에는 프롬프트에 "Step-by-step으로 생각해"라고 텍스트로 지시했다면, 이 방식은 **"Step이 끝날 때마다 API로 쏴라"**고 강제합니다.
    *   **MyCrew 적용**: 앞서 기획한 Shrimp의 `/plan task`나 `reflect_task` 단계에 이 스키마를 도입할 수 있습니다. 칸반 카드를 생성하기 전, Opus나 Gemini 3.1 Pro가 `sequential_thinking` 스키마를 활용해 명시적으로 N단계의 생각을 거치도록 파이프라인을 짤 수 있습니다.
2.  **"생각의 영구적 보존 (Persistent Thought History)"**
    *   채팅창의 일회성 텍스트로 날아가는 추론 과정이 아니라, `branch`, `revision` 단위로 데이터베이스나 지식망에 묶일 수 있는 구조입니다.
    *   **MyCrew 적용**: 마이크루의 Graphify 지식베이스에 산출물(Code/PRD)뿐만 아니라, 해당 산출물이 나오기까지 에이전트가 어떤 고민(Branching)을 했는지 `Thought_History` 메타데이터로 함께 아카이브한다면 완벽한 지식 자산이 될 것입니다.
3.  **"결과보다 과정 중심의 UI (Process-Oriented UI)"**
    *   에이전트가 생각하는 과정을 대시보드(Live Preview 우측 패널 등)에 시각적으로 보여준다면, 사용자는 대기 시간을 지루하게 느끼지 않고 "내 AI가 이렇게 열심히 고민 중이구나" 라며 신뢰감을 느끼게 됩니다.

## 5. 결론
`sequentialthinking` MCP는 **"생각하는 방법론 자체를 도구(Tool)로 추상화"**한 매우 훌륭한 사례입니다. 마이크루의 '다중 모델 검증 아키텍처'와 결합하여, 에이전트들이 복잡한 아키텍처를 설계할 때 이 순차적 사고 툴을 내부적으로 활용하도록 연동을 검토하겠습니다.
