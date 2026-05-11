# Supreme Advisor (Prime) Review Request

**To**: Prime (Supreme Architectural Advisor / Claude Opus)
**From**: Luca (System Developer) & CEO
**Date**: 2026-05-02
**Subject**: Phase 29 - Dynamic Context Injection & Isolation Scope 아키텍처 리뷰 요청

---

## 1. 개요 (Context)
Prime, 우리는 최근 **Phase 28a/b (Zero-Config 프로젝트 생성 및 데이터베이스 격리 스키마 추가)** 작업을 성공적으로 마쳤습니다. 이제 사용자는 프로젝트 생성 시 A(독립), B(부분 참조), C(상호 공유)의 격리 수준을 선택할 수 있으며 이는 DB에 저장됩니다.

이제 본격적으로 에이전트 런타임 환경에서 이를 동적으로 적용하는 **Phase 29 (Dynamic Context Injection)** 아키텍처 기획(PRD)을 완료했습니다. 코딩에 착수하기 전, 아키텍처의 무결성과 환각(Hallucination) 방지 전략에 대한 당신의 최고 수준의 검증을 요청합니다.

## 2. 리뷰 대상 문서 (Target Document)
* **파일 경로**: `02_System_Development/00_아키텍처_문서/Phase29_Dynamic_Context_Injection_PRD.md`

### 핵심 아키텍처 요약
1. **데이터 참조 (Data Fetching)**: 
   - A: 현재 프로젝트만 (`WHERE project_id = ?`)
   - B: 현재 프로젝트 + 참조 프로젝트 (`WHERE project_id IN (?, ?)`) - **Read-Only**
   - C: 전역 데이터 (`WHERE isolation_scope = 'global_knowledge'`)
2. **컨텍스트 오염 방지망 (Anti-Pollution System)**:
   - 프롬프트 파티셔닝 (`<reference_project_data mode="read-only">` 태그 활용)
   - ORM 레벨에서의 참조 프로젝트 ID 쓰기(Write/Update/Delete) 원천 차단
   - 참조 데이터 토큰 제한 (전체 프롬프트의 최대 30%까지만 허용, 초과 시 Truncation)
3. **격리 수준 전환 규칙 (Transition Rules)**:
   - A ↔ B 간의 전환은 자유롭게 허용.
   - **C(Global)로 한번 오픈된 프로젝트는 다시 A나 B로 닫을 수 없음** (타 에이전트의 의존성 증발 및 환각 방지 목적).

---

## 3. 중점 검토 요청 사항 (Questions for Prime)

1. **오염 방지망의 견고성 (Robustness of Anti-Pollution)**
   * B(참조) 모드에서 `<reference_project_data>` 태그 처리와 ORM 단의 Write-block만으로 에이전트(특히 Gemini 2.5 Pro 기반)의 **컨텍스트 오염 및 환각 현상**을 완벽히 통제할 수 있다고 보십니까? 추가적인 시스템 프롬프트 제약이 필요할까요?
2. **상태 전환 정책 (State Transition Rules)**
   * C 상태에서 A/B로의 전환을 시스템 레벨에서 원천 금지(Locked)하는 정책이 데이터 무결성 측면에서 올바른 방향인지 평가해 주십시오. 발생할 수 있는 엣지 케이스(예: 실수로 C로 만든 경우)에 대한 우회책이나 권고안이 있습니까?
3. **토큰 제어 전략 (Token Truncation)**
   * 참조 데이터가 시스템 윈도우의 30%를 넘을 경우 "오래된 순으로 잘라낸다(Truncation)"는 전략을 채택했습니다. 이 방식이 에이전트의 맥락 파악(Chronological Context)에 치명적인 손실을 가져오지 않을까요? 더 나은 Vector DB 기반이나 요약(Summarization) 기반의 병합 전략이 필요할지 조언 부탁드립니다.

---

Prime, 이 아키텍처가 "다중 에이전트 간의 안전한 지식 공유"라는 MyCrew의 궁극적 비전을 달성하는 데 있어 견고한 토대가 될 수 있도록 날카로운 리뷰를 부탁드립니다.
