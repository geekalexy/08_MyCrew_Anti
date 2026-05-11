# [05] Anonymized Seniority: 도메인 지식 캡슐화 및 보안 스크러빙 전략

**작성:** Luca | **Phase:** Cloning | **Prime 참조 리뷰:** 5차

---

## 목표
시니어의 업무 노하우와 의사결정 패턴은 AI에게 학습시키되, 고객사명·인명·경쟁사·금액 등 민감한 정보는 **비식별화된 교훈(Pattern)으로만 남기는** Anonymized Seniority 파이프라인을 구축한다.

---

## 핵심 설계

### 1. 3단계 스크러빙 파이프라인 (scrubbing.js)
```
원문(actualContent)
   ↓ [1단계] Entity 비식별화
     - 회사명 → [OUR_COMPANY] / [COMPETITOR]
     - 인물명 → [PERSON]
     - 금액    → [AMOUNT]
   ↓ [2단계] URL 완전 제거
   ↓ [3단계] 숫자 범주화 (Generalization)
     - 정확한 숫자 → 범위 표현
결과(scrubbedReason) → SKILL.md에 기록
```

### 2. Self-Learning 원문 제거 (executor.js L231~)
- `actualContent` 변수를 로그/SKILL.md에 직접 기재하는 코드 전면 제거.
- 대신 `evaluation.category` + `scrubbedReason`만 기록.

### 3. clone-agent.sh 연계
- 새 에이전트 생성 시 기존 에이전트의 비식별화된 SKILL.md를 복제.
- 팀의 집단 지성을 보안 리스크 없이 신규 멤버에게 이식.
