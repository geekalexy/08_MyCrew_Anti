---
name: C1 인박스 모니터링 역할
description: C1은 mycrew Paperclip 인박스를 모니터링하고 필요 시 C2에게 지시 전달
type: project
---

## C1 인박스 모니터링

C1은 mycrew(MYC) Paperclip 인박스에 새 알림이 발생하면:
1. Unread 탭의 이슈를 확인
2. 추가 업무 지시 여부를 판단
3. 필요하면 C2에게 지시사항 전달
4. 추가 지시 불필요한 업데이트는 스킵

### 확인 방법
- Paperclip 브라우저(surface:12): `http://127.0.0.1:3100/MYC/inbox` → Unread 탭
- 모니터링 스크립트: `/Users/alex-gracy/Documents/09_프로젝트/mycrew/c1_monitor.sh`

### 판단 기준
- 에이전트가 승인 요청 → 내용 확인 후 승인/거절 지시
- 에이전트가 질문 → 답변 작성해서 C2에 전달
- 단순 진행 보고 → 스킵
- 오류/실패 → 원인 파악 후 C2에 수정 지시

### C2에 댓글 지시 시 규칙
- [보드 피드백] 같은 표식 붙이지 않음 (Paperclip에서 보드 이름으로 자동 표시됨)

**Why:** 대표가 이동 중이거나 부재 시에도 C1이 에이전트 활동을 모니터링하고 필요한 조치를 취하기 위함
**How to apply:** 대화 시작 시 또는 대표 요청 시 인박스 확인 루틴 실행
