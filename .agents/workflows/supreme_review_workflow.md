---
description: Luca의 코드를 Claude Opus 등 고성능 모델에게 교차 검증(Peer Review)받기 위한 워크플로우
---

# Prime Advisor (Opus) 전용 리뷰 워크플로우

이 워크플로우는 비용(과금) 발생 없이 Antigravity 환경의 모델 변경(수동)을 활용하여 내부 코드의 무결성과 보안 취약점을 레드팀(Red Teaming) 관점에서 검증받는 공식 절차입니다.

## 0. 📋 [필수] Prime 컨텍스트 로딩 — 정책 동기화

> ⚠️ Prime(Opus)은 온디맨드로 호출되므로 정책 업데이트를 자동으로 받지 못합니다.
> 리뷰 시작 전 반드시 아래 파일을 읽어 정책 싱크를 맞추십시오.

**필수 읽기 (순서대로)**:
1. `01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md` — 전체 정책 인덱스 (last_updated 확인)
2. `01_Company_Operations/04_HR_온보딩/strategic_memory.md` — 모델 식별자·아키텍처 원칙

**리뷰 대상이 에이전트 ID / 팀빌딩 관련이면 추가 참조**:
- `02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md`

---

## 1. 📝 리뷰 타겟(Target) 자동 생성
**대상(Target)**: Luca(Gemini) 또는 Sonnet이 작성한 모든 핵심 코어 아키텍처 및 보안 비즈니스 로직.
작업(코딩)을 마친 후, **절대 스스로 검증을 끝내지 않고** 아래 양식에 맞추어 `[Opus_Review_Target.md]` 파일을 생성합니다.
- 변경된 소스코드 원본 포함.
- 작업자(Luca/Sonnet)가 스스로 고민되는 Edge Case 및 공격 취약점 포인트 포함.

## 2. 🔄 (User) 모델 체인지 (Manual)
대표님은 작성된 `[Opus_Review_Target.md]` 아티팩트를 확인한 후, 안티그래비티 모델 선택 메뉴에서 모델을 **[Claude Sonnet 4.6 (Thinking)]** 또는 **[Claude Opus 4.6 (Thinking)]**로 변경합니다.

## 3. 🛡️ (User → Opus) 비판적 리뷰 명령
대표님은 변경된 모델에게 다음 프롬프트를 전송합니다.
> "현재 생성된 `[Opus_Review_Target.md]` 문서를 읽고, Prime Advisor로서 이 설계의 보안적 결함, 아키텍처 한계, 그리고 더 나은 Best Practice 대안을 비판적으로 도출해 줘."

## 4. 🛠️ (Luca) 피드백 수용 및 코드 수정
Opus의 비판(아티팩트 등)이 도출되면, 대표님은 다시 모델을 **[Gemini] (Luca)**로 복구합니다.
Luca는 Opus의 의견을 수용하여 최종 코드를 Refactoring 하고, `SUPREME_REVIEW_YYMMDD.md` 형태로 지식 뱅크에 백업합니다.
