---
name: Bridge 일일 사용량 제한
description: 텔레그램 Bridge에 일일 명령 30회 제한 구현. 유료 버전에서는 0(무제한)으로 변경 필요.
type: project
---

## Bridge 일일 사용량 제한

- 변수: `DAILY_COMMAND_LIMIT = 30` (cmux_telegram_bridge.py 상단)
- 무료 테스트: 30회/일
- 유료 버전: `DAILY_COMMAND_LIMIT = 0` 으로 변경 → 무제한

### 적용 범위
- 일반 메시지 (handle_message)
- /c2 명령

### 중요
- **유료 대행(Pro) 전환 시 반드시 0으로 변경할 것**
- bootstrap.sh 분양 시에도 30회 기본 적용됨
- 사용자에게 "오늘 사용 한도(30회)에 도달했습니다" 메시지 표시

**Why:** 내 Claude 계정으로 지인 C2를 운영하므로 사용량 보호 필요
**How to apply:** Pro 전환 시 DAILY_COMMAND_LIMIT = 0, 또는 고객별 설정 파일 분리
