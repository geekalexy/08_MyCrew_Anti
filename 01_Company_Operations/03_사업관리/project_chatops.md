---
name: Cmux-Paperclip ChatOps 시스템
description: 텔레그램으로 Claude Code와 Paperclip 에이전트를 원격 제어하는 ChatOps 시스템 구축 완료
type: project
---

## Cmux-Paperclip ChatOps 시스템 (2026-04-03 구축, 04-04 업데이트)

### 아키텍처
- Cmux 패널 기반, 텔레그램 봇(@namceobot)으로 원격 제어
- Tailscale VPN (100.98.9.21) 모바일 접속

### 패널 구성
- surface:7 — Claude 1 (C1, 대표 직접 소통)
- surface:6 — Claude 2 (C2/Ari, 텔레그램 비서/회사관리, cmux browser 직접 사용 가능)
- surface:1 — Bridge 서버 (cmux_telegram_bridge.py)
- surface:3 — Paperclip 터미널
- surface:4 — Paperclip 브라우저

### 텔레그램 명령어
- /c1, /c2 — Claude 제어
- /iss, /iss SOC-XX — 이슈 목록/상세
- /newiss — 이슈 생성
- /inbox — 알림 확인 (Unread 탭만)
- /heartbeat — 하트비트
- /c2_stop — C2 중단
- 일반 메시지 → C2 전달

### 주요 파일
- Bridge: /Users/alex-gracy/Documents/09_프로젝트/mycrew/cmux_telegram_bridge.py
- C2 대화 로그: ~/Desktop/claude-3/c2/ (날짜별 .md)
- 이슈 캐시: ~/Desktop/claude-3/c2/paper-socian-txt/ (프로젝트별 폴더, 23개 이슈)

### 04-04 주요 변경
- cmux 알림 완전 비활성화
- C1/C2 승인 요청만 인라인 버튼 유지
- /inbox → Unread 탭 + parse_inbox() (❌실패/💬댓글/✅승인 섹션 분리)
- 이슈 상세 → parse_issue_page() (누가/언제/무엇, UI 노이즈 제거)
- 에이전트 running 감지 → '🏃 CEO가 일을 시작했어요' 알림
- 에이전트 영문 댓글 → 규칙 기반 한글 번역 (_translate_agent_text)
- clean_terminal → _is_noise() 패턴 필터 방식 전환
- 에이전트 내부 로그 필터 (EXECUTED COMMAND, SYSTEMrun 등)
- Live 감시: running 추적 → 완료 시 보고 + 로컬 캐시 자동 갱신
- _safe_edit 래퍼, C2 메시지 반복 제거
- 이슈 로컬 캐시 (URL 직접 이동)

### 역할 용어
- 보드(Board) = 회사 설립자/대표 (사용자)
- 에이전트(CEO, CMO 등) = AI 직원

### 회사 구분
- 소시안(SOC) = 대표 개인 업무용 (분양 아님)
- mycrew(MYC) = 내부 개발팀 운영 (분양 아님)
- 분양 회사 = 지인/고객용으로 새로 생성

**Why:** 유료 클라우드 없이 로컬에서 AI 에이전트 회사를 운영하고 모바일로 제어하기 위함
**How to apply:** bridge 스크립트 수정 시 cmux 패널 안에서 실행해야 소켓 접근 가능 (nohup 불가). C2는 cmux browser 명령 자유 사용 허용됨.
