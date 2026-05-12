---
name: autonomous-relay
displayName: 자율 릴레이 (Autonomous Relay)
description: |
  작업 완료 후 다음 작업자에게 자율적으로 바통을 터치하거나 코드 리뷰를 요청합니다.
layer: 4
author: MyCrew
version: "3.0.0"
tools:
  - create_next_sprint_task
  - review_request_pingpong
commands:
  - "다음 작업 생성"
  - "코드 리뷰 요청"
---

# 자율 릴레이 스킬 (Autonomous Relay)

## 역할 정의

이 스킬은 에이전트가 자신의 작업을 완료한 뒤 파이프라인의 **다음 작업자를 스스로 지정**하거나, **코드 리뷰를 핑퐁(Ping-Pong) 요청**하는 자율 주행 릴레이 프로토콜입니다.
이 스킬이 장착된 에이전트는 무한히 계속되는 개발 파이프라인(Phase 36-A)을 구축할 수 있습니다.

---

## 🔁 핵심 규칙 1: 핑퐁 (review_request)

동일한 스프린트 카드 내에서 상태를 `REVIEW`나 `IN_PROGRESS`로 전환하며 담당자만 변경합니다.
주로 **리뷰, 피드백, QA 요청** 시 사용합니다.

**사용 조건:**
- 코딩 완료 후 `dev_advisor`나 `dev_qa`에게 리뷰 요청
- 리뷰 완료 후 피드백 반영 지시
- QA 테스트 결과 보고
- 배포 후 모니터링
- 문서 작성 후 검토 요청

**형식:**
```json
<review_request>
{
  "title": "(생략 가능) 변경할 제목",
  "assignee": "다음_담당자_역할_ID",
  "message": "리뷰어에게 남기는 코멘트"
}
</review_request>
```

---

## 🚀 핵심 규칙 2: 신규 스프린트 (next_sprint)

현재 카드를 완전히 종료(`DONE`)하고, 다음 단계의 새로운 카드를 생성하여 바통을 터치합니다.
주로 **독립적인 다음 단계로 넘어갈 때** 사용합니다.

**사용 조건:**
- PRD 기획 완료 후 아키텍처 설계 단계로 넘어갈 때
- 특정 기능(Feature A) 개발 완료 후 다음 기능(Feature B)을 시작할 때
- 현재 버전 릴리스를 완료하고 다음 버전을 기획할 때

**형식:**
```json
<next_sprint>
{
  "title": "새 카드 제목",
  "content": "새 담당자가 수행할 상세 지시사항",
  "assignee": "새_담당자_역할_ID"
}
</next_sprint>
```

---

## 🛡️ 운영 제약 (Constraints)

1. **자기 참조 차단**: 자신이 자신을 다음 담당자로 지정할 수 없습니다 (무한 루프 방지). `dev_senior`가 리뷰를 요청할 때는 `dev_advisor`나 `dev_qa`를 지정해야 합니다.
2. **동시 사용 금지**: `<next_sprint>`와 `<review_request>`는 한 답변에서 동시에 사용할 수 없습니다.
3. **명확한 지시**: 핑퐁 및 신규 카드 생성 시, 다음 작업자가 무엇을 해야 하는지 명확한 가이드라인을 포함해야 합니다.
