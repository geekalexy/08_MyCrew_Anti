---
name: skill-creator
description: |
  Create new skills, modify and improve existing skills, and measure skill performance.
  Use when the user wants to create a skill from scratch, edit or optimize an existing skill,
  benchmark skill performance with variance analysis, or optimize a skill's description
  for better triggering accuracy. Also use when an agent is underperforming and needs
  a new skill to be designed and injected into its Configuration.
displayName: 스킬 제작소 (Skill Creator)
layer: 1
author: MyCrew
version: "1.0.0"
tools: []
commands:
  - "/스킬 만들어줘"
  - "새 스킬 추가"
  - "스킬 개선"
---

# Skill Creator

MyCrew 에이전트 팀의 역량을 키우는 메타스킬입니다.
새로운 스킬을 설계하고, 기존 스킬을 개선하며, 스킬 성능을 평가합니다.

## 스킬 생성 프로세스

스킬을 만드는 과정은 다음과 같습니다:

1. **목적 정의**: 이 스킬이 무엇을 해야 하는지, 어떻게 해야 하는지 결정합니다
2. **초안 작성**: SKILL.md 초안을 작성합니다
3. **트리거 테스트**: 실제 대화 예시로 스킬이 올바르게 발동하는지 확인합니다
4. **성능 평가**: 에이전트 출력물의 품질을 정성적·정량적으로 평가합니다
5. **반복 개선**: 실패 사례를 문서화하고 다음 버전에 반영합니다

---

## SKILL.md 필수 구조

모든 스킬은 반드시 이 구조를 따릅니다:

```markdown
---
name: 스킬-이름 (영문 소문자 하이픈)
description: |
  [트리거 조건 설명 - 에이전트가 이 단락을 보고 스킬 발동 여부를 결정함]
  [한 문장이 아닌, 2~5줄의 상황 설명이어야 함]
  [언제 쓰는지, 어떤 결과물을 낼 수 있는지 명시]
---

# 스킬 제목

## 역할 정의
(이 스킬을 가진 에이전트가 누구인지, 어떤 페르소나인지)

## 핵심 실행 규칙
(에이전트가 반드시 따라야 할 행동 규칙 목록)

## 금지 사항
(절대 해선 안 되는 것들)

## 출력 형식
(산출물의 포맷/구조)

## 예시
(좋은 예시 / 나쁜 예시)

## 실패 케이스 & 개선 로그
(과거에 틀렸던 사례와 수정 방법)
```

---

## 트리거(description) 작성 원칙

> **description은 스킬에서 가장 중요한 부분입니다.**

에이전트는 description을 보고 "지금 이 스킬이 필요한 상황인가?"를 판단합니다.

### 좋은 트리거 ✅
```
description: |
  SNS 콘텐츠 기획, 릴스/쇼츠 스크립트 작성, 마케팅 카피라이팅을 요청할 때 사용합니다.
  3초 Hook 설계, 콘텐츠 피라미드 구조화, 플랫폼별 알고리즘 대응 전략이 필요할 때 발동합니다.
  FOMO·밴드왜건 등 심리학적 마케팅 기법이나 바이럴 콘텐츠 전략 수립 시에도 적용됩니다.
```

### 나쁜 트리거 ❌
```
description: 마케팅 관련 작업
```
→ 너무 짧고 모호함. 에이전트가 발동 여부를 판단하기 어렵습니다.

---

## 스킬 성능 평가 기준

스킬이 제대로 작동하는지 확인하는 3가지 지표:

### 1. 트리거 정확도
- 맞는 상황에서 발동하는가? (False Negative 없는가)
- 틀린 상황에서 발동하지 않는가? (False Positive 없는가)

### 2. 출력 품질
- 스킬의 실행 규칙을 모두 따랐는가?
- 금지 사항을 위반하지 않았는가?
- 출력 형식이 정확한가?

### 3. 사용자 만족도
- 대표님(보드)이 재작업 지시 없이 승인했는가?
- 에이전트 체인의 다음 단계가 이 결과를 잘 활용했는가?

---

## 스킬 분류 체계 (MyCrew 3-Layer)

### Layer 1: 엔진 기본 스킬 (Engine Skills)
ARI 엔진 라우터에 직접 연결되는 핵심 스킬. 반드시 `ai-engine/skills/`의 JS 파일과 1:1 매핑.

| 스킬 | 에이전트 | JS 파일 |
|:---|:---|:---|
| routing | ARI | routingSkill.js |
| marketing | NOVA | marketingSkill.js |
| content | PICO | contentSkill.js |
| analysis | OLLIE | analysisSkill.js |
| design | LUMI | designSkill.js |
| research | OLLIE | researchSkill.js |

### Layer 2: Socian 도메인 스킬 (Domain Skills)
소시안 플랫폼 전용. 도메인 데이터와 결합되어 높은 전문성 발휘.

### Layer 3: 인프라 전략 스킬 (Infrastructure Skills)
컨텍스트 유지, 보안, 라우팅 원칙 등 시스템 레벨 스킬.

---

## 스킬 장착 워크플로우 (Jarvis 역할)

자비스(Jarvis)가 에이전트 성능을 관찰하며 스킬을 장착·튜닝하는 사이클:

```
1. 관찰: 에이전트가 반복적으로 못하는 업무 패턴 감지
      ↓
2. 진단: 관련 스킬이 없거나 description이 부정확한지 확인
      ↓
3. 선택: skill-library에서 적합한 스킬 선택 또는 신규 작성
      ↓
4. 장착: Paperclip 에이전트 > Skills 탭에서 스킬 추가
      ↓
5. 튜닝: Configuration 탭에서 역할 설명 정밀 수정
         예: "마케팅 담당" → "B2B SaaS 마케팅 전문, 콘텐츠+퍼포먼스 병행,
             주 타겟: 중소기업 대표, 한국어 보고체"
      ↓
6. 모니터링: heartbeat 실행 → 출력 품질 관찰
      ↓
7. 기록: skills/agent_*.md에 관찰 결과 업데이트
      ↓
8. 보고: 대표님께 "시스템 업데이트로 팀원 역량이 향상됐습니다" 안내
```

---

## 스킬 개선 시 반드시 기록할 것

```markdown
## 실패 케이스 & 개선 로그

### [날짜] 실패 사례
- **상황**: (어떤 요청이 들어왔는가)
- **에이전트 출력**: (어떻게 잘못 응답했는가)
- **원인 분석**: (description 오류? 규칙 누락? 포맷 불명확?)
- **수정 사항**: (v1 → v2에서 무엇을 바꿨는가)
- **결과 확인**: (수정 후 같은 상황에서 올바르게 작동했는가)
```

---

## 스킬 생성 체크리스트

새 스킬 작성 완료 전 반드시 확인:

- [ ] `name`이 영문 소문자 + 하이픈 형식인가?
- [ ] `description`이 3줄 이상이며 발동 조건이 명확한가?
- [ ] 역할 정의에 에이전트 페르소나가 구체적으로 기술되었는가?
- [ ] 핵심 실행 규칙이 번호 매겨진 목록으로 정리되었는가?
- [ ] 금지 사항이 명시되었는가?
- [ ] 출력 형식 예시가 포함되었는가?
- [ ] 실패 케이스 섹션이 준비되었는가?
- [ ] Layer 1 스킬이라면 `router.js`와 `modelSelector.js`에 카테고리가 매핑됐는가?
