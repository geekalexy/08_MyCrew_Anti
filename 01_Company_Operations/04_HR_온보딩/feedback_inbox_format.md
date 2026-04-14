---
name: /inbox 응답 포맷 확정
description: inbox 알림은 parse_inbox로 파싱하여 ❌실행실패 / 💬이슈댓글 / ✅승인완료 세 섹션으로 정리하여 전달
type: feedback
---

/inbox 결과는 raw 텍스트가 아닌 parse_inbox()로 파싱한 깔끔한 포맷으로 전달. 대표님이 "가장 마음에 들고 유용하다"고 확인함.

**Why:** raw 텍스트에는 UI 요소(Recent/Unread/All/Retry/failed)가 포함되어 노이즈가 심함.
**How to apply:** inbox 관련 모든 전달 경로(cmd_inbox, cmd_p inbox, live 감시, 30분 폴링)에서 parse_inbox() 사용.
