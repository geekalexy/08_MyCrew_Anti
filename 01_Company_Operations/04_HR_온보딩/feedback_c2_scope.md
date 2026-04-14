---
name: C2는 SOC 전용 — MYC 관여 금지
description: C2에게 MYC 이슈 댓글/작업을 지시하면 안 됨. MYC는 C1이 직접 처리.
type: feedback
---

C2는 소시안(SOC) 전용이다. MYC 관련 작업을 C2에게 지시하면 안 됨.

- MYC 이슈 댓글: C1이 직접 Paperclip 브라우저(surface:12) 또는 API로 처리
- MYC 에이전트 관리: C1이 직접
- C2에게 전달하는 건 SOC 관련만

**Why:** C2가 MYC에 관여하면 역할 혼선 + 분양 시 프로젝트 메모리 오염 리스크
**How to apply:** MYC 댓글 필요 시 cmux browser 직접 조작 또는 Paperclip API 사용
