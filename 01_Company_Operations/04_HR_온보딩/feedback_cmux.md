---
name: Cmux 실행 환경 주의사항
description: cmux CLI는 nohup 백그라운드에서 소켓 접근 불가, 반드시 cmux 패널 안에서 실행
type: feedback
---

cmux CLI를 subprocess로 호출하는 스크립트는 반드시 cmux 패널(surface) 안에서 실행해야 한다.
nohup이나 독립 프로세스로 실행하면 "Failed to write to socket" 에러 발생.

**Why:** cmux 소켓 인증이 cmux 내부 환경에서만 작동하는 것으로 보임. env 변수 설정만으로는 해결 안 됨.
**How to apply:** bridge 스크립트 등 cmux CLI 의존 프로세스는 `cmux new-split` → `cmux send`로 패널 안에서 실행할 것.
