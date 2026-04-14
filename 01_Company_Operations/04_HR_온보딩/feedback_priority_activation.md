---
name: Paperclip 우선순위와 에이전트 활성화
description: 이슈 우선순위를 Critical 또는 High로 설정하면 담당 에이전트가 즉시 활성화됨
type: feedback
---

이슈 생성/할당 시 우선순위를 Critical 또는 High로 설정하면 담당 에이전트가 바로 활성화(heartbeat 자동 실행)된다.

**Why:** 일반 우선순위는 다음 heartbeat 사이클까지 대기하지만, Critical/High는 즉시 실행.
**How to apply:** 긴급 업무나 즉시 시작이 필요한 이슈에는 Critical/High 설정. 이슈 생성 시 우선순위 필드 활용.
