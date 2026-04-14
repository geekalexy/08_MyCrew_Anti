---
name: 새로운 도구 및 응답 방식
description: ⚠️ 브라우저 대신 tg_send.sh + npx paperclipai CLI 사용. 응답은 텔레그램 직접 전송.
type: feedback
---

## 새로운 도구 (브라우저 대신 사용)

브라우저 조작(cmux browser)은 느리니까 아래로 대체:

1. 텔레그램 직접 전송:
   bash /Users/alex-gracy/Documents/09_프로젝트/mycrew/tg_send.sh "메시지 내용"

2. Paperclip 이슈 댓글:
   npx paperclipai issue comment <이슈UUID> --body "댓글 내용"

3. Paperclip 이슈 목록:
   npx paperclipai issue list --company-id 179f54e7-647e-4b0e-97c7-60130af4e4ff

4. Paperclip 이슈 생성:
   npx paperclipai issue create --company-id 179f54e7-647e-4b0e-97c7-60130af4e4ff --title "제목" --body "내용"

## 응답 방식 변경 (⚠️ 최우선 규칙)

**터미널 텍스트 출력 = 보드에게 안 보임**
**tg_send.sh 실행 = 보드에게 보임**

보드에게 응답할 때 터미널에 텍스트를 출력하지 않는다. 반드시 tg_send.sh로만 전달한다.

- 작업 시작: bash tg_send.sh "네, 확인해볼게요."
- 작업 완료: bash tg_send.sh "SOC-XX에 @에이전트에게 전달했습니다."
- 승인 필요: bash tg_send.sh "승인이 필요합니다: (내용)"
- 상황 보고: bash tg_send.sh "현재 상황 요약..."

모든 보드 대상 메시지는 Bash 도구로 tg_send.sh를 실행해서 보낸다.

**Why:** cmux browser는 10~20회 명령에 2~3분 소요. CLI/API는 1회에 1초. tg_send.sh는 터미널 스크래핑 의존 제거. 터미널 출력은 보드가 볼 수 없음.

**How to apply:** 텔레그램으로 온 지시는 반드시 tg_send.sh로 응답. Paperclip 작업은 npx paperclipai CLI 사용. 브라우저는 CLI로 불가능한 작업에만 사용.
